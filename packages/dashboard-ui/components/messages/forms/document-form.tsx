"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface FormProps {
  onSubmit: (body: Record<string, unknown>) => Promise<void>
  submitting: boolean
  onClear?: () => void
}

export function DocumentForm({ onSubmit, submitting }: FormProps) {
  const [url, setUrl] = React.useState("")
  const [fileName, setFileName] = React.useState("")
  const [mimetype, setMimetype] = React.useState("")
  const [errors, setErrors] = React.useState<Record<string, string>>({})

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const errs: Record<string, string> = {}
    if (!url.trim()) errs.url = "Document URL is required."
    if (!fileName.trim()) errs.fileName = "File name is required."
    if (!mimetype.trim()) errs.mimetype = "MIME type is required."
    if (Object.keys(errs).length > 0) {
      setErrors(errs)
      return
    }
    setErrors({})
    await onSubmit({ url: url.trim(), fileName: fileName.trim(), mimetype: mimetype.trim() })
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="doc-url">Document URL</Label>
        <Input
          id="doc-url"
          placeholder="https://example.com/document.pdf"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
        {errors.url && <p className="text-xs text-destructive">{errors.url}</p>}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="doc-filename">File Name</Label>
        <Input
          id="doc-filename"
          placeholder="report.pdf"
          value={fileName}
          onChange={(e) => setFileName(e.target.value)}
        />
        {errors.fileName && (
          <p className="text-xs text-destructive">{errors.fileName}</p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="doc-mimetype">MIME Type</Label>
        <Input
          id="doc-mimetype"
          placeholder="application/pdf"
          value={mimetype}
          onChange={(e) => setMimetype(e.target.value)}
        />
        {errors.mimetype && (
          <p className="text-xs text-destructive">{errors.mimetype}</p>
        )}
      </div>

      <Button type="submit" disabled={submitting} className="w-fit">
        {submitting ? "Sending…" : "Send Message"}
      </Button>
    </form>
  )
}
