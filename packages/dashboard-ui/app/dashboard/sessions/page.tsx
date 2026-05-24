import { cookies } from "next/headers"
import { ApiError } from "@/components/ui/api-error"
import {
  SessionsTable,
  type Session,
} from "@/components/sessions/sessions-table"
import { AntiBanControls } from "@/components/settings/anti-ban-controls"
import { type SessionSummary } from "@/lib/session-config"

import { serverGet } from "@/lib/server-fetch"

async function fetchWorkspaceId(token: string): Promise<string | null> {
  const { ok, data } = await serverGet<Array<{ id: string }> | { workspaces: Array<{ id: string }> }>("/workspaces", token)
  if (!ok || !data) return null
  const list = Array.isArray(data) ? data : (data.workspaces ?? [])
  return list[0]?.id ?? null
}

async function fetchSessions(
  workspaceId: string,
  token: string
): Promise<Session[] | null> {
  const { ok, data } = await serverGet<Session[] | { sessions: Session[] }>(
    `/workspaces/${workspaceId}/proxy/api/sessions`, token
  )
  if (!ok || !data) return null
  return Array.isArray(data) ? data : (data.sessions ?? [])
}

export default async function SessionsPage() {
  const cookieStore = await cookies()
  const token = cookieStore.get("wa_access")?.value ?? ""

  const workspaceId = await fetchWorkspaceId(token)

  if (!workspaceId) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold text-foreground">Sessions</h1>
          <p className="text-sm text-zinc-700 dark:text-zinc-300">Manage WhatsApp sessions connected to this workspace.</p>
        </div>
        <ApiError message="Could not load workspace. Please check your settings." />
      </div>
    )
  }

  const sessions = await fetchSessions(workspaceId, token)

  if (sessions === null) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold text-foreground">Sessions</h1>
          <p className="text-sm text-zinc-700 dark:text-zinc-300">Manage WhatsApp sessions connected to this workspace.</p>
        </div>
        <ApiError message="Could not load sessions. Check your WA Server connection in Settings." />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold text-foreground">Sessions</h1>
        <p className="text-sm text-zinc-700 dark:text-zinc-300">Manage WhatsApp sessions connected to this workspace.</p>
      </div>
      <SessionsTable initialSessions={sessions} />
      <AntiBanControls sessions={sessions as SessionSummary[]} />
    </div>
  )
}
