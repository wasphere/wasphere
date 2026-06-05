"use client"

import * as React from "react"
import { Check, Copy, ExternalLink, Loader2 } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"

const SESSION_ID_REGEX = /^[a-zA-Z0-9_-]{1,64}$/
const META_DOCS = "https://developers.facebook.com/docs/whatsapp/cloud-api/get-started"

type Provider = "baileys" | "meta"

interface NewSession {
  id: string
  status: string
  [key: string]: unknown
}

export interface NewSessionDialogProps {
  open: boolean
  onClose: () => void
  onCreated: (session: NewSession) => void
}

const PROVIDERS: { value: Provider; title: string; tradeoff: string }[] = [
  {
    value: "baileys",
    title: "Baileys",
    tradeoff: "Unofficial · free · scan a QR code. Full features — groups, polls, all media.",
  },
  {
    value: "meta",
    title: "Meta Cloud API",
    tradeoff: "Official · paid per conversation · no ban risk. Templates & buttons; no groups or polls.",
  },
]

export function NewSessionDialog({ open, onClose, onCreated }: NewSessionDialogProps) {
  const [provider, setProvider] = React.useState<Provider>("baileys")
  const [sessionId, setSessionId] = React.useState("")
  const [proxy, setProxy] = React.useState("")

  // Meta credential fields
  const [phoneNumberId, setPhoneNumberId] = React.useState("")
  const [accessToken, setAccessToken] = React.useState("")
  const [wabaId, setWabaId] = React.useState("")
  const [verifyToken, setVerifyToken] = React.useState("")

  const [validationError, setValidationError] = React.useState<string | null>(null)
  const [serverError, setServerError] = React.useState<string | null>(null)
  const [submitting, setSubmitting] = React.useState(false)

  const [test, setTest] = React.useState<
    { state: "idle" | "testing" | "ok" | "error"; message?: string }
  >({ state: "idle" })
  const [copied, setCopied] = React.useState(false)

  const reset = () => {
    setProvider("baileys")
    setSessionId("")
    setProxy("")
    setPhoneNumberId("")
    setAccessToken("")
    setWabaId("")
    setVerifyToken("")
    setValidationError(null)
    setServerError(null)
    setSubmitting(false)
    setTest({ state: "idle" })
    setCopied(false)
  }

  const handleClose = () => {
    reset()
    onClose()
  }

  const callbackUrl = `https://<your-wa-server>/api/meta/webhook/${sessionId || "<session-id>"}`

  const copyCallback = async () => {
    try {
      await navigator.clipboard.writeText(callbackUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* clipboard unavailable — ignore */
    }
  }

  const testConnection = async () => {
    setTest({ state: "testing" })
    try {
      const res = await fetch("/api/sessions/meta-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumberId, accessToken }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.ok) {
        setTest({ state: "ok", message: data.verifiedName ? `Verified: ${data.verifiedName}` : "Connection OK" })
      } else {
        setTest({ state: "error", message: data.error ?? data.message ?? "Connection failed" })
      }
    } catch {
      setTest({ state: "error", message: "Could not reach the server." })
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setValidationError(null)
    setServerError(null)

    if (!SESSION_ID_REGEX.test(sessionId)) {
      setValidationError("Session ID must be 1–64 characters: letters, numbers, hyphens, underscores.")
      return
    }

    setSubmitting(true)
    try {
      const body: { id: string; proxy?: string } = { id: sessionId }
      if (proxy.trim()) body.proxy = proxy.trim()

      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        const msg = Array.isArray(data.message)
          ? (data.message as string[]).join("\n")
          : (data.message ?? "Failed to create session.")
        setServerError(msg)
        return
      }
      reset()
      onCreated(data as NewSession)
    } catch {
      setServerError("Could not reach the server.")
    } finally {
      setSubmitting(false)
    }
  }

  const fieldClass = "placeholder:text-zinc-400 placeholder:font-light"

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent showCloseButton className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New Session</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {/* Provider choice */}
          <div className="flex flex-col gap-2">
            <Label className="text-sm font-medium text-foreground">Provider</Label>
            <RadioGroup
              value={provider}
              onValueChange={(v) => setProvider(v as Provider)}
              className="gap-2"
            >
              {PROVIDERS.map((p) => (
                <label
                  key={p.value}
                  htmlFor={`provider-${p.value}`}
                  className="flex cursor-pointer items-start gap-3 rounded-md border border-input p-3 has-[[data-checked]]:border-primary has-[[data-checked]]:bg-primary/5"
                >
                  <RadioGroupItem id={`provider-${p.value}`} value={p.value} className="mt-0.5" />
                  <span className="flex flex-col gap-0.5">
                    <span className="text-sm font-medium text-foreground">{p.title}</span>
                    <span className="text-xs text-muted-foreground leading-snug">{p.tradeoff}</span>
                  </span>
                </label>
              ))}
            </RadioGroup>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="session-id" className="text-sm font-medium text-foreground">Session ID</Label>
            <Input
              id="session-id"
              placeholder="my-session-1"
              className={fieldClass}
              value={sessionId}
              onChange={(e) => setSessionId(e.target.value)}
              autoFocus
              required
            />
            {validationError && <p className="text-xs text-destructive">{validationError}</p>}
          </div>

          {provider === "baileys" ? (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="proxy-url" className="text-sm font-medium text-foreground">
                  Proxy URL <span className="text-zinc-400 font-light">(optional)</span>
                </Label>
                <Input
                  id="proxy-url"
                  placeholder="socks5://10.0.0.5:1080"
                  className={fieldClass}
                  value={proxy}
                  onChange={(e) => setProxy(e.target.value)}
                />
              </div>
              {serverError && <p className="text-xs text-destructive whitespace-pre-line">{serverError}</p>}
              <DialogFooter showCloseButton>
                <Button type="submit" disabled={submitting}>
                  {submitting ? "Creating…" : "Create Session"}
                </Button>
              </DialogFooter>
            </form>
          ) : (
            <div className="flex flex-col gap-4">
              <p className="rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground leading-snug">
                Enter your Meta Cloud API credentials and test the connection. Full Meta session
                management ships in the v1.2 preview — for now, validate here and copy your callback URL.{" "}
                <a href={META_DOCS} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary underline">
                  Meta setup docs <ExternalLink className="size-3" />
                </a>
              </p>

              <MetaField id="meta-pnid" label="Phone Number ID" value={phoneNumberId} onChange={setPhoneNumberId} placeholder="123456789012345" />
              <MetaField id="meta-token" label="Permanent Access Token" value={accessToken} onChange={setAccessToken} placeholder="EAAG…" secret />
              <MetaField id="meta-waba" label="Business Account ID" value={wabaId} onChange={setWabaId} placeholder="987654321098765" />
              <MetaField id="meta-verify" label="Webhook Verify Token" value={verifyToken} onChange={setVerifyToken} placeholder="a value you choose" />

              {/* Test connection */}
              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={testConnection}
                  disabled={test.state === "testing" || !phoneNumberId || !accessToken}
                >
                  {test.state === "testing" && <Loader2 className="size-3.5 animate-spin" />}
                  Test connection
                </Button>
                {test.state === "ok" && (
                  <span className="inline-flex items-center gap-1 text-xs text-emerald-500">
                    <Check className="size-3.5" /> {test.message}
                  </span>
                )}
                {test.state === "error" && <span className="text-xs text-destructive">{test.message}</span>}
              </div>

              {/* Callback URL */}
              <div className="flex flex-col gap-1.5">
                <Label className="text-sm font-medium text-foreground">Webhook callback URL</Label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 truncate rounded-md border border-input bg-muted/40 px-2.5 py-2 text-xs text-muted-foreground">
                    {callbackUrl}
                  </code>
                  <Button type="button" variant="outline" size="icon" onClick={copyCallback} aria-label="Copy callback URL">
                    {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Replace <code>&lt;your-wa-server&gt;</code> with your WA Server&apos;s public URL, then paste this
                  into your Meta app&apos;s webhook config (use the Verify Token above).
                </p>
              </div>

              <DialogFooter showCloseButton>
                <Button type="button" variant="secondary" onClick={handleClose}>Done</Button>
              </DialogFooter>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function MetaField({
  id, label, value, onChange, placeholder, secret,
}: {
  id: string
  label: string
  value: string
  onChange: (v: string) => void
  placeholder: string
  secret?: boolean
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id} className="text-sm font-medium text-foreground">{label}</Label>
      <Input
        id={id}
        type={secret ? "password" : "text"}
        autoComplete={secret ? "off" : undefined}
        placeholder={placeholder}
        className="placeholder:text-zinc-400 placeholder:font-light"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  )
}
