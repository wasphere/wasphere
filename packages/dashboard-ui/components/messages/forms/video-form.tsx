"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { MediaInput } from "@/components/messages/media-input"

interface FormProps {
  onSubmit: (body: Record<string, unknown>) => Promise<void>
  submitting: boolean
}

export function VideoForm({ onSubmit, submitting }: FormProps) {
  const [url, setUrl] = React.useState("")
  const [caption, setCaption] = React.useState("")
  const [error, setError] = React.useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!url.trim()) { setError("Video URL or file is required."); return }
    setError("")
    const body: Record<string, unknown> = { url: url.trim() }
    if (caption.trim()) body.caption = caption.trim()
    await onSubmit(body)
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <MediaInput
        id="video-url" label="Video" value={url} onChange={setUrl}
        accept="video/mp4,video/3gpp,video/quicktime"
        urlPlaceholder="https://example.com/video.mp4" error={error}
      />
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="video-caption">
          Caption <span className="text-muted-foreground font-normal">(optional)</span>
        </Label>
        <Textarea id="video-caption" placeholder="Video caption…" value={caption}
          onChange={(e) => setCaption(e.target.value)} rows={2} />
      </div>
      <Button type="submit" disabled={submitting} className="w-fit">
        {submitting ? "Sending…" : "Send Message"}
      </Button>
    </form>
  )
}
