import { cookies } from "next/headers"
import { serverPatch, serverDelete, resolveWorkspaceId } from "@/lib/server-fetch"

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ webhookId: string }> }
) {
  const { webhookId } = await params
  const cookieStore = await cookies()
  const token = cookieStore.get("wa_access")?.value
  if (!token) return Response.json({ message: "Unauthorized" }, { status: 401 })

  const { workspaceId, wsError } = await resolveWorkspaceId(token)
  if (!workspaceId) return wsError!

  const body = await request.json().catch(() => null)
  if (!body) return Response.json({ message: "Invalid request body" }, { status: 400 })

  const { data, status } = await serverPatch(`/workspaces/${workspaceId}/webhooks/${webhookId}`, token, body)
  return Response.json(data ?? {}, { status })
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ webhookId: string }> }
) {
  const { webhookId } = await params
  const cookieStore = await cookies()
  const token = cookieStore.get("wa_access")?.value
  if (!token) return Response.json({ message: "Unauthorized" }, { status: 401 })

  const { workspaceId, wsError } = await resolveWorkspaceId(token)
  if (!workspaceId) return wsError!

  const { data, status } = await serverDelete(`/workspaces/${workspaceId}/webhooks/${webhookId}`, token)
  return Response.json(data ?? {}, { status })
}
