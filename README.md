# WaSphere

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Version](https://img.shields.io/badge/version-1.0.0-green.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue.svg)
![Node](https://img.shields.io/badge/Node.js-20+-brightgreen.svg)

> Self-hosted WhatsApp automation platform — REST API, multi-session management, and a built-in dashboard.

<!-- hero GIF: replace with actual recording -->

---

## Features

- **14 message types** — text, image, video, audio, document, sticker, GIF, location, contact, poll, reaction, buttons, list, view-once
- **Multi-session** — manage multiple WhatsApp accounts from one server
- **Built-in dashboard** — send messages, manage sessions, view stats, configure webhooks — all in-browser
- **Per-session anti-ban controls** — configurable random send delay (ms range), auto-read toggle
- **Proxy support** — per-session HTTP/HTTPS/SOCKS5 proxy
- **Webhook delivery** — receive inbound events (messages, status updates) via configurable callback URL
- **Audit log** — every API call logged with timestamp, status, session, endpoint
- **Message statistics** — 7-day send history, by-type breakdown, 24h trend on the Overview page
- **IP/CIDR allowlist** — restrict API access by IP
- **Interactive API docs** — Scalar three-column reference at `/api/reference` (WA Server) and `/api/reference` (Dashboard API)

---

## Architecture

```
packages/
  wa-server/       NestJS + Baileys — WhatsApp gateway (port 3001)
  dashboard-api/   NestJS + Prisma + PostgreSQL — workspace, auth, stats (port 3005)
  dashboard-ui/    Next.js 15 (App Router) + ShadCN UI — browser dashboard (port 3004)
```

---

## Quick Start

### Prerequisites

- Node.js 20+
- pnpm 9+
- PostgreSQL 16
- Redis 7+

### 1. Clone & install

```bash
git clone https://github.com/YOUR_ORG/wasphere.git
cd wasphere
pnpm install
```

### 2. Configure environment

Copy `.env.example` files:

```bash
cp packages/wa-server/.env.example packages/wa-server/.env
cp packages/dashboard-api/.env.example packages/dashboard-api/.env
cp packages/dashboard-ui/.env.example packages/dashboard-ui/.env
```

Key variables:

| Variable | Description |
|---|---|
| `WA_TOKEN` | WA Server API token (generate a random string) |
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis connection string |
| `JWT_SECRET` | Dashboard auth secret |
| `ENCRYPTION_KEY` | 32-byte hex key for token encryption |

### 3. Run database migrations

```bash
cd packages/dashboard-api
npx prisma migrate deploy
```

### 4. Start all services

```bash
# From repo root — starts all three packages
pnpm dev
```

Services:

- WA Server: `http://localhost:3001`
- Dashboard API: `http://localhost:3005`
- Dashboard UI: `http://localhost:3004`

---

## Dashboard Pages

| Page | Description |
|---|---|
| **Overview** | Live stats — sessions, 24h messages, 7-day chart, recent activity |
| **Sessions** | Create, manage, QR-scan WhatsApp sessions |
| **Messages** | In-browser message tester for all 14 types |
| **Webhooks** | Configure inbound event callback URL |
| **Developer** | API token, WA Server URL, Audit log browser |
| **Settings** | WA Server configuration, workspace management |

---

## API Reference

| Reference | URL | Audience |
|---|---|---|
| **WhatsApp API** | `http://localhost:3001/api/reference` | Developers using the API to send messages, manage sessions, configure webhooks |
| **Admin API** | `http://localhost:3000/api/reference` | Tooling that manages workspaces, API keys, audit logs |

Both use Scalar's three-column layout — sidebar navigation, endpoint docs, and live code samples (cURL, JavaScript, Python, PHP) on the right. Toggle dark mode in the top-right corner.

> **Auth note:** Both doc UIs are publicly accessible by default. The spec includes `X-Api-Token` / Bearer auth schemas so you can try authenticated endpoints directly in the UI. To gate the docs UI behind auth, set `SWAGGER_ENABLED=false` and serve your own proxy.

Quick examples:

```bash
# Send a text message
curl -X POST http://localhost:3001/api/sessions/{sessionId}/messages/text \
  -H "X-Api-Token: YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"to": "+923001234567", "text": "Hello from WaSphere!"}'

# Send an image
curl -X POST http://localhost:3001/api/sessions/{sessionId}/messages/image \
  -H "X-Api-Token: YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"to": "+923001234567", "url": "https://example.com/image.jpg", "caption": "Check this out"}'

# List sessions
curl http://localhost:3001/api/sessions \
  -H "X-Api-Token: YOUR_TOKEN"
```

---

## Roadmap

### v1.1

- Inbox / chat UI — view and reply to incoming messages in the dashboard
- Multi-language code snippets on Developer page (Python, PHP, Node.js)
- Webhooks recent-events viewer
- Native file upload in Message Tester

### v1.5

- SQLite + MySQL database support (in addition to PostgreSQL)
- Real-time message log via wa-server (live stream view)
- Workspace rename

### v2.0

- Team / multi-user workspaces
- Role-based access control
- Contact management

---

## Security

- WA Server token accepted only via `X-Api-Token` header (never query string)
- Dashboard auth via httpOnly JWT cookie
- WA server tokens encrypted at rest (AES-256)
- SSRF protection on all media URL fetch operations
- IP/CIDR allowlist middleware
- Session credentials (`sessions/`) never committed — gitignored

---

## Contributing

1. Fork → feature branch → PR
2. Follow the NestJS module structure (module / controller / service)
3. Keep files under 500 lines
4. No mock tests for WhatsApp behaviour — tests run against real PostgreSQL

---

## License

MIT — see [LICENSE](./LICENSE)

---

## Acknowledgments

- [Baileys](https://github.com/WhiskeySockets/Baileys) — WhatsApp Web API library
- [ShadCN UI](https://ui.shadcn.com/) — UI components
- [Prisma](https://www.prisma.io/) — database ORM
