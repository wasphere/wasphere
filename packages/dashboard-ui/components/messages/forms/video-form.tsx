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

export function VideoForm({ onSubmit, submitting }: FormProps) {
  const [url, setUrl] = React.useState("")
  const [caption, setCaption] = React.useState("")
  const [error, setError] = React.useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!url.trim()) {
      setError("Video URL is required.")
      return
    }
    setError("")
    const body: Record<string, unknown> = { url: url.trim() }
    if (caption.trim()) body.caption = caption.trim()
    await onSubmit(body)
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="video-url">Video URL</Label>
        <Input
          id="video-url"
          placeholder="https://example.com/video.mp4"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="video-caption">
          Caption{" "}
          <span className="text-muted-foreground font-normal">(optional)</span>
        </Label>
        <Textarea
          id="video-caption"
          placeholder="Video caption…"
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          rows={2}
        />
      </div>

      <Button type="submit" disabled={submitting} className="w-fit">
        {submitting ? "Sending…" : "Send Message"}
      </Button>
    </form>
  )
}
