import { cookies } from "next/headers"
import { ApiError } from "@/components/ui/api-error"
import { DeveloperPanel } from "@/components/developer/developer-panel"

import { serverGet } from "@/lib/server-fetch"

interface Workspace {
  id: string
  name: string
  waServerConfigured: boolean
  waServerUrl?: string | null
}

async function fetchWorkspace(token: string): Promise<Workspace | null> {
  const list = await serverGet<Array<{ id: string }> | { workspaces: Array<{ id: string }> }>("/workspaces", token)
  if (!list.ok || !list.data) return null
  const workspaces = Array.isArray(list.data) ? list.data : (list.data.workspaces ?? [])
  const workspaceId = workspaces[0]?.id
  if (!workspaceId) return null

  const detail = await serverGet<Workspace>(`/workspaces/${workspaceId}`, token)
  return detail.ok ? detail.data : null
}

export default async function DeveloperPage() {
  const cookieStore = await cookies()
  const token = cookieStore.get("wa_access")?.value ?? ""

  const workspace = await fetchWorkspace(token)

  if (workspace === null) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-semibold">Developer</h1>
        <ApiError message="Could not load workspace data." />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Developer</h1>
      <DeveloperPanel waServerUrl={workspace.waServerUrl ?? null} />
    </div>
  )
}
