"use client"

import * as React from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

interface MediaInputProps {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  onFileSelected?: (dataUri: string, name: string, type: string) => void
  accept: string
  urlPlaceholder?: string
  error?: string
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function MediaInput({
  id,
  label,
  value,
  onChange,
  onFileSelected,
  accept,
  urlPlaceholder = "https://example.com/file",
  error,
}: MediaInputProps) {
  const [mode, setMode] = React.useState<"url" | "upload">("url")
  const [fileName, setFileName] = React.useState<string | null>(null)
  const [fileSize, setFileSize] = React.useState<number | null>(null)
  const [loading, setLoading] = React.useState(false)
  const inputRef = React.useRef<HTMLInputElement>(null)

  const handleFile = (file: File) => {
    setLoading(true)
    setFileName(file.name)
    setFileSize(file.size)
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      onChange(result)
      onFileSelected?.(result, file.name, file.type)
      setLoading(false)
    }
    reader.onerror = () => setLoading(false)
    reader.readAsDataURL(file)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  const switchMode = (next: "url" | "upload") => {
    setMode(next)
    onChange("")
    setFileName(null)
    setFileSize(null)
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <Label htmlFor={id}>{label}</Label>
        <div className="flex rounded-md border text-xs overflow-hidden">
          <button
            type="button"
            onClick={() => switchMode("url")}
            className={cn(
              "px-2.5 py-1 transition-colors",
              mode === "url"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted"
            )}
          >
            URL
          </button>
          <button
            type="button"
            onClick={() => switchMode("upload")}
            className={cn(
              "px-2.5 py-1 transition-colors",
              mode === "upload"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted"
            )}
          >
            Upload
          </button>
        </div>
      </div>

      {mode === "url" ? (
        <Input
          id={id}
          placeholder={urlPlaceholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <div
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          onClick={() => inputRef.current?.click()}
          className={cn(
            "flex flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed border-input bg-muted/30 px-4 py-5 text-center cursor-pointer transition-colors hover:bg-muted/50",
            loading && "opacity-60 pointer-events-none"
          )}
        >
          <input
            ref={inputRef}
            type="file"
            accept={accept}
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) handleFile(file)
            }}
          />
          {fileName ? (
            <>
              <p className="text-sm font-medium text-foreground truncate max-w-full">
                {fileName}
              </p>
              {fileSize !== null && (
                <p className="text-xs text-muted-foreground">
                  {formatBytes(fileSize)} — click to change
                </p>
              )}
              {loading && (
                <p className="text-xs text-muted-foreground">Converting…</p>
              )}
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Click to upload or drag & drop
              </p>
              <p className="text-xs text-muted-foreground/60">
                {accept.replace(/,/g, ", ")}
              </p>
            </>
          )}
        </div>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
