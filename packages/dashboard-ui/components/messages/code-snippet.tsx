"use client"

import * as React from "react"
import { Copy, Check } from "lucide-react"
import { type MessageType } from "@/lib/message-types"
import { cn } from "@/lib/utils"

type Lang = "curl" | "node" | "python" | "php"

interface CodeSnippetProps {
  messageType: MessageType
  sessionId: string
  recipient: string
  previewData: Record<string, unknown>
}

const LANG_LABELS: Record<Lang, string> = {
  curl: "cURL",
  node: "Node.js",
  python: "Python",
  php: "PHP",
}

function buildBody(
  type: MessageType,
  sessionId: string,
  to: string,
  data: Record<string, unknown>
): Record<string, unknown> {
  const sid = sessionId || "your-session-id"
  const recipient = to || "+1234567890"
  const text = (data.text as string) || "Hello from WaSphere"
  const url = "https://example.com/file"
  const caption = (data.caption as string) || ""
  const base = { sessionId: sid, to: recipient }

  switch (type) {
    case "text":
      return { ...base, text }
    case "image":
      return caption ? { ...base, url: url + ".jpg", caption } : { ...base, url: url + ".jpg" }
    case "video":
      return caption ? { ...base, url: url + ".mp4", caption } : { ...base, url: url + ".mp4" }
    case "audio":
      return { ...base, url: url + ".mp3" }
    case "document":
      return { ...base, url: url + ".pdf", filename: "document.pdf" }
    case "sticker":
      return { ...base, url: url + ".webp" }
    case "gif":
      return { ...base, url: url + ".mp4" }
    case "location":
      return { ...base, latitude: 33.6844, longitude: 73.0479, name: "Islamabad", address: "Capital Territory, Pakistan" }
    case "contact":
      return { ...base, name: "John Doe", phone: "+1234567890" }
    case "buttons":
      return { ...base, text, buttons: [{ id: "btn_1", text: "Option A" }, { id: "btn_2", text: "Option B" }, { id: "btn_3", text: "Option C" }] }
    case "list":
      return { ...base, text, title: "Choose an option", sections: [{ title: "Items", rows: [{ id: "row_1", title: "Item 1" }, { id: "row_2", title: "Item 2" }] }] }
    case "poll":
      return { ...base, name: "Your question?", values: ["Option 1", "Option 2", "Option 3"], selectableCount: 1 }
    case "reaction":
      return { ...base, messageId: "3EB0000000000000000000", emoji: "👍" }
    case "view-once":
      return { ...base, url: url + ".jpg", mediaType: "image" }
    default:
      return base
  }
}

function toCurl(type: MessageType, body: Record<string, unknown>): string {
  const json = JSON.stringify(body, null, 2)
  return `curl -X POST '/api/messages/${type}' \\
  -H 'Content-Type: application/json' \\
  -d '${json.replace(/'/g, "'\\''")}'`
}

function toNode(type: MessageType, body: Record<string, unknown>): string {
  const json = JSON.stringify(body, null, 2)
  return `const res = await fetch('/api/messages/${type}', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(${json})
})
const data = await res.json()
console.log(data)`
}

function toPython(type: MessageType, body: Record<string, unknown>): string {
  let json = JSON.stringify(body, null, 2)
  json = json.replace(/: true/g, ": True").replace(/: false/g, ": False").replace(/: null/g, ": None")
  return `import requests

res = requests.post(
    '/api/messages/${type}',
    json=${json}
)
print(res.json())`
}

function toPhp(type: MessageType, body: Record<string, unknown>): string {
  const json = JSON.stringify(body, null, 2).replace(/'/g, "\\'")
  return `<?php
$ch = curl_init('/api/messages/${type}');
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_POST => true,
    CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
    CURLOPT_POSTFIELDS => '${json}',
]);
echo curl_exec($ch);
curl_close($ch);`
}

export function CodeSnippet({ messageType, sessionId, recipient, previewData }: CodeSnippetProps) {
  const [lang, setLang] = React.useState<Lang>("curl")
  const [copied, setCopied] = React.useState(false)

  const body = buildBody(messageType, sessionId, recipient, previewData)

  const code = (() => {
    switch (lang) {
      case "curl":   return toCurl(messageType, body)
      case "node":   return toNode(messageType, body)
      case "python": return toPython(messageType, body)
      case "php":    return toPhp(messageType, body)
    }
  })()

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code).catch(() => null)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="rounded-xl overflow-hidden border border-border">
      {/* Tab bar */}
      <div className="flex items-center justify-between border-b border-border bg-card px-1 py-1">
        <div className="flex">
          {(Object.keys(LANG_LABELS) as Lang[]).map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => setLang(l)}
              className={cn(
                "px-2.5 py-1 text-xs font-medium rounded-md transition-all duration-150 cursor-pointer",
                lang === l ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {LANG_LABELS[l]}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1 px-2 py-1 mr-0.5 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-all duration-150 cursor-pointer"
        >
          {copied ? <Check size={11} /> : <Copy size={11} />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>

      {/* Code block */}
      <pre style={{
        background: "#0b141a",
        color: "#d5e8df",
        fontFamily: "ui-monospace, Menlo, Monaco, monospace",
        fontSize: 11,
        lineHeight: 1.65,
        padding: "12px",
        margin: 0,
        overflowX: "auto",
        overflowY: "auto",
        maxHeight: 180,
        whiteSpace: "pre",
      }}>
        {code}
      </pre>
    </div>
  )
}
