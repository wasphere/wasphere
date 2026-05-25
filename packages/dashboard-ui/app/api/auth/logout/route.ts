import { cookies } from "next/headers";

const API_BASE = process.env.DASHBOARD_API_URL ?? "http://localhost:3000";

export async function POST() {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get("wa_access")?.value;

  // Best-effort logout call to dashboard-api (clears server-side state if any).
  if (accessToken) {
    await fetch(`${API_BASE}/auth/logout`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
    }).catch(() => {
      // Ignore network errors — cookies are cleared regardless.
    });
  }

  cookieStore.set("wa_access", "", { maxAge: 0, path: "/" });
  cookieStore.set("wa_refresh", "", { maxAge: 0, path: "/" });

  return new Response(null, { status: 200 });
}
