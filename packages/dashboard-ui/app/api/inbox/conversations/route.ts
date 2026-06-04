import { cookies } from "next/headers"
import { serverGet, resolveWorkspaceId } from "@/lib/server-fetch"

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
