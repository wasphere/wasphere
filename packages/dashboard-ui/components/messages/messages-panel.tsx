"use client"

import * as React from "react"
import { toast } from "sonner"
import { Send, ChevronDown, Clock } from "lucide-react"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { MessageTypeSelector } from "@/components/messages/message-type-selector"
import { ResponsePanel } from "@/components/messages/response-panel"
import { PhonePreview } from "@/components/messages/phone-preview"
import { CodeSnippet } from "@/components/messages/code-snippet"
import { TextForm } from "@/components/messages/forms/text-form"
import { ImageForm } from "@/components/messages/forms/image-form"
import { VideoForm } from "@/components/messages/forms/video-form"
import { AudioForm } from "@/components/messages/forms/audio-form"
import { DocumentForm } from "@/components/messages/forms/document-form"
import { StickerForm } from "@/components/messages/forms/sticker-form"
import { GifForm } from "@/components/messages/forms/gif-form"
import { LocationForm } from "@/components/messages/forms/location-form"
import { ContactForm } from "@/components/messages/forms/contact-form"
import { ButtonsForm } from "@/components/messages/forms/buttons-form"
import { ListForm } from "@/components/messages/forms/list-form"
import { PollForm } from "@/components/messages/forms/poll-form"
import { ReactionForm } from "@/components/messages/forms/reaction-form"
import { ViewOnceForm } from "@/components/messages/forms/view-once-form"
import { type MessageType } from "@/lib/message-types"
import { EmptyState } from "@/components/ui/empty-state"
import { MessagesIllustration } from "@/components/empty-states"
import { StatusDot } from "@/components/ui/status-dot"
import { normalizePhone } from "@/lib/phone-format"
import { cn } from "@/lib/utils"

interface SessionItem {
  id: string
  phoneNumber?: string | null
  name?: string | null
  status: string
}

interface BulkJob {
  status: string
  sent?: number
  total?: number
  [key: string]: unknown
}

interface MessagesPanelProps {
  sessions: SessionItem[]
  sessionsError?: string
}

function sessionLabel(s: SessionItem): string {
  return s.name ?? s.phoneNumber ?? s.id
}

type ResponseState = "idle" | "loading" | "success" | "error"

// Live status pill for the session row
function LivePill({ status }: { status: string }) {
  if (status === "connected") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-green-200 dark:border-green-800/50 bg-green-50 dark:bg-green-950/30 px-2 py-0.5 text-[11px] font-medium text-green-800 dark:text-green-300 shrink-0">
        <span className="inline-block size-1.5 rounded-full bg-green-500 animate-pulse" />
        Live
      </span>
    )
  }
  if (status === "qr_ready" || status === "connecting") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 dark:border-amber-800/50 bg-amber-50 dark:bg-amber-950/30 px-2 py-0.5 text-[11px] font-medium text-amber-800 dark:text-amber-300 shrink-0">
        <span className="inline-block size-1.5 rounded-full bg-amber-500 animate-pulse" />
        QR Pending
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-red-200 dark:border-red-800/50 bg-red-50 dark:bg-red-950/30 px-2 py-0.5 text-[11px] font-medium text-red-800 dark:text-red-300 shrink-0">
      <span className="inline-block size-1.5 rounded-full bg-red-500" />
      Offline
    </span>
  )
}

function renderForm(
  type: MessageType,
  onSubmit: (body: Record<string, unknown>) => Promise<void>,
  submitting: boolean,
  onTextChange: (t: string) => void
): React.ReactNode {
  switch (type) {
    case "text":     return <TextForm onSubmit={onSubmit} submitting={submitting} onTextChange={onTextChange} />
    case "image":    return <ImageForm onSubmit={onSubmit} submitting={submitting} />
    case "video":    return <VideoForm onSubmit={onSubmit} submitting={submitting} />
    case "audio":    return <AudioForm onSubmit={onSubmit} submitting={submitting} />
    case "document": return <DocumentForm onSubmit={onSubmit} submitting={submitting} />
    case "sticker":  return <StickerForm onSubmit={onSubmit} submitting={submitting} />
    case "gif":      return <GifForm onSubmit={onSubmit} submitting={submitting} />
    case "location": return <LocationForm onSubmit={onSubmit} submitting={submitting} />
    case "contact":  return <ContactForm onSubmit={onSubmit} submitting={submitting} />
    case "buttons":  return <ButtonsForm onSubmit={onSubmit} submitting={submitting} />
    case "list":     return <ListForm onSubmit={onSubmit} submitting={submitting} />
    case "poll":     return <PollForm onSubmit={onSubmit} submitting={submitting} />
    case "reaction": return <ReactionForm onSubmit={onSubmit} submitting={submitting} />
    case "view-once":return <ViewOnceForm onSubmit={onSubmit} submitting={submitting} />
  }
}

export function MessagesPanel({ sessions, sessionsError }: MessagesPanelProps) {
  const connectedSessions = sessions.filter((s) => s.status === "connected")
  const [selectedSessionId, setSelectedSessionId] = React.useState<string>(
    connectedSessions[0]?.id ?? sessions[0]?.id ?? ""
  )
  const [activeTab, setActiveTab] = React.useState<"single" | "bulk">("single")

  // Recipient state (lifted for compact inline row)
  const [recipientType, setRecipientType] = React.useState<"personal" | "group">("personal")
  const [to, setTo] = React.useState("")
  const [toError, setToError] = React.useState("")

  // Single tab state
  const [messageType, setMessageType] = React.useState<MessageType>("text")
  const [submitting, setSubmitting] = React.useState(false)

  // Preview data — live-bound from forms where supported
  const [previewData, setPreviewData] = React.useState<Record<string, unknown>>({})

  // Response panel state
  const [responseState, setResponseState] = React.useState<ResponseState>("idle")
  const [responseStatusCode, setResponseStatusCode] = React.useState<number | undefined>()
  const [responseTimestamp, setResponseTimestamp] = React.useState<string | undefined>()
  const [responseData, setResponseData] = React.useState<unknown>(undefined)
  const [lastRequest, setLastRequest] = React.useState<{ method: string; url: string; body: unknown } | undefined>()
  const [responseExpanded, setResponseExpanded] = React.useState(false)

  // Bulk tab state
  const [recipients, setRecipients] = React.useState("")
  const [bulkText, setBulkText] = React.useState("")
  const [bulkDelayMs, setBulkDelayMs] = React.useState(1000)
  const [bulkSubmitting, setBulkSubmitting] = React.useState(false)
  const [bulkErrors, setBulkErrors] = React.useState<Partial<Record<"recipients" | "text", string>>>({})
  const [bulkJob, setBulkJob] = React.useState<BulkJob | null>(null)
  const [pollingJobId, setPollingJobId] = React.useState<string | null>(null)

  const intervalRef = React.useRef<ReturnType<typeof setInterval> | null>(null)
  const isFetchingRef = React.useRef(false)

  // Reset preview data when type changes
  React.useEffect(() => { setPreviewData({}) }, [messageType])

  const clearPoller = () => {
    if (intervalRef.current !== null) { clearInterval(intervalRef.current); intervalRef.current = null }
  }

  const pollJob = React.useCallback(async (jobId: string) => {
    if (isFetchingRef.current) return
    isFetchingRef.current = true
    try {
      const res = await fetch(`/api/messages/bulk/${jobId}`)
      if (!res.ok) { clearPoller(); setPollingJobId(null); toast.error("Failed to fetch job status."); return }
      const job: BulkJob = (await res.json()) as BulkJob
      setBulkJob(job)
      if (job.status === "completed") { clearPoller(); setPollingJobId(null); toast.success("Bulk send completed.") }
      else if (job.status === "failed") { clearPoller(); setPollingJobId(null); toast.error("Bulk send failed.") }
    } catch {
      clearPoller(); setPollingJobId(null); toast.error("Could not reach the server.")
    } finally { isFetchingRef.current = false }
  }, [])

  React.useEffect(() => {
    if (!pollingJobId) return
    isFetchingRef.current = false
    pollJob(pollingJobId)
    intervalRef.current = setInterval(() => pollJob(pollingJobId), 3000)
    return () => { clearPoller() }
  }, [pollingJobId, pollJob])

  const handleFormSubmit = async (body: Record<string, unknown>) => {
    if (!to.trim()) { setToError("Recipient is required."); return }
    setToError("")
    setSubmitting(true)
    setResponseState("loading")
    setResponseExpanded(true)

    const requestBody = { sessionId: selectedSessionId, to: to.trim(), ...body }
    const requestUrl = `/api/messages/${messageType}`
    setLastRequest({ method: "POST", url: requestUrl, body: requestBody })

    try {
      const res = await fetch(requestUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      })
      const data: unknown = await res.json().catch(() => ({}))
      setResponseStatusCode(res.status)
      setResponseTimestamp(new Date().toISOString())
      setResponseData(data)
      setResponseState(res.ok ? "success" : "error")
    } catch {
      setResponseState("error")
      setResponseTimestamp(new Date().toISOString())
      setResponseData({ message: "Could not reach WA Server. Check Settings → WA Server configuration." })
      setResponseStatusCode(undefined)
    } finally { setSubmitting(false) }
  }

  const handleBulkSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const recipientList = recipients.split("\n").map((r) => r.trim()).filter(Boolean)
    const errors: Partial<Record<"recipients" | "text", string>> = {}
    if (recipientList.length === 0) errors.recipients = "At least one recipient is required."
    if (!bulkText.trim()) errors.text = "Message text is required."
    if (Object.keys(errors).length > 0) { setBulkErrors(errors); return }
    setBulkErrors({})
    setBulkSubmitting(true)
    setBulkJob(null)
    try {
      const res = await fetch("/api/messages/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: selectedSessionId, recipients: recipientList, text: bulkText.trim(), delayMs: bulkDelayMs }),
      })
      const data = (await res.json().catch(() => ({}))) as Record<string, unknown>
      if (!res.ok) { toast.error(typeof data.message === "string" ? data.message : "Failed to start bulk send."); return }
      const jobId = typeof data.jobId === "string" ? data.jobId : typeof data.id === "string" ? data.id : ""
      if (jobId) { setPollingJobId(jobId); setBulkJob(data as BulkJob); toast.success("Bulk job started.") }
      else { toast.success("Bulk send initiated.") }
    } catch { toast.error("Could not reach the server.") }
    finally { setBulkSubmitting(false) }
  }

  const noConnected = connectedSessions.length === 0
  const selectedSession = sessions.find((s) => s.id === selectedSessionId)
  const bulkProgress = bulkJob && typeof bulkJob.sent === "number" && typeof bulkJob.total === "number" && bulkJob.total > 0
    ? Math.round((bulkJob.sent / bulkJob.total) * 100) : null

  return (
    <div className="flex flex-col gap-4">
      {/* Page header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 ring-1 ring-primary/20 shadow-sm dark:shadow-[0_0_18px_rgba(34,197,94,0.22)]">
          <Send size={18} className="text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">Messages</h1>
          <p className="text-sm text-muted-foreground">Test and send WhatsApp messages.</p>
        </div>
      </div>

      {/* Alerts */}
      {sessionsError && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {sessionsError}
        </div>
      )}
      {sessions.length === 0 && !sessionsError && (
        <EmptyState
          illustration={<MessagesIllustration />}
          message="No sessions yet"
          description="Create a session to start sending messages."
          action={<a href="/dashboard/sessions" className="text-sm font-medium text-primary underline underline-offset-2">Go to Sessions</a>}
        />
      )}
      {noConnected && sessions.length > 0 && (
        <div className="rounded-lg border border-amber-400/40 bg-amber-50/60 dark:bg-amber-900/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
          No connected sessions.{" "}
          <a href="/dashboard/sessions" className="font-medium underline underline-offset-2">Go to Sessions</a>{" "}
          and connect a WhatsApp account.
        </div>
      )}

      {/* ── Config + recipient bar — single compact card ── */}
      <Card>
        <CardContent className="px-4 py-2.5">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            {/* Session */}
            <div className="flex items-center gap-2">
              <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground shrink-0">
                Session
              </Label>
              <Select value={selectedSessionId} onValueChange={(v) => { if (v) setSelectedSessionId(v) }}>
                <SelectTrigger className="h-7 w-40 text-xs">
                  <SelectValue placeholder="Select session" />
                </SelectTrigger>
                <SelectContent>
                  {sessions.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      <div className="flex items-center gap-1.5">
                        <StatusDot status={s.status} />
                        <span>{sessionLabel(s)}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedSession && <LivePill status={selectedSession.status} />}
            </div>

            <div className="h-4 w-px bg-border hidden sm:block" />

            {/* Mode toggle */}
            <div className="flex items-center gap-2">
              <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground shrink-0">
                Mode
              </Label>
              <div className="flex gap-0.5 p-0.5 bg-muted rounded-lg">
                {(["single", "bulk"] as const).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setActiveTab(tab)}
                    className={cn(
                      "px-3 py-1 text-xs font-medium rounded-md transition-all duration-150 cursor-pointer",
                      activeTab === tab ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {tab === "single" ? "Single" : "Bulk"}
                  </button>
                ))}
              </div>
            </div>

            {/* Recipient — only in single mode */}
            {activeTab === "single" && (
              <>
                <div className="h-4 w-px bg-border hidden sm:block" />
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground shrink-0">
                    To
                  </Label>
                  <div className="flex gap-0.5 p-0.5 bg-muted rounded-md shrink-0">
                    {(["personal", "group"] as const).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setRecipientType(t)}
                        className={cn(
                          "px-2.5 py-0.5 text-xs font-medium rounded transition-all duration-150 cursor-pointer capitalize",
                          recipientType === t ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                        )}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                  <Input
                    placeholder={recipientType === "personal" ? "+923XXXXXXXXX" : "XXXXXXXXXX@g.us"}
                    value={to}
                    onChange={(e) => {
                      const raw = e.target.value
                      let formatted = raw
                      if (recipientType === "personal" && raw && !raw.startsWith("+") && !raw.includes("@") && /^\d/.test(raw)) {
                        formatted = "+" + raw
                      }
                      setTo(formatted)
                    }}
                    onBlur={() => { const n = normalizePhone(to); if (n !== to) setTo(n) }}
                    className={cn("flex-1 h-7 text-xs min-w-[120px]", toError && "border-destructive")}
                  />
                </div>
              </>
            )}
          </div>
          {toError && activeTab === "single" && (
            <p className="text-xs text-destructive mt-1.5">{toError}</p>
          )}
        </CardContent>
      </Card>

      {/* ── Main grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] gap-5 items-start">

        {/* ── Left: forms ── */}
        <div className="flex flex-col gap-3">

          {/* Single mode */}
          {activeTab === "single" && (
            <>
              {/* Compose card */}
              <Card>
                <CardHeader className="px-4 py-2 border-b border-border/60">
                  <CardTitle className="text-sm font-semibold text-foreground">Compose</CardTitle>
                </CardHeader>
                <CardContent className="p-4 flex flex-col gap-3">
                  <MessageTypeSelector value={messageType} onChange={(t) => { setMessageType(t); setPreviewData({}) }} />
                  <div className="border-t border-border/60 pt-3">
                    {renderForm(messageType, handleFormSubmit, submitting, (text) => setPreviewData((d) => ({ ...d, text })))}
                  </div>
                </CardContent>
              </Card>
            </>
          )}

          {/* Bulk mode */}
          {activeTab === "bulk" && (
            <Card>
              <CardHeader className="px-4 pt-3.5 pb-2.5 border-b border-border/60">
                <CardTitle className="text-sm font-semibold">Bulk Send</CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <form onSubmit={handleBulkSubmit} className="flex flex-col gap-4">
                  <div className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-primary/80 dark:text-primary/70">
                    Bulk send supports <strong>text messages</strong> only. Up to 50 recipients per job.
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="bulk-recipients" className="text-sm font-medium">
                      Recipients <span className="text-muted-foreground font-normal">(one JID per line, max 50)</span>
                    </Label>
                    <Textarea id="bulk-recipients" placeholder={"447911123456@s.whatsapp.net\n447911654321@s.whatsapp.net"}
                      value={recipients} onChange={(e) => setRecipients(e.target.value)} rows={4} />
                    {bulkErrors.recipients && <p className="text-xs text-destructive">{bulkErrors.recipients}</p>}
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="bulk-text" className="text-sm font-medium">Message</Label>
                      <span className="text-xs text-muted-foreground tabular-nums">{bulkText.length} / 65536</span>
                    </div>
                    <Textarea id="bulk-text" placeholder="Type your message…"
                      value={bulkText} onChange={(e) => setBulkText(e.target.value)} rows={3} />
                    {bulkErrors.text && <p className="text-xs text-destructive">{bulkErrors.text}</p>}
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="bulk-delay" className="text-sm font-medium">Delay Between Sends</Label>
                      <span className="text-xs font-mono font-medium text-primary tabular-nums">{(bulkDelayMs / 1000).toFixed(1)}s</span>
                    </div>
                    <input id="bulk-delay" type="range" min={1000} max={10000} step={500}
                      value={bulkDelayMs} onChange={(e) => setBulkDelayMs(Number(e.target.value))}
                      className="w-full accent-primary h-1.5 rounded-full cursor-pointer" />
                    <p className="text-xs text-muted-foreground">Recommended 2–5 s to avoid rate limits.</p>
                  </div>

                  <Button type="submit" disabled={bulkSubmitting || pollingJobId !== null} className="w-fit">
                    {bulkSubmitting ? "Starting…" : "Send to All"}
                  </Button>

                  {bulkJob && (
                    <div className="rounded-lg border bg-muted/40 px-4 py-3 flex flex-col gap-2">
                      {bulkJob.status === "completed" ? (
                        <p className="text-sm font-medium text-green-600 dark:text-green-400">
                          Completed{typeof bulkJob.sent === "number" && typeof bulkJob.total === "number" && ` — ${bulkJob.sent} / ${bulkJob.total} sent`}
                        </p>
                      ) : bulkJob.status === "failed" ? (
                        <p className="text-sm font-medium text-destructive">Failed</p>
                      ) : (
                        <>
                          <div className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <div className="size-3.5 animate-spin rounded-full border-2 border-muted border-t-primary" />
                              <span>{typeof bulkJob.sent === "number" && typeof bulkJob.total === "number"
                                ? `Sending… ${bulkJob.sent} / ${bulkJob.total}` : `Status: ${bulkJob.status}`}</span>
                            </div>
                            {bulkProgress !== null && <span className="text-xs font-mono text-primary">{bulkProgress}%</span>}
                          </div>
                          {bulkProgress !== null && (
                            <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                              <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${bulkProgress}%` }} />
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </form>
              </CardContent>
            </Card>
          )}
        </div>

        {/* ── Right: preview + code + response ── */}
        <div className="flex flex-col gap-3 lg:sticky lg:top-20">
          {/* Phone preview */}
          <PhonePreview messageType={messageType} recipient={to} previewData={previewData} />

          {/* Code snippet */}
          <CodeSnippet messageType={messageType} sessionId={selectedSessionId} recipient={to} previewData={previewData} />

          {/* API Response — collapsed until a send happens */}
          {!responseExpanded && responseState === "idle" ? (
            <button
              type="button"
              onClick={() => setResponseExpanded(true)}
              className="flex items-center justify-between w-full rounded-xl border border-border bg-muted/50 px-3 py-2.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-all duration-150 cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <Clock size={13} />
                <span>API response appears here after send</span>
              </div>
              <ChevronDown size={13} />
            </button>
          ) : (
            <ResponsePanel
              state={responseState}
              statusCode={responseStatusCode}
              timestamp={responseTimestamp}
              data={responseData}
              request={lastRequest}
            />
          )}
        </div>
      </div>
    </div>
  )
}
