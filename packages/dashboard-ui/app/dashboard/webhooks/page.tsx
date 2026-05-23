import { cookies } from "next/headers"
import Link from "next/link"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { ApiError } from "@/components/ui/api-error"
import { WebhooksForm } from "@/components/webhooks/webhooks-form"

const API_BASE = process.env.DASHBOARD_API_URL ?? "http://localhost:3000"

interface Workspace {
  id: string
  name: string
  waServerConfigured: boolean
  waServerUrl?: string | null
}

async function fetchWorkspace(token: string): Promise<Workspace | null> {
  try {
    const listRes = await fetch(`${API_BASE}/workspaces`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    })
    if (!listRes.ok) return null
    const data = await listRes.json()
    const list: Workspace[] = Array.isArray(data)
      ? data
      : (data.workspaces ?? [])
    return list[0] ?? null
  } catch {
    return null
  }
}

async function fetchCallbackUrl(
  workspaceId: string,
  token: string
): Promise<string | null> {
  try {
    const res = await fetch(
      `${API_BASE}/workspaces/${workspaceId}/proxy/api/webhooks/callback`,
      {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      }
    )
    if (!res.ok) return null
    const data = await res.json()
    return data.url ?? null
  } catch {
    return null
  }
}

export default async function WebhooksPage() {
  const cookieStore = await cookies()
  const token = cookieStore.get("wa_access")?.value ?? ""

  const workspace = await fetchWorkspace(token)

  if (workspace === null) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-semibold">Webhooks</h1>
        <ApiError message="Could not load workspace data." />
      </div>
    )
  }

  if (!workspace.waServerConfigured) {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="text-2xl font-semibold">Webhooks</h1>
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-medium text-foreground">WA Server not configured</CardTitle>
            <CardDescription className="text-sm font-normal text-zinc-700 dark:text-zinc-300">
              Configure your WA Server connection before setting a webhook
              callback URL.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-zinc-700 dark:text-zinc-300">
              Go to{" "}
              <Link
                href="/dashboard/settings"
                className="font-medium underline underline-offset-2 text-foreground"
              >
                Settings
              </Link>{" "}
              to add your WA Server URL and API token, then return here to
              configure your webhook.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const initialUrl = await fetchCallbackUrl(workspace.id, token)

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Webhooks</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium text-foreground">Callback URL</CardTitle>
          <CardDescription className="text-sm font-normal text-zinc-700 dark:text-zinc-300">
            The WA Server will POST inbound events (messages, status updates)
            to this URL. Only one callback URL is active at a time — saving
            replaces the previous.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <WebhooksForm initialUrl={initialUrl} />
        </CardContent>
      </Card>
    </div>
  )
}
