import { Inject, Injectable } from '@nestjs/common';
import {
  WHATSAPP_ADAPTER,
  IWhatsAppAdapter,
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
  OutboundTextOpts,
  OutboundMedia,
  OutboundLocation,
  OutboundContact,
  Interactive,
  TemplateMessage,
} from './provider.types';
import { BAILEYS_CAPABILITIES } from './capabilities';
import { CapabilityError } from './capability-error';

/**
 * The Baileys engine as a {@link MessageProvider} (design §3).
 *
 * This is a **thin wrapper** over the existing {@link BaileysAdapter} (injected
 * as `WHATSAPP_ADAPTER`): every method delegates to the concrete adapter, so all
 * current behaviour — LID resolution, poll-vote decryption, media download — is
 * preserved unchanged. The wrapper only maps the narrow common signatures
 * (`sendMedia`, `sendInteractive`) onto the adapter's concrete methods.
 *
 * Baileys-only capabilities (groups, presence, profile edits, polls, …) are NOT
 * part of this contract; callers reach those through the adapter directly.
 */
@Injectable()
export class BaileysProvider implements MessageProvider {
  readonly id: ProviderId = 'baileys';
  readonly capabilities: ProviderCapabilities = BAILEYS_CAPABILITIES;

  constructor(
    @Inject(WHATSAPP_ADAPTER) private readonly adapter: IWhatsAppAdapter,
  ) {}

  // ── lifecycle ────────────────────────────────────────────────────────────

  init(
    sessionId: string,
    creds: ProviderCredentials,
    cfg?: Partial<SessionConfig>,
  ): Promise<SessionInfo> {
    const proxy = creds.kind === 'baileys' ? creds.proxy : undefined;
    return this.adapter.createSession(sessionId, proxy, cfg);
  }

  destroy(sessionId: string): Promise<void> {
    return this.adapter.deleteSession(sessionId);
  }

  status(sessionId: string): SessionStatus {
    return this.adapter.getSessionInfo(sessionId).status;
  }

  // ── outbound (shared subset → concrete adapter methods) ──────────────────

  sendText(
    sessionId: string,
    to: string,
    text: string,
    opts?: OutboundTextOpts,
  ): Promise<SendResult> {
    return this.adapter.sendText(sessionId, to, text, opts?.quotedMessageId);
  }

  sendMedia(sessionId: string, to: string, m: OutboundMedia): Promise<SendResult> {
    switch (m.kind) {
      case 'image':
        return this.adapter.sendImage(sessionId, to, m.url, m.caption);
      case 'video':
        return this.adapter.sendVideo(sessionId, to, m.url, m.caption);
      case 'audio':
        return this.adapter.sendAudio(sessionId, to, m.url, m.isVoiceNote);
      case 'document':
        return this.adapter.sendDocument(
          sessionId,
          to,
          m.url,
          m.fileName ?? 'file',
          m.mimetype ?? 'application/octet-stream',
        );
      case 'sticker':
        return this.adapter.sendSticker(sessionId, to, m.url);
      default:
        throw new CapabilityError('mediaUpload', this.id);
    }
  }

  sendLocation(
    sessionId: string,
    to: string,
    loc: OutboundLocation,
  ): Promise<SendResult> {
    return this.adapter.sendLocation(
      sessionId,
      to,
      loc.latitude,
      loc.longitude,
      loc.name,
      loc.address,
    );
  }

  sendContact(
    sessionId: string,
    to: string,
    card: OutboundContact,
  ): Promise<SendResult> {
    return this.adapter.sendContact(
      sessionId,
      to,
      card.displayName,
      card.phoneNumber,
    );
  }

  sendReaction(
    sessionId: string,
    to: string,
    messageId: string,
    emoji: string,
    fromMe: boolean,
  ): Promise<SendResult> {
    return this.adapter.sendReaction(sessionId, to, messageId, emoji, fromMe);
  }

  sendInteractive(
    sessionId: string,
    to: string,
    i: Interactive,
  ): Promise<SendResult> {
    if (i.kind === 'buttons') {
      return this.adapter.sendButtons(sessionId, to, i.text, i.footer ?? '', i.buttons);
    }
    return this.adapter.sendList(
      sessionId,
      to,
      i.title ?? '',
      i.text,
      i.buttonText,
      i.sections,
    );
  }

  // Baileys has no template primitive — that's Meta-only.
  async sendTemplate(
    _sessionId: string,
    _to: string,
    _template: TemplateMessage,
  ): Promise<SendResult> {
    throw new CapabilityError('templates', this.id);
  }

  async markRead(
    sessionId: string,
    to: string,
    messageIds: string[],
  ): Promise<void> {
    await this.adapter.markRead(sessionId, to, messageIds);
  }
}
