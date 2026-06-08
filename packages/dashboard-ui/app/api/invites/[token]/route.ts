import { serverGet } from "@/lib/server-fetch"

// GET /api/invites/:token — public preview (workspace name + role) for the accept page
export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const { data, status } = await serverGet(`/invites/${encodeURIComponent(token)}`, "")
  return Response.json(data ?? { message: "Invite not found" }, { status })
}
