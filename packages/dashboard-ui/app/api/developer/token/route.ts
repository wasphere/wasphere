import { cookies } from "next/headers"
import { serverGet, resolveWorkspaceId } from "@/lib/server-fetch"

export async function GET() {
  const cookieStore = await cookies()
  const token = cookieStore.get("wa_access")?.value
  if (!token) return Response.json({ message: "Unauthorized" }, { status: 401 })

  const { workspaceId, wsError } = await resolveWorkspaceId(token)
  if (!workspaceId) return wsError!

  const { data } = await serverGet<{ id: string; waServerConfigured?: boolean }>(
    `/workspaces/${workspaceId}`,
    token
  )
  if (!data) return Response.json({ message: "No workspace found" }, { status: 404 })

  const configured = data.waServerConfigured === true
  return Response.json({ token: configured ? "••••••••" : null })
}
