import { cookies } from "next/headers"

const API_BASE = process.env.DASHBOARD_API_URL ?? "http://localhost:3000"

async function resolveWorkspace(
  token: string
): Promise<{ id: string; [key: string]: unknown } | null> {
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

  // Use the detail endpoint which includes waServerUrl and waServerToken.
  const detailRes = await fetch(`${API_BASE}/workspaces/${workspaceId}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  })
  if (!detailRes.ok) return null
  return await detailRes.json()
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

  // WA server config uses /wa-server endpoint; name updates are not yet supported.
  if (body.waServerUrl !== undefined || body.waServerToken !== undefined) {
    const res = await fetch(`${API_BASE}/workspaces/${workspace.id}/wa-server`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        waServerUrl: body.waServerUrl,
        waServerToken: body.waServerToken,
      }),
    })

    const resBody = await res.json().catch(() => ({ message: "Upstream error" }))
    return Response.json(resBody, { status: res.status })
  }

  return Response.json({ message: "Nothing to update" }, { status: 400 })
}
