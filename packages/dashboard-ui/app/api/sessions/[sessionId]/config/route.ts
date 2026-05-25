import { cookies } from "next/headers"
import { serverPatch, resolveWorkspaceId } from "@/lib/server-fetch"

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const cookieStore = await cookies()
  const token = cookieStore.get("wa_access")?.value
  if (!token) return Response.json({ message: "Unauthorized" }, { status: 401 })

  const { sessionId } = await params

  let body: {
    random_delay_min_ms?: number
    random_delay_max_ms?: number
    auto_read_on_receive?: boolean
    receive_enabled?: boolean
  }
  try {
    body = await request.json()
  } catch {
    return Response.json({ message: "Invalid request body" }, { status: 400 })
  }

  const { workspaceId, status: wsStatus } = await resolveWorkspaceId(token)
  if (!workspaceId) {
    if (wsStatus === 401) return Response.json({ message: "Unauthorized" }, { status: 401 })
    return Response.json({ message: "No workspace found" }, { status: 404 })
  }

  const { data, status } = await serverPatch(
    `/workspaces/${workspaceId}/proxy/api/sessions/${sessionId}/config`,
    token,
    body
  )
  return Response.json(data ?? { message: "Upstream error" }, { status })
}
