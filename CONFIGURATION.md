# Configuration Reference

WaSphere is two services that talk over HTTP:

- **WA Server** — the WhatsApp gateway (Baileys), listens on port `3001`.
- **Dashboard** — API (`3000`) + UI (`3004`) that manage and proxy to the WA Server.

Most configuration is environment variables. See each package's `.env.example`:

- `packages/wa-server/.env.example`
- `packages/dashboard-api/.env.example`
- `packages/dashboard-ui/.env.example`

---

## WA Server URL

The single setting most people get wrong. It is the **internal URL the dashboard
uses to reach the WA Server** — *not* a public URL, and not where your browser is.

You set it in two places (they should agree):

1. **`WA_SERVER_INTERNAL_URL`** (dashboard-ui env) — used for the docs proxy and
   pre-filled as the default in **Settings → WA Server**.
2. **Settings → WA Server → Server URL** (per workspace, stored encrypted) — the
   value the dashboard actually proxies requests to.

### What to use

| Deployment | WA Server URL |
|---|---|
| **Docker / docker-compose** (most users) | `http://wa-server:3001` |
| **Manual** (services run individually) | `http://localhost:3001` (or host IP:port) |
| **Kubernetes** | `http://wa-server.<namespace>.svc.cluster.local:3001` |
| **Behind a reverse proxy** | the internal address, e.g. `http://wa-server:3001` — *not* the public HTTPS URL |

> **Why the Docker service name?** Inside a Docker network, containers reach each
> other by their **compose service name**, not `localhost`. The WA Server service
> is named `wa-server`, so from the dashboard container it lives at
> `http://wa-server:3001`. `localhost` inside the dashboard container points at the
> dashboard itself, not the WA Server — that's the classic "configured it but
> nothing works" trap.

### Token

Paste the WA Server's `WA_TOKEN` (from `packages/wa-server/.env`) into the token
field. It is encrypted at rest and never returned in API responses.

### Test it

Use the **Test Connection** button in Settings → WA Server. It verifies the URL is
reachable and (with a token) that the token is accepted, returning the WA Server
version on success.

---

## Common gotchas

- **Wrong host inside Docker** — using `http://localhost:3001` from a containerized
  dashboard. Use `http://wa-server:3001`.
- **Wrong port** — the WA Server is `3001`, the Dashboard API is `3000`, the UI is
  `3004`. Don't point the WA Server URL at `3000`.
- **Public URL instead of internal** — pointing at `https://wa.your-domain.com`
  forces traffic out and back through your reverse proxy. Use the internal address.
- **Service-name typo** — must match the compose service name exactly (`wa-server`).
- **Firewall / network isolation** — in non-Docker setups, ensure the dashboard host
  can actually reach the WA Server host:port.

---

## Other key variables

| Variable | Service | Notes |
|---|---|---|
| `WA_TOKEN` | wa-server | API token (min 16 chars) |
| `DATABASE_URL` | dashboard-api | PostgreSQL connection string |
| `JWT_SECRET` | dashboard-api | Dashboard auth secret (min 32 chars) |
| `ENCRYPTION_KEY` | dashboard-api | 32-byte hex (64 chars) for token encryption |
| `INTERNAL_WEBHOOK_SECRET` | both | Shared secret for wa-server → dashboard events |
| `CORS_ORIGIN` | both | Allowed browser origin — never `*` |
| `WA_SERVER_INTERNAL_URL` | dashboard-ui | Default WA Server URL (see above) |
| `DASHBOARD_API_URL` | dashboard-ui | Where the UI reaches the Dashboard API |

Full lists with defaults live in each package's `.env.example`.
