import { cookies } from "next/headers"
import { serverGet, serverPost, resolveWorkspaceId } from "@/lib/server-fetch"

type Params = { params: Promise<{ conversationId: string }> }

// GET thread (cursor-paginated, newest-first)
export async function GET(req: Request, { params }: Params) {
  const token = (await cookies()).get("wa_access")?.value
  if (!token) return Response.json({ message: "Unauthorized" }, { status: 401 })
  const { workspaceId, wsError } = await resolveWorkspaceId(token)
  if (!workspaceId) return wsError!
  const { conversationId } = await params
  const qs = new URL(req.url).searchParams.toString()
  const { data, status } = await serverGet(
    `/workspaces/${workspaceId}/conversations/${conversationId}/messages${qs ? `?${qs}` : ""}`,
    token,
  )
  return Response.json(data ?? { items: [], nextCursor: null }, { status })
}

// POST reply
export async function POST(req: Request, { params }: Params) {
  const token = (await cookies()).get("wa_access")?.value
  if (!token) return Response.json({ message: "Unauthorized" }, { status: 401 })
  const { workspaceId, wsError } = await resolveWorkspaceId(token)
  if (!workspaceId) return wsError!
  const { conversationId } = await params
  const body = await req.json().catch(() => ({}))
  const { data, status } = await serverPost(
    `/workspaces/${workspaceId}/conversations/${conversationId}/messages`,
    token,
    body,
  )
  return Response.json(data ?? {}, { status })
}
