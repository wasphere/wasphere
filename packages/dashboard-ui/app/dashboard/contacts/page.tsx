"use client"

import * as React from "react"
import { toast } from "sonner"
import { Search, Pencil, Users as UsersIcon, Plus, Download, Trash2, Tag as TagIcon, X, Check } from "lucide-react"
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
  tags: string[]
  notes: string | null
}

function initials(name: string): string {
  const p = name.trim().split(/\s+/)
  return ((p[0]?.[0] ?? "") + (p.length > 1 ? p[p.length - 1][0] : "")).toUpperCase() || "#"
}

/** Small chips + free-text input for editing a tag list. */
function TagEditor({ tags, onChange }: { tags: string[]; onChange: (next: string[]) => void }) {
  const [draft, setDraft] = React.useState("")
  const add = () => {
    const t = draft.trim().slice(0, 30)
    if (t && !tags.some((x) => x.toLowerCase() === t.toLowerCase()) && tags.length < 20) onChange([...tags, t])
    setDraft("")
  }
  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-input p-2">
      {tags.map((t) => (
        <span key={t} className="flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
          {t}
          <button type="button" onClick={() => onChange(tags.filter((x) => x !== t))} className="opacity-60 hover:opacity-100"><X className="size-3" /></button>
        </span>
      ))}
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add() } else if (e.key === "Backspace" && !draft && tags.length) onChange(tags.slice(0, -1)) }}
        onBlur={add}
        placeholder={tags.length ? "" : "Add tag + Enter"}
        className="min-w-[100px] flex-1 bg-transparent text-sm outline-none"
      />
    </div>
  )
}

export default function ContactsPage() {
  const [contacts, setContacts] = React.useState<Contact[]>([])
  const [allTags, setAllTags] = React.useState<string[]>([])
  const [loading, setLoading] = React.useState(true)
  const [search, setSearch] = React.useState("")
  const [activeTag, setActiveTag] = React.useState<string | null>(null)
  const [selected, setSelected] = React.useState<Set<string>>(new Set())
  const loadedOnce = React.useRef(false)

  // Edit dialog
  const [editing, setEditing] = React.useState<Contact | null>(null)
  const [draft, setDraft] = React.useState<{ savedName: string; tags: string[]; notes: string }>({ savedName: "", tags: [], notes: "" })
  const [saving, setSaving] = React.useState(false)

  // Add dialog
  const [adding, setAdding] = React.useState(false)
  const [addDraft, setAddDraft] = React.useState<{ phone: string; savedName: string; tags: string[] }>({ phone: "", savedName: "", tags: [] })
  const [addBusy, setAddBusy] = React.useState(false)

  // Bulk tag dialog
  const [bulkTag, setBulkTag] = React.useState<{ mode: "addTag" | "removeTag"; tag: string } | null>(null)

  const load = React.useCallback(async (q: string, tag: string | null) => {
    if (!loadedOnce.current) setLoading(true)
    try {
      const qs = new URLSearchParams({ limit: "100" })
      if (q.trim()) qs.set("search", q.trim())
      if (tag) qs.set("tag", tag)
      const [list, tags] = await Promise.all([
        fetch(`/api/contacts?${qs}`).then((r) => r.json()).catch(() => ({})),
        fetch(`/api/contacts/tags`).then((r) => r.json()).catch(() => []),
      ])
      setContacts(Array.isArray(list?.items) ? list.items : [])
      setAllTags(Array.isArray(tags) ? tags : [])
    } catch {
      toast.error("Could not load contacts.")
    } finally {
      loadedOnce.current = true
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    const t = setTimeout(() => void load(search, activeTag), search ? 250 : 0)
    return () => clearTimeout(t)
  }, [load, search, activeTag])

  const refresh = () => void load(search, activeTag)

  // ── Edit ───────────────────────────────────────────────────────────────
  const openEdit = (c: Contact) => { setEditing(c); setDraft({ savedName: c.savedName ?? "", tags: c.tags ?? [], notes: c.notes ?? "" }) }
  const saveEdit = async () => {
    if (!editing) return
    setSaving(true)
    try {
      const res = await fetch(`/api/contacts/${editing.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ savedName: draft.savedName.trim(), tags: draft.tags, notes: draft.notes.trim() }),
      })
      const updated = await res.json()
      if (!res.ok) { toast.error(updated?.message ?? "Could not save."); return }
      setContacts((prev) => prev.map((c) => (c.id === updated.id ? updated : c)))
      toast.success("Contact saved"); setEditing(null)
      void load(search, activeTag) // refresh tag filter
    } catch { toast.error("Could not reach the server.") }
    finally { setSaving(false) }
  }

  // ── Add ────────────────────────────────────────────────────────────────
  const addContact = async () => {
    if (!addDraft.phone.replace(/[^0-9]/g, "")) { toast.error("Enter a phone number with country code."); return }
    setAddBusy(true)
    try {
      const res = await fetch(`/api/contacts`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: addDraft.phone, savedName: addDraft.savedName.trim() || undefined, tags: addDraft.tags }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data?.message ?? "Could not add."); return }
      toast.success("Contact added"); setAdding(false); setAddDraft({ phone: "", savedName: "", tags: [] })
      refresh()
    } catch { toast.error("Could not reach the server.") }
    finally { setAddBusy(false) }
  }

  // ── Delete ─────────────────────────────────────────────────────────────
  const deleteContact = async (c: Contact) => {
    if (!confirm(`Delete ${c.name} from the contact book?`)) return
    const res = await fetch(`/api/contacts/${c.id}`, { method: "DELETE" })
    if (!res.ok) { const d = await res.json().catch(() => ({})); toast.error(d?.message ?? "Could not delete"); return }
    toast.success("Contact deleted"); refresh()
  }

  // ── Selection / bulk ───────────────────────────────────────────────────
  const toggleSelect = (id: string) => setSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  const allSelected = contacts.length > 0 && contacts.every((c) => selected.has(c.id))
  const toggleSelectAll = () => setSelected(allSelected ? new Set() : new Set(contacts.map((c) => c.id)))

  const runBulk = async (action: "addTag" | "removeTag" | "delete", tag?: string) => {
    const ids = [...selected]
    if (!ids.length) return
    if (action === "delete" && !confirm(`Delete ${ids.length} contact${ids.length === 1 ? "" : "s"}?`)) return
    const res = await fetch(`/api/contacts/bulk`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids, action, tag }),
    })
    const data = await res.json()
    if (!res.ok) { toast.error(data?.message ?? "Bulk action failed"); return }
    toast.success(`Updated ${data.affected ?? ids.length} contact${(data.affected ?? ids.length) === 1 ? "" : "s"}`)
    setSelected(new Set()); setBulkTag(null); refresh()
  }

  // ── Export ─────────────────────────────────────────────────────────────
  const exportCsv = async (onlySelected: boolean) => {
    const body = onlySelected ? { ids: [...selected] } : {}
    const res = await fetch(`/api/contacts/export`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
    const data = await res.json()
    if (!res.ok) { toast.error(data?.message ?? "Export failed"); return }
    const blob = new Blob([data.csv ?? ""], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url; a.download = data.filename ?? "contacts.csv"; a.click()
    URL.revokeObjectURL(url)
    toast.success(`Exported ${data.count ?? 0} contact${(data.count ?? 0) === 1 ? "" : "s"}`)
  }

  const selCount = selected.size

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">Contacts</h1>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">{contacts.length} contact{contacts.length === 1 ? "" : "s"}</span>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => void exportCsv(false)}><Download className="size-4" /> Export</Button>
          <Button size="sm" className="gap-1.5" onClick={() => setAdding(true)}><Plus className="size-4" /> Add contact</Button>
        </div>
      </div>

      {/* Search + tag filter */}
      <div className="flex flex-col gap-2">
        <div className="relative max-w-sm">
          <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input className="pl-8" placeholder="Search name or phone…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        {allTags.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <button onClick={() => setActiveTag(null)} className={["rounded-full border px-2.5 py-0.5 text-xs", activeTag === null ? "border-primary bg-primary/10 text-primary" : "border-input text-muted-foreground hover:bg-muted"].join(" ")}>All</button>
            {allTags.map((t) => (
              <button key={t} onClick={() => setActiveTag(activeTag === t ? null : t)} className={["flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs", activeTag === t ? "border-primary bg-primary/10 text-primary" : "border-input text-muted-foreground hover:bg-muted"].join(" ")}>
                <TagIcon className="size-3" />{t}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Bulk bar */}
      {selCount > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2 text-sm">
          <span className="font-medium">{selCount} selected</span>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setBulkTag({ mode: "addTag", tag: "" })}><TagIcon className="size-3.5" /> Add tag</Button>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setBulkTag({ mode: "removeTag", tag: "" })}>Remove tag</Button>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => void exportCsv(true)}><Download className="size-3.5" /> Export</Button>
          <Button variant="ghost" size="sm" className="gap-1.5 text-destructive" onClick={() => void runBulk("delete")}><Trash2 className="size-3.5" /> Delete</Button>
          <Button variant="ghost" size="sm" className="ml-auto" onClick={() => setSelected(new Set())}>Clear</Button>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : contacts.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border bg-card py-16 text-center">
          <div className="flex size-16 items-center justify-center rounded-full bg-primary/5"><UsersIcon className="size-8 text-primary/40" /></div>
          <p className="text-sm text-muted-foreground">{search || activeTag ? "No contacts match." : "No contacts yet. Add one, or they appear as people message you."}</p>
        </div>
      ) : (
        <div className="rounded-xl border bg-card">
          <div className="flex items-center gap-3 border-b px-4 py-2 text-xs text-muted-foreground">
            <input type="checkbox" checked={allSelected} onChange={toggleSelectAll} className="size-4 accent-primary" />
            <span>Select all</span>
          </div>
          <div className="divide-y">
            {contacts.map((c) => (
              <div key={c.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/40">
                <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggleSelect(c.id)} className="size-4 accent-primary" />
                <Avatar className="size-9 shrink-0">
                  {c.avatarUrl ? <AvatarImage src={c.avatarUrl} alt="" /> : null}
                  <AvatarFallback className="text-[11px]">{initials(c.name)}</AvatarFallback>
                </Avatar>
                <div className="flex min-w-0 flex-col">
                  <span className="truncate text-sm font-medium">{c.name}</span>
                  <span className="truncate text-xs text-muted-foreground tabular-nums">{c.phone}</span>
                </div>
                {c.tags.length > 0 && (
                  <div className="ml-1 hidden flex-wrap gap-1 sm:flex">
                    {c.tags.slice(0, 3).map((t) => <span key={t} className="rounded-full bg-primary/8 px-1.5 py-0.5 text-[10px] text-primary">{t}</span>)}
                    {c.tags.length > 3 && <span className="text-[10px] text-muted-foreground">+{c.tags.length - 3}</span>}
                  </div>
                )}
                <div className="ml-auto flex items-center">
                  <Button variant="ghost" size="icon" className="size-8" onClick={() => openEdit(c)} title="Edit"><Pencil className="size-4" /></Button>
                  <Button variant="ghost" size="icon" className="size-8 text-destructive" onClick={() => void deleteContact(c)} title="Delete"><Trash2 className="size-4" /></Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Edit dialog */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent showCloseButton className="sm:max-w-md">
          <DialogHeader><DialogTitle>Edit contact</DialogTitle></DialogHeader>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="c-name">Saved name</Label>
              <Input id="c-name" value={draft.savedName} maxLength={100} placeholder={editing?.whatsappName ?? editing?.phone ?? "Name"} onChange={(e) => setDraft((d) => ({ ...d, savedName: e.target.value }))} autoFocus />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Tags</Label>
              <TagEditor tags={draft.tags} onChange={(tags) => setDraft((d) => ({ ...d, tags }))} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="c-notes">Notes</Label>
              <textarea id="c-notes" value={draft.notes} maxLength={2000} rows={3} placeholder="Anything to remember about this contact…"
                onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
                className="rounded-md border border-input bg-transparent p-2 text-sm outline-none focus-visible:ring-1 focus-visible:ring-ring" />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => void saveEdit()} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add dialog */}
      <Dialog open={adding} onOpenChange={(o) => !o && setAdding(false)}>
        <DialogContent showCloseButton className="sm:max-w-md">
          <DialogHeader><DialogTitle>Add contact</DialogTitle></DialogHeader>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="a-phone">Phone (with country code)</Label>
              <Input id="a-phone" value={addDraft.phone} placeholder="e.g. 923001234567" onChange={(e) => setAddDraft((d) => ({ ...d, phone: e.target.value }))} autoFocus />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="a-name">Name (optional)</Label>
              <Input id="a-name" value={addDraft.savedName} maxLength={100} onChange={(e) => setAddDraft((d) => ({ ...d, savedName: e.target.value }))} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Tags</Label>
              <TagEditor tags={addDraft.tags} onChange={(tags) => setAddDraft((d) => ({ ...d, tags }))} />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => void addContact()} disabled={addBusy}>{addBusy ? "Adding…" : "Add contact"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk tag dialog */}
      <Dialog open={!!bulkTag} onOpenChange={(o) => !o && setBulkTag(null)}>
        <DialogContent showCloseButton className="sm:max-w-sm">
          <DialogHeader><DialogTitle>{bulkTag?.mode === "addTag" ? "Add tag to" : "Remove tag from"} {selCount} contact{selCount === 1 ? "" : "s"}</DialogTitle></DialogHeader>
          <div className="flex flex-col gap-2">
            <Label htmlFor="bulk-tag">Tag</Label>
            <Input id="bulk-tag" value={bulkTag?.tag ?? ""} maxLength={30} placeholder="e.g. Lead" autoFocus
              onChange={(e) => setBulkTag((b) => b && ({ ...b, tag: e.target.value }))}
              onKeyDown={(e) => { if (e.key === "Enter" && bulkTag?.tag.trim()) void runBulk(bulkTag.mode, bulkTag.tag.trim()) }} />
            {bulkTag?.mode === "addTag" && allTags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {allTags.map((t) => <button key={t} onClick={() => setBulkTag((b) => b && ({ ...b, tag: t }))} className="rounded-full border border-input px-2 py-0.5 text-xs text-muted-foreground hover:bg-muted">{t}</button>)}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button disabled={!bulkTag?.tag.trim()} onClick={() => bulkTag && void runBulk(bulkTag.mode, bulkTag.tag.trim())}>
              <Check className="mr-1.5 size-4" />{bulkTag?.mode === "addTag" ? "Add tag" : "Remove tag"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
