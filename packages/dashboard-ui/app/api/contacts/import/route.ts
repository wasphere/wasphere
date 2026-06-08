import { cookies } from "next/headers"
import { serverPost, resolveWorkspaceId } from "@/lib/server-fetch"

// POST /api/contacts/import  { contacts: [{ phone, name?, tags?, notes? }] }
//   → { imported, skipped, invalid }
export async function POST(req: Request) {
  const token = (await cookies()).get("wa_access")?.value
  if (!token) return Response.json({ message: "Unauthorized" }, { status: 401 })
  let body: unknown = {}
  try { body = await req.json() } catch { return Response.json({ message: "Invalid body" }, { status: 400 }) }
  const { workspaceId, wsError } = await resolveWorkspaceId(token)
  if (!workspaceId) return wsError!
  const { data, status } = await serverPost(`/workspaces/${workspaceId}/contacts/import`, token, body)
  return Response.json(data ?? { message: "Upstream error" }, { status })
}
