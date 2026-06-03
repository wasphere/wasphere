"use client"

import { Search } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { EmptyState } from "@/components/ui/empty-state"
import { cn } from "@/lib/utils"
import { relativeTime } from "./relative-time"
import type { Conversation, ConversationStatus } from "./types"

function initials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export function ConversationList({
  conversations,
  selectedId,
  onSelect,
  search,
  onSearch,
  statusTab,
  onStatusTab,
  loading,
}: {
  conversations: Conversation[]
  selectedId: string | null
  onSelect: (c: Conversation) => void
  search: string
  onSearch: (v: string) => void
  statusTab: ConversationStatus
  onStatusTab: (s: ConversationStatus) => void
  loading: boolean
}) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-col gap-3 border-b p-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="Search name, phone, message…"
            className="pl-8"
          />
        </div>
        <Tabs value={statusTab} onValueChange={(v) => onStatusTab(v as ConversationStatus)}>
          <TabsList className="w-full">
            <TabsTrigger value="OPEN" className="flex-1">Open</TabsTrigger>
            <TabsTrigger value="RESOLVED" className="flex-1">Resolved</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex flex-col gap-1 p-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-2">
                <Skeleton className="size-10 shrink-0 rounded-full" />
                <div className="flex flex-1 flex-col gap-1.5">
                  <Skeleton className="h-3.5 w-28" />
                  <Skeleton className="h-3 w-40" />
                </div>
              </div>
            ))}
          </div>
        ) : conversations.length === 0 ? (
          <div className="p-6">
            <EmptyState
              message={statusTab === "OPEN" ? "No conversations yet" : "Nothing resolved"}
              description={
                statusTab === "OPEN"
                  ? "Incoming WhatsApp messages will appear here in real time."
                  : "Resolved conversations will show up here."
              }
            />
          </div>
        ) : (
          <ul className="flex flex-col">
            {conversations.map((c) => {
              const active = c.id === selectedId
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(c)}
                    className={cn(
                      "flex w-full items-center gap-3 border-b px-3 py-2.5 text-left transition-colors",
                      active ? "bg-accent" : "hover:bg-muted/60",
                    )}
                  >
                    <Avatar className="size-10 shrink-0">
                      {c.contact.avatarUrl ? <AvatarImage src={c.contact.avatarUrl} alt="" /> : null}
                      <AvatarFallback className="text-xs">{initials(c.contact.name)}</AvatarFallback>
                    </Avatar>
                    <div className="flex min-w-0 flex-1 flex-col">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-medium text-foreground">{c.contact.name}</span>
                        <span className="shrink-0 text-[11px] text-muted-foreground">{relativeTime(c.lastMessageAt)}</span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-xs text-muted-foreground">{c.lastPreview ?? "—"}</span>
                        {c.unreadCount > 0 && (
                          <Badge className="h-5 min-w-5 shrink-0 justify-center rounded-full px-1.5 text-[11px]">
                            {c.unreadCount}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
