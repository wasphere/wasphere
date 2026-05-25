"use client"

import * as React from "react"

// Mint-family palette — consistent with the brand primary
const COLORS = [
  "#22c55e",
  "#4ade80",
  "#86efac",
  "#16a34a",
  "#14b8a6",
  "#0ea5e9",
]

interface DonutSlice {
  type: string
  count: number
}

export function DonutChart({ data }: { data: DonutSlice[] }) {
  const [mounted, setMounted] = React.useState(false)
  React.useEffect(() => { setMounted(true) }, [])

  if (!data.length) {
    return (
      <p className="text-sm text-zinc-400 py-4 text-center">
        No messages sent today yet.
      </p>
    )
  }

  const total = data.reduce((s, d) => s + d.count, 0)
  const r = 38
  const cx = 56
  const cy = 56
  const circumference = 2 * Math.PI * r
  const visibleData = data.slice(0, 6)

  let cumLen = 0
  const segments = visibleData.map((d, i) => {
    const len = (d.count / total) * circumference
    const dash = mounted
      ? `${len.toFixed(2)} ${(circumference - len).toFixed(2)}`
      : `0 ${circumference.toFixed(2)}`
    const offset = -cumLen
    cumLen += len
    return { ...d, color: COLORS[i % COLORS.length], dash, offset }
  })

  return (
    <div className="flex items-center gap-5">
      <svg
        width={112}
        height={112}
        viewBox="0 0 112 112"
        className="shrink-0 -rotate-90"
        aria-hidden
      >
        {/* Track */}
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          strokeWidth={14}
          stroke="currentColor"
          className="text-muted opacity-40"
        />
        {segments.map((s, i) => (
          <circle
            key={s.type}
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke={s.color}
            strokeWidth={14}
            strokeDasharray={s.dash}
            strokeDashoffset={s.offset}
            strokeLinecap="butt"
            style={{
              transition: `stroke-dasharray 0.55s ease-out ${i * 70}ms`,
            }}
          />
        ))}
      </svg>

      <div className="flex flex-col gap-2 flex-1 min-w-0">
        {segments.map((s) => (
          <div key={s.type} className="flex items-center gap-2">
            <div
              className="h-2 w-2 rounded-full shrink-0"
              style={{ background: s.color }}
            />
            <span className="text-xs text-zinc-600 dark:text-zinc-400 capitalize truncate flex-1">
              {s.type}
            </span>
            <span className="text-xs font-medium tabular-nums text-foreground">
              {s.count}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
