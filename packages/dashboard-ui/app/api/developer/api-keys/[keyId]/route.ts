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

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ keyId: string }> }
) {
  const cookieStore = await cookies()
  const token = cookieStore.get("wa_access")?.value
  if (!token) return Response.json({ message: "Unauthorized" }, { status: 401 })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json({ message: "Invalid request body" }, { status: 400 })
  }

  const { keyId } = await params
  const workspaceId = await resolveWorkspaceId(token)
  if (!workspaceId) return Response.json({ message: "No workspace found" }, { status: 404 })

  const res = await fetch(`${API_BASE}/workspaces/${workspaceId}/api-keys/${keyId}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  })
  const resBody = await res.json().catch(() => ({ message: "Upstream error" }))
  return Response.json(resBody, { status: res.status })
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ keyId: string }> }
) {
  const cookieStore = await cookies()
  const token = cookieStore.get("wa_access")?.value
  if (!token) return Response.json({ message: "Unauthorized" }, { status: 401 })

  const { keyId } = await params
  const workspaceId = await resolveWorkspaceId(token)
  if (!workspaceId) return Response.json({ message: "No workspace found" }, { status: 404 })

  const res = await fetch(`${API_BASE}/workspaces/${workspaceId}/api-keys/${keyId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  })
  const resBody = await res.json().catch(() => ({ message: "Upstream error" }))
  return Response.json(resBody, { status: res.status })
}
