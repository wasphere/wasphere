import { cookies } from "next/headers"
import { API_BASE, resolveWorkspaceId } from "@/lib/server-fetch"

export const dynamic = "force-dynamic"

// SSE proxy: browser EventSource('/api/inbox/stream') -> here -> dashboard-api
// stream with a Bearer header (EventSource can't set headers itself).
export async function GET(req: Request) {
  const token = (await cookies()).get("wa_access")?.value
  if (!token) return new Response("Unauthorized", { status: 401 })

  const { workspaceId, wsError } = await resolveWorkspaceId(token)
  if (!workspaceId) return wsError!

  let upstream: Response
  try {
    upstream = await fetch(`${API_BASE}/workspaces/${workspaceId}/inbox/stream`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "text/event-stream" },
      signal: req.signal,
    })
  } catch {
    return new Response("Stream unavailable", { status: 502 })
  }

  // 429 (cap reached) or other non-2xx -> pass status through so the client
  // can fall back to polling.
  if (!upstream.ok || !upstream.body) {
    return new Response(null, { status: upstream.status || 502 })
  }

  return new Response(upstream.body, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  })
}
