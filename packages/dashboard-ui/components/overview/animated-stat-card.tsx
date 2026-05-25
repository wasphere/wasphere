"use client"

import * as React from "react"
import { TrendingUp, TrendingDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { Card, CardContent, CardHeader } from "@/components/ui/card"

function useCountUp(target: number, duration = 900): number {
  const [current, setCurrent] = React.useState(0)

  React.useEffect(() => {
    if (target === 0) { setCurrent(0); return }
    const start = performance.now()
    let raf: number
    function tick(now: number) {
      const t = Math.min((now - start) / duration, 1)
      const eased = 1 - Math.pow(1 - t, 3)
      setCurrent(Math.round(target * eased))
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, duration])

  return current
}

function MiniSparkline({ values }: { values: number[] }) {
  const [mounted, setMounted] = React.useState(false)
  React.useEffect(() => { setMounted(true) }, [])

  if (values.length < 2) return null
  const max = Math.max(...values, 1)
  const W = 56
  const H = 18
  const pts = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * W
      const y = H - (v / max) * H * 0.85 - 1
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(" ")

  return (
    <svg
      width={W}
      height={H}
      viewBox={`0 0 ${W} ${H}`}
      className={cn("transition-opacity duration-700", mounted ? "opacity-60" : "opacity-0")}
      aria-hidden
    >
      <polyline
        points={pts}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-primary"
      />
    </svg>
  )
}

interface AnimatedStatCardProps {
  title: string
  value: string
  targetCount?: number
  suffix?: string
  sub?: string
  trend?: "up" | "down" | "neutral"
  icon?: React.ReactNode
  sparkline?: number[]
}

export function AnimatedStatCard({
  title,
  value,
  targetCount,
  suffix = "",
  sub,
  trend,
  icon,
  sparkline,
}: AnimatedStatCardProps) {
  const counted = useCountUp(targetCount ?? 0)
  const display =
    targetCount !== undefined ? `${counted.toLocaleString()}${suffix}` : value

  return (
    <Card className="relative border-primary/20 overflow-hidden">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent" />
      <CardHeader className="pb-0 pt-5">
        <div className="flex items-start justify-between gap-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest leading-none">
            {title}
          </p>
          {icon && (
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 ring-1 ring-primary/20 shadow-sm dark:shadow-[0_0_18px_rgba(34,197,94,0.22)]">
              {icon}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="pb-5 pt-2">
        <div className="flex items-end justify-between gap-2">
          <p className="text-[2rem] font-bold tracking-tight tabular-nums text-foreground leading-none">
            {display}
          </p>
          {sparkline && sparkline.length >= 2 && (
            <MiniSparkline values={sparkline} />
          )}
        </div>
        {sub && (
          <p
            className={cn(
              "text-xs mt-2 flex items-center gap-1",
              trend === "up"
                ? "text-green-500 dark:text-green-400 font-medium"
                : trend === "down"
                  ? "text-red-500 dark:text-red-400 font-medium"
                  : "text-muted-foreground/60",
            )}
          >
            {trend === "up" && <TrendingUp size={11} />}
            {trend === "down" && <TrendingDown size={11} />}
            {sub}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
