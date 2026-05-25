import { cookies } from "next/headers"
import { serverGet } from "@/lib/server-fetch"

export async function GET() {
  const cookieStore = await cookies()
  const token = cookieStore.get("wa_access")?.value
  if (!token) return Response.json({ message: "Unauthorized" }, { status: 401 })

  const { data } = await serverGet<Array<{ id: string; waServerConfigured?: boolean }> | { workspaces: Array<{ id: string; waServerConfigured?: boolean }> }>(
    "/workspaces",
    token
  )
  if (!data) return Response.json({ message: "No workspace found" }, { status: 404 })

  const list = Array.isArray(data) ? data : (data.workspaces ?? [])
  const workspace = list[0] ?? null
  if (!workspace) return Response.json({ message: "No workspace found" }, { status: 404 })

  const configured = workspace.waServerConfigured === true
  return Response.json({ token: configured ? "••••••••" : null })
}
