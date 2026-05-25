import { cookies } from "next/headers"
import { serverPatch, serverDelete, resolveWorkspaceId } from "@/lib/server-fetch"

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ keyId: string }> }
) {
  const cookieStore = await cookies()
  const token = cookieStore.get("wa_access")?.value
  if (!token) return Response.json({ message: "Unauthorized" }, { status: 401 })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json({ message: "Invalid request body" }, { status: 400 })
  }

  const { keyId } = await params
  const workspaceId = await resolveWorkspaceId(token)
  if (!workspaceId) return Response.json({ message: "No workspace found" }, { status: 404 })

  const { data, status } = await serverPatch(`/workspaces/${workspaceId}/api-keys/${keyId}`, token, body)
  return Response.json(data ?? { message: "Upstream error" }, { status })
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ keyId: string }> }
) {
  const cookieStore = await cookies()
  const token = cookieStore.get("wa_access")?.value
  if (!token) return Response.json({ message: "Unauthorized" }, { status: 401 })

  const { keyId } = await params
  const workspaceId = await resolveWorkspaceId(token)
  if (!workspaceId) return Response.json({ message: "No workspace found" }, { status: 404 })

  const { data, status } = await serverDelete(`/workspaces/${workspaceId}/api-keys/${keyId}`, token)
  return Response.json(data ?? { message: "Upstream error" }, { status })
}
