import { cookies } from "next/headers"
import { serverGet, serverDelete, resolveWorkspaceId } from "@/lib/server-fetch"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const cookieStore = await cookies()
  const token = cookieStore.get("wa_access")?.value
  if (!token) return Response.json({ message: "Unauthorized" }, { status: 401 })

  const { sessionId } = await params
  const { workspaceId, wsError } = await resolveWorkspaceId(token)
  if (!workspaceId) return wsError!

  const { data, status } = await serverGet(`/workspaces/${workspaceId}/proxy/api/sessions/${sessionId}`, token)
  return Response.json(data ?? { message: "Upstream error" }, { status })
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const cookieStore = await cookies()
  const token = cookieStore.get("wa_access")?.value
  if (!token) return Response.json({ message: "Unauthorized" }, { status: 401 })

  const { sessionId } = await params
  const { workspaceId, wsError } = await resolveWorkspaceId(token)
  if (!workspaceId) return wsError!

  const { data, status } = await serverDelete(`/workspaces/${workspaceId}/proxy/api/sessions/${sessionId}`, token)
  return Response.json(data ?? {}, { status })
}
