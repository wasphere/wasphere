"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { MediaInput } from "@/components/messages/media-input"
import { SAMPLE_STICKER_URL } from "@/lib/message-samples"

interface FormProps {
  onSubmit: (body: Record<string, unknown>) => Promise<void>
  submitting: boolean
}

export function StickerForm({ onSubmit, submitting }: FormProps) {
  const [url, setUrl] = React.useState("")
  const [error, setError] = React.useState("")

  const fillSample = () => {
    setUrl(SAMPLE_STICKER_URL)
    setError("")
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!url.trim()) { setError("Sticker URL or file is required."); return }
    setError("")
    await onSubmit({ url: url.trim() })
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
        id="sticker-url" label="Sticker" value={url} onChange={setUrl}
        accept="image/webp,image/png,image/gif"
        urlPlaceholder="https://example.com/sticker.webp" error={error}
      />
      <p className="text-xs text-muted-foreground -mt-2">Server converts to WebP automatically</p>
      <Button type="submit" disabled={submitting} className="w-full">
        {submitting ? "Sending…" : "Send Message"}
      </Button>
    </form>
  )
}
