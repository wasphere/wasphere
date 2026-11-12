import type { MetadataRoute } from "next"

// demo.wasphere.com is noindex via the X-Robots-Tag header set in
// middleware.ts. Page routes stay crawlable on purpose: Google can only honour
// noindex on a URL it is allowed to fetch. API routes are blocked.
export const dynamic = "force-dynamic"

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", disallow: ["/api/"] }],
  }
}
