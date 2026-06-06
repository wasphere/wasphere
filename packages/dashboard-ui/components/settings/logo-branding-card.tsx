"use client"

import * as React from "react"
import { toast } from "sonner"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

const MAX_BYTES = 500 * 1024 // 500 KB

export function LogoBrandingCard({ initialLogo }: { initialLogo?: string | null }) {
  const [logo, setLogo] = React.useState<string | null>(initialLogo ?? null)
  const [dirty, setDirty] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const fileRef = React.useRef<HTMLInputElement>(null)

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = "" // allow re-selecting the same file
    if (!file) return
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file (PNG, SVG, JPG, WebP).")
      return
    }
    if (file.size > MAX_BYTES) {
      toast.error("Logo must be under 500 KB.")
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      setLogo(reader.result as string)
      setDirty(true)
    }
    reader.readAsDataURL(file)
  }

  async function save(value: string | null) {
    setSaving(true)
    try {
      const res = await fetch("/api/settings/workspace", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logo: value ?? "" }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        toast.error(d.message ?? "Failed to save logo.")
        return
      }
      toast.success(value ? "Logo saved — refresh to see it in the sidebar." : "Logo removed.")
      setDirty(false)
    } catch {
      toast.error("Could not reach the server.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Branding</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">
          Upload a custom logo shown in your dashboard sidebar. PNG, SVG, JPG or WebP, up to 500&nbsp;KB.
        </p>
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted/40">
            {logo ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={logo} alt="Logo preview" className="max-h-full max-w-full object-contain" />
            ) : (
              <span className="text-[10px] text-muted-foreground">No logo</span>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFile} />
            <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
              Choose image
            </Button>
            <Button type="button" size="sm" disabled={saving || !dirty || !logo} onClick={() => save(logo)}>
              {saving ? "Saving…" : "Save logo"}
            </Button>
            {logo && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={saving}
                onClick={() => { setLogo(null); save(null) }}
              >
                Remove
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
