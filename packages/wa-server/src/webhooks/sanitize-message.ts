import type { proto } from '@whiskeysockets/baileys';

// ─── Output types (allowlist-driven) ──────────────────────────────────────────

export interface SanitizedKey {
  remoteJid: string | null | undefined;
  fromMe: boolean | null | undefined;
  id: string | null | undefined;
  participant: string | null | undefined;
}

export interface SanitizedMessage {
  key: SanitizedKey;
  messageTimestamp: number | Long | null | undefined;
  pushName: string | null | undefined;
  broadcast: boolean | null | undefined;
  message: SanitizedMessageContent | null | undefined;
}

export interface SanitizedMessageContent {
  conversation?: string | null;
  extendedTextMessage?: {
    text?: string | null;
    contextInfo?: {
      stanzaId?: string | null;
      quotedMessage?: SanitizedMessage | null;
    };
  };
  imageMessage?: {
    caption?: string | null;
    mimetype?: string | null;
    mediaKey?: Uint8Array | null;
    url?: string | null;
    fileLength?: number | Long | null;
  };
  videoMessage?: {
    caption?: string | null;
    mimetype?: string | null;
    mediaKey?: Uint8Array | null;
    url?: string | null;
  };
  audioMessage?: {
    ptt?: boolean | null;
    mimetype?: string | null;
    seconds?: number | null;
    mediaKey?: Uint8Array | null;
    url?: string | null;
  };
  documentMessage?: {
    fileName?: string | null;
    mimetype?: string | null;
    pageCount?: number | null;
    mediaKey?: Uint8Array | null;
    url?: string | null;
  };
  stickerMessage?: {
    isAnimated?: boolean | null;
  };
  locationMessage?: {
    degreesLatitude?: number | null;
    degreesLongitude?: number | null;
    name?: string | null;
    address?: string | null;
  };
  contactMessage?: {
    displayName?: string | null;
    vcard?: string | null;
  };
  reactionMessage?: {
    text?: string | null;
    key?: { id?: string | null };
  };
  pollCreationMessage?: {
    name?: string | null;
    options?: { optionName?: string | null }[];
  };
  pollUpdateMessage?: proto.Message.IPollUpdateMessage | null;
}

// Long is used by protobufjs for int64 fields (e.g. messageTimestamp, fileLength)
type Long = { low: number; high: number; unsigned: boolean };

// ─── sanitizeMessage ──────────────────────────────────────────────────────────

export function sanitizeMessage(msg: proto.IWebMessageInfo): SanitizedMessage;
export function sanitizeMessage(msg: null | undefined): null;
export function sanitizeMessage(msg: proto.IWebMessageInfo | null | undefined): SanitizedMessage | null {
  if (msg == null) return null;

  const key: SanitizedKey = {
    remoteJid: msg.key?.remoteJid,
    fromMe: msg.key?.fromMe,
    id: msg.key?.id,
    participant: msg.key?.participant,
  };

  const content = buildMessageContent(msg.message);

  return {
    key,
    messageTimestamp: msg.messageTimestamp as number | Long | null | undefined,
    pushName: msg.pushName,
    broadcast: msg.broadcast,
    message: content,
  };
}

function buildMessageContent(
  m: proto.IMessage | null | undefined,
): SanitizedMessageContent | null {
  if (!m) return null;

  const out: SanitizedMessageContent = {};

  if (m.conversation != null) {
    out.conversation = m.conversation;
  }

  if (m.extendedTextMessage != null) {
    const et = m.extendedTextMessage;
    const ci = et.contextInfo;
    out.extendedTextMessage = {
      text: et.text,
      contextInfo: ci
        ? {
            stanzaId: ci.stanzaId,
            quotedMessage: sanitizeMessage(
              ci.quotedMessage as proto.IWebMessageInfo | null | undefined,
            ),
          }
        : undefined,
    };
  }

  if (m.imageMessage != null) {
    const im = m.imageMessage;
    out.imageMessage = {
      caption: im.caption,
      mimetype: im.mimetype,
      mediaKey: im.mediaKey,
      url: im.url,
      fileLength: im.fileLength as number | Long | null | undefined,
    };
  }

  if (m.videoMessage != null) {
    const vm = m.videoMessage;
    out.videoMessage = {
      caption: vm.caption,
      mimetype: vm.mimetype,
      mediaKey: vm.mediaKey,
      url: vm.url,
    };
  }

  if (m.audioMessage != null) {
    const am = m.audioMessage;
    out.audioMessage = {
      ptt: am.ptt,
      mimetype: am.mimetype,
      seconds: am.seconds,
      mediaKey: am.mediaKey,
      url: am.url,
    };
  }

  if (m.documentMessage != null) {
    const dm = m.documentMessage;
    out.documentMessage = {
      fileName: dm.fileName,
      mimetype: dm.mimetype,
      pageCount: dm.pageCount,
      mediaKey: dm.mediaKey,
      url: dm.url,
    };
  }

  if (m.stickerMessage != null) {
    out.stickerMessage = { isAnimated: m.stickerMessage.isAnimated };
  }

  if (m.locationMessage != null) {
    const lm = m.locationMessage;
    out.locationMessage = {
      degreesLatitude: lm.degreesLatitude,
      degreesLongitude: lm.degreesLongitude,
      name: lm.name,
      address: lm.address,
    };
  }

  if (m.contactMessage != null) {
    out.contactMessage = {
      displayName: m.contactMessage.displayName,
      vcard: m.contactMessage.vcard,
    };
  }

  if (m.reactionMessage != null) {
    out.reactionMessage = {
      text: m.reactionMessage.text,
      key: m.reactionMessage.key ? { id: m.reactionMessage.key.id } : undefined,
    };
  }

  if (m.pollCreationMessage != null) {
    const pc = m.pollCreationMessage;
    out.pollCreationMessage = {
      name: pc.name,
      options: pc.options?.map((o) => ({ optionName: o.optionName })),
    };
  }

  if (m.pollUpdateMessage != null) {
    out.pollUpdateMessage = m.pollUpdateMessage;
  }

  return out;
}

// ─── sanitizeMessageUpdate ────────────────────────────────────────────────────

export interface SanitizedMessageUpdate {
  key: SanitizedKey;
  update: { status?: number | null };
}

export function sanitizeMessageUpdate(update: {
  key?: proto.IMessageKey | null;
  update?: { status?: number | null; [key: string]: unknown };
}): SanitizedMessageUpdate {
  return {
    key: {
      remoteJid: update.key?.remoteJid,
      fromMe: update.key?.fromMe,
      id: update.key?.id,
      participant: update.key?.participant,
    },
    update: {
      status: update.update?.status,
    },
  };
}

// ─── sanitizeReceipt ──────────────────────────────────────────────────────────

export interface SanitizedReceipt {
  key: SanitizedKey;
  userReceipt: {
    readTimestamp?: number | Long | null;
    receiptTimestamp?: number | Long | null;
    userJid?: string | null;
  }[];
}

export function sanitizeReceipt(receipt: {
  key?: proto.IMessageKey | null;
  userReceipt?: {
    readTimestamp?: number | Long | null;
    receiptTimestamp?: number | Long | null;
    userJid?: string | null;
    [key: string]: unknown;
  }[] | null;
}): SanitizedReceipt {
  return {
    key: {
      remoteJid: receipt.key?.remoteJid,
      fromMe: receipt.key?.fromMe,
      id: receipt.key?.id,
      participant: receipt.key?.participant,
    },
    userReceipt: (receipt.userReceipt ?? []).map((r) => ({
      readTimestamp: r.readTimestamp,
      receiptTimestamp: r.receiptTimestamp,
      userJid: r.userJid,
    })),
  };
}
