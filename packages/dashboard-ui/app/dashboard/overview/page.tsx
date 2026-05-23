import { cookies } from "next/headers"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { ApiError } from "@/components/ui/api-error"
import { EmptyState } from "@/components/ui/empty-state"
import Link from "next/link"

const API_BASE = process.env.DASHBOARD_API_URL ?? "http://localhost:3000"

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

interface DayBucket {
  date: string
  count: number
}

interface TypeBucket {
  type: string
  count: number
}

interface Stats {
  totalMessages: number
  last7Days: DayBucket[]
  byType: TypeBucket[]
}

async function fetchWorkspace(token: string): Promise<Workspace[] | null> {
  try {
    const res = await fetch(`${API_BASE}/workspaces`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    })
    if (!res.ok) return null
    const data = await res.json()
    return Array.isArray(data) ? data : data.workspaces ?? []
  } catch {
    return null
  }
}

async function fetchSessions(workspaceId: string, token: string): Promise<Session[] | null> {
  try {
    const res = await fetch(
      `${API_BASE}/workspaces/${workspaceId}/proxy/api/sessions`,
      { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }
    )
    if (!res.ok) return null
    const data = await res.json()
    return Array.isArray(data) ? data : data.sessions ?? []
  } catch {
    return null
  }
}

async function fetchHealthOk(workspaceId: string, token: string): Promise<boolean> {
  try {
    const res = await fetch(
      `${API_BASE}/workspaces/${workspaceId}/proxy/api/health`,
      { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }
    )
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

interface StatCardProps {
  title: string
  value: number | string
  sub?: string
}

function StatCard({ title, value, sub }: StatCardProps) {
  return (
    <Card>
      <CardHeader className="pb-1">
        <CardTitle className="text-muted-foreground text-xs uppercase tracking-wide font-medium">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-bold">{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </CardContent>
    </Card>
  )
}

function BarChart({ data }: { data: DayBucket[] }) {
  const max = Math.max(...data.map((d) => d.count), 1)
  return (
    <div className="flex items-end gap-1.5 h-24 w-full">
      {data.map((d) => {
        const pct = Math.max((d.count / max) * 100, d.count > 0 ? 4 : 0)
        const label = d.date.slice(5) // MM-DD
        return (
          <div key={d.date} className="flex flex-col items-center gap-1 flex-1 min-w-0">
            <span className="text-[10px] text-muted-foreground tabular-nums">{d.count > 0 ? d.count : ""}</span>
            <div
              className="w-full rounded-t-sm bg-primary/70 transition-all"
              style={{ height: `${pct}%` }}
            />
            <span className="text-[9px] text-muted-foreground tabular-nums truncate w-full text-center">
              {label}
            </span>
          </div>
        )
      })}
    </div>
  )
}

function TypeBars({ data }: { data: TypeBucket[] }) {
  const max = Math.max(...data.map((d) => d.count), 1)
  return (
    <div className="flex flex-col gap-2">
      {data.map((d) => (
        <div key={d.type} className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground w-16 shrink-0 capitalize">{d.type}</span>
          <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
            <div
              className="h-full bg-primary/70 rounded-full transition-all"
              style={{ width: `${(d.count / max) * 100}%` }}
            />
          </div>
          <span className="text-xs tabular-nums text-muted-foreground w-8 text-right">{d.count}</span>
        </div>
      ))}
    </div>
  )
}

export default async function OverviewPage() {
  const cookieStore = await cookies()
  const token = cookieStore.get("wa_access")?.value ?? ""

  const workspaces = await fetchWorkspace(token)

  if (workspaces === null) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-semibold">Overview</h1>
        <ApiError message="Could not load workspace data." />
      </div>
    )
  }

  if (workspaces.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-semibold">Overview</h1>
        <EmptyState
          message="No workspace configured."
          description="Create a workspace to get started."
        />
      </div>
    )
  }

  const workspace = workspaces[0]

  const [sessions, serverOnline, stats] = await Promise.all([
    fetchSessions(workspace.id, token),
    workspace.waServerConfigured
      ? fetchHealthOk(workspace.id, token)
      : Promise.resolve(false),
    fetchStats(workspace.id, token),
  ])

  const sessionList: Session[] = sessions ?? []
  const totalSessions = sessionList.length
  const connected = sessionList.filter((s) => s.status === "connected").length
  const qrPending = sessionList.filter(
    (s) => s.status === "qr_ready" || s.status === "connecting"
  ).length
  const offlineFailed = sessionList.filter((s) =>
    ["disconnected", "logged_out", "failed", "qr_expired"].includes(s.status)
  ).length

  const weekTotal = stats?.last7Days.reduce((s, d) => s + d.count, 0) ?? 0

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{workspace.name}</h1>
          <p className="text-sm text-muted-foreground">Workspace overview</p>
        </div>
        {workspace.waServerConfigured && (
          <span
            className={
              serverOnline
                ? "inline-flex items-center gap-1.5 rounded-full bg-green-500/10 px-3 py-1 text-xs font-medium text-green-600 dark:text-green-400"
                : "inline-flex items-center gap-1.5 rounded-full bg-red-500/10 px-3 py-1 text-xs font-medium text-red-600 dark:text-red-400"
            }
          >
            <span className={serverOnline ? "size-1.5 rounded-full bg-green-500" : "size-1.5 rounded-full bg-red-500"} />
            WA Server: {serverOnline ? "Online" : "Offline"}
          </span>
        )}
      </div>

      {!workspace.waServerConfigured && (
        <Card className="border-amber-400/30 bg-amber-50/50 dark:bg-amber-900/10">
          <CardContent className="pt-4">
            <p className="text-sm text-amber-800 dark:text-amber-300">
              WA Server not configured.{" "}
              <Link href="/dashboard/settings" className="font-medium underline underline-offset-2">
                Go to Settings
              </Link>{" "}
              to add your server URL and token.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Session stat cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard title="Total Sessions" value={totalSessions} />
        <StatCard title="Connected" value={connected} />
        <StatCard title="QR Pending" value={qrPending} />
        <StatCard title="Offline / Failed" value={offlineFailed} />
      </div>

      {sessions === null && workspace.waServerConfigured && (
        <ApiError message="Could not load session data. Check your WA Server connection in Settings." />
      )}

      {/* Message stats */}
      {stats && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard
            title="Total Messages Sent"
            value={stats.totalMessages.toLocaleString()}
            sub="all time"
          />
          <StatCard
            title="Messages This Week"
            value={weekTotal.toLocaleString()}
            sub="last 7 days"
          />
          <StatCard
            title="Top Message Type"
            value={stats.byType[0]?.type ?? "—"}
            sub={stats.byType[0] ? `${stats.byType[0].count} sent` : undefined}
          />
        </div>
      )}

      {stats && stats.last7Days.length > 0 && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Messages per Day</CardTitle>
              <p className="text-xs text-muted-foreground">Last 7 days</p>
            </CardHeader>
            <CardContent>
              <BarChart data={stats.last7Days} />
            </CardContent>
          </Card>

          {stats.byType.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">By Message Type</CardTitle>
                <p className="text-xs text-muted-foreground">All time, top 8</p>
              </CardHeader>
              <CardContent>
                <TypeBars data={stats.byType} />
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}
