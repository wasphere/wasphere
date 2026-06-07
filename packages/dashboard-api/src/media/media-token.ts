import { createHmac, timingSafeEqual } from 'crypto';

// Media download URLs are protected by a stateless HMAC token (no DB lookup to
// validate) so n8n / external consumers can fetch a webhook's media by URL
// instead of receiving a multi-MB base64 blob inline.
function secret(): string {
  return process.env.MEDIA_TOKEN_SECRET || process.env.JWT_SECRET || 'wasphere-dev-media-secret';
}

export function signMediaToken(workspaceId: string, waMessageId: string): string {
  return createHmac('sha256', secret()).update(`${workspaceId}:${waMessageId}`).digest('hex');
}

export function verifyMediaToken(workspaceId: string, waMessageId: string, token: string): boolean {
  const expected = signMediaToken(workspaceId, waMessageId);
  const a = Buffer.from(token ?? '', 'utf8');
  const b = Buffer.from(expected, 'utf8');
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Absolute, fetchable media URL for a stored message, or null if not configured. */
export function mediaUrlFor(workspaceId: string, waMessageId: string): string | null {
  const base = (process.env.MEDIA_BASE_URL ?? '').replace(/\/+$/, '');
  if (!base) return null; // not configured → callers keep the inline data URI
  const t = signMediaToken(workspaceId, waMessageId);
  return `${base}/media/${encodeURIComponent(workspaceId)}/${encodeURIComponent(waMessageId)}?t=${t}`;
}
