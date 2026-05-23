"use client"

import * as React from "react"
import { toast } from "sonner"
import { Globe, KeyRound, Eye, EyeOff, Building2, CheckCircle2, Server } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
    </div>
  )
}
