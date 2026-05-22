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

async function fetchWorkspace(token: string): Promise<Workspace[] | null> {
  try {
    const res = await fetch(`${API_BASE}/workspaces`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    })
    if (!res.ok) return null
    const data = await res.json()
    // API returns { workspaces: [...] } or plain array — handle both.
    return Array.isArray(data) ? data : data.workspaces ?? []
  } catch {
    return null
  }
}

async function fetchSessions(
  workspaceId: string,
  token: string
): Promise<Session[] | null> {
  try {
    const res = await fetch(
      `${API_BASE}/workspaces/${workspaceId}/proxy/sessions`,
      {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      }
    )
    if (!res.ok) return null
    const data = await res.json()
    return Array.isArray(data) ? data : data.sessions ?? []
  } catch {
    return null
  }
}

async function fetchHealthOk(
  workspaceId: string,
  token: string
): Promise<boolean> {
  try {
    const res = await fetch(
      `${API_BASE}/workspaces/${workspaceId}/proxy/api/health`,
      {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      }
    )
    return res.ok
  } catch {
    return false
  }
}

interface StatCardProps {
  title: string
  value: number
}

function StatCard({ title, value }: StatCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-muted-foreground text-xs uppercase tracking-wide">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-bold">{value}</p>
      </CardContent>
    </Card>
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

  // Fetch sessions and health in parallel.
  const [sessions, serverOnline] = await Promise.all([
    fetchSessions(workspace.id, token),
    workspace.waServerConfigured
      ? fetchHealthOk(workspace.id, token)
      : Promise.resolve(false),
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

  return (
    <div className="flex flex-col gap-6">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{workspace.name}</h1>
          <p className="text-sm text-muted-foreground">Workspace overview</p>
        </div>
        {workspace.waServerConfigured ? (
          <span
            className={
              serverOnline
                ? "inline-flex items-center gap-1.5 rounded-full bg-green-500/10 px-3 py-1 text-xs font-medium text-green-600 dark:text-green-400"
                : "inline-flex items-center gap-1.5 rounded-full bg-red-500/10 px-3 py-1 text-xs font-medium text-red-600 dark:text-red-400"
            }
          >
            <span
              className={
                serverOnline
                  ? "size-1.5 rounded-full bg-green-500"
                  : "size-1.5 rounded-full bg-red-500"
              }
            />
            WA Server: {serverOnline ? "Online" : "Offline"}
          </span>
        ) : null}
      </div>

      {/* WA Server not configured callout */}
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

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard title="Total Sessions" value={totalSessions} />
        <StatCard title="Connected" value={connected} />
        <StatCard title="QR Pending" value={qrPending} />
        <StatCard title="Offline / Failed" value={offlineFailed} />
      </div>

      {/* Session fetch error (wa-server unreachable) */}
      {sessions === null && workspace.waServerConfigured && (
        <ApiError message="Could not load session data. Check your WA Server connection in Settings." />
      )}
    </div>
  )
}
