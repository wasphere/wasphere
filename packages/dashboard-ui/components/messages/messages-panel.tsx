"use client"

import * as React from "react"
import { toast } from "sonner"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { MessageTypeSelector } from "@/components/messages/message-type-selector"
import { RecipientInput } from "@/components/messages/recipient-input"
import { ResponsePanel } from "@/components/messages/response-panel"
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

function sessionLabel(session: SessionItem): string {
  return session.name ?? session.phoneNumber ?? session.id
}

type ResponseState = "idle" | "loading" | "success" | "error"

function renderForm(
  type: MessageType,
  onSubmit: (body: Record<string, unknown>) => Promise<void>,
  submitting: boolean
): React.ReactNode {
  switch (type) {
    case "text":
      return <TextForm onSubmit={onSubmit} submitting={submitting} />
    case "image":
      return <ImageForm onSubmit={onSubmit} submitting={submitting} />
    case "video":
      return <VideoForm onSubmit={onSubmit} submitting={submitting} />
    case "audio":
      return <AudioForm onSubmit={onSubmit} submitting={submitting} />
    case "document":
      return <DocumentForm onSubmit={onSubmit} submitting={submitting} />
    case "sticker":
      return <StickerForm onSubmit={onSubmit} submitting={submitting} />
    case "gif":
      return <GifForm onSubmit={onSubmit} submitting={submitting} />
    case "location":
      return <LocationForm onSubmit={onSubmit} submitting={submitting} />
    case "contact":
      return <ContactForm onSubmit={onSubmit} submitting={submitting} />
    case "buttons":
      return <ButtonsForm onSubmit={onSubmit} submitting={submitting} />
    case "list":
      return <ListForm onSubmit={onSubmit} submitting={submitting} />
    case "poll":
      return <PollForm onSubmit={onSubmit} submitting={submitting} />
    case "reaction":
      return <ReactionForm onSubmit={onSubmit} submitting={submitting} />
    case "view-once":
      return <ViewOnceForm onSubmit={onSubmit} submitting={submitting} />
  }
}

export function MessagesPanel({ sessions, sessionsError }: MessagesPanelProps) {
  const connectedSessions = sessions.filter((s) => s.status === "connected")
  const [selectedSessionId, setSelectedSessionId] = React.useState<string>(
    connectedSessions[0]?.id ?? sessions[0]?.id ?? ""
  )
  const [activeTab, setActiveTab] = React.useState<"single" | "bulk">("single")

  // Single tab state
  const [messageType, setMessageType] = React.useState<MessageType>("text")
  const [to, setTo] = React.useState("")
  const [toError, setToError] = React.useState("")
  const [submitting, setSubmitting] = React.useState(false)

  // Response panel state
  const [responseState, setResponseState] = React.useState<ResponseState>("idle")
  const [responseStatusCode, setResponseStatusCode] = React.useState<number | undefined>()
  const [responseTimestamp, setResponseTimestamp] = React.useState<string | undefined>()
  const [responseData, setResponseData] = React.useState<unknown>(undefined)
  const [lastRequest, setLastRequest] = React.useState<{ method: string; url: string; body: unknown } | undefined>()

  // Bulk tab state
  const [recipients, setRecipients] = React.useState("")
  const [bulkText, setBulkText] = React.useState("")
  const [bulkDelayMs, setBulkDelayMs] = React.useState(1000)
  const [bulkSubmitting, setBulkSubmitting] = React.useState(false)
  const [bulkErrors, setBulkErrors] = React.useState<
    Partial<Record<"recipients" | "text", string>>
  >({})
  const [bulkJob, setBulkJob] = React.useState<BulkJob | null>(null)
  const [pollingJobId, setPollingJobId] = React.useState<string | null>(null)

  const intervalRef = React.useRef<ReturnType<typeof setInterval> | null>(null)
  const isFetchingRef = React.useRef(false)

  const clearPoller = () => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }

  const pollJob = React.useCallback(async (jobId: string) => {
    if (isFetchingRef.current) return
    isFetchingRef.current = true

    try {
      const res = await fetch(`/api/messages/bulk/${jobId}`)
      if (!res.ok) {
        clearPoller()
        setPollingJobId(null)
        toast.error("Failed to fetch job status.")
        isFetchingRef.current = false
        return
      }

      const job: BulkJob = (await res.json()) as BulkJob
      setBulkJob(job)

      if (job.status === "completed") {
        clearPoller()
        setPollingJobId(null)
        toast.success("Bulk send completed.")
      } else if (job.status === "failed") {
        clearPoller()
        setPollingJobId(null)
        toast.error("Bulk send failed.")
      }
    } catch {
      clearPoller()
      setPollingJobId(null)
      toast.error("Could not reach the server.")
    } finally {
      isFetchingRef.current = false
    }
  }, [])

  React.useEffect(() => {
    if (!pollingJobId) return

    isFetchingRef.current = false
    pollJob(pollingJobId)
    intervalRef.current = setInterval(() => pollJob(pollingJobId), 3000)

    return () => {
      clearPoller()
    }
  }, [pollingJobId, pollJob])

  const handleFormSubmit = async (body: Record<string, unknown>) => {
    if (!to.trim()) {
      setToError("Recipient is required.")
      return
    }
    setToError("")
    setSubmitting(true)
    setResponseState("loading")

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
    } finally {
      setSubmitting(false)
    }
  }

  const handleBulkSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const recipientList = recipients
      .split("\n")
      .map((r) => r.trim())
      .filter(Boolean)

    const errors: Partial<Record<"recipients" | "text", string>> = {}
    if (recipientList.length === 0) {
      errors.recipients = "At least one recipient is required."
    }
    if (!bulkText.trim()) {
      errors.text = "Message text is required."
    }

    if (Object.keys(errors).length > 0) {
      setBulkErrors(errors)
      return
    }

    setBulkErrors({})
    setBulkSubmitting(true)
    setBulkJob(null)

    try {
      const res = await fetch("/api/messages/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: selectedSessionId,
          recipients: recipientList,
          text: bulkText.trim(),
          delayMs: bulkDelayMs,
        }),
      })

      const data: Record<string, unknown> = (await res
        .json()
        .catch(() => ({}))) as Record<string, unknown>

      if (!res.ok) {
        toast.error(
          typeof data.message === "string" ? data.message : "Failed to start bulk send."
        )
        return
      }

      const jobId =
        typeof data.jobId === "string"
          ? data.jobId
          : typeof data.id === "string"
            ? data.id
            : ""

      if (jobId) {
        setPollingJobId(jobId)
        setBulkJob(data as BulkJob)
        toast.success("Bulk job started.")
      } else {
        toast.success("Bulk send initiated.")
      }
    } catch {
      toast.error("Could not reach the server.")
    } finally {
      setBulkSubmitting(false)
    }
  }

  const noConnected = connectedSessions.length === 0

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-6">
      {/* Left: form area */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Messages</h1>
            <p className="text-sm text-zinc-700 dark:text-zinc-300">Test and send WhatsApp messages.</p>
          </div>
        </div>

        {sessionsError && (
          <div className="rounded-md border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            {sessionsError}
          </div>
        )}

        {sessions.length === 0 && !sessionsError && (
          <div className="rounded-md border bg-muted/40 px-4 py-6 text-center">
            <p className="text-sm font-medium text-foreground">No sessions yet</p>
            <p className="text-xs text-zinc-400 mt-1">
              <a href="/dashboard/sessions" className="underline underline-offset-2">Create a session</a> to start sending messages.
            </p>
          </div>
        )}

        {noConnected && sessions.length > 0 && (
          <div className="rounded-lg border border-amber-400/40 bg-amber-50/60 dark:bg-amber-900/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
            No connected sessions. Go to{" "}
            <a href="/dashboard/sessions" className="font-medium underline underline-offset-2">
              Sessions
            </a>{" "}
            and connect a WhatsApp account before sending messages.
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <Label className="text-sm font-medium text-foreground">Session</Label>
          <Select
            value={selectedSessionId}
            onValueChange={(val) => { if (val !== null) setSelectedSessionId(val) }}
          >
            <SelectTrigger className="w-64">
              <SelectValue placeholder="Select a session" />
            </SelectTrigger>
            <SelectContent>
              {sessions.map((session) => (
                <SelectItem key={session.id} value={session.id}>
                  {sessionLabel(session)}
                  {session.status !== "connected" && (
                    <span className="ml-1.5 text-xs text-muted-foreground">({session.status})</span>
                  )}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Tabs
          value={activeTab}
          onValueChange={(val) => setActiveTab(val as "single" | "bulk")}
        >
          <TabsList>
            <TabsTrigger value="single">Single Message</TabsTrigger>
            <TabsTrigger value="bulk">Bulk</TabsTrigger>
          </TabsList>

          <TabsContent value="single" className="mt-4 flex flex-col gap-4">
            <RecipientInput value={to} onChange={setTo} error={toError} />
            <MessageTypeSelector value={messageType} onChange={setMessageType} />
            <div className="rounded-xl border bg-card p-4">
              {renderForm(messageType, handleFormSubmit, submitting)}
            </div>
          </TabsContent>

          <TabsContent value="bulk" className="mt-4">
            <form onSubmit={handleBulkSubmit} className="flex flex-col gap-4 max-w-lg">
              <div className="rounded-lg border border-blue-400/40 bg-blue-50/60 dark:bg-blue-900/10 px-3 py-2 text-xs text-blue-800 dark:text-blue-300">
                Bulk send supports <strong>text messages</strong> only. Up to 50 recipients per job.
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="bulk-recipients">
                  Recipients{" "}
                  <span className="text-muted-foreground font-normal">
                    (one WhatsApp JID per line, max 50)
                  </span>
                </Label>
                <Textarea
                  id="bulk-recipients"
                  placeholder={"447911123456@s.whatsapp.net\n447911654321@s.whatsapp.net"}
                  value={recipients}
                  onChange={(e) => setRecipients(e.target.value)}
                  rows={5}
                />
                {bulkErrors.recipients && (
                  <p className="text-xs text-destructive">{bulkErrors.recipients}</p>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="bulk-text">Message</Label>
                  <span className="text-xs text-muted-foreground">{bulkText.length}/65536</span>
                </div>
                <Textarea
                  id="bulk-text"
                  placeholder="Type your message…"
                  value={bulkText}
                  onChange={(e) => setBulkText(e.target.value)}
                  rows={4}
                />
                {bulkErrors.text && (
                  <p className="text-xs text-destructive">{bulkErrors.text}</p>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="bulk-delay">Delay Between Sends</Label>
                  <span className="text-xs text-muted-foreground">{(bulkDelayMs / 1000).toFixed(1)}s</span>
                </div>
                <input
                  id="bulk-delay"
                  type="range"
                  min={1000}
                  max={10000}
                  step={500}
                  value={bulkDelayMs}
                  onChange={(e) => setBulkDelayMs(Number(e.target.value))}
                  className="w-full accent-primary"
                />
                <p className="text-xs text-zinc-700 dark:text-zinc-300">Recommended 2–5s to avoid rate limits</p>
              </div>

              <Button
                type="submit"
                disabled={bulkSubmitting || pollingJobId !== null}
                className="w-fit"
              >
                {bulkSubmitting ? "Starting…" : "Send to All"}
              </Button>

              {bulkJob && (
                <div className="rounded-lg border bg-muted/40 px-4 py-3 text-sm">
                  {bulkJob.status === "completed" ? (
                    <p className="text-green-600 dark:text-green-400 font-medium">
                      Completed
                      {typeof bulkJob.sent === "number" &&
                        typeof bulkJob.total === "number" &&
                        ` — Sent: ${bulkJob.sent} / ${bulkJob.total}`}
                    </p>
                  ) : bulkJob.status === "failed" ? (
                    <p className="text-destructive font-medium">Failed</p>
                  ) : (
                    <div className="flex items-center gap-2">
                      <div className="size-4 animate-spin rounded-full border-2 border-muted border-t-primary" />
                      <p className="text-muted-foreground">
                        {typeof bulkJob.sent === "number" &&
                        typeof bulkJob.total === "number"
                          ? `Sending… ${bulkJob.sent} / ${bulkJob.total}`
                          : `Status: ${bulkJob.status}`}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </form>
          </TabsContent>
        </Tabs>
      </div>

      {/* Right: response panel */}
      <div className="lg:sticky lg:top-4 h-fit">
        <ResponsePanel
          state={responseState}
          statusCode={responseStatusCode}
          timestamp={responseTimestamp}
          data={responseData}
          request={lastRequest}
        />
      </div>
    </div>
  )
}
