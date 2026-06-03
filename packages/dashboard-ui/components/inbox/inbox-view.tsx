"use client"

import * as React from "react"
import { toast } from "sonner"
import { Bell, BellOff, Inbox as InboxIcon, PanelRight, ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { StatusDot } from "@/components/ui/status-dot"
import { cn } from "@/lib/utils"
import { useInboxStream } from "@/lib/use-inbox-stream"
import { ConversationList } from "./conversation-list"
import { ThreadView } from "./thread-view"
import { Composer } from "./composer"
import { ContactPanel } from "./contact-panel"
import type { Conversation, ConversationStatus, InboxMessage, Paginated } from "./types"

const SOUND_KEY = "wasphere.inbox.soundEnabled"

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

  const selectedId = selected?.id ?? null
  const selectedIdRef = React.useRef<string | null>(null)
  selectedIdRef.current = selectedId

  React.useEffect(() => {
    setSound(localStorage.getItem(SOUND_KEY) !== "false")
  }, [])

  const refreshList = React.useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setListLoading(true)
    const qs = new URLSearchParams({ status: statusTab, limit: "50" })
    if (search.trim()) qs.set("q", search.trim())
    try {
      const res = await fetch(`/api/inbox/conversations?${qs}`)
      const data = (await res.json()) as Paginated<Conversation>
      setConversations(data.items ?? [])
    } catch { /* keep current */ }
    finally { setListLoading(false) }
  }, [statusTab, search])

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
      } else if (sound && document.visibilityState !== "visible") {
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

  const sendReply = async (text: string): Promise<boolean> => {
    if (!selected) return false
    setSending(true)
    try {
      const res = await fetch(`/api/inbox/conversations/${selected.id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
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
          <Button variant="ghost" size="icon" className="size-8" onClick={toggleSound} title={sound ? "Mute notifications" : "Unmute notifications"}>
            {sound ? <Bell className="size-4" /> : <BellOff className="size-4" />}
          </Button>
          {selected && (
            <Button variant="ghost" size="icon" className="hidden size-8 lg:inline-flex" onClick={() => setShowContact((v) => !v)} title="Toggle contact panel">
              <PanelRight className="size-4" />
            </Button>
          )}
        </div>
      </div>

      {/* panes */}
      <div className="flex min-h-0 flex-1 overflow-hidden rounded-lg border bg-card">
        {/* list */}
        <div className={cn("min-w-0 flex-col border-r md:flex md:w-80 md:shrink-0", selected ? "hidden md:flex" : "flex flex-1")}>
          <ConversationList
            conversations={conversations}
            selectedId={selectedId}
            onSelect={openConversation}
            search={search}
            onSearch={setSearch}
            statusTab={statusTab}
            onStatusTab={setStatusTab}
            loading={listLoading}
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
            >
              <>
                <div className="flex items-center gap-1 border-t px-2 py-1 md:hidden">
                  <Button variant="ghost" size="sm" onClick={() => setSelected(null)}>
                    <ArrowLeft className="mr-1 size-4" /> Back
                  </Button>
                </div>
                <Composer onSend={sendReply} sending={sending} sessionOffline={!!selected.sessionDeletedAt} />
              </>
            </ThreadView>
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-muted-foreground">
              <InboxIcon className="size-10 opacity-40" />
              <p className="text-sm">Select a conversation to start chatting</p>
            </div>
          )}
        </div>

        {/* contact panel (desktop) */}
        {selected && showContact && (
          <div className="hidden w-72 shrink-0 border-l lg:flex">
            <ContactPanel conversation={selected} recent={messages} />
          </div>
        )}
      </div>
    </div>
  )
}
