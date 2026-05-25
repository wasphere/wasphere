import { cookies } from "next/headers"
import { serverGet, resolveWorkspaceId } from "@/lib/server-fetch"

export async function GET(request: Request) {
  const cookieStore = await cookies()
  const token = cookieStore.get("wa_access")?.value
  if (!token) return Response.json({ message: "Unauthorized" }, { status: 401 })

  const { workspaceId, status: wsStatus } = await resolveWorkspaceId(token)
  if (!workspaceId) {
    if (wsStatus === 401) return Response.json({ message: "Unauthorized" }, { status: 401 })
    return Response.json({ message: "No workspace found" }, { status: 404 })
  }

  const { searchParams } = new URL(request.url)
  const upstreamParams = new URLSearchParams()
  for (const key of ["page", "pageSize", "from", "to", "sessionId", "statusCode"]) {
    const val = searchParams.get(key)
    if (val !== null && val !== "") upstreamParams.set(key, val)
  }

  const { data, status } = await serverGet(
    `/workspaces/${workspaceId}/audit-logs?${upstreamParams.toString()}`,
    token
  )
  return Response.json(data ?? { message: "Upstream error" }, { status })
}
