"use client"

import * as React from "react"
import { ArrowUpCircle, ExternalLink, X } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

interface VersionInfo {
  current: string
  latest: string | null
  updateAvailable: boolean
  url: string | null
  notes: string | null
}

const DISMISS_KEY = "wasphere_update_dismissed"

export function UpdateBanner() {
  const [info, setInfo] = React.useState<VersionInfo | null>(null)
  const [dismissed, setDismissed] = React.useState(true)
  const [open, setOpen] = React.useState(false)

  React.useEffect(() => {
    let active = true
    fetch("/api/version")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: VersionInfo | null) => {
        if (!active || !d?.updateAvailable || !d.latest) return
        setInfo(d)
        // Re-show for each new version even if a previous one was dismissed.
        const dismissedVersion = typeof window !== "undefined" ? localStorage.getItem(DISMISS_KEY) : null
        setDismissed(dismissedVersion === d.latest)
      })
      .catch(() => {})
    return () => { active = false }
  }, [])

  if (!info || !info.latest || dismissed) return null

  const dismiss = () => {
    try { localStorage.setItem(DISMISS_KEY, info.latest!) } catch { /* ignore */ }
    setDismissed(true)
  }

  return (
    <>
      <div className="flex items-center gap-3 border-b border-primary/20 bg-primary/5 px-4 py-2 text-sm">
        <ArrowUpCircle className="size-4 shrink-0 text-primary" />
        <span className="text-foreground">
          Update available — <span className="font-semibold">v{info.latest}</span>{" "}
          <span className="text-muted-foreground">(you&apos;re on v{info.current})</span>
        </span>
        <Button type="button" variant="link" size="sm" className="h-auto p-0 text-primary" onClick={() => setOpen(true)}>
          What&apos;s new &amp; how to update
        </Button>
        <button type="button" onClick={dismiss} aria-label="Dismiss" className="ml-auto text-muted-foreground hover:text-foreground">
          <X className="size-4" />
        </button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent showCloseButton className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Update to v{info.latest}</DialogTitle>
            <DialogDescription>You&apos;re running v{info.current}.</DialogDescription>
          </DialogHeader>

          {info.notes && (
            <div className="rounded-md border bg-muted/40 p-3 max-h-56 overflow-y-auto">
              <pre className="whitespace-pre-wrap break-words font-sans text-xs text-muted-foreground">{info.notes}</pre>
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-foreground">How to update (Docker)</span>
            <pre className="rounded-md bg-zinc-900 text-zinc-100 p-3 text-xs overflow-x-auto">{`cd /path/to/wasphere
git pull
docker compose pull
docker compose up -d --build`}</pre>
            <p className="text-xs text-muted-foreground">
              Pulls the latest code/images and recreates the containers. Your data volumes are preserved.
            </p>
          </div>

          <div className="flex items-center gap-3 pt-1">
            {info.url && (
              <a href={info.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline">
                View release on GitHub <ExternalLink className="size-3.5" />
              </a>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
