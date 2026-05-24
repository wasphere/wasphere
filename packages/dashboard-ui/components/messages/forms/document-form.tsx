"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { MediaInput } from "@/components/messages/media-input"
import { SAMPLE_DOCUMENT_URL } from "@/lib/message-samples"

interface FormProps {
  onSubmit: (body: Record<string, unknown>) => Promise<void>
  submitting: boolean
}

export function DocumentForm({ onSubmit, submitting }: FormProps) {
  const [url, setUrl] = React.useState("")
  const [fileName, setFileName] = React.useState("")
  const [mimetype, setMimetype] = React.useState("")
  const [errors, setErrors] = React.useState<Record<string, string>>({})

  const EXT_MIME: Record<string, string> = {
    pdf: "application/pdf",
    doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xls: "application/vnd.ms-excel",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ppt: "application/vnd.ms-powerpoint",
    pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    txt: "text/plain",
    csv: "text/csv",
  }

  const inferFromUrl = (u: string) => {
    try {
      const pathname = new URL(u).pathname
      const ext = pathname.split(".").pop()?.toLowerCase() ?? ""
      const name = pathname.split("/").filter(Boolean).pop() ?? ""
      return { mime: EXT_MIME[ext] ?? "", name }
    } catch { return { mime: "", name: "" } }
  }

  const fillSample = () => {
    setUrl(SAMPLE_DOCUMENT_URL)
    setFileName("sample.pdf")
    setMimetype("application/pdf")
    setErrors({})
  }

  const handleUrlChange = (u: string) => {
    setUrl(u)
    if (u.startsWith("http")) {
      const { mime, name } = inferFromUrl(u)
      if (mime) setMimetype(mime)
      if (name && !fileName) setFileName(name)
    }
  }

  const handleFileSelected = (dataUri: string, name: string, type: string) => {
    setUrl(dataUri)
    setFileName(name)
    setMimetype(type || "application/octet-stream")
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const errs: Record<string, string> = {}
    if (!url.trim()) errs.url = "Document URL or file is required."
    if (!fileName.trim()) errs.fileName = "File name is required."
    if (!mimetype.trim()) errs.mimetype = "MIME type is required."
    if (Object.keys(errs).length > 0) { setErrors(errs); return }
    setErrors({})
    await onSubmit({ url: url.trim(), fileName: fileName.trim(), mimetype: mimetype.trim() })
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex items-center justify-between pb-1">
        <span className="text-xs text-muted-foreground">Fill in the fields below</span>
        <Button type="button" size="xs" variant="outline" onClick={fillSample}>
          Fill Sample
        </Button>
      </div>
      <MediaInput
        id="doc-url" label="Document" value={url}
        onChange={handleUrlChange}
        onFileSelected={handleFileSelected}
        accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,application/*,text/*"
        urlPlaceholder="https://example.com/document.pdf"
        error={errors.url}
      />
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="doc-filename">File Name</Label>
          <Input id="doc-filename" placeholder="report.pdf" value={fileName}
            onChange={(e) => setFileName(e.target.value)} />
          {errors.fileName && <p className="text-xs text-destructive">{errors.fileName}</p>}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="doc-mimetype">MIME Type</Label>
          <Input id="doc-mimetype" placeholder="application/pdf" value={mimetype}
            onChange={(e) => setMimetype(e.target.value)} />
          {errors.mimetype && <p className="text-xs text-destructive">{errors.mimetype}</p>}
        </div>
      </div>
      <Button type="submit" disabled={submitting} className="w-full">
        {submitting ? "Sending…" : "Send Message"}
      </Button>
    </form>
  )
}
