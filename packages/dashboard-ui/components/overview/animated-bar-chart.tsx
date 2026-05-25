"use client"

import * as React from "react"

interface BarDatum {
  date: string
  count: number
}

export function AnimatedBarChart({ data }: { data: BarDatum[] }) {
  const [mounted, setMounted] = React.useState(false)
  React.useEffect(() => { setMounted(true) }, [])

  const max = Math.max(...data.map((d) => d.count), 1)

  return (
    <div className="flex items-end gap-2 h-32 w-full">
      {data.map((d, i) => {
        const pct = d.count > 0 ? Math.max((d.count / max) * 100, 5) : 0
        const label = d.date.slice(5)

        return (
          <div
            key={d.date}
            className="flex flex-col items-center gap-1.5 flex-1 min-w-0 group/bar"
          >
            <span className="text-[10px] text-muted-foreground/50 tabular-nums leading-none transition-colors group-hover/bar:text-muted-foreground">
              {d.count > 0 ? d.count : ""}
            </span>
            <div
              className="w-full flex items-end rounded-sm overflow-hidden"
              style={{ height: "76px" }}
            >
              {pct > 0 ? (
                <div
                  className="w-full rounded-t-sm group-hover/bar:opacity-90"
                  style={{
                    height: mounted ? `${pct}%` : "0%",
                    transition: `height 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) ${i * 50}ms`,
                    background:
                      "linear-gradient(to top, color-mix(in srgb, var(--primary) 40%, transparent), color-mix(in srgb, var(--primary) 80%, transparent))",
                  }}
                />
              ) : (
                <div
                  className="w-full rounded-t-sm bg-muted/30"
                  style={{ height: "4px" }}
                />
              )}
            </div>
            <span className="text-[9px] text-muted-foreground/40 tabular-nums truncate w-full text-center">
              {label}
            </span>
          </div>
        )
      })}
    </div>
  )
}
