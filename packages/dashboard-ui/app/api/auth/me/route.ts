import { cookies } from "next/headers";

export async function GET() {
  if (process.env.DEMO_MODE === "true") {
    return Response.json({ userId: "demo", email: "demo@wasphere.com", name: "Demo User" });
  }

  const cookieStore = await cookies();
  const accessToken = cookieStore.get("wa_access")?.value;

  if (!accessToken) {
    return new Response(null, { status: 401 });
  }

  // Decode JWT payload — the server has already validated the token on every
  // authenticated request; we only need the claims here to populate the UI.
  try {
    const parts = accessToken.split(".");
    if (parts.length !== 3) {
      return new Response(null, { status: 401 });
    }
    // Base64url → base64 → JSON
    const payloadJson = Buffer.from(
      parts[1].replace(/-/g, "+").replace(/_/g, "/"),
      "base64"
    ).toString("utf-8");
    const payload = JSON.parse(payloadJson) as {
      sub?: string;
      email?: string;
      name?: string;
    };

    return Response.json({
      userId: payload.sub ?? null,
      email: payload.email ?? null,
      name: payload.name ?? null,
    });
  } catch {
    return new Response(null, { status: 401 });
  }
}
