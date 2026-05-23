"use client"

import * as React from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

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
  // Section 1 — WA Server Configuration
  const [waServerUrl, setWaServerUrl] = React.useState(
    workspace.waServerUrl ?? ""
  )
  const [waServerToken, setWaServerToken] = React.useState(
    workspace.waServerToken ?? ""
  )
  const [showToken, setShowToken] = React.useState(false)
  const [configError, setConfigError] = React.useState<string | null>(null)
  const [configSubmitting, setConfigSubmitting] = React.useState(false)

  // Section 2 — Workspace Name
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
        const msg: string = Array.isArray(data.message)
          ? data.message.join(" ")
          : (data.message ?? "Failed to save configuration.")
        setConfigError(msg)
        return
      }

      toast.success("Configuration saved.")
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
        const msg: string = Array.isArray(data.message)
          ? data.message.join(" ")
          : (data.message ?? "Failed to update workspace name.")
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
    <div className="flex flex-col gap-6">
      {/* Section 1 — WA Server Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium text-foreground">WA Server Configuration</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleConfigSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="wa-server-url" className="text-sm font-medium text-foreground">Server URL</Label>
              <Input
                id="wa-server-url"
                type="url"
                placeholder="http://localhost:3001"
                value={waServerUrl}
                onChange={(e) => setWaServerUrl(e.target.value)}
                className="placeholder:text-zinc-400 placeholder:font-light"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="wa-server-token" className="text-sm font-medium text-foreground">API Token</Label>
              <div className="flex gap-2">
                <Input
                  id="wa-server-token"
                  type={showToken ? "text" : "password"}
                  placeholder="Enter token"
                  value={waServerToken}
                  onChange={(e) => setWaServerToken(e.target.value)}
                  className="flex-1 placeholder:text-zinc-400 placeholder:font-light"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowToken((v) => !v)}
                  className="shrink-0"
                >
                  {showToken ? "Hide" : "Show"}
                </Button>
              </div>
            </div>

            {configError && (
              <p className="text-xs text-destructive">{configError}</p>
            )}

            <div>
              <Button type="submit" disabled={configSubmitting}>
                {configSubmitting ? "Saving…" : "Save Configuration"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Section 2 — Workspace Name */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium text-foreground">Workspace Name</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleNameSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="workspace-name" className="text-sm font-medium text-foreground">Name</Label>
              <Input
                id="workspace-name"
                type="text"
                placeholder="My Workspace"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="placeholder:text-zinc-400 placeholder:font-light"
              />
            </div>

            {nameError && (
              <p className="text-xs text-destructive">{nameError}</p>
            )}

            <div>
              <Button type="submit" disabled={nameSubmitting}>
                {nameSubmitting ? "Saving…" : "Save Name"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
