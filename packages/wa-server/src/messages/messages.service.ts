import { Injectable } from '@nestjs/common';
import { SessionsService } from '../sessions/sessions.service';
import * as fs from 'fs';
import * as path from 'path';
import { downloadMediaMessage } from '@whiskeysockets/baileys';

function toJid(number: string): string {
  if (number.includes('@')) return number;
  // Remove any non-digit chars except +, then normalize
  const clean = number.replace(/[^0-9]/g, '');
  return `${clean}@s.whatsapp.net`;
}

function toGroupJid(id: string): string {
  if (id.includes('@g.us')) return id;
  return `${id}@g.us`;
}

@Injectable()
export class MessagesService {
  constructor(private sessionsService: SessionsService) {}

  // ─── Text ────────────────────────────────────────────────────────

  async sendText(sessionId: string, to: string, text: string, quotedId?: string) {
    const sock = this.sessionsService.getSocket(sessionId);
    const jid = toJid(to);

    const options: any = {};
    if (quotedId) {
      // For quoted replies we need to pass quoted message — simplified here
      options.quoted = { key: { id: quotedId } };
    }

    const result = await sock.sendMessage(jid, { text }, options);
    return { messageId: result?.key?.id, status: 'sent' };
  }

  // ─── Image ────────────────────────────────────────────────────────

  async sendImage(sessionId: string, to: string, imageUrl: string, caption?: string) {
    const sock = this.sessionsService.getSocket(sessionId);
    const jid = toJid(to);
    const result = await sock.sendMessage(jid, {
      image: { url: imageUrl },
      caption: caption || '',
    });
    return { messageId: result?.key?.id, status: 'sent' };
  }

  // ─── Video ────────────────────────────────────────────────────────

  async sendVideo(sessionId: string, to: string, videoUrl: string, caption?: string) {
    const sock = this.sessionsService.getSocket(sessionId);
    const jid = toJid(to);
    const result = await sock.sendMessage(jid, {
      video: { url: videoUrl },
      caption: caption || '',
    });
    return { messageId: result?.key?.id, status: 'sent' };
  }

  // ─── Audio / Voice Note ───────────────────────────────────────────

  async sendAudio(sessionId: string, to: string, audioUrl: string, isVoiceNote: boolean = false) {
    const sock = this.sessionsService.getSocket(sessionId);
    const jid = toJid(to);
    const result = await sock.sendMessage(jid, {
      audio: { url: audioUrl },
      mimetype: 'audio/ogg; codecs=opus',
      ptt: isVoiceNote,
    });
    return { messageId: result?.key?.id, status: 'sent' };
  }

  // ─── Document ────────────────────────────────────────────────────

  async sendDocument(sessionId: string, to: string, docUrl: string, fileName: string, mimetype: string) {
    const sock = this.sessionsService.getSocket(sessionId);
    const jid = toJid(to);
    const result = await sock.sendMessage(jid, {
      document: { url: docUrl },
      fileName,
      mimetype,
    });
    return { messageId: result?.key?.id, status: 'sent' };
  }

  // ─── Sticker ────────────────────────────────────────────────────

  async sendSticker(sessionId: string, to: string, stickerUrl: string) {
    const sock = this.sessionsService.getSocket(sessionId);
    const jid = toJid(to);
    const result = await sock.sendMessage(jid, {
      sticker: { url: stickerUrl },
    });
    return { messageId: result?.key?.id, status: 'sent' };
  }

  // ─── Location ────────────────────────────────────────────────────

  async sendLocation(
    sessionId: string,
    to: string,
    latitude: number,
    longitude: number,
    name?: string,
    address?: string,
  ) {
    const sock = this.sessionsService.getSocket(sessionId);
    const jid = toJid(to);
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

  // ─── Contact Card ────────────────────────────────────────────────

  async sendContact(sessionId: string, to: string, displayName: string, phoneNumber: string) {
    const sock = this.sessionsService.getSocket(sessionId);
    const jid = toJid(to);
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

  // ─── Buttons ────────────────────────────────────────────────────

  async sendButtons(
    sessionId: string,
    to: string,
    text: string,
    footer: string,
    buttons: { id: string; text: string }[],
  ) {
    const sock = this.sessionsService.getSocket(sessionId);
    const jid = toJid(to);
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

  // ─── List Message ────────────────────────────────────────────────

  async sendList(
    sessionId: string,
    to: string,
    title: string,
    text: string,
    buttonText: string,
    sections: { title: string; rows: { id: string; title: string; description?: string }[] }[],
  ) {
    const sock = this.sessionsService.getSocket(sessionId);
    const jid = toJid(to);
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

  // ─── Poll ────────────────────────────────────────────────────────

  async sendPoll(
    sessionId: string,
    to: string,
    name: string,
    options: string[],
    selectableCount: number = 1,
  ) {
    const sock = this.sessionsService.getSocket(sessionId);
    const jid = toJid(to);
    const result = await sock.sendMessage(jid, {
      poll: {
        name,
        values: options,
        selectableCount,
      },
    });
    return { messageId: result?.key?.id, status: 'sent' };
  }

  // ─── Reaction ────────────────────────────────────────────────────

  async sendReaction(sessionId: string, to: string, messageId: string, emoji: string) {
    const sock = this.sessionsService.getSocket(sessionId);
    const jid = toJid(to);
    const result = await sock.sendMessage(jid, {
      react: {
        text: emoji,
        key: { remoteJid: jid, id: messageId },
      },
    });
    return { messageId: result?.key?.id, status: 'sent' };
  }

  // ─── GIF ─────────────────────────────────────────────────────────

  async sendGif(sessionId: string, to: string, gifUrl: string, caption?: string) {
    const sock = this.sessionsService.getSocket(sessionId);
    const jid = toJid(to);
    // WhatsApp doesn't support .gif — send as mp4 with gifPlayback flag
    const result = await sock.sendMessage(jid, {
      video: { url: gifUrl },
      caption: caption || '',
      gifPlayback: true,
    });
    return { messageId: result?.key?.id, status: 'sent' };
  }

  // ─── View Once ───────────────────────────────────────────────────

  async sendViewOnce(sessionId: string, to: string, imageUrl: string, caption?: string) {
    const sock = this.sessionsService.getSocket(sessionId);
    const jid = toJid(to);
    const result = await sock.sendMessage(jid, {
      image: { url: imageUrl },
      caption: caption || '',
      viewOnce: true,
    });
    return { messageId: result?.key?.id, status: 'sent' };
  }

  // ─── Edit Message ────────────────────────────────────────────────

  async editMessage(sessionId: string, to: string, messageId: string, newText: string) {
    const sock = this.sessionsService.getSocket(sessionId);
    const jid = toJid(to);
    const result = await sock.sendMessage(jid, {
      edit: messageId,
      text: newText,
    } as any);
    return { messageId: result?.key?.id, status: 'edited' };
  }

  // ─── Delete Message ───────────────────────────────────────────────

  async deleteMessage(sessionId: string, to: string, messageId: string, forEveryone: boolean = true) {
    const sock = this.sessionsService.getSocket(sessionId);
    const jid = toJid(to);
    await sock.sendMessage(jid, {
      delete: { remoteJid: jid, id: messageId, fromMe: true },
    });
    return { status: 'deleted' };
  }

  // ─── Mark Read ───────────────────────────────────────────────────

  async markRead(sessionId: string, to: string, messageIds: string[]) {
    const sock = this.sessionsService.getSocket(sessionId);
    const jid = toJid(to);
    await sock.readMessages(
      messageIds.map((id) => ({ remoteJid: jid, id, fromMe: false })),
    );
    return { status: 'read' };
  }

  // ─── Typing Indicator ────────────────────────────────────────────

  async sendTyping(sessionId: string, to: string, isGroup: boolean = false) {
    const sock = this.sessionsService.getSocket(sessionId);
    const jid = isGroup ? toGroupJid(to) : toJid(to);
    await sock.sendPresenceUpdate('composing', jid);
    // Auto-clear after 3 seconds
    setTimeout(() => sock.sendPresenceUpdate('paused', jid), 3000);
    return { status: 'typing' };
  }

  // ─── Send Presence ───────────────────────────────────────────────

  async sendPresence(sessionId: string, to: string, presence: 'available' | 'unavailable' | 'composing' | 'recording' | 'paused') {
    const sock = this.sessionsService.getSocket(sessionId);
    const jid = toJid(to);
    await sock.sendPresenceUpdate(presence, jid);
    return { status: presence };
  }
}
