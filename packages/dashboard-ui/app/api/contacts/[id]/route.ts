import { cookies } from "next/headers"
import { serverPatch, resolveWorkspaceId } from "@/lib/server-fetch"

// PATCH /api/contacts/:id  { savedName }
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const token = (await cookies()).get("wa_access")?.value
  if (!token) return Response.json({ message: "Unauthorized" }, { status: 401 })

  const { id } = await params
  let body: { savedName?: string }
  try {
    body = await req.json()
  } catch {
    return Response.json({ message: "Invalid request body" }, { status: 400 })
  }

  const { workspaceId, wsError } = await resolveWorkspaceId(token)
  if (!workspaceId) return wsError!

  const { data, status } = await serverPatch(`/workspaces/${workspaceId}/contacts/${id}`, token, body)
  return Response.json(data ?? { message: "Upstream error" }, { status })
}
