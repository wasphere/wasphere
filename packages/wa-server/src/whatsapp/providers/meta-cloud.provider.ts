import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
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
  FlowMessage,
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
export class MetaCloudProvider implements MessageProvider, OnApplicationBootstrap {
  readonly id: ProviderId = 'meta';
  readonly capabilities: ProviderCapabilities = META_CAPABILITIES;

  private readonly logger = new Logger(MetaCloudProvider.name);
  private readonly sessions = new Map<string, MetaSession>();
  // Meta creds persist as JSON under the same gitignored sessions/ dir that
  // already holds Baileys account credentials — same trust boundary.
  private readonly sessionsDir = './sessions';

  private get graphVersion(): string {
    return process.env.GRAPH_VERSION || 'v22.0';
  }

  /** Restore persisted Meta sessions on boot so they survive restarts. */
  onApplicationBootstrap(): void {
    let entries: string[] = [];
    try {
      entries = fs.existsSync(this.sessionsDir) ? fs.readdirSync(this.sessionsDir) : [];
    } catch {
      return;
    }
    for (const id of entries) {
      const file = path.join(this.sessionsDir, id, 'meta.json');
      try {
        if (!fs.existsSync(file) || fs.lstatSync(file).isSymbolicLink()) continue;
        const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as { creds: MetaCredentials; config?: SessionConfig };
        if (parsed?.creds?.kind !== 'meta') continue;
        const info: SessionInfo = {
          id,
          status: 'connected',
          retryCount: 0,
          lastDisconnectReason: null,
          config: { ...(parsed.config as SessionConfig), provider: 'meta' } as SessionConfig,
        };
        this.sessions.set(id, { creds: parsed.creds, status: 'connected', info });
        this.logger.log(`[${id}] Restored Meta session`);
        // Optimistically "connected"; confirm in the background so the session
        // shows its phone number/name and we detect a dead token after restart.
        void this.revalidateRestored(id);
      } catch (err) {
        this.logger.warn(`[${id}] Failed to restore Meta session: ${err instanceof Error ? err.message : err}`);
      }
    }
  }

  /** Re-validate a restored session's creds, filling in name/phone or flagging a dead token. */
  private async revalidateRestored(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    try {
      const v = await this.validateCreds(session.creds);
      session.info.name = v.verified_name;
      session.info.phoneNumber = v.display_phone_number;
      session.info.connectedAt = session.info.connectedAt ?? new Date();
    } catch (err) {
      // Only downgrade on a real auth failure — transient errors keep it connected.
      if (err instanceof MetaApiError && err.code === 'META_AUTH_FAILED') {
        session.status = 'failed';
        session.info.status = 'failed';
        session.info.lastDisconnectReason = err.message;
        this.logger.warn(`[${sessionId}] Restored Meta token is no longer valid: ${err.message}`);
      } else {
        this.logger.warn(`[${sessionId}] Could not re-validate restored Meta session (kept connected): ${err instanceof Error ? err.message : err}`);
      }
    }
  }

  private persist(sessionId: string, creds: MetaCredentials, config: SessionConfig): void {
    try {
      const dir = path.join(this.sessionsDir, sessionId);
      fs.mkdirSync(dir, { recursive: true });
      const tmp = path.join(dir, 'meta.json.tmp');
      fs.writeFileSync(tmp, JSON.stringify({ creds, config }), 'utf8');
      fs.renameSync(tmp, path.join(dir, 'meta.json'));
    } catch (err) {
      this.logger.warn(`[${sessionId}] Failed to persist Meta creds: ${err instanceof Error ? err.message : err}`);
    }
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
    if (status === 'connected') this.persist(sessionId, creds, info.config);
    return info;
  }

  async destroy(sessionId: string): Promise<void> {
    this.sessions.delete(sessionId);
    try {
      fs.rmSync(path.join(this.sessionsDir, sessionId, 'meta.json'), { force: true });
    } catch {
      /* best-effort */
    }
  }

  status(sessionId: string): SessionStatus {
    return this.sessions.get(sessionId)?.status ?? 'disconnected';
  }

  has(sessionId: string): boolean {
    return this.sessions.has(sessionId);
  }

  /** All Meta sessions (for the unified session list). */
  getAllSessions(): SessionInfo[] {
    return Array.from(this.sessions.values()).map((s) => s.info);
  }

  /** Info for a single Meta session, or undefined if not a Meta session. */
  getSessionInfo(sessionId: string): SessionInfo | undefined {
    return this.sessions.get(sessionId)?.info;
  }

  /** The stored Meta credentials for a session (used by the webhook receiver). */
  getCredentials(sessionId: string): MetaCredentials | undefined {
    return this.sessions.get(sessionId)?.creds;
  }

  /**
   * Validate credentials without creating a session (the setup wizard's
   * "Test connection"). Never throws — returns a typed result.
   */
  async testConnection(
    creds: MetaCredentials,
  ): Promise<{ ok: boolean; verifiedName?: string; phoneNumber?: string; error?: string }> {
    try {
      const v = await this.validateCreds(creds);
      return { ok: true, verifiedName: v.verified_name, phoneNumber: v.display_phone_number };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Connection failed' };
    }
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

  async sendMedia(sessionId: string, to: string, m: OutboundMedia): Promise<SendResult> {
    const media: Record<string, unknown> = {};
    if (m.url.startsWith('data:')) {
      // Upload mode: push the base64 bytes to Meta and reference the media id.
      media.id = await this.uploadMedia(sessionId, m.url, m.fileName);
    } else {
      // Link mode: Meta fetches the public URL itself.
      media.link = m.url;
    }
    if (m.caption && (m.kind === 'image' || m.kind === 'video' || m.kind === 'document')) {
      media.caption = m.caption;
    }
    if (m.kind === 'document' && m.fileName) media.filename = m.fileName;
    return this.send(sessionId, { type: m.kind, to: this.toPhone(to), [m.kind]: media });
  }

  /**
   * Upload a base64 data URI to the Cloud API and return its media id
   * (POST /{phone-number-id}/media, multipart). Used so the dashboard can send
   * uploaded media (not just public URLs) on Meta sessions.
   */
  private async uploadMedia(sessionId: string, dataUri: string, fileName?: string): Promise<string> {
    const creds = this.credsFor(sessionId);
    const match = /^data:([^;]+);base64,(.*)$/s.exec(dataUri);
    if (!match) {
      throw new MetaApiError('UNSUPPORTED_MEDIA_SOURCE', 'Invalid media data URI');
    }
    const mime = match[1];
    const buffer = Buffer.from(match[2], 'base64');
    const form = new FormData();
    form.append('messaging_product', 'whatsapp');
    form.append('type', mime);
    form.append('file', new Blob([buffer], { type: mime }), fileName || 'file');

    const url = `${GRAPH_HOST}/${this.graphVersion}/${creds.phoneNumberId}/media`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${creds.accessToken}` },
      body: form,
    });
    const data = (await res.json().catch(() => ({}))) as Record<string, any>;
    if (!res.ok) throw this.mapError(res.status, data?.error);
    if (!data?.id) throw new MetaApiError('META_API_ERROR', 'Media upload returned no id');
    return data.id as string;
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

  /** Send a published WhatsApp Flow as an interactive message. */
  sendFlow(sessionId: string, to: string, f: FlowMessage): Promise<SendResult> {
    const mode = f.mode ?? (f.screen ? 'navigate' : 'data_exchange');
    return this.send(sessionId, {
      type: 'interactive',
      to: this.toPhone(to),
      interactive: {
        type: 'flow',
        ...(f.header ? { header: { type: 'text', text: f.header } } : {}),
        body: { text: f.body },
        ...(f.footer ? { footer: { text: f.footer } } : {}),
        action: {
          name: 'flow',
          parameters: {
            flow_message_version: '3',
            flow_token: f.flowToken ?? randomUUID(),
            flow_id: f.flowId,
            flow_cta: f.cta,
            flow_action: mode,
            ...(mode === 'navigate'
              ? { flow_action_payload: { screen: f.screen } }
              : {}),
          },
        },
      },
    });
  }

  /**
   * List the WABA's published Flows (id, name, status, categories) so the
   * dashboard can offer a picker. Flows are designed/published in Meta's Flow
   * Builder; here we only list + send them.
   */
  async listFlows(sessionId: string): Promise<Array<{
    id: string;
    name: string;
    status: string;
    categories: string[];
  }>> {
    const creds = this.credsFor(sessionId);
    if (!creds.wabaId) {
      throw new MetaApiError('META_API_ERROR', 'No WhatsApp Business Account ID stored for this session');
    }
    const url = `${GRAPH_HOST}/${this.graphVersion}/${creds.wabaId}/flows?fields=id,name,status,categories&limit=200`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${creds.accessToken}` } });
    const data = (await res.json().catch(() => ({}))) as Record<string, any>;
    if (!res.ok) throw this.mapError(res.status, data?.error);
    const list = Array.isArray(data?.data) ? data.data : [];
    return list.map((fl: any) => ({
      id: fl.id,
      name: fl.name,
      status: fl.status,
      categories: Array.isArray(fl.categories) ? fl.categories : [],
    }));
  }

  /**
   * List the WABA's approved message templates (name, language, status, body +
   * how many {{n}} variables the body has) so the dashboard can offer a picker.
   */
  async listTemplates(sessionId: string): Promise<Array<{
    name: string;
    language: string;
    status: string;
    category: string;
    bodyText: string;
    variables: number;
  }>> {
    const creds = this.credsFor(sessionId);
    if (!creds.wabaId) {
      throw new MetaApiError('META_API_ERROR', 'No WhatsApp Business Account ID stored for this session');
    }
    const url = `${GRAPH_HOST}/${this.graphVersion}/${creds.wabaId}/message_templates?fields=name,language,status,category,components&limit=200`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${creds.accessToken}` } });
    const data = (await res.json().catch(() => ({}))) as Record<string, any>;
    if (!res.ok) throw this.mapError(res.status, data?.error);
    const list = Array.isArray(data?.data) ? data.data : [];
    return list.map((t: any) => {
      const body = (t.components ?? []).find((c: any) => c.type === 'BODY');
      const bodyText: string = body?.text ?? '';
      const variables = (bodyText.match(/\{\{\s*\d+\s*\}\}/g) ?? []).length;
      return {
        name: t.name,
        language: t.language,
        status: t.status,
        category: t.category ?? '',
        bodyText,
        variables,
      };
    });
  }

  /**
   * Create a message template on the WABA. Meta returns it as PENDING and runs
   * its own review (approval is async). Requires a token with the
   * `whatsapp_business_management` scope.
   */
  async createTemplate(
    sessionId: string,
    input: {
      name: string;
      category: 'UTILITY' | 'MARKETING' | 'AUTHENTICATION';
      language: string;
      headerText?: string;
      body: string;
      bodyExamples?: string[];
      footer?: string;
    },
  ): Promise<{ id: string; status: string; category: string }> {
    const creds = this.credsFor(sessionId);
    if (!creds.wabaId) {
      throw new MetaApiError('META_API_ERROR', 'No WhatsApp Business Account ID stored for this session');
    }

    const components: Record<string, unknown>[] = [];
    if (input.headerText?.trim()) {
      components.push({ type: 'HEADER', format: 'TEXT', text: input.headerText.trim() });
    }
    const bodyComponent: Record<string, unknown> = { type: 'BODY', text: input.body };
    const examples = (input.bodyExamples ?? []).map((e) => e.trim()).filter(Boolean);
    if (examples.length > 0) {
      // Meta requires an example per {{n}} variable, nested one level deep.
      bodyComponent.example = { body_text: [examples] };
    }
    components.push(bodyComponent);
    if (input.footer?.trim()) {
      components.push({ type: 'FOOTER', text: input.footer.trim() });
    }

    const url = `${GRAPH_HOST}/${this.graphVersion}/${creds.wabaId}/message_templates`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${creds.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: input.name,
        category: input.category,
        language: input.language,
        components,
      }),
    });
    const data = (await res.json().catch(() => ({}))) as Record<string, any>;
    if (!res.ok) throw this.mapError(res.status, data?.error);
    return {
      id: data?.id ?? '',
      status: data?.status ?? 'PENDING',
      category: data?.category ?? input.category,
    };
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
