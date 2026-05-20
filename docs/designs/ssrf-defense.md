# SSRF Defense Design

**Branch**: `fix/security-hardening-ssrf`
**Author**: Waqas Ahmed Waseer
**Date**: 2026-05-20
**Status**: Design approved — pending implementation

---

## Scope

This document covers all outbound HTTP requests made by the WA Server binary
(`packages/wa-server`). Two categories of call sites are in scope:

1. **Webhook service** (`src/webhooks/webhook.service.ts`) — fires an outbound
   HTTP POST to a dashboard-supplied URL on every WhatsApp event.

2. **Baileys adapter media endpoints** (`src/whatsapp/baileys.adapter.ts`) —
   nine call sites that accept a caller-supplied URL and fetch remote media:
   - `sendImage` (line 479) — `image: { url }`
   - `sendVideo` (line 500) — `video: { url }`
   - `sendAudio` (line 514) — `audio: { url }`
   - `sendDocument` (line 531) — `document: { url }`
   - `sendSticker` (line 543) — `sticker: { url }`
   - `sendGif` (line 677) — `video: { url, gifPlayback: true }`
   - `sendViewOnce` (line 693) — `image: { url, viewOnce: true }`
   - `updateGroupPicture` (line 819) — `fetch(imageUrl)` then buffer
   - `updateOwnProfilePicture` (line 1045) — `fetch(imageUrl)` then buffer

The five Baileys `{ url }` object endpoints delegate the actual HTTP fetch to
Baileys itself (the Baileys download pipeline), while `updateGroupPicture` and
`updateOwnProfilePicture` use the global `fetch`. Both paths are unsafe today
and must go through `safeFetch()`.

Out of scope: inbound requests to the WA Server's own REST API; Baileys
internal signalling connections to WhatsApp servers.

---

## Threat Model

### Attacker position

Any API consumer that can call a WA Server endpoint accepting a URL parameter.
In the deployed topology the Dashboard API is the primary caller, but the WA
Server exposes a direct HTTP API protected only by `X-Api-Token`. A compromised
Dashboard, a leaked token, or a misconfigured network all give an attacker
direct URL-injection capability.

### High-value internal targets

| Target | Why dangerous |
|---|---|
| `169.254.169.254` | AWS/Azure/GCP instance metadata; yields cloud credentials |
| `100.100.100.200` | Alibaba Cloud ECS metadata |
| `fd00:ec2::254` | AWS IPv6 metadata endpoint |
| `10.x/172.16.x/192.168.x` | Internal VPC services, databases, admin panels |
| `127.0.0.1` / `::1` | WA Server's own NestJS HTTP port, Prometheus, etc. |
| `169.254.x.x` | Link-local; cloud metadata and network devices |

### Attack vectors covered by this design

- Direct IP SSRF: caller supplies `http://169.254.169.254/latest/meta-data/`
- DNS rebinding: hostname resolves to a public IP at validation time, then
  resolves to an internal IP at connection time
- Redirect chain pivoting: a valid public URL redirects to an internal target
- IPv4-mapped IPv6 bypass: `::ffff:169.254.169.254` bypasses naive IPv4 checks
- Scheme abuse: `file:///etc/passwd`, `gopher://`, `data://`, etc.
- Slow-read / large-file DoS: attacker-controlled server streams forever

---

## Chosen Approach: Hand-Rolled `safeFetch()` over `ssrf-req-filter`

### Libraries evaluated

#### `ssrf-req-filter` v1.1.1

- Last published: 2024-05-11 (one release in two years; effectively unmaintained)
- Depends on `ipaddr.js` for IP parsing — a solid underlying tool
- Works as an `http.Agent` / `https.Agent` injected into Axios or node-fetch
- **Covers natively**: IPv4 private/loopback blocking (points 1 and 3 partially)
- **Does NOT cover natively**:
  - IPv6 loopback, link-local, unique-local, IPv4-mapped IPv6 (point 2)
  - Alibaba Cloud metadata `100.100.100.200` (point 3 partial gap)
  - DNS rebinding — the Agent approach does not pin the resolved IP; a
    re-resolve at connect time is still possible
  - Redirect chain re-validation (point 5)
  - Scheme allowlist (point 6) — callers must validate before passing to Axios
  - Timeout and size cap (point 7) — caller responsibility
  - The Baileys `{ url }` object path bypasses any custom agent entirely because
    Baileys calls `https.get` internally with its own agent

  That last point is decisive: `ssrf-req-filter` cannot protect the five Baileys
  URL object call sites at all without forking Baileys, which is prohibited by
  the Architecture Rule.

#### `got` v15.x

- Latest v15 is ESM-only. The WA Server is a CommonJS/ts-node project compiled
  to CJS for `pkg` packaging. Adding an ESM-only dependency requires either
  dynamic `import()` wrappers or a full ESM migration — both are disproportionate
  churn for a security fix.
- `got` `beforeRequest` hooks and `handlers` can intercept the resolved socket
  address and block private IPs, but this still requires all the same
  hand-written IP range logic, and it still cannot intercept Baileys internals.

#### `axios` with interceptors

- Interceptors fire before the request is dispatched, not after DNS resolution.
  The resolved IP is not available inside a `beforeRequest` interceptor, making
  true DNS rebinding prevention impossible without a custom `lookup` function.
  Same gap as `ssrf-req-filter`.

### Decision: hand-rolled `safeFetch()`

Because:
1. No library covers all 9 required points without additional code on top.
2. The Baileys URL-object path requires pre-fetching the media ourselves and
   passing a `Buffer` or `{ stream: Readable }` instead of a `{ url }` — a
   design the libraries do not assist with at all.
3. `ipaddr.js` (the best underlying IP-parsing library, used by
   `ssrf-req-filter`) can be added as a direct dependency to handle the IP
   classification logic correctly, avoiding hand-rolled CIDR arithmetic.
4. Hand-rolled means we own the entire surface: no silent upstream change can
   remove a check.
5. The implementation is modest in scope: DNS resolution + IP validation +
   fetch-with-timeout + size cap. This is not a reason to avoid writing it.

The hand-rolled implementation will use `ipaddr.js` directly for IP range
matching (it handles both IPv4 and IPv6 including IPv4-mapped addresses) and
Node's built-in `dns.promises.resolve4` / `dns.promises.resolve6` for
resolution (see Point 4 and OQ7 for rationale over `dns.promises.lookup`).

---

## `safeFetch()` API

**File**: `packages/wa-server/src/common/safe-fetch.ts`

```typescript
export interface SafeFetchOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  headers?: Record<string, string>;
  body?: string | Buffer;
  /** Override max response bytes. Required per call site (see Size Cap Policy in Point 7). SSRF_MAX_RESPONSE_MB env var overrides all. */
  maxBytes?: number;
}

export interface SafeFetchResponse {
  status: number;
  headers: Record<string, string>;
  buffer(): Promise<Buffer>;
  text(): Promise<string>;
  json<T = unknown>(): Promise<T>;
  /** Returns a size-capped, timeout-enforced Node.js Readable. Pass to Baileys as { stream }. */
  stream(): Readable;
}

/**
 * SSRF-safe HTTP fetch.
 *
 * Resolves the hostname manually, validates every returned IP against the
 * blocklist, then connects directly to the validated IP (pinning). Validates
 * every redirect through the same pipeline. Enforces connect/read timeouts
 * and a configurable max-response-size cap.
 *
 * Throws SsrfBlockedError (HTTP 422 to callers) for any blocked target.
 * Throws SsrfTimeoutError (HTTP 504 to callers) on connect/read timeout.
 */
export declare function safeFetch(
  url: string,
  options?: SafeFetchOptions,
): Promise<SafeFetchResponse>;

export declare class SsrfBlockedError extends Error {
  readonly url: string;
  readonly reason: string; // e.g. "blocked: private IPv4 range 10.0.0.0/8"
}

export declare class SsrfTimeoutError extends Error {
  readonly url: string;
}
```

Callers that currently build `{ url: new URL(mediaUrl) }` objects for Baileys
will be changed to use either the `buffer()` or `stream()` path depending on
media type (see Size Cap Policy in Point 7). Examples:

```typescript
// Small media (image, sticker, audio) — buffer path
const buf = await safeFetch(mediaUrl, { maxBytes: 10 * MiB }).then(r => r.buffer());
sock.sendMessage(jid, { image: buf, caption });

// Large media (video, document, gif) — stream path
const readable = safeFetch(mediaUrl, { maxBytes: 100 * MiB }).stream();
sock.sendMessage(jid, { video: { stream: readable } });
```

---

## Point-by-Point Defense

### Point 1 — IPv4 Private / Loopback / Link-Local Blocking

**Threat**: Caller supplies a URL whose resolved IPv4 address falls inside a
non-routable range, reaching internal infrastructure.

**Blocked ranges**:

| Range | CIDR | Class |
|---|---|---|
| Loopback | 127.0.0.0/8 | RFC 5735 |
| Private class A | 10.0.0.0/8 | RFC 1918 |
| Private class B | 172.16.0.0/12 | RFC 1918 |
| Private class C | 192.168.0.0/16 | RFC 1918 |
| Link-local | 169.254.0.0/16 | RFC 3927 |
| Unspecified | 0.0.0.0/8 | RFC 1122 |
| Multicast | 224.0.0.0/4 | RFC 5771 |
| Reserved / future | 240.0.0.0/4 | RFC 1112 |

**Defense**: After manually resolving the hostname with `dns.promises.resolve4`
and `dns.promises.resolve6` (run in parallel via `Promise.allSettled`), every
returned A record is parsed by `ipaddr.js`. If any returned IP falls within the
above ranges, the request is rejected before a socket is opened.

**Rejection behavior**: `SsrfBlockedError` is thrown with `reason` identifying
the matched range. The NestJS exception filter maps this to **HTTP 422
Unprocessable Entity** with body:
```json
{ "error": "SSRF_BLOCKED", "detail": "blocked: private IPv4 range 10.0.0.0/8" }
```

---

### Point 2 — IPv6 Blocking

**Threat**: IPv6 addresses provide alternate paths to the same loopback and
link-local destinations, and IPv4-mapped IPv6 (`::ffff:a.b.c.d`) can encode a
blocked IPv4 address in an IPv6 literal to bypass naive IPv4-only checks.

**Blocked ranges**:

| Address / Range | Notes |
|---|---|
| `::1` | IPv6 loopback |
| `fe80::/10` | Link-local |
| `fc00::/7` | Unique local (fd00::/8 included) |
| `::ffff:0:0/96` | IPv4-mapped; the embedded IPv4 is further checked against Point 1 |
| `fec0::/10` | Deprecated site-local |
| `2002::/16` | 6to4 — may embed RFC 1918 IPv4 addresses |
| `::/128` | Unspecified |

**Defense**: The AAAA records returned by `dns.promises.resolve6` (part of the
parallel `Promise.allSettled` call described in Point 4) are parsed by
`ipaddr.js`. For IPv4-mapped addresses, `ipaddr.js` exposes the embedded IPv4
via `.toIPv4Address()`, which is then re-run through the Point 1 blocklist.

By default, if any AAAA record is returned and the server is not explicitly
configured to allow IPv6 external targets, all IPv6 addresses are rejected.
This is a conservative default; an environment variable `SSRF_ALLOW_IPV6=true`
can relax it for deployments where external IPv6 is needed, but IPv4-mapped
addresses remain blocked regardless.

**Rejection behavior**: HTTP 422 as above, with `reason` identifying the
matched IPv6 range, e.g. `"blocked: IPv4-mapped address ::ffff:169.254.169.254"`.

---

### Point 3 — Cloud Metadata Endpoint Blocking

**Threat**: Cloud metadata endpoints yield IAM credentials, instance identity,
SSH keys, and user data. These are the highest-impact SSRF targets. They sit
at well-known addresses that are not covered by standard private-range checks
(`100.100.100.200` is publicly routable).

**Explicitly blocked addresses/ranges**:

| Address | Provider |
|---|---|
| `169.254.169.254` | AWS EC2 IMDS, Azure IMDS, GCP metadata server |
| `100.100.100.200` | Alibaba Cloud ECS metadata |
| `fd00:ec2::254` | AWS IPv6 metadata endpoint |
| `169.254.0.0/16` | Entire link-local range (covers current and future metadata IPs in this space) |

`169.254.169.254` is already caught by the link-local range in Point 1.
`100.100.100.200` is a public IP and must be explicitly blocked in a dedicated
denylist checked before the IP range classification. `fd00:ec2::254` falls
inside `fc00::/7` (unique local) and is caught by Point 2.

The explicit denylist for `100.100.100.200` is maintained as a constant array
in `safe-fetch.ts` to make future additions (new providers) easy to review.

**Rejection behavior**: HTTP 422, `reason: "blocked: cloud metadata endpoint
100.100.100.200 (Alibaba Cloud ECS)"`.

---

### Point 4 — DNS Rebinding Prevention

**Threat**: An attacker controls a hostname (e.g. `evil.example.com`) with a
TTL of 0. At validation time, DNS returns a legitimate public IP. After
validation passes, the HTTP library calls the OS resolver again and the
attacker has swapped the DNS record to point to `169.254.169.254`. The
connection is made to the metadata server.

**Defense — resolve-once, pin, connect**:

The implementation follows this exact sequence:

1. Parse the URL; extract the hostname.
2. If the hostname is already an IP literal, validate it directly (skip
   resolution).
3. Otherwise, call `dns.promises.resolve4(hostname)` and
   `dns.promises.resolve6(hostname)` in parallel via `Promise.allSettled`.
   Collect all results: fulfilled IPv4 addresses from `resolve4`, fulfilled
   IPv6 addresses from `resolve6`. If `resolve6` rejects (e.g. NXDOMAIN
   because the hostname has no AAAA records), treat the IPv6 list as empty —
   this is not an error.
4. Validate every returned IP against all blocklists (Points 1, 2, 3).
5. Select the first non-blocked IP.
6. Open the TCP connection directly to that IP address (not the hostname).
   Provide the original hostname in the `Host` header so TLS SNI and virtual
   hosting work correctly.
7. The HTTP library is invoked with `host` set to the validated IP string and
   `headers: { Host: originalHostname }`. Because the library receives an IP,
   it will not perform its own DNS resolution — there is no second lookup.

This approach is sometimes called "IP pinning after resolution". It is the only
reliable defense against DNS rebinding without a custom DNS resolver with
pinned TTL enforcement.

**Why `resolve4`/`resolve6` rather than `lookup({ all: true })`**:

`dns.promises.lookup` uses the OS resolver, which respects `/etc/hosts` and
the NSSwitch configuration. An attacker who can write to `/etc/hosts` (e.g. via
a container escape or a misconfigured volume mount) can add an entry mapping an
arbitrary hostname to `169.254.169.254` and bypass the blocklist entirely
before the check is even reached.

`dns.promises.resolve4` and `dns.promises.resolve6` query DNS directly,
bypassing `/etc/hosts` and NSSwitch. They are significantly harder to
manipulate from userspace. Using them is a strict improvement with no
functional downside for our use case, since we are validating externally
supplied URLs — not resolving internal service names.

`resolve6` may return NXDOMAIN if the hostname has no AAAA records. This is
handled gracefully: a rejected `resolve6` promise in the `Promise.allSettled`
result is treated as an empty IPv6 address list, not as a fatal error.

**Implementation note**: Node's `http.request` and `https.request` accept a
`host` option that is the socket target. Setting `host` to the IP and `headers:
{ Host: hostname }` achieves the pin. TLS verification still uses the SNI from
the `Host` header.

**Rejection behavior**: If all resolved IPs are blocked, HTTP 422 with reason
listing the resolved IPs and the matched rule.

---

### Point 5 — HTTP Redirect Chain Validation

**Threat**: The initial URL passes validation (public IP), but the server
returns a `301`/`302` redirect to an internal target such as
`http://169.254.169.254/`. Without re-validation, the HTTP client follows the
redirect silently.

**Defense**:

- `safeFetch` handles redirects manually; automatic redirect following in the
  underlying `http`/`https` module is disabled (`maxRedirects: 0`).
- On receiving a `3xx` response, `safeFetch` extracts the `Location` header.
- The `Location` URL is passed through the full validation pipeline from the
  beginning (scheme check → DNS resolution → IP blocklist → metadata denylist).
- This repeats for each redirect hop.
- Maximum redirect depth: **3**. On the 4th redirect, the request is rejected.
- `https:` → `http:` scheme downgrade is forbidden. If the current URL is
  `https:` and the redirect `Location` is `http:`, the request is rejected
  immediately regardless of the target IP.

**Rejection behavior**:
- Redirect to blocked target: HTTP 422, `reason: "blocked: redirect to private
  IPv4 range 169.254.0.0/16 at hop 2"`.
- Redirect limit exceeded: HTTP 422, `reason: "blocked: redirect limit (3)
  exceeded"`.
- Scheme downgrade: HTTP 422, `reason: "blocked: https→http scheme downgrade
  on redirect"`.

---

### Point 6 — Scheme Allowlist

**Threat**: Non-HTTP schemes are passed to the request library. `file://`
reads local files. `gopher://` can construct arbitrary TCP payloads and reach
internal services. `data://` and `javascript://` are browser-centric but may
be handled by some runtimes. `ftp://` tunnels to internal FTP servers.

**Allowed schemes**:

| Scheme | Condition |
|---|---|
| `https:` | Always allowed in production |
| `http:` | Only when `NODE_ENV !== 'production'` AND resolved IP is loopback (`127.0.0.0/8` or `::1`) |

The `http:` development exemption exists so that local integration tests can
target a `http://localhost` mock server. It is explicitly blocked in production.

**Blocked by default**: `file:`, `gopher:`, `ftp:`, `data:`, `javascript:`,
and any other scheme not in the allowlist above.

**Implementation**: Scheme check is the very first step, before any DNS
resolution, so scheme-abuse payloads are rejected cheaply.

**Rejection behavior**: HTTP 422, `reason: "blocked: scheme 'file:' not
allowed"`.

---

### Point 7 — Timeout and Size Cap

**Threat**:
- **Slow-read**: An attacker-controlled server sends response headers
  immediately but then trickles 1 byte per second forever, holding the
  connection open and exhausting the Node.js event loop.
- **Large-file DoS**: An attacker returns a multi-gigabyte response body that
  exhausts process memory before the application can react.

**Limits**:

| Parameter | Value | Override |
|---|---|---|
| Connect timeout | 5 seconds | Not configurable |
| Read timeout | 30 seconds | Not configurable |
| Max response size | Per call site (see Size Cap Policy below) | `SSRF_MAX_RESPONSE_MB` env var overrides all |

The connect timeout is enforced by setting `socket.setTimeout` before the
request is dispatched. The read timeout is enforced by a `setTimeout` that
destroys the socket if the response body is not fully received within 30 seconds
of the first data event.

The size cap is enforced by accumulating response chunks and calling
`socket.destroy()` as soon as `totalBytes > maxBytes`. The partial data is
discarded.

#### Size Cap Policy

**OQ2 is resolved: Baileys accepts a `Readable` stream.**

`WAMediaUpload` in Baileys 6.7.21 is typed as:

```typescript
export type WAMediaPayloadStream = { stream: Readable };
export type WAMediaUpload = Buffer | WAMediaPayloadStream | WAMediaPayloadURL;
```

Baileys imports `Readable` from Node's `'stream'` module and accepts it
natively via the `{ stream: Readable }` wrapper shape. This means `safeFetch`
does not have to buffer the entire response body into memory for large media
types.

**Chosen approach: Option A — stream for large media, buffer for small media.**

`SafeFetchResponse` exposes two consumption methods:

```typescript
export interface SafeFetchResponse {
  status: number;
  headers: Record<string, string>;
  buffer(): Promise<Buffer>;   // accumulates into memory; size-capped
  text():   Promise<string>;   // accumulates into memory; size-capped
  json<T = unknown>(): Promise<T>; // accumulates into memory; size-capped
  stream(): Readable;          // size-capped, timeout-enforced Node.js Readable
}
```

`stream()` returns a `Readable` that enforces the size cap inline: it destroys
itself and emits an error as soon as `totalBytes > maxBytes`. It also enforces
the read timeout from the moment the first data event fires. The adapter passes
the result directly to Baileys as `{ stream: safeFetch(url).stream() }`.

**Per-call-site `maxBytes`** is passed as `options.maxBytes` to `safeFetch()`.
The caller supplies the appropriate limit for the media type. Default limits:

| Call site | Method | Default cap | Consumption |
|---|---|---|---|
| `sendImage` | `safeFetch` | 10 MiB | `buffer()` |
| `sendSticker` | `safeFetch` | 10 MiB | `buffer()` |
| `sendViewOnce` | `safeFetch` | 10 MiB | `buffer()` |
| `sendAudio` (voice note / audio) | `safeFetch` | 25 MiB | `buffer()` |
| `sendVideo` | `safeFetch` | 100 MiB | `stream()` |
| `sendGif` | `safeFetch` | 100 MiB | `stream()` |
| `sendDocument` | `safeFetch` | 100 MiB | `stream()` |
| `updateGroupPicture` | `safeFetch` | 5 MiB | `buffer()` |
| `updateOwnProfilePicture` | `safeFetch` | 5 MiB | `buffer()` |
| Webhook service POST | `safeFetch` | 1 MiB | `json()` / `text()` |

The `SSRF_MAX_RESPONSE_MB` environment variable, when set, overrides the
`maxBytes` for all call sites regardless of the per-call-site default. This is
an emergency escape hatch for deployments where the defaults are too
restrictive; it should not be used as a substitute for setting appropriate
per-call-site limits.

Rationale for `stream()` on video/gif/document: these file types routinely
reach 64–100 MiB on WhatsApp. Buffering them in full before handing to Baileys
would double peak memory usage (OQ1). Using `stream()` keeps only the
in-flight TCP window in memory at any given moment. Images, stickers, voice
notes, and profile pictures are small enough that the simpler `buffer()` path
is appropriate.

**Rejection behavior**:
- Connect timeout: `SsrfTimeoutError`; NestJS maps this to **HTTP 504 Gateway
  Timeout** with body `{ "error": "UPSTREAM_TIMEOUT" }`.
- Read timeout: same HTTP 504.
- Size exceeded: HTTP 422, `reason: "blocked: response size exceeded 10 MiB"`.

---

### Point 8 — Single Shared Utility: `safeFetch()`

**File**: `packages/wa-server/src/common/safe-fetch.ts`

There is exactly one implementation of the SSRF defense. No per-endpoint
validation logic. No copy-paste.

**Function signature** (repeated here for completeness):

```typescript
export async function safeFetch(
  url: string,
  options?: SafeFetchOptions,
): Promise<SafeFetchResponse>
```

**Error contract**: Throws `SsrfBlockedError` or `SsrfTimeoutError`. All other
network errors propagate as-is so the caller can decide whether to log or
swallow them (the webhook service currently silences all errors; the adapter
methods should propagate).

**NestJS exception filter**: A new `SsrfExceptionFilter` is registered globally
and maps `SsrfBlockedError` → 422, `SsrfTimeoutError` → 504.

---

## Test Cases

These are the specific cases `qa-tester` must execute. Each case states the
input URL, the expected outcome, and the HTTP status the API endpoint returns.

### IPv4 Blocked Ranges

| # | URL | Expected outcome | API status |
|---|---|---|---|
| T01 | `http://127.0.0.1/secret` | Blocked: loopback | 422 |
| T02 | `http://127.255.255.255/` | Blocked: loopback | 422 |
| T03 | `http://10.0.0.1/` | Blocked: RFC 1918 class A | 422 |
| T04 | `http://10.255.255.255/` | Blocked: RFC 1918 class A | 422 |
| T05 | `http://172.16.0.1/` | Blocked: RFC 1918 class B | 422 |
| T06 | `http://172.31.255.255/` | Blocked: RFC 1918 class B | 422 |
| T07 | `http://192.168.0.1/` | Blocked: RFC 1918 class C | 422 |
| T08 | `http://192.168.255.255/` | Blocked: RFC 1918 class C | 422 |
| T09 | `http://169.254.1.1/` | Blocked: link-local | 422 |
| T10 | `http://0.0.0.1/` | Blocked: unspecified | 422 |
| T11 | `http://224.0.0.1/` | Blocked: multicast | 422 |
| T12 | `http://240.0.0.1/` | Blocked: reserved | 422 |

### IPv6 Blocked

| # | URL | Expected outcome | API status |
|---|---|---|---|
| T13 | `http://[::1]/` | Blocked: IPv6 loopback | 422 |
| T14 | `http://[fe80::1]/` | Blocked: link-local | 422 |
| T15 | `http://[fc00::1]/` | Blocked: unique local | 422 |
| T16 | `http://[fd00::1]/` | Blocked: unique local (fd00::/8) | 422 |

### IPv4-Mapped IPv6 (bypass attempt)

| # | URL | Expected outcome | API status |
|---|---|---|---|
| T17 | `http://[::ffff:169.254.169.254]/` | Blocked: IPv4-mapped → link-local | 422 |
| T18 | `http://[::ffff:10.0.0.1]/` | Blocked: IPv4-mapped → RFC 1918 | 422 |
| T19 | `http://[::ffff:192.168.1.1]/` | Blocked: IPv4-mapped → RFC 1918 | 422 |

### Cloud Metadata Endpoints

| # | URL | Expected outcome | API status |
|---|---|---|---|
| T20 | `http://169.254.169.254/latest/meta-data/` | Blocked: cloud metadata (link-local) | 422 |
| T21 | `http://169.254.169.254/latest/meta-data/iam/` | Blocked: cloud metadata | 422 |
| T22 | `http://100.100.100.200/latest/meta-data/` | Blocked: cloud metadata (Alibaba) | 422 |
| T23 | `http://[fd00:ec2::254]/` | Blocked: unique local (AWS IPv6 metadata) | 422 |

### DNS Rebinding Simulation

| # | Scenario | Expected outcome | API status |
|---|---|---|---|
| T24 | Set up a local DNS server (e.g. `dnsmasq`) that returns `203.0.113.1` (public TEST-NET) on first query and `169.254.169.254` on subsequent queries for the same hostname. Point the test to that hostname. Call `safeFetch`. | `safeFetch` resolves once, gets `203.0.113.1`, connects to `203.0.113.1` directly. The second DNS query never fires. The rebind has no effect. Verify via packet capture that no connection attempt is made to `169.254.169.254`. | 200 (or whatever the test server returns) |

### Redirect Chain Attacks

| # | Scenario | Expected outcome | API status |
|---|---|---|---|
| T25 | Server at `https://public.example.test` returns `302 Location: http://169.254.169.254/` | Blocked: redirect to link-local at hop 1 | 422 |
| T26 | Chain of 4 redirects, all to valid public URLs | Blocked: redirect limit (3) exceeded | 422 |
| T27 | `https://public.example.test` → `302 http://public.example.test/page` (scheme downgrade) | Blocked: https→http scheme downgrade | 422 |
| T28 | Chain of 2 redirects, all valid HTTPS public URLs | Passes; final response returned | 200 |

### Scheme Abuse

| # | URL | Expected outcome | API status |
|---|---|---|---|
| T29 | `file:///etc/passwd` | Blocked: scheme 'file:' not allowed | 422 |
| T30 | `file:///proc/self/environ` | Blocked: scheme 'file:' not allowed | 422 |
| T31 | `gopher://127.0.0.1:25/_EHLO` | Blocked: scheme 'gopher:' not allowed | 422 |
| T32 | `ftp://internal.host/` | Blocked: scheme 'ftp:' not allowed | 422 |
| T33 | `data:text/plain,hello` | Blocked: scheme 'data:' not allowed | 422 |
| T34 | `javascript:alert(1)` | Blocked: scheme 'javascript:' not allowed | 422 |
| T35 | `http://legitimate.host/` in `NODE_ENV=production` | Blocked: 'http:' not allowed in production | 422 |

### Valid URL (Confirm Pass)

| # | URL | Expected outcome | API status |
|---|---|---|---|
| T36 | `https://upload.wikimedia.org/wikipedia/commons/thumb/...` (a real public image) | Passes all checks; response buffer returned | 200 |

### Timeout Behavior

| # | Scenario | Expected outcome | API status |
|---|---|---|---|
| T37 | Server accepts TCP connection but sends no data for 10 seconds (simulated with `nc -l` or a slow server fixture) | Connect timeout fires at 5 s; `SsrfTimeoutError` thrown | 504 |
| T38 | Server sends headers immediately but streams body 1 byte/sec indefinitely | Read timeout fires at 30 s after first data byte | 504 |
| T39 | Server returns a response body of exactly `SSRF_MAX_RESPONSE_MB + 1` MiB | Size cap triggered; request aborted | 422 |

---

## Integration Points

### Webhook service (`src/webhooks/webhook.service.ts`)

Current implementation uses `http.request` / `https.request` directly with no
IP validation or scheme restriction. The URL is stored from the environment
variable `DASHBOARD_WEBHOOK_URL` set by the Dashboard at registration time.

**Required change**: The `private post(url, payload)` method replaces the
raw `http.request` / `https.request` call with `safeFetch(url, { method:
'POST', body: JSON.stringify(payload), headers: { ... } })`. No other changes
to the service's public interface.

Note: `DASHBOARD_WEBHOOK_URL` could in theory point to an internal address if
the Dashboard itself is compromised or misconfigured. The SSRF filter protects
against this.

### Baileys adapter (`src/whatsapp/baileys.adapter.ts`)

Seven of the nine call sites pass `{ url: new URL(mediaUrl) }` to Baileys.
Baileys fetches the URL internally using its own HTTP client. There is no hook
to inject a custom agent into Baileys' download path without modifying Baileys
itself (prohibited by the Architecture Rule).

**Required change for all seven `{ url }` sites**: Pre-fetch the media using
`safeFetch(mediaUrl, { maxBytes })` and pass the result to Baileys as either a
`Buffer` (small media) or a `{ stream: Readable }` (large media), per the Size
Cap Policy in Point 7. Examples:

```
// Small media — buffer path
image: { url: new URL(imageUrl) }
  →  image: await safeFetch(imageUrl, { maxBytes: 10 * MiB }).then(r => r.buffer())

// Large media — stream path (avoids loading full file into memory)
video: { url: new URL(videoUrl) }
  →  video: { stream: safeFetch(videoUrl, { maxBytes: 100 * MiB }).stream() }
```

This also eliminates a double-fetch (previously Baileys fetched from the URL;
now we fetch once and hand the data to Baileys).

**Required change for the two `fetch()` sites** (`updateGroupPicture` and
`updateOwnProfilePicture`): Replace the global `fetch(imageUrl)` call with
`safeFetch(imageUrl, { maxBytes: 5 * MiB })` and adapt the buffer extraction.
The calling pattern is already buffer-based, so the change is minimal.

**Summary of all 9 adapter call sites**:

| Method | Current pattern | New pattern | Cap |
|---|---|---|---|
| `sendImage` | `image: { url: new URL(imageUrl) }` | `image: await safeFetch(imageUrl, {maxBytes}).then(r => r.buffer())` | 10 MiB |
| `sendSticker` | `sticker: { url: new URL(stickerUrl) }` | `sticker: await safeFetch(stickerUrl, {maxBytes}).then(r => r.buffer())` | 10 MiB |
| `sendViewOnce` | `image: { url: new URL(imageUrl), viewOnce }` | `image: await safeFetch(imageUrl, {maxBytes}).then(r => r.buffer())` | 10 MiB |
| `sendAudio` | `audio: { url: new URL(audioUrl) }` | `audio: await safeFetch(audioUrl, {maxBytes}).then(r => r.buffer())` | 25 MiB |
| `sendVideo` | `video: { url: new URL(videoUrl) }` | `video: { stream: safeFetch(videoUrl, {maxBytes}).stream() }` | 100 MiB |
| `sendGif` | `video: { url: new URL(gifUrl) }` | `video: { stream: safeFetch(gifUrl, {maxBytes}).stream() }` | 100 MiB |
| `sendDocument` | `document: { url: new URL(docUrl) }` | `document: { stream: safeFetch(docUrl, {maxBytes}).stream() }` | 100 MiB |
| `updateGroupPicture` | `fetch(imageUrl)` | `safeFetch(imageUrl, {maxBytes})` | 5 MiB |
| `updateOwnProfilePicture` | `fetch(imageUrl)` | `safeFetch(imageUrl, {maxBytes})` | 5 MiB |

---

## New Dependency

**`ipaddr.js`** — to be added to `packages/wa-server/package.json` `dependencies`.

- Version: latest stable (`^2.2.0` at time of writing)
- Already used by `ssrf-req-filter` in the ecosystem; well-maintained
- Handles IPv4, IPv6, IPv4-mapped IPv6, and CIDR range matching correctly
- No transitive dependencies
- CJS-compatible; works with `pkg` packaging

---

## Open Questions / Risks

### OQ1 — Baileys buffer memory pressure

Partially resolved by OQ2. Video, gif, and document call sites now use
`stream()` rather than `buffer()`, eliminating the full-file allocation for
large media. For `sendAudio` (25 MiB cap) and `sendImage`/`sendSticker`/
`sendViewOnce` (10 MiB cap) the buffer path is retained; these file sizes are
small enough that the memory cost is acceptable. `SSRF_MAX_RESPONSE_MB` remains
available as an emergency override.

### OQ2 — Baileys streaming API — RESOLVED

**Conclusion: YES, Baileys accepts a `Readable` stream.**

Evidence from
`@whiskeysockets/baileys@6.7.21` type definitions
(`lib/Types/Message.d.ts`):

```typescript
import type { Readable } from 'stream';
export type WAMediaPayloadStream = { stream: Readable };
export type WAMediaUpload = Buffer | WAMediaPayloadStream | WAMediaPayloadURL;
```

`WAMediaUpload` is a union of `Buffer`, `{ stream: Readable }`, and
`{ url: URL | string }`. Baileys accepts all three forms for all media fields
(`image`, `video`, `audio`, `document`, `sticker`).

`safeFetch()` therefore exposes a `stream()` method returning a size-capped,
timeout-enforced `Readable`. The adapter passes `{ stream: safeFetch(url, {maxBytes}).stream() }`
to Baileys for video, gif, and document uploads. See the Size Cap Policy
subsection in Point 7 for the full per-call-site breakdown.

### OQ3 — Webhook service error handling

The webhook service currently silences all errors (`catch (err) { console.warn
... }`). `SsrfBlockedError` for `DASHBOARD_WEBHOOK_URL` would indicate a
misconfigured or compromised Dashboard. This should be an alerting event, not a
silent warn. The implementation agent should decide whether to promote this to
an error log or a structured alert.

### OQ4 — IPv6 external targets

The design defaults to blocking all external IPv6 targets for simplicity. If
the production environment needs to fetch media from IPv6-only CDNs, the
`SSRF_ALLOW_IPV6=true` environment variable re-enables IPv6 resolution while
still blocking all internal IPv6 ranges. This must be verified during
deployment.

### OQ5 — `pkg` packaging and DNS resolution

The WA Server is packaged into a self-contained binary using `pkg`. `dns.promises`
is part of Node's built-in module set and is always available inside a `pkg`
binary. No bundling concern. However, the `ipaddr.js` package must be listed
in `pkg.assets` or resolved correctly by `pkg`'s module scanner. This should be
verified in the `npm run pkg:linux` build during the QA phase.

### OQ6 — `100.100.100.200` port scan scope

The Alibaba Cloud ECS metadata endpoint is blocked by IP address. An attacker
operating a different internal service at `100.100.100.200` on a non-standard
port would also be blocked. This is desirable behavior and should be documented
as intentional.

### OQ7 — DNS resolution method — RESOLVED

**Conclusion: use `dns.promises.resolve4` + `dns.promises.resolve6`.**

`dns.promises.lookup` uses the OS resolver and respects `/etc/hosts`. An
attacker with write access to `/etc/hosts` (e.g. via a container escape) could
map an arbitrary hostname to a blocked IP and bypass all validation.

`dns.promises.resolve4` and `dns.promises.resolve6` query DNS directly,
bypassing `/etc/hosts` and NSSwitch. They are called in parallel via
`Promise.allSettled`. If `resolve6` rejects (NXDOMAIN — no AAAA records for
the hostname), the IPv6 list is treated as empty and the request proceeds
normally. This is the method used throughout Point 4 and referenced in Points
1 and 2 of this document.
