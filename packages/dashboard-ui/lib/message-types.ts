export const MESSAGE_TYPES = [
  "text",
  "image",
  "video",
  "audio",
  "document",
  "sticker",
  "gif",
  "location",
  "contact",
  "buttons",
  "list",
  "poll",
  "reaction",
  "view-once",
] as const

export type MessageType = (typeof MESSAGE_TYPES)[number]

export const MESSAGE_TYPE_LABELS: Record<MessageType, string> = {
  text: "Text",
  image: "Image",
  video: "Video",
  audio: "Audio",
  document: "Document",
  sticker: "Sticker",
  gif: "GIF",
  location: "Location",
  contact: "Contact",
  buttons: "Buttons",
  list: "List",
  poll: "Poll",
  reaction: "Reaction",
  "view-once": "View Once",
}

export const TYPE_ROW_1: MessageType[] = [
  "text",
  "image",
  "video",
  "audio",
  "document",
  "sticker",
  "gif",
]

export const TYPE_ROW_2: MessageType[] = [
  "location",
  "contact",
  "buttons",
  "list",
  "poll",
  "reaction",
  "view-once",
]
