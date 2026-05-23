import { cookies } from "next/headers"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ApiError } from "@/components/ui/api-error"
import { cn } from "@/lib/utils"
import Link from "next/link"

const API_BASE = process.env.DASHBOARD_API_URL ?? "http://localhost:3000"

// ─── Types ─────────────────────────────────────────────────────────────────

interface Workspace {
  id: string
  name: string
  waServerConfigured: boolean
  waServerUrl?: string | null
}

interface Session {
  id: string
  status: string
  phoneNumber?: string | null
  name?: string | null
  connectedAt?: string | null
}

interface RecentActivityItem {
  id: string
  method: string
  endpoint: string
  statusCode: number
  sessionId: string | null
  createdAt: string
}

interface Stats {
  messages24h: { count: number; previousDayCount: number }
  successRate24h: { percentage: number; failed: number }
  eventsToday: { count: number; byType: Record<string, number> }
  messages7d: Array<{ date: string; count: number }>
  recentActivity: RecentActivityItem[]
}

// ─── Data fetching ──────────────────────────────────────────────────────────

async function fetchWorkspace(token: string): Promise<Workspace[] | null> {
  try {
    const res = await fetch(`${API_BASE}/workspaces`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    })
    if (!res.ok) return null
    const data = await res.json()
    return Array.isArray(data) ? data : (data.workspaces ?? [])
  } catch {
    return null
  }
}

async function fetchSessions(workspaceId: string, token: string): Promise<Session[] | null> {
  try {
    const res = await fetch(`${API_BASE}/workspaces/${workspaceId}/proxy/api/sessions`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    })
    if (!res.ok) return null
    const data = await res.json()
    return Array.isArray(data) ? data : (data.sessions ?? [])
  } catch {
    return null
  }
}

async function fetchHealthOk(workspaceId: string, token: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/workspaces/${workspaceId}/proxy/api/health`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    })
    return res.ok
  } catch {
    return false
  }
}

async function fetchStats(workspaceId: string, token: string): Promise<Stats | null> {
  try {
    const res = await fetch(`${API_BASE}/workspaces/${workspaceId}/stats`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    })
    if (!res.ok) return null
    return res.json()
  } catch {
    return null
  }
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function StatCard({
  title,
  value,
  sub,
  trend,
}: {
  title: string
  value: string | number
  sub?: string
  trend?: "up" | "down" | "neutral"
}) {
  return (
    <Card>
      <CardHeader className="pb-1">
        <CardTitle className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-bold text-foreground">{value}</p>
        {sub && (
          <p
            className={cn(
              "text-xs font-light mt-0.5",
              trend === "up"
                ? "text-green-600 dark:text-green-400"
                : trend === "down"
                  ? "text-red-500"
                  : "text-zinc-400",
            )}
          >
            {sub}
          </p>
        )}
      </CardContent>
    </Card>
  )
}

function BarChart({ data }: { data: Array<{ date: string; count: number }> }) {
  const max = Math.max(...data.map((d) => d.count), 1)
  return (
    <div className="flex items-end gap-1.5 h-28 w-full">
      {data.map((d) => {
        const pct = d.count > 0 ? Math.max((d.count / max) * 100, 4) : 0
        const label = d.date.slice(5) // MM-DD
        return (
          <div key={d.date} className="flex flex-col items-center gap-1 flex-1 min-w-0">
            <span className="text-[10px] text-zinc-400 tabular-nums leading-none">
              {d.count > 0 ? d.count : ""}
            </span>
            <div className="w-full flex items-end" style={{ height: "72px" }}>
              <div
                className="w-full bg-primary/60 rounded-t-sm transition-all"
                style={{ height: `${pct}%` }}
              />
            </div>
            <span className="text-[9px] text-zinc-400 tabular-nums truncate w-full text-center">
              {label}
            </span>
          </div>
        )
      })}
    </div>
  )
}

function TypeBars({ data }: { data: Array<{ type: string; count: number }> }) {
  const max = Math.max(...data.map((d) => d.count), 1)
  return (
    <div className="flex flex-col gap-2.5">
      {data.map((d) => (
        <div key={d.type} className="flex items-center gap-2">
          <span className="text-xs text-zinc-500 w-20 shrink-0 capitalize truncate">{d.type}</span>
          <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
            <div
              className="h-full bg-primary/60 rounded-full transition-all"
              style={{ width: `${(d.count / max) * 100}%` }}
            />
          </div>
          <span className="text-xs tabular-nums text-zinc-400 w-6 text-right">{d.count}</span>
        </div>
      ))}
    </div>
  )
}

function ActivityList({ items }: { items: RecentActivityItem[] }) {
  function relativeTime(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return "just now"
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    return `${Math.floor(hrs / 24)}d ago`
  }

  function activityLabel(item: RecentActivityItem): string {
    const ep = item.endpoint ?? ""
    const match = /\/messages\/([^/?]+)/.exec(ep)
    if (match) return `${match[1]} message sent`
    if (ep.includes("/sessions")) return `Session ${item.method.toLowerCase()}`
    return `${item.method} ${ep.split("/").slice(-1)[0] || "request"}`
  }

  return (
    <div className="flex flex-col divide-y divide-border">
      {items.map((item) => (
        <div key={item.id} className="flex items-start justify-between gap-2 py-2.5">
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
        <p className="text-sm text-zinc-400 py-6 text-center">No recent activity.</p>
      )}
    </div>
  )
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default async function OverviewPage() {
  const cookieStore = await cookies()
  const token = cookieStore.get("wa_access")?.value ?? ""

  const workspaces = await fetchWorkspace(token)

  if (workspaces === null) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-semibold text-foreground">Overview</h1>
        <ApiError message="Could not load workspace data." />
      </div>
    )
  }

  if (workspaces.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-semibold text-foreground">Overview</h1>
        <div className="rounded-xl border bg-muted/30 px-6 py-10 text-center">
          <p className="text-base font-medium text-foreground">No workspace configured</p>
          <p className="text-sm text-zinc-400 mt-1">Create a workspace to get started.</p>
        </div>
      </div>
    )
  }

  const workspace = workspaces[0]

  const [sessions, serverOnline, stats] = await Promise.all([
    workspace.waServerConfigured
      ? fetchSessions(workspace.id, token)
      : Promise.resolve(null),
    workspace.waServerConfigured
      ? fetchHealthOk(workspace.id, token)
      : Promise.resolve(false),
    fetchStats(workspace.id, token),
  ])

  // Sessions calculations
  const sessionList: Session[] = sessions ?? []
  const connected = sessionList.filter((s) => s.status === "connected").length
  const qrPending = sessionList.filter((s) =>
    ["qr_ready", "connecting"].includes(s.status),
  ).length
  const offline = sessionList.filter((s) =>
    ["disconnected", "logged_out", "failed", "qr_expired"].includes(s.status),
  ).length
  const total = sessionList.length

  // Messages 24h trend
  const trend =
    stats && stats.messages24h.count > stats.messages24h.previousDayCount
      ? "up"
      : stats && stats.messages24h.count < stats.messages24h.previousDayCount
        ? "down"
        : "neutral"
  const diff = stats
    ? Math.abs(stats.messages24h.count - stats.messages24h.previousDayCount)
    : 0
  const trendLabel =
    trend === "up"
      ? `↑ +${diff} from yesterday`
      : trend === "down"
        ? `↓ ${diff} fewer than yesterday`
        : "Same as yesterday"

  // By type data (top 6 from eventsToday.byType)
  const byTypeEntries: Array<{ type: string; count: number }> = stats
    ? Object.entries(stats.eventsToday.byType)
        .map(([type, count]) => ({ type, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 6)
    : []

  // Recent activity (last 8)
  const recentActivity: RecentActivityItem[] = stats
    ? (stats.recentActivity ?? []).slice(0, 8)
    : []

  // Empty state check
  const allZero =
    stats !== null &&
    stats.messages7d.every((d) => d.count === 0) &&
    stats.eventsToday.count === 0

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">{workspace.name}</h1>
          <p className="text-sm text-zinc-700 dark:text-zinc-300">Workspace overview</p>
        </div>
        {workspace.waServerConfigured && (
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium",
              serverOnline
                ? "bg-green-500/10 text-green-600 dark:text-green-400"
                : "bg-red-500/10 text-red-600 dark:text-red-400",
            )}
          >
            <span
              className={cn(
                "size-1.5 rounded-full",
                serverOnline ? "bg-green-500" : "bg-red-500",
              )}
            />
            WA Server: {serverOnline ? "Online" : "Offline"}
          </span>
        )}
      </div>

      {/* WA Server not configured warning */}
      {!workspace.waServerConfigured && (
        <Card className="border-amber-400/30 bg-amber-50/50 dark:bg-amber-900/10">
          <CardContent className="pt-4">
            <p className="text-sm text-amber-800 dark:text-amber-300">
              WA Server not configured.{" "}
              <Link
                href="/dashboard/settings"
                className="font-medium underline underline-offset-2"
              >
                Go to Settings
              </Link>{" "}
              to add your server URL and token.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Row 1 — 4 metric cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard
          title="Sessions Connected"
          value={`${connected} / ${total}`}
          sub={`${qrPending} pending · ${offline} offline`}
          trend="neutral"
        />
        <StatCard
          title="Messages (24h)"
          value={stats ? stats.messages24h.count.toLocaleString() : "—"}
          sub={stats ? trendLabel : undefined}
          trend={stats ? trend : undefined}
        />
        <StatCard
          title="Success Rate"
          value={stats ? `${stats.successRate24h.percentage}%` : "—"}
          sub={stats ? `${stats.successRate24h.failed} failed in 24h` : undefined}
          trend={
            stats
              ? stats.successRate24h.percentage >= 95
                ? "up"
                : stats.successRate24h.percentage < 80
                  ? "down"
                  : "neutral"
              : undefined
          }
        />
        <StatCard
          title="Events Today"
          value={stats ? stats.eventsToday.count.toLocaleString() : "—"}
          sub={stats ? "events logged today" : undefined}
          trend="neutral"
        />
      </div>

      {/* Sessions error */}
      {sessions === null && workspace.waServerConfigured && (
        <ApiError message="Could not load session data. Check your WA Server connection in Settings." />
      )}

      {/* Stats error */}
      {stats === null && (
        <ApiError message="Could not load stats data. The dashboard API may be unavailable." />
      )}

      {/* Empty state */}
      {allZero && (
        <div className="rounded-xl border bg-muted/30 px-6 py-10 text-center col-span-full">
          <p className="text-base font-medium text-foreground">No activity yet</p>
          <p className="text-sm text-zinc-400 mt-1">
            Send your first message to populate this dashboard.
          </p>
        </div>
      )}

      {/* Row 2 — Messages last 7 days */}
      {stats && stats.messages7d.length > 0 && !allZero && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium text-foreground">
              Messages — Last 7 Days
            </CardTitle>
            <p className="text-xs text-zinc-500">Daily message volume</p>
          </CardHeader>
          <CardContent>
            <BarChart data={stats.messages7d} />
          </CardContent>
        </Card>
      )}

      {/* Row 3 — By type + recent activity */}
      {stats && !allZero && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* By Message Type */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-medium text-foreground">
                By Message Type
              </CardTitle>
              <p className="text-xs text-zinc-500">Top 6 types sent today</p>
            </CardHeader>
            <CardContent>
              {byTypeEntries.length > 0 ? (
                <TypeBars data={byTypeEntries} />
              ) : (
                <p className="text-sm text-zinc-400 py-4 text-center">
                  No messages sent today yet.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-medium text-foreground">
                Recent Activity
              </CardTitle>
              <p className="text-xs text-zinc-500">Last 8 API requests</p>
            </CardHeader>
            <CardContent className="pb-2">
              <ActivityList items={recentActivity} />
            </CardContent>
          </Card>
        </div>
      )}

      {/* Show activity section even when stats available but allZero isn't fully empty */}
      {stats === null && sessions !== null && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-medium text-foreground">
                By Message Type
              </CardTitle>
              <p className="text-xs text-zinc-500">Top 6 types sent today</p>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-zinc-400 py-4 text-center">
                No messages sent today yet.
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-medium text-foreground">
                Recent Activity
              </CardTitle>
              <p className="text-xs text-zinc-500">Last 8 API requests</p>
            </CardHeader>
            <CardContent className="pb-2">
              <ActivityList items={[]} />
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
