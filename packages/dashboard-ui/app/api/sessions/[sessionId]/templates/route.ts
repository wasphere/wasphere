import { cookies } from "next/headers"
import { serverGet, serverPost, resolveWorkspaceId } from "@/lib/server-fetch"

// GET /api/sessions/:sessionId/templates — approved Meta templates for the picker
export async function GET(_req: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  const token = (await cookies()).get("wa_access")?.value
  if (!token) return Response.json({ message: "Unauthorized" }, { status: 401 })

  const { sessionId } = await params
  const { workspaceId, wsError } = await resolveWorkspaceId(token)
  if (!workspaceId) return wsError!

  const { data, status } = await serverGet(
    `/workspaces/${workspaceId}/proxy/api/sessions/${encodeURIComponent(sessionId)}/templates`,
    token,
  )
  return Response.json(data ?? [], { status })
}

// POST /api/sessions/:sessionId/templates — create a Meta template (Meta-only)
export async function POST(req: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  const token = (await cookies()).get("wa_access")?.value
  if (!token) return Response.json({ message: "Unauthorized" }, { status: 401 })

  const { sessionId } = await params
  let body: unknown = {}
  try { body = await req.json() } catch { return Response.json({ message: "Invalid body" }, { status: 400 }) }
  const { workspaceId, wsError } = await resolveWorkspaceId(token)
  if (!workspaceId) return wsError!

  const { data, status } = await serverPost(
    `/workspaces/${workspaceId}/proxy/api/sessions/${encodeURIComponent(sessionId)}/templates`,
    token,
    body,
  )
  return Response.json(data ?? { message: "Upstream error" }, { status })
}
