"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"

interface FormProps {
  onSubmit: (body: Record<string, unknown>) => Promise<void>
  submitting: boolean
  onClear?: () => void
}

export function AudioForm({ onSubmit, submitting }: FormProps) {
  const [url, setUrl] = React.useState("")
  const [isVoiceNote, setIsVoiceNote] = React.useState(false)
  const [error, setError] = React.useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!url.trim()) {
      setError("Audio URL is required.")
      return
    }
    setError("")
    const body: Record<string, unknown> = { url: url.trim(), isVoiceNote }
    await onSubmit(body)
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="audio-url">Audio URL</Label>
        <Input
          id="audio-url"
          placeholder="https://example.com/audio.mp3"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>

      <div className="flex items-center gap-3">
        <Switch
          checked={isVoiceNote}
          onCheckedChange={(v) => setIsVoiceNote(v === true)}
          id="voice-note"
        />
        <Label htmlFor="voice-note" className="cursor-pointer font-normal">
          Send as Voice Note
        </Label>
      </div>

      <Button type="submit" disabled={submitting} className="w-fit">
        {submitting ? "Sending…" : "Send Message"}
      </Button>
    </form>
  )
}
