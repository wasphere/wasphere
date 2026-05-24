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

const API_BASE = process.env.DASHBOARD_API_URL ?? "http://localhost:3000"

function rawRequest(
  url: string,
  headers: Record<string, string>
): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url)
    const isHttps = parsed.protocol === "https:"
    const transport = isHttps ? https : http

    const req = transport.request(
      {
        hostname: parsed.hostname,
        port: parsed.port || (isHttps ? 443 : 80),
        path: parsed.pathname + (parsed.search || ""),
        method: "GET",
        headers,
      },
      (res) => {
        let body = ""
        res.on("data", (chunk: Buffer) => {
          body += chunk.toString()
        })
        res.on("end", () => resolve({ status: res.statusCode ?? 200, body }))
      }
    )

    req.on("error", reject)
    req.setTimeout(8000, () => {
      req.destroy(new Error("server-fetch timeout"))
    })
    req.end()
  })
}

export async function serverGet<T = unknown>(
  path: string,
  token: string
): Promise<{ ok: boolean; status: number; data: T | null }> {
  try {
    const { status, body } = await rawRequest(`${API_BASE}${path}`, {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    })
    const ok = status >= 200 && status < 300
    try {
      return { ok, status, data: JSON.parse(body) as T }
    } catch {
      return { ok, status, data: null }
    }
  } catch {
    return { ok: false, status: 0, data: null }
  }
}
