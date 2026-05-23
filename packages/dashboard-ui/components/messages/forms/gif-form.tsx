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

export function GifForm({ onSubmit, submitting }: FormProps) {
  const [url, setUrl] = React.useState("")
  const [caption, setCaption] = React.useState("")
  const [error, setError] = React.useState("")

  const fillSample = () => {
    setUrl("https://media.giphy.com/media/ZVik7pIojeZ0I/giphy.gif")
    setCaption("Sample GIF")
    setError("")
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!url.trim()) { setError("GIF URL or file is required."); return }
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
      <p className="text-xs text-muted-foreground -mt-2">MP4 recommended for best compatibility</p>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="gif-caption">
          Caption <span className="text-muted-foreground font-normal">(optional)</span>
        </Label>
        <Textarea id="gif-caption" placeholder="Caption…" value={caption}
          onChange={(e) => setCaption(e.target.value)} rows={2} />
      </div>
      <Button type="submit" disabled={submitting} className="w-fit">
        {submitting ? "Sending…" : "Send Message"}
      </Button>
    </form>
  )
}
