import { cookies } from "next/headers"
import { probeWaServer } from "@/lib/server-fetch"

/**
 * Tests whether the dashboard can reach a WA Server at the given URL (and,
 * if a token is supplied, whether that token is accepted). Runs server-side
 * so it can reach Docker-internal hostnames the browser cannot.
 */
export async function POST(request: Request) {
  const cookieStore = await cookies()
  const token = cookieStore.get("wa_access")?.value
  if (!token) return Response.json({ message: "Unauthorized" }, { status: 401 })

  let body: { url?: string; token?: string }
  try {
    body = await request.json()
  } catch {
    return Response.json({ message: "Invalid request body" }, { status: 400 })
  }

  const url = (body.url ?? "").trim()
  if (!url) {
    return Response.json({ ok: false, message: "Enter a WA Server URL first." }, { status: 400 })
  }
  if (!/^https?:\/\//i.test(url)) {
    return Response.json(
      { ok: false, message: "URL must start with http:// or https://" },
      { status: 400 }
    )
  }

  const waToken = (body.token ?? "").trim() || undefined
  const probe = await probeWaServer(url, waToken)

  if (!probe.reachable) {
    return Response.json({
      ok: false,
      message: `Cannot reach wa-server at ${url}. If running via Docker, use the compose service name — e.g. http://wa-server:3001.`,
    })
  }

  if (waToken && !probe.authenticated) {
    return Response.json({
      ok: false,
      message: "Reachable, but the API token was rejected. Check your WA_TOKEN.",
    })
  }

  const versionSuffix = probe.version ? ` (wa-server v${probe.version})` : ""
  return Response.json({
    ok: true,
    message: waToken
      ? `Connected${versionSuffix}.`
      : `Reachable${versionSuffix}. Add your token and save to finish.`,
  })
}
