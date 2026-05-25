import { cookies } from "next/headers";
import { serverPost } from "@/lib/server-fetch";

const SECURE = process.env.NODE_ENV === "production";

export async function POST() {
  const cookieStore = await cookies();
  const refreshToken = cookieStore.get("wa_refresh")?.value;

  if (!refreshToken) {
    return new Response(null, { status: 401 });
  }

  const { ok, data } = await serverPost<{ accessToken: string }>(
    "/auth/refresh",
    "",
    { refreshToken }
  );

  if (!ok || !data?.accessToken) {
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

  return new Response(null, { status: 200 });
}
