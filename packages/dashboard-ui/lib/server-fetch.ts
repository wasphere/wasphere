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
import { DEMO_MODE, demoApiResponse } from "./demo"

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
  if (DEMO_MODE) {
    const r = demoApiResponse(path, method)
    return { ok: r.ok, status: r.status, data: r.data as T }
  }
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

export interface WaServerProbe {
  reachable: boolean
  /** Only meaningful when a token was supplied and the server was reachable. */
  authenticated: boolean
  status: number | null
  version: string | null
}

/**
 * Probes a WA Server instance to verify the dashboard can reach it.
 *
 * With a token it hits the authenticated `/api/health` (validates URL *and*
 * token, and returns the server version); without a token it hits the
 * unauthenticated `/api/health/live` (reachability only). Uses the native
 * http transport so Docker-internal hostnames like `wa-server` resolve.
 */
export async function probeWaServer(
  rawUrl: string,
  token?: string
): Promise<WaServerProbe> {
  const base = rawUrl.replace(/\/+$/, "")
  const path = token ? "/api/health" : "/api/health/live"
  const headers: Record<string, string> = { Accept: "application/json" }
  if (token) headers["X-Api-Token"] = token

  try {
    const { status, body } = await rawRequest(`${base}${path}`, "GET", headers)
    let version: string | null = null
    try {
      version = (JSON.parse(body) as { version?: string }).version ?? null
    } catch {
      version = null
    }
    return {
      reachable: true,
      authenticated: token ? status === 200 : false,
      status,
      version,
    }
  } catch {
    return { reachable: false, authenticated: false, status: null, version: null }
  }
}

/**
 * Resolves the first workspace ID for the authenticated user.
 *
 * Returns { workspaceId, wsError } where:
 *   - workspaceId is the resolved ID on success (wsError is null)
 *   - wsError is a ready-made Response on failure (workspaceId is null)
 *
 * Using wsError directly instead of inspecting a numeric status prevents
 * callers from accidentally mapping upstream 502s to a misleading
 * 404 "No workspace found" response.
 */
export async function resolveWorkspaceId(
  token: string
): Promise<{ workspaceId: string | null; wsError: Response | null }> {
  const result = await apiRequest<Array<{ id: string }> | { workspaces: Array<{ id: string }> }>(
    "/workspaces",
    "GET",
    token
  )
  if (!result.ok) {
    if (result.status === 401) {
      return { workspaceId: null, wsError: Response.json({ message: "Unauthorized" }, { status: 401 }) }
    }
    // 502 = dashboard-api unreachable; propagate as 502, not 404
    return { workspaceId: null, wsError: Response.json({ message: "Service unavailable" }, { status: 502 }) }
  }
  const data = result.data
  if (!data) {
    return { workspaceId: null, wsError: Response.json({ message: "No workspace found" }, { status: 404 }) }
  }
  const list = Array.isArray(data) ? data : (data.workspaces ?? [])
  if (!list[0]) {
    return { workspaceId: null, wsError: Response.json({ message: "No workspace found" }, { status: 404 }) }
  }
  return { workspaceId: list[0].id, wsError: null }
}

