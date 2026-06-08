"use client"

import * as React from "react"
import { toast } from "sonner"
import { Users as UsersIcon, Trash2, Copy, Check, Link2, Pencil, Plus, Shield } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"

type Member = {
  userId: string
  email: string
  role: "OWNER" | "ADMIN" | "MEMBER"
  customRoleId: string | null
  roleName: string
  capabilities: string[]
  joinedAt: string
}
type Invite = { id: string; role: string; roleName: string; createdAt: string; expiresAt: string }
type Role = { id: string; name: string; capabilities: string[]; memberCount: number }

// Must match CAPABILITIES in dashboard-api/src/lib/capabilities.ts.
const CAP_LABELS: Record<string, string> = {
  inbox: "Inbox",
  contacts: "Contacts",
  messages: "Messages",
  sessions: "Sessions",
  webhooks: "Webhooks",
  api_keys: "API keys",
  settings: "Settings",
}
const ALL_CAPS = Object.keys(CAP_LABELS)

const ADMIN = "ADMIN"

export default function TeamPage() {
  const [members, setMembers] = React.useState<Member[]>([])
  const [invites, setInvites] = React.useState<Invite[]>([])
  const [roles, setRoles] = React.useState<Role[]>([])
  const [myRole, setMyRole] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [inviteRole, setInviteRole] = React.useState<string>("")
  const [inviteEmail, setInviteEmail] = React.useState<string>("")
  const [creating, setCreating] = React.useState(false)
  const [newLink, setNewLink] = React.useState<string | null>(null)
  const [copied, setCopied] = React.useState(false)

  // Role editor dialog
  const [editingRole, setEditingRole] = React.useState<{ id?: string; name: string; capabilities: string[] } | null>(null)
  const [savingRole, setSavingRole] = React.useState(false)

  const load = React.useCallback(async (silent?: boolean) => {
    if (!silent) setLoading(true)
    try {
      const [mr, m, i, r] = await Promise.all([
        fetch("/api/team/my-role").then((x) => x.json()).catch(() => ({})),
        fetch("/api/team/members").then((x) => x.json()).catch(() => []),
        fetch("/api/team/invites").then((x) => x.json()).catch(() => []),
        fetch("/api/team/roles").then((x) => x.json()).catch(() => []),
      ])
      setMyRole(mr?.role ?? null)
      setMembers(Array.isArray(m) ? m : [])
      setInvites(Array.isArray(i) ? i : [])
      setRoles(Array.isArray(r) ? r : [])
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => { void load() }, [load])

  const isOwner = myRole === "OWNER"
  const canManage = myRole === "OWNER" || myRole === "ADMIN"

  // Default the invite picker to the first custom role once roles load.
  React.useEffect(() => {
    if (!inviteRole && roles.length > 0) setInviteRole(roles[0].id)
  }, [roles, inviteRole])

  const createInvite = async () => {
    if (!inviteRole) { toast.error("Pick a role first."); return }
    const email = inviteEmail.trim()
    setCreating(true); setNewLink(null)
    try {
      const res = await fetch("/api/team/invites", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(email ? { role: inviteRole, email } : { role: inviteRole }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data?.message ?? "Could not create invite"); return }
      const link = data.token ? `${window.location.origin}/invite/${data.token}` : data.inviteUrl
      setNewLink(link)
      if (data.emailed) toast.success(`Invite emailed to ${email}.`)
      else if (email) toast.message("Invite link created — email could not be sent, share the link below.")
      setInviteEmail("")
      void load(true)
    } catch { toast.error("Could not reach the server.") }
    finally { setCreating(false) }
  }

  const copyLink = async () => {
    if (!newLink) return
    await navigator.clipboard.writeText(newLink).catch(() => null)
    setCopied(true); setTimeout(() => setCopied(false), 1500)
  }

  const assignRole = async (userId: string, role: string) => {
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

  // ── Roles ────────────────────────────────────────────────────────────────
  const saveRole = async () => {
    if (!editingRole) return
    if (!editingRole.name.trim()) { toast.error("Give the role a name."); return }
    setSavingRole(true)
    try {
      const body = JSON.stringify({ name: editingRole.name.trim(), capabilities: editingRole.capabilities })
      const res = editingRole.id
        ? await fetch(`/api/team/roles/${editingRole.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body })
        : await fetch("/api/team/roles", { method: "POST", headers: { "Content-Type": "application/json" }, body })
      const data = await res.json()
      if (!res.ok) { toast.error(data?.message ?? "Could not save role"); return }
      toast.success(editingRole.id ? "Role updated" : "Role created")
      setEditingRole(null); void load(true)
    } catch { toast.error("Could not reach the server.") }
    finally { setSavingRole(false) }
  }

  const deleteRole = async (role: Role) => {
    if (!confirm(`Delete the "${role.name}" role?`)) return
    const res = await fetch(`/api/team/roles/${role.id}`, { method: "DELETE" })
    if (!res.ok) { const d = await res.json().catch(() => ({})); toast.error(d?.message ?? "Could not delete"); return }
    toast.success("Role deleted"); void load(true)
  }

  const toggleDraftCap = (cap: string) => {
    setEditingRole((prev) => prev && ({
      ...prev,
      capabilities: prev.capabilities.includes(cap) ? prev.capabilities.filter((c) => c !== cap) : [...prev.capabilities, cap],
    }))
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
            <select id="role" value={inviteRole} onChange={(e) => setInviteRole(e.target.value)} className="h-9 min-w-[200px] rounded-md border border-input bg-transparent px-3 text-sm">
              {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              {isOwner && <option value={ADMIN}>Admin (full access)</option>}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="inviteEmail">Email <span className="text-muted-foreground">(optional)</span></Label>
            <Input id="inviteEmail" type="email" placeholder="teammate@example.com" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} className="h-9 min-w-[220px]" />
          </div>
          <Button onClick={() => void createInvite()} disabled={creating || !inviteRole}>
            <Link2 className="mr-1.5 size-4" /> {creating ? "Generating…" : inviteEmail.trim() ? "Send invite" : "Generate invite link"}
          </Button>
        </div>
        {newLink && (
          <div className="mt-3 flex items-center gap-2">
            <code className="flex-1 truncate rounded-md border border-input bg-muted/40 px-2.5 py-2 text-xs">{newLink}</code>
            <Button variant="outline" size="icon" onClick={copyLink}>{copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}</Button>
          </div>
        )}
        <p className="mt-2 text-xs text-muted-foreground">Add an email to send the invite directly, or leave it blank to just generate a link. It expires in 7 days. They join with the role you pick and set their own password.</p>
      </div>

      {/* Roles */}
      <div className="rounded-xl border bg-card">
        <div className="flex items-center justify-between border-b px-4 py-2.5">
          <h2 className="text-sm font-semibold">Roles</h2>
          {isOwner && (
            <Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={() => setEditingRole({ name: "", capabilities: ["inbox", "contacts"] })}>
              <Plus className="size-3.5" /> New role
            </Button>
          )}
        </div>

        {/* System Owner/Admin tiers (always full access, not editable) */}
        <div className="flex items-center gap-3 border-b px-4 py-2.5">
          <Shield className="size-4 shrink-0 text-amber-500" />
          <span className="text-sm font-medium">Owner &amp; Admin</span>
          <span className="text-xs text-muted-foreground">Full access — every section</span>
        </div>

        {roles.length === 0 ? (
          <p className="px-4 py-4 text-sm text-muted-foreground">No custom roles yet.{isOwner ? " Create one to define what agents can do." : ""}</p>
        ) : roles.map((r) => (
          <div key={r.id} className="flex items-start gap-3 border-b px-4 py-3 last:border-0">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{r.name}</span>
                <span className="text-xs text-muted-foreground">{r.memberCount} member{r.memberCount === 1 ? "" : "s"}</span>
              </div>
              <div className="mt-1.5 flex flex-wrap gap-1">
                {r.capabilities.length === 0 ? (
                  <span className="text-xs text-muted-foreground">No access</span>
                ) : r.capabilities.map((c) => (
                  <span key={c} className="rounded-full border border-primary/20 bg-primary/5 px-2 py-0.5 text-[11px] text-primary">{CAP_LABELS[c] ?? c}</span>
                ))}
              </div>
            </div>
            {isOwner && (
              <div className="flex shrink-0 items-center gap-1">
                <Button variant="ghost" size="icon" className="size-8" onClick={() => setEditingRole({ id: r.id, name: r.name, capabilities: r.capabilities })} title="Edit">
                  <Pencil className="size-4" />
                </Button>
                <Button variant="ghost" size="icon" className="size-8 text-destructive" onClick={() => void deleteRole(r)} title="Delete">
                  <Trash2 className="size-4" />
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Pending invites */}
      {invites.length > 0 && (
        <div className="rounded-xl border bg-card">
          <h2 className="border-b px-4 py-2.5 text-sm font-semibold">Pending invites ({invites.length})</h2>
          {invites.map((i) => (
            <div key={i.id} className="flex items-center gap-3 border-b px-4 py-2.5 last:border-0">
              <span className="text-sm">{i.roleName} invite</span>
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
          <div key={m.userId} className="flex items-center gap-3 border-b px-4 py-2.5 last:border-0">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold">{m.email[0]?.toUpperCase()}</span>
            <span className="min-w-0 truncate text-sm">{m.email}</span>
            {m.role === "OWNER" ? (
              <span className="ml-auto rounded-full bg-amber-500/10 px-2 py-0.5 text-xs text-amber-600">Owner</span>
            ) : (
              <div className="ml-auto flex items-center gap-2">
                <select
                  value={m.role === "ADMIN" ? ADMIN : (m.customRoleId ?? "")}
                  onChange={(e) => void assignRole(m.userId, e.target.value)}
                  disabled={myRole === "ADMIN" && m.role === "ADMIN"}
                  className="h-8 rounded-md border border-input bg-transparent px-2 text-xs disabled:opacity-50"
                >
                  {/* Show the current value even if it's an unknown/none role */}
                  {m.role === "MEMBER" && !m.customRoleId && <option value="">No role</option>}
                  {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                  {isOwner && <option value={ADMIN}>Admin</option>}
                </select>
                <Button variant="ghost" size="icon" className="size-8 text-destructive" onClick={() => void removeMember(m.userId, m.email)} disabled={myRole === "ADMIN" && m.role === "ADMIN"}>
                  <Trash2 className="size-4" />
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Role editor dialog */}
      <Dialog open={!!editingRole} onOpenChange={(o) => !o && setEditingRole(null)}>
        <DialogContent showCloseButton className="sm:max-w-md">
          <DialogHeader><DialogTitle>{editingRole?.id ? "Edit role" : "New role"}</DialogTitle></DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="role-name">Role name</Label>
              <Input id="role-name" value={editingRole?.name ?? ""} maxLength={40} placeholder="e.g. Support, Sales, Developer"
                onChange={(e) => setEditingRole((p) => p && ({ ...p, name: e.target.value }))} autoFocus />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Permissions</Label>
              <div className="grid grid-cols-2 gap-2">
                {ALL_CAPS.map((cap) => {
                  const on = editingRole?.capabilities.includes(cap) ?? false
                  return (
                    <button
                      key={cap}
                      type="button"
                      onClick={() => toggleDraftCap(cap)}
                      className={[
                        "flex items-center gap-2 rounded-md border px-3 py-2 text-left text-sm transition-colors",
                        on ? "border-primary/40 bg-primary/10 text-primary" : "border-input hover:bg-muted",
                      ].join(" ")}
                    >
                      <span className={["flex size-4 items-center justify-center rounded border", on ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/40"].join(" ")}>
                        {on && <Check className="size-3" />}
                      </span>
                      {CAP_LABELS[cap]}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditingRole(null)}>Cancel</Button>
            <Button onClick={() => void saveRole()} disabled={savingRole}>{savingRole ? "Saving…" : "Save role"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
