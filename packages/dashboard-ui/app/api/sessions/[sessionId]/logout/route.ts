import { cookies } from "next/headers"
import { serverPost, resolveWorkspaceId } from "@/lib/server-fetch"

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const cookieStore = await cookies()
  const token = cookieStore.get("wa_access")?.value
  if (!token) return Response.json({ message: "Unauthorized" }, { status: 401 })

  const { sessionId } = await params
  const { workspaceId, status: wsStatus } = await resolveWorkspaceId(token)
  if (!workspaceId) {
    if (wsStatus === 401) return Response.json({ message: "Unauthorized" }, { status: 401 })
    return Response.json({ message: "No workspace found" }, { status: 404 })
  }

  const { data, status } = await serverPost(
    `/workspaces/${workspaceId}/proxy/api/sessions/${sessionId}/logout`,
    token
  )
  return Response.json(data ?? {}, { status })
}
