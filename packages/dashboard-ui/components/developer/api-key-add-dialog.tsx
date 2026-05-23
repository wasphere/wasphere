"use client"

import * as React from "react"
import { toast } from "sonner"
import { Copy, Check, AlertTriangle } from "lucide-react"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { ApiKey } from "@/components/developer/api-keys-tab"

// ─── Permission groups (mirrors backend PERMISSION_SCOPES) ───────────────────

const PERMISSION_GROUPS = [
  { label: "Messages", perms: ["messages:send", "messages:send_bulk", "messages:read"] },
  { label: "Sessions", perms: ["sessions:read", "sessions:write", "sessions:delete"] },
  { label: "Webhooks", perms: ["webhooks:read", "webhooks:write", "webhooks:delete"] },
  { label: "Workspace", perms: ["workspace:read", "workspace:write"] },
  { label: "Audit", perms: ["audit:read"] },
] as const

const ALL_PERMS = PERMISSION_GROUPS.flatMap((g) => g.perms)

interface Session { id: string; status: string }

// ─── One-time key display ────────────────────────────────────────────────────

function KeyDisplay({ rawKey, onDone }: { rawKey: string; onDone: () => void }) {
  const [copied, setCopied] = React.useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(rawKey)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error("Failed to copy key.")
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start gap-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-3">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
        <p className="text-sm font-medium text-amber-700 dark:text-amber-300">
          This key will not be shown again. Copy it now and store it securely.
        </p>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label className="text-sm font-medium text-foreground">API Key</Label>
        <div className="flex items-center gap-2">
          <Input
            value={rawKey}
            readOnly
            className="font-mono text-xs"
            aria-label="New API key"
          />
          <Button
            variant="outline"
            size="icon"
            onClick={handleCopy}
            aria-label={copied ? "Copied" : "Copy key"}
          >
            {copied ? <Check className="size-4 text-green-600" /> : <Copy className="size-4" />}
          </Button>
        </div>
      </div>
      <DialogFooter>
        <Button onClick={onDone}>I&apos;ve saved it</Button>
      </DialogFooter>
    </div>
  )
}

// ─── Add dialog ──────────────────────────────────────────────────────────────

export interface ApiKeyAddDialogProps {
  open: boolean
  onClose: () => void
  onCreated: (key: ApiKey) => void
}

export function ApiKeyAddDialog({ open, onClose, onCreated }: ApiKeyAddDialogProps) {
  const [name, setName] = React.useState("")
  const [selectedPerms, setSelectedPerms] = React.useState<string[]>([])
  const [wildcard, setWildcard] = React.useState(false)
  const [sessionId, setSessionId] = React.useState<string>("__all__")
  const [expiresAt, setExpiresAt] = React.useState("")
  const [sessions, setSessions] = React.useState<Session[]>([])
  const [submitting, setSubmitting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [rawKey, setRawKey] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!open) return
    fetch("/api/sessions")
      .then((r) => r.ok ? r.json() : [])
      .then((data) => setSessions(Array.isArray(data) ? data : (data.sessions ?? [])))
      .catch(() => {})
  }, [open])

  const reset = () => {
    setName(""); setSelectedPerms([]); setWildcard(false)
    setSessionId("__all__"); setExpiresAt(""); setError(null)
    setRawKey(null); setSubmitting(false)
  }

  const handleClose = () => { reset(); onClose() }

  const togglePerm = (perm: string) => {
    setSelectedPerms((prev) =>
      prev.includes(perm) ? prev.filter((p) => p !== perm) : [...prev, perm]
    )
  }

  const handleWildcard = (checked: boolean) => {
    setWildcard(checked)
    if (checked) setSelectedPerms([...ALL_PERMS])
    else setSelectedPerms([])
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    const perms = wildcard ? ["*"] : selectedPerms
    if (perms.length === 0) { setError("Select at least one permission."); return }

    setSubmitting(true)
    try {
      const body: Record<string, unknown> = {
        name: name.trim(),
        permissions: perms,
      }
      if (sessionId !== "__all__") body.sessionId = sessionId
      if (expiresAt) body.expiresAt = new Date(expiresAt).toISOString()

      const res = await fetch("/api/developer/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        const msg = Array.isArray(data.message)
          ? (data.message as string[]).join("\n")
          : (data.message ?? "Failed to create key.")
        setError(msg)
        return
      }
      setRawKey(data.rawKey ?? data.key ?? null)
      onCreated(data as ApiKey)
    } catch {
      setError("Could not reach the server.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent showCloseButton className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{rawKey ? "Key Created" : "Add API Key"}</DialogTitle>
        </DialogHeader>

        {rawKey ? (
          <KeyDisplay rawKey={rawKey} onDone={handleClose} />
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {/* Name */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="key-name" className="text-sm font-medium text-foreground">
                Name
              </Label>
              <Input
                id="key-name"
                placeholder="e.g. Production integration"
                className="placeholder:text-zinc-400 placeholder:font-light"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={64}
                required
                autoFocus
              />
            </div>

            {/* Permissions */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium text-foreground">Permissions</Label>
                <label className="flex items-center gap-1.5 cursor-pointer select-none">
                  <Checkbox
                    checked={wildcard}
                    onCheckedChange={(v) => handleWildcard(v === true)}
                  />
                  <span className="text-xs text-zinc-700 dark:text-zinc-300">Select all (*)</span>
                </label>
              </div>
              <div className="grid grid-cols-2 gap-x-6 gap-y-3 rounded-lg border p-3">
                {PERMISSION_GROUPS.map((group) => (
                  <div key={group.label} className="flex flex-col gap-1.5">
                    <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
                      {group.label}
                    </p>
                    {group.perms.map((perm) => (
                      <label key={perm} className="flex items-center gap-1.5 cursor-pointer select-none">
                        <Checkbox
                          checked={selectedPerms.includes(perm)}
                          onCheckedChange={() => togglePerm(perm)}
                          disabled={wildcard}
                        />
                        <span className="text-xs text-zinc-700 dark:text-zinc-300 font-mono">
                          {perm.split(":")[1]}
                        </span>
                      </label>
                    ))}
                  </div>
                ))}
              </div>
            </div>

            {/* Session scope */}
            <div className="flex flex-col gap-1.5">
              <Label className="text-sm font-medium text-foreground">
                Session Scope
                <span className="ml-1 text-zinc-400 font-light">(optional)</span>
              </Label>
              <Select value={sessionId} onValueChange={(v) => setSessionId(v ?? "__all__")}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All sessions</SelectItem>
                  {sessions.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Expires */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="key-expires" className="text-sm font-medium text-foreground">
                Expires
                <span className="ml-1 text-zinc-400 font-light">(optional)</span>
              </Label>
              <Input
                id="key-expires"
                type="datetime-local"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                className="placeholder:text-zinc-400 placeholder:font-light"
              />
            </div>

            {error && <p className="text-xs text-destructive whitespace-pre-line">{error}</p>}

            <DialogFooter showCloseButton>
              <Button type="submit" disabled={submitting}>
                {submitting ? "Creating…" : "Create Key"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
