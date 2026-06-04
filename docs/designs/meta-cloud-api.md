# Design: Meta Cloud API + Provider Abstraction (v1.2)

**Status:** Draft — awaiting maintainer approval
**Target release:** v1.2 "Reliability & Trust"
**Scope:** OSS Core (MIT). Intelligent routing / cost optimization / use-case profiles are **out** of this doc — those live in WaSphere Pro (closed). This doc designs the *foundation* they build on.

---

## 1. Strategic context

Today WaSphere speaks WhatsApp through one engine: **Baileys** (the unofficial web-protocol library, GPLv3, isolated in `baileys.adapter.ts`). It's free and powerful, but it carries **ban risk** and is unofficial.

The **Meta WhatsApp Cloud API** is the *official* channel: no ban risk for compliant use, but it's paid-per-conversation, template-gated outside a 24-hour window, and far more limited (no groups, no presence, no arbitrary polls).

The competitive landscape (README-level study only — no source inspection of AGPL/unclear-licensed projects):

| Project | Providers | License | Gap we exploit |
| --- | --- | --- | --- |
| whatsapp-web.js (~16k★) | Baileys-style only | — | unofficial-only |
| Whatomate (~1k★) | Meta only | AGPL | official-only, license-poisoned |
| Evolution API (~5k★) | both | — | no *clean* unified abstraction |
| WhatFlow / Devsol | — | closed | not self-hostable |

**The v1.2 position:** *the only MIT-licensed, self-hostable WhatsApp platform that runs **both** Baileys and Meta Cloud API behind one clean, extensible provider abstraction.* A developer picks the engine **per session**, the rest of WaSphere (REST API, Inbox, webhooks) doesn't change, and the abstraction leaves room for Twilio/Vonage later.

This also de-risks the product story for the upcoming commercial tier: "Reliable" Shopify customers can run Meta (official) while hobbyists run Baileys — same codebase.

**Non-goals for v1.2 (explicitly Pro / later):** automatic per-message provider selection ("smart routing"), per-template provider intelligence, cost-optimization algorithms, adaptive throttling with pattern variation, recommendation engine, cost-savings dashboards, multi-store. v1.2 ships the *mechanism* (choose a provider, basic failover, see costs) — not the *intelligence*.

---

## 2. The provider abstraction

The existing `IWhatsAppAdapter` (in `whatsapp-adapter.interface.ts`) already abstracts WhatsApp behind ~48 methods, but it assumes a single global implementation (`{ provide: WHATSAPP_ADAPTER, useClass: BaileysAdapter }`) and bakes in Baileys-only capabilities (groups, presence, profile edits). Meta supports maybe a third of those methods. So we **don't** force Meta to implement `IWhatsAppAdapter` — we split it.

### 2.1 `MessageProvider` — the common contract

A narrower interface both engines can honour. Everything outside it is gated by capabilities (§10).

```ts
export interface MessageProvider {
  readonly id: ProviderId;                 // 'baileys' | 'meta'
  readonly capabilities: ProviderCapabilities;

  // ── lifecycle ─────────────────────────────────────────────
  // Baileys: opens a socket + QR. Meta: validates stored creds (no QR/socket).
  init(sessionId: string, creds: ProviderCredentials, cfg: SessionConfig): Promise<SessionInfo>;
  destroy(sessionId: string): Promise<void>;
  status(sessionId: string): SessionStatus;

  // ── outbound (the shared subset) ──────────────────────────
  sendText(sessionId, to, text, opts?): Promise<SendResult>;
  sendMedia(sessionId, to, m: OutboundMedia): Promise<SendResult>;   // image/video/audio/document/sticker
  sendLocation(sessionId, to, loc): Promise<SendResult>;
  sendContact(sessionId, to, card): Promise<SendResult>;
  sendReaction(sessionId, to, messageId, emoji, fromMe): Promise<SendResult>;
  sendInteractive(sessionId, to, i: Interactive): Promise<SendResult>; // buttons/list (maps to Baileys buttons/list OR Meta interactive)
  sendTemplate(sessionId, to, t: TemplateMessage): Promise<SendResult>; // Meta-only; Baileys throws CapabilityError
  markRead(sessionId, messageId): Promise<void>;

  // ── inbound ───────────────────────────────────────────────
  // Both providers normalise inbound into the SAME internal event and hand it
  // to WebhookService.fire(...) — the dashboard/inbox are provider-agnostic.
}
```

Key idea: **the inbound event shape does not change.** Baileys already emits `message.received` / `messages.update` / `session.*`. Meta's webhook receiver (§7) translates Meta payloads into the *same* events. The Inbox, the `poll.vote` work, the `sanitizeMessage` contract — none of it knows or cares which provider produced the event.

### 2.2 The full `IWhatsAppAdapter` stays — for Baileys only

Groups, presence, profile editing, `checkNumber`, etc. remain on the Baileys path. The `MessagesController` / `SessionsController` resolve the provider for a session and:
- common methods → `MessageProvider`
- Baileys-only methods → only available when the session's provider is Baileys; calling them on a Meta session returns **`501 Not Implemented`** with `{ error, capability }`.

### 2.3 Resolution: `ProviderRegistry`

```ts
@Injectable()
export class ProviderRegistry {
  constructor(private baileys: BaileysProvider, private meta: MetaCloudProvider) {}
  for(sessionId: string): MessageProvider { /* look up session.provider, default 'baileys' */ }
  get(id: ProviderId): MessageProvider { return id === 'meta' ? this.meta : this.baileys }
}
```

`MessagesService` / `SessionsService` go from calling `this.adapter.x()` to `this.registry.for(sessionId).x()`. That's the central seam of the refactor.

---

## 3. BaileysProvider refactor

`BaileysAdapter` already *is* the Baileys provider — we wrap, not rewrite:

1. Implement `MessageProvider` on a thin `BaileysProvider` that **delegates** to the existing `BaileysAdapter` (keep all current behaviour, including the LID/poll-vote/media work).
2. Add `id: 'baileys'` and a static `capabilities` block (everything `true` except `templates`).
3. Map the new shared signatures (`sendMedia`, `sendInteractive`) onto the existing concrete methods (`sendImage`/`sendVideo`/…, `sendButtons`/`sendList`).
4. `sendTemplate` → throws `CapabilityError('templates')`.
5. Inbound is unchanged — `BaileysAdapter` keeps firing the same webhook events.

Risk: **near-zero** — it's an adapter-over-adapter. The 13 inbox integration tests + the build are the guard.

---

## 4. MetaCloudProvider

A **stateless** provider — there is no socket and no QR. A "Meta session" is just stored credentials + a row; "connected" means the credentials validate.

**Send path** (`POST https://graph.facebook.com/{GRAPH_VERSION}/{phoneNumberId}/messages`, `Authorization: Bearer {token}`):

```ts
// sendText
{ messaging_product: 'whatsapp', recipient_type: 'individual', to, type: 'text', text: { body } }
// sendMedia (link form; we pass a URL or upload first to /media for an id)
{ messaging_product:'whatsapp', to, type:'image', image:{ link, caption } }
// sendReaction
{ messaging_product:'whatsapp', to, type:'reaction', reaction:{ message_id, emoji } }
// sendInteractive (buttons)
{ messaging_product:'whatsapp', to, type:'interactive', interactive:{ type:'button', body, action:{ buttons:[...] } } }
// sendTemplate (required outside the 24h window)
{ messaging_product:'whatsapp', to, type:'template', template:{ name, language:{code}, components:[...] } }
```

**Constraints encoded in the provider:**
- **24-hour window.** Free-form messages are only allowed within 24h of the customer's last inbound. Outside it, only `sendTemplate` works. v1.2 surfaces this as a clear error (`OUTSIDE_24H_WINDOW`) — it does **not** auto-switch to a template (that's Pro intelligence).
- **No polls.** Meta has no poll primitive. `sendPoll` on a Meta session → `CapabilityError('polls')`. (Order-confirmation on Meta uses interactive buttons; the Inbox already renders both — a v1.2-polish item.)
- **Status replies** ("sent/delivered/read/failed") arrive via webhook, not inline — mapped to our existing `message.delivered`/`read`/`failed` events.

**`init`** validates creds by calling `GET /{phoneNumberId}?fields=verified_name` and stores `status: 'connected'` (or `failed` with the Meta error). No retries/sockets.

---

## 5. Per-session provider config

`SessionConfig` (today: delays + read/receive flags) gains:

```ts
provider: 'baileys' | 'meta';          // default 'baileys'
fallbackProvider?: 'baileys' | 'meta'; // optional, for §11
```

Session creation (`POST /api/sessions`) accepts `provider` + the provider-specific credential block. For Baileys nothing changes (QR flow). For Meta, the body carries the credential set (§8) instead of triggering a QR.

The dashboard-api side stores `provider` on its session/workspace records so the Inbox `sessionId → provider` is known there too (used for "this is a Meta number" badges and to hide poll-send on Meta sessions).

---

## 6. Setup wizard UI

Sessions page → **"Add session"** → first step is a **provider radio**: *Baileys (unofficial, free, QR scan)* vs *Meta Cloud API (official, paid, no ban risk)* — each with a one-line trade-off.

- **Baileys** → existing QR flow, unchanged.
- **Meta** → a 4-field form: **Phone Number ID**, **Permanent Access Token**, **WhatsApp Business Account ID**, **Webhook Verify Token** (a value the operator chooses; we echo it during Meta's verification handshake). A "Test connection" button calls `init` and shows verified name / error. A copy-paste **Callback URL** (`https://<host>/api/meta/webhook/<sessionId>`) the operator pastes into their Meta app config.

The wizard links to Meta's official setup docs. No secrets are ever shown back after save.

---

## 7. Meta webhook receiver

A **new public** controller (`/api/meta/webhook/:sessionId`) — separate from the existing dashboard-callback registration:

- **GET** (verification): Meta calls with `hub.mode=subscribe`, `hub.verify_token`, `hub.challenge`. We compare `hub.verify_token` against the session's stored verify token (timing-safe) and echo `hub.challenge` on match, else `403`.
- **POST** (events): verify `X-Hub-Signature-256` = `HMAC-SHA256(appSecret, rawBody)` (we already preserve `rawBody`; reuse that). Parse `entry[].changes[].value`:
  - `value.messages[]` → normalise to our `message.received` event (text/media/interactive-reply/reaction), resolve the contact from `value.contacts[]`, download media via `GET /{mediaId}` when needed → reuse the Inbox media path.
  - `value.statuses[]` → map `sent/delivered/read/failed` to `message.delivered`/`message.read`/`message.failed`.
- Fire the **same** internal events as Baileys → the Inbox is untouched.

This means inbound Meta messages flow into the Inbox identically to Baileys ones.

---

## 8. Credential storage

Reuse the existing **AES-256-GCM** at-rest encryption (the same path that already encrypts WA Server tokens via `ENCRYPTION_KEY`). Meta credentials are a JSON blob:

```ts
{ phoneNumberId, accessToken, wabaId, verifyToken, appSecret? }
```

stored encrypted on the session/workspace record. The `accessToken` and `appSecret` are the sensitive fields. Decryption happens only inside the provider at send/verify time. No new crypto — we extend the existing column/pattern.

---

## 9. Message-type mapping (Baileys ↔ Meta)

| WaSphere type | Baileys | Meta Cloud API |
| --- | --- | --- |
| text | `conversation` | `type:text` |
| image/video/audio/document/sticker | media message | `type:image\|video\|audio\|document\|sticker` (link or uploaded id) |
| location | `locationMessage` | `type:location` |
| contact | `contactMessage` | `type:contacts` |
| reaction | `react` | `type:reaction` (+ `context.message_id`) |
| buttons / list | `buttonsMessage` / `listMessage` | `type:interactive` (button/list) |
| **poll** | `pollCreationMessage` | ❌ not supported → `CapabilityError`; use interactive buttons |
| **template** | ❌ | `type:template` (required outside 24h) |
| view-once, GIF | supported | ❌ → CapabilityError |
| groups/presence/profile | supported | ❌ → 501 |

The mapping lives in `MetaCloudProvider` (outbound) and the webhook receiver (inbound). This table is the contract for the implementation PRs.

---

## 10. Capabilities system

```ts
export interface ProviderCapabilities {
  groups: boolean; presence: boolean; profileEdit: boolean;
  polls: boolean; templates: boolean; interactiveButtons: boolean;
  reactions: boolean; viewOnce: boolean; mediaUpload: boolean;
  freeformAlways: boolean;   // Baileys true; Meta false (24h window)
}
```

Two uses:
1. **Guard rails** — controllers reject unsupported operations early with a typed error (`{ error, capability, provider }`) instead of a deep failure.
2. **Introspection** — `GET /api/sessions/:id/capabilities` so the UI can hide/disable unsupported actions (e.g. hide the Poll button on a Meta session). This is the clean extension point Pro's smart-routing reads later.

---

## 11. Basic auto-failover (session-level, mechanism only)

v1.2 ships *mechanism*, not *intelligence*. If a session sets `fallbackProvider`, and a send through the primary provider fails with a **retryable** error (transport / 5xx / Baileys disconnected), the send is retried **once** through the fallback provider, and the result records `via: 'fallback'`. Rules:

- Failover is **opt-in** per session (`fallbackProvider`), off by default.
- Only **send** failover in v1.2 (not inbound).
- Capability mismatch is respected — a poll can't fail over to Meta; it just fails with `CapabilityError`.
- Each provider is health-tracked (`§ status`) so we don't hammer a known-down primary.

The *decision* of "which provider should this message use" beyond this simple primary→fallback is **Pro** (smart routing). v1.2 is deliberately dumb here.

---

## 12. Simple throttling (transparent, configurable)

Baileys already has per-session random send delays (anti-ban). Generalise to a per-session, per-provider token-bucket rate limit:

- `maxPerSecond` / `maxPerMinute` config per session (sensible defaults; Meta has its own tier limits we respect).
- Transparent: surfaced in the session config + docs, no hidden "pattern variation" (that adaptive behaviour is Pro).
- Reuses the existing delay machinery; adds a small bucket in front of the provider send.

---

## 13. Migration plan (from current code)

No breaking changes to the public REST API or the Inbox. The refactor is internal:

1. Introduce `MessageProvider` + `ProviderCapabilities` + `ProviderId` types (no behaviour change).
2. Wrap `BaileysAdapter` in `BaileysProvider` implementing `MessageProvider`; add `ProviderRegistry` (default everything to Baileys → identical behaviour).
3. Switch `MessagesService`/`SessionsService` from `WHATSAPP_ADAPTER` to `ProviderRegistry.for(sessionId)` for the shared methods; keep Baileys-only methods routed to the Baileys path.
4. Add `provider` to `SessionConfig` + session create (still defaults to Baileys).
5. Build `MetaCloudProvider` (send) + the Meta webhook receiver (inbound) behind a feature flag (`META_PROVIDER_ENABLED`).
6. Setup wizard UI + capabilities introspection + cost surfacing.
7. Basic failover + throttling.

Every step keeps `pnpm build` green and the 13 inbox tests passing; existing Baileys users are unaffected at each step.

---

## 14. PR plan (6–8 mergeable commits)

1. **types + capabilities** — `MessageProvider`, `ProviderCapabilities`, `ProviderId`, `CapabilityError`. Pure additions.
2. **BaileysProvider + ProviderRegistry** — wrap existing adapter; wire `MessagesService` to the registry; default Baileys. (Behaviour-identical; tests green.)
3. **session provider config** — `provider`/`fallbackProvider` on `SessionConfig` + session create + dashboard-api session record.
4. **MetaCloudProvider — send path** — text/media/location/contact/reaction/interactive/template + message mapping + 24h-window error, behind `META_PROVIDER_ENABLED`.
5. **Meta webhook receiver** — verify handshake + signature + inbound→internal-event normalisation + status mapping + media download.
6. **capabilities API + setup wizard UI** — provider radio, Meta cred form, test-connection, callback URL, capability-gated UI.
7. **basic failover + throttling** — opt-in `fallbackProvider`, token bucket, `via` on results.
8. **docs + tests** — Meta provider integration tests (mock the Graph HTTP boundary — *not* WhatsApp behaviour; that rule is about not mocking Baileys), README/CHANGELOG, env docs.

Each PR is independently reviewable + revertible; 1–3 ship the abstraction with zero user-visible change, 4–8 add Meta incrementally.

---

## 15. Decisions (maintainer-approved 2026-06-05)

1. **Failover framing — provider/number failover.** Same-number failover is impossible (Meta and Baileys are different registrations). Failover = "send via a *different* configured session (different number)." UI copy: *"Configure a backup session (different number) for automatic failover."* Documented to prevent unrealistic expectations.
2. **App Secret — required in production.** `X-Hub-Signature-256` verification is mandatory in prod. A dev-only **"unverified mode"** is allowed with explicit warnings, **blocked when `NODE_ENV=production`**, and a warning logged on every unverified webhook receipt.
3. **Media — link mode first.** v1.2 default is **public link**; a `mediaUploadMode` config flag is added (`'link'` default, `'upload'` reserved for v1.3). The trade-off is documented in the setup wizard.
4. **Cost surfacing — simple counter only.** Per-session/day message count from Meta status webhooks + a monthly estimate using Meta's published rates, with a clear **"Estimate only"** disclaimer and a link to Meta Business Manager. **No** optimization / savings calculator (those are Pro).
5. **Templates — read-only list + send.** v1.2 ships the `sendTemplate` path, a **read-only** list of approved templates (Business Management API), and template metadata in responses. Create/edit/approval UX is **v1.3**.
6. **Feature flag — off in v1.2.0.** Ship `META_PROVIDER_ENABLED=false` (opt-in for early adopters), soak 1–2 weeks, flip default to `true` in **v1.2.1**. Existing deployments are unaffected (sessions default to Baileys).
7. **Confirmations on Meta — auto-suggest buttons.** On Meta sessions the composer **disables "Send poll"** (tooltip) and **recommends "Send buttons"** for confirmation flows, with an inline suggestion. Documented as the Shopify-on-Meta foundation.
8. **Graph API version — pin `v22.0`.** `GRAPH_VERSION` env var (default `v22.0`, configurable per deployment). Document Meta's deprecation schedule; plan version bumps ~every 6 months; CI tests against the last 2 versions.

---

## 16. Testing discipline

- **Real PostgreSQL** (Docker) — no DB mocks. The 13 existing inbox integration tests stay green throughout.
- **Baileys** — real test WhatsApp number (existing).
- **Meta** — a real Meta Business test account for end-to-end; in integration tests, **mock only the Graph HTTP boundary** (not WhatsApp behaviour — the no-mock rule is about Baileys, not an HTTP API we call).

---

*Approved — implementation follows the §14 PR plan: branch per commit-group, CI green, no merge to main without maintainer sign-off. Estimated 3–4 weeks across the 8 PRs; PRs 1–3 (the abstraction) are the load-bearing ones.*
