import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import { WebhookService } from './webhook.service';
import { MetaCloudProvider } from '../whatsapp/providers/meta-cloud.provider';

/**
 * Receives Meta WhatsApp Cloud API webhooks and translates them into the SAME
 * internal events the Baileys path fires (`message.received`, `messages.update`),
 * so the dashboard Inbox is provider-agnostic (design §7).
 *
 * Security (decision #2): the `X-Hub-Signature-256` HMAC is verified whenever an
 * app secret is configured. With no app secret, "unverified mode" is allowed in
 * development only (warning logged each time) and BLOCKED in production.
 */
@Injectable()
export class MetaWebhookService {
  private readonly logger = new Logger(MetaWebhookService.name);

  // Meta inbound message type → Baileys contentType (the Inbox's TYPE_MAP keys).
  private static readonly TYPE: Record<string, string> = {
    text: 'conversation',
    image: 'imageMessage',
    video: 'videoMessage',
    audio: 'audioMessage',
    document: 'documentMessage',
    sticker: 'stickerMessage',
    location: 'locationMessage',
    contacts: 'contactMessage',
    reaction: 'reactionMessage',
  };

  // Meta delivery status → Baileys WAMessageStatus numeric (the Inbox maps these).
  private static readonly STATUS: Record<string, number> = { sent: 2, delivered: 3, read: 4 };

  constructor(
    private readonly webhooks: WebhookService,
    private readonly meta: MetaCloudProvider,
  ) {}

  /**
   * GET verification handshake. Echoes `hub.challenge` when `hub.verify_token`
   * matches the session's stored verify token (timing-safe); otherwise 403.
   */
  verifyHandshake(sessionId: string, mode?: string, token?: string, challenge?: string): string {
    const expected = this.meta.getCredentials(sessionId)?.verifyToken;
    if (mode !== 'subscribe' || !expected || !token || !this.timingSafeEq(token, expected)) {
      throw new ForbiddenException('Meta webhook verification failed');
    }
    return challenge ?? '';
  }

  /** Verify the signature, then translate + fire internal events. */
  async ingest(
    sessionId: string,
    rawBody: Buffer | string | undefined,
    signatureHeader: string | undefined,
    body: any,
  ): Promise<void> {
    this.verifySignature(sessionId, rawBody, signatureHeader);

    const entries: any[] = Array.isArray(body?.entry) ? body.entry : [];
    for (const entry of entries) {
      const changes: any[] = Array.isArray(entry?.changes) ? entry.changes : [];
      for (const change of changes) {
        const value = change?.value ?? {};
        const contacts: any[] = Array.isArray(value.contacts) ? value.contacts : [];

        for (const msg of Array.isArray(value.messages) ? value.messages : []) {
          const payload = await this.toReceived(sessionId, msg, contacts);
          if (payload) await this.webhooks.fire('message.received', sessionId, payload);
        }

        const updates = this.toStatusUpdates(Array.isArray(value.statuses) ? value.statuses : []);
        if (updates.length) await this.webhooks.fire('messages.update', sessionId, updates);
      }
    }
  }

  // ── signature ──────────────────────────────────────────────────────────

  private verifySignature(sessionId: string, rawBody: Buffer | string | undefined, header: string | undefined): void {
    const appSecret = this.meta.getCredentials(sessionId)?.appSecret;

    if (!appSecret) {
      if (process.env.NODE_ENV === 'production') {
        this.logger.warn(
          `[meta:${sessionId}] Webhook rejected — no App Secret stored for this session. ` +
            `Re-create the session and fill in the App Secret (Meta → App Settings → Basic).`,
        );
        throw new ForbiddenException('Webhook signature verification is required in production (no app secret configured)');
      }
      this.logger.warn(`[meta:${sessionId}] UNVERIFIED webhook accepted — no app secret (development only)`);
      return;
    }
    if (!header || rawBody === undefined) {
      this.logger.warn(`[meta:${sessionId}] Webhook rejected — ${!header ? 'no X-Hub-Signature-256 header' : 'raw body unavailable'}`);
      throw new ForbiddenException('Missing webhook signature');
    }
    const expected = 'sha256=' + crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex');
    if (!this.timingSafeEq(header, expected)) {
      this.logger.warn(
        `[meta:${sessionId}] Webhook signature MISMATCH — the session's App Secret does not match this Meta app. ` +
          `Re-create the session with the exact App Secret from Meta → App Settings → Basic.`,
      );
      throw new ForbiddenException('Invalid webhook signature');
    }
  }

  private timingSafeEq(a: string, b: string): boolean {
    const ab = Buffer.from(a);
    const bb = Buffer.from(b);
    return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
  }

  // ── translation ──────────────────────────────────────────────────────────

  private async toReceived(sessionId: string, msg: any, contacts: any[]): Promise<Record<string, any> | null> {
    const from: string | undefined = msg?.from;
    const id: string | undefined = msg?.id;
    if (!from || !id) return null;

    const jid = `${from}@s.whatsapp.net`;
    const pushName: string | null =
      contacts.find((c) => c?.wa_id === from)?.profile?.name ?? null;

    const content: Record<string, any> = {};
    let type = MetaWebhookService.TYPE[msg.type] ?? 'unknown';

    switch (msg.type) {
      case 'text':
        content.text = msg.text?.body;
        break;
      case 'image':
      case 'video':
      case 'sticker':
      case 'audio':
      case 'document': {
        const media = msg[msg.type] ?? {};
        if (msg.type !== 'sticker' && msg.type !== 'audio') content.caption = media.caption;
        if (msg.type === 'document') content.fileName = media.filename;
        content.mimetype = media.mime_type;
        content.dataUri = await this.meta.downloadMedia(sessionId, media.id);
        break;
      }
      case 'location':
        content.latitude = msg.location?.latitude;
        content.longitude = msg.location?.longitude;
        content.name = msg.location?.name;
        content.address = msg.location?.address;
        break;
      case 'contacts':
        content.displayName = msg.contacts?.[0]?.name?.formatted_name;
        content.phoneNumber = msg.contacts?.[0]?.phones?.[0]?.phone;
        break;
      case 'reaction':
        content.reaction = msg.reaction?.emoji;
        content.replyMessageId = msg.reaction?.message_id;
        break;
      case 'interactive':
        // A button/list reply the customer tapped — show their selection as text.
        type = 'conversation';
        content.text = msg.interactive?.button_reply?.title ?? msg.interactive?.list_reply?.title ?? '';
        break;
      case 'button':
        type = 'conversation';
        content.text = msg.button?.text ?? '';
        break;
      default:
        break;
    }

    return {
      messageId: id,
      from: jid,
      sender: jid,
      senderJid: jid,
      senderPn: jid,
      senderLid: null,
      avatarUrl: null,
      isGroup: false,
      timestamp: Number(msg.timestamp) || Math.floor(Date.now() / 1000),
      type,
      content,
      message: { key: { fromMe: false, id, remoteJid: jid }, pushName },
    };
  }

  private toStatusUpdates(statuses: any[]): Array<{ messageId: string; status: number }> {
    return statuses
      .map((s) => ({ messageId: s?.id, status: MetaWebhookService.STATUS[s?.status] }))
      .filter((u): u is { messageId: string; status: number } => Boolean(u.messageId) && u.status !== undefined);
  }
}
