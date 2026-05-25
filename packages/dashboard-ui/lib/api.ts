/**
 * Authenticated fetch wrapper for dashboard-api.
 *
 * Usage:
 *   - Server components / Route Handlers: pass `token` explicitly (read from cookie).
 *   - Client components: omit `token`; the function reads it from the AuthContext
 *     via `getClientToken()`, which must be set by <AuthProvider> before any fetch.
 *
 * 401 handling:
 *   1. Call refreshAccessToken() once.
 *   2. On success: retry the original request with the new token.
 *   3. On failure: redirect to /login?reason=expired.
 */

const API_BASE =
  process.env.DASHBOARD_API_URL ?? "http://localhost:3000";

// Client-side token getter — set by AuthProvider on mount.
let _getClientToken: (() => string | null) | null = null;

export function registerClientTokenGetter(fn: () => string | null) {
  _getClientToken = fn;
}

export async function apiFetch(
  path: string,
  options: RequestInit = {},
  token?: string
): Promise<Response> {
  const resolvedToken = token ?? _getClientToken?.() ?? null;

  const headers = new Headers(options.headers);
  if (resolvedToken) {
    headers.set("Authorization", `Bearer ${resolvedToken}`);
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      // Retry once with the refreshed token from context.
      const retryToken = _getClientToken?.() ?? null;
      const retryHeaders = new Headers(options.headers);
      if (retryToken) {
        retryHeaders.set("Authorization", `Bearer ${retryToken}`);
      }
      return fetch(`${API_BASE}${path}`, {
        ...options,
        headers: retryHeaders,
      });
    }
    // Refresh failed — redirect to login. Only works in client context.
    redirectToLogin("expired");
  }

  return response;
}

/**
 * Calls POST /api/auth/refresh (Next.js Route Handler).
 * On success the Route Handler sets a new wa_access cookie and returns 200.
 * Returns true if the refresh succeeded.
 */
export async function refreshAccessToken(): Promise<boolean> {
  try {
    const res = await fetch("/api/auth/refresh", { method: "POST" });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Logs out the current session.
 * Calls POST /api/auth/logout (Next.js Route Handler) which clears both cookies,
 * then redirects to /login?reason=logout.
 */
export async function logout(): Promise<void> {
  try {
    await fetch("/api/auth/logout", { method: "POST" });
  } catch {
    // Best-effort; redirect regardless.
  }
  redirectToLogin("logout");
}

function redirectToLogin(reason: "expired" | "logout") {
  if (typeof window !== "undefined") {
    window.location.href = `/login?reason=${reason}`;
  }
}
