"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { MediaInput } from "@/components/messages/media-input"
import { SAMPLE_GIF_URL } from "@/lib/message-samples"

interface FormProps {
  onSubmit: (body: Record<string, unknown>) => Promise<void>
  submitting: boolean
}

export function GifForm({ onSubmit, submitting }: FormProps) {
  const [url, setUrl] = React.useState("")
  const [caption, setCaption] = React.useState("")
  const [error, setError] = React.useState("")

  const fillSample = () => {
    setUrl(SAMPLE_GIF_URL)
    setCaption("Animated via WaSphere")
    setError("")
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!url.trim()) { setError("GIF URL or file is required."); return }
    const trimmed = url.trim()
    const isGifExt = /\.gif(\?.*)?$/i.test(trimmed.split("#")[0])
    if (isGifExt) {
      setError("Raw .gif files won't animate on WhatsApp. Use an MP4 or WebM URL. Giphy offers MP4 versions — open the GIF on giphy.com, click Share → Copy Link, and replace /giphy.gif with /giphy.mp4")
      return
    }
    setError("")
    const body: Record<string, unknown> = { url: url.trim() }
    if (caption.trim()) body.caption = caption.trim()
    await onSubmit(body)
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
        id="gif-url" label="GIF / Animation" value={url} onChange={setUrl}
        accept="video/mp4,image/gif"
        urlPlaceholder="https://example.com/animation.mp4" error={error}
      />
      <p className="text-xs text-muted-foreground -mt-2">Must be <strong>MP4 or WebM</strong> — raw .gif files will not animate on WhatsApp.</p>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="gif-caption">
          Caption <span className="text-muted-foreground font-normal">(optional)</span>
        </Label>
        <Textarea id="gif-caption" placeholder="Caption…" value={caption}
          onChange={(e) => setCaption(e.target.value)} rows={2} />
      </div>
      <Button type="submit" disabled={submitting} className="w-full">
        {submitting ? "Sending…" : "Send Message"}
      </Button>
    </form>
  )
}
