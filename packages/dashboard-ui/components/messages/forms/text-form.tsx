"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

interface FormProps {
  onSubmit: (body: Record<string, unknown>) => Promise<void>
  submitting: boolean
  onClear?: () => void
}

const MAX_TEXT = 4096

export function TextForm({ onSubmit, submitting }: FormProps) {
  const [text, setText] = React.useState("")
  const [showReply, setShowReply] = React.useState(false)
  const [quotedId, setQuotedId] = React.useState("")
  const [error, setError] = React.useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!text.trim()) {
      setError("Message text is required.")
      return
    }
    setError("")
    const body: Record<string, unknown> = { text: text.trim() }
    if (showReply && quotedId.trim()) {
      body.quotedId = quotedId.trim()
    }
    await onSubmit(body)
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="text-body">Message</Label>
          <span className="text-xs text-muted-foreground">
            {text.length}/{MAX_TEXT}
          </span>
        </div>
        <Textarea
          id="text-body"
          placeholder="Type your message…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={MAX_TEXT}
          rows={4}
        />
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="show-reply"
          checked={showReply}
          onChange={(e) => setShowReply(e.target.checked)}
          className="size-4 rounded border-border accent-primary"
        />
        <Label htmlFor="show-reply" className="cursor-pointer font-normal">
          Reply to message
        </Label>
      </div>

      {showReply && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="quoted-id">Quoted Message ID</Label>
          <Input
            id="quoted-id"
            placeholder="Message ID to quote"
            value={quotedId}
            onChange={(e) => setQuotedId(e.target.value)}
          />
        </div>
      )}

      <Button type="submit" disabled={submitting} className="w-fit">
        {submitting ? "Sending…" : "Send Message"}
      </Button>
    </form>
  )
}
