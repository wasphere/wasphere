import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export async function middleware(request: NextRequest) {
  // DEMO_MODE: skip register/login routing and drop into the seeded dashboard.
  if (process.env.DEMO_MODE === "true") {
    return NextResponse.redirect(new URL("/dashboard/overview", request.url))
  }

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
  matcher: ["/"],
}
