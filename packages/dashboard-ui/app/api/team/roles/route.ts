import { cookies } from "next/headers"
import { serverGet, serverPost, resolveWorkspaceId } from "@/lib/server-fetch"

export async function GET() {
  const token = (await cookies()).get("wa_access")?.value
  if (!token) return Response.json([], { status: 200 })
  const { workspaceId } = await resolveWorkspaceId(token)
  if (!workspaceId) return Response.json([], { status: 200 })
  const { data, status } = await serverGet(`/workspaces/${workspaceId}/roles`, token)
  return Response.json(data ?? [], { status: status || 200 })
}

export async function POST(req: Request) {
  const token = (await cookies()).get("wa_access")?.value
  if (!token) return Response.json({ message: "Unauthorized" }, { status: 401 })
  let body: unknown
  try { body = await req.json() } catch { return Response.json({ message: "Invalid body" }, { status: 400 }) }
  const { workspaceId, wsError } = await resolveWorkspaceId(token)
  if (!workspaceId) return wsError!
  const { data, status } = await serverPost(`/workspaces/${workspaceId}/roles`, token, body)
  return Response.json(data ?? { message: "Upstream error" }, { status })
}
