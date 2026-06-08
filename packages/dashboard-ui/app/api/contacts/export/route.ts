import { cookies } from "next/headers"
import { serverPost, resolveWorkspaceId } from "@/lib/server-fetch"

// POST /api/contacts/export  { ids? } → { filename, csv, count }
export async function POST(req: Request) {
  const token = (await cookies()).get("wa_access")?.value
  if (!token) return Response.json({ message: "Unauthorized" }, { status: 401 })
  let body: unknown = {}
  try { body = await req.json() } catch { /* empty body = export all */ }
  const { workspaceId, wsError } = await resolveWorkspaceId(token)
  if (!workspaceId) return wsError!
  const { data, status } = await serverPost(`/workspaces/${workspaceId}/contacts/export`, token, body)
  return Response.json(data ?? { message: "Upstream error" }, { status })
}
