import { cookies } from "next/headers"
import { serverPatch, resolveWorkspaceId } from "@/lib/server-fetch"

export async function PATCH(req: Request, { params }: { params: Promise<{ userId: string }> }) {
  const token = (await cookies()).get("wa_access")?.value
  if (!token) return Response.json({ message: "Unauthorized" }, { status: 401 })
  const { userId } = await params
  let body: { permissions?: string[] }
  try { body = await req.json() } catch { return Response.json({ message: "Invalid body" }, { status: 400 }) }
  const { workspaceId, wsError } = await resolveWorkspaceId(token)
  if (!workspaceId) return wsError!
  const { data, status } = await serverPatch(`/workspaces/${workspaceId}/members/${userId}/permissions`, token, body)
  return Response.json(data ?? { message: "Upstream error" }, { status })
}
