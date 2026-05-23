# Changelog

All notable changes to WaSphere are documented here.

---

## [Unreleased] — v1.0 Sprint (feature/v1-final-sprint)

### Added

- **API Keys** — multi-key support with permission scopes, session scoping, argon2id hashing,
  key rotation, automatic `lastUsedAt` tracking with 60s debounce. Key format: `wsk_<43 base62>`.
- **Permission scopes** — 12 granular scopes grouped by domain (messages, sessions, webhooks,
  workspace, audit) plus wildcard `*`. Enforced at both route level and proxy level.
- **Dual authentication** — `CombinedAuthGuard` accepts JWT (human login) or API key
  (`Bearer wsk_...`) on all workspace endpoints.
- **Multi-webhook fanout** — up to N registered webhooks per workspace, each with its own
  HMAC-SHA256 signing secret shown once at creation. Per-webhook retry (exponential backoff
  1s / 5s / 30s), auto-deactivation at 50 cumulative failures.
- **Webhook test-fire** — `POST /workspaces/:id/webhooks/:webhookId/test` sends a live
  `webhook.test` event and returns `{ success, statusCode, error }`.
- **IP/CIDR allowlist middleware** — configurable per-workspace IP allowlist on all API routes.
- **Per-session proxy support** — HTTP/HTTPS/SOCKS5 proxy configurable per session.
- **Per-session anti-ban controls** — configurable typing delays and message pacing.
- **Audit logs** — paginated, filterable audit log with 90-day retention and nightly purge cron.
- **Developer page — API Keys UI** — table with permission chips, create/edit/rotate/delete
  modals, one-time key reveal with copy button, last-active-key deletion guard.
- **Scalar API Reference** — replaces Swagger UI on both wa-server and dashboard-api.

### Architecture

- **`POST /internal/webhook-event/:workspaceId`** — dashboard-api endpoint that receives
  WhatsApp events from wa-server and fans out to all active matching webhooks for that workspace.
  Returns `202 Accepted` immediately; delivery runs in background via `Promise.allSettled`.

### Constraints (v1.0)

- **Single workspace per wa-server deployment.** `DASHBOARD_WEBHOOK_URL` must include the
  workspace UUID (e.g. `https://dashboard/internal/webhook-event/<uuid>`). wa-server code
  is unchanged — the workspace context is carried by the URL. Multi-workspace support
  (session-to-workspace resolution on the dashboard side) is deferred to v1.1.

### Upgrade notes (from earlier branches)

- If you previously set `DASHBOARD_WEBHOOK_URL` to receive WhatsApp events directly,
  update it to point at dashboard-api's `/internal/webhook-event/<workspace-uuid>` endpoint.
  User-facing webhook URLs are now managed per-workspace via the Dashboard → Webhooks page.
- The old single-callback-URL Webhooks page UI is replaced by the multi-webhook table in Phase F.
  The `POST /api/webhooks/callback` endpoint on wa-server remains for backward compatibility
  but runtime URL overrides are not recommended in production.
