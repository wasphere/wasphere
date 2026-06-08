import { cookies } from "next/headers"
import { serverGet, serverPost, resolveWorkspaceId } from "@/lib/server-fetch"

// GET /api/contacts?search=&tag=&limit=&cursor=
export async function GET(req: Request) {
  const token = (await cookies()).get("wa_access")?.value
  if (!token) return Response.json({ message: "Unauthorized" }, { status: 401 })

  const { workspaceId, wsError } = await resolveWorkspaceId(token)
  if (!workspaceId) return wsError!

  const qs = new URL(req.url).searchParams.toString()
  const { data, status } = await serverGet(
    `/workspaces/${workspaceId}/contacts${qs ? `?${qs}` : ""}`,
    token,
  )
  return Response.json(data ?? { items: [], nextCursor: null }, { status })
}

// POST /api/contacts  { phone, savedName?, tags? } — manually add a contact
export async function POST(req: Request) {
  const token = (await cookies()).get("wa_access")?.value
  if (!token) return Response.json({ message: "Unauthorized" }, { status: 401 })
  let body: unknown
  try { body = await req.json() } catch { return Response.json({ message: "Invalid body" }, { status: 400 }) }
  const { workspaceId, wsError } = await resolveWorkspaceId(token)
  if (!workspaceId) return wsError!
  const { data, status } = await serverPost(`/workspaces/${workspaceId}/contacts`, token, body)
  return Response.json(data ?? { message: "Upstream error" }, { status })
}
