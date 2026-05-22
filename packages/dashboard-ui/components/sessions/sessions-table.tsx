"use client"

import * as React from "react"
import { toast } from "sonner"
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
import { NewSessionDialog } from "@/components/sessions/new-session-dialog"
import { QrDialog } from "@/components/sessions/qr-dialog"

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

type BadgeVariant = "default" | "secondary" | "destructive" | "outline"

function statusVariant(status: string): BadgeVariant {
  switch (status) {
    case "connected":
      return "default"
    case "qr_ready":
    case "connecting":
      return "secondary"
    case "failed":
    case "qr_expired":
      return "destructive"
    case "disconnected":
    case "logged_out":
    default:
      return "outline"
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
  const [newDialogOpen, setNewDialogOpen] = React.useState(false)
  const [qrSessionId, setQrSessionId] = React.useState<string | null>(null)

  const refreshSessions = async () => {
    try {
      const res = await fetch("/api/sessions")
      if (!res.ok) return
      const data = await res.json()
      const list: Session[] = Array.isArray(data)
        ? data
        : (data.sessions ?? [])
      setSessions(list)
    } catch {
      // Best-effort; table keeps existing data.
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
      if (!res.ok) {
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
      // Replace if already exists (unlikely) or prepend.
      const exists = prev.some((s) => s.id === newSession.id)
      return exists
        ? prev.map((s) => (s.id === newSession.id ? newSession : s))
        : [newSession, ...prev]
    })
    setQrSessionId(newSession.id)
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Sessions</h1>
        <Button onClick={() => setNewDialogOpen(true)}>New Session</Button>
      </div>

      {sessions.length === 0 ? (
        <EmptyState
          message="No sessions yet."
          description="Create a session to connect a WhatsApp account."
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Session ID</TableHead>
              <TableHead>Phone Number</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Connected At</TableHead>
              <TableHead>Proxy</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sessions.map((session) => (
              <TableRow key={session.id}>
                <TableCell className="font-mono text-xs">{session.id}</TableCell>
                <TableCell>{session.phoneNumber ?? "—"}</TableCell>
                <TableCell>
                  <Badge variant={statusVariant(session.status)}>
                    {session.status}
                  </Badge>
                </TableCell>
                <TableCell>{formatDate(session.connectedAt)}</TableCell>
                <TableCell className="font-mono text-xs">
                  {session.proxy ?? "—"}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
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
