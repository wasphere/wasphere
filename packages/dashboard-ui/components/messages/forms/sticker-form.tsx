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

export function StickerForm({ onSubmit, submitting }: FormProps) {
  const [url, setUrl] = React.useState("")
  const [error, setError] = React.useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!url.trim()) {
      setError("Sticker URL is required.")
      return
    }
    setError("")
    await onSubmit({ url: url.trim() })
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="sticker-url">Sticker URL</Label>
        <Input
          id="sticker-url"
          placeholder="https://example.com/sticker.webp"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
        {error && <p className="text-xs text-destructive">{error}</p>}
        <p className="text-xs text-muted-foreground">
          Server converts to WebP automatically
        </p>
      </div>

      <Button type="submit" disabled={submitting} className="w-fit">
        {submitting ? "Sending…" : "Send Message"}
      </Button>
    </form>
  )
}
