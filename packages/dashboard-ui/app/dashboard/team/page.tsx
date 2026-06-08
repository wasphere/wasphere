"use client"

import * as React from "react"
import { toast } from "sonner"
import { Users as UsersIcon, Trash2, Copy, Check, Link2, SlidersHorizontal } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type Member = {
  userId: string
  email: string
  role: "OWNER" | "ADMIN" | "MEMBER"
  permissions: string[]
  capabilities: string[]
  joinedAt: string
}
type Invite = { id: string; role: string; createdAt: string; expiresAt: string }

const ROLE_LABEL: Record<string, string> = { OWNER: "Owner", ADMIN: "Admin", MEMBER: "Agent" }

// Granular capabilities an agent can be granted on top of Inbox + Contacts.
// Must match GRANTABLE_CAPABILITIES in dashboard-api/src/lib/capabilities.ts.
const GRANTABLE: { key: string; label: string; hint: string }[] = [
  { key: "messages", label: "Messages", hint: "Send messages / use the API page" },
  { key: "sessions", label: "Sessions", hint: "Link & manage WhatsApp numbers" },
  { key: "webhooks", label: "Webhooks", hint: "Manage outbound webhooks" },
  { key: "api_keys", label: "API keys", hint: "Create & revoke API keys" },
  { key: "settings", label: "Settings", hint: "Workspace settings & branding" },
]

export default function TeamPage() {
  const [members, setMembers] = React.useState<Member[]>([])
  const [invites, setInvites] = React.useState<Invite[]>([])
  const [myRole, setMyRole] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [inviteRole, setInviteRole] = React.useState<"ADMIN" | "MEMBER">("MEMBER")
  const [creating, setCreating] = React.useState(false)
  const [newLink, setNewLink] = React.useState<string | null>(null)
  const [copied, setCopied] = React.useState(false)
  const [expanded, setExpanded] = React.useState<string | null>(null)
  const [savingPerms, setSavingPerms] = React.useState<string | null>(null)

  const load = React.useCallback(async (silent?: boolean) => {
    if (!silent) setLoading(true)
    try {
      const [mr, m, i] = await Promise.all([
        fetch("/api/team/my-role").then((r) => r.json()).catch(() => ({})),
        fetch("/api/team/members").then((r) => r.json()).catch(() => []),
        fetch("/api/team/invites").then((r) => r.json()).catch(() => []),
      ])
      setMyRole(mr?.role ?? null)
      setMembers(Array.isArray(m) ? m : [])
      setInvites(Array.isArray(i) ? i : [])
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => { void load() }, [load])

  const canManage = myRole === "OWNER" || myRole === "ADMIN"

  const createInvite = async () => {
    setCreating(true); setNewLink(null)
    try {
      const res = await fetch("/api/team/invites", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: inviteRole }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data?.message ?? "Could not create invite"); return }
      // Build the absolute link from THIS dashboard's origin (backend may not
      // know its public URL), falling back to whatever it returned.
      const link = data.token ? `${window.location.origin}/invite/${data.token}` : data.inviteUrl
      setNewLink(link)
      void load(true)
    } catch { toast.error("Could not reach the server.") }
    finally { setCreating(false) }
  }

  const copyLink = async () => {
    if (!newLink) return
    await navigator.clipboard.writeText(newLink).catch(() => null)
    setCopied(true); setTimeout(() => setCopied(false), 1500)
  }

  const changeRole = async (userId: string, role: string) => {
    const res = await fetch(`/api/team/members/${userId}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ role }),
    })
    if (!res.ok) { const d = await res.json().catch(() => ({})); toast.error(d?.message ?? "Could not change role"); return }
    toast.success("Role updated"); void load(true)
  }

  const removeMember = async (userId: string, email: string) => {
    if (!confirm(`Remove ${email} from the workspace?`)) return
    const res = await fetch(`/api/team/members/${userId}`, { method: "DELETE" })
    if (!res.ok) { const d = await res.json().catch(() => ({})); toast.error(d?.message ?? "Could not remove"); return }
    toast.success("Member removed"); void load(true)
  }

  const revokeInvite = async (id: string) => {
    const res = await fetch(`/api/team/invites/${id}`, { method: "DELETE" })
    if (!res.ok) { toast.error("Could not revoke"); return }
    void load(true)
  }

  const togglePermission = async (m: Member, cap: string) => {
    const next = m.permissions.includes(cap)
      ? m.permissions.filter((p) => p !== cap)
      : [...m.permissions, cap]
    // Optimistic update so the toggle feels instant.
    setMembers((prev) => prev.map((x) => (x.userId === m.userId ? { ...x, permissions: next } : x)))
    setSavingPerms(m.userId)
    try {
      const res = await fetch(`/api/team/members/${m.userId}/permissions`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ permissions: next }),
      })
      if (!res.ok) { const d = await res.json().catch(() => ({})); toast.error(d?.message ?? "Could not save"); void load(true); return }
      void load(true)
    } catch { toast.error("Could not reach the server."); void load(true) }
    finally { setSavingPerms(null) }
  }

  if (loading) return <p className="text-sm text-muted-foreground">Loading…</p>

  if (!canManage) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border bg-card py-16 text-center">
        <UsersIcon className="size-8 text-primary/40" />
        <p className="text-sm text-muted-foreground">Only owners and admins can manage the team.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Team</h1>

      {/* Invite */}
      <div className="rounded-xl border bg-card p-4">
        <h2 className="mb-3 text-sm font-semibold">Invite a teammate</h2>
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="role">Role</Label>
            <select id="role" value={inviteRole} onChange={(e) => setInviteRole(e.target.value as "ADMIN" | "MEMBER")} className="h-9 rounded-md border border-input bg-transparent px-3 text-sm">
              <option value="MEMBER">Agent (Inbox + Contacts)</option>
              {myRole === "OWNER" && <option value="ADMIN">Admin (manage everything)</option>}
            </select>
          </div>
          <Button onClick={() => void createInvite()} disabled={creating}>
            <Link2 className="mr-1.5 size-4" /> {creating ? "Generating…" : "Generate invite link"}
          </Button>
        </div>
        {newLink && (
          <div className="mt-3 flex items-center gap-2">
            <code className="flex-1 truncate rounded-md border border-input bg-muted/40 px-2.5 py-2 text-xs">{newLink}</code>
            <Button variant="outline" size="icon" onClick={copyLink}>{copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}</Button>
          </div>
        )}
        <p className="mt-2 text-xs text-muted-foreground">Share this link with your teammate. It expires in 7 days. They set their own password on joining.</p>
      </div>

      {/* Pending invites */}
      {invites.length > 0 && (
        <div className="rounded-xl border bg-card">
          <h2 className="border-b px-4 py-2.5 text-sm font-semibold">Pending invites ({invites.length})</h2>
          {invites.map((i) => (
            <div key={i.id} className="flex items-center gap-3 border-b px-4 py-2.5 last:border-0">
              <span className="text-sm">{ROLE_LABEL[i.role] ?? i.role} invite</span>
              <span className="text-xs text-muted-foreground">expires {new Date(i.expiresAt).toLocaleDateString()}</span>
              <Button variant="ghost" size="sm" className="ml-auto text-destructive" onClick={() => void revokeInvite(i.id)}>Revoke</Button>
            </div>
          ))}
        </div>
      )}

      {/* Members */}
      <div className="rounded-xl border bg-card">
        <h2 className="border-b px-4 py-2.5 text-sm font-semibold">Members ({members.length})</h2>
        {members.map((m) => (
          <div key={m.userId} className="border-b last:border-0">
            <div className="flex items-center gap-3 px-4 py-2.5">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold">{m.email[0]?.toUpperCase()}</span>
              <span className="min-w-0 truncate text-sm">{m.email}</span>
              {m.role === "OWNER" ? (
                <span className="ml-auto rounded-full bg-amber-500/10 px-2 py-0.5 text-xs text-amber-600">Owner</span>
              ) : (
                <div className="ml-auto flex items-center gap-2">
                  {m.role === "MEMBER" && (
                    <Button
                      variant={expanded === m.userId ? "secondary" : "ghost"}
                      size="sm"
                      className="h-8 gap-1.5 text-xs"
                      onClick={() => setExpanded(expanded === m.userId ? null : m.userId)}
                    >
                      <SlidersHorizontal className="size-3.5" />
                      Permissions{m.permissions.length > 0 ? ` (${m.permissions.length})` : ""}
                    </Button>
                  )}
                  <select
                    value={m.role}
                    onChange={(e) => void changeRole(m.userId, e.target.value)}
                    disabled={myRole === "ADMIN" && m.role === "ADMIN"}
                    className="h-8 rounded-md border border-input bg-transparent px-2 text-xs disabled:opacity-50"
                  >
                    <option value="MEMBER">Agent</option>
                    {myRole === "OWNER" && <option value="ADMIN">Admin</option>}
                  </select>
                  <Button variant="ghost" size="icon" className="size-8 text-destructive" onClick={() => void removeMember(m.userId, m.email)} disabled={myRole === "ADMIN" && m.role === "ADMIN"}>
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              )}
            </div>

            {m.role === "MEMBER" && expanded === m.userId && (
              <div className="bg-muted/30 px-4 pb-3.5 pt-1">
                <p className="mb-2 text-xs text-muted-foreground">
                  Agents always have <span className="font-medium">Inbox</span> and <span className="font-medium">Contacts</span>. Grant extra access below.
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {GRANTABLE.map((cap) => {
                    const on = m.permissions.includes(cap.key)
                    return (
                      <button
                        key={cap.key}
                        type="button"
                        title={cap.hint}
                        disabled={savingPerms === m.userId}
                        onClick={() => void togglePermission(m, cap.key)}
                        className={[
                          "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors disabled:opacity-50",
                          on
                            ? "border-primary/30 bg-primary/10 text-primary"
                            : "border-input bg-transparent text-muted-foreground hover:bg-muted",
                        ].join(" ")}
                      >
                        {on && <Check className="size-3" />}
                        {cap.label}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
