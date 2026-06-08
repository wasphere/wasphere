import { cookies } from "next/headers"
import { serverDelete, resolveWorkspaceId } from "@/lib/server-fetch"

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const token = (await cookies()).get("wa_access")?.value
  if (!token) return Response.json({ message: "Unauthorized" }, { status: 401 })
  const { id } = await params
  const { workspaceId, wsError } = await resolveWorkspaceId(token)
  if (!workspaceId) return wsError!
  const { data, status } = await serverDelete(`/workspaces/${workspaceId}/invites/${id}`, token)
  return Response.json(data ?? { message: "Upstream error" }, { status })
}
