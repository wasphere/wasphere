import { cookies } from "next/headers";
import { serverPost } from "@/lib/server-fetch";

const SECURE = process.env.NODE_ENV === "production";

export async function POST() {
  const cookieStore = await cookies();
  const refreshToken = cookieStore.get("wa_refresh")?.value;

  if (!refreshToken) {
    return new Response(null, { status: 401 });
  }

  const { ok, data } = await serverPost<{ accessToken: string; refreshToken: string }>(
    "/auth/refresh",
    "",
    { refreshToken }
  );

  if (!ok || !data?.accessToken || !data?.refreshToken) {
    cookieStore.set("wa_access", "", { maxAge: 0, path: "/" });
    cookieStore.set("wa_refresh", "", { maxAge: 0, path: "/" });
    return new Response(null, { status: 401 });
  }

  cookieStore.set("wa_access", data.accessToken, {
    httpOnly: true,
    secure: SECURE,
    sameSite: "lax",
    path: "/",
    maxAge: 900,
  });

  // The API rotates the refresh token on every refresh and revokes the old one.
  // Persist the new value, or the next refresh sends a revoked token and the
  // reuse-detection path logs the user out everywhere.
  cookieStore.set("wa_refresh", data.refreshToken, {
    httpOnly: true,
    secure: SECURE,
    sameSite: "lax",
    path: "/",
    maxAge: 604800,
  });

  return new Response(null, { status: 200 });
}
