import { cookies } from "next/headers"
import { ApiError } from "@/components/ui/api-error"
import { DeveloperPanel } from "@/components/developer/developer-panel"

const API_BASE = process.env.DASHBOARD_API_URL ?? "http://localhost:3000"

interface Workspace {
  id: string
  name: string
  waServerConfigured: boolean
  waServerUrl?: string | null
}

async function fetchWorkspace(token: string): Promise<Workspace | null> {
  try {
    const res = await fetch(`${API_BASE}/workspaces`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    })
    if (!res.ok) return null
    const data = await res.json()
    const list: Workspace[] = Array.isArray(data)
      ? data
      : (data.workspaces ?? [])
    return list[0] ?? null
  } catch {
    return null
  }
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
