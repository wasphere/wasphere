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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { ApiKey } from "@/components/developer/api-keys-tab"

const PERMISSION_GROUPS = [
  { label: "Messages", perms: ["messages:send", "messages:send_bulk", "messages:read"] },
  { label: "Sessions", perms: ["sessions:read", "sessions:write", "sessions:delete"] },
  { label: "Webhooks", perms: ["webhooks:read", "webhooks:write", "webhooks:delete"] },
  { label: "Workspace", perms: ["workspace:read", "workspace:write"] },
  { label: "Audit", perms: ["audit:read"] },
] as const

const ALL_PERMS = PERMISSION_GROUPS.flatMap((g) => g.perms)

interface Session { id: string; status: string }

export interface ApiKeyEditDialogProps {
  apiKey: ApiKey | null
  open: boolean
  onClose: () => void
  onUpdated: (key: ApiKey) => void
}

export function ApiKeyEditDialog({ apiKey, open, onClose, onUpdated }: ApiKeyEditDialogProps) {
  const [name, setName] = React.useState("")
  const [selectedPerms, setSelectedPerms] = React.useState<string[]>([])
  const [wildcard, setWildcard] = React.useState(false)
  const [sessionId, setSessionId] = React.useState("__all__")
  const [isActive, setIsActive] = React.useState(true)
  const [sessions, setSessions] = React.useState<Session[]>([])
  const [submitting, setSubmitting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  // Populate form from apiKey when it changes
  React.useEffect(() => {
    if (!apiKey) return
    setName(apiKey.name)
    setIsActive(apiKey.isActive)
    const perms = apiKey.permissions
    if (perms.length === 1 && perms[0] === "*") {
      setWildcard(true)
      setSelectedPerms([...ALL_PERMS])
    } else {
      setWildcard(false)
      setSelectedPerms(perms)
    }
    setSessionId(apiKey.sessionId ?? "__all__")
    setError(null)
  }, [apiKey])

  React.useEffect(() => {
    if (!open) return
    fetch("/api/sessions")
      .then((r) => r.ok ? r.json() : [])
      .then((data) => setSessions(Array.isArray(data) ? data : (data.sessions ?? [])))
      .catch(() => {})
  }, [open])

  const togglePerm = (perm: string) => {
    setSelectedPerms((prev) =>
      prev.includes(perm) ? prev.filter((p) => p !== perm) : [...prev, perm]
    )
  }

  const handleWildcard = (checked: boolean) => {
    setWildcard(checked)
    setSelectedPerms(checked ? [...ALL_PERMS] : [])
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!apiKey) return
    setError(null)
    const perms = wildcard ? ["*"] : selectedPerms
    if (perms.length === 0) { setError("Select at least one permission."); return }

    setSubmitting(true)
    try {
      const body: Record<string, unknown> = {
        name: name.trim(),
        permissions: perms,
        isActive,
        sessionId: sessionId === "__all__" ? null : sessionId,
      }
      const res = await fetch(`/api/developer/api-keys/${apiKey.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        const msg = Array.isArray(data.message)
          ? (data.message as string[]).join("\n")
          : (data.message ?? "Failed to update key.")
        setError(msg)
        return
      }
      onUpdated(data as ApiKey)
      onClose()
    } catch {
      setError("Could not reach the server.")
    } finally {
      setSubmitting(false)
    }
  }

  if (!apiKey) return null

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent showCloseButton className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit API Key</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Key prefix (read-only) */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-sm font-medium text-foreground">Key Prefix</Label>
            <Input value={apiKey.keyPrefix} readOnly className="font-mono text-xs text-zinc-500" />
          </div>

          {/* Name */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-name" className="text-sm font-medium text-foreground">Name</Label>
            <Input
              id="edit-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={64}
              required
              className="placeholder:text-zinc-400 placeholder:font-light"
            />
          </div>

          {/* Active toggle */}
          <div className="flex items-center justify-between">
            <Label htmlFor="edit-active" className="text-sm font-medium text-foreground">Active</Label>
            <Switch
              id="edit-active"
              checked={isActive}
              onCheckedChange={setIsActive}
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
                <span className="text-xs text-zinc-700 dark:text-zinc-300">All (*)</span>
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
                  <SelectItem key={s.id} value={s.id}>{s.id}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {error && <p className="text-xs text-destructive whitespace-pre-line">{error}</p>}

          <DialogFooter showCloseButton>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Saving…" : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
