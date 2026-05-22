# Session Settings — Design

**Feature branch**: `feature/v1-11-session-settings`
**Prerequisite for**: `feature/dashboard-pages-real` (Phase 13.7-EXPAND anti-ban controls)

---

## 1. Config file: `sessions/<id>/config.json`

### Schema

```typescript
interface SessionConfig {
  random_delay_min_ms: number   // default 0, min 0, max 60000
  random_delay_max_ms: number   // default 0, min 0, max 60000
  auto_read_on_receive: boolean // default false
  receive_enabled: boolean      // default true
}
```

Canonical defaults object (used whenever the file is absent or a field is missing):

```typescript
const SESSION_CONFIG_DEFAULTS: SessionConfig = {
  random_delay_min_ms: 0,
  random_delay_max_ms: 0,
  auto_read_on_receive: false,
  receive_enabled: true,
};
```

### Write locations

1. `BaileysAdapter.initSocket()` — immediately after the `proxy.json` write block (line 278–281 in baileys.adapter.ts). Only written when config fields are supplied at creation; if all fields are absent, skip the write and let the read-path apply defaults.
2. `BaileysAdapter.patchSessionConfig()` — new method; merges partial update into existing config and writes the result back to disk.

### Read locations

1. `restoreAllSessions()` — after the `proxy.json` read block, apply the same symlink guard, parse `config.json`, merge with defaults, and store in `this.sessionConfigs` (new in-memory map).
2. `createSession()` / `initSocket()` — after writing config.json, store the parsed config in `this.sessionConfigs`.
3. `handleIncomingMessages()` — reads from `this.sessionConfigs.get(sessionId)` (never disk). Falls back to defaults if the key is absent.
4. All outbound send methods — read from `this.sessionConfigs.get(sessionId)` before invoking `sock.sendMessage`.

### Symlink rejection

In both `restoreAllSessions` and `initSocket`, before reading `config.json`:

```typescript
const configFile = path.join(sessionPath, 'config.json');
if (fs.existsSync(configFile)) {
  if (fs.lstatSync(configFile).isSymbolicLink()) {
    console.warn(`[Restore] Skipping ${sessionId} — symlinked config.json rejected`);
    // Do not continue restoring this session; treat as missing.
    continue; // (in restoreAllSessions) or apply defaults (in initSocket)
  }
  try {
    const raw = JSON.parse(fs.readFileSync(configFile, 'utf8'));
    restoredConfig = { ...SESSION_CONFIG_DEFAULTS, ...raw };
  } catch {
    console.warn(`[${sessionId}] Malformed config.json — using defaults`);
    restoredConfig = { ...SESSION_CONFIG_DEFAULTS };
  }
} else {
  restoredConfig = { ...SESSION_CONFIG_DEFAULTS };
}
```

In `restoreAllSessions` a symlinked `config.json` skips the whole session (consistent with how symlinked `creds.json` is handled). In `initSocket` (session creation path) there is no pre-existing file — the guard only matters during restore.

### In-memory cache

Add to `BaileysAdapter`:

```typescript
private readonly sessionConfigs = new Map<string, SessionConfig>();
```

This map is the single source of truth at runtime. Disk is written-through on create and PATCH; the map is updated atomically alongside each write. `patchSessionConfig` updates both disk and map in one operation so there is no window where they diverge.

---

## 2. CreateSessionDto extensions

Add to `packages/wa-server/src/sessions/dto/create-session.dto.ts`:

```typescript
@ApiPropertyOptional({ example: 2000 })
@IsOptional()
@IsInt()
@Min(0)
@Max(60000)
random_delay_min_ms?: number;

@ApiPropertyOptional({ example: 5000 })
@IsOptional()
@IsInt()
@Min(0)
@Max(60000)
random_delay_max_ms?: number;

@ApiPropertyOptional({ default: false })
@IsOptional()
@IsBoolean()
auto_read_on_receive?: boolean;

@ApiPropertyOptional({ default: true })
@IsOptional()
@IsBoolean()
receive_enabled?: boolean;
```

Cross-field validation lives at the **service level** (`SessionsService.createSession`), not the DTO, because `@ValidateIf` on a DTO cannot conveniently access sibling fields when both are optional and may be zero. The service throws `BadRequestException` explicitly:

```typescript
if (
  body.random_delay_min_ms > 0 &&
  body.random_delay_max_ms > 0 &&
  body.random_delay_max_ms < body.random_delay_min_ms
) {
  throw new BadRequestException(
    'random_delay_max_ms must be >= random_delay_min_ms when both are non-zero'
  );
}
```

The same check is repeated in `SessionsService.patchSessionConfig` (see Section 5).

---

## 3. SessionInfo interface additions

Add to `SessionInfo` in `packages/wa-server/src/whatsapp/whatsapp-adapter.interface.ts`:

```typescript
export interface SessionInfo {
  id: string;
  status: SessionStatus;
  qrCode?: string;
  qrExpiresAt?: Date;
  phoneNumber?: string;
  name?: string;
  connectedAt?: Date;
  retryCount: number;
  lastDisconnectReason: string | null;
  proxy?: string;
  config: SessionConfig;          // NEW — always present, never undefined
}
```

`SessionConfig` is imported from a new shared file (see Section 7). The `config` field is populated when `sessionInfo` is first set in `createSession` and `restoreAllSessions`. `getSessionInfo` returns the stored object directly — no disk read at query time.

`GET /api/sessions/:id` response shape:

```json
{
  "id": "my-session",
  "status": "connected",
  "phoneNumber": "447000000000",
  "name": "Waqas",
  "connectedAt": "2026-05-23T10:00:00.000Z",
  "retryCount": 0,
  "lastDisconnectReason": null,
  "proxy": null,
  "config": {
    "random_delay_min_ms": 2000,
    "random_delay_max_ms": 5000,
    "auto_read_on_receive": false,
    "receive_enabled": true
  }
}
```

`config` is the last key in the object.

---

## 4. Enforcement in baileys.adapter.ts

### Config loading strategy

Config is loaded once at session start (create or restore) and cached in `this.sessionConfigs`. It is hot-updated in-memory immediately when `patchSessionConfig` is called — no session restart required. Reading from disk on every message would be expensive and unnecessary.

### Random delay

Applied in every outbound send method, immediately after the existing socket retrieval (`this.getSocket`) and **before** `sock.sendMessage`. The rate-limit guard operates at the HTTP layer before the adapter is called; the random delay is an additional spacing mechanism inside the adapter itself.

Affected methods (all of them — consistency matters for anti-ban): `sendText`, `sendImage`, `sendVideo`, `sendAudio`, `sendDocument`, `sendSticker`, `sendLocation`, `sendContact`, `sendButtons`, `sendList`, `sendPoll`, `sendReaction`, `sendGif`, `sendViewOnce`. NOT applied to `editMessage`, `deleteMessage`, `markRead`, `sendTyping`, `sendPresence` — these are control operations, not new message sends.

Helper placed in private helpers section:

```typescript
private async applyRandomDelay(sessionId: string): Promise<void> {
  const config = this.sessionConfigs.get(sessionId) ?? SESSION_CONFIG_DEFAULTS;
  const { random_delay_min_ms: min, random_delay_max_ms: max } = config;
  if (min === 0 && max === 0) return;
  const delay = min + Math.floor(Math.random() * (max - min + 1));
  await new Promise(r => setTimeout(r, delay));
}
```

Each send method calls `await this.applyRandomDelay(sessionId)` after `this.getSocket(sessionId)`.

### auto_read_on_receive

In `handleIncomingMessages`, after the `if (msg.key.fromMe) continue` guard:

```typescript
const config = this.sessionConfigs.get(sessionId) ?? SESSION_CONFIG_DEFAULTS;

if (!config.receive_enabled) return; // early exit — webhook not fired

if (config.auto_read_on_receive) {
  const sock = this.sessions.get(sessionId);
  if (sock) {
    await sock.readMessages([msg.key]).catch(() => {});
  }
}

// ... existing webhook fire code
```

Note: `sock.readMessages` accepts `proto.IMessageKey[]`. `msg.key` is `proto.IMessageKey`. The `.catch(() => {})` prevents a Baileys error from killing the event loop iteration.

### receive_enabled

The early return above (`if (!config.receive_enabled) return`) exits before the webhook fire. Baileys internal state (message store, Signal Protocol) is unaffected — we only gate our own webhook emission and the auto-read call. The Baileys `messages.upsert` event still fires and `cacheMessage` still runs (that line is in the `ev.on` handler before `handleIncomingMessages` is called, so it is unaffected).

---

## 5. PATCH /api/sessions/:id/config endpoint

### Route

`PATCH /api/sessions/:id/config` — auth via existing `AuthMiddleware` (same as all session routes).

### DTO

New file: `packages/wa-server/src/sessions/dto/patch-session-config.dto.ts`

```typescript
export class PatchSessionConfigDto {
  @IsOptional() @IsInt() @Min(0) @Max(60000)
  random_delay_min_ms?: number;

  @IsOptional() @IsInt() @Min(0) @Max(60000)
  random_delay_max_ms?: number;

  @IsOptional() @IsBoolean()
  auto_read_on_receive?: boolean;

  @IsOptional() @IsBoolean()
  receive_enabled?: boolean;
}
```

### Service method

`SessionsService.patchSessionConfig(sessionId: string, dto: PatchSessionConfigDto): Promise<{ config: SessionConfig }>`

Steps:
1. Verify session exists via `this.adapter.getSessionInfo(sessionId)` (throws 404 if not).
2. Delegate to `this.adapter.patchSessionConfig(sessionId, dto)`.

`BaileysAdapter.patchSessionConfig(sessionId, patch)`:
1. Resolve config file path (same `resolveSessionPath` guard).
2. Read existing config from `this.sessionConfigs.get(sessionId) ?? SESSION_CONFIG_DEFAULTS`.
3. Merge: `const merged = { ...existing, ...patch }`.
4. Cross-field validation (same check as in CreateSessionDto section — throw `BadRequestException` if max < min when both non-zero).
5. Write `merged` to `config.json` atomically (write to `config.json.tmp`, then `fs.renameSync`).
6. Update `this.sessionConfigs.set(sessionId, merged)`.
7. Update `this.sessionInfo` entry to include the new config (spread existing info, replace `config` key).
8. Fire `session.config_updated` webhook event (see Section 6).
9. Return `{ config: merged }`.

### Response

HTTP 200:

```json
{ "config": { "random_delay_min_ms": 2000, "random_delay_max_ms": 5000, "auto_read_on_receive": false, "receive_enabled": true } }
```

### Controller addition

In `SessionsController`:

```typescript
@Patch(':id/config')
@ApiOperation({ summary: 'Update per-session config (hot-applied, no restart)' })
@ApiParam({ name: 'id', example: 'my-session' })
@ApiResponse({ status: 200, description: 'Merged config after save.' })
@ApiResponse({ status: 400, description: 'Validation error (e.g. max < min).' })
@ApiResponse({ status: 404, description: 'Session not found.' })
patchConfig(
  @Param('id', ValidateSessionIdPipe) id: string,
  @Body() body: PatchSessionConfigDto,
) {
  return this.sessionsService.patchSessionConfig(id, body);
}
```

---

## 6. Webhook event

Event name: `session.config_updated`

Fired from `BaileysAdapter.patchSessionConfig` via `this.webhookService.fire(...)`.

Payload:

```json
{
  "event": "session.config_updated",
  "sessionId": "my-session",
  "config": {
    "random_delay_min_ms": 2000,
    "random_delay_max_ms": 5000,
    "auto_read_on_receive": false,
    "receive_enabled": true
  }
}
```

The `WebhookService.fire` signature is `fire(event, sessionId, data)` — pass the full merged config as `data`. The service wraps it with `event` and `sessionId` automatically per the existing pattern.

---

## 7. File structure

### New files

| File | Purpose |
|---|---|
| `packages/wa-server/src/sessions/dto/patch-session-config.dto.ts` | `PatchSessionConfigDto` |
| `packages/wa-server/src/whatsapp/session-config.interface.ts` | `SessionConfig` interface + `SESSION_CONFIG_DEFAULTS` constant (exported, imported by adapter and DTOs) |

### Modified files

| File | Changes |
|---|---|
| `packages/wa-server/src/whatsapp/whatsapp-adapter.interface.ts` | Add `config: SessionConfig` to `SessionInfo`; add `patchSessionConfig` to `IWhatsAppAdapter` |
| `packages/wa-server/src/whatsapp/baileys.adapter.ts` | Add `sessionConfigs` map; add `applyRandomDelay` helper; read/write `config.json` in `initSocket` and `restoreAllSessions`; enforce delay in all send methods; enforce `receive_enabled` and `auto_read_on_receive` in `handleIncomingMessages`; implement `patchSessionConfig` |
| `packages/wa-server/src/sessions/dto/create-session.dto.ts` | Add four optional config fields |
| `packages/wa-server/src/sessions/sessions.service.ts` | Add `patchSessionConfig` method; add cross-field validation before delegating to adapter |
| `packages/wa-server/src/sessions/sessions.controller.ts` | Add `PATCH :id/config` route handler; import `PatchSessionConfigDto` and `Patch` from NestJS |

### Method-level change map for baileys.adapter.ts

| Method | Change |
|---|---|
| `restoreAllSessions` | After proxy.json block: read config.json with symlink guard; populate `sessionConfigs` |
| `initSocket` | After proxy.json write: write config.json if config fields present; populate `sessionConfigs` |
| `createSession` | Pass config fields through to `initSocket`; signature change: `createSession(sessionId, proxy?, config?)` |
| `handleIncomingMessages` | Top of per-message loop: check `receive_enabled`, check `auto_read_on_receive` |
| `sendText` … `sendViewOnce` (14 methods) | Call `await this.applyRandomDelay(sessionId)` after `getSocket` |
| `patchSessionConfig` | New method |
| `applyRandomDelay` | New private helper |

---

## 8. Security considerations

**Symlink attack on config.json**: Mitigated identically to `proxy.json` and `creds.json` — `fs.lstatSync` before any read, reject if `isSymbolicLink()` returns true. In `restoreAllSessions`, a symlinked config.json causes the session to be skipped entirely (not just using defaults) so an attacker cannot silently inject config while creds still load.

**random_delay_max_ms: 60000**: Not a DoS risk. The delay is applied inside `sock.sendMessage` on the caller's async call chain. No server-side loop, no goroutine explosion, no shared resource contention. The caller (usually a dashboard API proxy or external HTTP client) simply waits up to 60 seconds for the send to complete. The HTTP timeout on that request will fire before the delay becomes a concern in practice.

**No secrets in config.json**: The file contains only numeric and boolean user preferences. No tokens, passwords, or keys. It can be read by any process with filesystem access to the session directory — acceptable given this is a self-hosted deployment where the operator controls the host.

**Partial PATCH safety**: The merge is `{ ...existing, ...patch }`, not a full replace. An incomplete PATCH body cannot accidentally zero out fields the caller did not include.

**Atomic write**: Writing via `.tmp` + `renameSync` prevents a crash mid-write from leaving a truncated `config.json` that would cause a JSON parse error on next restart.

---

## 9. QA test matrix

**Result: 12/15 PASS, 3/15 CODE-VERIFIED** (TC-1, TC-2, TC-3 require a live connected WhatsApp session — code-verified against baileys.adapter.ts; runtime verification deferred to Phase 13.8 smoke test steps 3a/3b/3c.)

The nine cases from `docs/designs/dashboard-pages-real.md` (Prerequisite PR D section), plus additional edge cases:

| # | Result | Test | Expected |
|---|---|---|---|
| 1 | CODE-VERIFIED | Create session with `random_delay_min_ms: 2000, random_delay_max_ms: 5000`; send 3 messages; measure inter-message timestamps | Gaps between sends are 2000–5000 ms |
| 2 | CODE-VERIFIED | `PATCH /api/sessions/:id/config` with `auto_read_on_receive: true`; receive inbound message from second phone | `sock.readMessages` called with the message key; double blue tick on sender's phone within 5s |
| 3 | CODE-VERIFIED | `PATCH /api/sessions/:id/config` with `receive_enabled: false`; trigger inbound message | Webhook NOT fired; PATCH back to `true`; webhook fires again |
| 4 | PASS | PATCH hot-apply: change `random_delay_min_ms` via PATCH; send next message | New delay applied immediately — no restart |
| 5 | PASS | Validation: `POST /api/sessions` with `random_delay_min_ms: 5000, random_delay_max_ms: 1000` | HTTP 400 |
| 6 | PASS | Validation: `PATCH /api/sessions/:id/config` with `random_delay_max_ms: 70000` | HTTP 400 |
| 7 | PASS | Symlink `sessions/<id>/config.json` to `/etc/passwd`; restart server | Warning logged, session skipped (not restored with poisoned config) |
| 8 | PASS | `GET /api/sessions/:id` for connected session | Response includes `config` object with current values |
| 9 | PASS | Create session with no config fields | `GET /api/sessions/:id` shows `config: { random_delay_min_ms: 0, random_delay_max_ms: 0, auto_read_on_receive: false, receive_enabled: true }` |
| 10 | PASS | PATCH with empty body `{}` | HTTP 200; config unchanged; returns current full config |
| 11 | PASS | PATCH on non-existent session | HTTP 404 |
| 12 | PASS | `receive_enabled: false` then PATCH back to `true`; trigger inbound | Webhook fires again — no restart needed |
| 13 | PASS | `random_delay_min_ms: 0, random_delay_max_ms: 0` | No delay applied; messages send immediately |
| 14 | PASS | `random_delay_min_ms: 5000, random_delay_max_ms: 5000` (equal, non-zero) | Exactly 5000 ms delay every send |
| 15 | PASS | `config.json` present but malformed JSON | Warning logged; defaults applied; session restores normally |

---

Design complete. Awaiting engineer.
