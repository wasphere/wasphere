# Changelog

All notable changes to WaSphere are documented here.  
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).  
Versions follow [Semantic Versioning](https://semver.org/).

---

## [Unreleased]

---

## [1.0.0] - 2026-05-27

### Added

- **Multi-session WhatsApp connections** — create, QR-scan, and manage multiple WhatsApp accounts per workspace
- **14 message types** — text, image, video, audio, document, sticker, GIF, location, contact, buttons, list, poll, reaction, view-once; all available in the in-browser message tester
- **Multi-API-key authentication** — up to N keys per workspace, each with 12 scoped permissions (messages:send, messages:read, sessions:read, sessions:write, sessions:delete, webhooks:read, webhooks:write, webhooks:delete, workspace:read, workspace:write, audit:read, wildcard `*`). Key format: `wsk_<43 base62 chars>`
- **API key rotation** — one-click rotate with one-time reveal of the new key; automatic `lastUsedAt` tracking with 60-second debounce
- **Multi-webhook fanout** — up to N registered webhooks per workspace, each with its own HMAC-SHA256 signing secret shown once at creation
- **Webhook delivery** — exponential backoff retry (1 s / 5 s / 30 s), auto-deactivation at 50 cumulative failures, test-fire returning `{ success, statusCode, error }`
- **10 canonical webhook events** — `message.sent`, `message.delivered`, `message.read`, `message.failed`, `message.received`, `session.connected`, `session.disconnected`, `session.qr`, `session.failed`, `webhook.test`
- **Built-in Scalar API reference** — replaces Swagger UI on both WA Server (`/api/reference`) and Dashboard API (`/api/reference`); includes live cURL / JS / Python / PHP examples
- **Anti-ban controls** — per-session configurable random send delay (min/max ms), auto-read-on-receive toggle, receive-enabled toggle; applied immediately without session restart
- **Per-session HTTP/HTTPS/SOCKS5 proxy support**
- **IP/CIDR allowlist middleware** — restrict WA Server API access by IP or CIDR range
- **Audit log** — paginated, filterable by session ID, date range, and status code; 90-day retention with nightly purge cron
- **Overview dashboard** — 4 animated metric cards (sessions, messages 24h, success rate, events today), 7-day bar chart with spring animation, donut chart by message type, recent activity feed, WA Server Online/Offline pulse badge
- **Status pulse animations** — green/amber pulse on session status badges
- **Empty state illustrations** — SVG illustrations on all empty states (sessions, messages, webhooks, API keys)
- **Dark mode** — full dark mode parity across all pages; WCAG AA colour contrast

### Security

- **argon2id** password hashing for API keys
- **httpOnly cookie + Bearer token** dual authentication — JWT for browser sessions, `Bearer wsk_...` for API clients
- **Cross-workspace isolation** — proxy layer enforces workspace membership on every proxied request
- **WA server tokens encrypted at rest** — AES-256 via `ENCRYPTION_KEY`
- **WA Server token header-only** — `X-Api-Token` header accepted; query string rejected
- **SSRF protection** on all media URL fetch operations
- **Session credentials gitignored** — `sessions/` directory never committed

### Architecture

- `POST /internal/webhook-event/:workspaceId` — dashboard-api endpoint that receives WhatsApp events from wa-server and fans out to all active matching webhooks for that workspace; returns `202 Accepted` immediately, delivery runs via `Promise.allSettled`
- Monorepo: pnpm workspaces — `wa-server` (NestJS + Baileys, port 3001), `dashboard-api` (NestJS + Prisma + PostgreSQL, port 3000), `dashboard-ui` (Next.js 15 App Router + ShadCN UI, port 3004)

### Constraints (v1.0)

- **Single workspace per wa-server deployment** — `DASHBOARD_WEBHOOK_URL` must include the workspace UUID. Multi-workspace sharing a single wa-server is deferred to v1.1.

---

[Unreleased]: https://github.com/wasphere/wasphere/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/wasphere/wasphere/releases/tag/v1.0.0
