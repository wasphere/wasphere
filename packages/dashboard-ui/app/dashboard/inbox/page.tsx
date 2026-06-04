import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { serverGet } from "@/lib/server-fetch"
import { DEMO_MODE } from "@/lib/demo"
import { InboxView } from "@/components/inbox/inbox-view"
import type { Conversation, Paginated } from "@/components/inbox/types"

async function fetchWorkspaceId(token: string): Promise<string | null> {
  const { ok, data } = await serverGet<Array<{ id: string }> | { workspaces: Array<{ id: string }> }>("/workspaces", token)
  if (!ok || !data) return null
  const list = Array.isArray(data) ? data : (data.workspaces ?? [])
  return list[0]?.id ?? null
}

export default async function InboxPage() {
  // DEMO_MODE serves seeded fixtures with no auth (serverGet returns demo data).
  const token = (await cookies()).get("wa_access")?.value ?? ""
  if (!DEMO_MODE && !token) redirect("/login?reason=expired")

  const workspaceId = await fetchWorkspaceId(token)
  if (!workspaceId) redirect("/login?reason=expired")

  const { data } = await serverGet<Paginated<Conversation>>(
    `/workspaces/${workspaceId}/conversations?status=OPEN&limit=50`,
    token,
  )

  return <InboxView initialConversations={data?.items ?? []} />
}
