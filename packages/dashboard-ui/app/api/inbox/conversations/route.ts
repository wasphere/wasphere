import { cookies } from "next/headers"
import { serverGet, serverPost, resolveWorkspaceId } from "@/lib/server-fetch"

// GET /api/inbox/conversations?status=&cursor=&limit=&q=
export async function GET(req: Request) {
  const token = (await cookies()).get("wa_access")?.value
  if (!token) return Response.json({ message: "Unauthorized" }, { status: 401 })

  const { workspaceId, wsError } = await resolveWorkspaceId(token)
  if (!workspaceId) return wsError!

  const qs = new URL(req.url).searchParams.toString()
  const { data, status } = await serverGet(
    `/workspaces/${workspaceId}/conversations${qs ? `?${qs}` : ""}`,
    token,
  )
  return Response.json(data ?? { items: [], nextCursor: null }, { status })
}

// POST /api/inbox/conversations — start a new conversation (send first message)
export async function POST(req: Request) {
  const token = (await cookies()).get("wa_access")?.value
  if (!token) return Response.json({ message: "Unauthorized" }, { status: 401 })

  let body: { sessionId?: string; to?: string; text?: string }
  try {
    body = await req.json()
  } catch {
    return Response.json({ message: "Invalid request body" }, { status: 400 })
  }

  const { workspaceId, wsError } = await resolveWorkspaceId(token)
  if (!workspaceId) return wsError!

  const { data, status } = await serverPost(`/workspaces/${workspaceId}/conversations`, token, body)
  return Response.json(data ?? { message: "Upstream error" }, { status })
}
