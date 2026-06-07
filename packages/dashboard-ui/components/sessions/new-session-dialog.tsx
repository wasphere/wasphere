"use client"

import * as React from "react"
import { Check, Copy, ExternalLink, Loader2 } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { cn } from "@/lib/utils"

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
    tradeoff: "Unofficial · free · scan a QR. Full features — groups, polls, all media.",
  },
  {
    value: "meta",
    title: "Meta Cloud API",
    tradeoff: "Official · paid per conversation · no ban risk. Templates & buttons; no groups/polls.",
  },
]

export function NewSessionDialog({ open, onClose, onCreated }: NewSessionDialogProps) {
  const [provider, setProvider] = React.useState<Provider>("baileys")
  const [sessionId, setSessionId] = React.useState("")
  const [proxy, setProxy] = React.useState("")

  const [phoneNumberId, setPhoneNumberId] = React.useState("")
  const [accessToken, setAccessToken] = React.useState("")
  const [wabaId, setWabaId] = React.useState("")
  const [verifyToken, setVerifyToken] = React.useState("")
  const [appSecret, setAppSecret] = React.useState("")

  const [validationError, setValidationError] = React.useState<string | null>(null)
  const [serverError, setServerError] = React.useState<string | null>(null)
  const [submitting, setSubmitting] = React.useState(false)

  const [test, setTest] = React.useState<{ state: "idle" | "testing" | "ok" | "error"; message?: string }>({ state: "idle" })
  const [copied, setCopied] = React.useState(false)
  const [webhookBase, setWebhookBase] = React.useState<string | null>(null)

  const isMeta = provider === "meta"

  // Pull the wa-server's public URL so we can show the real callback URL.
  React.useEffect(() => {
    if (!open) return
    let cancelled = false
    fetch("/api/meta/webhook-base")
      .then((r) => r.json())
      .then((d) => { if (!cancelled) setWebhookBase(typeof d?.base === "string" ? d.base : null) })
      .catch(() => { /* fall back to placeholder */ })
    return () => { cancelled = true }
  }, [open])

  const reset = () => {
    setProvider("baileys")
    setSessionId("")
    setProxy("")
    setPhoneNumberId("")
    setAccessToken("")
    setWabaId("")
    setVerifyToken("")
    setAppSecret("")
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

  const callbackBase = webhookBase ?? "https://<your-wa-server>"
  const callbackUrl = `${callbackBase}/api/meta/webhook/${sessionId || "<session-id>"}`

  const copyCallback = async () => {
    try {
      await navigator.clipboard.writeText(callbackUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* clipboard unavailable */
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

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault()
    setValidationError(null)
    setServerError(null)

    if (!SESSION_ID_REGEX.test(sessionId)) {
      setValidationError("Session ID must be 1–64 characters: letters, numbers, hyphens, underscores.")
      return
    }
    if (isMeta && (!phoneNumberId.trim() || !accessToken.trim())) {
      setValidationError("Phone Number ID and Access Token are required for a Meta session.")
      return
    }

    setSubmitting(true)
    try {
      const body: Record<string, unknown> = { id: sessionId }
      if (isMeta) {
        body.provider = "meta"
        body.metaPhoneNumberId = phoneNumberId.trim()
        body.metaAccessToken = accessToken.trim()
        if (wabaId.trim()) body.metaWabaId = wabaId.trim()
        if (verifyToken.trim()) body.metaVerifyToken = verifyToken.trim()
        if (appSecret.trim()) body.metaAppSecret = appSecret.trim()
      } else if (proxy.trim()) {
        body.proxy = proxy.trim()
      }

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

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent
        showCloseButton
        className={cn("max-h-[88vh] overflow-y-auto", isMeta ? "sm:max-w-2xl" : "sm:max-w-md")}
      >
        <DialogHeader>
          <DialogTitle>New Session</DialogTitle>
          <DialogDescription>Choose an engine and connect a WhatsApp number.</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-5">
          {/* Provider — two side-by-side cards */}
          <RadioGroup
            value={provider}
            onValueChange={(v) => setProvider(v as Provider)}
            className="grid grid-cols-1 sm:grid-cols-2 gap-3"
          >
            {PROVIDERS.map((p) => (
              <label
                key={p.value}
                htmlFor={`provider-${p.value}`}
                className="flex cursor-pointer items-start gap-3 rounded-lg border border-input p-3.5 transition-colors hover:bg-muted/40 has-[[data-checked]]:border-primary has-[[data-checked]]:bg-primary/5"
              >
                <RadioGroupItem id={`provider-${p.value}`} value={p.value} className="mt-0.5" />
                <span className="flex flex-col gap-1">
                  <span className="text-sm font-semibold text-foreground">{p.title}</span>
                  <span className="text-xs text-muted-foreground leading-snug">{p.tradeoff}</span>
                </span>
              </label>
            ))}
          </RadioGroup>

          {/* Session ID */}
          <Field id="session-id" label="Session ID">
            <Input
              id="session-id"
              placeholder="my-session-1"
              className="placeholder:text-zinc-400 placeholder:font-light"
              value={sessionId}
              onChange={(e) => setSessionId(e.target.value)}
              autoFocus
            />
            {validationError && <p className="text-xs text-destructive">{validationError}</p>}
          </Field>

          {provider === "baileys" ? (
            <form onSubmit={handleSubmit} className="flex flex-col gap-5">
              <Field id="proxy-url" label={<>Proxy URL <span className="text-zinc-400 font-light">(optional)</span></>}>
                <Input
                  id="proxy-url"
                  placeholder="socks5://10.0.0.5:1080"
                  className="placeholder:text-zinc-400 placeholder:font-light"
                  value={proxy}
                  onChange={(e) => setProxy(e.target.value)}
                />
              </Field>
              {serverError && <p className="text-xs text-destructive whitespace-pre-line">{serverError}</p>}
              <DialogFooter showCloseButton>
                <Button type="submit" disabled={submitting}>
                  {submitting ? "Creating…" : "Create Session"}
                </Button>
              </DialogFooter>
            </form>
          ) : (
            <div className="flex flex-col gap-5">
              <p className="rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground leading-snug">
                Enter your Meta Cloud API credentials, test the connection, then create the session.
                After creating, paste the callback URL below into your Meta app&apos;s webhook config.{" "}
                <a href={META_DOCS} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary underline">
                  Meta setup docs <ExternalLink className="size-3" />
                </a>
              </p>

              {/* Credentials — two columns */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-4">
                <Field id="meta-pnid" label="Phone Number ID">
                  <Input id="meta-pnid" placeholder="123456789012345" className="placeholder:text-zinc-400 placeholder:font-light" value={phoneNumberId} onChange={(e) => setPhoneNumberId(e.target.value)} />
                </Field>
                <Field id="meta-waba" label="Business Account ID">
                  <Input id="meta-waba" placeholder="987654321098765" className="placeholder:text-zinc-400 placeholder:font-light" value={wabaId} onChange={(e) => setWabaId(e.target.value)} />
                </Field>
                <Field id="meta-token" label="Permanent Access Token" className="sm:col-span-2">
                  <Input id="meta-token" type="password" autoComplete="off" placeholder="EAAG…" className="placeholder:text-zinc-400 placeholder:font-light" value={accessToken} onChange={(e) => setAccessToken(e.target.value)} />
                </Field>
                <Field id="meta-verify" label="Webhook Verify Token">
                  <Input id="meta-verify" placeholder="a value you choose" className="placeholder:text-zinc-400 placeholder:font-light" value={verifyToken} onChange={(e) => setVerifyToken(e.target.value)} />
                </Field>
                <Field id="meta-secret" label={<>App Secret <span className="text-zinc-400 font-light">(recommended)</span></>}>
                  <Input id="meta-secret" type="password" autoComplete="off" placeholder="for webhook signature verification" className="placeholder:text-zinc-400 placeholder:font-light" value={appSecret} onChange={(e) => setAppSecret(e.target.value)} />
                </Field>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-sm font-medium text-foreground">Validate</Label>
                  <div className="flex h-9 items-center gap-3">
                    <Button type="button" variant="outline" size="sm" onClick={testConnection} disabled={test.state === "testing" || !phoneNumberId || !accessToken}>
                      {test.state === "testing" && <Loader2 className="size-3.5 animate-spin" />}
                      Test connection
                    </Button>
                    {test.state === "ok" && (
                      <span className="inline-flex items-center gap-1 text-xs text-emerald-500"><Check className="size-3.5" /> {test.message}</span>
                    )}
                    {test.state === "error" && <span className="text-xs text-destructive leading-tight">{test.message}</span>}
                  </div>
                </div>
              </div>

              {/* Callback URL — full width */}
              <div className="flex flex-col gap-1.5">
                <Label className="text-sm font-medium text-foreground">Webhook callback URL</Label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 truncate rounded-md border border-input bg-muted/40 px-2.5 py-2 text-xs text-muted-foreground">{callbackUrl}</code>
                  <Button type="button" variant="outline" size="icon" onClick={copyCallback} aria-label="Copy callback URL">
                    {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  {webhookBase ? (
                    <>Paste this into your Meta app&apos;s webhook config (with the Verify Token above), then subscribe to the <code>messages</code> field.</>
                  ) : (
                    <>Replace <code>&lt;your-wa-server&gt;</code> with your WA Server&apos;s public URL (set <code>WA_SERVER_PUBLIC_URL</code> to auto-fill this), then paste it into your Meta app&apos;s webhook config with the Verify Token above.</>
                  )}
                </p>
              </div>

              {serverError && <p className="text-xs text-destructive whitespace-pre-line">{serverError}</p>}
              <DialogFooter showCloseButton>
                <Button type="button" onClick={() => handleSubmit()} disabled={submitting}>
                  {submitting ? "Creating…" : "Create Session"}
                </Button>
              </DialogFooter>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function Field({
  id, label, className, children,
}: {
  id?: string
  label: React.ReactNode
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label htmlFor={id} className="text-sm font-medium text-foreground">{label}</Label>
      {children}
    </div>
  )
}
