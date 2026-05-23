"use client"

import * as React from "react"
import { toast } from "sonner"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { type SessionConfig, type SessionSummary } from "@/lib/session-config"

interface AntiBanControlsProps {
  sessions: SessionSummary[]
}

interface FormState {
  random_delay_min_ms: number
  random_delay_max_ms: number
  auto_read_on_receive: boolean
  receive_enabled: boolean
}

function msToSeconds(ms: number): string {
  return (ms / 1000).toFixed(1) + "s"
}

function configToForm(config: SessionConfig): FormState {
  return {
    random_delay_min_ms: config.random_delay_min_ms,
    random_delay_max_ms: config.random_delay_max_ms,
    auto_read_on_receive: config.auto_read_on_receive,
    receive_enabled: config.receive_enabled,
  }
}

function formEqual(a: FormState, b: FormState): boolean {
  return (
    a.random_delay_min_ms === b.random_delay_min_ms &&
    a.random_delay_max_ms === b.random_delay_max_ms &&
    a.auto_read_on_receive === b.auto_read_on_receive &&
    a.receive_enabled === b.receive_enabled
  )
}

export function AntiBanControls({ sessions }: AntiBanControlsProps) {
  const [selectedId, setSelectedId] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [submitting, setSubmitting] = React.useState(false)
  const [delayError, setDelayError] = React.useState<string | null>(null)

  const [original, setOriginal] = React.useState<FormState | null>(null)
  const [form, setForm] = React.useState<FormState | null>(null)

  const isDirty = form !== null && original !== null && !formEqual(form, original)

  async function loadSessionConfig(sessionId: string) {
    setLoading(true)
    setDelayError(null)
    try {
      const res = await fetch(`/api/sessions/${sessionId}`)
      if (!res.ok) {
        toast.error("Failed to load session config.")
        return
      }
      const data = await res.json()
      const config: SessionConfig = data.config ?? {
        random_delay_min_ms: 0,
        random_delay_max_ms: 0,
        auto_read_on_receive: false,
        receive_enabled: true,
      }
      const fs = configToForm(config)
      setOriginal(fs)
      setForm(fs)
    } catch {
      toast.error("Could not reach the server.")
    } finally {
      setLoading(false)
    }
  }

  function handleSessionChange(value: string) {
    if (isDirty) {
      const ok = window.confirm("Unsaved changes will be lost. Continue?")
      if (!ok) return
    }
    setSelectedId(value)
    setOriginal(null)
    setForm(null)
    setDelayError(null)
    loadSessionConfig(value)
  }

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev))
    if (key === "random_delay_min_ms" || key === "random_delay_max_ms") {
      setDelayError(null)
    }
  }

  async function handleSave() {
    if (!form || !selectedId) return

    if (form.random_delay_max_ms < form.random_delay_min_ms) {
      setDelayError("Max delay must be ≥ min delay")
      return
    }

    setDelayError(null)
    setSubmitting(true)
    try {
      const res = await fetch(`/api/sessions/${selectedId}/config`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        const msg: string = Array.isArray(data.message)
          ? data.message.join(" ")
          : (data.message ?? "Failed to save settings.")
        toast.error(msg)
        return
      }
      toast.success(
        "Anti-ban settings saved. Applied immediately — no restart needed."
      )
      setOriginal(form)
    } catch {
      toast.error("Could not reach the server.")
    } finally {
      setSubmitting(false)
    }
  }

  const showDelayPreview =
    form !== null &&
    (form.random_delay_min_ms > 0 || form.random_delay_max_ms > 0)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Per-Session Anti-Ban Controls</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        {/* Session selector */}
        <div className="flex flex-col gap-1.5">
          <Label>Session</Label>
          <Select
            value={selectedId ?? ""}
            onValueChange={(v) => { if (v) handleSessionChange(v) }}
          >
            <SelectTrigger className="w-full max-w-sm">
              <SelectValue placeholder="Select a session to configure" />
            </SelectTrigger>
            <SelectContent>
              {sessions.map((session) => (
                <SelectItem key={session.id} value={session.id}>
                  <span className="flex items-center gap-2">
                    <span
                      className={`inline-block h-2 w-2 rounded-full shrink-0 ${
                        session.status === "connected"
                          ? "bg-green-500"
                          : "bg-gray-400"
                      }`}
                    />
                    <span>{session.id}</span>
                    {session.phoneNumber && (
                      <span className="text-muted-foreground text-xs">
                        {session.phoneNumber}
                      </span>
                    )}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Loading state */}
        {loading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <svg
              className="h-4 w-4 animate-spin"
              viewBox="0 0 24 24"
              fill="none"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8v8H4z"
              />
            </svg>
            Loading session config…
          </div>
        )}

        {/* Config form */}
        {!loading && form !== null && (
          <div className="flex flex-col gap-6">
            {/* Field 1 — Random Delay */}
            <div className="flex flex-col gap-2">
              <div>
                <Label>Random Send Delay</Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Adds a random pause between messages. 0 = disabled.
                  Recommended: 2000–5000ms.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4 max-w-sm">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="delay-min" className="text-xs font-normal">
                    Min Delay (ms)
                  </Label>
                  <Input
                    id="delay-min"
                    type="number"
                    min={0}
                    max={60000}
                    step={100}
                    value={form.random_delay_min_ms}
                    onChange={(e) =>
                      setField("random_delay_min_ms", Number(e.target.value))
                    }
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="delay-max" className="text-xs font-normal">
                    Max Delay (ms)
                  </Label>
                  <Input
                    id="delay-max"
                    type="number"
                    min={0}
                    max={60000}
                    step={100}
                    value={form.random_delay_max_ms}
                    onChange={(e) =>
                      setField("random_delay_max_ms", Number(e.target.value))
                    }
                  />
                </div>
              </div>
              {delayError && (
                <p className="text-xs text-destructive">{delayError}</p>
              )}
              {showDelayPreview && !delayError && (
                <p className="text-xs text-muted-foreground">
                  Each message will pause randomly between{" "}
                  {msToSeconds(form.random_delay_min_ms)} and{" "}
                  {msToSeconds(form.random_delay_max_ms)}
                </p>
              )}
            </div>

            {/* Field 2 — Auto-Read */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-3">
                <Switch
                  id="auto-read"
                  checked={form.auto_read_on_receive}
                  onCheckedChange={(v) => setField("auto_read_on_receive", v)}
                />
                <Label htmlFor="auto-read" className="cursor-pointer">
                  Auto-Read Incoming Messages
                </Label>
              </div>
              <p className="text-xs text-muted-foreground ml-0">
                Marks messages as read automatically. Recipients see double blue
                ticks.
              </p>
            </div>

            {/* Field 3 — Receive Enabled */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-3">
                <Switch
                  id="receive-enabled"
                  checked={form.receive_enabled}
                  onCheckedChange={(v) => setField("receive_enabled", v)}
                />
                <Label htmlFor="receive-enabled" className="cursor-pointer">
                  Enable Message Reception
                </Label>
              </div>
              <p className="text-xs text-muted-foreground">
                When off, incoming messages are ignored and webhooks won&apos;t
                fire.
              </p>
              {!form.receive_enabled && (
                <div className="rounded-md border border-amber-400 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-700 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
                  Webhooks will NOT fire for incoming messages while this is
                  disabled.
                </div>
              )}
            </div>

            {/* Save button */}
            <div>
              <Button
                onClick={handleSave}
                disabled={!isDirty || submitting}
              >
                {submitting ? "Saving…" : "Save Anti-Ban Settings"}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
