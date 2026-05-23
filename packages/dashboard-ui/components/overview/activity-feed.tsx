"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

export interface ActivityItem {
  id: string
  method: string
  endpoint: string
  statusCode: number
  sessionId: string | null
  createdAt: string
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

function activityLabel(item: ActivityItem): string {
  const ep = item.endpoint ?? ""
  const match = /\/messages\/([^/?]+)/.exec(ep)
  if (match) return `${match[1]} message sent`
  if (ep.includes("/sessions")) return `Session ${item.method.toLowerCase()}`
  return `${item.method} ${ep.split("/").slice(-1)[0] || "request"}`
}

export function ActivityFeed({ items }: { items: ActivityItem[] }) {
  return (
    <div className="flex flex-col divide-y divide-border">
      {items.map((item) => (
        <div
          key={item.id}
          className="flex items-start justify-between gap-2 py-2.5"
        >
          <div className="flex items-start gap-2 min-w-0">
            <span
              className={cn(
                "mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-medium",
                item.statusCode >= 200 && item.statusCode < 300
                  ? "bg-green-500/10 text-green-700 dark:text-green-400"
                  : "bg-red-500/10 text-red-600",
              )}
            >
              {item.statusCode}
            </span>
            <span className="text-sm text-zinc-700 dark:text-zinc-300 truncate">
              {activityLabel(item)}
            </span>
          </div>
          <span className="text-xs text-zinc-400 font-light shrink-0 tabular-nums">
            {relativeTime(item.createdAt)}
          </span>
        </div>
      ))}
      {items.length === 0 && (
        <p className="text-sm text-zinc-400 py-6 text-center">
          No recent activity.
        </p>
      )}
    </div>
  )
}
