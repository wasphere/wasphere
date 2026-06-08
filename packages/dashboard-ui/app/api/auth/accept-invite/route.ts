import { cookies } from "next/headers"
import { serverPost } from "@/lib/server-fetch"

const SECURE = process.env.NODE_ENV === "production"

// POST /api/auth/accept-invite { token, email, password } — join via invite link
export async function POST(request: Request) {
  let body: { token: string; email: string; password: string }
  try {
    body = await request.json()
  } catch {
    return Response.json({ message: "Invalid request body" }, { status: 400 })
  }

  const { ok, status, data } = await serverPost<{
    accessToken: string
    refreshToken: string
    user: { id: string; email: string }
    workspace: { id: string; name: string }
  }>("/auth/accept-invite", "", body)

  if (!ok || !data) {
    return Response.json(
      (data as { message?: string } | null)?.message ? data : { message: "Could not join workspace" },
      { status: status || 502 },
    )
  }

  const cookieStore = await cookies()
  cookieStore.set("wa_access", data.accessToken, { httpOnly: true, secure: SECURE, sameSite: "lax", path: "/", maxAge: 900 })
  cookieStore.set("wa_refresh", data.refreshToken, { httpOnly: true, secure: SECURE, sameSite: "lax", path: "/", maxAge: 604800 })

  return Response.json({ user: data.user, workspace: data.workspace })
}
