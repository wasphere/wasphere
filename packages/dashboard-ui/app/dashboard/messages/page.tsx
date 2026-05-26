import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { MessagesPanel } from "@/components/messages/messages-panel"

import { serverGet } from "@/lib/server-fetch"

interface SessionRaw {
  id: string
  status: string
  phoneNumber?: string | null
  name?: string | null
  [key: string]: unknown
}

async function fetchWorkspaceId(token: string): Promise<string | null> {
  const { ok, data } = await serverGet<Array<{ id: string }> | { workspaces: Array<{ id: string }> }>("/workspaces", token)
  if (!ok || !data) return null
  const list = Array.isArray(data) ? data : (data.workspaces ?? [])
  return list[0]?.id ?? null
}

async function fetchSessions(
  workspaceId: string,
  token: string
): Promise<SessionRaw[] | null> {
  const { ok, data } = await serverGet<SessionRaw[] | { sessions: SessionRaw[] }>(
    `/workspaces/${workspaceId}/proxy/api/sessions`, token
  )
  if (!ok || !data) return null
  return Array.isArray(data) ? data : (data.sessions ?? [])
}

export default async function MessagesPage() {
  const cookieStore = await cookies()
  let token = cookieStore.get("wa_access")?.value ?? ""

  if (!token) redirect("/login?reason=expired")

  let workspaceId = await fetchWorkspaceId(token)

  if (!workspaceId) {
    redirect("/login?reason=expired")
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
