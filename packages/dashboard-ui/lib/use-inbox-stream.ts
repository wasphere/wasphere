"use client"

import { useEffect, useRef } from "react"

interface StreamEvent {
  type: "message.new" | "conversation.update" | "message.status"
  workspaceId: string
  conversationId?: string
  payload?: Record<string, unknown>
}

export interface InboxStreamHandlers {
  onMessageNew?: (ev: StreamEvent) => void
  onConversationUpdate?: (ev: StreamEvent) => void
  onMessageStatus?: (ev: StreamEvent) => void
  /** Called every 15s while the SSE stream is NOT connected (polling fallback). */
  onPollFallback?: () => void
  /** Connection state changes (for a UI indicator). */
  onConnectionChange?: (connected: boolean) => void
}

/**
 * Subscribes to the inbox SSE stream (`/api/inbox/stream`). EventSource handles
 * native auto-reconnect (the server sends `retry: 3000`). While the stream is
 * down (e.g. 429 cap reached), a 15s polling fallback fires so the UI stays fresh.
 */
export function useInboxStream(handlers: InboxStreamHandlers) {
  const ref = useRef(handlers)
  ref.current = handlers

  useEffect(() => {
    let connected = false
    const es = new EventSource("/api/inbox/stream")

    const parse = (e: MessageEvent): StreamEvent | null => {
      try {
        return JSON.parse(e.data) as StreamEvent
      } catch {
        return null
      }
    }

    es.addEventListener("open", () => {
      connected = true
      ref.current.onConnectionChange?.(true)
    })
    es.addEventListener("message.new", (e) => {
      const ev = parse(e as MessageEvent)
      if (ev) ref.current.onMessageNew?.(ev)
    })
    es.addEventListener("conversation.update", (e) => {
      const ev = parse(e as MessageEvent)
      if (ev) ref.current.onConversationUpdate?.(ev)
    })
    es.addEventListener("message.status", (e) => {
      const ev = parse(e as MessageEvent)
      if (ev) ref.current.onMessageStatus?.(ev)
    })
    es.addEventListener("error", () => {
      if (connected) ref.current.onConnectionChange?.(false)
      connected = false
    })

    const poll = setInterval(() => {
      if (!connected) ref.current.onPollFallback?.()
    }, 15_000)

    return () => {
      es.close()
      clearInterval(poll)
    }
  }, [])
}
