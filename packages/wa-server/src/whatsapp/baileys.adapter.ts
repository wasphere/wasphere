import { Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  WASocket,
  BaileysEventMap,
  proto,
  getContentType,
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import * as fs from 'fs';
import * as path from 'path';
import * as QRCode from 'qrcode';
import { WebhookService } from '../webhooks/webhook.service';
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

// Fallback WA protocol version used when fetchLatestBaileysVersion() fails.
// Source: @whiskeysockets/baileys src/Defaults/baileys-version.json as of 2026-05-20
//   (Baileys 6.7.21, last verified against WhiskeySockets/Baileys commit history)
// Refresh this constant whenever Baileys is upgraded or when connection failures
// suggest WhatsApp has rotated its minimum accepted version.
const WA_VERSION_FALLBACK: [number, number, number] = [2, 3000, 1015901307];

@Injectable()
export class BaileysAdapter implements IWhatsAppAdapter, OnModuleInit {
  private sessions = new Map<string, WASocket>();
  private sessionInfo = new Map<string, SessionInfo>();
  private readonly sessionsDir = './sessions';
  private readonly MAX_RETRIES = 5;
  private readonly RETRY_DELAY_MS = 5000;

  // Per session: Map<messageId, proto.IWebMessageInfo>
  // Eviction: when size reaches 100, delete the oldest inserted key before inserting the new one.
  private readonly messageCache = new Map<string, Map<string, proto.IWebMessageInfo>>();
  private readonly MESSAGE_CACHE_LIMIT = 100;

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

  // ─── Session lifecycle ──────────────────────────────────────────────────

  async createSession(sessionId: string): Promise<SessionInfo> {
    if (this.sessions.has(sessionId)) {
      return this.getSessionInfo(sessionId);
    }

    this.sessionInfo.set(sessionId, {
      id: sessionId,
      status: 'connecting',
      retryCount: 0,
    });

    await this.initSocket(sessionId);
    return this.getSessionInfo(sessionId);
  }

  getSessionInfo(sessionId: string): SessionInfo {
    const info = this.sessionInfo.get(sessionId);
    if (!info) throw new NotFoundException(`Session ${sessionId} not found`);
    return info;
  }

  getAllSessions(): SessionInfo[] {
    return Array.from(this.sessionInfo.values());
  }

  async deleteSession(sessionId: string): Promise<void> {
    const sock = this.sessions.get(sessionId);
    if (sock) {
      try {
        await sock.logout();
      } catch (_) {}
      sock.end(undefined);
      this.sessions.delete(sessionId);
    }

    this.sessionInfo.delete(sessionId);
    this.messageCache.delete(sessionId);

    // Delete stored auth files
    const sessionPath = path.join(this.sessionsDir, sessionId);
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
    return path.join(this.sessionsDir, sessionId);
  }

  // ─── Core socket init ──────────────────────────────────────────────────

  private async initSocket(sessionId: string): Promise<void> {
    const sessionPath = path.join(this.sessionsDir, sessionId);
    if (!fs.existsSync(sessionPath)) {
      fs.mkdirSync(sessionPath, { recursive: true });
    }

    const { state, saveCreds } = await useMultiFileAuthState(sessionPath);

    let version: [number, number, number];
    try {
      const fetched = await fetchLatestBaileysVersion();
      version = fetched.version;
    } catch {
      version = WA_VERSION_FALLBACK;
      console.warn('[Baileys] Remote version fetch failed — using bundled fallback version');
    }

    const sock = makeWASocket({
      version,
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, console as any),
      },
      printQRInTerminal: true,
      // Mimic a real browser to reduce ban risk
      browser: ['WaSphere', 'Chrome', '120.0.0'],
      // Don't mark messages as read automatically
      markOnlineOnConnect: false,
      // For groups — cache metadata to reduce WA API calls
      cachedGroupMetadata: async () => undefined,
      // Retry stanza sending
      retryRequestDelayMs: 2000,
    });

    this.sessions.set(sessionId, sock);

    // ─── Event Listeners ────────────────────────────────────────────

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
      await this.handleConnectionUpdate(sessionId, update);
    });

    sock.ev.on('messages.upsert', async (m) => {
      await this.handleIncomingMessages(sessionId, m);
    });

    sock.ev.on('messages.update', async (updates) => {
      await this.webhookService.fire('messages.update', sessionId, updates);
    });

    sock.ev.on('message-receipt.update', async (updates) => {
      await this.webhookService.fire('message.receipt', sessionId, updates);
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
      this.sessionInfo.set(sessionId, {
        ...info,
        status: 'qr_ready',
        qrCode: qrBase64,
        qrString: qr,
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

      this.sessionInfo.set(sessionId, {
        ...info,
        status: 'connected',
        qrCode: undefined,
        qrString: undefined,
        phoneNumber: user?.id?.split(':')[0],
        name: user?.name,
        connectedAt: new Date(),
        retryCount: 0,
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
      const isLoggedOut = statusCode === DisconnectReason.loggedOut;

      console.log(`[${sessionId}] Disconnected — code: ${statusCode}, loggedOut: ${isLoggedOut}`);

      if (isLoggedOut) {
        // User explicitly logged out — don't reconnect, clean up
        this.sessionInfo.set(sessionId, { ...info, status: 'logged_out' });
        await this.webhookService.fire('session.logged_out', sessionId, {});
        this.sessions.delete(sessionId);
      } else {
        // Network issue, WA update, etc. — reconnect with backoff
        this.sessionInfo.set(sessionId, { ...info, status: 'disconnected' });
        await this.webhookService.fire('session.disconnected', sessionId, {
          reason: statusCode,
        });

        if (info.retryCount < this.MAX_RETRIES) {
          const delay = this.RETRY_DELAY_MS * Math.pow(2, info.retryCount); // exponential backoff
          console.log(
            `[${sessionId}] Reconnecting in ${delay}ms (attempt ${info.retryCount + 1}/${this.MAX_RETRIES})`,
          );

          this.sessionInfo.set(sessionId, {
            ...info,
            retryCount: info.retryCount + 1,
          });

          setTimeout(() => {
            this.sessions.delete(sessionId);
            this.initSocket(sessionId);
          }, delay);
        } else {
          console.error(`[${sessionId}] Max retries reached — giving up`);
          await this.webhookService.fire('session.failed', sessionId, {
            reason: 'max_retries_exceeded',
          });
        }
      }
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

      const contentType = getContentType(msg.message || {});
      const isGroup = msg.key.remoteJid?.endsWith('@g.us');

      const basePayload = {
        messageId: msg.key.id,
        from: msg.key.remoteJid,
        sender: msg.key.participant || msg.key.remoteJid,
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

      // Check if it's a reply/quoted message
      const quotedMsg = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
      if (quotedMsg) {
        content.quotedMessageId = msg.message?.extendedTextMessage?.contextInfo?.stanzaId;
      }

      await this.webhookService.fire('message.received', sessionId, {
        ...basePayload,
        content,
        raw: msg, // full raw message for advanced users
      });
    }
  }

  // ─── Session restore on restart ────────────────────────────────────────

  private async restoreAllSessions() {
    if (!fs.existsSync(this.sessionsDir)) return;

    const sessionDirs = fs.readdirSync(this.sessionsDir);
    for (const sessionId of sessionDirs) {
      const sessionPath = path.join(this.sessionsDir, sessionId);
      if (!fs.statSync(sessionPath).isDirectory()) continue;

      // Only restore if creds file exists (means it was authenticated before)
      const credsFile = path.join(sessionPath, 'creds.json');
      if (!fs.existsSync(credsFile)) continue;

      console.log(`[Restore] Restoring session: ${sessionId}`);
      this.sessionInfo.set(sessionId, {
        id: sessionId,
        status: 'connecting',
        retryCount: 0,
      });

      try {
        await this.initSocket(sessionId);
      } catch (err) {
        console.error(`[Restore] Failed to restore ${sessionId}: ${err.message}`);
      }
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
    const jid = this.toJid(to);
    const result = await sock.sendMessage(jid, {
      image: { url: new URL(imageUrl) },
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
    const jid = this.toJid(to);
    const result = await sock.sendMessage(jid, {
      video: { url: new URL(videoUrl) },
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
    const jid = this.toJid(to);
    const result = await sock.sendMessage(jid, {
      audio: { url: new URL(audioUrl) },
      mimetype: 'audio/ogg; codecs=opus',
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
    const jid = this.toJid(to);
    const result = await sock.sendMessage(jid, {
      document: { url: new URL(docUrl) },
      fileName,
      mimetype,
    });
    return { messageId: result?.key?.id, status: 'sent' };
  }

  async sendSticker(sessionId: string, to: string, stickerUrl: string): Promise<SendResult> {
    const sock = this.getSocket(sessionId);
    const jid = this.toJid(to);
    const result = await sock.sendMessage(jid, {
      sticker: { url: new URL(stickerUrl) },
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
    const jid = this.toJid(to);
    const vcard =
      `BEGIN:VCARD\nVERSION:3.0\nFN:${displayName}\nTEL;type=CELL;type=VOICE;waid=${phoneNumber}:+${phoneNumber}\nEND:VCARD`;
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
    const jid = this.toJid(to);
    // WhatsApp doesn't support .gif — send as mp4 with gifPlayback flag
    const result = await sock.sendMessage(jid, {
      video: { url: new URL(gifUrl) },
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
    const jid = this.toJid(to);
    const result = await sock.sendMessage(jid, {
      image: { url: new URL(imageUrl) },
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
    const response = await fetch(imageUrl);
    const buffer = Buffer.from(await response.arrayBuffer());
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
    const result = await sock.groupAcceptInvite(code);
    return { success: true, groupId: result };
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
    const response = await fetch(imageUrl);
    const buffer = Buffer.from(await response.arrayBuffer());
    await sock.updateProfilePicture(sock.user!.id, buffer);
    return { success: true };
  }

  async removeOwnProfilePicture(sessionId: string): Promise<{ success: boolean }> {
    const sock = this.getSocket(sessionId);
    await sock.removeProfilePicture(sock.user!.id);
    return { success: true };
  }
}
