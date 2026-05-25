import { cookies } from "next/headers"
import { serverPost, resolveWorkspaceId } from "@/lib/server-fetch"

interface SendMessageBody {
  sessionId: string
  to: string
  text?: string
  imageUrl?: string
  caption?: string
}

export async function POST(request: Request) {
  const cookieStore = await cookies()
  const token = cookieStore.get("wa_access")?.value
  if (!token) return Response.json({ message: "Unauthorized" }, { status: 401 })

  let body: SendMessageBody
  try {
    body = await request.json()
  } catch {
    return Response.json({ message: "Invalid request body" }, { status: 400 })
  }

  const { sessionId, to, text, imageUrl, caption } = body
  if (!sessionId || !to) {
    return Response.json({ message: "sessionId and to are required" }, { status: 400 })
  }

  const { workspaceId, status: wsStatus } = await resolveWorkspaceId(token)
  if (!workspaceId) {
    if (wsStatus === 401) return Response.json({ message: "Unauthorized" }, { status: 401 })
    return Response.json({ message: "No workspace found" }, { status: 404 })
  }

  const isImage = Boolean(imageUrl)
  const endpoint = isImage ? "send-image" : "send-text"
  const upstreamBody = isImage ? { to, imageUrl, caption: caption ?? "" } : { to, text }

  const { data, status } = await serverPost(
    `/workspaces/${workspaceId}/proxy/api/sessions/${sessionId}/${endpoint}`,
    token,
    upstreamBody
  )
  return Response.json(data ?? { message: "Upstream error" }, { status })
}
