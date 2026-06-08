/**
 * Webhook media is delivered as a download URL (not inline base64). The URL is
 * NOT public — it is fetched with an Authorization: Bearer <API key> header
 * (Meta-style), so no secret ever appears in the URL/query string. The workspace
 * is derived from the API key, so the URL carries only the message id.
 */
export function mediaUrlFor(waMessageId: string): string | null {
  const base = (process.env.MEDIA_BASE_URL ?? '').replace(/\/+$/, '');
  if (!base) return null; // not configured → callers keep the inline data URI
  return `${base}/media/${encodeURIComponent(waMessageId)}`;
}
