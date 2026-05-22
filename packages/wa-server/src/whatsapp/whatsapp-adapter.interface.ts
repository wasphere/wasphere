export const WHATSAPP_ADAPTER = Symbol('WHATSAPP_ADAPTER');

// ─── Supporting types (no Baileys dependency) ─────────────────────────────

export type SessionStatus =
  | 'connecting'
  | 'qr_ready'
  | 'connected'
  | 'disconnected'
  | 'logged_out'
  | 'qr_expired'
  | 'failed';

export interface SessionInfo {
  id: string;
  status: SessionStatus;
  qrCode?: string;              // base64 data URL
  qrExpiresAt?: Date;           // set when status is qr_ready, cleared on connect
  phoneNumber?: string;
  name?: string;
  connectedAt?: Date;
  retryCount: number;
  lastDisconnectReason: string | null;
  proxy?: string;
}

export interface SendResult {
  messageId: string | undefined;
  status: string;
}

export interface GroupInfo {
  id: string;
  subject: string;
  participants: { id: string; admin?: string | null }[];
  [key: string]: unknown;
}

export interface ContactCheckResult {
  number: string;
  jid: string | undefined;
  isOnWhatsApp: boolean;
  isBusiness: boolean;
}

export interface ProfileInfo {
  jid: string | undefined;
  name: string | undefined;
  phoneNumber: string | undefined;
}

export type GroupSetting =
  | 'announcement'
  | 'not_announcement'
  | 'locked'
  | 'unlocked';

export type PresenceType =
  | 'available'
  | 'unavailable'
  | 'composing'
  | 'recording'
  | 'paused';

// ─── The contract ──────────────────────────────────────────────────────────

export interface IWhatsAppAdapter {

  // -- Session lifecycle --------------------------------------------------

  createSession(sessionId: string, proxy?: string): Promise<SessionInfo>;
  getSessionInfo(sessionId: string): SessionInfo;
  getAllSessions(): SessionInfo[];
  deleteSession(sessionId: string): Promise<void>;
  logoutSession(sessionId: string): Promise<void>;
  /** Returns the session directory path for this sessionId */
  getSessionPath(sessionId: string): string;

  // -- Messaging: send ---------------------------------------------------

  sendText(
    sessionId: string,
    to: string,
    text: string,
    quotedMessageId?: string,
  ): Promise<SendResult>;

  sendImage(
    sessionId: string,
    to: string,
    imageUrl: string,
    caption?: string,
  ): Promise<SendResult>;

  sendVideo(
    sessionId: string,
    to: string,
    videoUrl: string,
    caption?: string,
  ): Promise<SendResult>;

  sendAudio(
    sessionId: string,
    to: string,
    audioUrl: string,
    isVoiceNote?: boolean,
  ): Promise<SendResult>;

  sendDocument(
    sessionId: string,
    to: string,
    docUrl: string,
    fileName: string,
    mimetype: string,
  ): Promise<SendResult>;

  sendSticker(sessionId: string, to: string, stickerUrl: string): Promise<SendResult>;

  sendLocation(
    sessionId: string,
    to: string,
    latitude: number,
    longitude: number,
    name?: string,
    address?: string,
  ): Promise<SendResult>;

  sendContact(
    sessionId: string,
    to: string,
    displayName: string,
    phoneNumber: string,
  ): Promise<SendResult>;

  sendButtons(
    sessionId: string,
    to: string,
    text: string,
    footer: string,
    buttons: { id: string; text: string }[],
  ): Promise<SendResult>;

  sendList(
    sessionId: string,
    to: string,
    title: string,
    text: string,
    buttonText: string,
    sections: { title: string; rows: { id: string; title: string; description?: string }[] }[],
  ): Promise<SendResult>;

  sendPoll(
    sessionId: string,
    to: string,
    name: string,
    options: string[],
    selectableCount?: number,
  ): Promise<SendResult>;

  sendReaction(
    sessionId: string,
    to: string,
    messageId: string,
    emoji: string,
  ): Promise<SendResult>;

  sendGif(
    sessionId: string,
    to: string,
    gifUrl: string,
    caption?: string,
  ): Promise<SendResult>;

  sendViewOnce(
    sessionId: string,
    to: string,
    imageUrl: string,
    caption?: string,
  ): Promise<SendResult>;

  editMessage(
    sessionId: string,
    to: string,
    messageId: string,
    newText: string,
  ): Promise<SendResult>;

  deleteMessage(
    sessionId: string,
    to: string,
    messageId: string,
    forEveryone?: boolean,
  ): Promise<{ status: string }>;

  markRead(
    sessionId: string,
    to: string,
    messageIds: string[],
  ): Promise<{ status: string }>;

  // -- Messaging: presence -----------------------------------------------

  sendTyping(sessionId: string, to: string, isGroup?: boolean): Promise<{ status: string }>;

  sendPresence(
    sessionId: string,
    to: string,
    presence: PresenceType,
  ): Promise<{ status: string }>;

  // -- Groups ------------------------------------------------------------

  createGroup(
    sessionId: string,
    name: string,
    participants: string[],
  ): Promise<{ groupId: string; name: string; participants: string[] }>;

  getGroupInfo(sessionId: string, groupId: string): Promise<GroupInfo>;

  getAllGroupsParticipating(sessionId: string): Promise<GroupInfo[]>;

  updateGroupName(sessionId: string, groupId: string, name: string): Promise<{ success: boolean; name: string }>;

  updateGroupDescription(
    sessionId: string,
    groupId: string,
    description: string,
  ): Promise<{ success: boolean; description: string }>;

  updateGroupPicture(sessionId: string, groupId: string, imageUrl: string): Promise<{ success: boolean }>;

  addParticipants(
    sessionId: string,
    groupId: string,
    participants: string[],
  ): Promise<{ success: boolean; result: unknown }>;

  removeParticipants(
    sessionId: string,
    groupId: string,
    participants: string[],
  ): Promise<{ success: boolean; result: unknown }>;

  promoteParticipants(
    sessionId: string,
    groupId: string,
    participants: string[],
  ): Promise<{ success: boolean; result: unknown }>;

  demoteParticipants(
    sessionId: string,
    groupId: string,
    participants: string[],
  ): Promise<{ success: boolean; result: unknown }>;

  leaveGroup(sessionId: string, groupId: string): Promise<{ success: boolean }>;

  getGroupInviteLink(
    sessionId: string,
    groupId: string,
  ): Promise<{ code: string; link: string }>;

  revokeGroupInviteLink(
    sessionId: string,
    groupId: string,
  ): Promise<{ newCode: string; newLink: string }>;

  joinGroupByInviteLink(
    sessionId: string,
    inviteCode: string,
  ): Promise<{ success: boolean; groupId: string }>;

  getGroupPicture(
    sessionId: string,
    groupId: string,
  ): Promise<{ groupId: string; profilePictureUrl: string | null }>;

  updateGroupSettings(
    sessionId: string,
    groupId: string,
    setting: GroupSetting,
  ): Promise<{ success: boolean; setting: GroupSetting }>;

  // -- Contacts & profile ------------------------------------------------

  checkNumber(sessionId: string, number: string): Promise<ContactCheckResult>;

  checkNumbers(sessionId: string, numbers: string[]): Promise<ContactCheckResult[]>;

  getContactProfilePicture(
    sessionId: string,
    number: string,
    highRes?: boolean,
  ): Promise<{ jid: string; profilePictureUrl: string | null }>;

  getContactAbout(
    sessionId: string,
    number: string,
  ): Promise<{ jid: string; about: string | null; setAt?: Date }>;

  blockContact(sessionId: string, number: string): Promise<{ jid: string; blocked: boolean }>;

  unblockContact(sessionId: string, number: string): Promise<{ jid: string; blocked: boolean }>;

  subscribePresence(sessionId: string, number: string): Promise<{ jid: string; subscribed: boolean }>;

  // -- Own profile -------------------------------------------------------

  getOwnProfile(sessionId: string): Promise<ProfileInfo>;

  updateOwnName(sessionId: string, name: string): Promise<{ success: boolean; name: string }>;

  updateOwnAbout(sessionId: string, about: string): Promise<{ success: boolean; about: string }>;

  updateOwnProfilePicture(sessionId: string, imageUrl: string): Promise<{ success: boolean }>;

  removeOwnProfilePicture(sessionId: string): Promise<{ success: boolean }>;
}
