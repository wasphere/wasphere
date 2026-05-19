# WaSphere — Product Requirements Document

**Version of this document:** 2.1 (Build PRD)
**Product line covered:** WaSphere v1.x and v2.x
**Status:** Active — start of development
**License model:** MIT Core + Pro Commercial License
**Stack:** NestJS · Next.js · Baileys · PostgreSQL · Redis · BullMQ · React Flow

> **Changelog:** v2.0 → v2.1 added the database schema (Section 10), e-commerce/CMS
> connectors incl. WordPress/WooCommerce & Shopify (Section 7.3), GitHub & launch
> strategy (Section 16), and a future/omnichannel roadmap (Section 17). Project renamed
> **WaPilot → WaSphere** (WaPilot was an existing competitor). Added a Baileys/libsignal
> licensing note (Section 4.3).

> The most powerful open-source WhatsApp automation platform — built for developers,
> businesses, and hosting providers.

---

## 0. How to Use This Document

This is a **build PRD** — keep it in the repo (`docs/PRD.md`) and check boxes as you ship.

- **Core** = MIT-licensed, free, open source. Everything in **v1 is Core.**
- **Pro** = paid (managed cloud OR self-hosted license). Pro features are feature-gated and land in **v2.**
- Every feature is tagged with the version it ships in and whether it is Core or Pro.
- The golden rule from the planning phase: **ship v1 small, launch, then expand.** Do not
  build v2 features until v1 is launched and 10+ people are using it.

---

## 1. Strategy & Scope

### 1.1 The mistake to avoid

The original plan tried to build five products at once: a WhatsApp engine, a dashboard,
an automation builder, a CRM, and a WHMCS suite. That is ~9 months of solo work before
anything ships. **WaSphere is split into two clearly separated versions instead.**

### 1.2 The two-version strategy

| Version | What it is | Goal | Realistic effort (solo) |
|---|---|---|---|
| **v1** | WA engine + minimal dashboard + Docker deploy | A complete, useful, **launchable** open-source product. GitHub stars. | 10–14 weeks |
| **v2** | Automation builder + CRM + WHMCS + AI + SaaS billing | The Pro/monetization layer. Revenue. | 16–24 weeks after v1 |

**v1 is 100% MIT / Core.** It is the whole open-source product and the thing that earns
GitHub fame. **v2 adds the Pro layer** — the feature-gated, monetized capabilities.

### 1.3 Positioning (important)

WaSphere is positioned as a **customer-support and notification automation platform**,
never as a bulk/marketing tool. Baileys' own maintainers discourage bulk and automated
messaging, and WhatsApp actively restricts accounts that behave like spam. The defensible
use cases — support bots, ticket alerts, invoice reminders, OTP — are what WaSphere leads
with. Broadcast/bulk is intentionally **not** a headline feature.

### 1.4 Target users

| User type | Use case | Key features |
|---|---|---|
| Developers / freelancers | Build WA bots and integrations | REST API, webhooks, SDK |
| Small businesses | Customer support automation | Auto-reply, team inbox, CRM (v2) |
| Hosting companies | WHMCS notifications, ticket/invoice/suspension alerts | WHMCS plugin (v2) — the revenue moat |
| MSPs / agencies | Manage many client WA accounts | Multi-session, team roles (v2) |
| SaaS operators | Resell WA automation | Multi-tenant, white-label (v2) |

---

## 2. System Architecture

### 2.1 Binary + Dashboard model (Zender-style)

```
┌──────────────────────────────────────────────────────────────┐
│                      WASPHERE ECOSYSTEM                       │
│                                                               │
│   WA SERVER (binary)                 DASHBOARD                │
│   ──────────────────                 ─────────                │
│   NestJS app, runs on a VPS    ◄────► NestJS API + Next.js UI │
│   Manages Baileys sessions            Multi-tenant control     │
│   Exposes internal REST API           plane                   │
│   port 3001 + secret token            PostgreSQL/Redis/BullMQ  │
│                                                               │
│   Binary  ──connects to──►  Dashboard  via  IP : Port : Token │
└──────────────────────────────────────────────────────────────┘
```

The **WA Server** runs WhatsApp sessions and nothing else. The **Dashboard** is the
central control plane: users, plans, API keys, webhooks, history, and (in v2) automation.
One dashboard can manage many WA Server binaries.

### 2.2 The Baileys Adapter Layer (MANDATORY — fix this first)

All Baileys code must live behind a single interface. This is the difference between a
2-hour fix and a 2-week rewrite when WhatsApp changes its protocol.

```
src/whatsapp/
├── whatsapp-adapter.interface.ts   ← the contract (no Baileys import)
├── baileys.adapter.ts              ← the ONLY file that imports Baileys
└── whatsapp.module.ts
```

Every other service (`sessions`, `messages`, `groups`, `contacts`) depends on
`WhatsAppAdapter`, **never on Baileys directly.** When Baileys breaks, you fix one file.
This also makes a future swap to a Go/Rust engine possible without touching the REST API.

> The current `wa-server` code imports Baileys in four files. **Refactoring to this
> adapter is the very first development task.** See Section 12.

### 2.3 Connection flow

1. User runs the WA Server on a VPS: `docker run ... wasphere/wa-server` (token + port).
2. In the dashboard: **Add WA Server** → enter IP, Port, Token.
3. Dashboard health-checks the binary, registers it, and sets its own callback URL.
4. User creates WhatsApp accounts (sessions) under that server and scans the QR in-browser.
5. API keys, webhooks, history, and automations are all managed from the dashboard.

---

## 3. Technology Stack

### 3.1 WA Server (binary)

| Layer | Choice | Notes |
|---|---|---|
| Runtime | Node.js 20 LTS | |
| Framework | NestJS + TypeScript | |
| WA library | `@whiskeysockets/baileys` **pinned to exact `6.7.21`** | Do NOT use `^` or `latest`. v7 is still release-candidate and ESM-only — stay on the maintained 6.7.x line for v1. |
| Local storage | SQLite + session files | Sessions in `./sessions/{id}/` |
| Transport | HTTP REST (internal) | Dashboard talks to binary over this |
| Auth | Single secret token, **header only** | Never accept the token via query string |
| Distribution | **Docker image** (primary) | See note below on binaries |

> **Do not use `pkg`.** Vercel deprecated and archived `pkg` (last release 5.8.1) and it
> carries an unpatched local-privilege-escalation advisory for native-code packages. For
> v1, ship a Docker image only. Standalone `.exe`/binary builds are a **v1.1** item, and
> if needed should use the maintained fork `@yao-pkg/pkg`, not `pkg`.

### 3.2 Dashboard backend

| Layer | Choice |
|---|---|
| Framework | NestJS + TypeScript |
| ORM | Prisma |
| Database | **PostgreSQL 16** (recommended — see Section 11) |
| Cache / Queue | Redis + BullMQ |
| Media storage | MinIO / S3-compatible |
| Realtime | Socket.IO (live QR, status) |
| Auth | JWT access + refresh tokens |
| API docs | Swagger / OpenAPI 3.0 (built-in) |

### 3.3 Dashboard frontend

| Layer | Choice |
|---|---|
| Framework | Next.js 15 (App Router) |
| Styling | TailwindCSS + ShadCN UI, dark mode, responsive |
| Animation | Framer Motion |
| Automation UI (v2) | React Flow |
| Charts | Recharts |
| Icons | Lucide React |

### 3.4 Repo structure

```
wasphere/                       ← monorepo, pnpm workspaces, MIT
├── packages/
│   ├── wa-server/             ← WA binary (Core)
│   │   └── src/whatsapp/      ← adapter layer lives here
│   ├── dashboard-api/         ← NestJS backend (Core)
│   ├── dashboard-ui/          ← Next.js frontend (Core)
│   └── whmcs-module/          ← WHMCS PHP addon (Pro, v2)
├── docs/                      ← MDX docs + this PRD
├── docker-compose.yml
├── install.sh
└── README.md
```

---

## 4. Open Core Model — What Is Free vs Paid

### 4.1 Core (MIT, free, self-hosted) — ALL of v1

Everything below is open source and free forever when self-hosted:

- WA Server binary and the full WhatsApp engine
- Every Baileys feature exposed as REST (all message types, groups, contacts, presence)
- Multi-session — **unlimited accounts when self-hosted**
- Full REST API + webhooks
- Rate limiting, account warmup, health score (reliability features stay Core — they
  protect users and should never be paywalled)
- Dashboard: auth, WA-server management, account management, message history, API keys,
  webhook management, built-in API docs
- Docker deploy, install script
- Community support

### 4.2 Pro (paid) — feature-gated, ships in v2

Pro is sold two ways: **managed cloud** (monthly) or **self-hosted license** (one-time).
Pro features are gated by a license key:

- Automation Builder (React Flow visual workflows)
- Built-in CRM + Team Inbox
- AI nodes (GPT / Claude / Gemini, transcription, translation, sentiment)
- WHMCS integration module
- Integration nodes (n8n, HubSpot, Zoho, Google Sheets/Calendar, Slack, Zapier, Make)
- White-label (custom domain, branding removal)
- Multi-user team roles + audit log
- Advanced analytics & reporting
- Priority support

> Managed-cloud plan limits (account caps, message/day caps) apply **only to the hosted
> service** — self-hosting the Core has no artificial limits.

### 4.3 Licensing note — Baileys & libsignal (GPLv3)

WaSphere's core is MIT and the Pro layer is closed-source commercial. One dependency
detail to be aware of:

- Baileys itself is **MIT** licensed.
- Baileys currently depends on `libsignal`, which is **GPLv3** — a strong copyleft
  license. GPLv3 can, in principle, require software that links to it to also be released
  under GPLv3, which would conflict with a closed-source Pro layer.

**The architecture already contains this risk — keep the boundary strict:**

- Only the **WA Server binary** imports Baileys. The binary is MIT / open source anyway.
- The **dashboard**, where all closed-source Pro features live, **never imports Baileys**
  — it only talks to the binary over HTTP. The closed Pro code therefore never links to
  libsignal.
- Rule: Pro / closed code must never `import` Baileys or the binary's internals — it may
  only call the binary's HTTP API.

The Baileys maintainers are actively replacing libsignal with their own Rust
implementation specifically to remove this GPLv3 dependency, so the concern shrinks over
time. Not an emergency — just keep the binary open and the Pro code in the dashboard.

---

## 5. Version Roadmap

| Release | Theme | Core/Pro | Headline |
|---|---|---|---|
| **v1.0** | Engine + Dashboard MVP | Core | Launchable product — sessions, messaging, webhooks, Docker |
| **v1.1** | Developer experience | Core | API playground, webhook log UI, Postman export, notifications |
| **v1.2** | Reliability & safety | Core | Warmup, smart rate limiting, templates, scheduling, 2FA |
| **v2.0** | Automation Builder | Pro | React Flow visual workflows + execution engine |
| **v2.1** | CRM & Team Inbox | Pro | Contacts, unified inbox, Kanban pipeline, team roles |
| **v2.2** | WHMCS, Integrations, AI | Pro | WHMCS module, AI nodes, integration nodes, cPanel/WHM |
| **v2.3** | SaaS & Monetization | Pro | Stripe billing, white-label, license-key gating |

---

## 6. v1 — Full Feature Specification

> **All of v1 is Core / MIT.** This is the open-source product you launch.

### 6.1 v1.0 — Engine + Dashboard MVP

#### 6.1.1 WA Server — engine hardening

| Feature | Status |
|---|---|
| Refactor to `WhatsAppAdapter` interface (Baileys isolated in one file) | ☐ |
| Pin Baileys to exact `6.7.21` | ☐ |
| Bundled fallback WA protocol version (no hard dependency on remote fetch at startup) | ☐ |
| Per-session send queue with configurable delay (anti-ban) | ☐ |
| Webhook event spooling — buffer to disk if dashboard is down, replay on reconnect | ☐ |
| Graceful shutdown (SIGTERM — close sockets, save sessions) | ☐ |
| Token accepted via header only (remove query-string token) | ☐ |
| Auto-reconnect with exponential backoff + max-retry failure event | ☐ |
| Session restore on binary restart | ☐ |

#### 6.1.2 WA Server — session management

| Feature | API | Status |
|---|---|---|
| Create session (starts QR flow) | `POST /sessions` | ☐ |
| List sessions | `GET /sessions` | ☐ |
| Get session info + QR (base64) | `GET /sessions/:id` | ☐ |
| Delete session + auth files | `DELETE /sessions/:id` | ☐ |
| Logout from WhatsApp | `POST /sessions/:id/logout` | ☐ |
| Pairing-code login (no QR) | `POST /sessions/:id/pair` | ☐ |
| Multi-session (unlimited per binary) | — | ☐ |

#### 6.1.3 WA Server — messaging (send)

| Message type | API | Status |
|---|---|---|
| Text | `POST /sessions/:id/messages/text` | ☐ |
| Text with quoted reply (**fix:** pass full quoted message object) | `POST .../text` | ☐ |
| Image (URL) + caption | `POST .../image` | ☐ |
| Video (URL) + caption | `POST .../video` | ☐ |
| Audio / voice note (PTT) | `POST .../audio` | ☐ |
| Document (any format) | `POST .../document` | ☐ |
| Sticker (WebP) | `POST .../sticker` | ☐ |
| Location | `POST .../location` | ☐ |
| Contact card (vCard) | `POST .../contact` | ☐ |
| Poll | `POST .../poll` | ☐ |
| Emoji reaction | `POST .../reaction` | ☐ |
| GIF (mp4 + gifPlayback) | `POST .../gif` | ☐ |
| View-once image | `POST .../view-once` | ☐ |
| Edit sent message | `POST .../:msgId/edit` | ☐ |
| Delete message (for everyone) | `DELETE .../:msgId` | ☐ |
| Forward message | `POST .../forward` | ☐ |
| Buttons / List messages | `POST .../buttons` `.../list` | ☐ (ship, but mark as unreliable on personal accounts) |

#### 6.1.4 WA Server — receive & actions

| Feature | Delivery | Status |
|---|---|---|
| Receive all incoming message types (parsed + normalized) | Webhook `message.received` | ☐ |
| Receive poll votes | Webhook `poll.vote` | ☐ |
| Receive reactions | Webhook `message.received` | ☐ |
| Delivery / read receipts | Webhook `message.receipt` | ☐ |
| Mark message(s) as read | `POST .../messages/read` | ☐ |
| Download incoming media | URL in webhook payload | ☐ |
| Message history | `GET .../messages?chatId=` | ☐ |

#### 6.1.5 WA Server — presence, profile, contacts, groups

| Group | Features |
|---|---|
| Presence | Typing indicator, recording indicator, online/offline, subscribe to presence, last-seen |
| Own profile | Get profile, get/set/remove profile picture, set name, set about |
| Contacts | Get contact picture, get about, check number on WhatsApp, bulk check, block/unblock |
| Groups | Create, get info, list participating, set name/description/picture, add/remove/promote/demote, leave, get/revoke invite link, join by invite, group settings (lock/announcement) |

#### 6.1.6 WA Server — webhook events

`session.qr`, `session.connected`, `session.disconnected`, `session.logged_out`,
`session.failed`, `session.deleted`, `message.received`, `messages.update`,
`message.receipt`, `poll.vote`, `presence.update`, `groups.update`,
`group.participants.update`, `contacts.update`, `call`

#### 6.1.7 Dashboard backend (v1.0)

| Module | Features | Status |
|---|---|---|
| Auth | Register + email verification, JWT + refresh, password reset | ☐ |
| Workspace / tenant | Workspace model, plan record, usage-limit enforcement | ☐ |
| WA Server | Register binary (IP/Port/Token), health poll (10s), proxy commands, receive webhook events | ☐ |
| Accounts | Create WA account under a server, QR proxy, real-time status (Socket.IO), message history storage, media → MinIO | ☐ |
| Webhooks | Create/edit/delete, event selection, HMAC signature, **delivery log + auto-retry (3×) + manual retry** | ☐ |
| API keys | Generate (hashed), per-key rate limit, auth middleware | ☐ |
| API docs | Swagger / OpenAPI 3.0, auto-inject user key | ☐ |

> Webhook **retry** lives in the dashboard; the **binary** only spools and replays to the
> dashboard. Together this guarantees no inbound message is lost.

#### 6.1.8 Dashboard frontend (v1.0)

| Page | Features | Status |
|---|---|---|
| Foundation | Next.js 15, Tailwind + ShadCN, **dark mode**, **mobile responsive**, Framer Motion | ☐ |
| Auth | Login, register, reset password | ☐ |
| Home | Stats cards, message-volume chart (Recharts) | ☐ |
| WA Servers | Add, list, health dot (green/red), rename/notes | ☐ |
| Accounts | Add account, **live QR via Socket.IO**, status badge, detected number/name/picture, disconnect | ☐ |
| Messaging | Send test message (text + media) from UI, message history table | ☐ |
| Developer | API keys page, webhook management page, webhook delivery log viewer, built-in Swagger UI | ☐ |

#### 6.1.9 Deployment (v1.0)

| Item | Status |
|---|---|
| `docker-compose.yml` — Postgres, Redis, API, UI, MinIO in one command | ☐ |
| `install.sh` — one-line VPS installer | ☐ |
| Nginx + Caddy reverse-proxy configs, Let's Encrypt SSL | ☐ |
| WA Server Docker image published to registry | ☐ |
| `README.md` — logo, demo GIF, quick start, API table, screenshots | ☐ |

### 6.2 v1.1 — Developer Experience (post-launch, Core)

| Feature | Status |
|---|---|
| API Playground — try-it-now request tester inside the dashboard | ☐ |
| Webhook delivery log viewer with one-click retry | ☐ |
| Downloadable Postman collection + OpenAPI export | ☐ |
| Code examples per endpoint (curl, JS, Python, PHP) | ☐ |
| Notification center (account disconnected, webhook failed, quota reached) | ☐ |
| Import / export contacts (CSV) | ☐ |
| Standalone binary builds via `@yao-pkg/pkg` (Linux/Windows/Mac) | ☐ |
| GitHub Actions: auto-build Docker image + binaries on release tag | ☐ |

### 6.3 v1.2 — Reliability & Safety (Core)

| Feature | Status |
|---|---|
| Account warmup mode — gradually ramp message volume on new accounts | ☐ |
| Smart rate limiting — auto-detect WA restriction signals and slow down | ☐ |
| Blacklist / whitelist per account | ☐ |
| Account health score (green / yellow / red) with restriction warnings | ☐ |
| Message templates library (variables) | ☐ |
| Scheduled messages (date + time) | ☐ |
| Two-way chat history search across accounts | ☐ |
| Two-factor authentication (2FA) | ☐ |

---

## 7. v2 — Full Feature Specification

> **All of v2 is Pro** (feature-gated by license key). Do not start v2 until v1 is
> launched and has real users.

### 7.1 v2.0 — Automation Builder (Pro)

Visual drag-and-drop workflow editor (React Flow). Flows are stored as JSON in PostgreSQL
and run by a backend execution engine.

**Trigger nodes:** Message Received · Keyword Match (exact/contains/regex) · First Message ·
Schedule (cron) · Webhook Trigger · Button Reply · List Reply · Poll Vote

**Action nodes:** Send Text · Send Image · Send Buttons · Send List · Send Poll ·
Send Location · Wait/Delay · Set Variable · HTTP Request · Send Email · Add Label ·
Human Handoff · Mark Read · End Flow

**Logic nodes:** Condition (If/Else) · Switch (multi-branch) · Loop · Counter

| Deliverable | Status |
|---|---|
| React Flow canvas, node palette, connections | ☐ |
| All trigger / action / logic nodes | ☐ |
| Flow save / load (JSON in Postgres) | ☐ |
| Flow enable / disable toggle | ☐ |
| Backend flow execution engine | ☐ |
| Per-flow + per-node execution logs | ☐ |

### 7.2 v2.1 — CRM & Team Inbox (Pro)

| Area | Features |
|---|---|
| Contacts | Auto-create on first message, custom fields, segments, merge duplicates, full history, import/export |
| Team Inbox | Unified inbox across accounts, assign to agent, status (Open/Pending/Resolved/Snoozed), internal notes, @mentions, quick replies, SLA tracking |
| Pipeline | Kanban board, custom stages, stage-based automations, revenue tracking |
| Labels | Colored labels, apply from inbox or via automation, filter and segment |
| Team & roles | Roles (Owner/Admin/Agent/Developer), email invites, activity audit log |

### 7.3 v2.2 — WHMCS, Integrations & AI (Pro)

**WHMCS module** (PHP addon — the revenue moat):

| Event | Trigger |
|---|---|
| New ticket / ticket reply → WA notification | hooks `TicketOpen`, `TicketAddReply` |
| Invoice created / due soon / overdue → WA reminder | hook `InvoiceCreated` + cron |
| Service suspended / terminated / unsuspended → WA alert | service hooks |
| Domain expiry → WA reminder | cron (30/14/7 days) |
| New client / order paid → WA welcome / confirmation | hooks `ClientAdd`, `OrderPaid` |
| OTP verification via WhatsApp | hook `ClientLogin` |
| AI support bot answering from a knowledge base | incoming WA message |

**AI nodes:** AI Reply (GPT/Claude/Gemini) · Intent Detection · Sentiment Analysis ·
Transcribe Audio (Whisper) · Text-to-Speech · Translate · AI Memory (pgvector).

**Integration nodes / connectors:** n8n · Zapier · Make.com · Google Sheets ·
Google Calendar · Slack · HubSpot · Zoho · Custom DB query.

**E-commerce & CMS plugins (Pro, v2.2):**

| Plugin | Platform | Use case | Build effort |
|---|---|---|---|
| WHMCS module | WHMCS (PHP) | Ticket / invoice / suspension / domain alerts, OTP | Medium |
| WooCommerce plugin | WordPress (PHP) | Order confirmation, shipping update, abandoned-cart recovery | Medium |
| Shopify app | Shopify | Order / shipping / cart notifications | **High** — needs Shopify Partner account, app review, OAuth + billing API |
| cPanel / WHM plugin | cPanel/WHM | Disk-usage, suspension, server-resource alerts | Medium |

> **Strategy — do not build all of these at once.** Every plugin is a separate codebase
> in a separate ecosystem with its own maintenance burden. Two principles:
> 1. **You do not need a dedicated plugin for every platform.** Any platform can integrate
>    through WaSphere's REST API + webhooks today. Dedicated plugins are *convenience for
>    non-technical users* — built later, never a v1 dependency.
> 2. **Build demand-driven, one flagship per audience:** WHMCS for hosting companies,
>    WooCommerce for e-commerce. Shopify comes last because it is the most work. Ship the
>    one your actual users ask for first.

### 7.4 v2.3 — SaaS & Monetization (Pro)

| Feature | Status |
|---|---|
| Stripe billing + subscription management | ☐ |
| License-key generation and validation (gates Pro features) | ☐ |
| White-label: custom domain, logo, brand colors, branding removal | ☐ |
| Multiple WA-server binaries per user | ☐ |
| Advanced analytics dashboards | ☐ |

---

## 8. Complete Feature Matrix (Core / Pro / Version)

| Feature | Tier | Version |
|---|---|---|
| WA engine, all message types, groups, contacts, presence | Core | v1.0 |
| Multi-session (unlimited self-hosted) | Core | v1.0 |
| REST API + webhooks + HMAC signing | Core | v1.0 |
| Per-session rate limiting | Core | v1.0 |
| Dashboard: servers, accounts, history, API keys, webhooks | Core | v1.0 |
| Built-in Swagger API docs | Core | v1.0 |
| Docker deploy + install script | Core | v1.0 |
| API playground, Postman export, notification center | Core | v1.1 |
| Standalone binaries (Linux/Win/Mac) | Core | v1.1 |
| Account warmup, smart rate limiting, health score | Core | v1.2 |
| Message templates, scheduled messages | Core | v1.2 |
| 2FA | Core | v1.2 |
| Automation Builder (React Flow) | **Pro** | v2.0 |
| CRM + Team Inbox + Kanban | **Pro** | v2.1 |
| Team roles + audit log | **Pro** | v2.1 |
| WHMCS module | **Pro** | v2.2 |
| WooCommerce / WordPress plugin | **Pro** | v2.2 |
| Shopify app | **Pro** | v2.2 |
| AI nodes | **Pro** | v2.2 |
| Integration nodes (n8n, Zapier, HubSpot, Sheets, etc.) | **Pro** | v2.2 |
| cPanel / WHM plugins | **Pro** | v2.2 |
| Stripe billing, license keys | **Pro** | v2.3 |
| White-label | **Pro** | v2.3 |

---

## 9. Baileys Update Strategy

1. **Pin exactly.** `"@whiskeysockets/baileys": "6.7.21"` — no `^`, no `latest`.
2. **Adapter isolation.** All Baileys code in `baileys.adapter.ts` only.
3. **Bundle a fallback WA version** so a failed remote version fetch never blocks startup.
4. **Update process when a new Baileys version drops:**
   - Day 1: GitHub Actions alert fires.
   - Day 1–7: bump version on a staging branch, run the full integration test suite
     (all message types, session persistence, reconnect, media).
   - Day 8: if stable, tag a new WA-server release; dashboard shows "update available".
   - Day 9+: users pull the new image; sessions auto-restore from stored files.
5. **Monitor:** WhiskeySockets/Baileys releases, EvolutionAPI/evolution-api (patches fast),
   Baileys Discord.
6. **v7 note:** Baileys v7 is ESM-only and still release-candidate. A move to v7 is a
   **major version bump (WaSphere v2-era)** and needs its own migration branch — not v1.

---

## 10. Database — Choice & Schema

### 10.1 PostgreSQL vs MySQL

**Recommendation: PostgreSQL 16.**

- Automation flows are stored as JSON — Postgres **JSONB** is indexed and fast.
- The v2 AI Memory node needs **pgvector**; MySQL has no mature equivalent.
- Prisma supports both, so the choice is not a lock-in, but switching later costs time.

**If MySQL is required** (e.g. an environment where only MySQL is available): it is
acceptable for **v1** with no functional loss — v1 has no AI features. The cost is paid in
v2: the AI Memory node must be deferred or use a separate vector store. Decision: **use
PostgreSQL from day one** unless there is a hard constraint.

The WA Server binary uses local **SQLite + files** regardless — the DB choice only
affects the dashboard.

### 10.2 Schema — v1 (dashboard database)

Modelled with Prisma. These are the tables v1.0 needs.

```sql
workspaces        id, name, plan, created_at
users             id, workspace_id, email, password_hash, name,
                  role(owner|admin|agent|developer), email_verified, created_at
plans             id, name, max_accounts, max_servers, max_webhooks,
                  max_messages_day, api_rate_limit, price
wa_servers        id, workspace_id, name, ip, port, secret_token,
                  status(online|offline|unknown), last_health_at, created_at
wa_accounts       id, server_id, workspace_id, session_id, phone, name,
                  status(connecting|qr|connected|disconnected|logged_out),
                  health_score, created_at
messages          id, account_id, workspace_id, direction(in|out),
                  chat_id, message_type, content(jsonb), media_url,
                  status(queued|sent|delivered|read|failed), wa_message_id,
                  created_at
webhooks          id, workspace_id, account_id, url, events(text[]),
                  secret, active, created_at
webhook_deliveries id, webhook_id, event, payload(jsonb), attempt,
                  response_status, success, created_at
api_keys          id, workspace_id, name, key_hash, last_used_at,
                  rate_limit, created_at
```

### 10.3 Schema — v2 additions (Pro)

```sql
automations       id, workspace_id, name, graph(jsonb), enabled, created_at
automation_runs   id, automation_id, status, node_logs(jsonb), started_at, ended_at
contacts          id, workspace_id, phone, name, labels(text[]),
                  custom_fields(jsonb), pipeline_stage, assigned_to, notes
conversations     id, workspace_id, account_id, contact_id,
                  status(open|pending|resolved|snoozed), assigned_to
team_invites      id, workspace_id, email, role, token, accepted, created_at
audit_logs        id, workspace_id, user_id, action, target, created_at
licenses          id, key, type(developer|agency|whitelabel), domains(text[]),
                  expires_at, created_at
ai_memory         id, workspace_id, contact_id, embedding(vector), content
```

> Indexes to add early: `messages(account_id, created_at)`,
> `messages(workspace_id, created_at)`, `wa_accounts(workspace_id)`,
> `webhook_deliveries(webhook_id, created_at)`. These keep history queries fast as
> message volume grows.

---

## 11. Deployment

### 11.1 Recommended — VPS + Docker

- WA Server: `docker run -p 3001:3001 -e WA_TOKEN=... wasphere/wa-server`
- Dashboard: `docker compose up -d` (Postgres, Redis, API, UI, MinIO)
- One-line installer: `curl -fsSL https://install.wasphere.io | bash`
- Provider examples: Hetzner, DigitalOcean, Contabo (~$5–6/month is enough to start).

### 11.2 cPanel — read this carefully

**Shared cPanel hosting is not suitable for the WA Server.** Baileys needs a persistent
24/7 WebSocket connection; shared hosting kills long-running processes, restarts idle
Passenger apps, and enforces process limits — the WhatsApp session will keep dropping.
Shared cPanel also typically has no Redis (BullMQ needs it) and no Docker.

- **WA Server → VPS only.** Not shared cPanel.
- **Dashboard** can technically run on cPanel Node.js, but still needs Redis — a VPS is
  cleaner and is the supported path.
- A **cPanel/WHM server with root access is effectively a VPS** — Docker/systemd work
  there, so that is fine.
- Target hosting-company customers already own servers, so this is not a blocker for them.

---

## 12. Where to Start — Day 1 / Week 1

The `wa-server` code already exists and works as a Phase-1 engine. **Do not rewrite it —
harden it.** Start here, in order:

### Day 1
1. Create the GitHub repo `wasphere` (monorepo, pnpm workspaces). Add this PRD to `docs/`.
2. Drop the existing `wa-server` code into `packages/wa-server/`.
3. In `package.json`, change Baileys from `^6.7.0` to exact **`6.7.21`**. Run `npm install`.
4. Write a minimal `README.md` placeholder.

### Day 2–5 — the adapter refactor (most important task)
5. Create `src/whatsapp/whatsapp-adapter.interface.ts` — the contract, no Baileys import.
6. Create `src/whatsapp/baileys.adapter.ts` — move **all** Baileys imports and calls here.
7. Change `sessions`, `messages`, `groups`, `contacts` services to depend on
   `WhatsAppAdapter` only. After this, only one file imports Baileys.
8. Verify everything still works: create a session, scan QR, send a text message.

### Week 1 — engine safety
9. Add a per-session send queue with a configurable delay (anti-ban).
10. Add webhook event spooling: if the dashboard POST fails, write the event to disk and
    replay it when the dashboard is reachable again.
11. Add a SIGTERM graceful-shutdown handler.
12. Fix the quoted-reply bug (pass the full quoted message object, not just a key).
13. Make the auth token header-only; remove `req.query.token`.

After Week 1 you have a **hardened, trustworthy engine**. Then move to the dashboard
backend (Section 6.1.7), then the frontend (6.1.8), then Docker + launch.

**Rule:** do not touch any v2 feature until v1.0 is launched and 10 people are using it.

---

## 13. Master Development Checklist

### v1.0 — Engine + Dashboard MVP
- ☐ Monorepo + repo created, Baileys pinned to `6.7.21`
- ☐ WA Server refactored to `WhatsAppAdapter` interface
- ☐ Per-session rate-limit queue
- ☐ Webhook event spooling + replay
- ☐ Graceful shutdown, header-only token, quoted-reply fix
- ☐ All message types working (send + receive)
- ☐ Sessions, groups, contacts, presence endpoints
- ☐ Dashboard backend: auth, tenant, WA-server, accounts, webhooks, API keys
- ☐ Dashboard frontend: auth, home, servers, accounts + live QR, messaging, dev tools
- ☐ Built-in Swagger docs
- ☐ Docker Compose + install script + reverse-proxy configs
- ☐ README with demo GIF → **launch**

### v1.1 — Developer Experience
- ☐ API playground, webhook log viewer + retry UI
- ☐ Postman / OpenAPI export, per-endpoint code examples
- ☐ Notification center, contact import/export
- ☐ Standalone binaries (`@yao-pkg/pkg`), release CI

### v1.2 — Reliability & Safety
- ☐ Account warmup, smart rate limiting, blacklist/whitelist
- ☐ Account health score
- ☐ Templates library, scheduled messages, chat search, 2FA

### v2.0 — Automation Builder (Pro)
- ☐ React Flow canvas, all node types, flow save/load
- ☐ Backend execution engine + logs

### v2.1 — CRM & Team Inbox (Pro)
- ☐ Contacts, team inbox + assignment, Kanban pipeline, labels, team roles

### v2.2 — WHMCS, Integrations & AI (Pro)
- ☐ WHMCS PHP module + all hooks
- ☐ AI nodes, integration nodes, cPanel/WHM plugins

### v2.3 — SaaS & Monetization (Pro)
- ☐ Stripe billing, license-key gating, white-label, multi-server

---

## 14. Pricing (for v2, when Pro ships)

### Managed cloud (monthly)

| | Starter $19 | Growth $49 | Business $99 |
|---|---|---|---|
| WhatsApp accounts | 10 | 50 | Unlimited |
| Messages / day | 2,000 | 20,000 | 100,000 |
| Automation flows | 5 | 25 | Unlimited |
| AI nodes | — | Yes | Yes |
| WHMCS integration | — | Yes | Yes |
| CRM + Team Inbox | — | Yes | Yes |
| Team members | 3 | 10 | Unlimited |

### One-time self-hosted licenses

| License | Price | Includes |
|---|---|---|
| Developer | $149 | 1 domain, all Pro features, 1 year of updates |
| Agency | $349 | 5 domains, all Pro features, 1 year of updates |
| White-label | $699 | Unlimited domains, branding removal, 1 year of updates |

> Self-hosting the **Core** is always free. Pricing applies to the **Pro** layer only.

---

## 15. Success Metrics (realistic)

GitHub stars are a vanity metric early on; the real signal is **deployments and issues**.

| Timeline | Star target | Real signal |
|---|---|---|
| Launch month | 50–150 | 10 people actually deploy it and file issues |
| Month 3 | 300–800 | First external contributor PR |
| Month 6 | 1,000–2,500 | First paying Pro user / first hosting company |
| Year 1 | 3,000–8,000 | Steady issue flow, active Discord |

Treat anything above these as a bonus. Do not anchor on the original 20k-in-year-one
number — that sets up a false sense of failure.

---

## 16. GitHub & Launch Strategy

The open-source v1 is what earns visibility. A great product with a weak launch gets
ignored; plan the launch as carefully as the code.

### 16.1 README must-haves (before launch day)

- ☐ Logo — clean SVG, works on light and dark backgrounds
- ☐ One-line description in the first three lines
- ☐ Demo GIF — QR scan → connected → message sent (this single asset drives most stars)
- ☐ Feature badges — license, version, Discord, build status
- ☐ Quick start — three commands from zero to running
- ☐ Architecture diagram (the binary + dashboard picture)
- ☐ API endpoint table with real curl examples
- ☐ Screenshots — dashboard, QR scan, API docs
- ☐ Comparison table vs Evolution API and Zender
- ☐ Contributing guide + "good first issue" labels
- ☐ Discord invite link

### 16.2 Launch sequence (after v1.0 is genuinely working)

| Step | Channel | Notes |
|---|---|---|
| 1 | Push to GitHub with full README + demo GIF | Repo public only when it actually runs |
| 2 | r/selfhosted, r/node, r/webdev | Lead with the pain it solves, not features |
| 3 | Dev.to / Hashnode article | "I built an open-source WhatsApp automation platform" |
| 4 | Product Hunt | Pick a Tuesday–Thursday; line up early support |
| 5 | Hacker News — Show HN | Honest title, be present in comments all day |
| 6 | YouTube — full setup walkthrough | Evergreen; each video keeps pulling installs |
| Ongoing | Answer Evolution API / Baileys GitHub issues helpfully | Mention WaSphere only when genuinely relevant |

### 16.3 Community from day one

- Discord server with a public roadmap (GitHub Projects).
- Fast PR reviews and friendly issue triage — early contributors decide whether a project
  gains momentum.
- A short, honest disclaimer in the README: WaSphere is for legitimate customer
  communication; users must comply with WhatsApp's Business Policy and not spam.

> Reality check on stars: a cold launch with no existing audience getting 500 stars in
> month one is rare. 50–150 is a good month-one outcome. The metric that matters is how
> many people deploy it and come back with issues.

---

## 17. Future Roadmap (v3+ — Exploratory, NOT Committed)

This section exists so the architecture leaves the door open — **not** as work to plan
now. Do not touch any of this before v2 ships.

| Idea | Why it fits | Why it waits |
|---|---|---|
| Omnichannel: Telegram, Instagram DM, Facebook Messenger | The `WhatsAppAdapter` pattern generalises to a `ChannelAdapter` — same dashboard, more channels | Each channel is a new engine + API surface; only worth it once WaSphere has real WhatsApp users |
| Official WhatsApp Cloud API support as an alternative engine | Removes ban/breakage risk for businesses that can afford it; same REST surface via the adapter | Different pricing and approval model; a separate engine implementation |
| Standalone n8n community node package | Published to the n8n registry so n8n users find WaSphere natively | Small effort, but pointless before there is an audience to find it |
| Mobile app for the dashboard | Manage accounts and inbox on the go | The responsive web dashboard already covers this for v1/v2 |
| Marketplace for automation templates | Users share/sell ready-made flows | Needs a large automation-builder user base first |

The single principle: the **adapter architecture** (Section 2.2) is what makes all of this
possible later without a rewrite. Build v1 and v2 well, and v3 stays an option — not a
rebuild.

---

*WaSphere — Built different. MIT Core. Pro Power.*
*v1 earns the stars. v2 earns the revenue. Ship v1 first.*
