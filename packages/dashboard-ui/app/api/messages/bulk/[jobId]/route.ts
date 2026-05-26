import { cookies } from "next/headers"
import { serverGet, resolveWorkspaceId } from "@/lib/server-fetch"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const cookieStore = await cookies()
  const token = cookieStore.get("wa_access")?.value
  if (!token) return Response.json({ message: "Unauthorized" }, { status: 401 })

  const { jobId } = await params
  const { workspaceId, wsError } = await resolveWorkspaceId(token)
  if (!workspaceId) return wsError!

  const { data, status } = await serverGet(
    `/workspaces/${workspaceId}/proxy/api/bulk/jobs/${jobId}`,
    token
  )
  return Response.json(data ?? { message: "Upstream error" }, { status })
}
