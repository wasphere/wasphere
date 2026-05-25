import { cookies } from "next/headers"

const API_BASE = process.env.DASHBOARD_API_URL ?? "http://localhost:3000"

async function resolveWorkspaceId(token: string): Promise<string | null> {
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
}

export async function GET(request: Request) {
  const cookieStore = await cookies()
  const token = cookieStore.get("wa_access")?.value
  if (!token) {
    return Response.json({ message: "Unauthorized" }, { status: 401 })
  }

  const workspaceId = await resolveWorkspaceId(token)
  if (!workspaceId) {
    return Response.json({ message: "No workspace found" }, { status: 404 })
  }

  // Forward accepted query params to dashboard-api.
  const { searchParams } = new URL(request.url)
  const upstreamParams = new URLSearchParams()
  for (const key of ["page", "pageSize", "from", "to", "sessionId", "statusCode"]) {
    const val = searchParams.get(key)
    if (val !== null && val !== "") {
      upstreamParams.set(key, val)
    }
  }

  const upstreamUrl = `${API_BASE}/workspaces/${workspaceId}/audit-logs?${upstreamParams.toString()}`

  const res = await fetch(upstreamUrl, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  })

  const body = await res.json().catch(() => ({ message: "Upstream error" }))
  return Response.json(body, { status: res.status })
}
