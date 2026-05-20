# Input & Data Safety Design

Issues: #3 (Path traversal via sessionId) and #5 (Raw Baileys msg in webhook)
Branch: fix/security-hardening-input
Author: Waqas Ahmed Waseer
Date: 2026-05-20
Status: Awaiting approval before implementation

---

## Issue #3 — Path Traversal via sessionId (HIGH)

### Problem Statement

`sessionId` is received from API callers and used directly to build filesystem paths for Baileys session storage. A malicious caller can supply `../../../../etc/passwd` as the sessionId and traverse outside the `./sessions` directory. Because Node.js `path.join` does not sanitise traversal sequences, the resulting path will silently escape the intended root.

The current code has a partial guard: `sessions.controller.ts` applies a `@Matches` decorator on the `CreateSessionDto.id` body field (line 9). However:

1. Route-parameter usages (`@Param('id')` at lines 25, 34, 44) have **no validation** — they pass the raw string straight to the service.
2. Other controllers that accept `sessionId` as a route parameter (`MessagesController`, `GroupsController`, `ContactsController`) have **no sessionId validation at all**.
3. Startup session restore (`restoreAllSessions`, baileys.adapter.ts line 428) reads directory names directly from disk without validating them, meaning a pre-planted malicious directory name could influence path construction if the directory was somehow created through another vector.
4. The adapter's `getSessionPath` helper (baileys.adapter.ts line 164) constructs a path with no boundary check.

Defense in depth requires validation at both the API boundary and inside the adapter.

---

### Filesystem Path Construction Sites

The following locations in `packages/wa-server/src/` build a filesystem path from `sessionId`. All must be guarded.

| # | File | Line | Code |
|---|------|------|------|
| 1 | `whatsapp/baileys.adapter.ts` | 149 | `const sessionPath = path.join(this.sessionsDir, sessionId);` (deleteSession) |
| 2 | `whatsapp/baileys.adapter.ts` | 164–166 | `getSessionPath`: `return path.join(this.sessionsDir, sessionId);` |
| 3 | `whatsapp/baileys.adapter.ts` | 171 | `const sessionPath = path.join(this.sessionsDir, sessionId);` (initSocket, mkdir) |
| 4 | `whatsapp/baileys.adapter.ts` | 176 | `useMultiFileAuthState(sessionPath)` — Baileys opens files inside this path |
| 5 | `whatsapp/baileys.adapter.ts` | 433 | `const sessionPath = path.join(this.sessionsDir, sessionId);` (restoreAllSessions) |
| 6 | `whatsapp/baileys.adapter.ts` | 437 | `const credsFile = path.join(sessionPath, 'creds.json');` (restoreAllSessions creds check) |

Sites 1–4 are reachable from API callers. Sites 5–6 are reachable from disk only (startup restore iterates `fs.readdirSync`), but must still be hardened because a future attack surface could plant a directory via another vulnerability.

---

### Validation Design

#### Layer 1 — DTO / Route-Parameter Validation at the API Boundary

**Allowed character set:** `[a-zA-Z0-9_-]`

- Letters and digits: unambiguous on all filesystems and in URLs.
- Hyphen (`-`) and underscore (`_`): common identifier separators, safe on all filesystems.
- Explicitly excluded:
  - `.` — enables `..` traversal sequences.
  - `/` and `\` — path separators on POSIX and Windows respectively.
  - `%` — URL-encoding prefix; could decode to `/` or `.`.
  - Null byte (`\x00`) — terminates C strings; some OS calls truncate at null.
  - Whitespace — ambiguous, not meaningful as an identifier.
  - Everything else — not needed, excluded by default.

**Length cap:** minimum 1, maximum 64 characters. 64 is generous for real-world identifiers and keeps the directory name safely within the 255-byte filename limit even if a prefix is prepended. Empty strings are rejected by the minimum.

**Decorator to apply on every sessionId param:**

```
@Matches(/^[a-zA-Z0-9_-]{1,64}$/, { message: 'INVALID_SESSION_ID' })
```

**Controllers that need this guard applied to their `sessionId` route parameter:**

| Controller | File | Route params currently unvalidated |
|---|---|---|
| `SessionsController` | `sessions/sessions.controller.ts` | `@Param('id')` at lines 25, 34, 44 (POST body is validated; GET/DELETE/logout params are not) |
| `MessagesController` | `messages/messages.controller.ts` | `@Param('sessionId')` on every handler |
| `GroupsController` | `groups/groups.controller.ts` | `@Param('sessionId')` on every handler |
| `ContactsController` | `contacts/contacts.controller.ts` | `@Param('sessionId')` on every handler |

Implementation note: NestJS does not natively validate `@Param()` values using class-validator unless a custom pipe is applied. The recommended approach is to create a `ValidateSessionIdPipe` that applies the regex, and add it via `@UsePipes` or as a per-param pipe on each route param. Alternatively, a shared `SessionIdParam` DTO can be used wherever the param appears in a body. The implementor must choose one approach and apply it consistently to all four controllers.

#### Layer 2 — Boundary Assertion Inside the Adapter (Defense in Depth)

Even when Layer 1 is in place, the adapter must not trust its `sessionId` argument. Future callers (internal service calls, gRPC, test harnesses) may bypass the HTTP controller.

The check to add, immediately before any `path.join(this.sessionsDir, sessionId)` call:

```
resolvedSessions = path.resolve(this.sessionsDir)
candidate        = path.resolve(this.sessionsDir, sessionId)

if (!candidate.startsWith(resolvedSessions + path.sep)) {
  throw new BadRequestException('INVALID_SESSION_ID')
}
```

This check must be extracted into a single private helper, tentatively named `resolveSessionPath(sessionId: string): string`, that both validates and returns the resolved path. All six filesystem path construction sites listed above must call this helper instead of constructing paths inline. This ensures the boundary check cannot be omitted by oversight when new code is added.

The helper is the single place where both layers converge: Layer 1 prevents the bad input from reaching the adapter over HTTP; Layer 2 catches anything that slips through any other entry point.

#### Rejection Behavior

Both layers must respond identically so that callers cannot distinguish which layer rejected the input (information leakage prevention):

- HTTP status: `400 Bad Request`
- Body: `{"error":"INVALID_SESSION_ID"}`
- No filesystem path, no session detail, no stack trace in the response body.

---

### Test Cases (for qa-tester)

All cases below must return `HTTP 400` with body `{"error":"INVALID_SESSION_ID"}` unless marked PASS.

| # | Input | Attack vector |
|---|-------|---------------|
| 1 | `../../../etc/passwd` | Classic POSIX path traversal |
| 2 | `..\..\ windows\system32` | Windows backslash traversal |
| 3 | `session/../../../etc` | Embedded traversal mid-string |
| 4 | `sess\x00ion` (null byte, raw `\0` in the string) | Null byte injection |
| 5 | `%2e%2e%2f` | URL-encoded `../` (must be decoded before validation) |
| 6 | `%c0%ae%c0%ae` | Overlong UTF-8 encoding of `..` |
| 7 | `/etc/passwd` | Absolute path |
| 8 | `` (empty string) | Empty input |
| 9 | `   ` (three spaces) | Whitespace-only |
| 10 | `a` repeated 65 times (65-char string) | Exceeds length cap |
| 11 | `my-phone` | MUST PASS — valid hyphenated id |
| 12 | `session_1` | MUST PASS — underscore and digit |
| 13 | `ABC123` | MUST PASS — uppercase alphanumeric |
| 14 | `a` (single character) | MUST PASS — minimum length |
| 15 | `a` repeated 64 times (64-char string) | MUST PASS — maximum length |

Note for cases 5 and 6: NestJS parses route parameters after URL decoding by default. The validator will therefore see the decoded form (`../`) rather than the percent-encoded form. Cases 5 and 6 test that the decoded result is caught by the regex, not that percent-encoding itself is detected.

---

## Issue #5 — Raw Baileys msg Object Forwarded in Webhook (MEDIUM)

### Problem Statement

`handleIncomingMessages` in `baileys.adapter.ts` (lines 418–423) passes `raw: msg` — the full `proto.IWebMessageInfo` object — as part of the `message.received` webhook payload. The raw Baileys message object contains Signal protocol internals that must never leave the server:

- `messageContextInfo`: contains Signal session state metadata.
- `senderKeyDistributionMessage`: Signal sender-key material used for group encryption.
- `ephemeralStartTimestamp` / `ephemeralExpiration`: ephemeral (disappearing) message timing.
- `deviceSentMessage`: device-specific delivery envelope.
- `protocolMessage`: internal protocol control messages (e.g. history sync, key requests).
- Any field whose Baileys proto definition contains key material or refers to Signal internals.

Forwarding these fields to the dashboard, and from there potentially to third-party webhook consumers, constitutes an unintended data disclosure of cryptographic material and internal protocol state.

---

### Affected Webhook Events

The following events currently forward data that may include raw Baileys objects or arrays of them:

| Event | Fired at | Raw data risk |
|---|---|---|
| `message.received` | `baileys.adapter.ts` line 418 | `raw: msg` explicitly included — HIGH |
| `messages.update` | `baileys.adapter.ts` line 224 | `updates` array from `messages.update` Baileys event — contains `proto.IWebMessageInfo` fragments with `update` field — MEDIUM |
| `message.receipt` | `baileys.adapter.ts` line 227 | `updates` from `message-receipt.update` — contains receipt objects — LOW (no Signal internals, but still unfiltered Baileys shape) |
| `session.qr` | `baileys.adapter.ts` line 272 | QR data only — safe, no msg object |
| `session.connected` | `baileys.adapter.ts` line 296 | Phone/name only — safe |
| `session.disconnected` | `baileys.adapter.ts` line 319 | Status code only — safe |
| `session.logged_out` | `baileys.adapter.ts` line 314 | Empty — safe |
| `session.failed` | `baileys.adapter.ts` line 341 | Reason string only — safe |
| `session.deleted` | `baileys.adapter.ts` line 154 | `{sessionId}` only — safe |
| `presence.update` | `baileys.adapter.ts` line 231 | Presence object — no Signal internals, acceptable |
| `groups.update` | `baileys.adapter.ts` line 234 | Group metadata — no Signal internals, acceptable |
| `group.participants.update` | `baileys.adapter.ts` line 237 | Participant list — acceptable |
| `contacts.update` | `baileys.adapter.ts` line 240 | Contact fields — acceptable |
| `call` | `baileys.adapter.ts` line 243 | Call objects — acceptable |

The three events requiring transformation are `message.received`, `messages.update`, and `message.receipt`.

---

### Allowlist Design

The `sanitizeMessage` function must use an explicit allowlist — never a denylist. A denylist requires enumerating every dangerous field now and in every future Baileys upgrade. An allowlist permits only known-safe fields and implicitly excludes everything else, including fields added in future Baileys versions.

#### Safe fields for `proto.IWebMessageInfo` (the `msg` root object)

| Field | Safe to forward | Notes |
|---|---|---|
| `key.remoteJid` | Yes | Identifies the chat |
| `key.fromMe` | Yes | Direction indicator |
| `key.id` | Yes | Message identifier |
| `key.participant` | Yes | Group sender JID |
| `key` (other subfields) | No | May contain device identifiers |
| `messageTimestamp` | Yes | Unix timestamp |
| `pushName` | Yes | Display name set by sender |
| `broadcast` | Yes | Broadcast list indicator |
| `status` | Yes | Message status enum (for update events) |
| `message.conversation` | Yes | Plain text body |
| `message.extendedTextMessage.text` | Yes | Rich text body |
| `message.extendedTextMessage.contextInfo.stanzaId` | Yes | Quoted message ID only |
| `message.extendedTextMessage.contextInfo` (other) | No | Contains Signal ephemeral data |
| `message.imageMessage.caption` | Yes | |
| `message.imageMessage.mimetype` | Yes | |
| `message.imageMessage.mediaKey` | Yes | Needed by dashboard to decrypt media |
| `message.imageMessage.url` | Yes | CDN download URL |
| `message.imageMessage.fileLength` | Yes | |
| `message.videoMessage.caption` | Yes | |
| `message.videoMessage.mimetype` | Yes | |
| `message.videoMessage.mediaKey` | Yes | |
| `message.videoMessage.url` | Yes | |
| `message.audioMessage.ptt` | Yes | Voice note flag |
| `message.audioMessage.mimetype` | Yes | |
| `message.audioMessage.seconds` | Yes | |
| `message.audioMessage.mediaKey` | Yes | |
| `message.audioMessage.url` | Yes | |
| `message.documentMessage.fileName` | Yes | |
| `message.documentMessage.mimetype` | Yes | |
| `message.documentMessage.pageCount` | Yes | |
| `message.documentMessage.mediaKey` | Yes | |
| `message.documentMessage.url` | Yes | |
| `message.stickerMessage.isAnimated` | Yes | |
| `message.locationMessage.degreesLatitude` | Yes | |
| `message.locationMessage.degreesLongitude` | Yes | |
| `message.locationMessage.name` | Yes | |
| `message.locationMessage.address` | Yes | |
| `message.contactMessage.displayName` | Yes | |
| `message.contactMessage.vcard` | Yes | |
| `message.reactionMessage.text` | Yes | Emoji |
| `message.reactionMessage.key.id` | Yes | Target message ID |
| `message.pollCreationMessage.name` | Yes | |
| `message.pollCreationMessage.options[].optionName` | Yes | |
| `message.pollUpdateMessage` | Yes | Poll vote update |
| `message.messageContextInfo` | No | Signal session metadata — EXCLUDED |
| `message.senderKeyDistributionMessage` | No | Signal key material — EXCLUDED |
| `message.protocolMessage` | No | Internal protocol control — EXCLUDED |
| `message.deviceSentMessage` | No | Device envelope — EXCLUDED |
| `message.ephemeralMessage` | No | Ephemeral wrapper — EXCLUDED |
| `ephemeralStartTimestamp` | No | Ephemeral timing — EXCLUDED |
| `ephemeralExpiration` | No | Ephemeral timing — EXCLUDED |
| `participant` (root level) | No | Redundant with key.participant, avoid duplication |
| `userReceipt` | No | Internal delivery tracking |
| `reactions` (root level array) | No | Internal reaction state array |
| `labels` | No | Internal label data |
| `messageStubType` | No | Internal stub marker |
| `messageStubParameters` | No | Internal stub data |
| `clearAdmins` | No | Internal group management |
| `duration` | No | Ephemeral duration |
| `revokeMessageTimestamp` | No | Internal |

#### Safe fields for `messages.update` event

Each item in the updates array exposes `key` and `update`. Only forward:
- `key.remoteJid`, `key.fromMe`, `key.id`, `key.participant`
- `update.status` (delivery/read status)

Exclude `update.message` if present (may contain Signal internals on retry events).

#### Safe fields for `message.receipt` event

Each receipt item exposes `key`, `userReceipt`, and timing fields. Forward:
- `key.remoteJid`, `key.fromMe`, `key.id`, `key.participant`
- `receipt.readTimestamp`, `receipt.receiptTimestamp`, `receipt.userJid`

---

### sanitizeMessage Function

**File:** `packages/wa-server/src/webhooks/sanitize-message.ts`

**Signature:**

```
function sanitizeMessage(msg: proto.IWebMessageInfo): SanitizedMessage
```

Where `SanitizedMessage` is a locally-defined interface containing only the allowlisted fields above. Using a typed return forces TypeScript to reject accidental additions that are not in the interface.

**Placement rationale:** Parallel to `safe-fetch.ts` in `common/` — a single function whose sole job is boundary sanitization. All three webhook event paths (`message.received`, `messages.update`, `message.receipt`) must call it. No path in the adapter may call `webhookService.fire` for these three events without passing data through `sanitizeMessage` first.

**For `messages.update`:** A companion `sanitizeMessageUpdate(update)` function in the same file handles the update array shape.

**For `message.receipt`:** A companion `sanitizeReceipt(receipt)` function handles the receipt shape.

All three functions live in the same file to make the allowlist easy to review in one place.

---

### Breaking Change Documentation

The dashboard team must update their event handlers. The `raw` field is removed. The `message` object is now a sanitized subset.

#### message.received — Before

```json
{
  "event": "message.received",
  "sessionId": "my-phone",
  "timestamp": "2026-05-20T15:00:00.000Z",
  "data": {
    "messageId": "ABCDEF123",
    "from": "447700900000@s.whatsapp.net",
    "sender": "447700900000@s.whatsapp.net",
    "isGroup": false,
    "timestamp": 1747753200,
    "type": "conversation",
    "content": {
      "text": "Hello"
    },
    "raw": {
      "key": { "remoteJid": "447700900000@s.whatsapp.net", "fromMe": false, "id": "ABCDEF123" },
      "message": {
        "conversation": "Hello",
        "messageContextInfo": { "...Signal internals..." },
        "senderKeyDistributionMessage": { "...key material..." }
      },
      "ephemeralStartTimestamp": 1747753100,
      "messageStubType": 0
    }
  }
}
```

#### message.received — After

```json
{
  "event": "message.received",
  "sessionId": "my-phone",
  "timestamp": "2026-05-20T15:00:00.000Z",
  "data": {
    "messageId": "ABCDEF123",
    "from": "447700900000@s.whatsapp.net",
    "sender": "447700900000@s.whatsapp.net",
    "isGroup": false,
    "timestamp": 1747753200,
    "type": "conversation",
    "content": {
      "text": "Hello"
    },
    "message": {
      "key": { "remoteJid": "447700900000@s.whatsapp.net", "fromMe": false, "id": "ABCDEF123" },
      "messageTimestamp": 1747753200,
      "pushName": "Alice",
      "broadcast": false,
      "message": {
        "conversation": "Hello"
      }
    }
  }
}
```

Key changes for the dashboard team:
- The `raw` field is removed entirely. Any dashboard code reading `data.raw` must be updated.
- A `data.message` field replaces it with the sanitized shape.
- `data.content` (already present before) is unchanged.
- `messageContextInfo`, `senderKeyDistributionMessage`, `ephemeralStartTimestamp`, and all Signal-internal fields are absent from `data.message`.

#### messages.update — Before

```json
{
  "event": "messages.update",
  "data": [
    {
      "key": { "remoteJid": "...", "fromMe": true, "id": "ABCDEF123" },
      "update": {
        "status": 3,
        "message": { "...may contain Signal internals..." }
      }
    }
  ]
}
```

#### messages.update — After

```json
{
  "event": "messages.update",
  "data": [
    {
      "key": { "remoteJid": "...", "fromMe": true, "id": "ABCDEF123", "participant": null },
      "update": {
        "status": 3
      }
    }
  ]
}
```

Key change: `update.message` is dropped. Only `status` is forwarded from the update object.

---

## Implementation Order

The two issues are independent and can be implemented in parallel, but each must be complete and tested before the branch is handed to qa-tester.

1. Issue #3: Create `ValidateSessionIdPipe`, apply to all four controllers, add `resolveSessionPath` helper to the adapter replacing all six inline `path.join` calls.
2. Issue #5: Create `src/webhooks/sanitize-message.ts`, update `handleIncomingMessages`, `messages.update` handler, and `message-receipt.update` handler in the adapter to call it.

No other files should be created or modified during this implementation.
