import { cookies } from "next/headers"
import { serverPost, resolveWorkspaceId } from "@/lib/server-fetch"

const ALLOWED_MESSAGE_TYPES = new Set([
  "text", "image", "video", "audio", "document", "sticker",
  "gif", "location", "contact", "buttons", "list", "poll",
  "reaction", "view-once",
])

export async function POST(
  request: Request,
  { params }: { params: Promise<{ type: string }> }
) {
  const cookieStore = await cookies()
  const token = cookieStore.get("wa_access")?.value
  if (!token) return Response.json({ message: "Unauthorized" }, { status: 401 })

  const { type } = await params
  if (!ALLOWED_MESSAGE_TYPES.has(type)) {
    return Response.json({ message: "Invalid message type" }, { status: 400 })
  }

  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return Response.json({ message: "Invalid request body" }, { status: 400 })
  }

  const { sessionId, ...messageBody } = body
  if (!sessionId || typeof sessionId !== "string") {
    return Response.json({ message: "sessionId is required" }, { status: 400 })
  }

  const { workspaceId, status: wsStatus } = await resolveWorkspaceId(token)
  if (!workspaceId) {
    if (wsStatus === 401) return Response.json({ message: "Unauthorized" }, { status: 401 })
    return Response.json({ message: "No workspace found" }, { status: 404 })
  }

  const { data, status } = await serverPost(
    `/workspaces/${workspaceId}/proxy/api/sessions/${sessionId}/messages/${type}`,
    token,
    messageBody
  )
  return Response.json(data ?? { message: "WA Server unreachable" }, { status: status || 502 })
}
