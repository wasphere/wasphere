# Changelog

All notable changes to WaSphere are documented here.  
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).  
Versions follow [Semantic Versioning](https://semver.org/).

---

## [Unreleased]

---

## [1.3.0] - 2026-06-08

### v1.3 "Inbox CRM" — team inbox, roles & contacts

#### Added
- **Two-way Inbox** — inbound + outbound (API-sent and manual) messages sync into one conversation view; live updates over SSE; delivery/read ticks advance sent → delivered → read.
- **Interactive reply IDs** — button/list selections surface a stable `id` in the webhook for automation routing (Meta + Baileys).
- **Inbound media as download URLs** — webhook media is delivered as an authenticated download link (Bearer API key) instead of inline base64.
- **New chat** — start a fresh conversation by number from the dashboard.
- **Template send** — pick an approved Meta template (auto-listed from WhatsApp Manager) with variables, from the composer.
- **Contact card actions** — message a contact directly from their card.
- **Team & multi-agent** — invite teammates by link (7-day expiry, self-set password); Owner / Admin / Agent tiers.
- **Roles & granular permissions** — owner-defined custom roles (named capability sets: inbox, contacts, messages, sessions, webhooks, api_keys, settings); invites and members carry a role; the backend enforces capabilities (agents can no longer reach admin endpoints via the API, not just the UI).
- **Contact book CRM** — tags, notes, manual add, delete, tag filtering, bulk tag/delete, and CSV export.

### v1.2 "Reliability & Trust"

#### Added
- **Meta WhatsApp Cloud API provider** (opt-in — `META_PROVIDER_ENABLED=false` by default). Run a session on the official Cloud API alongside Baileys behind one unified API:
  - Send path: text · media (link mode) · location · contact · reaction · interactive (buttons/list) · template; `sendPoll` → capability error.
  - Inbound webhook receiver `POST/GET /api/meta/webhook/:sessionId` — verify-token handshake + `X-Hub-Signature-256` HMAC (required in production); translates Meta events into the same internal events the Inbox already consumes; downloads inbound media.
  - Capabilities introspection: `GET /api/sessions/:id/capabilities`.
  - Setup wizard: provider radio (Baileys / Meta) + credentials form + **Test connection** + copy-paste callback URL.
  - `GRAPH_VERSION` env (default `v22.0`).
- **Anti-ban session controls** — new sessions default to a **4–12s** human-like random send delay; per-session **per-minute message cap** (`max_messages_per_minute`, enforced by a rolling-window limiter); the Anti-Ban controls are now always visible in Settings.
- **Custom logo branding** — upload a workspace logo (Settings → Branding); shown in the sidebar.
- **Update notifications** — the dashboard shows an "Update available vX.Y.Z" banner (compares the running version to the latest GitHub release) with release notes + Docker update steps.
- **Opt-in send failover** — a session may set a `fallbackProvider`; a *retryable* send failure retries once on the backup provider (`via` recorded on the result).
- **Auto version display** — the app shows its real version everywhere (single source from `package.json`); login footer credit.

#### Notes
- The Meta provider ships **dormant** (flag off) — existing Baileys deployments are unaffected until you opt in.

---

## [1.1.0] - 2026-06-05

The **Inbox** release — a realtime, two-pane WhatsApp inbox in the dashboard, plus
the WhatsApp-correctness work needed to make it production-grade. Built on the
existing REST + SSE layer (no mocks); verified live against real WhatsApp numbers.
See PR #115 (implementation) and PR #110 (design doc).

### Added

- **Inbox UI** (`/dashboard/inbox`) — responsive two-pane layout (conversation
  list · thread · contact panel), built on ShadCN; fixed-height app shell so only
  the chat scrolls; WhatsApp-style empty state; mobile drawers + tappable actions
- **Realtime** via SSE (`message.new` / `conversation.update` / `message.status`),
  with 429→15s polling fallback and auto-reconnect; per-user sound toggle
- **Send** from the inbox — text, image, document (base64 data URI ≤16 MB), **poll**
  (single or multi-select), **reactions** (6 quick + full emoji picker), **forward**
  (to any active chat), copy
- **Receive + render** — image (lightbox + download), **voice/audio** player,
  **video** player + full-view lightbox, document download, sticker, **poll votes**
  ("🗳️ Voted: …"), reactions
- **Conversation management** — search (name / phone / preview), Open/Resolved
  tabs, unread badges, avatars, delivery ticks (sent/delivered/read/failed)
- **Tags** (add/remove), **Notes** (private per-customer), **Mute** (per chat),
  **Media & docs** gallery, editable **quick replies** (manage dialog)
- **Session filter** — universal inbox ("All sessions") or per-session
- **`poll.vote` webhook event** — dedicated, decrypted poll-vote delivery
  (`{ pollMessageId, pollName, selectedOptions, voter: { jid, phone } }`) for
  Shopify/WooCommerce order-confirmation flows; also delivered via `message.received`
- **Inbox integration test suite** — 13 tests against a real PostgreSQL test DB
  (`pnpm test:setup` / `pnpm test`)

### Fixed (WhatsApp correctness, from live testing)

- **LID addressing** — WhatsApp now sends an opaque `<id>@lid`; the real phone is
  on `key.senderPn`. Resolved for display **and** as the reply target (replies
  were silently failing before)
- **Poll-vote decryption** — correct LID/PN JID derivation (creator = our LID via
  the cached poll's `fromMe`, voter = PN/LID combos) per Baileys #2342; votes now
  decrypt and display, and undecryptable retries upgrade in place
- **Re-link recovery** — logging out then re-linking a session no longer leaves
  conversations stuck "read-only" (`session.connected` un-archives)
- **Avatars** fetched + shown; **undecryptable** placeholders hidden; **album/
  wrapper** messages (`associatedChildMessage` etc.) skipped; groups / status /
  broadcast / **newsletter** filtered (1:1 only)
- Composer crash (Base UI group), name-search matching all rows, reaction-bar
  clipping, and mobile hover-only actions

### Deferred to v1.2

- Streaming media endpoint for files > 16 MB (avoids base64/DB bloat)
- Location-map and contact-card (vCard) previews
- Poll-resolve helper (grace-window + delete-to-lock) for order flows
- Cross-session "Customer view" (merge a number across sessions)

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

[Unreleased]: https://github.com/wasphere/wasphere/compare/v1.1.0...HEAD
[1.1.0]: https://github.com/wasphere/wasphere/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/wasphere/wasphere/releases/tag/v1.0.0
