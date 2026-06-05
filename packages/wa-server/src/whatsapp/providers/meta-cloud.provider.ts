import { Injectable, Logger } from '@nestjs/common';
import {
  SendResult,
  SessionInfo,
  SessionStatus,
  SessionConfig,
} from '../whatsapp-adapter.interface';
import {
  MessageProvider,
  ProviderId,
  ProviderCapabilities,
  ProviderCredentials,
  MetaCredentials,
  OutboundTextOpts,
  OutboundMedia,
  OutboundLocation,
  OutboundContact,
  Interactive,
  TemplateMessage,
} from './provider.types';
import { META_CAPABILITIES } from './capabilities';
import { CapabilityError } from './capability-error';
import { MetaApiError } from './meta-api-error';

interface MetaSession {
  creds: MetaCredentials;
  status: SessionStatus;
  info: SessionInfo;
}

const GRAPH_HOST = 'https://graph.facebook.com';
// Graph error code for "message outside the 24-hour customer-service window".
const RE_ENGAGEMENT_CODE = 131047;
// Inbound media is inlined as a data URI; cap it like the Baileys path.
const MEDIA_CAP_BYTES = 16 * 1024 * 1024;

/**
 * The Meta WhatsApp Cloud API engine as a {@link MessageProvider} (design §4).
 *
 * **Stateless** — no socket, no QR. A "Meta session" is just stored credentials;
 * "connected" means the credentials validate. Every send is a single HTTPS call
 * to the Graph API. This provider must never import Baileys (license isolation).
 *
 * Ships **dormant** in v1.2.0: the {@link ProviderRegistry} only routes here when
 * `META_PROVIDER_ENABLED=true` and a session's `provider` is `meta`.
 */
@Injectable()
export class MetaCloudProvider implements MessageProvider {
  readonly id: ProviderId = 'meta';
  readonly capabilities: ProviderCapabilities = META_CAPABILITIES;

  private readonly logger = new Logger(MetaCloudProvider.name);
  private readonly sessions = new Map<string, MetaSession>();

  private get graphVersion(): string {
    return process.env.GRAPH_VERSION || 'v22.0';
  }

  // ── lifecycle ────────────────────────────────────────────────────────────

  async init(
    sessionId: string,
    creds: ProviderCredentials,
    cfg?: Partial<SessionConfig>,
  ): Promise<SessionInfo> {
    if (creds.kind !== 'meta') {
      throw new MetaApiError('META_API_ERROR', 'MetaCloudProvider requires Meta credentials');
    }

    let status: SessionStatus = 'connecting';
    let name: string | undefined;
    let phoneNumber: string | undefined;
    let lastDisconnectReason: string | null = null;

    try {
      const verified = await this.validateCreds(creds);
      status = 'connected';
      name = verified.verified_name;
      phoneNumber = verified.display_phone_number;
    } catch (err) {
      status = 'failed';
      lastDisconnectReason = err instanceof Error ? err.message : String(err);
      this.logger.warn(`[${sessionId}] Meta credential validation failed: ${lastDisconnectReason}`);
    }

    const info: SessionInfo = {
      id: sessionId,
      status,
      retryCount: 0,
      lastDisconnectReason,
      name,
      phoneNumber,
      connectedAt: status === 'connected' ? new Date() : undefined,
      config: { ...(cfg as SessionConfig), provider: 'meta' } as SessionConfig,
    };

    this.sessions.set(sessionId, { creds, status, info });
    return info;
  }

  async destroy(sessionId: string): Promise<void> {
    this.sessions.delete(sessionId);
  }

  status(sessionId: string): SessionStatus {
    return this.sessions.get(sessionId)?.status ?? 'disconnected';
  }

  /** The stored Meta credentials for a session (used by the webhook receiver). */
  getCredentials(sessionId: string): MetaCredentials | undefined {
    return this.sessions.get(sessionId)?.creds;
  }

  /**
   * Download inbound media by Graph media id → a base64 data URI (mirrors the
   * Baileys inbound-media path so the Inbox renders it identically). Two hops:
   * `GET /{mediaId}` → a short-lived URL, then fetch the bytes. Returns null on
   * any failure or when over the size cap — media is non-critical to ingestion.
   */
  async downloadMedia(sessionId: string, mediaId: string): Promise<string | null> {
    const creds = this.sessions.get(sessionId)?.creds;
    if (!creds || !mediaId) return null;
    const auth = { Authorization: `Bearer ${creds.accessToken}` };
    try {
      const metaRes = await fetch(`${GRAPH_HOST}/${this.graphVersion}/${mediaId}`, { headers: auth });
      if (!metaRes.ok) return null;
      const meta = (await metaRes.json()) as { url?: string; mime_type?: string };
      if (!meta.url) return null;
      const binRes = await fetch(meta.url, { headers: auth });
      if (!binRes.ok) return null;
      const buf = Buffer.from(await binRes.arrayBuffer());
      if (buf.length > MEDIA_CAP_BYTES) {
        this.logger.warn(`[${sessionId}] Meta media ${mediaId} exceeds ${MEDIA_CAP_BYTES} bytes — skipped`);
        return null;
      }
      return `data:${meta.mime_type || 'application/octet-stream'};base64,${buf.toString('base64')}`;
    } catch (err) {
      this.logger.warn(`[${sessionId}] Meta media download failed: ${err instanceof Error ? err.message : err}`);
      return null;
    }
  }

  // ── outbound ───────────────────────────────────────────────────────────

  sendText(sessionId: string, to: string, text: string, _opts?: OutboundTextOpts): Promise<SendResult> {
    return this.send(sessionId, {
      type: 'text',
      to: this.toPhone(to),
      text: { body: text },
    });
  }

  sendMedia(sessionId: string, to: string, m: OutboundMedia): Promise<SendResult> {
    if (m.url.startsWith('data:')) {
      // v1.2 is link-mode only (decision #3); uploaded media (data URIs) is v1.3.
      return Promise.reject(
        new MetaApiError(
          'UNSUPPORTED_MEDIA_SOURCE',
          'Meta link mode requires a public URL; inline/base64 media (upload mode) lands in v1.3',
        ),
      );
    }
    const media: Record<string, unknown> = { link: m.url };
    if (m.caption && (m.kind === 'image' || m.kind === 'video' || m.kind === 'document')) {
      media.caption = m.caption;
    }
    if (m.kind === 'document' && m.fileName) media.filename = m.fileName;
    return this.send(sessionId, { type: m.kind, to: this.toPhone(to), [m.kind]: media });
  }

  sendLocation(sessionId: string, to: string, loc: OutboundLocation): Promise<SendResult> {
    return this.send(sessionId, {
      type: 'location',
      to: this.toPhone(to),
      location: {
        latitude: loc.latitude,
        longitude: loc.longitude,
        ...(loc.name ? { name: loc.name } : {}),
        ...(loc.address ? { address: loc.address } : {}),
      },
    });
  }

  sendContact(sessionId: string, to: string, card: OutboundContact): Promise<SendResult> {
    return this.send(sessionId, {
      type: 'contacts',
      to: this.toPhone(to),
      contacts: [
        {
          name: { formatted_name: card.displayName, first_name: card.displayName },
          phones: [{ phone: card.phoneNumber, type: 'CELL' }],
        },
      ],
    });
  }

  sendReaction(sessionId: string, to: string, messageId: string, emoji: string, _fromMe: boolean): Promise<SendResult> {
    return this.send(sessionId, {
      type: 'reaction',
      to: this.toPhone(to),
      reaction: { message_id: messageId, emoji },
    });
  }

  sendInteractive(sessionId: string, to: string, i: Interactive): Promise<SendResult> {
    const interactive =
      i.kind === 'buttons'
        ? {
            type: 'button',
            body: { text: i.text },
            ...(i.footer ? { footer: { text: i.footer } } : {}),
            action: {
              buttons: i.buttons.slice(0, 3).map((b) => ({
                type: 'reply',
                reply: { id: b.id, title: b.text },
              })),
            },
          }
        : {
            type: 'list',
            ...(i.title ? { header: { type: 'text', text: i.title } } : {}),
            body: { text: i.text },
            action: {
              button: i.buttonText,
              sections: i.sections.map((s) => ({
                title: s.title,
                rows: s.rows.map((r) => ({
                  id: r.id,
                  title: r.title,
                  ...(r.description ? { description: r.description } : {}),
                })),
              })),
            },
          };
    return this.send(sessionId, { type: 'interactive', to: this.toPhone(to), interactive });
  }

  sendTemplate(sessionId: string, to: string, t: TemplateMessage): Promise<SendResult> {
    return this.send(sessionId, {
      type: 'template',
      to: this.toPhone(to),
      template: {
        name: t.name,
        language: { code: t.languageCode },
        ...(t.components ? { components: t.components } : {}),
      },
    });
  }

  async markRead(sessionId: string, _to: string, messageIds: string[]): Promise<void> {
    const creds = this.credsFor(sessionId);
    for (const id of messageIds) {
      await this.graphPost(creds, { messaging_product: 'whatsapp', status: 'read', message_id: id });
    }
  }

  // Meta has no poll primitive — guard rail for callers that bypass capabilities.
  sendPoll(): Promise<SendResult> {
    return Promise.reject(new CapabilityError('polls', this.id));
  }

  // ── internals ────────────────────────────────────────────────────────────

  private credsFor(sessionId: string): MetaCredentials {
    const s = this.sessions.get(sessionId);
    if (!s) {
      throw new MetaApiError('META_API_ERROR', `Meta session '${sessionId}' is not initialised`);
    }
    return s.creds;
  }

  /** Strip WhatsApp JID suffixes / '+' so we send Meta a bare phone number. */
  private toPhone(to: string): string {
    return to.replace(/@.*$/, '').replace(/[^\d]/g, '');
  }

  private async validateCreds(creds: MetaCredentials): Promise<{ verified_name?: string; display_phone_number?: string }> {
    const url = `${GRAPH_HOST}/${this.graphVersion}/${creds.phoneNumberId}?fields=verified_name,display_phone_number`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${creds.accessToken}` } });
    const data = (await res.json().catch(() => ({}))) as Record<string, any>;
    if (!res.ok) throw this.mapError(res.status, data?.error);
    return data;
  }

  private async send(sessionId: string, body: Record<string, unknown>): Promise<SendResult> {
    const creds = this.credsFor(sessionId);
    return this.graphPost(creds, {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      ...body,
    });
  }

  private async graphPost(creds: MetaCredentials, body: Record<string, unknown>): Promise<SendResult> {
    const url = `${GRAPH_HOST}/${this.graphVersion}/${creds.phoneNumberId}/messages`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${creds.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    const data = (await res.json().catch(() => ({}))) as Record<string, any>;
    if (!res.ok) throw this.mapError(res.status, data?.error);
    return { messageId: data?.messages?.[0]?.id, status: 'sent' };
  }

  private mapError(httpStatus: number, error?: Record<string, any>): MetaApiError {
    const metaCode: number | undefined = error?.code;
    const metaSubcode: number | undefined = error?.error_subcode;
    const message: string = error?.message || `Meta API error (HTTP ${httpStatus})`;
    const opts = { httpStatus, metaCode, metaSubcode };

    if (metaCode === RE_ENGAGEMENT_CODE) {
      return new MetaApiError(
        'OUTSIDE_24H_WINDOW',
        'Outside the 24-hour customer-service window — send an approved template instead',
        opts,
      );
    }
    if (httpStatus === 401 || metaCode === 190) {
      return new MetaApiError('META_AUTH_FAILED', `Meta authentication failed: ${message}`, opts);
    }
    return new MetaApiError('META_API_ERROR', message, opts);
  }
}
