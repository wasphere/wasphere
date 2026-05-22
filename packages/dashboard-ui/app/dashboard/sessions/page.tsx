import { cookies } from "next/headers"
import { ApiError } from "@/components/ui/api-error"
import {
  SessionsTable,
  type Session,
} from "@/components/sessions/sessions-table"

const API_BASE = process.env.DASHBOARD_API_URL ?? "http://localhost:3000"

async function fetchWorkspaceId(token: string): Promise<string | null> {
  try {
    const res = await fetch(`${API_BASE}/workspaces`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    })
    if (!res.ok) return null
    const data = await res.json()
    const list: Array<{ id: string }> = Array.isArray(data)
      ? data
      : (data.workspaces ?? [])
    return list[0]?.id ?? null
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
    return Array.isArray(data) ? data : (data.sessions ?? [])
  } catch {
    return null
  }
}

export default async function SessionsPage() {
  const cookieStore = await cookies()
  const token = cookieStore.get("wa_access")?.value ?? ""

  const workspaceId = await fetchWorkspaceId(token)

  if (!workspaceId) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-semibold">Sessions</h1>
        <ApiError message="Could not load workspace. Please check your settings." />
      </div>
    )
  }

  const sessions = await fetchSessions(workspaceId, token)

  if (sessions === null) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-semibold">Sessions</h1>
        <ApiError message="Could not load sessions. Check your WA Server connection in Settings." />
      </div>
    )
  }

  return <SessionsTable initialSessions={sessions} />
}
