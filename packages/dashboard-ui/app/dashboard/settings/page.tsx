import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { existsSync, readFileSync } from "node:fs"
import { SettingsForm, type Workspace } from "@/components/settings/settings-form"
import { LogoBrandingCard } from "@/components/settings/logo-branding-card"

import { serverGet } from "@/lib/server-fetch"

async function fetchWorkspace(token: string): Promise<{ workspace: Workspace; workspaceId: string } | null> {
  const list = await serverGet<Array<{ id: string }> | { workspaces: Array<{ id: string }> }>("/workspaces", token)
  if (!list.ok || !list.data) return null
  const workspaces = Array.isArray(list.data) ? list.data : (list.data.workspaces ?? [])
  const workspaceId = workspaces[0]?.id
  if (!workspaceId) return null

  const detail = await serverGet<Workspace>(`/workspaces/${workspaceId}`, token)
  if (!detail.ok || !detail.data) return null
  return { workspace: detail.data, workspaceId }
}

/**
 * Best-guess WA Server URL to suggest when a workspace has none set yet:
 *   1. WA_SERVER_INTERNAL_URL env (already correct in the Docker compose).
 *   2. Docker detected → the compose service name `http://wa-server:3001`.
 *   3. Otherwise a manual single-host install → `http://localhost:3001`.
 */
function suggestWaServerUrl(): string {
  const fromEnv = process.env.WA_SERVER_INTERNAL_URL?.trim()
  if (fromEnv) return fromEnv

  let dockerized = existsSync("/.dockerenv")
  if (!dockerized) {
    try {
      const cgroup = readFileSync("/proc/1/cgroup", "utf8")
      dockerized = /docker|containerd|kubepods/.test(cgroup)
    } catch {
      dockerized = false
    }
  }
  return dockerized ? "http://wa-server:3001" : "http://localhost:3001"
}

export default async function SettingsPage() {
  const cookieStore = await cookies()
  const token = cookieStore.get("wa_access")?.value ?? ""

  if (!token) redirect("/login?reason=expired")

  const result = await fetchWorkspace(token)

  if (!result) {
    redirect("/login?reason=expired")
  }

  const { workspace } = result

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Settings</h1>
      <SettingsForm workspace={workspace} suggestedWaServerUrl={suggestWaServerUrl()} />
      <LogoBrandingCard initialLogo={workspace.logo} />
    </div>
  )
}
