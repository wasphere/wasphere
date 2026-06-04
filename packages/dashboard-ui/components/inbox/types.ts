export type ConversationStatus = "OPEN" | "RESOLVED" | "SNOOZED"

export interface InboxContact {
  id: string
  phone: string
  name: string
  savedName: string | null
  whatsappName: string | null
  avatarUrl: string | null
}

export interface Conversation {
  id: string
  sessionId: string
  status: ConversationStatus
  lastMessageAt: string
  lastPreview: string | null
  unreadCount: number
  tags: string[]
  sessionDeletedAt: string | null
  notes?: string | null
  contact: InboxContact
}

export type MessageDirection = "INBOUND" | "OUTBOUND"
export type DeliveryStatus = "PENDING" | "SENT" | "DELIVERED" | "READ" | "FAILED"

export interface InboxMessage {
  id: string
  conversationId: string
  waMessageId: string
  direction: MessageDirection
  type: string
  body: string | null
  mediaUrl: string | null
  payload: Record<string, unknown> | null
  status: DeliveryStatus
  fromMe: boolean
  waTimestamp: string
  createdAt: string
}

export interface Paginated<T> {
  items: T[]
  nextCursor: string | null
}

// Outbound reply payloads sent to POST /api/inbox/conversations/:id/messages.
// `media` is a base64 data URI for image/document.
export type OutboundReply =
  | { kind: "text"; text: string }
  | { kind: "image"; media: string; caption?: string }
  | { kind: "document"; media: string; fileName: string; mimetype: string }
  | { kind: "poll"; pollName: string; options: string[]; selectableCount?: number }
  | { kind: "reaction"; targetMessageId: string; emoji: string }
