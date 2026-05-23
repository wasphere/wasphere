"use client"

import * as React from "react"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Switch } from "@/components/ui/switch"
import type { Webhook } from "@/components/webhooks/webhooks-tab"

const EVENT_GROUPS = [
  {
    label: "Messages",
    events: ["message.sent", "message.delivered", "message.read", "message.failed", "message.received"],
  },
  {
    label: "Sessions",
    events: ["session.connected", "session.disconnected", "session.qr", "session.failed"],
  },
  {
    label: "System",
    events: ["webhook.test"],
  },
] as const

const ALL_EVENTS = EVENT_GROUPS.flatMap((g) => g.events)

export interface WebhookEditDialogProps {
  webhook: Webhook | null
  open: boolean
  onClose: () => void
  onUpdated: (webhook: Webhook) => void
}

export function WebhookEditDialog({ webhook, open, onClose, onUpdated }: WebhookEditDialogProps) {
  const [name, setName] = React.useState("")
  const [url, setUrl] = React.useState("")
  const [urlError, setUrlError] = React.useState<string | null>(null)
  const [selectedEvents, setSelectedEvents] = React.useState<string[]>([])
  const [wildcard, setWildcard] = React.useState(false)
  const [isActive, setIsActive] = React.useState(true)
  const [submitting, setSubmitting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!webhook) return
    setName(webhook.name)
    setUrl(webhook.url)
    setUrlError(null)
    setIsActive(webhook.isActive)
    setError(null)
    if (webhook.events.length === 1 && webhook.events[0] === "*") {
      setWildcard(true)
      setSelectedEvents([...ALL_EVENTS])
    } else {
      setWildcard(false)
      setSelectedEvents(webhook.events)
    }
  }, [webhook])

  const validateUrl = (val: string) => {
    if (!val) { setUrlError(null); return }
    try {
      const parsed = new URL(val)
      setUrlError(parsed.protocol !== "https:" ? "URL must use HTTPS." : null)
    } catch {
      setUrlError("Enter a valid URL.")
    }
  }

  const toggleEvent = (ev: string) =>
    setSelectedEvents((prev) => prev.includes(ev) ? prev.filter((e) => e !== ev) : [...prev, ev])

  const handleWildcard = (checked: boolean) => {
    setWildcard(checked)
    setSelectedEvents(checked ? [...ALL_EVENTS] : [])
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!webhook) return
    setError(null)
    if (urlError) return
    const events = wildcard ? ["*"] : selectedEvents
    if (events.length === 0) { setError("Select at least one event."); return }

    setSubmitting(true)
    try {
      const res = await fetch(`/api/webhooks/${webhook.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), url, events, isActive }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        const msg = Array.isArray(data.message) ? data.message.join("\n") : (data.message ?? "Failed to update webhook.")
        setError(msg); return
      }
      onUpdated(data as Webhook)
      onClose()
    } catch {
      setError("Could not reach the server.")
    } finally {
      setSubmitting(false)
    }
  }

  if (!webhook) return null

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent showCloseButton className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Webhook</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Name */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-wh-name" className="text-sm font-medium text-foreground">Name</Label>
            <Input
              id="edit-wh-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={64}
              required
              className="placeholder:text-zinc-400 placeholder:font-light"
            />
          </div>

          {/* URL */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-wh-url" className="text-sm font-medium text-foreground">URL</Label>
            <Input
              id="edit-wh-url"
              value={url}
              onChange={(e) => { setUrl(e.target.value); validateUrl(e.target.value) }}
              required
              className="placeholder:text-zinc-400 placeholder:font-light"
            />
            {urlError && <p className="text-xs text-destructive">{urlError}</p>}
          </div>

          {/* Active toggle */}
          <div className="flex items-center justify-between">
            <Label htmlFor="edit-wh-active" className="text-sm font-medium text-foreground">Active</Label>
            <Switch id="edit-wh-active" checked={isActive} onCheckedChange={setIsActive} />
          </div>

          {/* Events */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium text-foreground">Events</Label>
              <label className="flex items-center gap-1.5 cursor-pointer select-none">
                <Checkbox checked={wildcard} onCheckedChange={(v) => handleWildcard(v === true)} />
                <span className="text-xs text-zinc-700 dark:text-zinc-300">All (*)</span>
              </label>
            </div>
            <div className="flex flex-col gap-3 rounded-lg border p-3">
              {EVENT_GROUPS.map((group) => (
                <div key={group.label} className="flex flex-col gap-1.5">
                  <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">{group.label}</p>
                  <div className="grid grid-cols-2 gap-1">
                    {group.events.map((ev) => (
                      <label key={ev} className="flex items-center gap-1.5 cursor-pointer select-none">
                        <Checkbox
                          checked={selectedEvents.includes(ev)}
                          onCheckedChange={() => toggleEvent(ev)}
                          disabled={wildcard}
                        />
                        <span className="text-xs text-zinc-700 dark:text-zinc-300 font-mono">{ev}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {error && <p className="text-xs text-destructive whitespace-pre-line">{error}</p>}

          <DialogFooter showCloseButton>
            <Button type="submit" disabled={submitting || !!urlError}>
              {submitting ? "Saving…" : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
