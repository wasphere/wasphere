import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { SettingsForm, type Workspace } from "@/components/settings/settings-form"

import { serverGet, tryRefreshToken } from "@/lib/server-fetch"

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

export default async function SettingsPage() {
  const cookieStore = await cookies()
  let token = cookieStore.get("wa_access")?.value ?? ""

  if (!token) redirect("/login?reason=expired")

  let result = await fetchWorkspace(token)

  if (!result) {
    const newToken = await tryRefreshToken()
    if (newToken) {
      token = newToken
      result = await fetchWorkspace(token)
    }
    if (!result) redirect("/login?reason=expired")
  }

  const { workspace } = result

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Settings</h1>
      <SettingsForm workspace={workspace} />
    </div>
  )
}
