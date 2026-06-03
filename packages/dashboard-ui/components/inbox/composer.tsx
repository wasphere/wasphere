"use client"

import * as React from "react"
import { toast } from "sonner"
import {
  Paperclip, SendHorizonal, MessageSquareText, ImageIcon, FileText,
  BarChart3, X, Plus, Trash2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { StatusDot } from "@/components/ui/status-dot"
import type { OutboundReply } from "./types"

// ~7 MB raw keeps the base64 data URI under the WA server's 10 MB cap.
const MAX_FILE_BYTES = 7 * 1024 * 1024

const SAVED_REPLIES = [
  "Thanks for reaching out! How can I help?",
  "Your order is confirmed and will ship soon. 📦",
  "Could you share your order number, please?",
  "We're closed right now — we'll reply first thing tomorrow.",
]

type Attachment = {
  kind: "image" | "document"
  dataUri: string
  fileName: string
  mimetype: string
  previewUrl?: string
}

function fileToDataUri(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result as string)
    r.onerror = () => reject(r.error)
    r.readAsDataURL(file)
  })
}

export function Composer({
  onSend,
  sending,
  sessionOffline,
}: {
  onSend: (reply: OutboundReply) => Promise<boolean>
  sending: boolean
  sessionOffline: boolean
}) {
  const [text, setText] = React.useState("")
  const [attachment, setAttachment] = React.useState<Attachment | null>(null)
  const imageInputRef = React.useRef<HTMLInputElement>(null)
  const docInputRef = React.useRef<HTMLInputElement>(null)

  const [pollOpen, setPollOpen] = React.useState(false)
  const [pollName, setPollName] = React.useState("")
  const [pollOptions, setPollOptions] = React.useState<string[]>(["", ""])
  const [pollSending, setPollSending] = React.useState(false)

  const busy = sending || sessionOffline

  const pickFile = async (file: File | undefined, kind: "image" | "document") => {
    if (!file) return
    if (file.size > MAX_FILE_BYTES) {
      toast.error("File too large — max 7 MB.")
      return
    }
    try {
      const dataUri = await fileToDataUri(file)
      setAttachment({
        kind,
        dataUri,
        fileName: file.name,
        mimetype: file.type || (kind === "image" ? "image/jpeg" : "application/octet-stream"),
        previewUrl: kind === "image" ? dataUri : undefined,
      })
    } catch {
      toast.error("Could not read the file.")
    }
  }

  const submit = async () => {
    if (busy) return
    if (attachment) {
      const reply: OutboundReply =
        attachment.kind === "image"
          ? { kind: "image", media: attachment.dataUri, caption: text.trim() || undefined }
          : { kind: "document", media: attachment.dataUri, fileName: attachment.fileName, mimetype: attachment.mimetype }
      const ok = await onSend(reply)
      if (ok) { setAttachment(null); setText("") }
      return
    }
    const value = text.trim()
    if (!value) return
    const ok = await onSend({ kind: "text", text: value })
    if (ok) setText("")
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      void submit()
    }
  }

  const sendPoll = async () => {
    const name = pollName.trim()
    const opts = pollOptions.map((o) => o.trim()).filter(Boolean)
    if (!name) { toast.error("Poll needs a question."); return }
    if (opts.length < 2) { toast.error("Poll needs at least 2 options."); return }
    setPollSending(true)
    const ok = await onSend({ kind: "poll", pollName: name, options: opts })
    setPollSending(false)
    if (ok) { setPollOpen(false); setPollName(""); setPollOptions(["", ""]) }
  }

  return (
    <div className="border-t p-3">
      {sessionOffline && (
        <div className="mb-2 flex items-center gap-1.5 text-xs text-muted-foreground">
          <StatusDot status="disconnected" />
          Session disconnected — reconnect to send.
        </div>
      )}

      {attachment && (
        <div className="mb-2 flex items-center gap-2 rounded-md border bg-muted/40 p-2">
          {attachment.previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={attachment.previewUrl} alt="" className="size-10 shrink-0 rounded object-cover" />
          ) : (
            <FileText className="size-5 shrink-0 opacity-70" />
          )}
          <span className="flex-1 truncate text-xs">{attachment.fileName}</span>
          <Button variant="ghost" size="icon" className="size-6" onClick={() => setAttachment(null)} title="Remove">
            <X className="size-3.5" />
          </Button>
        </div>
      )}

      <input
        ref={imageInputRef} type="file" accept="image/*" hidden
        onChange={(e) => { void pickFile(e.target.files?.[0], "image"); e.target.value = "" }}
      />
      <input
        ref={docInputRef} type="file" hidden
        onChange={(e) => { void pickFile(e.target.files?.[0], "document"); e.target.value = "" }}
      />

      <div className="flex items-end gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="size-9 shrink-0" disabled={busy} />}>
            <Paperclip className="size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onClick={() => imageInputRef.current?.click()}>
              <ImageIcon className="mr-2 size-4" /> Photo
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => docInputRef.current?.click()}>
              <FileText className="mr-2 size-4" /> Document
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setPollOpen(true)}>
              <BarChart3 className="mr-2 size-4" /> Poll
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="size-9 shrink-0" disabled={busy} />}>
            <MessageSquareText className="size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-72">
            <DropdownMenuGroup>
              <DropdownMenuLabel>Saved replies</DropdownMenuLabel>
              {SAVED_REPLIES.map((r) => (
                <DropdownMenuItem key={r} onClick={() => setText((t) => (t ? `${t} ${r}` : r))} className="whitespace-normal text-xs">
                  {r}
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={
            sessionOffline ? "Session offline…"
            : attachment?.kind === "image" ? "Add a caption…  (Enter to send)"
            : "Type a reply…  (Enter to send, Shift+Enter for newline)"
          }
          disabled={sessionOffline}
          rows={1}
          className="max-h-32 min-h-9 resize-none py-2"
        />

        <Button
          onClick={() => void submit()}
          size="icon"
          className="size-9 shrink-0"
          disabled={busy || (!attachment && !text.trim())}
        >
          <SendHorizonal className="size-4" />
        </Button>
      </div>

      <Dialog open={pollOpen} onOpenChange={setPollOpen}>
        <DialogContent showCloseButton className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create poll</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="poll-q">Question</Label>
              <Input id="poll-q" value={pollName} maxLength={255} placeholder="Ask something…" onChange={(e) => setPollName(e.target.value)} />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Options</Label>
              {pollOptions.map((opt, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input
                    value={opt} maxLength={100} placeholder={`Option ${i + 1}`}
                    onChange={(e) => setPollOptions((p) => p.map((o, j) => (j === i ? e.target.value : o)))}
                  />
                  {pollOptions.length > 2 && (
                    <Button variant="ghost" size="icon" className="size-8 shrink-0" onClick={() => setPollOptions((p) => p.filter((_, j) => j !== i))} title="Remove option">
                      <Trash2 className="size-4" />
                    </Button>
                  )}
                </div>
              ))}
              {pollOptions.length < 12 && (
                <Button variant="outline" size="sm" className="self-start" onClick={() => setPollOptions((p) => [...p, ""])}>
                  <Plus className="mr-1 size-4" /> Add option
                </Button>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => void sendPoll()} disabled={pollSending}>
              {pollSending ? "Sending…" : "Send poll"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
