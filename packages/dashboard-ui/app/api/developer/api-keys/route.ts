import { cookies } from "next/headers"
import { serverGet, serverPost, resolveWorkspaceId } from "@/lib/server-fetch"

export async function GET() {
  const cookieStore = await cookies()
  const token = cookieStore.get("wa_access")?.value
  if (!token) return Response.json({ message: "Unauthorized" }, { status: 401 })

  const workspaceId = await resolveWorkspaceId(token)
  if (!workspaceId) return Response.json({ message: "No workspace found" }, { status: 404 })

  const { data, status } = await serverGet(`/workspaces/${workspaceId}/api-keys`, token)
  return Response.json(data ?? { message: "Upstream error" }, { status })
}

export async function POST(request: Request) {
  const cookieStore = await cookies()
  const token = cookieStore.get("wa_access")?.value
  if (!token) return Response.json({ message: "Unauthorized" }, { status: 401 })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json({ message: "Invalid request body" }, { status: 400 })
  }

  const workspaceId = await resolveWorkspaceId(token)
  if (!workspaceId) return Response.json({ message: "No workspace found" }, { status: 404 })

  const { data, status } = await serverPost(`/workspaces/${workspaceId}/api-keys`, token, body)
  return Response.json(data ?? { message: "Upstream error" }, { status })
}
