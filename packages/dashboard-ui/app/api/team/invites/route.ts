import { cookies } from "next/headers"
import { serverGet, serverPost, resolveWorkspaceId } from "@/lib/server-fetch"

export async function GET() {
  const token = (await cookies()).get("wa_access")?.value
  if (!token) return Response.json({ message: "Unauthorized" }, { status: 401 })
  const { workspaceId, wsError } = await resolveWorkspaceId(token)
  if (!workspaceId) return wsError!
  const { data, status } = await serverGet(`/workspaces/${workspaceId}/invites`, token)
  return Response.json(data ?? [], { status })
}

export async function POST(req: Request) {
  const token = (await cookies()).get("wa_access")?.value
  if (!token) return Response.json({ message: "Unauthorized" }, { status: 401 })
  let body: { role?: string; email?: string }
  try { body = await req.json() } catch { return Response.json({ message: "Invalid body" }, { status: 400 }) }
  const { workspaceId, wsError } = await resolveWorkspaceId(token)
  if (!workspaceId) return wsError!
  const { data, status } = await serverPost(`/workspaces/${workspaceId}/invites`, token, body)
  return Response.json(data ?? { message: "Upstream error" }, { status })
}
