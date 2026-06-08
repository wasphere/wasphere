"use client"

import * as React from "react"
import { toast } from "sonner"
import { Bell, BellOff, Inbox as InboxIcon, PanelRight, ArrowLeft, Lock, PenSquare } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { StatusDot } from "@/components/ui/status-dot"
import { cn } from "@/lib/utils"
import { useInboxStream } from "@/lib/use-inbox-stream"
import { ConversationList } from "./conversation-list"
import { ThreadView } from "./thread-view"
import { Composer, type ComposerCapabilities } from "./composer"
import { ContactPanel } from "./contact-panel"
import { ForwardDialog } from "./forward-dialog"
import type { Conversation, ConversationStatus, InboxMessage, OutboundReply, Paginated } from "./types"

const SOUND_KEY = "wasphere.inbox.soundEnabled"
const MUTED_KEY = "wasphere.inbox.mutedConversations"

function beep() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const ctx = new Ctx()
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.connect(g); g.connect(ctx.destination)
    o.frequency.value = 660; o.type = "sine"
    g.gain.setValueAtTime(0.0001, ctx.currentTime)
    g.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + 0.02)
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.25)
    o.start(); o.stop(ctx.currentTime + 0.26)
  } catch { /* ignore */ }
}

export function InboxView({ initialConversations }: { initialConversations: Conversation[] }) {
  const [conversations, setConversations] = React.useState<Conversation[]>(initialConversations)
  const [listLoading, setListLoading] = React.useState(false)
  const [statusTab, setStatusTab] = React.useState<ConversationStatus>("OPEN")
  const [search, setSearch] = React.useState("")
  const [selected, setSelected] = React.useState<Conversation | null>(null)
  const [messages, setMessages] = React.useState<InboxMessage[]>([])
  const [msgLoading, setMsgLoading] = React.useState(false)
  const [sending, setSending] = React.useState(false)
  const [showContact, setShowContact] = React.useState(true)
  const [connected, setConnected] = React.useState(false)
  const [sound, setSound] = React.useState(true)
  const [mutedIds, setMutedIds] = React.useState<Set<string>>(new Set())
  const [sessions, setSessions] = React.useState<string[]>([])
  const [sessionFilter, setSessionFilter] = React.useState<string>("") // "" = all sessions (universal inbox)
  const [mobileContactOpen, setMobileContactOpen] = React.useState(false)
  const [capabilities, setCapabilities] = React.useState<ComposerCapabilities>(null)
  const [provider, setProvider] = React.useState<"baileys" | "meta" | null>(null)

  // New-chat (message a number that hasn't written first)
  const [newChatOpen, setNewChatOpen] = React.useState(false)
  const [ncSession, setNcSession] = React.useState("")
  const [ncPhone, setNcPhone] = React.useState("")
  const [ncText, setNcText] = React.useState("")
  const [ncSending, setNcSending] = React.useState(false)

  const selectedId = selected?.id ?? null
  const selectedIdRef = React.useRef<string | null>(null)
  selectedIdRef.current = selectedId
  const mutedIdsRef = React.useRef(mutedIds)
  mutedIdsRef.current = mutedIds

  React.useEffect(() => {
    setSound(localStorage.getItem(SOUND_KEY) !== "false")
    try {
      const raw = localStorage.getItem(MUTED_KEY)
      if (raw) setMutedIds(new Set(JSON.parse(raw) as string[]))
    } catch { /* ignore */ }
  }, [])

  // Seed the session-filter dropdown from ALL sessions (Baileys + Meta), so it
  // shows every session even before any conversation exists on it.
  React.useEffect(() => {
    let cancelled = false
    fetch("/api/sessions")
      .then((r) => (r.ok ? r.json() : []))
      .then((data: Array<{ id: string }>) => {
        if (cancelled || !Array.isArray(data)) return
        const ids = data.map((s) => s.id).filter(Boolean)
        setSessions((prev) => [...new Set([...prev, ...ids])])
      })
      .catch(() => { /* keep conversation-derived list */ })
    return () => { cancelled = true }
  }, [])

  // Load the selected conversation's provider capabilities so the composer can
  // hide what that provider can't do (e.g. polls on Meta) and show what it can.
  const selectedSessionId = selected?.sessionId ?? null
  React.useEffect(() => {
    if (!selectedSessionId) { setCapabilities(null); setProvider(null); return }
    let cancelled = false
    fetch(`/api/sessions/${encodeURIComponent(selectedSessionId)}/capabilities`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled) return
        setCapabilities(d?.capabilities ?? null)
        setProvider(d?.provider === "meta" ? "meta" : d?.provider === "baileys" ? "baileys" : null)
      })
      .catch(() => { if (!cancelled) { setCapabilities(null); setProvider(null) } })
    return () => { cancelled = true }
  }, [selectedSessionId])

  const toggleMute = (convId: string, muted: boolean) => {
    setMutedIds((prev) => {
      const next = new Set(prev)
      if (muted) next.add(convId)
      else next.delete(convId)
      try { localStorage.setItem(MUTED_KEY, JSON.stringify([...next])) } catch { /* ignore */ }
      return next
    })
  }

  const refreshList = React.useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setListLoading(true)
    const qs = new URLSearchParams({ status: statusTab, limit: "50" })
    if (search.trim()) qs.set("q", search.trim())
    if (sessionFilter) qs.set("sessionId", sessionFilter)
    try {
      const res = await fetch(`/api/inbox/conversations?${qs}`)
      const data = (await res.json()) as Paginated<Conversation>
      setConversations(data.items ?? [])
      // keep the session-filter dropdown populated from all sessions that have
      // chats (only when viewing the universal inbox, so we never lose options).
      if (!sessionFilter && !search.trim()) {
        setSessions((prev) => {
          const ids = new Set(prev)
          for (const c of data.items ?? []) ids.add(c.sessionId)
          return [...ids]
        })
      }
    } catch { /* keep current */ }
    finally { setListLoading(false) }
  }, [statusTab, search, sessionFilter])

  // refetch list when tab or (debounced) search changes
  React.useEffect(() => {
    const t = setTimeout(() => { void refreshList() }, search ? 250 : 0)
    return () => clearTimeout(t)
  }, [refreshList, search])

  const loadMessages = React.useCallback(async (cid: string, opts?: { silent?: boolean }) => {
    if (!opts?.silent) setMsgLoading(true)
    try {
      const res = await fetch(`/api/inbox/conversations/${cid}/messages?limit=50`)
      const data = (await res.json()) as Paginated<InboxMessage>
      setMessages(data.items ?? [])
    } catch { /* */ }
    finally { setMsgLoading(false) }
  }, [])

  const openConversation = React.useCallback(async (c: Conversation) => {
    setSelected(c)
    void loadMessages(c.id)
    if (c.unreadCount > 0) {
      await fetch(`/api/inbox/conversations/${c.id}/read`, { method: "POST" }).catch(() => null)
      setConversations((prev) => prev.map((x) => (x.id === c.id ? { ...x, unreadCount: 0 } : x)))
    }
  }, [loadMessages])

  // ── realtime ──────────────────────────────────────────────────────────────
  useInboxStream({
    onConnectionChange: setConnected,
    onMessageNew: (ev) => {
      void refreshList({ silent: true })
      const activeId = selectedIdRef.current
      if (ev.conversationId === activeId) {
        void loadMessages(activeId, { silent: true })
      } else if (
        sound &&
        !mutedIdsRef.current.has(ev.conversationId ?? "") &&
        document.visibilityState !== "visible"
      ) {
        beep()
      }
    },
    onConversationUpdate: () => { void refreshList({ silent: true }) },
    onMessageStatus: () => {
      const activeId = selectedIdRef.current
      if (activeId) void loadMessages(activeId, { silent: true })
    },
    onPollFallback: () => { void refreshList({ silent: true }) },
  })

  const sendReply = async (reply: OutboundReply): Promise<boolean> => {
    if (!selected) return false
    setSending(true)
    try {
      const res = await fetch(`/api/inbox/conversations/${selected.id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(reply),
      })
      if (!res.ok) {
        toast.error(res.status === 503 ? "Session disconnected — reconnect to send." : "Could not send reply.")
        return false
      }
      await loadMessages(selected.id, { silent: true })
      void refreshList({ silent: true })
      return true
    } catch {
      toast.error("Could not send reply.")
      return false
    } finally {
      setSending(false)
    }
  }

  const openNewChat = () => {
    setNcSession((s) => s || sessionFilter || sessions[0] || "")
    setNewChatOpen(true)
  }

  // Start a chat with a number tapped from a shared contact card.
  const startChatWith = (phone: string) => {
    setNcSession((s) => s || selectedSessionId || sessions[0] || "")
    setNcPhone(phone.replace(/[^0-9]/g, ""))
    setNcText("")
    setNewChatOpen(true)
  }

  const startNewChat = async () => {
    const sessionId = ncSession || sessions[0]
    const phone = ncPhone.replace(/[^0-9]/g, "")
    const text = ncText.trim()
    if (!sessionId) { toast.error("Pick a session."); return }
    if (phone.length < 6) { toast.error("Enter a valid number with country code."); return }
    if (!text) { toast.error("Type a message."); return }
    setNcSending(true)
    try {
      const res = await fetch("/api/inbox/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, to: phone, text }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(Array.isArray(data.message) ? data.message.join("\n") : (data.message ?? "Could not start chat."))
        return
      }
      toast.success("Message sent")
      setNewChatOpen(false); setNcPhone(""); setNcText("")
      await refreshList({ silent: true })
    } catch {
      toast.error("Could not reach the server.")
    } finally {
      setNcSending(false)
    }
  }

  const [forwardMsg, setForwardMsg] = React.useState<InboxMessage | null>(null)

  const reactToMessage = (m: InboxMessage, emoji: string) => {
    void sendReply({ kind: "reaction", targetMessageId: m.waMessageId, emoji, targetFromMe: m.fromMe })
  }

  const updateNotes = async (notes: string) => {
    if (!selected) return
    setSelected((s) => (s ? { ...s, notes } : s))
    await fetch(`/api/inbox/conversations/${selected.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes }),
    }).catch(() => null)
  }

  const updateTags = async (tags: string[]) => {
    if (!selected) return
    setSelected((s) => (s ? { ...s, tags } : s))
    setConversations((prev) => prev.map((c) => (c.id === selected.id ? { ...c, tags } : c)))
    await fetch(`/api/inbox/conversations/${selected.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tags }),
    }).catch(() => null)
  }

  const toggleResolve = async () => {
    if (!selected) return
    const next: ConversationStatus = selected.status === "RESOLVED" ? "OPEN" : "RESOLVED"
    await fetch(`/api/inbox/conversations/${selected.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    }).catch(() => null)
    setSelected((s) => (s ? { ...s, status: next } : s))
    void refreshList({ silent: true })
    toast.success(next === "RESOLVED" ? "Marked resolved" : "Reopened")
  }

  const toggleSound = () => {
    setSound((s) => {
      const v = !s
      localStorage.setItem(SOUND_KEY, v ? "true" : "false")
      return v
    })
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      {/* header bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold text-foreground">Inbox</h1>
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <StatusDot status={connected ? "connected" : "connecting"} />
            {connected ? "live" : "polling"}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={openNewChat} title="Message a new number">
            <PenSquare className="size-4" /> New chat
          </Button>
          <Button variant="ghost" size="icon" className="size-8" onClick={toggleSound} title={sound ? "Mute notifications" : "Unmute notifications"}>
            {sound ? <Bell className="size-4" /> : <BellOff className="size-4" />}
          </Button>
          {selected && (
            <>
              {/* desktop: toggle the inline contact panel */}
              <Button variant="ghost" size="icon" className="hidden size-8 lg:inline-flex" onClick={() => setShowContact((v) => !v)} title="Toggle contact panel">
                <PanelRight className="size-4" />
              </Button>
              {/* mobile/tablet: open the contact panel as a slide-in sheet */}
              <Button variant="ghost" size="icon" className="size-8 lg:hidden" onClick={() => setMobileContactOpen(true)} title="Contact info">
                <PanelRight className="size-4" />
              </Button>
            </>
          )}
        </div>
      </div>

      {/* panes */}
      <div className="flex min-h-0 flex-1 overflow-hidden rounded-lg border bg-card">
        {/* list — fixed width on desktop; full-width on mobile only when no chat is open */}
        <div className={cn("min-w-0 flex-col border-r md:flex md:w-80 md:shrink-0 md:flex-none", selected ? "hidden md:flex" : "flex flex-1")}>
          <ConversationList
            conversations={conversations}
            selectedId={selectedId}
            onSelect={openConversation}
            search={search}
            onSearch={setSearch}
            statusTab={statusTab}
            onStatusTab={setStatusTab}
            loading={listLoading}
            sessions={sessions}
            sessionFilter={sessionFilter}
            onSessionFilter={setSessionFilter}
          />
        </div>

        {/* thread */}
        <div className={cn("min-w-0 flex-1 flex-col", selected ? "flex" : "hidden md:flex")}>
          {selected ? (
            <ThreadView
              conversation={selected}
              messages={messages}
              loading={msgLoading}
              onResolveToggle={toggleResolve}
              onReact={reactToMessage}
              onForward={setForwardMsg}
              onStartChat={startChatWith}
              provider={provider}
            >
              <>
                <div className="flex items-center gap-1 border-t px-2 py-1 md:hidden">
                  <Button variant="ghost" size="sm" onClick={() => setSelected(null)}>
                    <ArrowLeft className="mr-1 size-4" /> Back
                  </Button>
                </div>
                <Composer onSend={sendReply} sending={sending} sessionOffline={!!selected.sessionDeletedAt} capabilities={capabilities} sessionId={selected.sessionId} />
              </>
            </ThreadView>
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-5 bg-muted/20 px-6 text-center">
              <div className="flex size-28 items-center justify-center rounded-full bg-primary/5">
                <InboxIcon className="size-14 text-primary/40" strokeWidth={1.5} />
              </div>
              <div className="max-w-md">
                <h2 className="text-2xl font-semibold text-foreground">WaSphere Inbox</h2>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  Select a conversation to start messaging. Send and receive WhatsApp
                  texts, media, and polls — all from your dashboard, in real time.
                </p>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground/80">
                <Lock className="size-3" />
                End-to-end encrypted by WhatsApp
              </div>
            </div>
          )}
        </div>

        {/* contact panel (desktop) */}
        {selected && showContact && (
          <div className="hidden w-72 shrink-0 border-l lg:flex">
            <ContactPanel
              conversation={selected}
              recent={messages}
              onTagsChange={updateTags}
              onNotesChange={updateNotes}
              muted={mutedIds.has(selected.id)}
              onToggleMute={(v) => toggleMute(selected.id, v)}
            />
          </div>
        )}
      </div>

      <ForwardDialog
        message={forwardMsg}
        conversations={conversations}
        currentId={selectedId}
        onClose={() => setForwardMsg(null)}
      />

      {/* New chat — message a number that hasn't written first */}
      <Dialog open={newChatOpen} onOpenChange={setNewChatOpen}>
        <DialogContent showCloseButton className="sm:max-w-md">
          <DialogHeader><DialogTitle>New chat</DialogTitle></DialogHeader>
          <div className="flex flex-col gap-3">
            {sessions.length > 1 && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="nc-session">Send from</Label>
                <select
                  id="nc-session"
                  value={ncSession}
                  onChange={(e) => setNcSession(e.target.value)}
                  className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
                >
                  {sessions.map((s) => (<option key={s} value={s}>{s}</option>))}
                </select>
              </div>
            )}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="nc-phone">Phone number (with country code)</Label>
              <Input id="nc-phone" value={ncPhone} placeholder="923001234567" onChange={(e) => setNcPhone(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="nc-text">Message</Label>
              <Textarea id="nc-text" value={ncText} rows={3} maxLength={4096} placeholder="Type your first message…" onChange={(e) => setNcText(e.target.value)} />
            </div>
            <p className="text-xs text-muted-foreground">
              Note: on a Meta session, messaging a new number outside the 24-hour window requires an approved template.
            </p>
          </div>
          <DialogFooter>
            <Button onClick={() => void startNewChat()} disabled={ncSending}>
              {ncSending ? "Sending…" : "Send message"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* mobile/tablet contact panel (slide-in) */}
      <Sheet open={mobileContactOpen} onOpenChange={setMobileContactOpen}>
        <SheetContent side="right" className="w-[88%] max-w-sm gap-0 p-0 lg:hidden">
          <SheetHeader className="border-b p-3">
            <SheetTitle className="text-sm">Contact info</SheetTitle>
          </SheetHeader>
          {selected && (
            <ContactPanel
              conversation={selected}
              recent={messages}
              onTagsChange={updateTags}
              onNotesChange={updateNotes}
              muted={mutedIds.has(selected.id)}
              onToggleMute={(v) => toggleMute(selected.id, v)}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
