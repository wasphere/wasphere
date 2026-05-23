"use client"

import * as React from "react"
import Link from "next/link"
import { toast } from "sonner"
import { Globe, KeyRound, Eye, EyeOff, Building2, CheckCircle2, Server, ShieldCheck, Bell, Lock, AlertTriangle, Copy, Check, ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export interface Workspace {
  id: string
  name: string
  waServerUrl?: string | null
  waServerToken?: string | null
  waServerConfigured: boolean
}

interface SettingsFormProps {
  workspace: Workspace
}

export function SettingsForm({ workspace }: SettingsFormProps) {
  const [waServerUrl, setWaServerUrl] = React.useState(workspace.waServerUrl ?? "")
  const [waServerToken, setWaServerToken] = React.useState(workspace.waServerToken ?? "")
  const [showToken, setShowToken] = React.useState(false)
  const [configError, setConfigError] = React.useState<string | null>(null)
  const [configSubmitting, setConfigSubmitting] = React.useState(false)

  const [name, setName] = React.useState(workspace.name)
  const [nameError, setNameError] = React.useState<string | null>(null)
  const [nameSubmitting, setNameSubmitting] = React.useState(false)

  const [rotateLoading, setRotateLoading] = React.useState(false)
  const [rotatedKey, setRotatedKey] = React.useState<string | null>(null)
  const [rotateCopied, setRotateCopied] = React.useState(false)
  const [rotateError, setRotateError] = React.useState<string | null>(null)

  const handleRotate = async () => {
    setRotateLoading(true)
    setRotateError(null)
    setRotatedKey(null)
    try {
      // Step 1: find the primary key ID
      const keysRes = await fetch("/api/developer/api-keys")
      if (!keysRes.ok) { setRotateError("Could not load API keys."); return }
      const keys = await keysRes.json()
      const primaryKey = Array.isArray(keys) ? keys[0] : null
      if (!primaryKey?.id) { setRotateError("No API key found."); return }
      // Step 2: rotate it
      const rotateRes = await fetch(`/api/developer/api-keys/${primaryKey.id}/rotate`, { method: "POST" })
      const data = await rotateRes.json().catch(() => ({}))
      if (!rotateRes.ok) { setRotateError(data.message ?? "Rotation failed."); return }
      setRotatedKey(data.key ?? data.plaintext ?? null)
      toast.success("API key rotated.")
    } catch { setRotateError("Could not reach the server.") }
    finally { setRotateLoading(false) }
  }

  const copyRotated = async () => {
    if (!rotatedKey) return
    await navigator.clipboard.writeText(rotatedKey).catch(() => null)
    setRotateCopied(true)
    setTimeout(() => setRotateCopied(false), 2000)
  }

  const handleConfigSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setConfigError(null)
    setConfigSubmitting(true)
    try {
      const res = await fetch("/api/settings/workspace", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ waServerUrl, waServerToken }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        const msg: string = Array.isArray(data.message) ? data.message.join(" ") : (data.message ?? "Failed to save configuration.")
        setConfigError(msg)
        return
      }
      toast.success("WA Server configuration saved.")
    } catch {
      setConfigError("Could not reach the server.")
    } finally {
      setConfigSubmitting(false)
    }
  }

  const handleNameSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setNameError(null)
    setNameSubmitting(true)
    try {
      const res = await fetch("/api/settings/workspace", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        const msg: string = Array.isArray(data.message) ? data.message.join(" ") : (data.message ?? "Failed to update workspace name.")
        setNameError(msg)
        return
      }
      toast.success("Workspace name updated.")
    } catch {
      setNameError("Could not reach the server.")
    } finally {
      setNameSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      {/* WA Server Configuration */}
      <Card className="border-primary/20 [background-image:radial-gradient(hsl(var(--primary)/0.04)_1px,transparent_1px)] [background-size:20px_20px]">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <Server size={16} className="text-primary" />
            </div>
            <div>
              <CardTitle className="text-base font-semibold text-foreground">WA Server</CardTitle>
              <CardDescription className="text-xs text-zinc-400 font-light mt-0.5">
                Connect your self-hosted WhatsApp gateway
              </CardDescription>
            </div>
            {workspace.waServerConfigured && (
              <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-green-500/10 px-2.5 py-1 text-xs font-medium text-green-700 dark:text-green-400">
                <CheckCircle2 size={12} />
                Connected
              </span>
            )}
          </div>
        </CardHeader>
        <CardContent className="bg-background/60 rounded-b-xl pt-4 border-t border-primary/10">
          <form onSubmit={handleConfigSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="wa-server-url" className="text-sm font-medium text-foreground flex items-center gap-1.5">
                <Globe size={13} className="text-zinc-400" />
                Server URL
              </Label>
              <Input
                id="wa-server-url"
                type="url"
                placeholder="http://localhost:3001"
                value={waServerUrl}
                onChange={(e) => setWaServerUrl(e.target.value)}
                className="placeholder:text-zinc-400 placeholder:font-light font-mono text-sm"
              />
              <p className="text-xs text-zinc-400 font-light">The base URL of your WA Server instance.</p>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="wa-server-token" className="text-sm font-medium text-foreground flex items-center gap-1.5">
                <KeyRound size={13} className="text-zinc-400" />
                API Token
              </Label>
              <div className="flex gap-2">
                <Input
                  id="wa-server-token"
                  type={showToken ? "text" : "password"}
                  placeholder="Paste your WA_TOKEN here"
                  value={waServerToken}
                  onChange={(e) => setWaServerToken(e.target.value)}
                  className="flex-1 placeholder:text-zinc-400 placeholder:font-light font-mono text-sm"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setShowToken((v) => !v)}
                  className="shrink-0 h-9 w-9"
                  aria-label={showToken ? "Hide token" : "Show token"}
                >
                  {showToken ? <EyeOff size={15} /> : <Eye size={15} />}
                </Button>
              </div>
              <p className="text-xs text-zinc-400 font-light">Stored encrypted at rest. Never logged or exposed in responses.</p>
            </div>

            {configError && <p className="text-xs text-destructive">{configError}</p>}

            <div>
              <Button type="submit" disabled={configSubmitting} size="sm">
                {configSubmitting ? "Saving…" : "Save Configuration"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Workspace Name */}
      <Card className="border-primary/20 [background-image:radial-gradient(hsl(var(--primary)/0.04)_1px,transparent_1px)] [background-size:20px_20px]">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <Building2 size={16} className="text-primary" />
            </div>
            <div>
              <CardTitle className="text-base font-semibold text-foreground">Workspace</CardTitle>
              <CardDescription className="text-xs text-zinc-400 font-light mt-0.5">
                Rename or manage your workspace
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="bg-background/60 rounded-b-xl pt-4 border-t border-primary/10">
          <form onSubmit={handleNameSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="workspace-name" className="text-sm font-medium text-foreground flex items-center gap-1.5">
                <Building2 size={13} className="text-zinc-400" />
                Workspace Name
              </Label>
              <Input
                id="workspace-name"
                type="text"
                placeholder="My Workspace"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="placeholder:text-zinc-400 placeholder:font-light max-w-sm"
              />
            </div>

            {nameError && <p className="text-xs text-destructive">{nameError}</p>}

            <div>
              <Button type="submit" disabled={nameSubmitting} size="sm">
                {nameSubmitting ? "Saving…" : "Save Name"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Security */}
      <Card className="border-primary/20 [background-image:radial-gradient(hsl(var(--primary)/0.04)_1px,transparent_1px)] [background-size:20px_20px]">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <ShieldCheck size={16} className="text-primary" />
            </div>
            <div>
              <CardTitle className="text-base font-semibold text-foreground">Security</CardTitle>
              <CardDescription className="text-xs text-zinc-400 font-light mt-0.5">
                API token management and audit access
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="bg-background/60 rounded-b-xl pt-4 border-t border-primary/10 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <p className="text-sm font-medium text-foreground">Rotate API Token</p>
            <p className="text-xs text-zinc-400 font-light">Generates a new token and immediately invalidates the old one.</p>
            <div>
              <Button size="sm" variant="outline" onClick={handleRotate} disabled={rotateLoading}>
                {rotateLoading ? "Rotating…" : "Rotate Token"}
              </Button>
            </div>
            {rotateError && <p className="text-xs text-destructive">{rotateError}</p>}
            {rotatedKey && (
              <div className="flex flex-col gap-1.5 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-3">
                <div className="flex items-center gap-1.5 text-xs font-medium text-amber-700 dark:text-amber-300">
                  <AlertTriangle size={13} />
                  Save this token now — it won&apos;t be shown again.
                </div>
                <div className="flex items-center gap-2">
                  <Input value={rotatedKey} readOnly className="font-mono text-xs" aria-label="New API token" />
                  <Button variant="outline" size="icon" onClick={copyRotated} className="shrink-0 h-9 w-9" aria-label={rotateCopied ? "Copied" : "Copy"}>
                    {rotateCopied ? <Check size={15} className="text-green-600" /> : <Copy size={15} />}
                  </Button>
                </div>
              </div>
            )}
          </div>
          <div className="border-t pt-4">
            <p className="text-sm font-medium text-foreground">Audit Log</p>
            <p className="text-xs text-zinc-400 font-light mt-0.5">View all API requests made in your workspace.</p>
            <Link href="/dashboard/developer" className="inline-flex items-center gap-1.5 mt-2 text-sm text-primary underline underline-offset-2 font-medium">
              Open Audit Log <ExternalLink size={12} />
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Notifications */}
      <Card className="border-primary/20 opacity-70">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <Bell size={16} className="text-primary" />
            </div>
            <div>
              <CardTitle className="text-base font-semibold text-foreground">Notifications</CardTitle>
              <CardDescription className="text-xs text-zinc-400 font-light mt-0.5">
                Alert preferences — coming in Pro
              </CardDescription>
            </div>
            <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 text-xs font-medium text-zinc-500">
              <Lock size={10} /> Pro
            </span>
          </div>
        </CardHeader>
        <CardContent className="bg-background/60 rounded-b-xl pt-4 border-t border-primary/10 flex flex-col gap-3">
          {[
            { label: "Email alert on session disconnect", desc: "Get notified when a WhatsApp session drops." },
            { label: "SMS alerts", desc: "Critical alerts sent to your phone." },
          ].map((item) => (
            <div key={item.label} className="flex items-center justify-between gap-4 opacity-50 cursor-not-allowed">
              <div>
                <p className="text-sm font-medium text-foreground">{item.label}</p>
                <p className="text-xs text-zinc-400 font-light">{item.desc}</p>
              </div>
              <Switch disabled checked={false} />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
