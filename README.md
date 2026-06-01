# WaSphere

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![Version](https://img.shields.io/badge/version-1.0.0-green.svg)](./CHANGELOG.md)
[![Node](https://img.shields.io/badge/Node.js-20+-brightgreen.svg)](https://nodejs.org)

Self-hosted WhatsApp API platform — multi-session, multi-webhook, with developer-first dashboard. Built for WHMCS, billing systems, and custom integrations.

<!-- screenshot: hero -->

---

## Features

- **Multi-session WhatsApp connections** — manage multiple WhatsApp accounts from a single deployment
- **14 message types** — text, image, video, audio, document, sticker, GIF, location, contact, buttons, list, poll, reaction, view-once
- **Multi-API-key authentication** — up to N keys per workspace, each with 12 scoped permissions (messages, sessions, webhooks, workspace, audit, wildcard)
- **Multi-webhook delivery** — per-webhook HMAC-SHA256 signing secrets, exponential backoff retry, auto-deactivation on failure, test-fire button
- **Built-in API docs** — Scalar three-column reference at `/api/reference` on both WA Server and Dashboard API
- **Anti-ban controls** — per-session configurable min/max send delay (ms), auto-read toggle, receive toggle
- **Audit log** — every API request logged with timestamp, method, path, status, duration; filterable by session, date range, status code; 90-day retention
- **Dark mode + WCAG AA** — full dark mode parity, status pulse animations, accessible colour contrast throughout

---

## Install

### Docker (recommended)

One `.env`, one command — the full stack (Postgres, WA Server, Dashboard API, Dashboard UI) builds and starts together. Database migrations run automatically.

```bash
git clone https://github.com/wasphere/wasphere.git
cd wasphere
cp .env.example .env
# Edit .env and set the secrets — generate each with: openssl rand -hex 32
#   POSTGRES_PASSWORD, JWT_SECRET, ENCRYPTION_KEY, WA_TOKEN,
#   WEBHOOK_SIGNING_SECRET, INTERNAL_WEBHOOK_SECRET
docker compose up -d
```

Then open the dashboard at **http://localhost:3004** and register the first (admin) account.

> Putting it behind a domain with TLS? Front it with your own nginx/Caddy/Traefik,
> and set `DASHBOARD_UI_URL=https://app.your-domain.com` in `.env`.

### Manual (Node + pnpm)

**Requirements:** Node ≥ 20, PostgreSQL ≥ 14, pnpm

```bash
git clone https://github.com/wasphere/wasphere.git
cd wasphere
pnpm install
docker compose -f docker-compose.dev.yml up -d   # Postgres for local dev
# Configure each package's .env (see First-Time Setup below):
cp packages/wa-server/.env.example     packages/wa-server/.env
cp packages/dashboard-api/.env.example packages/dashboard-api/.env
cp packages/dashboard-ui/.env.example  packages/dashboard-ui/.env
pnpm prisma:migrate          # runs prisma migrate deploy in dashboard-api
pnpm dev                     # starts all three packages concurrently
```

Services start on:

| Service | URL |
|---|---|
| WA Server | `http://localhost:3001` |
| Dashboard API | `http://localhost:3000` |
| Dashboard UI | `http://localhost:3004` |

---

## First-Time Setup

**Step 1 — Configure `.env` files**

Key variables across packages:

| Variable | Package | Description |
|---|---|---|
| `WA_TOKEN` | wa-server | API token (generate a random 32+ char string) |
| `DATABASE_URL` | dashboard-api | PostgreSQL connection string |
| `JWT_SECRET` | dashboard-api | Dashboard auth secret (random 64 chars) |
| `ENCRYPTION_KEY` | dashboard-api | 32-byte hex key for token encryption |
| `INTERNAL_WEBHOOK_SECRET` | both | Shared secret for wa-server → dashboard-api events (min 32 chars) |
| `WA_SERVER_INTERNAL_URL` | dashboard-ui | Where the dashboard reaches the WA Server (see below) |
| `DASHBOARD_WEBHOOK_URL` | wa-server | `https://your-dashboard/internal/webhook-event/<workspace-uuid>` |

> **`WA_SERVER_INTERNAL_URL` (and the Settings → WA Server URL field):**
> This is the **internal** address the dashboard uses to reach the WA Server —
> not a public URL.
> - **Docker / docker-compose:** `http://wa-server:3001` (the compose service name)
> - **Manual install:** `http://localhost:3001` (or your host's IP:port)
> - **Kubernetes:** `http://wa-server.<namespace>.svc.cluster.local:3001`
>
> Inside Docker, `localhost` points at the dashboard container itself — use the
> service name `wa-server`. See [CONFIGURATION.md](./CONFIGURATION.md) for details.

> **`DASHBOARD_WEBHOOK_URL` note (v1.0):** WaSphere v1.0 is one wa-server per workspace.
> Set this to include your workspace UUID, shown on the Settings page after first login.

**Step 2 — Run database migrations**

```bash
cd packages/dashboard-api
npx prisma migrate deploy
```

**Step 3 — Start services**

```bash
# From repo root
pnpm dev
# or: docker compose up -d
```

**Step 4 — Open the dashboard**

Navigate to `http://localhost:3004` and register an account.

**Step 5 — Send your first message**

1. Go to **Settings** → set your WA Server URL (Docker: `http://wa-server:3001`, manual: `http://localhost:3001`) and paste your `WA_TOKEN` → click **Test Connection** → Save
2. Go to **Sessions** → New Session → scan the QR code
3. Go to **Messages** → select your session → send a Text message

See [CONFIGURATION.md](./CONFIGURATION.md) if Test Connection fails (it's almost always the WA Server URL — Docker uses the service name, not `localhost`).

---

## Screenshots

<!-- screenshot: overview-dashboard -->
<!-- gif: create-session-flow -->
<!-- gif: send-message -->
<!-- gif: webhook-test-fire -->
<!-- screenshot: api-keys-page -->

---

## API Documentation

Interactive Scalar API reference is available at:

- **WhatsApp API** — `http://localhost:3001/api/reference` (send messages, manage sessions, configure webhooks)
- **Admin API** — `http://localhost:3000/api/reference` (workspaces, API keys, audit logs)

Both include live cURL / JavaScript / Python / PHP code examples and support authenticated requests directly in the browser. Toggle dark mode in the top-right corner.

Quick example:

```bash
# Send a text message
curl -X POST https://api.your-domain.com/workspaces/{workspaceId}/proxy/api/sessions/{sessionId}/messages/text \
  -H "Authorization: Bearer wsk_your_api_key" \
  -H "Content-Type: application/json" \
  -d '{"to": "+12345678901", "text": "Hello from WaSphere!"}'
```

---

## Roadmap

### v1.1 (next release)

- Inbox UI — receive messages and view threads in the dashboard
- Rich phone preview per message type
- Webhook recent-events log per webhook
- Custom signing secret input for webhooks
- Onboarding checklist for new workspaces
- Real-time event ticker on Overview page
- Sidebar logo SVG mark

### v1.5

- MySQL / SQLite support (currently PostgreSQL only)
- Full message log with search and filter
- Workspace rename
- Real-time WebSocket events
- Multi-workspace support per deployment

### v2.0 (future)

- WaSphere Pro — email/SMS notifications, multi-language SDK snippets, Campaigns, Automations, CRM & Inbox, AI Replies, WHMCS integration, premium support

---

## License

MIT — see [LICENSE](./LICENSE)

---

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for setup instructions, branch naming, commit format, and PR guidelines.

---

## Support

- **Bug reports / feature requests** — [GitHub Issues](https://github.com/wasphere/wasphere/issues)
- **Discussions** — [GitHub Discussions](https://github.com/wasphere/wasphere/discussions)
- **Twitter** — [@WaSphereHQ](https://twitter.com/WaSphereHQ)
