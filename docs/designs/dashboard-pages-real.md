# WaSphere Dashboard — Phase 13: Wake Up the Dashboard

**Status**: Phases 13.1–13.7 COMPLETE (committed). Scope adjusted for v1.0 — see below.
**Branch for implementation**: `feature/dashboard-pages-real`
**Preceding work**: `feature/design-system` (parked, never connected to real APIs).

### v1.0 scope (final)
- **Prerequisite PR** (`feature/v1-11-session-settings`): per-session config (random delay, auto-read, receive toggle) — must merge before Settings anti-ban section wired.
- **Phase 13.4-EXPAND**: Message Tester covering all 14 wa-server message types + WApp Pro-style response panel.
- **Phase 13.7-EXPAND**: Settings page gains "Anti-Ban Controls" subsection wired to PATCH /api/sessions/:id/config.
- **Phase 13.8**: Smoke test (15-step manual flow against live stack) — non-negotiable before QA pipeline.

### Deferred to v1.1
- Inbox page (`/dashboard/inbox`) — chat list + message bubbles + compose box.
- Prerequisite PR C (`feature/v1-10-message-history`) — Postgres message log.
- Baileys history sync (see post-launch-polish.md — WhatsApp controls sync window, not Baileys).
- Reaction picker, poll voting tally, native file upload, read receipt UI, typing indicators.

---

## Prerequisite PRs (run before Phase 13 frontend)

Two small backend additions are required before the frontend implementer starts touching the Webhooks and Developer pages. Both follow the standard pipeline (architect → engineer → QA → security → Approval #2).

### A. `feature/wa-server-webhook-get` — **MERGED** `04d242d`

Add `GET /api/webhooks/callback` to wa-server.

- Returns `{ url: string | null }` — null if no callback URL has been set.
- Auth required via `X-Api-Token` header (same as all other wa-server endpoints).
- QA: 7/7 PASS. Security: 0 CRITICAL, 0 HIGH.

### B. `feature/dashboard-api-audit-logs` — **MERGED** `60ef084`

Add `GET /workspaces/:id/audit-logs` to dashboard-api.

- Workspace member auth check, pagination, filters (from/to/sessionId/statusCode).
- Response: `{ items: AuditLog[], total: number, page: number, pageSize: number }`.
- QA: 12/12 PASS. Security: 0 CRITICAL, 0 HIGH.

### C. `feature/v1-10-message-history` — **DEFERRED TO v1.1**

Postgres-backed message log (wa-server fires POST to dashboard-api, persists to `messages_log`). Required for Inbox. See `docs/post-launch-polish.md` for full spec and Baileys history sync limitation note.

### D. `feature/v1-11-session-settings` — **PENDING** (must merge before Phase 13.4-EXPAND + 13.7-EXPAND)

Add per-session config persistence and enforcement to wa-server. Standard pipeline: architect → engineer → QA → security → Approval #2.

#### Per-session config schema

Persisted to `sessions/<id>/config.json` alongside `proxy.json`. Same symlink-rejection pattern applied at read.

```typescript
interface SessionConfig {
  random_delay_min_ms: number  // default 0, max 60000
  random_delay_max_ms: number  // default 0, max 60000
  auto_read_on_receive: boolean // default false
  receive_enabled: boolean      // default true
}
```

Validation: when both values > 0, `random_delay_max_ms >= random_delay_min_ms`. Either can be 0 (delay disabled). Max cap 60000ms.

#### CreateSessionDto extensions

```typescript
@IsOptional() @IsInt() @Min(0) @Max(60000)
random_delay_min_ms?: number = 0;

@IsOptional() @IsInt() @Min(0) @Max(60000)
random_delay_max_ms?: number = 0;

@IsOptional() @IsBoolean()
auto_read_on_receive?: boolean = false;

@IsOptional() @IsBoolean()
receive_enabled?: boolean = true;
```

Cross-field validation: `@ValidateIf(o => o.random_delay_min_ms > 0 && o.random_delay_max_ms > 0)` — max must be >= min.

#### SessionInfo interface additions

`GET /api/sessions/:id` response adds:
```typescript
config: {
  random_delay_min_ms: number
  random_delay_max_ms: number
  auto_read_on_receive: boolean
  receive_enabled: boolean
}
```

#### Enforcement in `baileys.adapter.ts`

**Random delay** — applied AFTER rate limiter (rate limit is upper bound; delay adds spacing; both stack safely):
```typescript
// Inside every outbound send method, after rate limit check:
const { random_delay_min_ms, random_delay_max_ms } = config;
if (random_delay_max_ms > 0) {
  const delay = Math.floor(Math.random() * (random_delay_max_ms - random_delay_min_ms)) + random_delay_min_ms;
  await new Promise(r => setTimeout(r, delay));
}
```

**auto_read_on_receive** — in `messages.upsert` handler, inbound messages only:
```typescript
if (config.auto_read_on_receive && !msg.key.fromMe) {
  await sock.readMessages([msg.key]);
}
```

**receive_enabled** — in `messages.upsert` handler, return early before webhook fire (Baileys internal store still updates):
```typescript
if (!config.receive_enabled) return;
// ... proceed to fire webhook
```

#### New endpoint: `PATCH /api/sessions/:id/config`

Body: partial `SessionConfig` (same validation as CreateSessionDto fields). Persists merged config to `config.json`. Hot-applies to running session — no restart. Fires `session.config_updated` webhook event with `{ sessionId, config }`.

#### QA test matrix for Prerequisite PR D

1. Create session with `random_delay_min_ms: 2000, random_delay_max_ms: 5000` → send 3 messages → verify timestamps show 2–5 second gaps
2. `PATCH /api/sessions/:id/config` with `auto_read_on_receive: true` → receive simulated inbound → verify `sock.readMessages` called (no restart needed)
3. `PATCH /api/sessions/:id/config` with `receive_enabled: false` → send inbound → verify webhook NOT fired
4. `PATCH` hot-apply → next message uses new config with no session restart
5. Validation: `random_delay_min_ms: 5000, random_delay_max_ms: 1000` → 400
6. Validation: `random_delay_max_ms: 70000` → 400
7. Symlink `config.json` → warning logged, symlink rejected, default config used
8. `GET /api/sessions/:id` → response includes `config` object with current values
9. Session created without config fields → defaults applied (0, 0, false, true)

---

## 1. Rebase Strategy

### What predates what

`feature/design-system` diverged from main at commit `82605f9` (tighten git rules in CLAUDE.md).
At that point, the dashboard-api did not exist. The following 11 commits landed on main after the branch point:

```
ba8ba79  feat: Postgres + Prisma foundation for dashboard-api
e9db358  feat(dashboard-api): NestJS 10 foundation with auth, workspaces, proxy
f30ee16  feat: Swagger / OpenAPI 3.0 docs
3492d82  feat: liveness and readiness probes
dc57d17  feat: HMAC-SHA256 webhook signing
735d1bc  feat: wa-server audit log middleware → dashboard-api
93311d9  fix(audit): native http/https for internal delivery
84be223  feat: per-session rate limiting
f75298c  feat: bulk messaging
e476845  feat(session): QR expiry, failed status, max session limits
4c6c2d5  feat(proxy): per-session HTTP/HTTPS/SOCKS5 proxy support
```

`feature/design-system` has exactly 4 commits on top of the divergence point. None touch `packages/dashboard-api/` or `packages/wa-server/`. Only `packages/dashboard-ui/` and `CLAUDE.md` are touched.

### Rebase approach

Do NOT squash the design-system commits. Preserve them individually so git history shows the UI foundation clearly separate from the real API wiring.

The rebase is expected to be clean. The design-system commits touch only `packages/dashboard-ui/` while all 11 main commits touch only `packages/dashboard-api/`, `packages/wa-server/`, and root config. One likely conflict: `CLAUDE.md`. Resolve by keeping the main version of the git rules section and reinserting the Active Branches table at the bottom.

### Commands to create the working branch

```bash
# 1. Bring local main current
git checkout main
git pull origin main

# 2. Rebase design-system onto main locally — do NOT push design-system
git checkout feature/design-system
git rebase main
# If CLAUDE.md conflicts: keep main's git rules, reinsert Active Branches table
# git add CLAUDE.md && git rebase --continue

# 3. Create the implementation branch from the rebased state
git checkout -b feature/dashboard-pages-real

# 4. Push
git push -u origin feature/dashboard-pages-real
```

`feature/design-system` is only updated locally during the rebase; do not push it. The origin copy stays parked and untouched per CLAUDE.md rules.

---

## 2. Mock Data Removal

No `lib/mock-data.ts` file exists. All six pages currently render only placeholder headings. The only hardcoded content is in two files:

| File | Hardcoded content | Action |
|---|---|---|
| `packages/dashboard-ui/components/layout/app-header.tsx` | Avatar fallback `"WA"`, name `"Waqas Ahmed Waseer"`, email in dropdown | Replace with data from auth context (`user.name`, `user.email`) |
| `packages/dashboard-ui/app/login/page.tsx` | Founder name/email in brand panel right side | Replace with generic copy — see Section 3 |

**No "Mock Data Mode" badge exists** in the codebase. The `<Badge>` in `app-header.tsx` is a version badge — keep it.

### Login page brand panel replacement copy

Replace the founder testimonial block with:

```
"Self-hosted WhatsApp automation for hosting providers and developers"

WaSphere — Built on Baileys. MIT Core, Pro layer.
```

No name. No email. Static copy, no env var needed.

---

## 3. Auth Flow

### Token storage: httpOnly cookie via Next.js Route Handlers

Use httpOnly cookies, not localStorage. Cookies are not accessible from JS — XSS-safe.

**Dashboard-api requires zero changes.** It already returns `{ accessToken, refreshToken, user }` as JSON from `POST /auth/login`. The Next.js Route Handlers are new code in `dashboard-ui` only. The browser never directly sees the tokens — a Next.js Route Handler intermediates the login call, receives the JSON, and sets httpOnly cookies server-side via `Set-Cookie` headers before redirecting.

All auth logic lives in `packages/dashboard-ui/lib/api.ts`. This file exports:

- `apiFetch(path, options)` — authenticated fetch wrapper. Attaches `Authorization: Bearer <token>` (token read from cookie via server context or React context) on all dashboard-api calls.
- `refreshAccessToken()` — calls `POST /auth/refresh` with the refresh cookie, receives a new access token, updates cookie via Route Handler at `/api/auth/refresh`.
- `logout()` — calls `POST /auth/logout`, clears both cookies, calls `router.push('/login?reason=logout')`.

### Login flow

```
User submits login form
  → POST /api/auth/login  (Next.js Route Handler — server-side)
    → POST http://dashboard-api:3000/auth/login  { email, password }
    ← 200 { accessToken, refreshToken, user }
  → Set-Cookie: wa_access=<JWT>; HttpOnly; Secure; SameSite=Lax; Max-Age=900
  → Set-Cookie: wa_refresh=<token>; HttpOnly; Secure; SameSite=Lax; Max-Age=604800
  → redirect to /dashboard/overview
```

### Login page — ?reason= query param

The login page reads a `reason` query param and shows a small notice above the form:

| `?reason=` | Notice shown |
|---|---|
| `expired` | "Your session has expired. Please log in again." |
| `logout` | "You have been logged out." |
| *(absent)* | No notice |

Wired in `lib/api.ts`:
- `logout()` → `router.push('/login?reason=logout')`
- 401-after-refresh-fail → `router.push('/login?reason=expired')`

### 401 handling mid-session

`apiFetch` intercepts every 401 before the component sees it:
1. Calls `refreshAccessToken()` once.
2. If refresh succeeds: retries original request transparently.
3. If refresh returns 401 (expired / revoked / reuse detected): calls `logout()` → redirects to `/login?reason=expired`.

No page component handles 401 directly.

### Auth context

`app/dashboard/layout.tsx` wraps children in `<AuthProvider>`. On mount it calls the Route Handler `GET /api/auth/me` (reads access token cookie server-side, returns `{ userId, email, name }`). Result stored in React context so `app-header.tsx` renders the real user name and initials instead of the hardcoded values.

---

## 4. The Six Pages

Routes confirmed from `app/dashboard/` directory:

1. `/dashboard/overview`
2. `/dashboard/sessions`
3. `/dashboard/messages`
4. `/dashboard/webhooks`
5. `/dashboard/developer`
6. `/dashboard/settings`

All six live under `app/dashboard/layout.tsx` (sidebar + header shell).

---

### Page 1 — Overview (`/dashboard/overview`)

**Purpose**: Stats summary for the active workspace.

**Dashboard-api endpoints:**
- `GET /workspaces` — list workspaces, resolve active workspace ID.
- `GET /workspaces/:id` — workspace detail: name, `waServerConfigured`, `waServerUrl`.

**Wa-server proxy endpoints (via `/workspaces/:id/proxy/*`):**
- `GET sessions` — list all sessions; derive counts by status.
- `GET health` — wa-server health via `GET /workspaces/:id/proxy/api/health` (the full diagnostic endpoint, auth-required — proxy injects `X-Api-Token` automatically). Returns JSON with service status. Use to show "WA Server: Online / Offline" indicator.

**Data rendered:**
- Stat cards: total sessions, connected count, disconnected count, QR-pending count.
- Workspace name and server status (Online / Offline, derived from health fetch success/failure).
- If `waServerConfigured: false`: callout card linking to Settings.

**Data-fetching boundary:** `OverviewPage` (server component). Fetches workspace + session list on server. Passes data as props to client component `<OverviewStats>`.

---

### Page 2 — Sessions (`/dashboard/sessions`)

**Purpose**: List and manage WhatsApp sessions; create new sessions; QR scan flow.

**Dashboard-api endpoints:**
- `GET /workspaces` — resolve active workspace ID.

**Wa-server proxy endpoints (via `/workspaces/:id/proxy/*`):**
- `GET sessions` — list with `status`, `phoneNumber`, `name`, `connectedAt`, `proxy`.
- `POST sessions` — create; body `{ id: string, proxy?: string }`.
- `DELETE sessions/:sessionId` — delete.
- `POST sessions/:sessionId/logout` — logout (keep record, clear credentials).
- `GET sessions/:sessionId` — poll for QR code and status.

**Data rendered:**
- Table: session ID, phone number, status badge, connected-at, proxy (if set), actions (logout / delete).
- "New Session" button → dialog with session ID input + optional proxy URL input → POST → QR polling state.
- `<QrDialog>`: renders base64 `qrCode` as `<img>`, countdown from `qrExpiresAt`, auto-closes on `connected`.

**Data-fetching boundary:** `SessionsPage` (server component, initial list). `<SessionsTable>` (client, mutations). `<QrDialog>` (client, polling loop — see Section 5).

---

### Page 3 — Message Tester (`/dashboard/messages`) — EXPANDED

**Status**: Basic version (text + image + bulk) committed in Phase 13.4. Full 14-type expansion is Phase 13.4b — requires reading WApp Pro reference files first.

**Purpose**: Full message tester covering all 14 wa-server message type endpoints. Replaces the basic Phase 13.4 implementation.

**Dashboard-api endpoints:**
- `GET /workspaces` — resolve active workspace ID.

**Wa-server proxy endpoints (via `/workspaces/:id/proxy/*`):**
- `GET sessions` — populate session selector (only `connected` sessions selectable).
- `POST sessions/:sessionId/messages/text`
- `POST sessions/:sessionId/messages/image`
- `POST sessions/:sessionId/messages/video`
- `POST sessions/:sessionId/messages/audio`
- `POST sessions/:sessionId/messages/document`
- `POST sessions/:sessionId/messages/sticker`
- `POST sessions/:sessionId/messages/location`
- `POST sessions/:sessionId/messages/contact`
- `POST sessions/:sessionId/messages/buttons`
- `POST sessions/:sessionId/messages/list`
- `POST sessions/:sessionId/messages/poll`
- `POST sessions/:sessionId/messages/reaction`
- `POST sessions/:sessionId/messages/gif`
- `POST sessions/:sessionId/messages/view-once`
- `POST bulk/send-text` — start bulk job.
- `GET bulk/jobs/:jobId` — poll job status every 3s.

**UI structure:**

```
┌─────────────────────────────────────────────────────────────┐
│ Session selector (connected only)                           │
├───────────────────────────┬─────────────────────────────────┤
│ Single Message │ Bulk     │  (top-level tabs)               │
├───────────────────────────┴─────────────────────────────────┤
│ SINGLE TAB:                                                 │
│  Recipient type: [Personal] [Group]                         │
│  Recipient input: phone (E.164) or group JID                │
│  Message type selector (visual button group):               │
│    Text  Image  Video  Audio  Document  Sticker             │
│    Location  Contact  Buttons  List  Poll  Reaction         │
│    GIF  View Once                                           │
│  ─────────────────── │ ─────────────────────────            │
│  FORM (left ~60%)    │ RESPONSE PANEL (right ~40%)         │
│  (matches wa-server  │ Status code (color-coded)           │
│   DTO exactly)       │ Timestamp                           │
│                      │ Message ID (copy button)            │
│  [Send Message]      │ JSON pretty-print (copy button)     │
└──────────────────────┴─────────────────────────────────────┘
```

**Message type forms** (left panel, matches wa-server DTO):

| Type | Fields |
|------|--------|
| Text | `text` (textarea) |
| Image | `imageUrl` (URL input), `caption` (optional textarea) |
| Video | `videoUrl` (URL input), `caption` (optional textarea) |
| Audio | `audioUrl` (URL input) |
| Document | `documentUrl` (URL input), `filename` (optional), `caption` (optional) |
| Sticker | `stickerUrl` (URL input) |
| Location | `latitude` (number), `longitude` (number), `name` (optional) |
| Contact | `contactName`, `contactPhone` |
| Buttons | `text`, `buttons[]` (up to 3, each with `buttonId`, `displayText`) |
| List | `title`, `text`, `buttonText`, `sections[]` (title + rows[]) |
| Poll | `pollName`, `pollValues[]` (at least 2), `selectableCount` (1) |
| Reaction | `messageId` (ID of the message to react to), `emoji` |
| GIF | `gifUrl` (URL input), `caption` (optional) |
| View Once | `imageUrl` (URL input) |

**Media types in v1.0**: URL-based only. Native file upload deferred to v1.1 (requires storage backend). Note this visually in the form.

**Response panel** (right side):
- Status code badge: green (2xx), amber (4xx), red (5xx).
- Timestamp.
- `messageId` field (if success) with Copy button.
- Full JSON pretty-printed, monospace, with Copy button.
- Persists across type switches until next send.
- Empty state: "Send a message to see the response."

**Bulk tab** — unchanged from Phase 13.4:
- Session selector (same as Single).
- Recipients textarea (one phone per line).
- Message text.
- Submit → `POST /api/messages/bulk` → poll `GET /api/messages/bulk/:jobId` every 3s.
- Progress: `Sent: X / Total: Y` while running, toast on complete/fail.

**Data-fetching boundary:** `MessagesPage` (server component, connected session list). `<MessagesPanel>` (client, all interactions).

---

### Page 4 — Webhooks (`/dashboard/webhooks`)

**Purpose**: Configure the wa-server callback URL for inbound events.

**Requires Prerequisite PR A** (`GET /api/webhooks/callback` on wa-server) before this page can pre-populate the current URL.

**Dashboard-api endpoints:**
- `GET /workspaces` — resolve active workspace ID.
- `GET /workspaces/:id` — display wa-server URL for context.

**Wa-server proxy endpoints (via `/workspaces/:id/proxy/*`):**
- `GET webhooks/callback` — read current callback URL; returns `{ url: string | null }`. *(Added by Prerequisite PR A.)*
- `POST webhooks/callback` — set callback URL; body `{ url: string }`.

**Data rendered:**
- Current wa-server URL (read-only, from workspace detail).
- Webhook callback URL input — pre-populated from `GET webhooks/callback` (null → empty field).
- Save button → success toast on 201.
- Note: only one callback URL is active at a time; saving replaces the previous.

**Dev-mode host_whitelist behaviour (important for error handling):**
The `SetCallbackDto` on wa-server applies a `host_whitelist` in non-production mode that only accepts `localhost` and `127.0.0.1` URLs. In a local dev environment, saving an external URL (e.g. `https://dashboard.myhost.com/webhook`) will return `400 Bad Request` with `{ "message": ["url must be a URL address"] }`. The UI must handle this explicitly:

- On `400` from `POST webhooks/callback`: parse `responseBody.message` and surface it inline below the URL input — do not show the generic toast error. The validation message is clear and actionable.
- Suggested inline copy: _"Invalid URL. In development mode, only localhost URLs are accepted. Set `NODE_ENV=production` on the WA Server for external URLs."_
- This is the wa-server's behaviour, not a dashboard bug. Document it in the Webhooks page help text as well: a small `<p className="text-muted-foreground text-xs">` note below the input.

**Data-fetching boundary:** `WebhooksPage` (server component, workspace + current URL). `<WebhookForm>` (client, save interaction + 400 error display).

---

### Page 5 — Developer (`/dashboard/developer`)

**Purpose**: API reference and audit log viewer.

**Requires Prerequisite PR B** (`GET /workspaces/:id/audit-logs` on dashboard-api) for the Audit Log tab.

**Dashboard-api endpoints:**
- `GET /workspaces` — resolve active workspace ID.
- `GET /workspaces/:id` — wa-server URL for the Swagger link.
- `GET /workspaces/:id/audit-logs?page=&pageSize=&from=&to=&sessionId=&statusCode=` — paginated audit events. *(Added by Prerequisite PR B.)*

**Wa-server proxy endpoints:** None directly. Page links to `<waServerUrl>/api/docs` (external tab).

**Data rendered:**
- Tabs: "API Reference" / "Audit Log".
- API Reference tab:
  - WA Server URL (read-only).
  - Clickable link to `<waServerUrl>/api/docs` (opens new tab).
  - API Token: show `●●●●●●●● (configured)` with a link: "Manage in Settings →". No token display, no copy button. Token is encrypted at rest and cannot be retrieved.
- Audit Log tab:
  - Paginated table: timestamp, method, endpoint, status code, session ID, IP.
  - Filters: date range, session ID, status code.

**Data-fetching boundary:** `DeveloperPage` (server component, workspace + first audit page). `<AuditLogTable>` (client, pagination + filter interactions).

---

### Page 6 — Settings (`/dashboard/settings`)

**Purpose**: Configure wa-server connection, workspace management, and per-session anti-ban controls.

**Status**: Basic version (WA Server config + workspace name) committed in Phase 13.7. Anti-ban controls section is Phase 13.7-EXPAND — requires Prerequisite PR D merged first.

**Dashboard-api endpoints:**
- `GET /workspaces` — resolve active workspace ID.
- `GET /workspaces/:id` — pre-populate form fields.
- `PATCH /workspaces/:id` — save workspace fields (name, waServerUrl, waServerToken).

**Wa-server proxy endpoints (for anti-ban section):**
- `GET sessions` — populate session selector (all sessions, not just connected).
- `GET sessions/:sessionId` — pre-populate config fields (`config` object from session detail).
- `PATCH sessions/:sessionId/config` — save per-session config. *(Added by Prerequisite PR D.)*

**Route Handlers needed (anti-ban section):**
- `GET /api/settings/session-config?sessionId=` → resolves workspace → calls `GET /workspaces/:id/proxy/sessions/:sessionId` → returns `session.config`
- `PATCH /api/settings/session-config` → receives `{ sessionId, ...configFields }` → calls `PATCH /workspaces/:id/proxy/sessions/:sessionId/config`

**Data rendered:**

*Section 1 — WA Server Configuration* (already committed):
- WA Server URL input (editable).
- WA Server API token input — write-only, show/hide toggle.
- Save button → `PATCH /api/settings/workspace`.

*Section 2 — Workspace Name* (already committed):
- Name input, Save button.

*Section 3 — Anti-Ban Controls* (Phase 13.7-EXPAND, requires Prereq D):
- Session selector dropdown (all sessions — unlike Messages page which filters to connected-only).
- **Random Send Delay**: two number inputs "Min (ms)" / "Max (ms)", range 0–60000. Helper text: "Adds a random delay between min and max before each outbound message. Set both to 0 to disable. Recommended: 2000–5000ms." Validation: max ≥ min when either > 0.
- **Auto-Read on Receive**: toggle switch. Helper text: "Automatically marks inbound messages as read via WhatsApp. Reduces unread count in sender's app."
- **Receive Messages**: toggle switch (inverted label — "Enabled"). Helper text: "When disabled, the bot still connects but ignores incoming messages (webhook not fired). Useful for outbound-only sessions."
- Save button "Save Session Config" → `PATCH /api/settings/session-config`.
- On success: `toast.success("Session config updated.")`.
- On error: inline `<p className="text-xs text-destructive">`.

**Data-fetching boundary:** `SettingsPage` (server component, workspace data). `<SettingsForm>` (client, WA Server config + name). `<SessionConfigForm>` (new client component, anti-ban controls with per-session selector).

---

### Page 7 — Inbox (`/dashboard/inbox`) — DEFERRED TO v1.1

**Status**: Deferred. Requires Prerequisite PR C (`feature/v1-10-message-history`) which is itself deferred. Full spec preserved below for v1.1 implementation. See `docs/post-launch-polish.md` for the Baileys history sync limitation note.

**Purpose**: WhatsApp Web–style inbox showing conversation list and message history. Text-only compose in v1.0.

**Sidebar nav addition**: Add "Inbox" item with a chat-bubble icon, above or below "Messages" in the sidebar.

**Dashboard-api endpoints (via Route Handlers):**
- `GET /workspaces` — resolve workspace ID.
- `GET /workspaces/:id/messages-log/chats?sessionId=` — chat list (distinct JIDs + preview + unread count).
- `GET /workspaces/:id/messages-log?sessionId=&jid=&page=&pageSize=` — message history for active chat.

**Wa-server proxy endpoints:**
- `POST sessions/:sessionId/messages/text` — send text from compose box.

**Route Handlers needed:**
- `GET /api/inbox/chats?sessionId=` → resolves workspace → calls `GET /workspaces/:id/messages-log/chats`
- `GET /api/inbox/messages?sessionId=&jid=&page=&pageSize=` → calls `GET /workspaces/:id/messages-log`
- `POST /api/inbox/send` → receives `{ sessionId, jid, text }` → calls wa-server proxy send-text

**UI structure:**

```
┌──────────────────────────────────────────────────────────────┐
│ HEADER: "Inbox"                                              │
├─────────────────────┬────────────────────────────────────────┤
│ LEFT (320px)        │ MAIN (flex-1)                          │
│                     │                                        │
│ Session selector    │  TOP BAR: contact name + JID           │
│ Search input        │  ─────────────────────────             │
│ [All|Unread|Groups] │  MESSAGE LIST (scrollable)             │
│                     │  • outbound: right, green tint         │
│ ─────────────────   │  • inbound: left, white/card           │
│ Chat row:           │  • timestamp below each bubble         │
│  Avatar (initials)  │  • group: sender name above inbound    │
│  Name               │  • "Load older messages" (paginated)   │
│  Preview + time     │  ─────────────────────────             │
│  Unread badge       │  COMPOSE BOX:                          │
│                     │   [text input] [Send]                  │
│ (scrollable list)   │   📎 → Message Tester  🎤 placeholder  │
└─────────────────────┴────────────────────────────────────────┘
```

**Message bubble rendering by type:**

| Type | Render |
|------|--------|
| text | Text content |
| image / video / sticker / gif | Thumbnail `<img>` from `mediaUrl` |
| audio | `<audio controls>` with `mediaUrl` as src |
| document | File icon + filename + download link to `mediaUrl` |
| location | "📍 lat, lng" text |
| contact | "👤 Contact shared" pill |
| poll | Poll question + options list (read-only) |
| reaction | Small emoji floater on referenced bubble |
| view_once | 🔒 "View-once media (already opened)" |
| unknown | `[Unsupported message type]` in muted text |

**Polling:**
- Active chat messages: every 5s while chat is open.
- Chat list (unread counts): every 10s.
- No SSE/WebSocket in v1.0. v1.1 adds server-sent events.
- Use `isFetching` ref guard on both poll loops.

**Empty states:**
- No session selected: "Select a WhatsApp session to view its inbox."
- Session selected, no chats: "No conversations yet. Messages will appear here as they arrive."

**Sidebar note for v1.0:** A small inline note below the compose box: "📎 For images, video, and documents, use the [Message Tester](/dashboard/messages)." Link opens in same tab.

**Data-fetching boundary:** `InboxPage` (server component, initial connected sessions list). `<InboxPanel>` (client, all chat list / message / compose interactions).

---

## 5. QR Code Flow

### Decision: polling (Option A)

Poll `GET /workspaces/:id/proxy/sessions/:sessionId` every 2 seconds. SSE is not used.

**Justification**: The existing `ProxyService` has a 30-second read timeout and resolves after `proxyRes.on('end')` — incompatible with an SSE stream that never ends. Polling is safe with zero proxy changes. 2s interval × 30 polls = 60s maximum, matching the server-side QR expiry window.

### Component: `<QrDialog>`

Location: `packages/dashboard-ui/components/sessions/qr-dialog.tsx`

Lifecycle:
1. Mounts when `POST sessions` response returns `status: 'connecting'` or `status: 'qr_ready'`.
2. Starts `setInterval(poll, 2000)` on mount; uses an `isFetching` ref to skip overlapping ticks.
3. `status === 'connecting'`: spinner (QR not yet generated).
4. `status === 'qr_ready'`: renders `<img src={session.qrCode} />` + countdown derived from `qrExpiresAt - Date.now()`.
5. `status === 'connected'`: clears interval, success state 1.5s, closes dialog, refreshes session list.
6. `status === 'qr_expired'` or `status === 'failed'`: clears interval, error state + "Retry" button.
7. **Retry path**: "Retry" calls `DELETE sessions/:sessionId` first, then `POST sessions` with the same ID. This is the correct path — wa-server does not allow re-triggering QR on an existing `qr_expired` session without deletion. Document this in a comment inside `<QrDialog>`.
8. Unmount: clears interval unconditionally.

---

## 6. Loading States

`components/ui/skeleton.tsx` exists on the design-system branch. Use `<Skeleton>` for all loading states.

Each page exports a `loading.tsx` sibling (Next.js App Router convention) that renders the skeleton layout while the server component fetch resolves. Client components use a local `isLoading` boolean.

| Page | Skeleton pattern |
|---|---|
| Overview | 4 × `<Skeleton className="h-24 w-full rounded-lg" />` for stat cards; 1 × `<Skeleton className="h-8 w-48" />` for workspace name |
| Sessions | `<Skeleton className="h-10 w-full" />` × 4 for table rows |
| Messages | `<Skeleton className="h-10 w-48" />` for session selector; `<Skeleton className="h-32 w-full" />` for compose area |
| Webhooks | `<Skeleton className="h-10 w-full" />` for URL input |
| Developer | `<Skeleton className="h-8 w-32" />` for tab strip; `<Skeleton className="h-10 w-full" />` × 5 for audit rows |
| Settings | `<Skeleton className="h-10 w-full" />` × 2 for URL and token inputs |

---

## 7. Error States

### Shared components to build

| Component | Location | Purpose |
|---|---|---|
| `<ApiError>` | `components/ui/api-error.tsx` | Inline error message + optional retry button |
| `<EmptyState>` | `components/ui/empty-state.tsx` | Centered icon + message for 404 / no data |

`<Toaster>` from `components/ui/sonner.tsx` already exists. Use `toast.error(message)` for transient errors.

### Per-status behavior for every fetch

| Status | Behavior |
|---|---|
| Network error (fetch throws) | Render `<ApiError message="Could not reach the server." onRetry={refetch} />` inline |
| 401 (expired token) | `apiFetch` intercepts: refresh once → retry; on refresh failure → `router.push('/login?reason=expired')` |
| 403 (forbidden) | Render `<ApiError message="You do not have permission to perform this action." />` inline. No retry. |
| 404 (not found) | Render `<EmptyState message="Not found." />` inline |
| 409 (conflict) | `toast.error(responseBody.message)`. Keep form visible. |
| 422 (unprocessable) | `toast.error(responseBody.message)` |
| `WA_SERVER_UNREACHABLE` (502 from proxy) | `<ApiError message="WA Server is unreachable. Check the server URL in Settings." onRetry={refetch} />` |
| `WA_SERVER_TIMEOUT` (504 from proxy) | `<ApiError message="WA Server timed out." onRetry={refetch} />` |
| 5xx (other) | `toast.error("An unexpected error occurred. Please try again.")` + `<ApiError message="Server error." onRetry={refetch} />` inline |

---

## 8. Implementation Phases — Status

### Completed (committed on `feature/dashboard-pages-real`)

| Phase | Commit | Description |
|-------|--------|-------------|
| 13.1 | `b287f25` | Auth foundation — login, httpOnly cookies, AuthProvider, dashboard guard |
| 13.2 | `0691230` | Shared components + Overview page |
| 13.3 | `2cbf266` | Sessions page + QR dialog |
| 13.4 | `3520f55` | Messages page (basic: text + image + bulk) |
| 13.5 | `85daba0` | Webhooks page |
| 13.6 | `26378c5` | Developer page |
| 13.7 | `26d482a` | Settings page |

### Remaining — v1.0 scope (final)

| Phase | Description | Prerequisite | Status |
|-------|-------------|--------------|--------|
| **Prereq D** | `feature/v1-11-session-settings` backend PR | — | PENDING |
| **13.4-EXPAND** | Message Tester — all 14 types + WApp Pro response panel | Prereq D merged | PENDING |
| **13.7-EXPAND** | Settings — Anti-Ban Controls section | Prereq D merged | PENDING |
| **13.8** | Smoke test — 15-step manual flow against live stack | 13.4-EXPAND + 13.7-EXPAND | PENDING |
| **QA + Security** | qa-tester + security-auditor pipeline | 13.8 PASS | PENDING |
| **Approval #2** | Waqas reviews QA + security report, merges PR | QA + Security PASS | PENDING |
| **Phase 14** | v1.0 tag + launch | PR merged | PENDING |

### Deferred to v1.1

| Item | Description |
|------|-------------|
| Prereq C | `feature/v1-10-message-history` — Postgres message log |
| Page 7 | Inbox — chat list + bubbles + compose box |
| Baileys history sync | WhatsApp controls sync window — see post-launch-polish.md |
| Reaction picker | In-chat emoji reactions |
| Poll voting tally | Live vote count in bubbles |
| Native file upload | Base64 send from compose box |
| Read receipt UI | Double-tick indicators |
| Typing indicators | `sock.sendPresenceUpdate` |

### Execution order for remaining v1.0 work

```
1. DONE — design doc updated (this step)
2. RUN Prereq D pipeline:
   architect → engineer → QA → security → Approval #2 → merge
   STOP and report to Waqas before any frontend code
3. Phase 13.4-EXPAND — Message Tester (all 14 types) on feature/dashboard-pages-real
   COMMIT: "feat(dashboard-ui): Phase 13.4-EXPAND — Message Tester all 14 types + response panel"
4. Phase 13.7-EXPAND — Settings anti-ban controls on feature/dashboard-pages-real
   COMMIT: "feat(dashboard-ui): Phase 13.7-EXPAND — Settings anti-ban controls (delay, auto-read, receive)"
5. Phase 13.8 — Smoke test (15-step manual flow, report PASS/FAIL/WARNING per step)
   Fix inline before QA pipeline
   **Also execute these 3 sub-steps (Prereq D runtime verification — live WA session required):**

   **3a. Random delay verification**
   - PATCH `/api/sessions/<id>/config` → `random_delay_min_ms: 3000, random_delay_max_ms: 6000`
   - Send 3 text messages via Message Tester
   - Check wa-server logs for send timestamps
   - PASS: gaps between sends are 3000–6000 ms

   **3b. Auto-read verification**
   - PATCH config → `auto_read_on_receive: true`
   - From a SECOND phone, send a message to the connected session
   - On sender's phone: verify double blue tick within 5 seconds
   - PASS: read receipt confirmed on sender side

   **3c. Receive-disabled verification**
   - PATCH config → `receive_enabled: false`
   - From second phone, send message to connected session
   - Check webhook receiver logs
   - PASS: NO webhook fired
   - PATCH config → `receive_enabled: true`
   - From second phone, send another message
   - PASS: webhook NOW fires
6. QA pipeline (qa-tester agent) → security audit (security-auditor agent)
7. Approval #2 → merge feature/dashboard-pages-real → Phase 14 (v1.0 tag)
```

---

## 9. Open Questions — RESOLVED

| OQ | Question | Resolution |
|---|---|---|
| OQ-1 | Which health endpoint for Overview? | Use `GET /api/health` (full diagnostic) via proxy. Auth-required is fine — proxy injects `X-Api-Token`. |
| OQ-2 | Message history in v1.0? | **Updated**: Inbox deferred to v1.1. v1.0 is send-only (Message Tester + bulk). Prereq C + Inbox page deferred. |
| OQ-3 | GET webhook URL endpoint missing? | Add `GET /api/webhooks/callback` as Prerequisite PR A before Phase 13 frontend starts. |
| OQ-4 | Login page founder copy? | Remove entirely. Replace with generic brand copy (see Section 2). |
| OQ-5 | Audit log GET endpoint missing? | Add `GET /workspaces/:id/audit-logs` as Prerequisite PR B before Phase 13 frontend starts. |
| OQ-6 | Token display on Developer page? | No. Show `●●●●●●●● (configured)` + "Manage in Settings →" link. |
| OQ-7 | Workspace rename in Settings? | Deferred to v1.1. Show name read-only with a small note. |
| OQ-8 | QR retry path? | DELETE + POST with same session ID. Documented in `<QrDialog>`. |
| OQ-9 | Inbox real-time updates? | Inbox deferred to v1.1. v1.1 will use SSE or WebSocket. |
| OQ-10 | Unread count tracking? | Deferred to v1.1 with Inbox. |
| OQ-11 | Per-session anti-ban settings? | Added to v1.0. Prereq PR D (`feature/v1-11-session-settings`) adds config persistence + enforcement. Settings page gains Anti-Ban Controls section. |
| OQ-12 | Random delay position relative to rate limiter? | AFTER rate limiter. Rate limit is upper bound; delay adds spacing. Both stack safely. |
