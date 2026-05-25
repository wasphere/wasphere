import { cookies } from "next/headers"
import { serverPost, resolveWorkspaceId } from "@/lib/server-fetch"

interface BulkSendBody {
  sessionId: string
  recipients: string[]
  text: string
  delayMs?: number
}

export async function POST(request: Request) {
  const cookieStore = await cookies()
  const token = cookieStore.get("wa_access")?.value
  if (!token) return Response.json({ message: "Unauthorized" }, { status: 401 })

  let body: BulkSendBody
  try {
    body = (await request.json()) as BulkSendBody
  } catch {
    return Response.json({ message: "Invalid request body" }, { status: 400 })
  }

  const { sessionId, recipients, text, delayMs } = body
  if (!sessionId || !recipients?.length || !text?.trim()) {
    return Response.json(
      { message: "sessionId, recipients, and text are required" },
      { status: 400 }
    )
  }

  const workspaceId = await resolveWorkspaceId(token)
  if (!workspaceId) return Response.json({ message: "No workspace found" }, { status: 404 })

  const { data, status } = await serverPost(
    `/workspaces/${workspaceId}/proxy/api/sessions/${sessionId}/messages/bulk`,
    token,
    { recipients, message: { text: text.trim() }, delayMs: delayMs ?? 1000 }
  )
  return Response.json(data ?? { message: "Upstream error" }, { status })
}
