import { cookies } from "next/headers"
import { serverGet, resolveWorkspaceId } from "@/lib/server-fetch"

export async function GET() {
  const token = (await cookies()).get("wa_access")?.value
  if (!token) return Response.json({ message: "Unauthorized" }, { status: 401 })
  const { workspaceId, wsError } = await resolveWorkspaceId(token)
  if (!workspaceId) return wsError!
  const { data, status } = await serverGet(`/workspaces/${workspaceId}/members`, token)
  return Response.json(data ?? [], { status })
}
