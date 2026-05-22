"use client"

import * as React from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

interface Session {
  id: string
  status: string
  qrCode?: string | null
  qrExpiresAt?: string | null
}

export interface QrDialogProps {
  open: boolean
  sessionId: string
  onClose: () => void
  onConnected: () => void
}

export function QrDialog({
  open,
  sessionId,
  onClose,
  onConnected,
}: QrDialogProps) {
  const [session, setSession] = React.useState<Session | null>(null)
  const [countdown, setCountdown] = React.useState(0)
  const [error, setError] = React.useState<string | null>(null)
  const [retrying, setRetrying] = React.useState(false)

  const intervalRef = React.useRef<ReturnType<typeof setInterval> | null>(null)
  const isFetchingRef = React.useRef(false)

  const clearPoller = () => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }

  const poll = React.useCallback(async () => {
    // Skip overlapping ticks.
    if (isFetchingRef.current) return
    isFetchingRef.current = true

    try {
      const res = await fetch(`/api/sessions/${sessionId}`)
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setError(body.message ?? "Failed to fetch session status.")
        clearPoller()
        return
      }

      const data: Session = await res.json()
      setSession(data)

      if (data.status === "qr_ready" && data.qrExpiresAt) {
        const secs = Math.max(
          0,
          Math.round(
            (new Date(data.qrExpiresAt).getTime() - Date.now()) / 1000
          )
        )
        setCountdown(secs)
      }

      if (data.status === "connected") {
        clearPoller()
        // Show success for 1.5s then close and refresh the parent list.
        setTimeout(() => {
          onConnected()
          onClose()
        }, 1500)
      }

      if (data.status === "qr_expired" || data.status === "failed") {
        clearPoller()
      }
    } catch {
      setError("Could not reach the server.")
      clearPoller()
    } finally {
      isFetchingRef.current = false
    }
  }, [sessionId, onConnected, onClose])

  // Start polling when dialog opens.
  React.useEffect(() => {
    if (!open) return

    setSession(null)
    setError(null)
    setCountdown(0)
    isFetchingRef.current = false

    // Immediate first tick.
    poll()
    intervalRef.current = setInterval(poll, 2000)

    return () => {
      clearPoller()
    }
  }, [open, poll])

  // QR expired sessions cannot be re-triggered without deletion — must DELETE + POST
  const handleRetry = async () => {
    setRetrying(true)
    setError(null)
    setSession(null)

    try {
      // Step 1: delete the expired/failed session.
      await fetch(`/api/sessions/${sessionId}`, { method: "DELETE" })

      // Step 2: recreate the session with the same ID.
      const createRes = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: sessionId }),
      })

      if (!createRes.ok) {
        const body = await createRes.json().catch(() => ({}))
        setError(body.message ?? "Failed to restart session.")
        return
      }

      // Restart the polling loop.
      isFetchingRef.current = false
      poll()
      intervalRef.current = setInterval(poll, 2000)
    } catch {
      setError("Could not reach the server.")
    } finally {
      setRetrying(false)
    }
  }

  const renderBody = () => {
    if (error) {
      return (
        <div className="flex flex-col items-center gap-4 py-4">
          <p className="text-sm text-destructive">{error}</p>
          <Button onClick={handleRetry} disabled={retrying} variant="outline">
            {retrying ? "Retrying…" : "Retry"}
          </Button>
        </div>
      )
    }

    if (!session || session.status === "connecting") {
      return (
        <div className="flex flex-col items-center gap-3 py-6">
          <div className="size-8 animate-spin rounded-full border-2 border-muted border-t-primary" />
          <p className="text-sm text-muted-foreground">
            Initialising session…
          </p>
        </div>
      )
    }

    if (session.status === "qr_ready") {
      return (
        <div className="flex flex-col items-center gap-3">
          {session.qrCode ? (
            <img
              src={session.qrCode}
              alt="Scan QR code"
              className="w-full max-w-xs mx-auto rounded-lg"
            />
          ) : (
            <div className="flex h-48 w-48 items-center justify-center rounded-lg bg-muted text-xs text-muted-foreground">
              QR loading…
            </div>
          )}
          <p className="text-sm text-muted-foreground">
            Scan with WhatsApp — expires in{" "}
            <span className="font-medium tabular-nums">{countdown}s</span>
          </p>
        </div>
      )
    }

    if (session.status === "connected") {
      return (
        <div className="flex flex-col items-center gap-2 py-6">
          <p className="text-lg font-semibold text-green-600 dark:text-green-400">
            Connected!
          </p>
          <p className="text-sm text-muted-foreground">
            Your WhatsApp account is linked.
          </p>
        </div>
      )
    }

    if (session.status === "qr_expired" || session.status === "failed") {
      return (
        <div className="flex flex-col items-center gap-4 py-4">
          <p className="text-sm text-destructive">
            {session.status === "qr_expired"
              ? "QR code expired. Please retry."
              : "Session failed. Please retry."}
          </p>
          <Button onClick={handleRetry} disabled={retrying} variant="outline">
            {retrying ? "Retrying…" : "Retry"}
          </Button>
        </div>
      )
    }

    return null
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent showCloseButton>
        <DialogHeader>
          <DialogTitle>Connect WhatsApp</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">Session: {sessionId}</p>
        {renderBody()}
      </DialogContent>
    </Dialog>
  )
}
