/**
 * Provider abstraction types (v1.2 — Meta Cloud API design §2, §10).
 *
 * These are pure type declarations: the common contract both the Baileys engine
 * and the Meta Cloud API engine can honour. Nothing here is wired yet — the
 * BaileysProvider / ProviderRegistry that consume these land in a later PR.
 *
 * Capabilities outside the shared contract (groups, presence, profile edits)
 * stay on the full `IWhatsAppAdapter` (Baileys-only) and are gated by
 * `ProviderCapabilities`.
 */

import {
  SessionConfig,
  SessionInfo,
  SessionStatus,
  SendResult,
} from '../whatsapp-adapter.interface';

// ─── Identity & capabilities ────────────────────────────────────────────────

export type ProviderId = 'baileys' | 'meta';

export interface ProviderCapabilities {
  groups: boolean;
  presence: boolean;
  profileEdit: boolean;
  polls: boolean;
  templates: boolean;
  /** Meta-only: send a published WhatsApp Flow (interactive form). */
  flows: boolean;
  interactiveButtons: boolean;
  reactions: boolean;
  viewOnce: boolean;
  mediaUpload: boolean;
  /** Baileys: true. Meta: false — free-form is only allowed inside the 24h window. */
  freeformAlways: boolean;
}

/** A single capability name — the key used by guard rails and `CapabilityError`. */
export type ProviderCapability = keyof ProviderCapabilities;

// ─── Credentials ────────────────────────────────────────────────────────────

export interface BaileysCredentials {
  kind: 'baileys';
  proxy?: string;
}

/** Meta Cloud API credentials (design §8) — stored AES-256-GCM encrypted. */
export interface MetaCredentials {
  kind: 'meta';
  phoneNumberId: string;
  accessToken: string;
  wabaId: string;
  verifyToken: string;
  appSecret?: string;
}

export type ProviderCredentials = BaileysCredentials | MetaCredentials;

// ─── Outbound payloads (the shared subset) ──────────────────────────────────

export interface OutboundTextOpts {
  quotedMessageId?: string;
}

export type OutboundMediaKind =
  | 'image'
  | 'video'
  | 'audio'
  | 'document'
  | 'sticker';

export interface OutboundMedia {
  kind: OutboundMediaKind;
  /** Public URL or data URI. Meta may upload to /media first for an id. */
  url: string;
  caption?: string;
  fileName?: string;
  mimetype?: string;
  isVoiceNote?: boolean;
}

export interface OutboundLocation {
  latitude: number;
  longitude: number;
  name?: string;
  address?: string;
}

export interface OutboundContact {
  displayName: string;
  phoneNumber: string;
}

export interface InteractiveButton {
  id: string;
  text: string;
}

export interface InteractiveListRow {
  id: string;
  title: string;
  description?: string;
}

export interface InteractiveListSection {
  title: string;
  rows: InteractiveListRow[];
}

/** Maps to Baileys buttons/list OR Meta `type:interactive`. */
export type Interactive =
  | {
      kind: 'buttons';
      text: string;
      footer?: string;
      buttons: InteractiveButton[];
    }
  | {
      kind: 'list';
      title?: string;
      text: string;
      buttonText: string;
      sections: InteractiveListSection[];
    };

export interface TemplateParameter {
  type: string;
  text?: string;
  [key: string]: unknown;
}

export interface TemplateComponent {
  type: string;
  parameters?: TemplateParameter[];
  [key: string]: unknown;
}

/** Meta-only message; Baileys throws `CapabilityError('templates')`. */
export interface TemplateMessage {
  name: string;
  languageCode: string;
  components?: TemplateComponent[];
}

/** Send a published Meta WhatsApp Flow as an interactive message. */
export interface FlowMessage {
  /** The published flow's id (from listFlows). */
  flowId: string;
  /** Button label that opens the flow, e.g. "Book now". */
  cta: string;
  /** Body text shown above the button. */
  body: string;
  header?: string;
  footer?: string;
  /**
   * First screen id — REQUIRED for 'navigate' flows. Omit for endpoint-driven
   * ('data_exchange') flows.
   */
  screen?: string;
  /** Defaults to 'navigate' when a screen is given, else 'data_exchange'. */
  mode?: 'navigate' | 'data_exchange';
  /** Correlation token echoed back in the flow response; auto-generated if absent. */
  flowToken?: string;
}

// ─── The common contract ────────────────────────────────────────────────────

/**
 * The narrow interface both engines honour (design §2.1). Everything outside it
 * is gated by `capabilities` and routed to the Baileys-only `IWhatsAppAdapter`.
 *
 * Inbound is intentionally absent from the contract: every provider normalises
 * inbound into the SAME internal webhook event, so the Inbox stays
 * provider-agnostic.
 */
export interface MessageProvider {
  readonly id: ProviderId;
  readonly capabilities: ProviderCapabilities;

  // ── lifecycle ──────────────────────────────────────────────────────────
  /** Baileys: opens a socket + QR. Meta: validates stored creds (no QR/socket). */
  init(
    sessionId: string,
    creds: ProviderCredentials,
    cfg?: Partial<SessionConfig>,
  ): Promise<SessionInfo>;
  destroy(sessionId: string): Promise<void>;
  status(sessionId: string): SessionStatus;

  // ── outbound (the shared subset) ──────────────────────────────────────
  sendText(
    sessionId: string,
    to: string,
    text: string,
    opts?: OutboundTextOpts,
  ): Promise<SendResult>;
  sendMedia(
    sessionId: string,
    to: string,
    media: OutboundMedia,
  ): Promise<SendResult>;
  sendLocation(
    sessionId: string,
    to: string,
    location: OutboundLocation,
  ): Promise<SendResult>;
  sendContact(
    sessionId: string,
    to: string,
    contact: OutboundContact,
  ): Promise<SendResult>;
  sendReaction(
    sessionId: string,
    to: string,
    messageId: string,
    emoji: string,
    fromMe: boolean,
  ): Promise<SendResult>;
  sendInteractive(
    sessionId: string,
    to: string,
    interactive: Interactive,
  ): Promise<SendResult>;
  /** Meta-only; Baileys throws `CapabilityError('templates')`. */
  sendTemplate(
    sessionId: string,
    to: string,
    template: TemplateMessage,
  ): Promise<SendResult>;
  /** Meta-only; Baileys throws `CapabilityError('flows')`. */
  sendFlow(
    sessionId: string,
    to: string,
    flow: FlowMessage,
  ): Promise<SendResult>;
  markRead(
    sessionId: string,
    to: string,
    messageIds: string[],
  ): Promise<void>;
}
