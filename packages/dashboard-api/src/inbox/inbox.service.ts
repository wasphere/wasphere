import { randomUUID } from 'crypto';
import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { WorkspacesService } from '../workspaces/workspaces.service';
import { InboxEventsService } from './inbox-events.service';
import { ListConversationsQueryDto } from './dto/list-conversations-query.dto';
import { ListMessagesQueryDto } from './dto/list-messages-query.dto';
import { PatchConversationDto } from './dto/patch-conversation.dto';
import { SendReplyDto } from './dto/send-reply.dto';

// List/preview labels for outbound non-text replies (no body text to show).
const OUTBOUND_PREVIEW: Record<string, string> = {
  image: '📷 Photo',
  document: '📄 Document',
  poll: '📊 Poll',
};

@Injectable()
export class InboxService {
  private readonly logger = new Logger(InboxService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly workspaces: WorkspacesService,
    private readonly events: InboxEventsService,
  ) {}

  // ── access control ────────────────────────────────────────────────────────

  private async assertMember(workspaceId: string, userId: string): Promise<void> {
    const membership = await this.prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
      select: { id: true },
    });
    if (!membership) throw new ForbiddenException('Not a member of this workspace');
  }

  // Loads a conversation and guarantees it belongs to the workspace (no IDOR).
  private async loadConversation(workspaceId: string, conversationId: string) {
    const convo = await this.prisma.conversation.findFirst({
      where: { id: conversationId, workspaceId },
      include: { contact: true },
    });
    if (!convo) throw new NotFoundException('Conversation not found');
    return convo;
  }

  private async writeAudit(sessionId: string | null, method: string, endpoint: string): Promise<void> {
    await this.prisma.auditLog.create({
      data: { sessionId: sessionId ?? undefined, method, endpoint, statusCode: 200 },
    });
  }

  // ── reads ─────────────────────────────────────────────────────────────────

  async listConversations(userId: string, workspaceId: string, q: ListConversationsQueryDto) {
    await this.assertMember(workspaceId, userId);
    const take = q.limit ?? 30;

    const where: Prisma.ConversationWhereInput = { workspaceId };
    if (q.status) where.status = q.status;
    if (q.q) {
      const term = q.q.trim();
      where.OR = [
        { lastPreview: { contains: term, mode: 'insensitive' } },
        { contact: { is: { whatsappName: { contains: term, mode: 'insensitive' } } } },
        { contact: { is: { savedName: { contains: term, mode: 'insensitive' } } } },
        { contact: { is: { phone: { contains: term.replace(/[^0-9]/g, '') } } } },
      ];
    }

    const rows = await this.prisma.conversation.findMany({
      where,
      orderBy: [{ lastMessageAt: 'desc' }, { id: 'desc' }],
      take: take + 1,
      ...(q.cursor ? { cursor: { id: q.cursor }, skip: 1 } : {}),
      include: { contact: true },
    });

    const hasMore = rows.length > take;
    const items = hasMore ? rows.slice(0, take) : rows;
    return {
      items: items.map((c) => this.toConversationView(c)),
      nextCursor: hasMore ? items[items.length - 1].id : null,
    };
  }

  async getConversation(userId: string, workspaceId: string, conversationId: string) {
    await this.assertMember(workspaceId, userId);
    const convo = await this.loadConversation(workspaceId, conversationId);
    return this.toConversationView(convo);
  }

  async listMessages(
    userId: string,
    workspaceId: string,
    conversationId: string,
    q: ListMessagesQueryDto,
  ) {
    await this.assertMember(workspaceId, userId);
    await this.loadConversation(workspaceId, conversationId); // 404 + IDOR guard
    const take = q.limit ?? 50;

    const rows = await this.prisma.message.findMany({
      where: { conversationId },
      orderBy: [{ waTimestamp: 'desc' }, { id: 'desc' }],
      take: take + 1,
      ...(q.cursor ? { cursor: { id: q.cursor }, skip: 1 } : {}),
    });

    const hasMore = rows.length > take;
    const items = hasMore ? rows.slice(0, take) : rows;
    return {
      items,
      nextCursor: hasMore ? items[items.length - 1].id : null,
    };
  }

  // ── writes ────────────────────────────────────────────────────────────────

  async patchConversation(
    userId: string,
    workspaceId: string,
    conversationId: string,
    dto: PatchConversationDto,
  ) {
    await this.assertMember(workspaceId, userId);
    const convo = await this.loadConversation(workspaceId, conversationId);

    const data: Prisma.ConversationUpdateInput = {};
    if (dto.status) data.status = dto.status;
    if (dto.tags) data.tags = dto.tags as Prisma.InputJsonValue;

    const updated = await this.prisma.conversation.update({
      where: { id: convo.id },
      data,
      include: { contact: true },
    });
    await this.writeAudit(convo.sessionId, 'PATCH', `/inbox/conversations/${conversationId}`);
    this.events.emit({ type: 'conversation.update', workspaceId, conversationId });
    return this.toConversationView(updated);
  }

  async markRead(userId: string, workspaceId: string, conversationId: string) {
    await this.assertMember(workspaceId, userId);
    const convo = await this.loadConversation(workspaceId, conversationId);
    if (convo.unreadCount !== 0) {
      await this.prisma.conversation.update({
        where: { id: convo.id },
        data: { unreadCount: 0 },
      });
      this.events.emit({ type: 'conversation.update', workspaceId, conversationId });
    }
    return { ok: true, unreadCount: 0 };
  }

  async sendReply(
    userId: string,
    workspaceId: string,
    conversationId: string,
    dto: SendReplyDto,
  ) {
    await this.assertMember(workspaceId, userId);
    const convo = await this.loadConversation(workspaceId, conversationId);

    if (convo.sessionDeletedAt) {
      throw new ServiceUnavailableException(
        'This conversation is a read-only archive — its WhatsApp session was deleted.',
      );
    }

    // getDecryptedToken re-checks membership + that the WA server is configured.
    const { waServerUrl, token } = await this.workspaces.getDecryptedToken(userId, workspaceId);
    const to = convo.contact.phone;
    const base =
      `${waServerUrl.replace(/\/+$/, '')}/api/sessions/` +
      `${encodeURIComponent(convo.sessionId)}/messages`;
    const kind = dto.kind ?? 'text';

    // Map the reply kind -> (wa-server endpoint, request body, persisted shape).
    let endpoint: string;
    let sendBody: Record<string, unknown>;
    let msgType: string;
    let msgBody: string | null;
    let msgPayload: Prisma.InputJsonValue | undefined;
    // For sent images we keep the data URI so the thread can show the picture.
    let msgMediaUrl: string | null = null;

    switch (kind) {
      case 'image':
        endpoint = `${base}/image`;
        sendBody = { to, url: dto.media, caption: dto.caption };
        msgType = 'image';
        msgBody = dto.caption ?? null;
        msgPayload = dto.caption ? { caption: dto.caption } : undefined;
        msgMediaUrl = dto.media ?? null;
        break;
      case 'document':
        endpoint = `${base}/document`;
        sendBody = { to, url: dto.media, fileName: dto.fileName, mimetype: dto.mimetype };
        msgType = 'document';
        msgBody = dto.fileName ?? null;
        msgPayload = { fileName: dto.fileName ?? null, mimetype: dto.mimetype ?? null };
        break;
      case 'poll':
        endpoint = `${base}/poll`;
        sendBody = { to, name: dto.pollName, options: dto.options };
        msgType = 'poll';
        msgBody = dto.pollName ?? null;
        msgPayload = { name: dto.pollName ?? null, options: dto.options ?? [] };
        break;
      case 'reaction':
        endpoint = `${base}/reaction`;
        sendBody = { to, messageId: dto.targetMessageId, emoji: dto.emoji ?? '' };
        msgType = 'reaction';
        msgBody = dto.emoji ?? null;
        msgPayload = undefined;
        break;
      default:
        endpoint = `${base}/text`;
        sendBody = { to, text: dto.text };
        msgType = 'text';
        msgBody = dto.text ?? '';
        msgPayload = undefined;
    }

    let resp: globalThis.Response;
    try {
      resp = await fetch(endpoint, {
        method: 'POST',
        headers: { 'X-Api-Token': token, 'Content-Type': 'application/json' },
        body: JSON.stringify(sendBody),
      });
    } catch (err) {
      this.logger.warn(`[Inbox] reply send transport error: ${String(err)}`);
      throw new ServiceUnavailableException('WA Server unreachable. Reply not sent.');
    }

    if (!resp.ok) {
      // 404 (session not found) / 4xx (bad media) / 5xx (disconnected)
      this.logger.warn(
        `[Inbox] reply send failed status=${resp.status} kind=${kind} session=${convo.sessionId}`,
      );
      throw new ServiceUnavailableException(
        'Session disconnected — reconnect to send.',
      );
    }

    // Reactions attach to an existing message — nothing to persist in the thread.
    if (kind === 'reaction') {
      await this.writeAudit(convo.sessionId, 'POST', `/inbox/conversations/${conversationId}/messages`);
      return { ok: true };
    }

    const result = (await resp.json().catch(() => ({}))) as { messageId?: string };
    const waMessageId = result.messageId ?? `local-${randomUUID()}`;
    const waTimestamp = new Date();
    const preview =
      msgBody && msgBody.length ? msgBody.slice(0, 140) : OUTBOUND_PREVIEW[msgType] ?? msgType;

    const message = await this.prisma.message.create({
      data: {
        workspaceId,
        conversationId: convo.id,
        waMessageId,
        direction: 'OUTBOUND',
        type: msgType,
        body: msgBody,
        payload: msgPayload,
        mediaUrl: msgMediaUrl,
        status: 'SENT',
        fromMe: true,
        waTimestamp,
      },
    });

    await this.prisma.conversation.update({
      where: { id: convo.id },
      data: { lastPreview: preview, lastMessageAt: waTimestamp },
    });

    await this.writeAudit(convo.sessionId, 'POST', `/inbox/conversations/${conversationId}/messages`);
    this.events.emit({ type: 'message.new', workspaceId, conversationId });
    return message;
  }

  // ── view shaping ────────────────────────────────────────────────────────────

  private toConversationView(c: {
    id: string;
    sessionId: string;
    status: string;
    lastMessageAt: Date;
    lastPreview: string | null;
    unreadCount: number;
    tags: Prisma.JsonValue;
    sessionDeletedAt: Date | null;
    contact: { id: string; jid: string; phone: string; whatsappName: string | null; savedName: string | null; avatarUrl: string | null };
  }) {
    return {
      id: c.id,
      sessionId: c.sessionId,
      status: c.status,
      lastMessageAt: c.lastMessageAt,
      lastPreview: c.lastPreview,
      unreadCount: c.unreadCount,
      tags: c.tags ?? [],
      sessionDeletedAt: c.sessionDeletedAt,
      contact: {
        id: c.contact.id,
        phone: c.contact.phone,
        // display priority: savedName ?? whatsappName ?? phone
        name: c.contact.savedName ?? c.contact.whatsappName ?? c.contact.phone,
        savedName: c.contact.savedName,
        whatsappName: c.contact.whatsappName,
        avatarUrl: c.contact.avatarUrl,
      },
    };
  }
}
