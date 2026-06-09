import { PermissionScope } from './permissions';

/**
 * Maps a (method, path) pair for a wa-server proxy request to the required
 * dashboard-api permission scope.
 *
 * Returns null for unmapped paths — callers must fail closed (403) on null.
 * JWT users bypass this function entirely; only API key users are gated.
 *
 * Path is the wildcard segment after /workspaces/:id/proxy/ with no leading slash.
 * Method is upper-cased HTTP verb.
 *
 * Route reference (wa-server controllers):
 *   @Controller('sessions')                  → sessions.*
 *   @Controller('sessions/:sid/messages')    → messages.*
 *   @Controller('sessions/:sid')             → profile + contacts (sessions.*)
 *   @Controller('sessions/:sid/groups')      → sessions.*
 *   @Controller('health')                    → sessions:read
 */
/**
 * Extracts the target session ID from a proxy wildcard path, or null when the
 * path does not address a specific session (e.g. `sessions` list/create,
 * `health`). Used to enforce a key's `sessionScope`.
 *
 * Mirrors the segmenting in `proxyPermission`: `sessions/:id/...` → `:id`.
 */
export function proxySessionId(rawPath: string): string | null {
  const path = rawPath.replace(/^\/+|\/+$/g, '').split('?')[0].replace(/^api\//, '');
  const segs = path.split('/');
  if (segs[0] === 'sessions' && segs.length >= 2 && segs[1]) return segs[1];
  return null;
}

export function proxyPermission(method: string, rawPath: string): PermissionScope | null {
  const m = method.toUpperCase();
  // Strip leading/trailing slashes, query string, and optional global "api/" prefix
  const path = rawPath.replace(/^\/+|\/+$/g, '').split('?')[0].replace(/^api\//, '');
  const segs = path.split('/');

  const top = segs[0];

  // ── health ────────────────────────────────────────────────────────────────
  if (top === 'health') {
    return m === 'GET' ? 'sessions:read' : null;
  }

  // ── everything else must be under sessions/ ───────────────────────────────
  if (top !== 'sessions') return null;

  // /sessions (list) or /sessions (create)
  if (segs.length === 1) {
    if (m === 'GET') return 'sessions:read';
    if (m === 'POST') return 'sessions:write';
    return null;
  }

  // segs[1] = :sessionId
  const feature = segs[2]; // undefined for bare /sessions/:id

  // /sessions/:id — manage the session itself
  if (!feature) {
    if (m === 'GET') return 'sessions:read';
    if (m === 'DELETE') return 'sessions:delete';
    if (m === 'PATCH') return 'sessions:write';
    return null;
  }

  // /sessions/:id/messages/*
  if (feature === 'messages') {
    const action = segs[3];
    if (!action) return null; // bare /sessions/:id/messages — not a real route

    if (action === 'bulk') {
      // POST /messages/bulk → messages:send_bulk
      // GET  /messages/bulk/:jobId → messages:read
      if (m === 'POST') return 'messages:send_bulk';
      if (m === 'GET') return 'messages:read';
      return null;
    }

    // All other message writes: text, image, video, audio, document, sticker,
    // location, contact, buttons, list, poll, reaction, gif, view-once,
    // :msgId/edit, :msgId (DELETE), read, typing, presence
    if (m === 'POST' || m === 'DELETE') return 'messages:send';
    if (m === 'GET') return 'messages:read';
    return null;
  }

  // /sessions/:id/groups/*
  if (feature === 'groups') {
    if (m === 'GET') return 'sessions:read';
    if (m === 'POST' || m === 'PUT') return 'sessions:write';
    return null;
  }

  // /sessions/:id/profile (GET profile, POST/DELETE profile changes)
  if (feature === 'profile') {
    if (m === 'GET') return 'sessions:read';
    if (m === 'POST' || m === 'DELETE') return 'sessions:write';
    return null;
  }

  // /sessions/:id/contacts/* (check, picture, about, block, unblock, presence)
  if (feature === 'contacts') {
    if (m === 'GET') return 'sessions:read';
    if (m === 'POST') return 'sessions:write';
    return null;
  }

  // /sessions/:id/config → PATCH :id/config in sessions controller
  if (feature === 'config') {
    if (m === 'PATCH') return 'sessions:write';
    return null;
  }

  // /sessions/:id/logout
  if (feature === 'logout') {
    if (m === 'POST') return 'sessions:delete';
    return null;
  }

  // /sessions/:id/capabilities — read-only metadata
  if (feature === 'capabilities') {
    if (m === 'GET') return 'sessions:read';
    return null;
  }

  // /sessions/:id/templates — GET lists templates; POST creates one at Meta.
  if (feature === 'templates') {
    if (m === 'GET') return 'sessions:read';
    if (m === 'POST') return 'sessions:write';
    return null;
  }

  // /sessions/:id/flows — GET lists published flows; POST /flows/send sends one.
  if (feature === 'flows') {
    const action = segs[3];
    if (!action) return m === 'GET' ? 'sessions:read' : null;
    if (action === 'send' && m === 'POST') return 'messages:send';
    return null;
  }

  return null; // unmapped — fail closed
}
