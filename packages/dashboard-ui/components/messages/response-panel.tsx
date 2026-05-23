"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface ResponsePanelProps {
  state: "idle" | "loading" | "success" | "error"
  statusCode?: number
  timestamp?: string
  data?: unknown
}

function getStatusBadgeClass(code: number | undefined): string {
  if (code === undefined) return "bg-zinc-500 text-white"
  if (code >= 200 && code < 300) return "bg-green-600 text-white"
  if (code >= 400 && code < 500) return "bg-orange-500 text-white"
  if (code >= 500) return "bg-red-600 text-white"
  return "bg-zinc-500 text-white"
}

function extractMessageId(data: unknown): string | null {
  if (data === null || typeof data !== "object") return null
  const d = data as Record<string, unknown>
  if (typeof d.id === "string") return d.id
  if (d.key !== null && typeof d.key === "object") {
    const key = d.key as Record<string, unknown>
    if (typeof key.id === "string") return key.id
  }
  return null
}

function formatTimestamp(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
  } catch {
    return iso
  }
}

export function ResponsePanel({
  state,
  statusCode,
  timestamp,
  data,
}: ResponsePanelProps) {
  const [copied, setCopied] = React.useState(false)
  const [copiedId, setCopiedId] = React.useState(false)

  const copyResponse = async () => {
    const text = JSON.stringify(data, null, 2)
    await navigator.clipboard.writeText(text).catch(() => null)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const copyMessageId = async (id: string) => {
    await navigator.clipboard.writeText(id).catch(() => null)
    setCopiedId(true)
    setTimeout(() => setCopiedId(false), 2000)
  }

  const messageId = data ? extractMessageId(data) : null

  return (
    <div className="rounded-xl border bg-card p-4 flex flex-col gap-3">
      <h2 className="text-sm font-semibold text-foreground">API Response</h2>

      {state === "idle" && (
        <p className="text-sm text-muted-foreground py-8 text-center">
          Send a message to see the response
        </p>
      )}

      {state === "loading" && (
        <div className="flex items-center justify-center py-8">
          <div className="size-6 animate-spin rounded-full border-2 border-muted border-t-primary" />
        </div>
      )}

      {(state === "success" || state === "error") && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={cn(
                "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold",
                getStatusBadgeClass(statusCode)
              )}
            >
              {statusCode ?? "Network Error"}
            </span>
            {timestamp && (
              <span className="text-xs text-muted-foreground">
                {formatTimestamp(timestamp)}
              </span>
            )}
          </div>

          {messageId && (
            <div className="flex flex-col gap-1">
              <p className="text-xs text-muted-foreground font-medium">Message ID</p>
              <div className="flex items-center gap-2">
                <code className="text-xs font-mono bg-muted rounded px-2 py-1 flex-1 break-all">
                  {messageId}
                </code>
                <Button
                  type="button"
                  size="xs"
                  variant="outline"
                  onClick={() => copyMessageId(messageId)}
                  className="shrink-0"
                >
                  {copiedId ? "Copied" : "Copy"}
                </Button>
              </div>
            </div>
          )}

          <pre className="bg-zinc-900 text-zinc-100 rounded-md p-3 overflow-auto text-xs font-mono mt-2 max-h-64 whitespace-pre-wrap break-all">
            {JSON.stringify(data, null, 2)}
          </pre>

          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={copyResponse}
            className="w-fit"
          >
            {copied ? "Copied!" : "Copy Response"}
          </Button>
        </div>
      )}
    </div>
  )
}
