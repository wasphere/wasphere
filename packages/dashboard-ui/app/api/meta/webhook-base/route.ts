// Returns the wa-server's PUBLIC base URL (e.g. https://wa.your-domain.com) so
// the New-Session dialog can show the exact Meta webhook callback URL instead of
// a <your-wa-server> placeholder. Empty when not configured for public Meta
// webhooks — the dialog falls back to the placeholder.
// Read the env per-request (not baked at build time) — the var is set in the
// runtime container, so static optimization would freeze it to the placeholder.
export const dynamic = "force-dynamic"

export function GET() {
  const base = (process.env.WA_SERVER_PUBLIC_URL ?? "").replace(/\/+$/, "")
  return Response.json({ base: base || null })
}
