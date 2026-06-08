"use client"

import * as React from "react"
import { useParams, useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export default function AcceptInvitePage() {
  const params = useParams<{ token: string }>()
  const router = useRouter()
  const token = params.token

  const [preview, setPreview] = React.useState<{ workspaceName: string; role: string; roleName?: string } | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [email, setEmail] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [submitting, setSubmitting] = React.useState(false)

  React.useEffect(() => {
    fetch(`/api/invites/${token}`)
      .then((r) => r.json().then((d) => ({ ok: r.ok, d })))
      .then(({ ok, d }) => {
        if (!ok) setError(d?.message ?? "This invite is invalid or has expired.")
        else setPreview(d)
      })
      .catch(() => setError("Could not load this invite."))
      .finally(() => setLoading(false))
  }, [token])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim() || password.length < 8) { toast.error("Enter your email and a password (min 8 chars)."); return }
    setSubmitting(true)
    try {
      const res = await fetch("/api/auth/accept-invite", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, email: email.trim(), password }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data?.message ?? "Could not join."); return }
      toast.success(`Joined ${data.workspace?.name ?? "workspace"}`)
      router.push("/dashboard/inbox")
    } catch { toast.error("Could not reach the server.") }
    finally { setSubmitting(false) }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/20 p-6">
      <div className="w-full max-w-sm rounded-xl border bg-card p-6 shadow-sm">
        {loading ? (
          <p className="text-center text-sm text-muted-foreground">Loading invite…</p>
        ) : error ? (
          <div className="flex flex-col items-center gap-2 text-center">
            <h1 className="text-lg font-semibold">Invite unavailable</h1>
            <p className="text-sm text-muted-foreground">{error}</p>
          </div>
        ) : (
          <>
            <h1 className="text-lg font-semibold">Join {preview?.workspaceName}</h1>
            <p className="mb-4 mt-1 text-sm text-muted-foreground">
              You&apos;ve been invited as <span className="font-medium">{preview?.roleName ?? preview?.role}</span>. Set your login to join.
            </p>
            <form onSubmit={submit} className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="password">Password</Label>
                <Input id="password" type="password" value={password} minLength={8} placeholder="min 8 characters" onChange={(e) => setPassword(e.target.value)} />
                <span className="text-xs text-muted-foreground">Existing account? Use your current password to link it.</span>
              </div>
              <Button type="submit" disabled={submitting}>{submitting ? "Joining…" : "Join workspace"}</Button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
