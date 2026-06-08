import { APP_VERSION } from "@/lib/version"

// Compare two semver-ish strings (ignoring pre-release suffix).
function isNewer(latest: string, current: string): boolean {
  const norm = (v: string) =>
    v.replace(/^v/, "").split("-")[0].split(".").map((n) => parseInt(n, 10) || 0)
  const a = norm(latest)
  const b = norm(current)
  for (let i = 0; i < 3; i++) {
    if ((a[i] ?? 0) > (b[i] ?? 0)) return true
    if ((a[i] ?? 0) < (b[i] ?? 0)) return false
  }
  return false
}

/**
 * Self-host update check: compares the running version against the latest
 * GitHub release. Server-side (avoids client CORS + rate-limit). Cached 1h.
 */
export async function GET() {
  const base = { current: APP_VERSION, latest: null as string | null, updateAvailable: false, url: null as string | null, notes: null as string | null }
  try {
    const res = await fetch("https://api.github.com/repos/wasphere/wasphere/releases/latest", {
      headers: { Accept: "application/vnd.github+json" },
      next: { revalidate: 3600 },
    })
    if (!res.ok) return Response.json(base)
    const d = (await res.json()) as { tag_name?: string; html_url?: string; body?: string }
    const latest = (d.tag_name ?? "").replace(/^v/, "")
    return Response.json({
      current: APP_VERSION,
      latest: latest || null,
      updateAvailable: latest ? isNewer(latest, APP_VERSION) : false,
      url: d.html_url ?? null,
      notes: d.body ?? null,
    })
  } catch {
    return Response.json(base)
  }
}
