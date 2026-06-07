import { cookies } from "next/headers"
import { serverGet, resolveWorkspaceId } from "@/lib/server-fetch"

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
