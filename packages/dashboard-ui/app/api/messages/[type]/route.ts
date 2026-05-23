import { cookies } from "next/headers"

const API_BASE = process.env.DASHBOARD_API_URL ?? "http://localhost:3000"

const ALLOWED_MESSAGE_TYPES = new Set([
  "text", "image", "video", "audio", "document", "sticker",
  "gif", "location", "contact", "buttons", "list", "poll",
  "reaction", "view-once",
])

async function resolveWorkspaceId(token: string): Promise<string | null> {
  const res = await fetch(`${API_BASE}/workspaces`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  })
  if (!res.ok) return null
  const data: unknown = await res.json()
  const list: Array<{ id: string }> = Array.isArray(data)
    ? (data as Array<{ id: string }>)
    : ((data as { workspaces?: Array<{ id: string }> }).workspaces ?? [])
  return list[0]?.id ?? null
}

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

  const workspaceId = await resolveWorkspaceId(token)
  if (!workspaceId)
    return Response.json({ message: "No workspace found" }, { status: 404 })

  let targetUrl: URL
  try {
    targetUrl = new URL(
      `/workspaces/${workspaceId}/proxy/api/sessions/${sessionId}/messages/${type}`,
      API_BASE
    )
  } catch {
    return Response.json({ message: "Invalid upstream URL" }, { status: 500 })
  }

  const upstream = await fetch(targetUrl.toString(), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(messageBody),
  }).catch(() => null)

  if (!upstream)
    return Response.json({ message: "WA Server unreachable" }, { status: 502 })

  const resBody = await upstream.json().catch(() => ({}))
  return Response.json(resBody, { status: upstream.status })
}
