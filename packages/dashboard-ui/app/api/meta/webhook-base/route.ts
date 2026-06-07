// Returns the wa-server's PUBLIC base URL (e.g. https://wa.your-domain.com) so
// the New-Session dialog can show the exact Meta webhook callback URL instead of
// a <your-wa-server> placeholder. Empty when not configured for public Meta
// webhooks — the dialog falls back to the placeholder.
export function GET() {
  const base = (process.env.WA_SERVER_PUBLIC_URL ?? "").replace(/\/+$/, "")
  return Response.json({ base: base || null })
}
