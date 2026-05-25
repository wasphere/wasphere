const API_BASE = process.env.DASHBOARD_API_URL ?? "http://localhost:3000"

export async function GET() {
  try {
    const res = await fetch(`${API_BASE}/auth/register-available`, {
      cache: "no-store",
    })
    const data = await res.json()
    return Response.json(data, { status: res.status })
  } catch {
    return Response.json({ available: false }, { status: 503 })
  }
}
