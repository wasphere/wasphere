import * as https from 'https';
import * as net from 'net';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { SocksProxyAgent } from 'socks-proxy-agent';
import { BadRequestException, HttpException, HttpStatus, Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  WASocket,
  BaileysEventMap,
  proto,
  getContentType,
  decryptPollVote,
  getAggregateVotesInPollMessage,
  getKeyAuthor,
  jidNormalizedUser,
  downloadMediaMessage,
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import * as fs from 'fs';
import * as path from 'path';
import * as QRCode from 'qrcode';
import { WebhookService } from '../webhooks/webhook.service';
import { sanitizeMessage, sanitizeMessageUpdate, sanitizeReceipt } from '../webhooks/sanitize-message';
import { safeFetch } from '../common/safe-fetch';
import {
  IWhatsAppAdapter,
  SessionInfo,
  SendResult,
  GroupInfo,
  ContactCheckResult,
  ProfileInfo,
  GroupSetting,
  PresenceType,
} from './whatsapp-adapter.interface';
import { SessionConfig, SESSION_CONFIG_DEFAULTS } from './session-config.interface';

// Allowlist for Baileys disconnect reason strings surfaced in API responses / webhooks.
// Prevents raw Boom payload text (which may contain internal state) reaching clients.
const SAFE_DISCONNECT_REASONS: Record<string, string> = {
  '401': 'Unauthorized',
  '405': 'Method Not Allowed',
  '408': 'Connection Timeout',
  '410': 'Gone',
  '428': 'Precondition Required',
  '440': 'Login Timeout',
  '500': 'Internal Server Error',
  '503': 'Service Unavailable',
  'loggedOut': 'Logged out',
  'badSession': 'Bad session',
  'Unauthorized': 'Unauthorized',
  'unknown': 'Unknown',
};

function sanitiseReason(raw: string): string {
  return SAFE_DISCONNECT_REASONS[raw] ?? 'Disconnected';
}

// Fallback WA protocol version used when fetchLatestBaileysVersion() fails.
// Source: @whiskeysockets/baileys src/Defaults/baileys-version.json as of 2026-05-20
//   (Baileys 6.7.21, last verified against WhiskeySockets/Baileys commit history)
// Refresh this constant whenever Baileys is upgraded or when connection failures
// suggest WhatsApp has rotated its minimum accepted version.
const WA_VERSION_FALLBACK: [number, number, number] = [2, 3000, 1015901307];

async function resolveMediaBuffer(url: string, maxBytes: number): Promise<Buffer> {
  if (url.startsWith('data:')) {
    const commaIdx = url.indexOf(',');
    if (commaIdx === -1 || !url.slice(0, commaIdx).endsWith(';base64')) {
      throw new Error('Invalid data URI: must be base64-encoded');
    }
    const buf = Buffer.from(url.slice(commaIdx + 1), 'base64');
    if (buf.length > maxBytes) {
      throw new Error(`Data URI exceeds maximum size of ${Math.round(maxBytes / (1024 * 1024))} MiB`);
    }
    return buf;
  }
  return safeFetch(url, { maxBytes }).then((r) => r.buffer());
}

@Injectable()
export class BaileysAdapter implements IWhatsAppAdapter, OnModuleInit {
  private sessions = new Map<string, WASocket>();
  private sessionInfo = new Map<string, SessionInfo>();
  private readonly sessionConfigs = new Map<string, SessionConfig>();
  private readonly sessionsDir = './sessions';
  private readonly MAX_RETRIES = 5;
  private readonly RETRY_DELAY_MS = 5000;

  // Per session: Map<messageId, proto.IWebMessageInfo>
  // Eviction: when size reaches 100, delete the oldest inserted key before inserting the new one.
  private readonly messageCache = new Map<string, Map<string, proto.IWebMessageInfo>>();
  private readonly MESSAGE_CACHE_LIMIT = 100;
  private readonly qrMeta = new Map<string, { generatedAt: Date }>();
  // Profile-picture URL cache keyed by `${sessionId}:${jid}`. WhatsApp pic URLs
  // are temporary, so entries are refreshed after AVATAR_TTL_MS. A null url is
  // cached too (contact has no pic / pic is private) to avoid re-fetching.
  private readonly avatarCache = new Map<string, { url: string | null; at: number }>();
  private readonly AVATAR_TTL_MS = 6 * 60 * 60 * 1000; // 6h

  constructor(private webhookService: WebhookService) {
    // Ensure sessions directory exists
    if (!fs.existsSync(this.sessionsDir)) {
      fs.mkdirSync(this.sessionsDir, { recursive: true });
    }
  }

  async onModuleInit(): Promise<void> {
    await this.restoreAllSessions();
  }

  // ─── Private helpers ────────────────────────────────────────────────────

  private resolveSessionPath(sessionId: string): string {
    const resolvedDir = path.resolve(this.sessionsDir);
    const candidate = path.resolve(this.sessionsDir, sessionId);
    if (!candidate.startsWith(resolvedDir + path.sep)) {
      throw new BadRequestException({ error: 'INVALID_SESSION_ID' });
    }
    return candidate;
  }

  private audioMimetype(url: string, isVoiceNote: boolean): string {
    if (isVoiceNote) return 'audio/ogg; codecs=opus';
    if (url.startsWith('data:')) {
      const mime = url.slice(5, url.indexOf(';'));
      return mime || 'audio/mpeg';
    }
    const ext = url.split('?')[0].split('.').pop()?.toLowerCase() ?? '';
    const map: Record<string, string> = {
      mp3: 'audio/mpeg',
      mp4: 'audio/mp4',
      m4a: 'audio/mp4',
      aac: 'audio/aac',
      wav: 'audio/wav',
      flac: 'audio/flac',
      ogg: 'audio/ogg',
      opus: 'audio/ogg; codecs=opus',
    };
    return map[ext] ?? 'audio/mpeg';
  }

  private toJid(number: string): string {
    if (number.includes('@')) return number;
    const clean = number.replace(/[^0-9]/g, '');
    return `${clean}@s.whatsapp.net`;
  }

  private toGroupJid(id: string): string {
    if (id.includes('@g.us')) return id;
    return `${id}@g.us`;
  }

  private cacheMessage(sessionId: string, msg: proto.IWebMessageInfo) {
    if (!msg.key?.id) return;
    if (!this.messageCache.has(sessionId)) {
      this.messageCache.set(sessionId, new Map());
    }
    const cache = this.messageCache.get(sessionId)!;
    if (cache.size >= this.MESSAGE_CACHE_LIMIT) {
      // Delete oldest entry (Map preserves insertion order)
      cache.delete(cache.keys().next().value as string);
    }
    cache.set(msg.key.id, msg);
  }

  private getSocket(sessionId: string): WASocket {
    const sock = this.sessions.get(sessionId);
    if (!sock) throw new NotFoundException(`Session ${sessionId} not found or not connected`);
    return sock;
  }

  private async applyRandomDelay(sessionId: string): Promise<void> {
    const config = this.sessionConfigs.get(sessionId) ?? SESSION_CONFIG_DEFAULTS;
    const { random_delay_min_ms: min, random_delay_max_ms: max } = config;
    if (min === 0 && max === 0) return;
    const delay = min + Math.floor(Math.random() * (max - min + 1));
    await new Promise(r => setTimeout(r, delay));
  }

  // ─── Proxy helpers ─────────────────────────────────────────────────────

  // TCP-only preflight: proves the proxy host is reachable before a session
  // slot is consumed. Does not perform the SOCKS5 / HTTP CONNECT handshake —
  // that happens inside Baileys. Intentional trade-off documented in design doc.
  private preflightProxy(proxyUrl: string): Promise<void> {
    const { hostname, port, protocol } = new URL(proxyUrl);
    const portNum = parseInt(port || (protocol === 'https:' ? '443' : '80'), 10);
    return new Promise((resolve, reject) => {
      const sock = net.createConnection({ host: hostname, port: portNum });
      const timer = setTimeout(() => { sock.destroy(); reject(new Error('timeout')); }, 5000);
      sock.on('connect', () => { clearTimeout(timer); sock.destroy(); resolve(); });
      sock.on('error', (err) => { clearTimeout(timer); reject(err); });
    });
  }

  // NOTE: No SSRF check is applied here. WaSphere is self-hosted — the operator
  // who supplies the proxy URL IS the server owner and controls the network.
  // This is the same trust boundary as MAX_SESSIONS and X-Api-Token.
  // If a multi-tenant hosted mode is ever added, revisit this decision.
  private buildProxyAgent(proxyUrl: string): https.Agent {
    const { protocol } = new URL(proxyUrl);
    if (protocol === 'socks5:') return new SocksProxyAgent(proxyUrl) as unknown as https.Agent;
    return new HttpsProxyAgent(proxyUrl) as unknown as https.Agent;
  }

  // ─── Session lifecycle ──────────────────────────────────────────────────

  async createSession(sessionId: string, proxy?: string, config?: Partial<SessionConfig>): Promise<SessionInfo> {
    // Idempotency first — existing session short-circuits before any network I/O.
    if (this.sessionInfo.has(sessionId)) {
      return this.getSessionInfo(sessionId);
    }

    // Preflight TCP check before consuming a session slot or writing any state.
    // On failure: 422 — slot not consumed, proxy.json not written.
    if (proxy) {
      try {
        await this.preflightProxy(proxy);
      } catch (err: any) {
        console.warn(`[${sessionId}] Proxy preflight failed: ${err.message}`);
        throw new HttpException(
          { message: 'Proxy unreachable or timed out', code: 'PROXY_PREFLIGHT_FAILED' },
          HttpStatus.UNPROCESSABLE_ENTITY,
        );
      }
    }

    const maxSessions = parseInt(process.env.MAX_SESSIONS ?? '10', 10);
    if (this.sessionInfo.size >= maxSessions) {
      throw new HttpException({ message: 'Maximum session limit reached' }, HttpStatus.TOO_MANY_REQUESTS);
    }

    const initialConfig: SessionConfig = { ...SESSION_CONFIG_DEFAULTS, ...config };

    this.sessionInfo.set(sessionId, {
      id: sessionId,
      status: 'connecting',
      retryCount: 0,
      lastDisconnectReason: null,
      proxy,
      config: initialConfig,
    });

    await this.initSocket(sessionId, proxy, config);
    return this.getSessionInfo(sessionId);
  }

  getSessionInfo(sessionId: string): SessionInfo {
    const info = this.sessionInfo.get(sessionId);
    if (!info) throw new NotFoundException(`Session ${sessionId} not found`);

    // Ensure config is always present (falls back to in-memory map or defaults)
    const config = this.sessionConfigs.get(sessionId) ?? SESSION_CONFIG_DEFAULTS;
    const infoWithConfig: SessionInfo = { ...info, config };

    if (infoWithConfig.status === 'qr_ready' && infoWithConfig.qrExpiresAt && new Date() > infoWithConfig.qrExpiresAt) {
      const expired: SessionInfo = { ...infoWithConfig, status: 'qr_expired', qrCode: undefined };
      this.sessionInfo.set(sessionId, expired);
      return expired;
    }

    return infoWithConfig;
  }

  getAllSessions(): SessionInfo[] {
    return Array.from(this.sessionInfo.values());
  }

  async deleteSession(sessionId: string): Promise<void> {
    if (!this.sessionInfo.has(sessionId)) {
      throw new NotFoundException(`Session ${sessionId} not found`);
    }

    const sock = this.sessions.get(sessionId);
    const info = this.sessionInfo.get(sessionId)!;

    if (sock) {
      if (info.status === 'connected') {
        await Promise.race([
          sock.logout().catch(() => {}),
          new Promise(r => setTimeout(r, 5000)),
        ]);
      }
      sock.end(undefined);
      this.sessions.delete(sessionId);
    }

    this.sessionInfo.delete(sessionId);
    this.messageCache.delete(sessionId);
    this.qrMeta.delete(sessionId);

    // Delete stored auth files
    const sessionPath = this.resolveSessionPath(sessionId);
    if (fs.existsSync(sessionPath)) {
      fs.rmSync(sessionPath, { recursive: true });
    }

    await this.webhookService.fire('session.deleted', sessionId, { sessionId });
  }

  async logoutSession(sessionId: string): Promise<void> {
    const sock = this.sessions.get(sessionId);
    if (sock) {
      await sock.logout();
    }
  }

  getSessionPath(sessionId: string): string {
    return this.resolveSessionPath(sessionId);
  }

  // ─── Core socket init ──────────────────────────────────────────────────

  private async initSocket(sessionId: string, proxy?: string, configFields?: Partial<SessionConfig>): Promise<void> {
    const sessionPath = this.resolveSessionPath(sessionId);
    if (!fs.existsSync(sessionPath)) {
      fs.mkdirSync(sessionPath, { recursive: true });
    }

    // Persist proxy URL alongside session credentials so it survives restarts.
    if (proxy) {
      const proxyFile = path.join(sessionPath, 'proxy.json');
      fs.writeFileSync(proxyFile, JSON.stringify({ proxy }), 'utf8');
    }

    // Persist config if any config fields were supplied at creation time.
    if (configFields && Object.keys(configFields).length > 0) {
      const mergedConfig: SessionConfig = { ...SESSION_CONFIG_DEFAULTS, ...configFields };
      const configFile = path.join(sessionPath, 'config.json');
      const tmpFile = configFile + '.tmp';
      fs.writeFileSync(tmpFile, JSON.stringify(mergedConfig), 'utf8');
      fs.renameSync(tmpFile, configFile);
      this.sessionConfigs.set(sessionId, mergedConfig);
    } else {
      // Apply defaults if not already set (e.g. on reconnect)
      if (!this.sessionConfigs.has(sessionId)) {
        this.sessionConfigs.set(sessionId, { ...SESSION_CONFIG_DEFAULTS });
      }
    }

    const { state, saveCreds } = await useMultiFileAuthState(sessionPath);

    let version: [number, number, number];
    try {
      const fetched = await fetchLatestBaileysVersion();
      version = fetched.version;
    } catch {
      version = WA_VERSION_FALLBACK;
      console.warn(`[${sessionId}] fetchLatestBaileysVersion failed (likely proxy-only network), using WA_VERSION_FALLBACK`);
    }

    const socketOptions: Parameters<typeof makeWASocket>[0] = {
      version,
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, console as any),
      },
      printQRInTerminal: true,
      browser: ['WaSphere', 'Chrome', '120.0.0'],
      markOnlineOnConnect: false,
      cachedGroupMetadata: async () => undefined,
      retryRequestDelayMs: 2000,
      // Required for Signal Protocol retries (e.g. poll vote decryption from @lid devices)
      getMessage: async (key) => {
        const cache = this.messageCache.get(sessionId);
        return cache?.get(key.id ?? '')?.message ?? undefined;
      },
    };

    if (proxy) {
      socketOptions.agent = this.buildProxyAgent(proxy);
    }

    const sock = makeWASocket(socketOptions);

    this.sessions.set(sessionId, sock);

    // ─── Event Listeners ────────────────────────────────────────────

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
      await this.handleConnectionUpdate(sessionId, update);
    });

    sock.ev.on('messages.upsert', async (m) => {
      // Cache all messages (including own) so getMessage() works during Signal retries
      for (const msg of m.messages) {
        this.cacheMessage(sessionId, msg);
      }
      await this.handleIncomingMessages(sessionId, m);
    });

    sock.ev.on('messages.update', async (updates) => {
      await this.webhookService.fire('messages.update', sessionId, updates.map(sanitizeMessageUpdate));
    });

    sock.ev.on('message-receipt.update', async (updates) => {
      await this.webhookService.fire('message.receipt', sessionId, updates.map(sanitizeReceipt));
    });

    sock.ev.on('presence.update', async (update) => {
      await this.webhookService.fire('presence.update', sessionId, update);
    });

    sock.ev.on('groups.update', async (updates) => {
      await this.webhookService.fire('groups.update', sessionId, updates);
    });

    sock.ev.on('group-participants.update', async (update) => {
      await this.webhookService.fire('group.participants.update', sessionId, update);
    });

    sock.ev.on('contacts.update', async (updates) => {
      await this.webhookService.fire('contacts.update', sessionId, updates);
    });

    sock.ev.on('call', async (calls) => {
      await this.webhookService.fire('call', sessionId, calls);
    });
  }

  // ─── Connection state handler ──────────────────────────────────────────

  private async handleConnectionUpdate(
    sessionId: string,
    update: Partial<BaileysEventMap['connection.update']>,
  ) {
    const { connection, lastDisconnect, qr } = update;
    const info = this.sessionInfo.get(sessionId);
    if (!info) return;

    // New QR code generated
    if (qr) {
      const qrBase64 = await QRCode.toDataURL(qr);
      const generatedAt = new Date();
      this.qrMeta.set(sessionId, { generatedAt });
      this.sessionInfo.set(sessionId, {
        ...info,
        status: 'qr_ready',
        qrCode: qrBase64,
        qrExpiresAt: new Date(generatedAt.getTime() + 60_000),
      });

      await this.webhookService.fire('session.qr', sessionId, {
        qrCode: qrBase64,
        qrString: qr,
      });

      console.log(`[${sessionId}] QR code ready — scan with WhatsApp`);
    }

    // Successfully connected
    if (connection === 'open') {
      const sock = this.sessions.get(sessionId);
      const user = sock?.user;

      this.qrMeta.delete(sessionId);
      this.sessionInfo.set(sessionId, {
        ...info,
        status: 'connected',
        qrCode: undefined,
        qrExpiresAt: undefined,
        phoneNumber: user?.id?.split(':')[0],
        name: user?.name,
        connectedAt: new Date(),
        retryCount: 0,
        lastDisconnectReason: null,
      });

      await this.webhookService.fire('session.connected', sessionId, {
        phoneNumber: user?.id?.split(':')[0],
        name: user?.name,
      });

      console.log(`[${sessionId}] Connected — ${user?.name} (${user?.id})`);
    }

    // Disconnected
    if (connection === 'close') {
      const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
      const rawReason: string =
        (lastDisconnect?.error as any)?.output?.payload?.error ?? String(statusCode ?? 'unknown');
      const safeReason = sanitiseReason(rawReason);
      const isLoggedOut = statusCode === DisconnectReason.loggedOut;

      console.log(`[${sessionId}] Disconnected — code: ${statusCode}, reason: ${rawReason}`);

      if (isLoggedOut) {
        // User explicitly logged out — don't reconnect, clean up
        this.sessionInfo.set(sessionId, { ...info, status: 'logged_out', lastDisconnectReason: safeReason });
        await this.webhookService.fire('session.logged_out', sessionId, {});
        this.sessions.delete(sessionId);
        return;
      }

      const newRetryCount = (info.retryCount ?? 0) + 1;
      const isAuthFailure = statusCode === 401 || statusCode === 405
        || rawReason === 'loggedOut' || rawReason === 'badSession';
      const maxAttempts = parseInt(process.env.MAX_RECONNECT_ATTEMPTS ?? '5', 10);

      if (isAuthFailure || newRetryCount >= maxAttempts) {
        this.sessionInfo.set(sessionId, {
          ...info,
          status: 'failed',
          lastDisconnectReason: safeReason,
          retryCount: newRetryCount,
        });
        await this.webhookService.fire('session.failed', sessionId, {
          sessionId,
          reason: safeReason,
          retryCount: newRetryCount,
        });
        console.error(`[${sessionId}] Session failed — reason: ${rawReason}, retryCount: ${newRetryCount}`);
        return;
      }

      // Network issue, WA update, etc. — reconnect with backoff
      this.sessionInfo.set(sessionId, {
        ...info,
        status: 'disconnected',
        lastDisconnectReason: safeReason,
        retryCount: newRetryCount,
      });
      await this.webhookService.fire('session.disconnected', sessionId, {
        reason: safeReason,
      });

      const delay = this.RETRY_DELAY_MS * Math.pow(2, info.retryCount); // exponential backoff
      console.log(
        `[${sessionId}] Reconnecting in ${delay}ms (attempt ${newRetryCount}/${maxAttempts})`,
      );

      setTimeout(() => {
        this.sessions.delete(sessionId);
        this.initSocket(sessionId, info.proxy);
      }, delay);
    }
  }

  // ─── Incoming messages handler ──────────────────────────────────────────

  private async handleIncomingMessages(
    sessionId: string,
    { messages, type }: BaileysEventMap['messages.upsert'],
  ) {
    if (type !== 'notify') return; // ignore history sync

    for (const msg of messages) {
      if (msg.key.fromMe) continue; // ignore own messages

      // Cache message for quoted reply support
      this.cacheMessage(sessionId, msg);

      const config = this.sessionConfigs.get(sessionId) ?? SESSION_CONFIG_DEFAULTS;

      if (!config.receive_enabled) continue; // early exit — webhook not fired

      if (config.auto_read_on_receive) {
        const sock = this.sessions.get(sessionId);
        if (sock) {
          await sock.readMessages([msg.key]).catch(() => {});
        }
      }

      // Poll votes arrive as an encrypted pollUpdateMessage — decrypt + emit
      // a dedicated event, then skip the generic content path.
      if (msg.message?.pollUpdateMessage) {
        await this.handlePollVote(sessionId, msg);
        continue;
      }

      const contentType = getContentType(msg.message || {});
      // Skip non-renderable wrapper/protocol messages (e.g. album child wrappers,
      // sender-key distribution) — they leak in when sending media and otherwise
      // show up as an empty "associatedChildMessage" bubble.
      if (
        contentType === 'associatedChildMessage' ||
        contentType === 'senderKeyDistributionMessage' ||
        contentType === 'protocolMessage' ||
        contentType === 'messageContextInfo'
      ) {
        continue;
      }
      const isGroup = msg.key.remoteJid?.endsWith('@g.us');

      // LID addressing: remoteJid may be an opaque "<id>@lid". The real phone
      // number (PN) is on key.senderPn. Forward both so the dashboard resolves
      // the true number for display + as the reply target.
      const lidKey = msg.key as typeof msg.key & {
        senderPn?: string | null;
        senderLid?: string | null;
      };
      const senderPn = lidKey.senderPn ?? null;

      const senderJid = senderPn ?? msg.key.remoteJid ?? '';
      const avatarUrl = await this.getAvatarUrl(sessionId, senderJid);

      const basePayload = {
        messageId: msg.key.id,
        from: msg.key.remoteJid,
        sender: msg.key.participant || msg.key.remoteJid,
        // canonical phone-number JID (falls back to remoteJid when not @lid)
        senderJid,
        senderPn,
        senderLid: lidKey.senderLid ?? (msg.key.remoteJid?.endsWith('@lid') ? msg.key.remoteJid : null),
        avatarUrl,
        isGroup,
        timestamp: msg.messageTimestamp,
        type: contentType,
      };

      // Extract message content by type
      let content: any = {};

      if (contentType === 'conversation' || contentType === 'extendedTextMessage') {
        content.text = msg.message?.conversation || msg.message?.extendedTextMessage?.text;
      } else if (contentType === 'imageMessage') {
        content.caption = msg.message?.imageMessage?.caption;
        content.mimetype = msg.message?.imageMessage?.mimetype;
        content.mediaKey = msg.message?.imageMessage?.mediaKey;
      } else if (contentType === 'videoMessage') {
        content.caption = msg.message?.videoMessage?.caption;
        content.mimetype = msg.message?.videoMessage?.mimetype;
      } else if (contentType === 'audioMessage') {
        content.isVoiceNote = msg.message?.audioMessage?.ptt;
        content.mimetype = msg.message?.audioMessage?.mimetype;
        content.seconds = msg.message?.audioMessage?.seconds;
      } else if (contentType === 'documentMessage') {
        content.fileName = msg.message?.documentMessage?.fileName;
        content.mimetype = msg.message?.documentMessage?.mimetype;
        content.pageCount = msg.message?.documentMessage?.pageCount;
      } else if (contentType === 'locationMessage') {
        content.latitude = msg.message?.locationMessage?.degreesLatitude;
        content.longitude = msg.message?.locationMessage?.degreesLongitude;
        content.name = msg.message?.locationMessage?.name;
        content.address = msg.message?.locationMessage?.address;
      } else if (contentType === 'contactMessage') {
        content.displayName = msg.message?.contactMessage?.displayName;
        content.vcard = msg.message?.contactMessage?.vcard;
      } else if (contentType === 'stickerMessage') {
        content.isAnimated = msg.message?.stickerMessage?.isAnimated;
      } else if (contentType === 'pollCreationMessage') {
        content.name = msg.message?.pollCreationMessage?.name;
        content.options = msg.message?.pollCreationMessage?.options?.map((o) => o.optionName);
      } else if (contentType === 'reactionMessage') {
        content.reaction = msg.message?.reactionMessage?.text;
        content.replyMessageId = msg.message?.reactionMessage?.key?.id;
      }

      // Download media (image/sticker/video/voice/audio/document) inline so the
      // inbox can show or play it.
      if (
        contentType === 'imageMessage' ||
        contentType === 'stickerMessage' ||
        contentType === 'videoMessage' ||
        contentType === 'audioMessage' ||
        contentType === 'documentMessage'
      ) {
        const dataUri = await this.downloadInboundMedia(sessionId, msg, contentType);
        if (dataUri) content.dataUri = dataUri;
      }

      // Check if it's a reply/quoted message
      const quotedMsg = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
      if (quotedMsg) {
        content.quotedMessageId = msg.message?.extendedTextMessage?.contextInfo?.stanzaId;
      }

      await this.webhookService.fire('message.received', sessionId, {
        ...basePayload,
        content,
        message: sanitizeMessage(msg),
      });
    }
  }

  /**
   * Best-effort WhatsApp profile-picture URL for a contact, cached per session
   * with a TTL. Returns null when the contact has no picture or it is private.
   * Never throws — avatars are non-critical and must not block ingestion.
   */
  private async getAvatarUrl(sessionId: string, jid: string): Promise<string | null> {
    if (!jid) return null;
    const cacheKey = `${sessionId}:${jid}`;
    const hit = this.avatarCache.get(cacheKey);
    if (hit && Date.now() - hit.at < this.AVATAR_TTL_MS) return hit.url;

    const sock = this.sessions.get(sessionId);
    if (!sock) return hit?.url ?? null;

    let url: string | null = null;
    try {
      url = (await sock.profilePictureUrl(jid, 'image')) ?? null;
    } catch {
      url = null; // 404 (no pic) / 401 (private) / rate-limited
    }
    this.avatarCache.set(cacheKey, { url, at: Date.now() });
    return url;
  }

  /**
   * Downloads inbound visual media (image/sticker) and returns it as a base64
   * data URI (≤5 MB) for inline display. Best-effort: never throws.
   */
  private async downloadInboundMedia(
    sessionId: string,
    msg: proto.IWebMessageInfo,
    type: string,
  ): Promise<string | null> {
    const CAP = 16 * 1024 * 1024; // 16 MB inline cap (data URI); larger -> skip
    try {
      const sock = this.sessions.get(sessionId);
      if (!sock) return null;
      const m = msg.message;
      const media =
        type === 'imageMessage' ? m?.imageMessage
        : type === 'stickerMessage' ? m?.stickerMessage
        : type === 'videoMessage' ? m?.videoMessage
        : type === 'audioMessage' ? m?.audioMessage
        : type === 'documentMessage' ? m?.documentMessage
        : null;
      if (!media) return null;
      const declared = Number((media as { fileLength?: number | Long }).fileLength ?? 0);
      if (declared && declared > CAP) return null; // skip large files

      const buffer = (await downloadMediaMessage(
        msg,
        'buffer',
        {},
        { logger: console as never, reuploadRequest: sock.updateMediaMessage },
      )) as Buffer;
      if (!buffer || buffer.length > CAP) return null;

      const fallback =
        type === 'stickerMessage' ? 'image/webp'
        : type === 'videoMessage' ? 'video/mp4'
        : type === 'audioMessage' ? 'audio/ogg'
        : type === 'documentMessage' ? 'application/octet-stream'
        : 'image/jpeg';
      const mime = (media as { mimetype?: string }).mimetype || fallback;
      return `data:${mime};base64,${buffer.toString('base64')}`;
    } catch (err) {
      console.warn(`[Media] download failed session=${sessionId} type=${type}: ${String(err)}`);
      return null;
    }
  }

  /**
   * Decrypts an inbound poll vote against the cached original poll message and
   * emits a `message.received` event of type `poll_vote` carrying the resolved
   * option names. Best-effort: poll decryption is fragile (needs the original
   * poll's secret in cache), so any failure is logged and swallowed.
   */
  private async handlePollVote(sessionId: string, msg: proto.IWebMessageInfo): Promise<void> {
    try {
      const update = msg.message?.pollUpdateMessage;
      const creationKey = update?.pollCreationMessageKey;
      if (!creationKey?.id || !update?.vote) return;

      // The CACHED poll message holds the secret + the true author. Its
      // key.fromMe tells us who created the poll — the vote's
      // pollCreationMessageKey does NOT (it's from the voter's perspective, so
      // fromMe is always false there).
      const cachedPoll = this.messageCache.get(sessionId)?.get(creationKey.id);
      const pollContent = cachedPoll?.message;
      const encKey = pollContent?.messageContextInfo?.messageSecret;
      if (!pollContent || !encKey) return; // poll not in cache — cannot decrypt

      const sock = this.sessions.get(sessionId);
      const meId = sock?.user?.id ? jidNormalizedUser(sock.user.id) : '';
      const myLid = (sock?.user as { lid?: string } | undefined)?.lid;
      const meLid = myLid ? jidNormalizedUser(myLid) : '';

      // Voter + creator can each be addressed by LID or phone-number (PN).
      // Per Baileys issue #2342 the winning combo for current WhatsApp is
      // creator=LID + voter=PN, so we list those first.
      const vk = msg.key as typeof msg.key & { senderPn?: string | null };
      const voterPn = vk.senderPn ? jidNormalizedUser(vk.senderPn) : '';
      const voterLid = msg.key.remoteJid?.endsWith('@lid')
        ? jidNormalizedUser(msg.key.remoteJid)
        : '';

      const pollFromMe = cachedPoll?.key?.fromMe ?? false;
      const creators = pollFromMe
        ? [...new Set([meLid, meId].filter(Boolean))] // we created the poll
        : [...new Set([voterLid, voterPn, getKeyAuthor(creationKey, meId)].filter(Boolean))];
      const voters = [...new Set([voterPn, voterLid].filter(Boolean))];

      let voteMsg: ReturnType<typeof decryptPollVote> | undefined;
      let lastErr: unknown;
      outer: for (const pollCreatorJid of creators) {
        for (const voterJid of voters) {
          try {
            voteMsg = decryptPollVote(update.vote, {
              pollEncKey: encKey,
              pollCreatorJid,
              pollMsgId: creationKey.id,
              voterJid,
            });
            console.log(`[PollVote] OK creator=${pollCreatorJid} voter=${voterJid}`);
            break outer;
          } catch (e) {
            lastErr = e;
          }
        }
      }
      if (!voteMsg) {
        console.warn(
          `[PollVote] all combos failed session=${sessionId} ` +
            `meId=${meId} meLid=${meLid || '(none)'} encKey=${encKey ? 'yes' : 'NO'} ` +
            `creators=${JSON.stringify(creators)} voters=${JSON.stringify(voters)} ` +
            `creationKey=${JSON.stringify({ id: creationKey.id, fromMe: creationKey.fromMe, participant: creationKey.participant, remoteJid: creationKey.remoteJid })} ` +
            `err=${String(lastErr)}`,
        );
        return;
      }

      const aggregated = getAggregateVotesInPollMessage(
        { message: pollContent, pollUpdates: [{ pollUpdateMessageKey: msg.key, vote: voteMsg }] },
        meId,
      );
      const selected = aggregated.filter((a) => a.voters.length > 0).map((a) => a.name);

      const displaySenderPn = vk.senderPn ?? null;
      const displayJid = displaySenderPn ?? msg.key.remoteJid ?? '';

      await this.webhookService.fire('message.received', sessionId, {
        messageId: msg.key.id,
        from: msg.key.remoteJid,
        sender: msg.key.participant || msg.key.remoteJid,
        senderJid: displayJid,
        senderPn: displaySenderPn,
        senderLid: msg.key.remoteJid?.endsWith('@lid') ? msg.key.remoteJid : null,
        avatarUrl: await this.getAvatarUrl(sessionId, displayJid),
        isGroup: false,
        timestamp: msg.messageTimestamp,
        type: 'poll_vote',
        content: {
          pollMessageId: creationKey.id,
          pollName: pollContent.pollCreationMessage?.name ?? pollContent.pollCreationMessageV3?.name,
          selectedOptions: selected,
          text: selected.length ? `🗳️ Voted: ${selected.join(', ')}` : '🗳️ Cleared their vote',
        },
        message: sanitizeMessage(msg),
      });

      // Dedicated, integration-friendly event so order-confirmation flows
      // (Shopify/Woo, PRD §2.3) can subscribe to votes only — not all messages.
      await this.webhookService.fire('poll.vote', sessionId, {
        pollMessageId: creationKey.id,
        pollName: pollContent.pollCreationMessage?.name ?? pollContent.pollCreationMessageV3?.name,
        selectedOptions: selected,
        voter: {
          jid: displayJid,
          phone: (displaySenderPn ?? msg.key.remoteJid ?? '').split('@')[0].replace(/[^0-9]/g, ''),
        },
        messageId: msg.key.id,
        timestamp: msg.messageTimestamp,
      });
    } catch (err) {
      console.warn(`[PollVote] decode failed session=${sessionId}: ${String(err)}`);
    }
  }

  // ─── Session restore on restart ────────────────────────────────────────

  private async restoreAllSessions() {
    if (!fs.existsSync(this.sessionsDir)) return;

    const SESSION_ID_RE = /^[a-zA-Z0-9_-]{1,64}$/;
    const sessionDirs = fs.readdirSync(this.sessionsDir);

    for (const sessionId of sessionDirs) {
      if (!SESSION_ID_RE.test(sessionId)) {
        console.warn(`[Restore] Skipping invalid session directory: ${sessionId}`);
        continue;
      }

      let sessionPath: string;
      try {
        sessionPath = this.resolveSessionPath(sessionId);
      } catch {
        console.warn(`[Restore] Skipping invalid session directory: ${sessionId}`);
        continue;
      }

      // Reject symlinked session directories — lstatSync does not follow symlinks
      if (!fs.lstatSync(sessionPath).isDirectory()) continue;

      // Only restore if creds file exists (means it was authenticated before)
      const credsFile = path.join(sessionPath, 'creds.json');
      if (!fs.existsSync(credsFile)) continue;

      // Reject symlinked creds.json — protects shared-host deployments from
      // arbitrary file reads via crafted symlinks inside the sessions directory
      if (fs.lstatSync(credsFile).isSymbolicLink()) {
        console.warn(`[Restore] Skipping ${sessionId} — symlinked creds.json rejected`);
        continue;
      }

      // Read proxy.json if present — same symlink guard as creds.json
      let restoredProxy: string | undefined;
      const proxyFile = path.join(sessionPath, 'proxy.json');
      if (fs.existsSync(proxyFile)) {
        if (fs.lstatSync(proxyFile).isSymbolicLink()) {
          console.warn(`[Restore] Skipping ${sessionId} — symlinked proxy.json rejected`);
          continue;
        }
        try {
          const raw = JSON.parse(fs.readFileSync(proxyFile, 'utf8'));
          if (typeof raw.proxy === 'string') restoredProxy = raw.proxy;
        } catch {
          console.warn(`[Restore] ${sessionId} — malformed proxy.json, restoring without proxy`);
        }
      }

      // Read config.json if present — same symlink guard as creds.json and proxy.json
      let restoredConfig: SessionConfig;
      const configFile = path.join(sessionPath, 'config.json');
      if (fs.existsSync(configFile)) {
        if (fs.lstatSync(configFile).isSymbolicLink()) {
          console.warn(`[Restore] Skipping ${sessionId} — symlinked config.json rejected`);
          continue;
        }
        try {
          const raw = JSON.parse(fs.readFileSync(configFile, 'utf8'));
          restoredConfig = { ...SESSION_CONFIG_DEFAULTS, ...raw };
        } catch {
          console.warn(`[${sessionId}] Malformed config.json — using defaults`);
          restoredConfig = { ...SESSION_CONFIG_DEFAULTS };
        }
      } else {
        restoredConfig = { ...SESSION_CONFIG_DEFAULTS };
      }
      this.sessionConfigs.set(sessionId, restoredConfig);

      console.log(`[Restore] Restoring session: ${sessionId}${restoredProxy ? ` (proxy: ${restoredProxy})` : ''}`);
      this.sessionInfo.set(sessionId, {
        id: sessionId,
        status: 'connecting',
        retryCount: 0,
        lastDisconnectReason: null,
        proxy: restoredProxy,
        config: restoredConfig,
      });

      this.initSocket(sessionId, restoredProxy).catch(err =>
        console.error(`[Restore] Failed to init session ${sessionId}: ${err.message}`)
      );
    }
  }

  // ─── Messaging: send ──────────────────────────────────────────────────

  async sendText(
    sessionId: string,
    to: string,
    text: string,
    quotedMessageId?: string,
  ): Promise<SendResult> {
    const sock = this.getSocket(sessionId);
    await this.applyRandomDelay(sessionId);
    const jid = this.toJid(to);

    const options: any = {};
    if (quotedMessageId) {
      const cache = this.messageCache.get(sessionId);
      const quotedMsg = cache?.get(quotedMessageId);
      options.quoted = quotedMsg ?? { key: { id: quotedMessageId } };
    }

    const result = await sock.sendMessage(jid, { text }, options);
    return { messageId: result?.key?.id, status: 'sent' };
  }

  async sendImage(
    sessionId: string,
    to: string,
    imageUrl: string,
    caption?: string,
  ): Promise<SendResult> {
    const sock = this.getSocket(sessionId);
    await this.applyRandomDelay(sessionId);
    const jid = this.toJid(to);
    const imageBuffer = await resolveMediaBuffer(imageUrl, 10 * 1024 * 1024);
    const result = await sock.sendMessage(jid, {
      image: imageBuffer,
      caption: caption || '',
    });
    return { messageId: result?.key?.id, status: 'sent' };
  }

  async sendVideo(
    sessionId: string,
    to: string,
    videoUrl: string,
    caption?: string,
  ): Promise<SendResult> {
    const sock = this.getSocket(sessionId);
    await this.applyRandomDelay(sessionId);
    const jid = this.toJid(to);
    const videoBuffer = await resolveMediaBuffer(videoUrl, 100 * 1024 * 1024);
    const result = await sock.sendMessage(jid, {
      video: videoBuffer,
      caption: caption || '',
    });
    return { messageId: result?.key?.id, status: 'sent' };
  }

  async sendAudio(
    sessionId: string,
    to: string,
    audioUrl: string,
    isVoiceNote: boolean = false,
  ): Promise<SendResult> {
    const sock = this.getSocket(sessionId);
    await this.applyRandomDelay(sessionId);
    const jid = this.toJid(to);
    const audioBuffer = await resolveMediaBuffer(audioUrl, 25 * 1024 * 1024);
    const result = await sock.sendMessage(jid, {
      audio: audioBuffer,
      mimetype: this.audioMimetype(audioUrl, isVoiceNote),
      ptt: isVoiceNote,
    });
    return { messageId: result?.key?.id, status: 'sent' };
  }

  async sendDocument(
    sessionId: string,
    to: string,
    docUrl: string,
    fileName: string,
    mimetype: string,
  ): Promise<SendResult> {
    const sock = this.getSocket(sessionId);
    await this.applyRandomDelay(sessionId);
    const jid = this.toJid(to);
    const docBuffer = await resolveMediaBuffer(docUrl, 100 * 1024 * 1024);
    const result = await sock.sendMessage(jid, {
      document: docBuffer,
      fileName,
      mimetype,
    });
    return { messageId: result?.key?.id, status: 'sent' };
  }

  async sendSticker(sessionId: string, to: string, stickerUrl: string): Promise<SendResult> {
    const sock = this.getSocket(sessionId);
    await this.applyRandomDelay(sessionId);
    const jid = this.toJid(to);
    const stickerBuffer = await resolveMediaBuffer(stickerUrl, 10 * 1024 * 1024);
    const result = await sock.sendMessage(jid, {
      sticker: stickerBuffer,
    });
    return { messageId: result?.key?.id, status: 'sent' };
  }

  async sendLocation(
    sessionId: string,
    to: string,
    latitude: number,
    longitude: number,
    name?: string,
    address?: string,
  ): Promise<SendResult> {
    const sock = this.getSocket(sessionId);
    await this.applyRandomDelay(sessionId);
    const jid = this.toJid(to);
    const result = await sock.sendMessage(jid, {
      location: {
        degreesLatitude: latitude,
        degreesLongitude: longitude,
        name: name || '',
        address: address || '',
      },
    });
    return { messageId: result?.key?.id, status: 'sent' };
  }

  async sendContact(
    sessionId: string,
    to: string,
    displayName: string,
    phoneNumber: string,
  ): Promise<SendResult> {
    const sock = this.getSocket(sessionId);
    await this.applyRandomDelay(sessionId);
    const jid = this.toJid(to);
    const normalizedPhone = phoneNumber.replace(/^\+/, '');
    const vcard =
      `BEGIN:VCARD\nVERSION:3.0\nFN:${displayName}\nTEL;type=CELL;type=VOICE;waid=${normalizedPhone}:+${normalizedPhone}\nEND:VCARD`;
    const result = await sock.sendMessage(jid, {
      contacts: {
        displayName,
        contacts: [{ displayName, vcard }],
      },
    });
    return { messageId: result?.key?.id, status: 'sent' };
  }

  async sendButtons(
    sessionId: string,
    to: string,
    text: string,
    footer: string,
    buttons: { id: string; text: string }[],
  ): Promise<SendResult> {
    const sock = this.getSocket(sessionId);
    await this.applyRandomDelay(sessionId);
    const jid = this.toJid(to);
    const result = await sock.sendMessage(jid, {
      text,
      footer,
      buttons: buttons.map((b) => ({
        buttonId: b.id,
        buttonText: { displayText: b.text },
        type: 1,
      })),
      headerType: 1,
    } as any);
    return { messageId: result?.key?.id, status: 'sent' };
  }

  async sendList(
    sessionId: string,
    to: string,
    title: string,
    text: string,
    buttonText: string,
    sections: { title: string; rows: { id: string; title: string; description?: string }[] }[],
  ): Promise<SendResult> {
    const sock = this.getSocket(sessionId);
    await this.applyRandomDelay(sessionId);
    const jid = this.toJid(to);
    const result = await sock.sendMessage(jid, {
      text,
      title,
      footer: '',
      buttonText,
      sections,
      listType: 1,
    } as any);
    return { messageId: result?.key?.id, status: 'sent' };
  }

  async sendPoll(
    sessionId: string,
    to: string,
    name: string,
    options: string[],
    selectableCount: number = 1,
  ): Promise<SendResult> {
    const sock = this.getSocket(sessionId);
    await this.applyRandomDelay(sessionId);
    const jid = this.toJid(to);
    const result = await sock.sendMessage(jid, {
      poll: {
        name,
        values: options,
        selectableCount,
      },
    });
    return { messageId: result?.key?.id, status: 'sent' };
  }

  async sendReaction(
    sessionId: string,
    to: string,
    messageId: string,
    emoji: string,
  ): Promise<SendResult> {
    const sock = this.getSocket(sessionId);
    await this.applyRandomDelay(sessionId);
    const jid = this.toJid(to);
    const result = await sock.sendMessage(jid, {
      react: {
        text: emoji,
        key: { remoteJid: jid, id: messageId },
      },
    });
    return { messageId: result?.key?.id, status: 'sent' };
  }

  async sendGif(
    sessionId: string,
    to: string,
    gifUrl: string,
    caption?: string,
  ): Promise<SendResult> {
    const sock = this.getSocket(sessionId);
    await this.applyRandomDelay(sessionId);
    const jid = this.toJid(to);
    // WhatsApp doesn't support .gif — send as mp4 with gifPlayback flag
    const gifBuffer = await resolveMediaBuffer(gifUrl, 100 * 1024 * 1024);
    const result = await sock.sendMessage(jid, {
      video: gifBuffer,
      caption: caption || '',
      gifPlayback: true,
    });
    return { messageId: result?.key?.id, status: 'sent' };
  }

  async sendViewOnce(
    sessionId: string,
    to: string,
    imageUrl: string,
    caption?: string,
  ): Promise<SendResult> {
    const sock = this.getSocket(sessionId);
    await this.applyRandomDelay(sessionId);
    const jid = this.toJid(to);
    const viewOnceBuffer = await resolveMediaBuffer(imageUrl, 10 * 1024 * 1024);
    const result = await sock.sendMessage(jid, {
      image: viewOnceBuffer,
      caption: caption || '',
      viewOnce: true,
    });
    return { messageId: result?.key?.id, status: 'sent' };
  }

  async editMessage(
    sessionId: string,
    to: string,
    messageId: string,
    newText: string,
  ): Promise<SendResult> {
    const sock = this.getSocket(sessionId);
    const jid = this.toJid(to);
    const result = await sock.sendMessage(jid, {
      edit: { remoteJid: jid, id: messageId, fromMe: true },
      text: newText,
    } as any);
    return { messageId: result?.key?.id, status: 'edited' };
  }

  async deleteMessage(
    sessionId: string,
    to: string,
    messageId: string,
    forEveryone: boolean = true,
  ): Promise<{ status: string }> {
    const sock = this.getSocket(sessionId);
    const jid = this.toJid(to);
    await sock.sendMessage(jid, {
      delete: { remoteJid: jid, id: messageId, fromMe: true },
    });
    return { status: 'deleted' };
  }

  async markRead(
    sessionId: string,
    to: string,
    messageIds: string[],
  ): Promise<{ status: string }> {
    const sock = this.getSocket(sessionId);
    const jid = this.toJid(to);
    await sock.readMessages(
      messageIds.map((id) => ({ remoteJid: jid, id, fromMe: false })),
    );
    return { status: 'read' };
  }

  // ─── Messaging: presence ────────────────────────────────────────────────

  async sendTyping(
    sessionId: string,
    to: string,
    isGroup: boolean = false,
  ): Promise<{ status: string }> {
    const sock = this.getSocket(sessionId);
    const jid = isGroup ? this.toGroupJid(to) : this.toJid(to);
    await sock.sendPresenceUpdate('composing', jid);
    // Auto-clear after 3 seconds
    setTimeout(() => sock.sendPresenceUpdate('paused', jid), 3000);
    return { status: 'typing' };
  }

  async sendPresence(
    sessionId: string,
    to: string,
    presence: PresenceType,
  ): Promise<{ status: string }> {
    const sock = this.getSocket(sessionId);
    const jid = this.toJid(to);
    await sock.sendPresenceUpdate(presence, jid);
    return { status: presence };
  }

  // ─── Groups ────────────────────────────────────────────────────────────

  async createGroup(
    sessionId: string,
    name: string,
    participants: string[],
  ): Promise<{ groupId: string; name: string; participants: string[] }> {
    const sock = this.getSocket(sessionId);
    const jids = participants.map((p) => this.toJid(p));
    const result = await sock.groupCreate(name, jids);
    return { groupId: result.id, name, participants: jids };
  }

  async getGroupInfo(sessionId: string, groupId: string): Promise<GroupInfo> {
    const sock = this.getSocket(sessionId);
    const metadata = await sock.groupMetadata(this.toGroupJid(groupId));
    return metadata as unknown as GroupInfo;
  }

  async getAllGroupsParticipating(sessionId: string): Promise<GroupInfo[]> {
    const sock = this.getSocket(sessionId);
    const groups = await sock.groupFetchAllParticipating();
    return Object.values(groups) as unknown as GroupInfo[];
  }

  async updateGroupName(
    sessionId: string,
    groupId: string,
    name: string,
  ): Promise<{ success: boolean; name: string }> {
    const sock = this.getSocket(sessionId);
    await sock.groupUpdateSubject(this.toGroupJid(groupId), name);
    return { success: true, name };
  }

  async updateGroupDescription(
    sessionId: string,
    groupId: string,
    description: string,
  ): Promise<{ success: boolean; description: string }> {
    const sock = this.getSocket(sessionId);
    await sock.groupUpdateDescription(this.toGroupJid(groupId), description);
    return { success: true, description };
  }

  async updateGroupPicture(
    sessionId: string,
    groupId: string,
    imageUrl: string,
  ): Promise<{ success: boolean }> {
    const sock = this.getSocket(sessionId);
    const buffer = await safeFetch(imageUrl, { maxBytes: 5 * 1024 * 1024 }).then((r) => r.buffer());
    await sock.updateProfilePicture(this.toGroupJid(groupId), buffer);
    return { success: true };
  }

  async addParticipants(
    sessionId: string,
    groupId: string,
    participants: string[],
  ): Promise<{ success: boolean; result: unknown }> {
    const sock = this.getSocket(sessionId);
    const jids = participants.map((p) => this.toJid(p));
    const result = await sock.groupParticipantsUpdate(this.toGroupJid(groupId), jids, 'add');
    return { success: true, result };
  }

  async removeParticipants(
    sessionId: string,
    groupId: string,
    participants: string[],
  ): Promise<{ success: boolean; result: unknown }> {
    const sock = this.getSocket(sessionId);
    const jids = participants.map((p) => this.toJid(p));
    const result = await sock.groupParticipantsUpdate(this.toGroupJid(groupId), jids, 'remove');
    return { success: true, result };
  }

  async promoteParticipants(
    sessionId: string,
    groupId: string,
    participants: string[],
  ): Promise<{ success: boolean; result: unknown }> {
    const sock = this.getSocket(sessionId);
    const jids = participants.map((p) => this.toJid(p));
    const result = await sock.groupParticipantsUpdate(this.toGroupJid(groupId), jids, 'promote');
    return { success: true, result };
  }

  async demoteParticipants(
    sessionId: string,
    groupId: string,
    participants: string[],
  ): Promise<{ success: boolean; result: unknown }> {
    const sock = this.getSocket(sessionId);
    const jids = participants.map((p) => this.toJid(p));
    const result = await sock.groupParticipantsUpdate(this.toGroupJid(groupId), jids, 'demote');
    return { success: true, result };
  }

  async leaveGroup(sessionId: string, groupId: string): Promise<{ success: boolean }> {
    const sock = this.getSocket(sessionId);
    await sock.groupLeave(this.toGroupJid(groupId));
    return { success: true };
  }

  async getGroupInviteLink(
    sessionId: string,
    groupId: string,
  ): Promise<{ code: string; link: string }> {
    const sock = this.getSocket(sessionId);
    const code = await sock.groupInviteCode(this.toGroupJid(groupId));
    return { code, link: `https://chat.whatsapp.com/${code}` };
  }

  async revokeGroupInviteLink(
    sessionId: string,
    groupId: string,
  ): Promise<{ newCode: string; newLink: string }> {
    const sock = this.getSocket(sessionId);
    const newCode = await sock.groupRevokeInvite(this.toGroupJid(groupId));
    return { newCode, newLink: `https://chat.whatsapp.com/${newCode}` };
  }

  async joinGroupByInviteLink(
    sessionId: string,
    inviteCode: string,
  ): Promise<{ success: boolean; groupId: string }> {
    const sock = this.getSocket(sessionId);
    // Extract code from full URL if needed
    const code = inviteCode.includes('chat.whatsapp.com/')
      ? inviteCode.split('chat.whatsapp.com/')[1]
      : inviteCode;
    try {
      const result = await sock.groupAcceptInvite(code);
      return { success: true, groupId: result };
    } catch (err) {
      if (err instanceof HttpException) throw err;
      throw new BadRequestException('Invalid or expired invite code');
    }
  }

  async getGroupPicture(
    sessionId: string,
    groupId: string,
  ): Promise<{ groupId: string; profilePictureUrl: string | null }> {
    const sock = this.getSocket(sessionId);
    try {
      const url = await sock.profilePictureUrl(this.toGroupJid(groupId), 'image');
      return { groupId, profilePictureUrl: url };
    } catch {
      return { groupId, profilePictureUrl: null };
    }
  }

  async updateGroupSettings(
    sessionId: string,
    groupId: string,
    setting: GroupSetting,
  ): Promise<{ success: boolean; setting: GroupSetting }> {
    const sock = this.getSocket(sessionId);
    await sock.groupSettingUpdate(this.toGroupJid(groupId), setting);
    return { success: true, setting };
  }

  // ─── Contacts & profile ────────────────────────────────────────────────

  async checkNumber(sessionId: string, number: string): Promise<ContactCheckResult> {
    const sock = this.getSocket(sessionId);
    const [result] = await sock.onWhatsApp(number.replace(/[^0-9]/g, ''));
    return {
      number,
      jid: result?.jid,
      isOnWhatsApp: result?.exists === true,
      isBusiness: (result as any)?.isBusiness || false,
    };
  }

  async checkNumbers(sessionId: string, numbers: string[]): Promise<ContactCheckResult[]> {
    return Promise.all(numbers.map((n) => this.checkNumber(sessionId, n)));
  }

  async getContactProfilePicture(
    sessionId: string,
    number: string,
    highRes: boolean = false,
  ): Promise<{ jid: string; profilePictureUrl: string | null }> {
    const sock = this.getSocket(sessionId);
    const jid = this.toJid(number);
    try {
      const url = await sock.profilePictureUrl(jid, highRes ? 'image' : 'preview');
      return { jid, profilePictureUrl: url };
    } catch {
      return { jid, profilePictureUrl: null };
    }
  }

  async getContactAbout(
    sessionId: string,
    number: string,
  ): Promise<{ jid: string; about: string | null; setAt?: Date }> {
    const sock = this.getSocket(sessionId);
    const jid = this.toJid(number);
    try {
      const status = await sock.fetchStatus(jid) as any;
      return { jid, about: status?.status || null, setAt: status?.setAt };
    } catch {
      return { jid, about: null };
    }
  }

  async blockContact(
    sessionId: string,
    number: string,
  ): Promise<{ jid: string; blocked: boolean }> {
    const sock = this.getSocket(sessionId);
    const jid = this.toJid(number);
    await sock.updateBlockStatus(jid, 'block');
    return { jid, blocked: true };
  }

  async unblockContact(
    sessionId: string,
    number: string,
  ): Promise<{ jid: string; blocked: boolean }> {
    const sock = this.getSocket(sessionId);
    const jid = this.toJid(number);
    await sock.updateBlockStatus(jid, 'unblock');
    return { jid, blocked: false };
  }

  async subscribePresence(
    sessionId: string,
    number: string,
  ): Promise<{ jid: string; subscribed: boolean }> {
    const sock = this.getSocket(sessionId);
    const jid = this.toJid(number);
    await sock.presenceSubscribe(jid);
    return { jid, subscribed: true };
  }

  // ─── Own profile ───────────────────────────────────────────────────────

  async getOwnProfile(sessionId: string): Promise<ProfileInfo> {
    const sock = this.getSocket(sessionId);
    const user = sock.user;
    return {
      jid: user?.id,
      name: user?.name,
      phoneNumber: user?.id?.split(':')[0],
    };
  }

  async updateOwnName(
    sessionId: string,
    name: string,
  ): Promise<{ success: boolean; name: string }> {
    const sock = this.getSocket(sessionId);
    await sock.updateProfileName(name);
    return { success: true, name };
  }

  async updateOwnAbout(
    sessionId: string,
    about: string,
  ): Promise<{ success: boolean; about: string }> {
    const sock = this.getSocket(sessionId);
    await sock.updateProfileStatus(about);
    return { success: true, about };
  }

  async updateOwnProfilePicture(
    sessionId: string,
    imageUrl: string,
  ): Promise<{ success: boolean }> {
    const sock = this.getSocket(sessionId);
    const buffer = await safeFetch(imageUrl, { maxBytes: 5 * 1024 * 1024 }).then((r) => r.buffer());
    await sock.updateProfilePicture(sock.user!.id, buffer);
    return { success: true };
  }

  async removeOwnProfilePicture(sessionId: string): Promise<{ success: boolean }> {
    const sock = this.getSocket(sessionId);
    await sock.removeProfilePicture(sock.user!.id);
    return { success: true };
  }

  // ─── Session config ────────────────────────────────────────────────────

  async patchSessionConfig(sessionId: string, patch: Partial<SessionConfig>): Promise<{ config: SessionConfig }> {
    const sessionPath = this.resolveSessionPath(sessionId);
    const existing = this.sessionConfigs.get(sessionId) ?? SESSION_CONFIG_DEFAULTS;
    const merged: SessionConfig = { ...existing, ...patch };

    // Cross-field validation
    if (merged.random_delay_max_ms < merged.random_delay_min_ms) {
      throw new BadRequestException('random_delay_max_ms must be >= random_delay_min_ms');
    }

    // Atomic write
    const configFile = path.join(sessionPath, 'config.json');
    const tmpFile = configFile + '.tmp';
    fs.writeFileSync(tmpFile, JSON.stringify(merged), 'utf8');
    fs.renameSync(tmpFile, configFile);

    // Update in-memory map
    this.sessionConfigs.set(sessionId, merged);

    // Update sessionInfo entry with new config
    const info = this.sessionInfo.get(sessionId);
    if (info) {
      this.sessionInfo.set(sessionId, { ...info, config: merged });
    }

    // Fire webhook event
    await this.webhookService.fire('session.config_updated', sessionId, merged);

    return { config: merged };
  }
}
