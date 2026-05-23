import { cookies } from "next/headers"

const API_BASE = process.env.DASHBOARD_API_URL ?? "http://localhost:3000"

async function resolveWorkspace(
  token: string
): Promise<{ id: string; waServerConfigured?: boolean } | null> {
  // The list endpoint is enough — it includes waServerConfigured.
  const res = await fetch(`${API_BASE}/workspaces`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  })
  if (!res.ok) return null
  const data = await res.json()
  const list: Array<{ id: string; waServerConfigured?: boolean }> =
    Array.isArray(data) ? data : (data.workspaces ?? [])
  return list[0] ?? null
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

  // The backend never exposes the raw token for security.
  // Return a masked sentinel when a token is configured so the UI can show "Configured".
  const configured = workspace.waServerConfigured === true
  return Response.json({ token: configured ? "••••••••" : null })
}
