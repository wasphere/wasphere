"use client"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { clockTime } from "./relative-time"
import type { Conversation, InboxMessage } from "./types"

function initials(name: string): string {
  const parts = name.trim().split(/\s+/)
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : parts[0]?.[1] ?? "")).toUpperCase()
}

export function ContactPanel({
  conversation,
  recent,
}: {
  conversation: Conversation
  recent: InboxMessage[]
}) {
  const c = conversation.contact
  return (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto p-4">
      <div className="flex flex-col items-center gap-2 text-center">
        <Avatar className="size-16">
          {c.avatarUrl ? <AvatarImage src={c.avatarUrl} alt="" /> : null}
          <AvatarFallback>{initials(c.name)}</AvatarFallback>
        </Avatar>
        <div>
          <div className="text-sm font-semibold text-foreground">{c.name}</div>
          <div className="text-xs text-muted-foreground">+{c.phone}</div>
        </div>
      </div>

      <Separator className="my-4" />

      <div className="flex flex-col gap-1.5">
        <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Tags</span>
        {conversation.tags.length ? (
          <div className="flex flex-wrap gap-1.5">
            {conversation.tags.map((t) => (
              <Badge key={t} variant="secondary" className="text-[10px]">{t}</Badge>
            ))}
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">No tags</span>
        )}
      </div>

      <Separator className="my-4" />

      <div className="flex flex-col gap-2">
        <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Recent activity</span>
        {recent.length === 0 ? (
          <span className="text-xs text-muted-foreground">No messages yet</span>
        ) : (
          <ul className="flex flex-col gap-2">
            {recent.slice(0, 8).map((m) => (
              <li key={m.id} className="flex items-start gap-2 text-xs">
                <span className="mt-0.5 shrink-0 text-muted-foreground">{m.fromMe ? "↗" : "↘"}</span>
                <span className="line-clamp-2 flex-1 text-foreground/80">{m.body ?? `[${m.type}]`}</span>
                <span className="shrink-0 text-[10px] text-muted-foreground">{clockTime(m.waTimestamp)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Separator className="my-4" />
      <p className="text-[11px] leading-relaxed text-muted-foreground">
        A unified <span className="font-medium">Customer view</span> — all conversations for this number across
        your sessions — is coming in a future release.
      </p>
    </div>
  )
}
