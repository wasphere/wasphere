"use client"

import * as React from "react"
import { toast } from "sonner"
import { Search, Pencil, Users as UsersIcon } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"

type Contact = {
  id: string
  name: string
  savedName: string | null
  whatsappName: string | null
  phone: string
  jid: string
  avatarUrl: string | null
}

function initials(name: string): string {
  const p = name.trim().split(/\s+/)
  return ((p[0]?.[0] ?? "") + (p.length > 1 ? p[p.length - 1][0] : "")).toUpperCase() || "#"
}

export default function ContactsPage() {
  const [contacts, setContacts] = React.useState<Contact[]>([])
  const [loading, setLoading] = React.useState(true)
  const [search, setSearch] = React.useState("")
  const [editing, setEditing] = React.useState<Contact | null>(null)
  const [draftName, setDraftName] = React.useState("")
  const [saving, setSaving] = React.useState(false)

  const load = React.useCallback(async (q: string) => {
    setLoading(true)
    try {
      const qs = new URLSearchParams({ limit: "100" })
      if (q.trim()) qs.set("search", q.trim())
      const res = await fetch(`/api/contacts?${qs}`)
      const data = await res.json()
      setContacts(Array.isArray(data?.items) ? data.items : [])
    } catch {
      toast.error("Could not load contacts.")
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    const t = setTimeout(() => void load(search), search ? 250 : 0)
    return () => clearTimeout(t)
  }, [load, search])

  const openEdit = (c: Contact) => { setEditing(c); setDraftName(c.savedName ?? "") }

  const saveName = async () => {
    if (!editing) return
    setSaving(true)
    try {
      const res = await fetch(`/api/contacts/${editing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ savedName: draftName.trim() }),
      })
      const updated = await res.json()
      if (!res.ok) { toast.error(updated?.message ?? "Could not save."); return }
      setContacts((prev) => prev.map((c) => (c.id === updated.id ? updated : c)))
      toast.success("Contact saved")
      setEditing(null)
    } catch {
      toast.error("Could not reach the server.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Contacts</h1>
        <span className="text-sm text-muted-foreground">{contacts.length} contact{contacts.length === 1 ? "" : "s"}</span>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
        <Input className="pl-8" placeholder="Search name or phone…" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : contacts.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border bg-card py-16 text-center">
          <div className="flex size-16 items-center justify-center rounded-full bg-primary/5">
            <UsersIcon className="size-8 text-primary/40" />
          </div>
          <p className="text-sm text-muted-foreground">{search ? "No contacts match your search." : "No contacts yet. They appear here as people message you (or you start a chat)."}</p>
        </div>
      ) : (
        <div className="rounded-xl border bg-card divide-y">
          {contacts.map((c) => (
            <div key={c.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/40">
              <Avatar className="size-9 shrink-0">
                {c.avatarUrl ? <AvatarImage src={c.avatarUrl} alt="" /> : null}
                <AvatarFallback className="text-[11px]">{initials(c.name)}</AvatarFallback>
              </Avatar>
              <div className="flex min-w-0 flex-col">
                <span className="truncate text-sm font-medium">{c.name}</span>
                <span className="truncate text-xs text-muted-foreground tabular-nums">{c.phone}{c.savedName && c.whatsappName ? ` · ${c.whatsappName}` : ""}</span>
              </div>
              <Button variant="ghost" size="icon" className="ml-auto size-8" onClick={() => openEdit(c)} title="Rename">
                <Pencil className="size-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent showCloseButton className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Rename contact</DialogTitle></DialogHeader>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="c-name">Saved name</Label>
              <Input id="c-name" value={draftName} maxLength={100} placeholder={editing?.whatsappName ?? editing?.phone ?? "Name"} onChange={(e) => setDraftName(e.target.value)} autoFocus />
            </div>
            <p className="text-xs text-muted-foreground">Leave empty to fall back to the WhatsApp name / number.</p>
          </div>
          <DialogFooter>
            <Button onClick={() => void saveName()} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
