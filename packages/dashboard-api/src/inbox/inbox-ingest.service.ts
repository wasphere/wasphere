import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { WebhookEventDto } from '../internal/dto/webhook-event.dto';
import { InboxEventsService } from './inbox-events.service';

// Baileys contentType -> our friendly message `type` string.
const TYPE_MAP: Record<string, string> = {
  conversation: 'text',
  extendedTextMessage: 'text',
  imageMessage: 'image',
  videoMessage: 'video',
  audioMessage: 'audio',
  documentMessage: 'document',
  stickerMessage: 'sticker',
  locationMessage: 'location',
  contactMessage: 'contact',
  pollCreationMessage: 'poll',
  reactionMessage: 'reaction',
};

function mapType(contentType: unknown): string {
  if (typeof contentType !== 'string') return 'unknown';
  return TYPE_MAP[contentType] ?? contentType;
}

// messageTimestamp may be a number (unix seconds) or a protobuf Long {low,high}.
function toUnixSeconds(ts: unknown): number {
  if (typeof ts === 'number') return ts;
  if (ts && typeof ts === 'object' && 'low' in (ts as Record<string, unknown>)) {
    return Number((ts as { low: number }).low);
  }
  return Math.floor(Date.now() / 1000);
}

function previewFor(type: string, body: string | null): string {
  if (body) return body.slice(0, 140);
  const labels: Record<string, string> = {
    image: '📷 Photo', video: '🎥 Video', audio: '🎙️ Voice note',
    document: '📄 Document', sticker: '🌟 Sticker', location: '📍 Location',
    contact: '👤 Contact', poll: '📊 Poll', reaction: '👍 Reaction',
  };
  return labels[type] ?? type;
}

/**
 * Persists inbound/outbound WhatsApp messages into the Inbox tables. Hooked into
 * the existing `POST /internal/webhook-event/:workspaceId` path alongside the
 * webhook fan-out (it does not replace it). Idempotent on (workspace, waMessageId).
 */
@Injectable()
export class InboxIngestService {
  private readonly logger = new Logger(InboxIngestService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: InboxEventsService,
  ) {}

  /** Fire-and-forget entry point — never blocks the internal 202 response. */
  ingest(workspaceId: string, dto: WebhookEventDto): void {
    this.handle(workspaceId, dto).catch((err: unknown) => {
      this.logger.error(
        `[Inbox] ingest error ws=${workspaceId} event=${dto.event}: ${String(err)}`,
      );
    });
  }

  private async handle(workspaceId: string, dto: WebhookEventDto): Promise<void> {
    switch (dto.event) {
      case 'message.received':
        return this.ingestInbound(workspaceId, dto);
      case 'messages.update':
        return this.applyStatusUpdates(workspaceId, dto);
      case 'session.deleted':
      case 'session.logged_out':
        return this.archiveSession(workspaceId, dto.sessionId);
      case 'session.connected':
        return this.restoreSession(workspaceId, dto.sessionId);
      default:
        return;
    }
  }

  private async ingestInbound(workspaceId: string, dto: WebhookEventDto): Promise<void> {
    const data = dto.data as Record<string, any>;
    const m = data.message as Record<string, any> | undefined;
    const rawJid: string | undefined = data.from ?? m?.key?.remoteJid;
    const waMessageId: string | undefined = data.messageId ?? m?.key?.id;
    if (!rawJid || !waMessageId) return;

    // v1.1 is 1:1 only — skip groups, status, broadcast lists and channels.
    if (
      rawJid.endsWith('@g.us') ||
      rawJid.endsWith('@broadcast') ||
      rawJid.endsWith('@newsletter') ||
      rawJid === 'status@broadcast' ||
      data.isGroup === true
    ) {
      return;
    }

    // LID addressing: WhatsApp now sends an opaque "<id>@lid" as the chat id.
    // The real phone-number JID arrives as senderJid/senderPn — prefer it so we
    // store/display the true number and reply to a deliverable address.
    const senderPn: string | undefined = data.senderPn ?? m?.key?.senderPn ?? undefined;
    const isLid = rawJid.endsWith('@lid');
    const jid: string = data.senderJid ?? (isLid && senderPn ? senderPn : rawJid);

    const fromMe = Boolean(m?.key?.fromMe);
    const pushName: string | null = (m?.pushName as string) ?? null;
    const avatarUrl: string | null = (data.avatarUrl as string) ?? null;
    const phone = jid.split('@')[0].replace(/[^0-9]/g, '');
    const waTimestamp = new Date(toUnixSeconds(data.timestamp ?? m?.messageTimestamp) * 1000);
    const type = mapType(data.type);
    const body: string | null =
      data.content?.text ?? data.content?.caption ?? data.content?.reaction ?? null;
    // Downloaded media arrives as a base64 data URI; keep it in mediaUrl, not
    // in payload (so the JSON column stays small).
    const content: Record<string, unknown> = { ...(data.content ?? {}) };
    const mediaUrl: string | null = (content.dataUri as string) ?? null;
    delete content.dataUri;

    // Idempotency guard (the @@unique constraint is the ultimate backstop).
    const dup = await this.prisma.message.findUnique({
      where: { workspaceId_waMessageId: { workspaceId, waMessageId } },
      select: { id: true, type: true, conversationId: true },
    });
    if (dup) {
      // A message can arrive first as an undecryptable placeholder (envelope
      // failed) and then again decrypted after a Signal retry — same waMessageId.
      // Upgrade the placeholder in place instead of dropping the real content.
      if (dup.type === 'unknown' && type !== 'unknown') {
        await this.prisma.message.update({
          where: { id: dup.id },
          data: { type, body, payload: content as Prisma.InputJsonValue, mediaUrl },
        });
        await this.prisma.conversation.update({
          where: { id: dup.conversationId },
          data: { lastPreview: previewFor(type, body) },
        });
        this.events.emit({ type: 'message.new', workspaceId, conversationId: dup.conversationId });
      }
      return;
    }

    const conversationId = await this.prisma.$transaction(async (tx) => {
      const contact = await tx.contact.upsert({
        where: { workspaceId_jid: { workspaceId, jid } },
        update: {
          ...(pushName ? { whatsappName: pushName } : {}),
          ...(avatarUrl ? { avatarUrl } : {}),
        },
        create: { workspaceId, jid, phone, whatsappName: pushName, avatarUrl },
      });

      const convo = await tx.conversation.upsert({
        where: {
          workspaceId_sessionId_contactId: {
            workspaceId,
            sessionId: dto.sessionId,
            contactId: contact.id,
          },
        },
        update: {},
        create: { workspaceId, contactId: contact.id, sessionId: dto.sessionId },
      });

      await tx.message.create({
        data: {
          workspaceId,
          conversationId: convo.id,
          waMessageId,
          direction: fromMe ? 'OUTBOUND' : 'INBOUND',
          type,
          body,
          payload: content as Prisma.InputJsonValue,
          mediaUrl,
          status: fromMe ? 'SENT' : 'DELIVERED',
          fromMe,
          waTimestamp,
        },
      });

      await tx.conversation.update({
        where: { id: convo.id },
        data: {
          lastPreview: previewFor(type, body),
          // max() semantics — never move lastMessageAt backwards
          lastMessageAt: waTimestamp > convo.lastMessageAt ? waTimestamp : convo.lastMessageAt,
          // a live message proves the session is back — clear any stale archive flag
          ...(convo.sessionDeletedAt ? { sessionDeletedAt: null } : {}),
          ...(fromMe ? {} : { unreadCount: { increment: 1 } }),
        },
      });

      return convo.id;
    });

    this.events.emit({ type: 'message.new', workspaceId, conversationId });
  }

  // Delivery-status updates (sent -> delivered -> read) keyed by waMessageId.
  private async applyStatusUpdates(workspaceId: string, dto: WebhookEventDto): Promise<void> {
    const raw = dto.data as unknown;
    const updates = Array.isArray(raw) ? raw : [raw];
    for (const u of updates as Array<Record<string, any>>) {
      const waMessageId: string | undefined = u?.key?.id ?? u?.messageId;
      const statusNum = u?.update?.status ?? u?.status;
      const status = mapDeliveryStatus(statusNum);
      if (!waMessageId || !status) {
        this.logger.debug(`[Inbox] status update skipped — id=${waMessageId ?? 'n/a'} raw=${JSON.stringify(statusNum)}`);
        continue;
      }
      const res = await this.prisma.message.updateMany({
        where: { workspaceId, waMessageId },
        data: { status },
      });
      if (res.count > 0) {
        this.logger.debug(`[Inbox] status ${status} applied to ${waMessageId} (${res.count} row)`);
        this.events.emit({ type: 'message.status', workspaceId, payload: { waMessageId, status } });
      } else {
        // Status arrived but no inbox message matched — usually the message was
        // sent outside the inbox (API/tester) or the id differs.
        this.logger.warn(`[Inbox] status ${status} for ${waMessageId} matched NO inbox message (sent outside inbox, or id mismatch)`);
      }
    }
  }

  // Re-link / reconnect of a session un-archives its conversations so the
  // operator can reply again (mirror of archiveSession).
  private async restoreSession(workspaceId: string, sessionId: string): Promise<void> {
    const res = await this.prisma.conversation.updateMany({
      where: { workspaceId, sessionId, sessionDeletedAt: { not: null } },
      data: { sessionDeletedAt: null },
    });
    if (res.count > 0) {
      this.logger.log(`[Inbox] restored ${res.count} conversation(s) for reconnected session=${sessionId}`);
    }
  }

  private async archiveSession(workspaceId: string, sessionId: string): Promise<void> {
    const res = await this.prisma.conversation.updateMany({
      where: { workspaceId, sessionId, sessionDeletedAt: null },
      data: { sessionDeletedAt: new Date() },
    });
    if (res.count > 0) {
      this.logger.log(`[Inbox] archived ${res.count} conversation(s) for deleted session=${sessionId}`);
    }
  }
}

// Baileys WAMessageStatus enum: 1=PENDING 2=SERVER_ACK(sent) 3=DELIVERY_ACK(delivered) 4=READ 5=PLAYED
function mapDeliveryStatus(n: unknown): 'SENT' | 'DELIVERED' | 'READ' | undefined {
  switch (n) {
    case 2:
    case 'SERVER_ACK':
      return 'SENT';
    case 3:
    case 'DELIVERY_ACK':
      return 'DELIVERED';
    case 4:
    case 5:
    case 'READ':
    case 'PLAYED':
      return 'READ';
    default:
      return undefined;
  }
}
