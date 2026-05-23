"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { CheckCircle2, XCircle, Loader2, Terminal, Copy, Check } from "lucide-react"

interface RequestInfo {
  method: string
  url: string
  body: unknown
}

interface ResponsePanelProps {
  state: "idle" | "loading" | "success" | "error"
  statusCode?: number
  timestamp?: string
  data?: unknown
  request?: RequestInfo
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

function CopyButton({
  onClick,
  copied,
  label,
  size = "xs",
}: {
  onClick: () => void
  copied: boolean
  label: string
  size?: "xs" | "sm"
}) {
  return (
    <Button
      type="button"
      size={size as "sm"}
      variant="ghost"
      onClick={onClick}
      className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground gap-1"
    >
      {copied ? <Check size={11} /> : <Copy size={11} />}
      {copied ? "Copied" : label}
    </Button>
  )
}

export function ResponsePanel({
  state,
  statusCode,
  timestamp,
  data,
  request,
}: ResponsePanelProps) {
  const [copied, setCopied] = React.useState(false)
  const [copiedId, setCopiedId] = React.useState(false)
  const [copiedCurl, setCopiedCurl] = React.useState(false)

  const copyResponse = async () => {
    await navigator.clipboard.writeText(JSON.stringify(data, null, 2)).catch(() => null)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const copyMessageId = async (id: string) => {
    await navigator.clipboard.writeText(id).catch(() => null)
    setCopiedId(true)
    setTimeout(() => setCopiedId(false), 2000)
  }

  const copyCurl = async () => {
    if (!request) return
    const bodyJson = JSON.stringify(request.body, null, 2)
    const curl = `curl -X ${request.method} '${window.location.origin}${request.url}' \\\n  -H 'Content-Type: application/json' \\\n  -d '${bodyJson}'`
    await navigator.clipboard.writeText(curl).catch(() => null)
    setCopiedCurl(true)
    setTimeout(() => setCopiedCurl(false), 2000)
  }

  const messageId = data ? extractMessageId(data) : null

  const cardBorderClass =
    state === "success"
      ? "border-green-500/30 dark:border-green-500/20"
      : state === "error"
        ? "border-destructive/30 dark:border-destructive/20"
        : ""

  return (
    <Card className={cn("flex flex-col gap-0 overflow-hidden transition-colors duration-300", cardBorderClass)}>
      {/* Header */}
      <CardHeader className="px-4 py-3 border-b border-border/60 flex-row items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Terminal size={14} className="text-muted-foreground" />
          <span className="text-sm font-semibold text-foreground">API Response</span>
        </div>
        {state === "success" && (
          <div className="flex items-center gap-1.5 text-xs font-medium text-green-600 dark:text-green-400">
            <CheckCircle2 size={13} />
            {timestamp && <span>{formatTimestamp(timestamp)}</span>}
          </div>
        )}
        {state === "error" && (
          <div className="flex items-center gap-1.5 text-xs font-medium text-destructive">
            <XCircle size={13} />
            {timestamp && <span>{formatTimestamp(timestamp)}</span>}
          </div>
        )}
        {state === "loading" && (
          <Loader2 size={14} className="animate-spin text-muted-foreground" />
        )}
      </CardHeader>

      <CardContent className="p-4 flex flex-col gap-4">
        {/* Idle — no request yet */}
        {state === "idle" && !request && (
          <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted">
              <Terminal size={18} className="text-muted-foreground/50" />
            </div>
            <p className="text-sm text-muted-foreground">Send a message to see the response</p>
          </div>
        )}

        {/* Request block */}
        {request && (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Request</span>
              <CopyButton onClick={copyCurl} copied={copiedCurl} label="Copy as curl" />
            </div>
            <pre className="bg-zinc-950 text-zinc-100 rounded-lg p-3 overflow-auto text-xs font-mono max-h-40 whitespace-pre-wrap break-all leading-relaxed">
              <span className="text-blue-400">{request.method}</span>{" "}
              <span className="text-green-400">{request.url}</span>{"\n"}
              {JSON.stringify(request.body, null, 2)}
            </pre>
          </div>
        )}

        {/* Loading */}
        {state === "loading" && (
          <div className="flex items-center justify-center py-8">
            <div className="flex flex-col items-center gap-2">
              <div className="size-6 animate-spin rounded-full border-2 border-muted border-t-primary" />
              <p className="text-xs text-muted-foreground">Sending…</p>
            </div>
          </div>
        )}

        {/* Success / Error */}
        {(state === "success" || state === "error") && (
          <div className="flex flex-col gap-3">
            {/* Status badge */}
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={cn(
                  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold tabular-nums",
                  getStatusBadgeClass(statusCode)
                )}
              >
                {statusCode ?? "Network Error"}
              </span>
            </div>

            {/* Message ID */}
            {messageId && (
              <div className="flex flex-col gap-1">
                <p className="text-xs font-medium text-muted-foreground">Message ID</p>
                <div className="flex items-center gap-2">
                  <code className="text-xs font-mono bg-muted rounded-md px-2 py-1.5 flex-1 break-all text-foreground/80">
                    {messageId}
                  </code>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => copyMessageId(messageId)}
                    className="h-7 px-2 shrink-0"
                  >
                    {copiedId ? <Check size={12} /> : <Copy size={12} />}
                  </Button>
                </div>
              </div>
            )}

            {/* Response body */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">Response</span>
                <CopyButton onClick={copyResponse} copied={copied} label="Copy" />
              </div>
              <pre className="bg-zinc-950 text-zinc-100 rounded-lg p-3 overflow-auto text-xs font-mono max-h-64 whitespace-pre-wrap break-all leading-relaxed">
                {JSON.stringify(data, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
