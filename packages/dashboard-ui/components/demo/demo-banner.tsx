import { Info } from "lucide-react"

/**
 * Persistent banner shown across the whole dashboard in DEMO_MODE so nobody
 * mistakes the seeded data for a real WhatsApp connection.
 */
export function DemoBanner() {
  return (
    <div className="flex items-center justify-center gap-2 border-b border-amber-300/40 bg-amber-400/10 px-4 py-2 text-center text-xs font-medium text-amber-700 dark:text-amber-300">
      <Info className="size-3.5 shrink-0" />
      <span>
        Demo data — this is a read-only showcase. No real WhatsApp connection; changes are not saved.{" "}
        <a href="https://wasphere.com/docs/getting-started/quick-start/" className="underline underline-offset-2">
          Deploy your own →
        </a>
      </span>
    </div>
  )
}
