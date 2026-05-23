import { cookies } from "next/headers"
import { ApiError } from "@/components/ui/api-error"
import { MessagesPanel } from "@/components/messages/messages-panel"

const API_BASE = process.env.DASHBOARD_API_URL ?? "http://localhost:3000"

interface SessionRaw {
  id: string
  status: string
  phoneNumber?: string | null
  name?: string | null
  [key: string]: unknown
}

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
): Promise<SessionRaw[] | null> {
  try {
    const res = await fetch(
      `${API_BASE}/workspaces/${workspaceId}/proxy/api/sessions`,
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

export default async function MessagesPage() {
  const cookieStore = await cookies()
  const token = cookieStore.get("wa_access")?.value ?? ""

  const workspaceId = await fetchWorkspaceId(token)

  if (!workspaceId) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-semibold">Messages</h1>
        <ApiError message="Could not load workspace." />
      </div>
    )
  }

  const sessions = await fetchSessions(workspaceId, token)

  if (sessions === null) {
    return (
      <MessagesPanel
        sessions={[]}
        sessionsError="Could not load sessions. Check your WA Server connection in Settings."
      />
    )
  }

  const allSessions = sessions.map((s) => ({
    id: s.id,
    phoneNumber: s.phoneNumber,
    name: s.name,
    status: s.status,
  }))

  return <MessagesPanel sessions={allSessions} />
}
