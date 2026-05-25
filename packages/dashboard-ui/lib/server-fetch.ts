/**
 * Server-side HTTP utility that bypasses Next.js's instrumented fetch.
 *
 * Next.js 16 patches the global `fetch` in server components in a way that
 * breaks requests to Docker-internal hostnames in production standalone mode.
 * Using Node.js's native http/https module avoids this entirely.
 *
 * Only for use in server components and route handlers — never in client code.
 */

import * as http from "node:http"
import * as https from "node:https"
import { cookies } from "next/headers"

export const API_BASE = process.env.DASHBOARD_API_URL ?? "http://localhost:3000"

type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE"

function rawRequest(
  url: string,
  method: Method,
  headers: Record<string, string>,
  body?: string
): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url)
    const isHttps = parsed.protocol === "https:"
    const transport = isHttps ? https : http

    const outHeaders: Record<string, string> = { ...headers }
    if (body !== undefined) {
      outHeaders["content-type"] = outHeaders["content-type"] ?? "application/json"
      outHeaders["content-length"] = String(Buffer.byteLength(body))
    }

    const req = transport.request(
      {
        hostname: parsed.hostname,
        port: parsed.port || (isHttps ? 443 : 80),
        path: parsed.pathname + (parsed.search || ""),
        method,
        headers: outHeaders,
      },
      (res) => {
        let data = ""
        res.on("data", (chunk: Buffer) => { data += chunk.toString() })
        res.on("end", () => resolve({ status: res.statusCode ?? 200, body: data }))
      }
    )

    req.on("error", reject)
    req.setTimeout(15000, () => {
      req.destroy(new Error("server-fetch timeout"))
    })

    if (body !== undefined) req.write(body)
    req.end()
  })
}

interface FetchResult<T> {
  ok: boolean
  status: number
  data: T | null
}

export async function apiRequest<T = unknown>(
  path: string,
  method: Method,
  token: string,
  body?: unknown
): Promise<FetchResult<T>> {
  try {
    const { status, body: raw } = await rawRequest(
      `${API_BASE}${path}`,
      method,
      { Authorization: `Bearer ${token}`, Accept: "application/json" },
      body !== undefined ? JSON.stringify(body) : undefined
    )
    const ok = status >= 200 && status < 300
    try {
      return { ok, status, data: JSON.parse(raw) as T }
    } catch {
      return { ok, status, data: null }
    }
  } catch {
    // status 0 is not a valid HTTP status code; Next.js Response.json() throws
    // RangeError if status is outside 200-599, so use 502 for network failures.
    return { ok: false, status: 502, data: null }
  }
}

export async function serverGet<T = unknown>(
  path: string,
  token: string
): Promise<FetchResult<T>> {
  return apiRequest<T>(path, "GET", token)
}

export async function serverPost<T = unknown>(
  path: string,
  token: string,
  body?: unknown
): Promise<FetchResult<T>> {
  return apiRequest<T>(path, "POST", token, body)
}

export async function serverPatch<T = unknown>(
  path: string,
  token: string,
  body?: unknown
): Promise<FetchResult<T>> {
  return apiRequest<T>(path, "PATCH", token, body)
}

export async function serverDelete<T = unknown>(
  path: string,
  token: string
): Promise<FetchResult<T>> {
  return apiRequest<T>(path, "DELETE", token)
}

/**
 * Resolves the first workspace ID for the authenticated user.
 * Returns { workspaceId, status } so callers can distinguish a real
 * 401 (expired token) from a genuinely empty workspace list (404).
 */
export async function resolveWorkspaceId(
  token: string
): Promise<{ workspaceId: string | null; status: number }> {
  const result = await apiRequest<Array<{ id: string }> | { workspaces: Array<{ id: string }> }>(
    "/workspaces",
    "GET",
    token
  )
  if (!result.ok) return { workspaceId: null, status: result.status }
  const data = result.data
  if (!data) return { workspaceId: null, status: 404 }
  const list = Array.isArray(data) ? data : (data.workspaces ?? [])
  return { workspaceId: list[0]?.id ?? null, status: list[0] ? 200 : 404 }
}

/**
 * Attempts a server-side token refresh using the wa_refresh cookie.
 * On success, sets the new wa_access cookie and returns the new token.
 * Returns null if the refresh token is missing or the refresh fails.
 */
export async function tryRefreshToken(): Promise<string | null> {
  const cookieStore = await cookies()
  const refreshToken = cookieStore.get("wa_refresh")?.value
  if (!refreshToken) return null

  const SECURE = process.env.NODE_ENV === "production"
  const { ok, data } = await serverPost<{ accessToken: string }>("/auth/refresh", "", { refreshToken })
  if (!ok || !data?.accessToken) return null

  cookieStore.set("wa_access", data.accessToken, {
    httpOnly: true,
    secure: SECURE,
    sameSite: "lax",
    path: "/",
    maxAge: 900,
  })
  return data.accessToken
}
