"use client"

import * as React from "react"
import { toast } from "sonner"
import { Pencil, Trash2, Zap, X, CheckCircle2, XCircle, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { EmptyState } from "@/components/ui/empty-state"
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip"
import { WebhookAddDialog } from "@/components/webhooks/webhook-add-dialog"
import { WebhookEditDialog } from "@/components/webhooks/webhook-edit-dialog"

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Webhook {
  id: string
  name: string
  url: string
  events: string[]
  isActive: boolean
  failureCount: number
  retryMax: number
  lastDeliveryAt: string | null
  createdAt: string
}

type TestResult = { success: boolean; statusCode: number; error?: string }
type TestState = "loading" | TestResult

// ─── Helpers ─────────────────────────────────────────────────────────────────

const EVENT_LABELS: Record<string, string> = {
  "message.sent": "Message Sent",
  "message.delivered": "Message Delivered",
  "message.read": "Message Read",
  "message.failed": "Message Failed",
  "message.received": "Message Received",
  "session.connected": "Session Connected",
  "session.disconnected": "Session Disconnected",
  "session.qr": "Session QR Code",
  "session.failed": "Session Failed",
  "webhook.test": "Test Event",
}

function eventLabel(ev: string): string {
  return EVENT_LABELS[ev] ?? ev.replace(/[._]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—"
  try { return new Date(iso).toLocaleString() } catch { return iso }
}

function truncateUrl(url: string, max = 40): string {
  return url.length > max ? url.slice(0, max) + "…" : url
}

function EventChips({ events }: { events: string[] }) {
  if (events.length === 1 && events[0] === "*")
    return <Badge variant="secondary" className="text-xs">All Events</Badge>
  const visible = events.slice(0, 2)
  const rest = events.length - visible.length
  return (
    <div className="flex flex-wrap gap-1">
      {visible.map((e) => <Badge key={e} variant="outline" className="text-xs">{eventLabel(e)}</Badge>)}
      {rest > 0 && <Badge variant="outline" className="text-xs">+{rest} more</Badge>}
    </div>
  )
}

function TableSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="h-12 w-full animate-pulse rounded-md bg-muted" />
      ))}
    </div>
  )
}

// ─── Test fire result panel ───────────────────────────────────────────────────

function TestResultPanel({ result, onDismiss }: { result: TestState; onDismiss: () => void }) {
  React.useEffect(() => {
    if (result === "loading") return
    const t = setTimeout(onDismiss, 30_000)
    return () => clearTimeout(t)
  }, [result, onDismiss])

  if (result === "loading") {
    return (
      <div className="flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
        <Loader2 className="size-3.5 animate-spin" />
        <span>Sending test event…</span>
      </div>
    )
  }

  const is2xx = result.statusCode >= 200 && result.statusCode < 300
  return (
    <div className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs ${
      result.success
        ? "border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/30"
        : "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/30"
    }`}>
      {result.success
        ? <CheckCircle2 className="size-3.5 shrink-0 text-green-600 dark:text-green-400" />
        : <XCircle className="size-3.5 shrink-0 text-red-600 dark:text-red-400" />}
      <span className={`font-mono font-semibold ${is2xx ? "text-green-700 dark:text-green-300" : "text-red-700 dark:text-red-300"}`}>
        {result.statusCode}
      </span>
      <span className="text-zinc-600 dark:text-zinc-400">
        {result.success ? "Test delivered successfully." : (result.error ?? "Delivery failed.")}
      </span>
      <button onClick={onDismiss} className="ml-auto text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200">
        <X className="size-3" />
      </button>
    </div>
  )
}

// ─── Delete confirm ───────────────────────────────────────────────────────────

function DeleteConfirmDialog({
  webhook, open, onClose, onDeleted,
}: {
  webhook: Webhook | null; open: boolean; onClose: () => void; onDeleted: (id: string) => void
}) {
  const [submitting, setSubmitting] = React.useState(false)

  const handleDelete = async () => {
    if (!webhook) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/webhooks/${webhook.id}`, { method: "DELETE" })
      if (!res.ok) { const d = await res.json().catch(() => ({})); toast.error(d.message ?? "Delete failed."); return }
      onDeleted(webhook.id); onClose()
    } catch { toast.error("Could not reach the server.") }
    finally { setSubmitting(false) }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent showCloseButton>
        <DialogHeader><DialogTitle>Delete Webhook</DialogTitle></DialogHeader>
        <p className="text-sm text-zinc-700 dark:text-zinc-300">
          Permanently delete <span className="font-medium text-foreground">{webhook?.name}</span>?
          This cannot be undone.
        </p>
        <DialogFooter showCloseButton>
          <Button variant="destructive" onClick={handleDelete} disabled={submitting}>
            {submitting ? "Deleting…" : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Main tab ─────────────────────────────────────────────────────────────────

export function WebhooksTab() {
  const [webhooks, setWebhooks] = React.useState<Webhook[]>([])
  const [loading, setLoading] = React.useState(true)
  const [fetchError, setFetchError] = React.useState<string | null>(null)
  const [addOpen, setAddOpen] = React.useState(false)
  const [editTarget, setEditTarget] = React.useState<Webhook | null>(null)
  const [deleteTarget, setDeleteTarget] = React.useState<Webhook | null>(null)
  const [testResults, setTestResults] = React.useState<Record<string, TestState>>({})

  const fetchWebhooks = React.useCallback(async () => {
    setLoading(true); setFetchError(null)
    try {
      const res = await fetch("/api/webhooks")
      if (!res.ok) { setFetchError("Could not load webhooks."); return }
      const data = await res.json()
      setWebhooks(Array.isArray(data) ? data : [])
    } catch { setFetchError("Could not load webhooks.") }
    finally { setLoading(false) }
  }, [])

  React.useEffect(() => { fetchWebhooks() }, [fetchWebhooks])

  const handleTestFire = async (webhook: Webhook) => {
    setTestResults((prev) => ({ ...prev, [webhook.id]: "loading" }))
    try {
      const res = await fetch(`/api/webhooks/${webhook.id}/test`, { method: "POST" })
      const data = await res.json().catch(() => ({ success: false, statusCode: 0, error: "No response" }))
      setTestResults((prev) => ({ ...prev, [webhook.id]: data as TestResult }))
    } catch {
      setTestResults((prev) => ({ ...prev, [webhook.id]: { success: false, statusCode: 0, error: "Network error" } }))
    }
  }

  const dismissTest = (id: string) =>
    setTestResults((prev) => { const n = { ...prev }; delete n[id]; return n })

  return (
    <TooltipProvider>
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-zinc-700 dark:text-zinc-300">
            {webhooks.length > 0 ? `${webhooks.length} webhook${webhooks.length !== 1 ? "s" : ""}` : ""}
          </p>
          <Button size="sm" onClick={() => setAddOpen(true)}>Add Webhook</Button>
        </div>

        {loading ? (
          <TableSkeleton />
        ) : fetchError ? (
          <p className="text-sm text-destructive">{fetchError}</p>
        ) : webhooks.length === 0 ? (
          <EmptyState
            message="No webhooks yet."
            description="Add one to start receiving WhatsApp events at your endpoint."
          />
        ) : (
          <div className="flex flex-col gap-2">
            <div className="rounded-xl border bg-card overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Name</TableHead>
                    <TableHead className="text-xs font-medium text-zinc-500 uppercase tracking-wider">URL</TableHead>
                    <TableHead className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Events</TableHead>
                    <TableHead className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Status</TableHead>
                    <TableHead className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Last Delivered</TableHead>
                    <TableHead className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Created</TableHead>
                    <TableHead className="text-right text-xs font-medium text-zinc-500 uppercase tracking-wider">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {webhooks.map((wh) => (
                    <TableRow key={wh.id} className="hover:bg-muted/40 transition-colors">
                      <TableCell className="text-sm font-medium text-foreground">{wh.name}</TableCell>
                      <TableCell className="font-mono text-xs text-zinc-700 dark:text-zinc-300 max-w-[180px]">
                        <Tooltip>
                          <TooltipTrigger>
                            <span className="cursor-default">{truncateUrl(wh.url)}</span>
                          </TooltipTrigger>
                          <TooltipContent className="font-mono text-xs max-w-xs break-all">{wh.url}</TooltipContent>
                        </Tooltip>
                      </TableCell>
                      <TableCell><EventChips events={wh.events} /></TableCell>
                      <TableCell>
                        <Badge
                          variant={wh.isActive ? "secondary" : "outline"}
                          className={wh.isActive
                            ? "bg-green-500/10 text-green-700 dark:text-green-400 border-transparent"
                            : "text-zinc-500 border-zinc-200 dark:border-zinc-700"}
                        >
                          {wh.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-zinc-400 font-light tabular-nums">{formatDate(wh.lastDeliveryAt)}</TableCell>
                      <TableCell className="text-xs text-zinc-400 font-light tabular-nums">{formatDate(wh.createdAt)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Tooltip>
                            <TooltipTrigger>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleTestFire(wh)}
                                aria-label="Test fire"
                                disabled={testResults[wh.id] === "loading"}
                              >
                                <Zap className="size-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Send test event</TooltipContent>
                          </Tooltip>
                          <Button variant="ghost" size="icon" onClick={() => setEditTarget(wh)} aria-label="Edit">
                            <Pencil className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeleteTarget(wh)}
                            aria-label="Delete"
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Test fire result panels */}
            {Object.entries(testResults).map(([id, result]) => {
              const wh = webhooks.find((w) => w.id === id)
              if (!wh) return null
              return (
                <div key={id} className="flex flex-col gap-1">
                  <p className="text-xs text-zinc-500 font-medium">{wh.name}</p>
                  <TestResultPanel result={result} onDismiss={() => dismissTest(id)} />
                </div>
              )
            })}
          </div>
        )}

        <WebhookAddDialog
          open={addOpen}
          onClose={() => setAddOpen(false)}
          onCreated={(wh) => setWebhooks((prev) => [wh, ...prev])}
        />
        <WebhookEditDialog
          webhook={editTarget}
          open={editTarget !== null}
          onClose={() => setEditTarget(null)}
          onUpdated={(updated) => setWebhooks((prev) => prev.map((w) => w.id === updated.id ? updated : w))}
        />
        <DeleteConfirmDialog
          webhook={deleteTarget}
          open={deleteTarget !== null}
          onClose={() => setDeleteTarget(null)}
          onDeleted={(id) => setWebhooks((prev) => prev.filter((w) => w.id !== id))}
        />
      </div>
    </TooltipProvider>
  )
}
