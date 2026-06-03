"use client"

import * as React from "react"
import { Paperclip, SendHorizonal, MessageSquareText } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { StatusDot } from "@/components/ui/status-dot"

const SAVED_REPLIES = [
  "Thanks for reaching out! How can I help?",
  "Your order is confirmed and will ship soon. 📦",
  "Could you share your order number, please?",
  "We're closed right now — we'll reply first thing tomorrow.",
]

export function Composer({
  onSend,
  sending,
  sessionOffline,
}: {
  onSend: (text: string) => Promise<boolean>
  sending: boolean
  sessionOffline: boolean
}) {
  const [text, setText] = React.useState("")

  const submit = async () => {
    const value = text.trim()
    if (!value || sending || sessionOffline) return
    const ok = await onSend(value)
    if (ok) setText("")
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      void submit()
    }
  }

  return (
    <div className="border-t p-3">
      {sessionOffline && (
        <div className="mb-2 flex items-center gap-1.5 text-xs text-muted-foreground">
          <StatusDot status="disconnected" />
          Session disconnected — reconnect to send.
        </div>
      )}
      <div className="flex items-end gap-2">
        <Tooltip>
          <TooltipTrigger render={<Button variant="ghost" size="icon" className="size-9 shrink-0" disabled />}>
            <Paperclip className="size-4" />
          </TooltipTrigger>
          <TooltipContent>Image / document attachments — coming soon</TooltipContent>
        </Tooltip>

        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="size-9 shrink-0" disabled={sessionOffline} />}>
            <MessageSquareText className="size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-72">
            <DropdownMenuLabel>Saved replies</DropdownMenuLabel>
            {SAVED_REPLIES.map((r) => (
              <DropdownMenuItem key={r} onClick={() => setText((t) => (t ? `${t} ${r}` : r))} className="whitespace-normal text-xs">
                {r}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={sessionOffline ? "Session offline…" : "Type a reply…  (Enter to send, Shift+Enter for newline)"}
          disabled={sessionOffline}
          rows={1}
          className="max-h-32 min-h-9 resize-none py-2"
        />

        <Button onClick={() => void submit()} size="icon" className="size-9 shrink-0" disabled={!text.trim() || sending || sessionOffline}>
          <SendHorizonal className="size-4" />
        </Button>
      </div>
    </div>
  )
}
