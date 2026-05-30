import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Mirror the NestJS helmet hardening on the Next.js UI surface.
  // CSP is intentionally deferred to v1.1 — it needs careful work for the
  // Next.js + Scalar docs combo.
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Strict-Transport-Security", value: "max-age=15552000; includeSubDomains" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "X-DNS-Prefetch-Control", value: "off" },
        ],
      },
    ];
  },
};

export default nextConfig;
