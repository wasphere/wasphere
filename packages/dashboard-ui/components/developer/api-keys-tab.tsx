"use client"

import * as React from "react"
import { toast } from "sonner"
import { RotateCcw, Pencil, Trash2, Copy, Check, AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { EmptyState } from "@/components/ui/empty-state"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { ApiKeyAddDialog } from "@/components/developer/api-key-add-dialog"
import { ApiKeyEditDialog } from "@/components/developer/api-key-edit-dialog"

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ApiKey {
  id: string
  name: string
  keyPrefix: string
  permissions: string[]
  sessionId: string | null
  isActive: boolean
  lastUsedAt: string | null
  createdAt: string
  expiresAt: string | null
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—"
  try { return new Date(iso).toLocaleString() } catch { return iso }
}

function PermissionChips({ perms }: { perms: string[] }) {
  if (perms.length === 1 && perms[0] === "*")
    return <Badge variant="secondary" className="font-mono text-xs">all (*)</Badge>
  return (
    <div className="flex flex-wrap gap-1">
      {perms.map((p) => (
        <Badge key={p} variant="outline" className="font-mono text-xs">{p}</Badge>
      ))}
    </div>
  )
}

// ─── Rotate confirm dialog ────────────────────────────────────────────────────

interface RotateDialogProps {
  apiKey: ApiKey | null
  open: boolean
  onClose: () => void
  onRotated: (key: ApiKey, rawKey: string) => void
}

function RotateConfirmDialog({ apiKey, open, onClose, onRotated }: RotateDialogProps) {
  const [submitting, setSubmitting] = React.useState(false)
  const [rawKey, setRawKey] = React.useState<string | null>(null)
  const [copied, setCopied] = React.useState(false)

  const handleRotate = async () => {
    if (!apiKey) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/developer/api-keys/${apiKey.id}/rotate`, { method: "POST" })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { toast.error(data.message ?? "Rotation failed."); return }
      setRawKey(data.rawKey ?? data.key ?? null)
      onRotated(data as ApiKey, data.rawKey ?? data.key ?? "")
    } catch {
      toast.error("Could not reach the server.")
    } finally {
      setSubmitting(false)
    }
  }

  const handleCopy = async () => {
    if (!rawKey) return
    try {
      await navigator.clipboard.writeText(rawKey)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { toast.error("Failed to copy.") }
  }

  const handleClose = () => { setRawKey(null); setCopied(false); onClose() }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent showCloseButton>
        <DialogHeader>
          <DialogTitle>{rawKey ? "Key Rotated" : "Rotate API Key"}</DialogTitle>
        </DialogHeader>
        {rawKey ? (
          <div className="flex flex-col gap-4">
            <div className="flex items-start gap-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-3">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
              <p className="text-sm font-medium text-amber-700 dark:text-amber-300">
                This key will not be shown again. Copy it now.
              </p>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-sm font-medium text-foreground">New API Key</Label>
              <div className="flex items-center gap-2">
                <Input value={rawKey} readOnly className="font-mono text-xs" />
                <Button variant="outline" size="icon" onClick={handleCopy} aria-label="Copy">
                  {copied ? <Check className="size-4 text-green-600" /> : <Copy className="size-4" />}
                </Button>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleClose}>I&apos;ve saved it</Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-zinc-700 dark:text-zinc-300">
              Rotating{" "}
              <span className="font-medium text-foreground">{apiKey?.name}</span>{" "}
              will immediately invalidate the current key. Any integrations using it will stop working.
            </p>
            <DialogFooter showCloseButton>
              <Button variant="destructive" onClick={handleRotate} disabled={submitting}>
                {submitting ? "Rotating…" : "Rotate Key"}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

// ─── Delete confirm dialog ────────────────────────────────────────────────────

interface DeleteDialogProps {
  apiKey: ApiKey | null
  open: boolean
  onClose: () => void
  onDeleted: (id: string) => void
}

function DeleteConfirmDialog({ apiKey, open, onClose, onDeleted }: DeleteDialogProps) {
  const [submitting, setSubmitting] = React.useState(false)

  const handleDelete = async () => {
    if (!apiKey) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/developer/api-keys/${apiKey.id}`, { method: "DELETE" })
      if (!res.ok) { const d = await res.json().catch(() => ({})); toast.error(d.message ?? "Delete failed."); return }
      onDeleted(apiKey.id)
      onClose()
    } catch {
      toast.error("Could not reach the server.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent showCloseButton>
        <DialogHeader>
          <DialogTitle>Delete API Key</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-zinc-700 dark:text-zinc-300">
          Permanently delete{" "}
          <span className="font-medium text-foreground">{apiKey?.name}</span>?
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

// ─── Table skeleton ───────────────────────────────────────────────────────────

function TableSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="h-12 w-full animate-pulse rounded-md bg-muted" />
      ))}
    </div>
  )
}

// ─── API Keys Tab ─────────────────────────────────────────────────────────────

export function ApiKeysTab() {
  const [keys, setKeys] = React.useState<ApiKey[]>([])
  const [loading, setLoading] = React.useState(true)
  const [fetchError, setFetchError] = React.useState<string | null>(null)
  const [addOpen, setAddOpen] = React.useState(false)
  const [editTarget, setEditTarget] = React.useState<ApiKey | null>(null)
  const [rotateTarget, setRotateTarget] = React.useState<ApiKey | null>(null)
  const [deleteTarget, setDeleteTarget] = React.useState<ApiKey | null>(null)

  const fetchKeys = React.useCallback(async () => {
    setLoading(true)
    setFetchError(null)
    try {
      const res = await fetch("/api/developer/api-keys")
      if (!res.ok) { setFetchError("Could not load API keys."); return }
      const data = await res.json()
      setKeys(Array.isArray(data) ? data : [])
    } catch {
      setFetchError("Could not load API keys.")
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => { fetchKeys() }, [fetchKeys])

  const activeKeyCount = keys.filter((k) => k.isActive).length
  const isLastActive = (key: ApiKey) => key.isActive && activeKeyCount <= 1

  return (
    <TooltipProvider>
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-zinc-700 dark:text-zinc-300">
            {keys.length > 0 ? `${keys.length} key${keys.length !== 1 ? "s" : ""}` : ""}
          </p>
          <Button size="sm" onClick={() => setAddOpen(true)}>Add API Key</Button>
        </div>

        {loading ? (
          <TableSkeleton />
        ) : fetchError ? (
          <p className="text-sm text-destructive">{fetchError}</p>
        ) : keys.length === 0 ? (
          <EmptyState
            message="No API keys yet."
            description="Create one to start using the API."
          />
        ) : (
          <div className="rounded-xl border bg-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Name</TableHead>
                  <TableHead className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Key Prefix</TableHead>
                  <TableHead className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Permissions</TableHead>
                  <TableHead className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Session</TableHead>
                  <TableHead className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Last Used</TableHead>
                  <TableHead className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Status</TableHead>
                  <TableHead className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Created</TableHead>
                  <TableHead className="text-right text-xs font-medium text-zinc-500 uppercase tracking-wider">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {keys.map((key) => (
                  <TableRow key={key.id} className="hover:bg-muted/40 transition-colors">
                    <TableCell className="text-sm font-medium text-foreground">{key.name}</TableCell>
                    <TableCell className="font-mono text-xs text-zinc-700 dark:text-zinc-300">{key.keyPrefix}…</TableCell>
                    <TableCell><PermissionChips perms={key.permissions} /></TableCell>
                    <TableCell className="font-mono text-xs text-zinc-700 dark:text-zinc-300">
                      {key.sessionId ?? <span className="text-zinc-400 font-light">All</span>}
                    </TableCell>
                    <TableCell className="text-xs text-zinc-400 font-light tabular-nums">{formatDate(key.lastUsedAt)}</TableCell>
                    <TableCell>
                      <Badge
                        variant={key.isActive ? "secondary" : "outline"}
                        className={key.isActive
                          ? "bg-green-500/10 text-green-700 dark:text-green-400 border-transparent"
                          : "text-zinc-500 border-zinc-200 dark:border-zinc-700"}
                      >
                        {key.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-zinc-400 font-light tabular-nums">{formatDate(key.createdAt)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setEditTarget(key)}
                          aria-label="Edit key"
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setRotateTarget(key)}
                          aria-label="Rotate key"
                        >
                          <RotateCcw className="size-4" />
                        </Button>
                        {isLastActive(key) ? (
                          <Tooltip>
                            <TooltipTrigger
                              className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground opacity-50 cursor-not-allowed"
                              aria-label="Delete disabled — last active key"
                            >
                              <Trash2 className="size-4" />
                            </TooltipTrigger>
                            <TooltipContent>
                              Workspace must have at least one active API key
                            </TooltipContent>
                          </Tooltip>
                        ) : (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeleteTarget(key)}
                            aria-label="Delete key"
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        <ApiKeyAddDialog
          open={addOpen}
          onClose={() => setAddOpen(false)}
          onCreated={(key) => {
            setKeys((prev) => [key, ...prev])
          }}
        />

        <ApiKeyEditDialog
          apiKey={editTarget}
          open={editTarget !== null}
          onClose={() => setEditTarget(null)}
          onUpdated={(updated) => {
            setKeys((prev) => prev.map((k) => k.id === updated.id ? updated : k))
          }}
        />

        <RotateConfirmDialog
          apiKey={rotateTarget}
          open={rotateTarget !== null}
          onClose={() => setRotateTarget(null)}
          onRotated={(updated) => {
            setKeys((prev) => prev.map((k) => k.id === updated.id ? updated : k))
          }}
        />

        <DeleteConfirmDialog
          apiKey={deleteTarget}
          open={deleteTarget !== null}
          onClose={() => setDeleteTarget(null)}
          onDeleted={(id) => setKeys((prev) => prev.filter((k) => k.id !== id))}
        />
      </div>
    </TooltipProvider>
  )
}
