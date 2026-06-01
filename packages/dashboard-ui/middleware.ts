import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  // ── DEMO_MODE ──────────────────────────────────────────────────────────────
  // Drop "/" into the seeded dashboard, and stamp a dummy auth cookie on every
  // dashboard/api request so the API routes don't 401 on a missing cookie
  // (the data layer ignores the token and returns seeds in demo mode).
  if (process.env.DEMO_MODE === "true") {
    // There's no real auth in demo — never strand the visitor on login/register.
    if (pathname === "/" || pathname === "/login" || pathname === "/register") {
      return NextResponse.redirect(new URL("/dashboard/overview", request.url))
    }
    const res = NextResponse.next()
    if (!request.cookies.has("wa_access")) {
      res.cookies.set("wa_access", "demo", { httpOnly: true, sameSite: "lax", path: "/" })
    }
    return res
  }

  // ── Normal mode: only the root path is routed to register/login ─────────────
  if (pathname !== "/") return NextResponse.next()

  const apiUrl = process.env.DASHBOARD_API_URL ?? "http://localhost:3000"
  try {
    const res = await fetch(`${apiUrl}/auth/register-available`, {
      cache: "no-store",
    })
    if (res.ok) {
      const data: { available: boolean } = await res.json()
      if (data.available) {
        return NextResponse.redirect(new URL("/register", request.url))
      }
    }
  } catch {
    // fall through to login
  }
  return NextResponse.redirect(new URL("/login", request.url))
}

export const config = {
  matcher: ["/", "/login", "/register", "/dashboard/:path*", "/api/:path*"],
}
