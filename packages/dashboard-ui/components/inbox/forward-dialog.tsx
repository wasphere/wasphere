"use client"

import * as React from "react"
import { toast } from "sonner"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Input } from "@/components/ui/input"
import type { Conversation, InboxMessage, OutboundReply } from "./types"

function initials(name: string): string {
  const parts = name.trim().split(/\s+/)
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : parts[0]?.[1] ?? "")).toUpperCase()
}

// Build a sendable reply from a message we want to forward. Returns null for
// types whose content we don't hold (e.g. inbound documents — no bytes).
function messageToReply(m: InboxMessage): OutboundReply | null {
  if (m.type === "text") return m.body ? { kind: "text", text: m.body } : null
  if ((m.type === "image" || m.type === "sticker") && m.mediaUrl)
    return { kind: "image", media: m.mediaUrl, caption: m.body ?? undefined }
  if (m.type === "poll") {
    const p = (m.payload ?? {}) as Record<string, unknown>
    const name = (p.name as string) || m.body || ""
    const options = Array.isArray(p.options) ? (p.options as string[]) : []
    return name && options.length >= 2 ? { kind: "poll", pollName: name, options } : null
  }
  return null
}

export function ForwardDialog({
  message,
  conversations,
  currentId,
  onClose,
}: {
  message: InboxMessage | null
  conversations: Conversation[]
  currentId: string | null
  onClose: () => void
}) {
  const [search, setSearch] = React.useState("")
  const [sending, setSending] = React.useState<string | null>(null)
  const reply = message ? messageToReply(message) : null

  const list = conversations.filter(
    (c) =>
      c.id !== currentId &&
      !c.sessionDeletedAt &&
      (c.contact.name.toLowerCase().includes(search.toLowerCase()) ||
        c.contact.phone.includes(search.replace(/[^0-9]/g, ""))),
  )

  const forward = async (target: Conversation) => {
    if (!reply) return
    setSending(target.id)
    try {
      const res = await fetch(`/api/inbox/conversations/${target.id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(reply),
      })
      if (res.ok) {
        toast.success(`Forwarded to ${target.contact.name}`)
        onClose()
      } else {
        toast.error(res.status === 503 ? "That session is offline." : "Couldn't forward.")
      }
    } catch {
      toast.error("Couldn't forward.")
    } finally {
      setSending(null)
    }
  }

  return (
    <Dialog open={!!message} onOpenChange={(o) => !o && onClose()}>
      <DialogContent showCloseButton className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Forward to…</DialogTitle>
        </DialogHeader>
        {!reply ? (
          <p className="py-4 text-sm text-muted-foreground">This message type can&apos;t be forwarded.</p>
        ) : (
          <div className="flex flex-col gap-2">
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search chats…" autoFocus />
            <div className="flex max-h-72 flex-col gap-0.5 overflow-y-auto">
              {list.map((c) => (
                <button
                  key={c.id}
                  disabled={!!sending}
                  onClick={() => void forward(c)}
                  className="flex items-center gap-2.5 rounded-lg p-2 text-left transition hover:bg-muted disabled:opacity-50"
                >
                  <Avatar className="size-9 shrink-0">
                    {c.contact.avatarUrl ? <AvatarImage src={c.contact.avatarUrl} alt="" /> : null}
                    <AvatarFallback className="text-xs">{initials(c.contact.name)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-foreground">{c.contact.name}</div>
                    <div className="truncate text-xs text-muted-foreground">+{c.contact.phone}</div>
                  </div>
                  {sending === c.id && <span className="text-xs text-muted-foreground">Sending…</span>}
                </button>
              ))}
              {list.length === 0 && (
                <p className="p-4 text-center text-sm text-muted-foreground">No other chats to forward to.</p>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
