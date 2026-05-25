"use client"

import * as React from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export interface WebhooksFormProps {
  initialUrl: string | null
}

export function WebhooksForm({ initialUrl }: WebhooksFormProps) {
  const [url, setUrl] = React.useState(initialUrl ?? "")
  const [error, setError] = React.useState<string | null>(null)
  const [submitting, setSubmitting] = React.useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)

    try {
      const res = await fetch("/api/webhooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      })

      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        if (res.status === 400) {
          const msg: string = Array.isArray(data.message)
            ? data.message.join(" ")
            : (data.message ?? "")
          if (msg.toLowerCase().includes("host") || msg.toLowerCase().includes("whitelist")) {
            setError(
              "In development mode, only localhost URLs are accepted (e.g. http://localhost:3000/webhook)."
            )
          } else {
            setError(msg || "Invalid request.")
          }
          return
        }
        setError(data.message ?? "Failed to save webhook URL.")
        return
      }

      toast.success("Webhook URL saved.")
    } catch {
      setError("Could not reach the server.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="callback-url" className="text-sm font-medium text-foreground">Callback URL</Label>
        <Input
          id="callback-url"
          type="url"
          placeholder="https://your-server.com/webhook"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          required
          className="placeholder:text-zinc-400 placeholder:font-light"
        />
        <p className="text-xs text-zinc-400 font-light">
          In development mode the WA Server only accepts{" "}
          <code>localhost</code> / <code>127.0.0.1</code> URLs. Set{" "}
          <code>NODE_ENV=production</code> on the WA Server to allow external
          URLs.
        </p>
        {error && (
          <p className="text-xs text-destructive">{error}</p>
        )}
      </div>

      <div>
        <Button type="submit" disabled={submitting}>
          {submitting ? "Saving…" : "Save"}
        </Button>
      </div>
    </form>
  )
}
