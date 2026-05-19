import { Inject, Injectable } from '@nestjs/common';
import {
  WHATSAPP_ADAPTER,
  IWhatsAppAdapter,
  SendResult,
  PresenceType,
} from '../whatsapp/whatsapp-adapter.interface';

@Injectable()
export class MessagesService {
  constructor(
    @Inject(WHATSAPP_ADAPTER) private adapter: IWhatsAppAdapter,
  ) {}

  async sendText(sessionId: string, to: string, text: string, quotedId?: string): Promise<SendResult> {
    return this.adapter.sendText(sessionId, to, text, quotedId);
  }

  async sendImage(sessionId: string, to: string, imageUrl: string, caption?: string): Promise<SendResult> {
    return this.adapter.sendImage(sessionId, to, imageUrl, caption);
  }

  async sendVideo(sessionId: string, to: string, videoUrl: string, caption?: string): Promise<SendResult> {
    return this.adapter.sendVideo(sessionId, to, videoUrl, caption);
  }

  async sendAudio(sessionId: string, to: string, audioUrl: string, isVoiceNote: boolean = false): Promise<SendResult> {
    return this.adapter.sendAudio(sessionId, to, audioUrl, isVoiceNote);
  }

  async sendDocument(
    sessionId: string,
    to: string,
    docUrl: string,
    fileName: string,
    mimetype: string,
  ): Promise<SendResult> {
    return this.adapter.sendDocument(sessionId, to, docUrl, fileName, mimetype);
  }

  async sendSticker(sessionId: string, to: string, stickerUrl: string): Promise<SendResult> {
    return this.adapter.sendSticker(sessionId, to, stickerUrl);
  }

  async sendLocation(
    sessionId: string,
    to: string,
    latitude: number,
    longitude: number,
    name?: string,
    address?: string,
  ): Promise<SendResult> {
    return this.adapter.sendLocation(sessionId, to, latitude, longitude, name, address);
  }

  async sendContact(
    sessionId: string,
    to: string,
    displayName: string,
    phoneNumber: string,
  ): Promise<SendResult> {
    return this.adapter.sendContact(sessionId, to, displayName, phoneNumber);
  }

  async sendButtons(
    sessionId: string,
    to: string,
    text: string,
    footer: string,
    buttons: { id: string; text: string }[],
  ): Promise<SendResult> {
    return this.adapter.sendButtons(sessionId, to, text, footer, buttons);
  }

  async sendList(
    sessionId: string,
    to: string,
    title: string,
    text: string,
    buttonText: string,
    sections: { title: string; rows: { id: string; title: string; description?: string }[] }[],
  ): Promise<SendResult> {
    return this.adapter.sendList(sessionId, to, title, text, buttonText, sections);
  }

  async sendPoll(
    sessionId: string,
    to: string,
    name: string,
    options: string[],
    selectableCount: number = 1,
  ): Promise<SendResult> {
    return this.adapter.sendPoll(sessionId, to, name, options, selectableCount);
  }

  async sendReaction(
    sessionId: string,
    to: string,
    messageId: string,
    emoji: string,
  ): Promise<SendResult> {
    return this.adapter.sendReaction(sessionId, to, messageId, emoji);
  }

  async sendGif(sessionId: string, to: string, gifUrl: string, caption?: string): Promise<SendResult> {
    return this.adapter.sendGif(sessionId, to, gifUrl, caption);
  }

  async sendViewOnce(sessionId: string, to: string, imageUrl: string, caption?: string): Promise<SendResult> {
    return this.adapter.sendViewOnce(sessionId, to, imageUrl, caption);
  }

  async editMessage(
    sessionId: string,
    to: string,
    messageId: string,
    newText: string,
  ): Promise<SendResult> {
    return this.adapter.editMessage(sessionId, to, messageId, newText);
  }

  async deleteMessage(
    sessionId: string,
    to: string,
    messageId: string,
    forEveryone: boolean = true,
  ): Promise<{ status: string }> {
    return this.adapter.deleteMessage(sessionId, to, messageId, forEveryone);
  }

  async markRead(sessionId: string, to: string, messageIds: string[]): Promise<{ status: string }> {
    return this.adapter.markRead(sessionId, to, messageIds);
  }

  async sendTyping(sessionId: string, to: string, isGroup: boolean = false): Promise<{ status: string }> {
    return this.adapter.sendTyping(sessionId, to, isGroup);
  }

  async sendPresence(
    sessionId: string,
    to: string,
    presence: PresenceType,
  ): Promise<{ status: string }> {
    return this.adapter.sendPresence(sessionId, to, presence);
  }
}
