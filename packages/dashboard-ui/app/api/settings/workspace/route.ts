import { cookies } from "next/headers"

const API_BASE = process.env.DASHBOARD_API_URL ?? "http://localhost:3000"

async function resolveWorkspace(
  token: string
): Promise<{ id: string; [key: string]: unknown } | null> {
  const res = await fetch(`${API_BASE}/workspaces`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  })
  if (!res.ok) return null
  const data = await res.json()
  const list: Array<{ id: string }> = Array.isArray(data)
    ? data
    : (data.workspaces ?? [])
  return (list[0] as { id: string; [key: string]: unknown }) ?? null
}

export async function GET() {
  const cookieStore = await cookies()
  const token = cookieStore.get("wa_access")?.value
  if (!token) {
    return Response.json({ message: "Unauthorized" }, { status: 401 })
  }

  const workspace = await resolveWorkspace(token)
  if (!workspace) {
    return Response.json({ message: "No workspace found" }, { status: 404 })
  }

  return Response.json(workspace)
}

export async function PATCH(request: Request) {
  const cookieStore = await cookies()
  const token = cookieStore.get("wa_access")?.value
  if (!token) {
    return Response.json({ message: "Unauthorized" }, { status: 401 })
  }

  let body: { waServerUrl?: string; waServerToken?: string; name?: string }
  try {
    body = await request.json()
  } catch {
    return Response.json({ message: "Invalid request body" }, { status: 400 })
  }

  const workspace = await resolveWorkspace(token)
  if (!workspace) {
    return Response.json({ message: "No workspace found" }, { status: 404 })
  }

  const res = await fetch(`${API_BASE}/workspaces/${workspace.id}`, {
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
