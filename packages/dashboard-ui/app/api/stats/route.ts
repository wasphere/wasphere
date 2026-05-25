import { cookies } from "next/headers"
import { serverGet, resolveWorkspaceId } from "@/lib/server-fetch"

export async function GET() {
  const cookieStore = await cookies()
  const token = cookieStore.get("wa_access")?.value
  if (!token) return Response.json({ message: "Unauthorized" }, { status: 401 })

  const workspaceId = await resolveWorkspaceId(token)
  if (!workspaceId) return Response.json({ message: "No workspace" }, { status: 404 })

  const { data, status } = await serverGet(`/workspaces/${workspaceId}/stats`, token)
  return Response.json(data ?? {}, { status })
}
