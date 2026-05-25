import * as http from "node:http"

const UPSTREAM = process.env.WA_SERVER_INTERNAL_URL ?? "http://wa-server:3001"
const SPEC_REWRITE_FROM = '"/api/docs-json"'
const SPEC_REWRITE_TO = '"/docs/wa-server/api/docs-json"'

function rawGet(url: string): Promise<{ status: number; headers: Record<string, string>; body: Buffer }> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url)
    const isHttps = parsed.protocol === "https:"
    const transport = isHttps
      ? (require("node:https") as typeof import("node:https"))
      : http
    const req = transport.request(
      {
        hostname: parsed.hostname,
        port: parsed.port || (isHttps ? 443 : 80),
        path: parsed.pathname + (parsed.search ?? ""),
        method: "GET",
        headers: { Accept: "*/*", "User-Agent": "WaSphere-Proxy/1.0" },
      },
      (res) => {
        const chunks: Buffer[] = []
        res.on("data", (chunk: Buffer) => chunks.push(chunk))
        res.on("end", () => {
          const headers: Record<string, string> = {}
          for (const [k, v] of Object.entries(res.headers)) {
            if (v !== undefined) headers[k] = Array.isArray(v) ? v.join(", ") : v
          }
          resolve({ status: res.statusCode ?? 200, headers, body: Buffer.concat(chunks) })
        })
      },
    )
    req.on("error", reject)
    req.setTimeout(10_000, () => req.destroy(new Error("proxy timeout")))
    req.end()
  })
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ path?: string[] }> },
) {
  const { path } = await params
  const subPath = path ? "/" + path.join("/") : ""
  const upstreamPath = subPath || "/api/reference"

  let result: Awaited<ReturnType<typeof rawGet>>
  try {
    result = await rawGet(`${UPSTREAM}${upstreamPath}`)
  } catch {
    return new Response("Upstream unreachable", { status: 502 })
  }

  const { status, headers, body } = result

  const responseHeaders: HeadersInit = {}
  for (const h of ["content-type", "cache-control", "etag", "last-modified"]) {
    if (headers[h]) (responseHeaders as Record<string, string>)[h] = headers[h]
  }

  const ct = headers["content-type"] ?? ""
  if (ct.includes("text/html")) {
    const rewritten = body.toString("utf8").replaceAll(SPEC_REWRITE_FROM, SPEC_REWRITE_TO)
    return new Response(rewritten, { status, headers: responseHeaders })
  }

  return new Response(new Uint8Array(body), { status, headers: responseHeaders })
}
