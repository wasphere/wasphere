"use client"

import * as React from "react"
import { X, FileText, BellOff } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
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

function NotesEditor({ value, onSave }: { value: string; onSave: (notes: string) => void }) {
  const [draft, setDraft] = React.useState(value)
  React.useEffect(() => { setDraft(value) }, [value])
  return (
    <Textarea
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => { if (draft !== value) onSave(draft) }}
      placeholder="Add notes about this customer…"
      maxLength={2000}
      rows={3}
      className="resize-none text-xs"
    />
  )
}

function Section({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border bg-card p-3 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{title}</span>
        {action}
      </div>
      {children}
    </div>
  )
}

export function ContactPanel({
  conversation,
  recent,
  onTagsChange,
  onNotesChange,
  muted,
  onToggleMute,
}: {
  conversation: Conversation
  recent: InboxMessage[]
  onTagsChange?: (tags: string[]) => void
  onNotesChange?: (notes: string) => void
  muted?: boolean
  onToggleMute?: (muted: boolean) => void
}) {
  const c = conversation.contact
  const images = recent.filter((m) => (m.type === "image" || m.type === "sticker") && m.mediaUrl)
  const docs = recent.filter((m) => m.type === "document")
  const mediaCount = images.length + docs.length

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

      {/* notes */}
      {onNotesChange && (
        <Section title="Notes">
          <NotesEditor value={conversation.notes ?? ""} onSave={onNotesChange} />
        </Section>
      )}

      {/* tags */}
      <Section title="Tags">
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
      </Section>

      {/* media & docs */}
      <Section title="Media & docs" action={<span className="text-[11px] text-muted-foreground">{mediaCount}</span>}>
        {mediaCount === 0 ? (
          <span className="text-xs text-muted-foreground">No media yet</span>
        ) : (
          <div className="flex flex-col gap-2">
            {images.length > 0 && (
              <div className="grid grid-cols-3 gap-1.5">
                {images.slice(0, 6).map((m) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={m.id} src={m.mediaUrl!} alt="" className="aspect-square w-full rounded-md object-cover" />
                ))}
              </div>
            )}
            {docs.slice(0, 4).map((m) => {
              const p = (m.payload ?? {}) as Record<string, unknown>
              return (
                <div key={m.id} className="flex items-center gap-2 text-xs">
                  <FileText className="size-3.5 shrink-0 text-muted-foreground" />
                  <span className="truncate">{(p.fileName as string) || m.body || "Document"}</span>
                </div>
              )
            })}
          </div>
        )}
      </Section>

      {/* mute */}
      {onToggleMute && (
        <div className="flex items-center justify-between rounded-xl border bg-card p-3 shadow-sm">
          <span className="flex items-center gap-2 text-sm text-foreground">
            <BellOff className="size-4 text-muted-foreground" /> Mute notifications
          </span>
          <Switch checked={!!muted} onCheckedChange={(v) => onToggleMute(!!v)} />
        </div>
      )}

      {/* recent activity */}
      <Section title="Recent activity">
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
      </Section>

      <p className="px-1 text-[11px] leading-relaxed text-muted-foreground">
        A unified <span className="font-medium">Customer view</span> — all conversations for this number across
        your sessions — is coming in a future release.
      </p>
    </div>
  )
}
