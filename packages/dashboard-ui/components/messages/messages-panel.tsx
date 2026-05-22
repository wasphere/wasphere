"use client"

import * as React from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface ConnectedSession {
  id: string
  phoneNumber?: string | null
  name?: string | null
}

interface BulkJob {
  status: string
  sent?: number
  total?: number
  [key: string]: unknown
}

interface MessagesPanelProps {
  connectedSessions: ConnectedSession[]
}

function sessionLabel(session: ConnectedSession): string {
  return session.name ?? session.phoneNumber ?? session.id
}

export function MessagesPanel({ connectedSessions }: MessagesPanelProps) {
  const [selectedSessionId, setSelectedSessionId] = React.useState<string>(
    connectedSessions[0]?.id ?? ""
  )
  const [activeTab, setActiveTab] = React.useState<"single" | "bulk">("single")

  // Single tab state
  const [to, setTo] = React.useState("")
  const [messageType, setMessageType] = React.useState<"text" | "image">("text")
  const [singleText, setSingleText] = React.useState("")
  const [imageUrl, setImageUrl] = React.useState("")
  const [caption, setCaption] = React.useState("")
  const [singleSubmitting, setSingleSubmitting] = React.useState(false)
  const [singleErrors, setSingleErrors] = React.useState<
    Partial<Record<"to" | "text" | "imageUrl", string>>
  >({})

  // Bulk tab state
  const [recipients, setRecipients] = React.useState("")
  const [bulkText, setBulkText] = React.useState("")
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

  const pollJob = React.useCallback(
    async (jobId: string) => {
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

        const job: BulkJob = await res.json()
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
    },
    []
  )

  React.useEffect(() => {
    if (!pollingJobId) return

    isFetchingRef.current = false
    pollJob(pollingJobId)
    intervalRef.current = setInterval(() => pollJob(pollingJobId), 3000)

    return () => {
      clearPoller()
    }
  }, [pollingJobId, pollJob])

  const handleSingleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const errors: Partial<Record<"to" | "text" | "imageUrl", string>> = {}
    if (!to.trim()) errors.to = "Recipient phone number is required."
    if (messageType === "text" && !singleText.trim()) {
      errors.text = "Message text is required."
    }
    if (messageType === "image" && !imageUrl.trim()) {
      errors.imageUrl = "Image URL is required."
    }

    if (Object.keys(errors).length > 0) {
      setSingleErrors(errors)
      return
    }

    setSingleErrors({})
    setSingleSubmitting(true)

    try {
      const body: Record<string, string> = {
        sessionId: selectedSessionId,
        to: to.trim(),
      }

      if (messageType === "text") {
        body.text = singleText.trim()
      } else {
        body.imageUrl = imageUrl.trim()
        if (caption.trim()) {
          body.caption = caption.trim()
        }
      }

      const res = await fetch("/api/messages/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })

      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        toast.error(data.message ?? "Failed to send message.")
        return
      }

      toast.success("Message sent.")
      setTo("")
      setSingleText("")
      setImageUrl("")
      setCaption("")
    } catch {
      toast.error("Could not reach the server.")
    } finally {
      setSingleSubmitting(false)
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
        }),
      })

      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        toast.error(data.message ?? "Failed to start bulk send.")
        return
      }

      const jobId: string = data.jobId ?? data.id ?? ""
      if (jobId) {
        setPollingJobId(jobId)
        setBulkJob(data)
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

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Messages</h1>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>Session</Label>
        <Select
          value={selectedSessionId}
          onValueChange={(val) => setSelectedSessionId(val as string)}
        >
          <SelectTrigger className="w-64">
            <SelectValue placeholder="Select a session" />
          </SelectTrigger>
          <SelectContent>
            {connectedSessions.map((session) => (
              <SelectItem key={session.id} value={session.id}>
                {sessionLabel(session)}
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
          <TabsTrigger value="single">Single</TabsTrigger>
          <TabsTrigger value="bulk">Bulk</TabsTrigger>
        </TabsList>

        <TabsContent value="single" className="mt-4">
          <form
            onSubmit={handleSingleSubmit}
            className="flex flex-col gap-4 max-w-lg"
          >
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="single-to">Recipient</Label>
              <Input
                id="single-to"
                placeholder="447911123456@s.whatsapp.net"
                value={to}
                onChange={(e) => setTo(e.target.value)}
              />
              {singleErrors.to && (
                <p className="text-xs text-destructive">{singleErrors.to}</p>
              )}
            </div>

            <div className="flex gap-2">
              <Button
                type="button"
                variant={messageType === "text" ? "default" : "outline"}
                size="sm"
                onClick={() => setMessageType("text")}
              >
                Text
              </Button>
              <Button
                type="button"
                variant={messageType === "image" ? "default" : "outline"}
                size="sm"
                onClick={() => setMessageType("image")}
              >
                Image
              </Button>
            </div>

            {messageType === "text" ? (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="single-text">Message</Label>
                <Textarea
                  id="single-text"
                  placeholder="Type your message…"
                  value={singleText}
                  onChange={(e) => setSingleText(e.target.value)}
                  rows={4}
                />
                {singleErrors.text && (
                  <p className="text-xs text-destructive">{singleErrors.text}</p>
                )}
              </div>
            ) : (
              <>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="image-url">Image URL</Label>
                  <Input
                    id="image-url"
                    placeholder="https://example.com/image.jpg"
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                  />
                  {singleErrors.imageUrl && (
                    <p className="text-xs text-destructive">
                      {singleErrors.imageUrl}
                    </p>
                  )}
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="image-caption">
                    Caption{" "}
                    <span className="text-muted-foreground font-normal">
                      (optional)
                    </span>
                  </Label>
                  <Textarea
                    id="image-caption"
                    placeholder="Image caption…"
                    value={caption}
                    onChange={(e) => setCaption(e.target.value)}
                    rows={2}
                  />
                </div>
              </>
            )}

            <Button type="submit" disabled={singleSubmitting} className="w-fit">
              {singleSubmitting ? "Sending…" : "Send Message"}
            </Button>
          </form>
        </TabsContent>

        <TabsContent value="bulk" className="mt-4">
          <form
            onSubmit={handleBulkSubmit}
            className="flex flex-col gap-4 max-w-lg"
          >
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="bulk-recipients">
                Recipients{" "}
                <span className="text-muted-foreground font-normal">
                  (one phone number per line)
                </span>
              </Label>
              <Textarea
                id="bulk-recipients"
                placeholder={
                  "447911123456@s.whatsapp.net\n447911654321@s.whatsapp.net"
                }
                value={recipients}
                onChange={(e) => setRecipients(e.target.value)}
                rows={5}
              />
              {bulkErrors.recipients && (
                <p className="text-xs text-destructive">
                  {bulkErrors.recipients}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="bulk-text">Message</Label>
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

            <Button type="submit" disabled={bulkSubmitting || pollingJobId !== null} className="w-fit">
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
  )
}
