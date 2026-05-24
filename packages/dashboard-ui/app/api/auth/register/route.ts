import { cookies } from "next/headers"

const API_BASE = process.env.DASHBOARD_API_URL ?? "http://localhost:3000"
const SECURE = process.env.NODE_ENV === "production"

export async function POST(request: Request) {
  let body: { email: string; password: string }
  try {
    body = await request.json()
  } catch {
    return Response.json({ message: "Invalid request body" }, { status: 400 })
  }

  const apiRes = await fetch(`${API_BASE}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: body.email, password: body.password }),
  }).catch(() => null)

  if (!apiRes) {
    return Response.json({ message: "Could not reach the server." }, { status: 503 })
  }

  const data = await apiRes.json().catch(() => ({}))

  if (!apiRes.ok) {
    return Response.json(data, { status: apiRes.status })
  }

  const cookieStore = await cookies()
  cookieStore.set("wa_access", data.accessToken, {
    httpOnly: true,
    secure: SECURE,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 15,
  })
  cookieStore.set("wa_refresh", data.refreshToken, {
    httpOnly: true,
    secure: SECURE,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  })

  return Response.json({ ok: true }, { status: 201 })
}
