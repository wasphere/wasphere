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

const SESSION_ID_REGEX = /^[a-zA-Z0-9_-]{1,64}$/

interface NewSession {
  id: string
  status: string
  [key: string]: unknown
}

export interface NewSessionDialogProps {
  open: boolean
  onClose: () => void
  onCreated: (session: NewSession) => void
}

export function NewSessionDialog({
  open,
  onClose,
  onCreated,
}: NewSessionDialogProps) {
  const [sessionId, setSessionId] = React.useState("")
  const [proxy, setProxy] = React.useState("")
  const [validationError, setValidationError] = React.useState<string | null>(
    null
  )
  const [serverError, setServerError] = React.useState<string | null>(null)
  const [submitting, setSubmitting] = React.useState(false)

  const reset = () => {
    setSessionId("")
    setProxy("")
    setValidationError(null)
    setServerError(null)
    setSubmitting(false)
  }

  const handleClose = () => {
    reset()
    onClose()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setValidationError(null)
    setServerError(null)

    if (!SESSION_ID_REGEX.test(sessionId)) {
      setValidationError(
        "Session ID must be 1–64 characters: letters, numbers, hyphens, underscores."
      )
      return
    }

    setSubmitting(true)
    try {
      const body: { id: string; proxy?: string } = { id: sessionId }
      if (proxy.trim()) {
        body.proxy = proxy.trim()
      }

      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })

      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        const msg = Array.isArray(data.message)
          ? (data.message as string[]).join("\n")
          : (data.message ?? "Failed to create session.")
        setServerError(msg)
        return
      }

      reset()
      onCreated(data as NewSession)
    } catch {
      setServerError("Could not reach the server.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent showCloseButton>
        <DialogHeader>
          <DialogTitle>New Session</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="session-id">Session ID</Label>
            <Input
              id="session-id"
              placeholder="my-session-1"
              value={sessionId}
              onChange={(e) => setSessionId(e.target.value)}
              autoFocus
              required
            />
            {validationError && (
              <p className="text-xs text-destructive">{validationError}</p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="proxy-url">
              Proxy URL{" "}
              <span className="text-muted-foreground font-normal">
                (optional)
              </span>
            </Label>
            <Input
              id="proxy-url"
              placeholder="socks5://10.0.0.5:1080"
              value={proxy}
              onChange={(e) => setProxy(e.target.value)}
            />
          </div>

          {serverError && (
            <p className="text-xs text-destructive whitespace-pre-line">{serverError}</p>
          )}

          <DialogFooter showCloseButton>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Creating…" : "Create Session"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
