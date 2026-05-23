"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { MediaInput } from "@/components/messages/media-input"

interface FormProps {
  onSubmit: (body: Record<string, unknown>) => Promise<void>
  submitting: boolean
}

export function AudioForm({ onSubmit, submitting }: FormProps) {
  const [url, setUrl] = React.useState("")
  const [isVoiceNote, setIsVoiceNote] = React.useState(false)
  const [error, setError] = React.useState("")

  const fillSample = () => {
    setUrl("https://www.w3schools.com/html/horse.mp3")
    setIsVoiceNote(false)
    setError("")
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!url.trim()) { setError("Audio URL or file is required."); return }
    setError("")
    await onSubmit({ url: url.trim(), isVoiceNote })
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex items-center justify-between pb-1">
        <span className="text-xs text-muted-foreground">Fill in the fields below</span>
        <Button type="button" size="xs" variant="outline" onClick={fillSample}>
          Fill Sample
        </Button>
      </div>
      <MediaInput
        id="audio-url" label="Audio" value={url} onChange={setUrl}
        accept="audio/mpeg,audio/ogg,audio/wav,audio/aac,audio/mp4"
        urlPlaceholder="https://example.com/audio.mp3" error={error}
      />
      <div className="flex items-center gap-3">
        <Switch checked={isVoiceNote} onCheckedChange={(v) => setIsVoiceNote(v === true)} id="voice-note" />
        <Label htmlFor="voice-note" className="cursor-pointer font-normal">Send as Voice Note</Label>
      </div>
      <Button type="submit" disabled={submitting} className="w-fit">
        {submitting ? "Sending…" : "Send Message"}
      </Button>
    </form>
  )
}
