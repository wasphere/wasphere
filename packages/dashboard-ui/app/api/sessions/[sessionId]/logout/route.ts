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

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const cookieStore = await cookies()
  const token = cookieStore.get("wa_access")?.value
  if (!token) {
    return Response.json({ message: "Unauthorized" }, { status: 401 })
  }

  const { sessionId } = await params

  const workspaceId = await resolveWorkspaceId(token)
  if (!workspaceId) {
    return Response.json({ message: "No workspace found" }, { status: 404 })
  }

  const res = await fetch(
    `${API_BASE}/workspaces/${workspaceId}/proxy/api/sessions/${sessionId}/logout`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    }
  )

  if (res.status === 204 || res.headers.get("content-length") === "0") {
    return new Response(null, { status: 200 })
  }

  const body = await res.json().catch(() => ({ message: "Upstream error" }))
  return Response.json(body, { status: res.status })
}
