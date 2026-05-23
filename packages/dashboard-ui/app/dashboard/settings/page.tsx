import { cookies } from "next/headers"
import { ApiError } from "@/components/ui/api-error"
import { SettingsForm, type Workspace } from "@/components/settings/settings-form"

const API_BASE = process.env.DASHBOARD_API_URL ?? "http://localhost:3000"

async function fetchWorkspace(token: string): Promise<{ workspace: Workspace; workspaceId: string } | null> {
  try {
    const listRes = await fetch(`${API_BASE}/workspaces`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    })
    if (!listRes.ok) return null
    const listData = await listRes.json()
    const list: Array<{ id: string }> = Array.isArray(listData)
      ? listData
      : (listData.workspaces ?? [])
    const workspaceId = list[0]?.id
    if (!workspaceId) return null

    const detailRes = await fetch(`${API_BASE}/workspaces/${workspaceId}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    })
    if (!detailRes.ok) return null
    const workspace = await detailRes.json()
    return { workspace, workspaceId }
  } catch {
    return null
  }
}

export default async function SettingsPage() {
  const cookieStore = await cookies()
  const token = cookieStore.get("wa_access")?.value ?? ""

  const result = await fetchWorkspace(token)

  if (!result) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-semibold">Settings</h1>
        <ApiError message="Could not load workspace settings." />
      </div>
    )
  }

  const { workspace } = result

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Settings</h1>
      <SettingsForm workspace={workspace} />
    </div>
  )
}
