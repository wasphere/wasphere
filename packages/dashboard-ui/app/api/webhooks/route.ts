import { cookies } from "next/headers"
import { serverGet, serverPost, resolveWorkspaceId } from "@/lib/server-fetch"

export async function GET() {
  const cookieStore = await cookies()
  const token = cookieStore.get("wa_access")?.value
  if (!token) return Response.json({ message: "Unauthorized" }, { status: 401 })

  const { workspaceId, wsError } = await resolveWorkspaceId(token)
  if (!workspaceId) return wsError!

  const { data, status } = await serverGet(`/workspaces/${workspaceId}/webhooks`, token)
  return Response.json(data ?? [], { status })
}

export async function POST(request: Request) {
  const cookieStore = await cookies()
  const token = cookieStore.get("wa_access")?.value
  if (!token) return Response.json({ message: "Unauthorized" }, { status: 401 })

  const { workspaceId, wsError } = await resolveWorkspaceId(token)
  if (!workspaceId) return wsError!

  const body = await request.json().catch(() => null)
  if (!body) return Response.json({ message: "Invalid request body" }, { status: 400 })

  const { data, status } = await serverPost(`/workspaces/${workspaceId}/webhooks`, token, body)
  return Response.json(data ?? {}, { status })
}
