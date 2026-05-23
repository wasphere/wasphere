"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface FormProps {
  onSubmit: (body: Record<string, unknown>) => Promise<void>
  submitting: boolean
  onClear?: () => void
}

export function ReactionForm({ onSubmit, submitting }: FormProps) {
  const [messageId, setMessageId] = React.useState("")
  const [emoji, setEmoji] = React.useState("")
  const [error, setError] = React.useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!messageId.trim()) {
      setError("Message ID is required.")
      return
    }
    setError("")
    await onSubmit({
      messageId: messageId.trim(),
      emoji: emoji,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="reaction-msgid">Message ID</Label>
        <Input
          id="reaction-msgid"
          placeholder="3EB0..."
          value={messageId}
          onChange={(e) => setMessageId(e.target.value)}
        />
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="reaction-emoji">Emoji</Label>
        <Input
          id="reaction-emoji"
          placeholder="👍"
          value={emoji}
          onChange={(e) => setEmoji(e.target.value)}
          maxLength={8}
          className="w-24"
        />
        <p className="text-xs text-muted-foreground">
          Empty string removes the reaction
        </p>
      </div>

      <Button type="submit" disabled={submitting} className="w-fit">
        {submitting ? "Sending…" : "Send Message"}
      </Button>
    </form>
  )
}
