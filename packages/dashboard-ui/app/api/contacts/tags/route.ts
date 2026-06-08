import { cookies } from "next/headers"
import { serverGet, resolveWorkspaceId } from "@/lib/server-fetch"

// GET /api/contacts/tags → string[]
export async function GET() {
  const token = (await cookies()).get("wa_access")?.value
  if (!token) return Response.json([], { status: 200 })
  const { workspaceId } = await resolveWorkspaceId(token)
  if (!workspaceId) return Response.json([], { status: 200 })
  const { data, status } = await serverGet(`/workspaces/${workspaceId}/contacts/tags`, token)
  return Response.json(data ?? [], { status: status || 200 })
}
