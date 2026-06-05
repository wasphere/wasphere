import { cookies } from "next/headers"
import { serverPost, resolveWorkspaceId } from "@/lib/server-fetch"

// Proxies the setup wizard's "Test connection" to wa-server's
// POST /api/sessions/meta/test-connection (validate Meta creds, no session created).
export async function POST(request: Request) {
  const cookieStore = await cookies()
  const token = cookieStore.get("wa_access")?.value
  if (!token) return Response.json({ message: "Unauthorized" }, { status: 401 })

  let body: { phoneNumberId?: string; accessToken?: string }
  try {
    body = await request.json()
  } catch {
    return Response.json({ message: "Invalid request body" }, { status: 400 })
  }

  const { workspaceId, wsError } = await resolveWorkspaceId(token)
  if (!workspaceId) return wsError!

  const { data, status } = await serverPost(
    `/workspaces/${workspaceId}/proxy/api/sessions/meta/test-connection`,
    token,
    body
  )
  return Response.json(data ?? { message: "Upstream error" }, { status })
}
