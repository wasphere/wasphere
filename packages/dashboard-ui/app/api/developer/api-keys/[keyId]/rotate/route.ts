import { cookies } from "next/headers"
import { serverPost, resolveWorkspaceId } from "@/lib/server-fetch"

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ keyId: string }> }
) {
  const cookieStore = await cookies()
  const token = cookieStore.get("wa_access")?.value
  if (!token) return Response.json({ message: "Unauthorized" }, { status: 401 })

  const { keyId } = await params
  const { workspaceId, wsError } = await resolveWorkspaceId(token)
  if (!workspaceId) return wsError!

  const { data, status } = await serverPost(`/workspaces/${workspaceId}/api-keys/${keyId}/rotate`, token)
  return Response.json(data ?? { message: "Upstream error" }, { status })
}
