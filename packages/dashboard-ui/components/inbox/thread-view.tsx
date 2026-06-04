"use client"

import * as React from "react"
import { Check, CheckCheck, ChevronDown, FileText, ImageIcon, MapPin, BarChart3, MoreVertical, MoreHorizontal, SmilePlus, Download, Forward, Copy } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { StatusDot } from "@/components/ui/status-dot"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { clockTime } from "./relative-time"
import type { Conversation, InboxMessage } from "./types"

function contactInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : parts[0]?.[1] ?? "")).toUpperCase()
}

function Ticks({ status }: { status: InboxMessage["status"] }) {
  if (status === "READ") return <CheckCheck className="size-3.5 text-sky-400" />
  if (status === "DELIVERED") return <CheckCheck className="size-3.5 opacity-70" />
  if (status === "FAILED") return <span className="text-[10px] text-destructive">failed</span>
  return <Check className="size-3.5 opacity-70" />
}

// Tap an image to open a lightbox with a Download button.
function ImageView({ src, alt }: { src: string; alt: string }) {
  const [open, setOpen] = React.useState(false)
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="block cursor-zoom-in">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={alt} className="max-h-64 max-w-full rounded-md object-cover" />
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent showCloseButton className="max-w-3xl gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt={alt} className="max-h-[78vh] w-full rounded object-contain" />
          <div className="flex justify-end">
            <a
              href={src}
              download={alt && alt !== "image" ? alt : "wasphere-image.jpg"}
              className="inline-flex items-center gap-1.5 rounded-md border bg-background px-3 py-1.5 text-sm hover:bg-muted"
            >
              <Download className="size-4" /> Download
            </a>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

function MediaBlock({ m }: { m: InboxMessage }) {
  const p = (m.payload ?? {}) as Record<string, unknown>
  const cap = (p.caption as string) || m.body

  // Inbound messages WhatsApp couldn't decrypt (LID / unsupported) arrive empty.
  if (m.type === "unknown") {
    return (
      <span className="text-xs italic text-muted-foreground">
        ⚠️ This message couldn’t be loaded (unsupported or encrypted).
      </span>
    )
  }

  const label =
    m.type === "image" ? { Icon: ImageIcon, text: "Photo" }
    : m.type === "video" ? { Icon: ImageIcon, text: "Video" }
    : m.type === "document" ? { Icon: FileText, text: (p.fileName as string) || "Document" }
    : m.type === "location" ? { Icon: MapPin, text: "Location" }
    : m.type === "poll" ? { Icon: BarChart3, text: (p.name as string) || "Poll" }
    : { Icon: FileText, text: m.type }
  const pollOptions = m.type === "poll" && Array.isArray(p.options) ? (p.options as string[]) : null
  // Images/stickers carry their data URI in mediaUrl (sent or downloaded).
  const imgSrc = (m.type === "image" || m.type === "sticker") && m.mediaUrl ? m.mediaUrl : null
  return (
    <div className="flex flex-col gap-1">
      {imgSrc ? (
        <ImageView src={imgSrc} alt={(p.fileName as string) || cap || "image"} />
      ) : (
        <div className="flex items-center gap-2 rounded-md bg-background/40 px-2 py-1.5">
          <label.Icon className="size-4 shrink-0 opacity-80" />
          <span className="truncate text-xs">{label.text}</span>
        </div>
      )}
      {pollOptions && pollOptions.length > 0 && (
        <ul className="flex flex-col gap-1 pl-0.5">
          {pollOptions.map((o, i) => (
            <li key={i} className="flex items-center gap-1.5 text-xs">
              <span className="size-3 shrink-0 rounded-full border border-current opacity-50" />
              <span className="break-words">{o}</span>
            </li>
          ))}
        </ul>
      )}
      {cap && m.type !== "poll" ? <span className="whitespace-pre-wrap break-words text-sm">{cap}</span> : null}
    </div>
  )
}

const QUICK_REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🙏"]

// Reactions + poll votes are events, not chat bubbles — render them centered.
function SystemLine({ m }: { m: InboxMessage }) {
  const text =
    m.type === "reaction"
      ? `${m.fromMe ? "You" : "They"} reacted ${m.body ?? ""}`
      : m.body ?? ""
  return (
    <div className="flex justify-center">
      <span className="rounded-full bg-muted/60 px-3 py-1 text-[11px] text-muted-foreground">{text}</span>
    </div>
  )
}

function ReactButton({ m, onReact }: { m: InboxMessage; onReact: (m: InboxMessage, emoji: string) => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="ghost" size="icon" className="size-7 shrink-0 opacity-0 transition group-hover:opacity-100" />}
      >
        <SmilePlus className="size-4 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align={m.fromMe ? "end" : "start"} className="flex gap-0.5 rounded-full p-1.5 shadow-md">
        {QUICK_REACTIONS.map((e) => (
          <button
            key={e}
            onClick={() => onReact(m, e)}
            className="rounded-full p-1.5 text-xl leading-none transition-transform hover:scale-125 hover:bg-muted"
            type="button"
          >
            {e}
          </button>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function MsgMenu({ m, onForward }: { m: InboxMessage; onForward: (m: InboxMessage) => void }) {
  const canForward = m.type === "text" || m.type === "image" || m.type === "sticker" || m.type === "poll"
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="ghost" size="icon" className="size-7 shrink-0 opacity-0 transition group-hover:opacity-100" />}
      >
        <MoreHorizontal className="size-4 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align={m.fromMe ? "end" : "start"}>
        {canForward && (
          <DropdownMenuItem onClick={() => onForward(m)}>
            <Forward className="mr-2 size-4" /> Forward
          </DropdownMenuItem>
        )}
        {m.body && (
          <DropdownMenuItem onClick={() => void navigator.clipboard.writeText(m.body ?? "")}>
            <Copy className="mr-2 size-4" /> Copy text
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function Bubble({
  m,
  onReact,
  onForward,
}: {
  m: InboxMessage
  onReact?: (m: InboxMessage, emoji: string) => void
  onForward?: (m: InboxMessage) => void
}) {
  const isTextual = m.type === "text"
  return (
    <div className={cn("group flex items-center gap-1.5", m.fromMe ? "justify-end" : "justify-start")}>
      {m.fromMe && onForward && <MsgMenu m={m} onForward={onForward} />}
      {onReact && m.fromMe && <ReactButton m={m} onReact={onReact} />}
      <div
        className={cn(
          "max-w-[78%] rounded-2xl px-3 py-2 text-sm shadow-sm",
          m.fromMe
            ? "rounded-br-sm bg-primary text-primary-foreground"
            : "rounded-bl-sm bg-muted text-foreground",
        )}
      >
        {isTextual ? (
          <span className="whitespace-pre-wrap break-words">{m.body ?? ""}</span>
        ) : (
          <MediaBlock m={m} />
        )}
        <div className={cn("mt-1 flex items-center justify-end gap-1 text-[10px]", m.fromMe ? "text-primary-foreground/70" : "text-muted-foreground")}>
          <span>{clockTime(m.waTimestamp)}</span>
          {m.fromMe ? <Ticks status={m.status} /> : null}
        </div>
      </div>
      {onReact && !m.fromMe && <ReactButton m={m} onReact={onReact} />}
      {!m.fromMe && onForward && <MsgMenu m={m} onForward={onForward} />}
    </div>
  )
}

export function ThreadView({
  conversation,
  messages,
  loading,
  onResolveToggle,
  onReact,
  onForward,
  children,
}: {
  conversation: Conversation
  messages: InboxMessage[]
  loading: boolean
  onResolveToggle: () => void
  onReact?: (m: InboxMessage, emoji: string) => void
  onForward?: (m: InboxMessage) => void
  children: React.ReactNode // composer
}) {
  const scrollRef = React.useRef<HTMLDivElement>(null)
  const [atBottom, setAtBottom] = React.useState(true)

  // newest-last for display (API returns newest-first)
  const ordered = React.useMemo(() => [...messages].reverse(), [messages])

  React.useEffect(() => {
    if (atBottom && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [ordered.length, atBottom])

  const onScroll = () => {
    const el = scrollRef.current
    if (!el) return
    setAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 80)
  }

  const archived = !!conversation.sessionDeletedAt

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* header */}
      <div className="flex items-center justify-between gap-2 border-b px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <Avatar className="size-8 shrink-0">
            {conversation.contact.avatarUrl ? <AvatarImage src={conversation.contact.avatarUrl} alt="" /> : null}
            <AvatarFallback className="text-[10px]">{contactInitials(conversation.contact.name)}</AvatarFallback>
          </Avatar>
          <span className="truncate text-sm font-semibold text-foreground">{conversation.contact.name}</span>
          <span className="hidden text-xs text-muted-foreground sm:inline">· {conversation.sessionId}</span>
          {conversation.status === "RESOLVED" && <Badge variant="secondary" className="text-[10px]">Resolved</Badge>}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="size-8" />}>
            <MoreVertical className="size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onResolveToggle}>
              {conversation.status === "RESOLVED" ? "Reopen" : "Mark resolved"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* messages */}
      <div ref={scrollRef} onScroll={onScroll} className="relative min-h-0 flex-1 overflow-y-auto px-4 py-3">
        {loading ? (
          <div className="flex flex-col gap-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className={cn("flex", i % 2 ? "justify-end" : "justify-start")}>
                <Skeleton className="h-10 w-48 rounded-2xl" />
              </div>
            ))}
          </div>
        ) : ordered.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm text-muted-foreground">No messages in this conversation yet.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {ordered.map((m) =>
              m.type === "reaction" || m.type === "poll_vote" ? (
                <SystemLine key={m.id} m={m} />
              ) : (
                <Bubble key={m.id} m={m} onReact={onReact} onForward={onForward} />
              ),
            )}
          </div>
        )}
        {!atBottom && (
          <Button
            size="icon"
            variant="secondary"
            className="absolute bottom-3 right-4 size-9 rounded-full shadow"
            onClick={() => { setAtBottom(true) }}
          >
            <ChevronDown className="size-4" />
          </Button>
        )}
      </div>

      {/* composer / archived banner */}
      {archived ? (
        <div className="border-t bg-muted/40 px-4 py-3 text-center text-xs text-muted-foreground">
          Session deleted — this is a read-only archive.
        </div>
      ) : (
        children
      )}
    </div>
  )
}
