import { cookies } from "next/headers"

const API_BASE = process.env.DASHBOARD_API_URL ?? "http://localhost:3000"

async function resolveWorkspaceId(token: string): Promise<string | null> {
  const res = await fetch(`${API_BASE}/workspaces`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  })
  if (!res.ok) return null
  const data = await res.json()
  const list: Array<{ id: string }> = Array.isArray(data)
    ? data
    : (data.workspaces ?? [])
  return list[0]?.id ?? null
}

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
  if (!token) {
    return Response.json({ message: "Unauthorized" }, { status: 401 })
  }

  let body: SendMessageBody
  try {
    body = await request.json()
  } catch {
    return Response.json({ message: "Invalid request body" }, { status: 400 })
  }

  const { sessionId, to, text, imageUrl, caption } = body

  if (!sessionId || !to) {
    return Response.json(
      { message: "sessionId and to are required" },
      { status: 400 }
    )
  }

  const workspaceId = await resolveWorkspaceId(token)
  if (!workspaceId) {
    return Response.json({ message: "No workspace found" }, { status: 404 })
  }

  const isImage = Boolean(imageUrl)
  const endpoint = isImage ? "send-image" : "send-text"

  const upstreamBody = isImage
    ? { to, imageUrl, caption: caption ?? "" }
    : { to, text }

  const res = await fetch(
    `${API_BASE}/workspaces/${workspaceId}/proxy/sessions/${sessionId}/${endpoint}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(upstreamBody),
    }
  )

  const resBody = await res.json().catch(() => ({ message: "Upstream error" }))
  return Response.json(resBody, { status: res.status })
}
