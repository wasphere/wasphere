import { serverPost } from "@/lib/server-fetch";

export async function POST(request: Request) {
  let body: { token?: string; newPassword?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ message: "Invalid request body" }, { status: 400 });
  }

  const { status, data } = await serverPost("/auth/reset-password", "", {
    token: body.token,
    newPassword: body.newPassword,
  });

  return Response.json(data ?? { message: "Could not reset password" }, {
    status: status || 502,
  });
}
