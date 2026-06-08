import { serverPost } from "@/lib/server-fetch";

export async function POST(request: Request) {
  let body: { email?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ message: "Invalid request body" }, { status: 400 });
  }

  const { status, data } = await serverPost("/auth/forgot-password", "", {
    email: body.email,
  });

  // The API always returns a generic 200 to prevent email enumeration.
  return Response.json(
    data ?? { message: "If that email exists, a reset link has been sent." },
    { status: status || 502 }
  );
}
