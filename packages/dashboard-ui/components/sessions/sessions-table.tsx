"use client"

import * as React from "react"
import { toast } from "sonner"
import { Copy, Check } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { EmptyState } from "@/components/ui/empty-state"
import { ApiError } from "@/components/ui/api-error"
import { StatusDot } from "@/components/ui/status-dot"
import { SessionsIllustration } from "@/components/empty-states"
import { NewSessionDialog } from "@/components/sessions/new-session-dialog"
import { QrDialog } from "@/components/sessions/qr-dialog"

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = React.useState(false)
  const handleCopy = async () => {
    await navigator.clipboard.writeText(value).catch(() => null)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button
      onClick={handleCopy}
      className="ml-1.5 inline-flex items-center text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
      aria-label={copied ? "Copied" : "Copy session ID"}
      title={copied ? "Copied!" : "Copy session ID"}
    >
      {copied ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
    </button>
  )
}

export interface Session {
  id: string
  status: string
  phoneNumber?: string | null
  name?: string | null
  connectedAt?: string | null
  proxy?: string | null
}

interface SessionsTableProps {
  initialSessions: Session[]
}

function statusClassName(status: string): string {
  switch (status) {
    case "connected":
      return "bg-green-500/10 text-green-700 dark:text-green-400 border-transparent"
    case "qr_ready":
    case "connecting":
      return "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-transparent"
    case "failed":
    case "qr_expired":
    case "disconnected":
    case "logged_out":
    default:
      return "bg-red-500/10 text-red-700 dark:text-red-400 border-transparent"
  }
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—"
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return iso
  }
}

export function SessionsTable({ initialSessions }: SessionsTableProps) {
  const [sessions, setSessions] = React.useState<Session[]>(initialSessions)
  const [fetchError, setFetchError] = React.useState<string | null>(null)
  const [newDialogOpen, setNewDialogOpen] = React.useState(false)
  const [qrSessionId, setQrSessionId] = React.useState<string | null>(null)

  const refreshSessions = async () => {
    try {
      const res = await fetch("/api/sessions")
      if (!res.ok) {
        setFetchError("Could not load sessions. Check your connection and try again.")
        return
      }
      setFetchError(null)
      const data = await res.json()
      const list: Session[] = Array.isArray(data)
        ? data
        : (data.sessions ?? [])
      setSessions(list)
    } catch {
      setFetchError("Could not load sessions. Check your connection and try again.")
    }
  }

  const handleLogout = async (sessionId: string) => {
    try {
      const res = await fetch(`/api/sessions/${sessionId}/logout`, {
        method: "POST",
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        toast.error(body.message ?? "Logout failed.")
        return
      }
      // Refresh list to show updated status.
      await refreshSessions()
    } catch {
      toast.error("Could not reach the server.")
    }
  }

  const handleDelete = async (sessionId: string) => {
    try {
      const res = await fetch(`/api/sessions/${sessionId}`, {
        method: "DELETE",
      })
      // 404 means already gone on wa-server — treat as success
      if (!res.ok && res.status !== 404) {
        const body = await res.json().catch(() => ({}))
        toast.error(body.message ?? "Delete failed.")
        return
      }
      setSessions((prev) => prev.filter((s) => s.id !== sessionId))
    } catch {
      toast.error("Could not reach the server.")
    }
  }

  const handleSessionCreated = (newSession: Session) => {
    setSessions((prev) => {
      const exists = prev.some((s) => s.id === newSession.id)
      return exists
        ? prev.map((s) => (s.id === newSession.id ? newSession : s))
        : [newSession, ...prev]
    })
    setQrSessionId(newSession.id)
  }

  const handleRelink = async (sessionId: string) => {
    try {
      await fetch(`/api/sessions/${sessionId}`, { method: "DELETE" })
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: sessionId }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        toast.error(body.message ?? "Failed to restart session.")
        return
      }
      const updated: Session = await res.json()
      setSessions((prev) =>
        prev.map((s) => (s.id === sessionId ? { ...s, ...updated } : s))
      )
      setQrSessionId(sessionId)
    } catch {
      toast.error("Could not reach the server.")
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Sessions</h1>
        <Button onClick={() => setNewDialogOpen(true)}>New Session</Button>
      </div>

      {fetchError && (
        <ApiError
          message={fetchError}
          onRetry={() => void refreshSessions()}
        />
      )}

      {!fetchError && sessions.length === 0 ? (
        <EmptyState
          illustration={<SessionsIllustration />}
          message="No sessions yet."
          description="Create a session to connect a WhatsApp account."
        />
      ) : !fetchError && (
        <div className="rounded-xl border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Session</TableHead>
              <TableHead className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Phone</TableHead>
              <TableHead className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Status</TableHead>
              <TableHead className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Connected At</TableHead>
              <TableHead className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Proxy</TableHead>
              <TableHead className="text-right text-xs font-medium text-zinc-500 uppercase tracking-wider">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sessions.map((session) => (
              <TableRow key={session.id} className="hover:bg-muted/40 hover:-translate-y-px hover:shadow-sm transition-all duration-150 ease-out">
                <TableCell className="text-sm font-medium text-foreground font-mono">
                  <span className="flex items-center gap-0 max-w-[220px]">
                    <span className="min-w-0 truncate" title={session.id}>{session.id}</span>
                    <span className="shrink-0"><CopyButton value={session.id} /></span>
                  </span>
                </TableCell>
                <TableCell className="text-sm text-zinc-700 dark:text-zinc-300 tabular-nums">{session.phoneNumber ?? "—"}</TableCell>
                <TableCell>
                  <Badge className={`${statusClassName(session.status)} flex items-center gap-1.5`}>
                    <StatusDot status={session.status} />
                    {session.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-xs text-zinc-400 font-light tabular-nums">{formatDate(session.connectedAt)}</TableCell>
                <TableCell className="font-mono text-xs">
                  <span className="block max-w-[160px] truncate" title={session.proxy ?? undefined}>
                    {session.proxy ?? "—"}
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    {(session.status === "qr_ready" || session.status === "connecting") && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setQrSessionId(session.id)}
                      >
                        View QR
                      </Button>
                    )}
                    {(session.status === "failed" || session.status === "disconnected" || session.status === "logged_out" || session.status === "qr_expired") && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRelink(session.id)}
                      >
                        Relink
                      </Button>
                    )}
                    {session.status === "connected" && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleLogout(session.id)}
                      >
                        Logout
                      </Button>
                    )}
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDelete(session.id)}
                    >
                      Delete
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        </div>
      )}

      <NewSessionDialog
        open={newDialogOpen}
        onClose={() => setNewDialogOpen(false)}
        onCreated={(session) => {
          setNewDialogOpen(false)
          handleSessionCreated(session as Session)
        }}
      />

      {qrSessionId && (
        <QrDialog
          open={qrSessionId !== null}
          sessionId={qrSessionId}
          onClose={() => setQrSessionId(null)}
          onConnected={() => {
            setQrSessionId(null)
            refreshSessions()
          }}
        />
      )}
    </div>
  )
}
