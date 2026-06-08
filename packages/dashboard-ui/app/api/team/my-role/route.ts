import { cookies } from "next/headers"
import { serverGet, resolveWorkspaceId } from "@/lib/server-fetch"

export async function GET() {
  const token = (await cookies()).get("wa_access")?.value
  if (!token) return Response.json({ role: null }, { status: 200 })
  const { workspaceId } = await resolveWorkspaceId(token)
  if (!workspaceId) return Response.json({ role: null }, { status: 200 })
  const { data, status } = await serverGet<{ role: string }>(`/workspaces/${workspaceId}/my-role`, token)
  return Response.json(data ?? { role: null }, { status: status || 200 })
}
