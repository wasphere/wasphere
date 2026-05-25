import { cookies } from "next/headers"
import { serverGet, serverPatch, resolveWorkspaceId } from "@/lib/server-fetch"

async function resolveWorkspace(
  token: string
): Promise<{ id: string; [key: string]: unknown } | null> {
  const workspaceId = await resolveWorkspaceId(token)
  if (!workspaceId) return null
  const { data } = await serverGet<{ id: string; [key: string]: unknown }>(
    `/workspaces/${workspaceId}`,
    token
  )
  return data
}

export async function GET() {
  const cookieStore = await cookies()
  const token = cookieStore.get("wa_access")?.value
  if (!token) return Response.json({ message: "Unauthorized" }, { status: 401 })

  const workspace = await resolveWorkspace(token)
  if (!workspace) return Response.json({ message: "No workspace found" }, { status: 404 })

  return Response.json(workspace)
}

export async function PATCH(request: Request) {
  const cookieStore = await cookies()
  const token = cookieStore.get("wa_access")?.value
  if (!token) return Response.json({ message: "Unauthorized" }, { status: 401 })

  let body: { waServerUrl?: string; waServerToken?: string; name?: string }
  try {
    body = await request.json()
  } catch {
    return Response.json({ message: "Invalid request body" }, { status: 400 })
  }

  const workspace = await resolveWorkspace(token)
  if (!workspace) return Response.json({ message: "No workspace found" }, { status: 404 })

  if (body.waServerUrl !== undefined || body.waServerToken !== undefined) {
    const { data, status } = await serverPatch(`/workspaces/${workspace.id}/wa-server`, token, {
      waServerUrl: body.waServerUrl,
      waServerToken: body.waServerToken,
    })
    return Response.json(data ?? { message: "Upstream error" }, { status })
  }

  return Response.json({ message: "Nothing to update" }, { status: 400 })
}
