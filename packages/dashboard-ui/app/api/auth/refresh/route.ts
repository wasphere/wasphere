import { cookies } from "next/headers";

const API_BASE = process.env.DASHBOARD_API_URL ?? "http://localhost:3000";

const SECURE = process.env.NODE_ENV === "production";

export async function POST() {
  const cookieStore = await cookies();
  const refreshToken = cookieStore.get("wa_refresh")?.value;

  if (!refreshToken) {
    return new Response(null, { status: 401 });
  }

  const apiRes = await fetch(`${API_BASE}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  });

  if (!apiRes.ok) {
    // Refresh failed — clear both cookies so the next request goes to /login.
    cookieStore.set("wa_access", "", { maxAge: 0, path: "/" });
    cookieStore.set("wa_refresh", "", { maxAge: 0, path: "/" });
    return new Response(null, { status: 401 });
  }

  const data = (await apiRes.json()) as { accessToken: string };

  cookieStore.set("wa_access", data.accessToken, {
    httpOnly: true,
    secure: SECURE,
    sameSite: "lax",
    path: "/",
    maxAge: 900,
  });

  return new Response(null, { status: 200 });
}
