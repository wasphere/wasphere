"use client"

import * as React from "react"
import { X } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { clockTime } from "./relative-time"
import type { Conversation, InboxMessage } from "./types"

function initials(name: string): string {
  const parts = name.trim().split(/\s+/)
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : parts[0]?.[1] ?? "")).toUpperCase()
}

function TagEditor({ tags, onChange }: { tags: string[]; onChange: (tags: string[]) => void }) {
  const [draft, setDraft] = React.useState("")
  const add = () => {
    const t = draft.trim().toLowerCase()
    if (!t || tags.includes(t) || tags.length >= 20) { setDraft(""); return }
    onChange([...tags, t])
    setDraft("")
  }
  return (
    <div className="flex flex-col gap-2">
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {tags.map((t) => (
            <Badge key={t} variant="secondary" className="gap-1 text-[10px]">
              {t}
              <button type="button" onClick={() => onChange(tags.filter((x) => x !== t))} className="opacity-60 hover:opacity-100" aria-label={`Remove ${t}`}>
                <X className="size-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
      <Input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add() } }}
        onBlur={add}
        placeholder="Add a tag…"
        maxLength={40}
        className="h-7 text-xs"
      />
    </div>
  )
}

export function ContactPanel({
  conversation,
  recent,
  onTagsChange,
}: {
  conversation: Conversation
  recent: InboxMessage[]
  onTagsChange?: (tags: string[]) => void
}) {
  const c = conversation.contact
  return (
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto bg-muted/30 p-3">
      {/* contact card */}
      <div className="flex flex-col items-center gap-2 rounded-xl border bg-card p-4 text-center shadow-sm">
        <Avatar className="size-16 ring-2 ring-primary/10">
          {c.avatarUrl ? <AvatarImage src={c.avatarUrl} alt="" /> : null}
          <AvatarFallback className="text-lg">{initials(c.name)}</AvatarFallback>
        </Avatar>
        <div>
          <div className="text-sm font-semibold text-foreground">{c.name}</div>
          <div className="text-xs text-muted-foreground">+{c.phone}</div>
        </div>
        <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[10px] font-medium text-primary">
          WhatsApp contact
        </span>
      </div>

      {/* tags card */}
      <div className="flex flex-col gap-2 rounded-xl border bg-card p-3 shadow-sm">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Tags</span>
        {onTagsChange ? (
          <TagEditor tags={conversation.tags} onChange={onTagsChange} />
        ) : conversation.tags.length ? (
          <div className="flex flex-wrap gap-1.5">
            {conversation.tags.map((t) => (
              <Badge key={t} variant="secondary" className="text-[10px]">{t}</Badge>
            ))}
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">No tags</span>
        )}
      </div>

      {/* recent activity card */}
      <div className="flex flex-col gap-2 rounded-xl border bg-card p-3 shadow-sm">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Recent activity</span>
        {recent.length === 0 ? (
          <span className="text-xs text-muted-foreground">No messages yet</span>
        ) : (
          <ul className="flex flex-col gap-2.5">
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

      <p className="px-1 text-[11px] leading-relaxed text-muted-foreground">
        A unified <span className="font-medium">Customer view</span> — all conversations for this number across
        your sessions — is coming in a future release.
      </p>
    </div>
  )
}
