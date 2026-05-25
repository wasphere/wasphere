import { cookies } from "next/headers";

const API_BASE = process.env.DASHBOARD_API_URL ?? "http://localhost:3000";

const SECURE = process.env.NODE_ENV === "production";

export async function POST(request: Request) {
  let body: { email: string; password: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ message: "Invalid request body" }, { status: 400 });
  }

  const apiRes = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: body.email, password: body.password }),
  });

  if (!apiRes.ok) {
    const errorBody = await apiRes.json().catch(() => ({
      message: "Login failed",
    }));
    return Response.json(errorBody, { status: apiRes.status });
  }

  const data = (await apiRes.json()) as {
    accessToken: string;
    refreshToken: string;
    user: { id: string; email: string; name: string };
  };

  const cookieStore = await cookies();

  cookieStore.set("wa_access", data.accessToken, {
    httpOnly: true,
    secure: SECURE,
    sameSite: "lax",
    path: "/",
    maxAge: 900, // 15 minutes
  });

  cookieStore.set("wa_refresh", data.refreshToken, {
    httpOnly: true,
    secure: SECURE,
    sameSite: "lax",
    path: "/",
    maxAge: 604800, // 7 days
  });

  return Response.json({ user: data.user });
}
