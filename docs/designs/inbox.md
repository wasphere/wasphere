# Design: Inbox UI for v1.1

**Status:** Approved with revisions (maintainer review — 2026-06-04). Ready for implementation.
**Author:** WaSphere architect
**Feature:** Two-way conversation Inbox (flagship of v1.1 — "Receive & Observe")
**Phase:** Architecture only. No implementation until this doc is approved.

---

## 1. Problem Statement

### Current state
WaSphere v1.0 is **send-only from the dashboard's perspective**. The WA Server receives inbound WhatsApp messages and fires a `message.received` webhook, but:

- Nothing in the dashboard **persists** those messages — there is no Message, Contact, or Conversation table in `dashboard-api` (the schema today is `User`, `Workspace`, `WorkspaceMember`, `ApiKey`, `Webhook`, `AuditLog`, tokens — nothing for chat data).
- An operator cannot **see** an incoming message unless they wired up their own webhook consumer.
- The existing `/dashboard/messages` page is a **send composer only** — fire-and-forget, no thread, no history.

### Target state
A first-class **Inbox**: a two-pane conversation interface where an operator can read inbound messages, see full threads (in + out), and reply — turning WaSphere from a *send API* into a *two-way platform*.

### Personas & use cases
| Persona | Use case |
| --- | --- |
| **Support agent** | Sees a customer's incoming question, reads the thread, replies inline. |
| **Hosting/WHMCS reseller** | Customer replies to a billing notice; agent answers without leaving the dashboard. |
| **Solo founder** | Single number, occasional replies — wants a simple "WhatsApp web" view they own. |
| **Developer** | Wants the persisted message history queryable via REST for their own tooling. |

---

## 2. Scope Definition

**Inbox must ship in ≤ 2 weeks.** Scope is deliberately ruthless.

### In scope (v1.1 minimum viable)
- Persist inbound **and** outbound messages (text, image, video, audio, document, sticker, location, contact, poll, reaction) per workspace.
- `Contact` + `Conversation` + `Message` data model with a backfill-free migration (greenfield tables).
- Two-pane Inbox UI: conversation list (left) + thread (right) + composer.
- Composer: **text + single image + single document attachment + saved replies (templates)**. *(Document added per maintainer review — PDF receipts/invoices are the highest-frequency attachment after images.)*
- Real-time new-message delivery via **SSE**.
- Search (contact name / phone / message text) + filter (open / resolved) + unread badge.
- Delivery status display (sent / delivered / read) from `message.receipt` events.
- Workspace isolation + audit-log entries for inbox actions.

### Out of scope (deferred)
- AI auto-reply, routing rules, multi-agent assignment/collaboration → **v1.2+**.
- WhatsApp **group** conversations → v1.2 (1:1 only in v1.1).
- Internal notes, conversation export, message edit/delete by admin → v1.2.
- Voice-note playback, full media gallery → v1.2.
- Multi-instance horizontal scaling of the realtime layer → v1.5 (v1.x is single-instance; see §7).
- Analytics / CSAT → v2.0.

---

## 3. Data Model

We introduce a **Conversation entity** (recommended over query-time grouping — it gives a stable id for SSE rooms, unread counts, status, and assignment without recomputing aggregates on every list query).

New Prisma models in `packages/dashboard-api/prisma/schema.prisma`:

```prisma
model Contact {
  id          String   @id @default(cuid())
  workspaceId String
  jid          String  // WhatsApp JID, e.g. 447700900123@s.whatsapp.net
  phone        String  // normalized digits, e.g. 447700900123
  whatsappName String? // auto-updated from WhatsApp pushName on each inbound
  savedName    String? // operator-set; NEVER auto-overwritten
  avatarUrl    String?
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  workspace     Workspace      @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  conversations Conversation[]

  @@unique([workspaceId, jid])
  @@index([workspaceId, phone])
}

enum ConversationStatus { OPEN RESOLVED SNOOZED }

model Conversation {
  id            String             @id @default(cuid())
  workspaceId   String
  contactId     String
  sessionId     String             // which WA session/number owns this thread
  status          ConversationStatus @default(OPEN)
  lastMessageAt   DateTime           @default(now())
  lastPreview     String?            // denormalized snippet for the list
  unreadCount     Int                @default(0)
  tags            String[]           @default([])
  sessionDeletedAt DateTime?         // set when the owning WA session is deleted → read-only archive
  metadata        Json?
  createdAt     DateTime           @default(now())
  updatedAt     DateTime           @updatedAt

  workspace Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  contact   Contact   @relation(fields: [contactId], references: [id], onDelete: Cascade)
  messages  Message[]

  @@unique([workspaceId, sessionId, contactId]) // one thread per (number, contact)
  @@index([workspaceId, status, lastMessageAt(sort: Desc)])
}

enum MessageDirection { INBOUND OUTBOUND }
enum MessageDeliveryStatus { PENDING SENT DELIVERED READ FAILED }

model Message {
  id             String                @id @default(cuid())
  workspaceId    String
  conversationId String
  waMessageId    String                // Baileys message key id
  direction      MessageDirection
  type           String                // text | image | video | poll | reaction | ...
  body           String?               // text / caption
  mediaUrl       String?               // resolved download URL (see §8 media)
  payload        Json?                 // sanitized type-specific data (poll, location, contact, quoted)
  status         MessageDeliveryStatus @default(SENT)
  fromMe         Boolean
  waTimestamp    DateTime
  createdAt      DateTime              @default(now())

  conversation Conversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)

  @@unique([workspaceId, waMessageId])           // idempotent ingestion
  @@index([conversationId, waTimestamp(sort: Desc)])
  @@index([workspaceId, body])                   // search (pg trigram in a later migration)
}
```

**Read tracking:** v1.1 uses `Conversation.unreadCount` (incremented on inbound, zeroed when the agent opens the thread). A per-agent `MessageReadStatus` table is **deferred to v1.2** (when multi-agent lands) — "read by team" is enough now.

**Contact name resolution** (matches WhatsApp's own behaviour): `whatsappName` auto-updates from `pushName` on every inbound; `savedName` is operator-set and never auto-overwritten. **Display priority: `savedName ?? whatsappName ?? phone`.**

**Retention:** v1.1 keeps **all** message history (just-launched deployments have little data; storage is negligible in year one). A configurable `retentionDays` workspace setting (default `null` = forever) plus a pruning job is **deferred to v1.2** — building the config UI + migration now is scope creep.

**Migration strategy:** all tables are **net-new** → a single additive Prisma migration, zero backfill, zero risk to existing data. The only behavioural change in existing code is the ingestion hook (§4) writing rows.

**Indexes** (rationale): conversation-list query is `(workspaceId, status, lastMessageAt desc)`; thread query is `(conversationId, waTimestamp desc)`; idempotency via `@@unique([workspaceId, waMessageId])`; contact lookup by phone via `(workspaceId, phone)`. Full-text search graduates to a Postgres `pg_trgm` GIN index in commit 5.

---

## 4. Event Sourcing & Ingestion

Inbound events already arrive at `POST /internal/webhook-event/:workspaceId` (guarded by the internal secret). The Inbox adds an **ingestion service** that subscribes to this path.

```
WA Server ──message.received / messages.update / message.receipt──▶
  POST /internal/webhook-event/:workspaceId  (dashboard-api, internal-secret guard)
    │
    ├─▶ existing: fan out to user-registered Webhooks
    └─▶ NEW: InboxIngestService.handle(event)
            ├─ upsert Contact (workspaceId, jid)
            ├─ upsert Conversation (workspaceId, sessionId, contactId)
            ├─ insert Message (idempotent on waMessageId)
            ├─ update Conversation.lastMessageAt / lastPreview / unreadCount
            └─ emit('inbox.message', workspaceId, payload)  ──▶ SSE
```

**Conversation creation triggers:**
- First **inbound** message from a contact on a session → create.
- First **outbound** message TO a contact (sent via composer or API) → create.
- No manual creation in v1.1 (out of scope).

**Outbound capture:** when a message is sent (composer or the public proxy `/messages/text` etc.), the dashboard-api records an OUTBOUND `Message`. The composer path is direct; the public-API path emits an internal `message.sent` so externally-sent messages also appear in threads.

**Outbound capture is forward-only.** Messages sent via the public REST API **before** v1.1 shipped were never persisted and cannot be backfilled. A thread that has only inbound messages (no captured outbound) renders a clear empty-ish state explaining the history starts from upgrade. No data loss — just no retroactive view.

**Session deletion handling:** the WA Server owns sessions (there is no Session row in `dashboard-api`). When a session is removed, the WA Server fires `session.deleted`; the ingestion service stamps `Conversation.sessionDeletedAt = now()` on every conversation for that session. Those threads become a **read-only archive** — history stays visible, the composer is disabled, and the thread shows a banner: *"Session deleted — this is a read-only archive."* Conversations are never hard-deleted on session removal (no `onDelete: Cascade` from a session, since sessions aren't a relation here).

**Idempotency / races:** `@@unique([workspaceId, waMessageId])` makes ingestion idempotent (Baileys can redeliver). Simultaneous inbound + outbound are independent inserts; `Conversation.lastMessageAt` uses `max()` semantics in a single transaction to avoid clobbering. Contact/Conversation upserts use `upsert` on the unique keys.

**Multi-session decision (recommended):** **one conversation per (session, contact)**. A contact who messages two different business numbers gets two threads — this matches operator mental models (each number is a different "inbox"). Merging across sessions is rejected for v1.1. *(Open question for maintainer — §12.)*

---

## 5. API Design

REST under the existing workspace-scoped router; realtime via SSE.

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/workspaces/:wid/conversations?status=&cursor=&limit=&q=` | List (cursor-paginated, filterable, searchable) |
| GET | `/workspaces/:wid/conversations/:cid` | Conversation + contact detail |
| GET | `/workspaces/:wid/conversations/:cid/messages?cursor=&limit=` | Thread messages (cursor, newest-first) |
| PATCH | `/workspaces/:wid/conversations/:cid` | Update status / tags |
| POST | `/workspaces/:wid/conversations/:cid/read` | Mark read (zero unreadCount) |
| POST | `/workspaces/:wid/conversations/:cid/messages` | Send reply (text/image) — proxies to WA Server |
| GET | `/workspaces/:wid/inbox/stream` | **SSE** real-time event stream |

- **Pagination:** cursor-based (`?cursor=<messageId|conversationId>&limit=50`) — stable under inserts, O(1) on the indexed sort key. No offset paging.
- **Rate limiting:** composer send reuses the existing per-session rate limiter; SSE connections capped per user.
- **Auth:** REST uses the existing JWT/workspace guard. SSE auth in §7.

SSE event envelope:
```json
{ "type": "message.new", "conversationId": "c_…", "message": { … } }
{ "type": "conversation.update", "conversationId": "c_…", "status": "RESOLVED", "unreadCount": 0 }
{ "type": "message.status", "waMessageId": "…", "status": "READ" }
```

---

## 6. UI / UX Design

> **Design-system mandate (non-negotiable, per maintainer):** the Inbox UI is built **only** from the existing ShadCN component library in `packages/dashboard-ui/components/ui/` and theme tokens. **No bespoke CSS, no hand-rolled modals/overlays, no z-index hacks.** Overlays use `Dialog`/`Sheet` (Radix — accessible, theme-aware, no stacking bugs). This keeps light/dark, focus-trap, and the mobile-sidebar fixes we already shipped working for free.

**Layout — two-pane** (standard, responsive):

```
┌───────────── Inbox (/dashboard/inbox) ─────────────────────────────┐
│ ┌── Conversation list ──┐ ┌──── Thread ────────────┐ ┌─ Contact ─┐ │
│ │ [search input]        │ │ ▢ Acme Co  · online    │ │ avatar    │ │
│ │ [tabs: Open|Resolved] │ │ ───────────────────────│ │ +44 7700… │ │
│ │ ▸ Acme Co     ● 2     │ │   recv bubble          │ │ tags      │ │
│ │ ▸ Jane D.             │ │        sent bubble ✓✓  │ │ recent    │ │
│ │ ▸ +1 212…             │ │   recv bubble          │ │ activity  │ │
│ │   …(cursor scroll)    │ │ ───────────────────────│ │           │ │
│ │                       │ │ [composer: text · 📎 · ⏎]│ │           │ │
│ └───────────────────────┘ └────────────────────────┘ └───────────┘ │
└────────────────────────────────────────────────────────────────────┘
   On mobile: list → Sheet drawer; thread is full-screen; contact in a Sheet.
```

**Component mapping (ShadCN):**
| Element | Component |
| --- | --- |
| Conversation rows | `card` + `avatar` + `badge` (unread) + `status-dot` |
| Search | `input` |
| Open/Resolved/filter | `tabs` + `dropdown-menu` |
| Thread scroll empty/loading | `skeleton` + `empty-state` |
| Message bubble | themed `div` w/ tokens (in/out variants) — **no new primitives** |
| Composer | `textarea` + `button` + `dialog` (image / document picker) |
| Saved replies | `dropdown-menu` |
| Status / tag actions | `dropdown-menu` + `badge` |
| Toasts | `sonner` |
| Mobile list / contact panel | `sheet` |
| Contact sidebar | `card` + `avatar` + `separator` + `badge` |

**Thread features:** paginated history (cursor, infinite-scroll up), sent-vs-received bubble styling via tokens, timestamps + delivery ticks (sent/delivered/read), inline image/document rendering, poll rendering (§8), quoted/reply preview.

**Composer (v1.1):** text + emoji (native), **one image OR one document attachment**, saved replies, send. *(Video/audio + multiple attachments → v1.2.)*

**Composer — session-offline state:** the composer shows a live session-status indicator (`status-dot`). When the owning session is **offline**, the send button is **disabled** with an inline message: *"Session disconnected — reconnect to send."* When **reconnecting**, the indicator shows the reconnecting state and send stays disabled until `connected`. *(A durable server-side send-queue that auto-flushes on reconnect is intentionally **deferred to v1.2** — it adds retry/reliability state beyond the 2-week window. v1.1 keeps it honest: don't accept a send we can't deliver.)*

**Contact sidebar — future "Customer view" (v1.5+, not v1.1):** because conversations are keyed per (session, contact), a single customer who messages two of your numbers has two threads. A later **Customer view** in the contact sidebar will surface *all* conversations sharing that contact's phone number across sessions, with one-click switching — giving the unified view on demand without breaking the per-session isolation model. Noted here so the data model (Contact keyed by `phone`) stays compatible; no v1.1 work.

---

## 7. Realtime Architecture

**Recommendation: Server-Sent Events (SSE), not WebSocket/Socket.io.**

Rationale: WaSphere is **self-hosted, single-instance, no Redis** (deliberately). SSE is one-way server→client (exactly the Inbox need — pushes), rides plain HTTP/1.1 + chunked transfer (sails through nginx/Caddy/Traefik with `proxy_buffering off`), needs **zero new dependencies**, and auto-reconnects natively. WebSocket adds a handshake, a library, and proxy headaches for no v1.1 benefit. (Outbound sends are normal REST, so we don't need client→server over the socket.)

```
Browser  ──EventSource(GET /workspaces/:wid/inbox/stream)──▶ dashboard-api
  ▲                                                              │
  └────────────── text/event-stream (keep-alive) ───────────────┘
   reconnect: native; heartbeat: ": ping\n\n" every 25s
```

- **Connection lifecycle:** auth on connect → subscribe to an in-process `EventEmitter` keyed by `workspaceId` → write events as they arrive → heartbeat comment every 25 s → cleanup on `close`.
- **Auth:** `EventSource` can't set headers, so authenticate via the existing **httpOnly session cookie** (same one the dashboard uses) validated by the JWT guard; the stream is workspace-scoped and membership-checked. (No token in the query string.)
- **Room model:** one logical channel per `workspaceId`; the server only emits a conversation's events to streams whose user has access to that workspace.
- **Connection limits & memory hygiene** (prevents listener leaks): **max 10** concurrent SSE streams per workspace, **max 3** per user (≈ one per tab), **30-min idle timeout** (no events + missed heartbeat → close), and a **5-min sweep** that removes dead/closed listeners from the emitter. Exceeding a cap returns `429` and the client falls back to polling.
- **Scaling:** single-instance in-process emitter for v1.x. Multi-instance (Redis/Postgres `LISTEN/NOTIFY` pub-sub) is **explicitly deferred to v1.5** and noted as a non-goal now.
- **Fallback:** if SSE is blocked, the UI degrades to a 15 s poll of the conversation-list endpoint (feature-flagged, cheap).

---

## 8. Poll-Vote Integration (#54 dependency)

`#54` (`decryptPollVote()`) lands **in parallel** and feeds the Inbox:

- WA Server decrypts `pollUpdateMessage` → emits a `poll.vote` / enriched `messages.update` with the selected option(s).
- Ingestion stores it as a `Message` of `type: "poll_vote"` (or updates the parent poll message's `payload.results`).
- Thread renders the poll as a card: question + options + live tallies; single-select shows the chosen option, multi-select shows all. Uses `card` + `badge` + `progress`-style token bars (no new primitive).
- Votes also fire the existing user-facing webhook so external automations react.

If #54 slips, the Inbox still ships — poll messages render as "📊 Poll: <question>" without tallies, and light up once #54 merges.

---

## 9. Performance Targets

| Operation | Target |
| --- | --- |
| Conversation list (50) | < 200 ms |
| Thread load (50 msgs) | < 300 ms |
| Realtime message latency | < 500 ms |
| Search (10k conversations) | < 500 ms (pg_trgm GIN) |
| Concurrent admin SSE / workspace | 100 |

Achieved via the composite indexes in §3, cursor pagination, denormalized `lastPreview`/`unreadCount` (no per-row aggregation on list), and SSE push (no polling storm).

---

## 10. Security Considerations

- **Workspace isolation / no IDOR:** every query is scoped by `workspaceId` from the membership-checked guard; `:cid`/`:contactId` are validated to belong to the workspace before any read/write.
- **SSE leakage:** events are emitted only to streams whose authenticated user is a member of that workspace; no cross-workspace fan-out.
- **XSS:** message bodies, contact names, and `pushName` are **untrusted** — rendered as text (React escaping) only; no `dangerouslySetInnerHTML`. Link detection is sanitized.
- **File uploads (composer image + document):** **16 MB cap**; allowed types images (`jpg/png/webp`) and documents (`pdf` + common office/text); validated by declared mime **and** magic-byte sniff (reject on mismatch); stored outside web root; images re-encoded where feasible; original filename sanitized.
- **Rate limiting:** composer sends use the existing per-session limiter; SSE connections capped per user.
- **Audit log:** inbox actions (status change, reply sent, tag edit) write `AuditLog` entries (model already exists).

---

## 11. Implementation Plan (6 mergeable commits)

Each commit is deployable on its own — **main is never broken** — tested before merge, reviewed before the next starts.

| # | Commit | Contents |
| --- | --- | --- |
| 1 | **Data model + migration** | Prisma `Contact`/`Conversation`/`Message` + enums + indexes; additive migration; no UI. |
| 2 | **Ingestion + REST API** | `InboxIngestService` hooked into `/internal/webhook-event`; list/get/messages/patch/read/send endpoints; outbound capture. No UI. |
| 3 | **SSE realtime layer** | `GET /inbox/stream`, in-process emitter, cookie auth, heartbeat, reconnect. Verified with `curl`. |
| 4 | **UI shell** | `/dashboard/inbox` two-pane: list + thread + composer (text + image + document), session-offline disabled state, wired to REST + SSE. ShadCN-only. |
| 5 | **Search + filters + status** | search (pg_trgm), Open/Resolved tabs, unread badges, mark-read, tags, saved replies. |
| 6 | **Polish + responsive + tests** | mobile Sheet layout, delivery ticks, poll rendering, empty/skeleton states, e2e against real Postgres + test number. |

All work runs the existing pipeline: `architect → backend-engineer / frontend-engineer / db-migration → qa-tester → security-auditor`. Tests use **real Postgres (Docker) + a real test WhatsApp number** (per CLAUDE.md — no mocks).

---

## 12. Decisions (resolved at maintainer review — 2026-06-04)

| # | Question | Decision |
| --- | --- | --- |
| 1 | Multi-session per contact | ✅ **One conversation per (session, contact).** Unified "Customer view" across a phone number's sessions added as a **v1.5** future enhancement (§6); data model stays compatible (Contact keyed by `phone`). |
| 2 | WhatsApp group conversations | ✅ **Out of v1.1** (1:1 only) → v1.2 (needs a participant model). |
| 3 | Conversation assignment (multi-agent) | ✅ **v1.2.** |
| 4 | Internal notes | ✅ **v1.2.** |
| 5 | Message retention | ✅ **Keep all forever in v1.1.** Configurable `retentionDays` (default `null`) → v1.2 (§3). |
| 6 | Composer media | 🟡 **Modified: text + image + document in v1.1.** Video/audio + multiple attachments → v1.2. |
| 7 | File upload limits | ✅ **16 MB max**; images (`jpg/png/webp`) + documents (`pdf` + common office/text types), mime + magic-byte validated (§10). |
| 8 | Notifications | ✅ **Visual only in v1.1** (unread badge + sound). Browser/desktop + email/push → v1.2. |

**New question surfaced during revision (low-stakes — has a safe default):**
- **New-message sound** — per-user toggle in v1.1, or always-on with a global mute? *Default if unanswered: per-user mute toggle in `localStorage` (no backend needed).*

---

## 13. Non-Goals for v1.1 (set expectations)

AI auto-reply · routing rules · multi-agent collaboration · mobile app · voice-note playback · per-agent read receipts ("read by which agent") · conversation analytics · CSAT surveys · conversation export · message edit/delete by admin · multi-instance realtime scaling · **durable send-queue on reconnect** (v1.2) · **configurable message retention** (v1.2) · **cross-session "Customer view"** (v1.5) · video/audio + multi-attachment composer (v1.2).

---

## 14. Success Metrics (30 days post-launch)

- **80%+** of active deployments open the Inbox within 7 days.
- Median engaged thread **> 5 messages**.
- SSE connection uptime **> 99.5%**.
- **< 10** user-reported Inbox bugs in the first 30 days.

---

*End of design. No code until approved. — architect*
