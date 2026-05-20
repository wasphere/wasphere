import * as dns from 'dns';
import * as http from 'http';
import * as https from 'https';
import { PassThrough, Readable } from 'stream';
import * as ipaddr from 'ipaddr.js';

// ─── Error types ────────────────────────────────────────────────────────────

export class SsrfBlockedError extends Error {
  constructor(
    public readonly url: string,
    public readonly reason: string,
  ) {
    super(`SSRF blocked: ${reason} (url: ${url})`);
    this.name = 'SsrfBlockedError';
  }
}

export class SsrfTimeoutError extends Error {
  constructor(public readonly url: string) {
    super(`SSRF timeout (url: ${url})`);
    this.name = 'SsrfTimeoutError';
  }
}

// ─── Public API types ────────────────────────────────────────────────────────

export interface SafeFetchOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  headers?: Record<string, string>;
  body?: string | Buffer;
  maxBytes?: number;
}

export interface SafeFetchResponse {
  status: number;
  headers: Record<string, string>;
  buffer(): Promise<Buffer>;
  text(): Promise<string>;
  json<T = unknown>(): Promise<T>;
  stream(): Readable;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CONNECT_TIMEOUT_MS = 5_000;
const READ_TIMEOUT_MS = 30_000;
const MAX_REDIRECTS = 3;

// Explicit denylist — IPs that are not caught by range checks
// (e.g. 100.100.100.200 is publicly routable but is Alibaba Cloud ECS metadata)
const EXPLICIT_DENY: string[] = ['100.100.100.200'];

// IPv4 blocked CIDR ranges
const IPV4_BLOCKED_RANGES: Array<[ipaddr.IPv4, number]> = [
  [ipaddr.IPv4.parse('127.0.0.0'), 8],    // Loopback
  [ipaddr.IPv4.parse('10.0.0.0'), 8],     // RFC 1918 class A
  [ipaddr.IPv4.parse('172.16.0.0'), 12],  // RFC 1918 class B
  [ipaddr.IPv4.parse('192.168.0.0'), 16], // RFC 1918 class C
  [ipaddr.IPv4.parse('169.254.0.0'), 16], // Link-local (covers AWS/GCP/Azure IMDS)
  [ipaddr.IPv4.parse('0.0.0.0'), 8],      // Unspecified
  [ipaddr.IPv4.parse('224.0.0.0'), 4],    // Multicast
  [ipaddr.IPv4.parse('240.0.0.0'), 4],    // Reserved / future
];

const IPV4_RANGE_LABELS: string[] = [
  'loopback 127.0.0.0/8',
  'private IPv4 range 10.0.0.0/8',
  'private IPv4 range 172.16.0.0/12',
  'private IPv4 range 192.168.0.0/16',
  'link-local 169.254.0.0/16',
  'unspecified 0.0.0.0/8',
  'multicast 224.0.0.0/4',
  'reserved 240.0.0.0/4',
];

// IPv6 blocked CIDR ranges
const IPV6_BLOCKED_RANGES: Array<[ipaddr.IPv6, number]> = [
  [ipaddr.IPv6.parse('::1'), 128],        // Loopback
  [ipaddr.IPv6.parse('fe80::'), 10],      // Link-local
  [ipaddr.IPv6.parse('fc00::'), 7],       // Unique local (includes fd00::/8)
  [ipaddr.IPv6.parse('::ffff:0:0'), 96],  // IPv4-mapped
  [ipaddr.IPv6.parse('fec0::'), 10],      // Deprecated site-local
  [ipaddr.IPv6.parse('2002::'), 16],      // 6to4
  [ipaddr.IPv6.parse('::'), 128],         // Unspecified ::/128
];

const IPV6_RANGE_LABELS: string[] = [
  'IPv6 loopback ::1',
  'IPv6 link-local fe80::/10',
  'IPv6 unique local fc00::/7',
  'IPv4-mapped address',
  'IPv6 deprecated site-local fec0::/10',
  'IPv6 6to4 2002::/16',
  'IPv6 unspecified ::/128',
];

// ─── IP validation ────────────────────────────────────────────────────────────

function checkIPv4Blocked(ip: ipaddr.IPv4, rawStr: string): string | null {
  if (EXPLICIT_DENY.includes(rawStr)) {
    return `blocked: cloud metadata endpoint ${rawStr} (Alibaba Cloud ECS)`;
  }
  for (let i = 0; i < IPV4_BLOCKED_RANGES.length; i++) {
    const [range, prefix] = IPV4_BLOCKED_RANGES[i];
    if (ip.match(range, prefix)) {
      return `blocked: ${IPV4_RANGE_LABELS[i]}`;
    }
  }
  return null;
}

function checkIPv6Blocked(ip: ipaddr.IPv6, rawStr: string): string | null {
  // Check explicit denylist first
  if (EXPLICIT_DENY.includes(rawStr)) {
    return `blocked: cloud metadata endpoint ${rawStr}`;
  }

  for (let i = 0; i < IPV6_BLOCKED_RANGES.length; i++) {
    const [range, prefix] = IPV6_BLOCKED_RANGES[i];
    if (ip.match(range, prefix)) {
      // For IPv4-mapped, extract and re-check the embedded IPv4
      if (i === 3 /* ::ffff:0:0/96 */) {
        const embedded = ip.toIPv4Address();
        const embedReason = checkIPv4Blocked(embedded, embedded.toString());
        if (embedReason) {
          return `blocked: IPv4-mapped address ::ffff:${embedded.toString()} — ${embedReason}`;
        }
        // IPv4-mapped to a public address — still block by default
        // (we don't allow IPv4-mapped regardless)
        return `blocked: IPv4-mapped address ::ffff:${embedded.toString()}`;
      }
      return `blocked: ${IPV6_RANGE_LABELS[i]}`;
    }
  }
  return null;
}

/**
 * Validate a single IP string. Returns a block reason string or null if allowed.
 * Does NOT throw — callers collect reasons and decide.
 */
function validateIp(ipStr: string): string | null {
  let parsed: ipaddr.IPv4 | ipaddr.IPv6;
  try {
    parsed = ipaddr.parse(ipStr);
  } catch {
    return `blocked: unparseable IP address '${ipStr}'`;
  }

  if (parsed.kind() === 'ipv4') {
    return checkIPv4Blocked(parsed as ipaddr.IPv4, ipStr);
  } else {
    const allow6 = process.env.SSRF_ALLOW_IPV6 === 'true';
    const reason = checkIPv6Blocked(parsed as ipaddr.IPv6, ipStr);
    if (reason) return reason;
    // Block all external IPv6 unless explicitly allowed
    if (!allow6) {
      return `blocked: IPv6 not allowed (set SSRF_ALLOW_IPV6=true to enable)`;
    }
    return null;
  }
}

// ─── DNS resolution ───────────────────────────────────────────────────────────

async function resolveHostname(hostname: string): Promise<string[]> {
  const [v4Result, v6Result] = await Promise.allSettled([
    dns.promises.resolve4(hostname),
    dns.promises.resolve6(hostname),
  ]);

  const ips: string[] = [];

  if (v4Result.status === 'fulfilled') {
    ips.push(...v4Result.value);
  }
  // v4 rejection (NXDOMAIN, etc.) means empty list — not fatal

  if (v6Result.status === 'fulfilled') {
    ips.push(...v6Result.value);
  }
  // v6 rejection is expected when no AAAA records exist — not fatal

  return ips;
}

// ─── Scheme check ─────────────────────────────────────────────────────────────

function checkScheme(scheme: string, rawUrl: string): void {
  const isProd = process.env.NODE_ENV === 'production';
  if (scheme === 'https:') return; // always allowed
  if (scheme === 'http:') {
    if (!isProd) return; // deferred — loopback check happens after DNS
    throw new SsrfBlockedError(rawUrl, `blocked: scheme 'http:' not allowed in production`);
  }
  throw new SsrfBlockedError(rawUrl, `blocked: scheme '${scheme}' not allowed`);
}

// ─── Select validated IP ──────────────────────────────────────────────────────

/**
 * Resolves hostname (or uses literal IP), validates all IPs, returns the first
 * valid IP to connect to. Throws SsrfBlockedError if all IPs are blocked.
 */
async function resolveAndValidate(parsedUrl: URL, rawUrl: string): Promise<string> {
  const hostname = parsedUrl.hostname;

  // Strip brackets from IPv6 literals — URL.hostname includes them
  const cleanHostname = hostname.startsWith('[') && hostname.endsWith(']')
    ? hostname.slice(1, -1)
    : hostname;

  // Check if hostname is already an IP literal
  let ips: string[];
  if (ipaddr.isValid(cleanHostname)) {
    ips = [cleanHostname];
  } else {
    ips = await resolveHostname(cleanHostname);
    if (ips.length === 0) {
      throw new SsrfBlockedError(rawUrl, `blocked: hostname '${cleanHostname}' resolved to no addresses`);
    }
  }

  // For http: in dev — only allow loopback
  if (parsedUrl.protocol === 'http:') {
    const allLoopback = ips.every((ip) => {
      try {
        const parsed = ipaddr.parse(ip);
        if (parsed.kind() === 'ipv4') {
          return (parsed as ipaddr.IPv4).match(ipaddr.IPv4.parse('127.0.0.0'), 8);
        }
        return ip === '::1';
      } catch {
        return false;
      }
    });
    if (!allLoopback) {
      throw new SsrfBlockedError(
        rawUrl,
        `blocked: scheme 'http:' only allowed for loopback addresses in non-production`,
      );
    }
  }

  // Validate every IP — collect reasons
  const reasons: string[] = [];
  for (const ip of ips) {
    const reason = validateIp(ip);
    if (reason) {
      reasons.push(`${ip}: ${reason}`);
    } else {
      return ip; // first valid IP wins
    }
  }

  // All IPs were blocked — log full detail server-side, return generic reason to caller
  console.error(`[safeFetch] SSRF blocked ${rawUrl}: ${reasons.join('; ')}`);
  throw new SsrfBlockedError(rawUrl, `blocked: all resolved addresses are private or reserved`);
}

// ─── maxBytes helper ──────────────────────────────────────────────────────────

function resolveMaxBytes(optionsMaxBytes?: number): number {
  const envMb = parseInt(process.env.SSRF_MAX_RESPONSE_MB ?? '', 10);
  if (!isNaN(envMb) && envMb > 0) return envMb * 1024 * 1024;
  if (optionsMaxBytes !== undefined && optionsMaxBytes > 0) return optionsMaxBytes;
  return 10 * 1024 * 1024; // 10 MiB default
}

// ─── Core _fetch ──────────────────────────────────────────────────────────────

interface InternalFetchResult {
  status: number;
  responseHeaders: Record<string, string>;
  rawResponse: http.IncomingMessage;
}

async function _fetch(
  rawUrl: string,
  options: SafeFetchOptions,
  hopCount: number,
  previousScheme: string | null,
): Promise<InternalFetchResult> {
  if (hopCount > MAX_REDIRECTS) {
    throw new SsrfBlockedError(rawUrl, `blocked: redirect limit (${MAX_REDIRECTS}) exceeded`);
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(rawUrl);
  } catch {
    throw new SsrfBlockedError(rawUrl, `blocked: invalid URL`);
  }

  const scheme = parsedUrl.protocol;

  // Scheme downgrade check (https -> http on redirect)
  if (previousScheme === 'https:' && scheme === 'http:') {
    throw new SsrfBlockedError(rawUrl, `blocked: https→http scheme downgrade on redirect`);
  }

  // Scheme allowlist check
  checkScheme(scheme, rawUrl);

  // DNS resolution + IP validation + IP pinning
  const validatedIp = await resolveAndValidate(parsedUrl, rawUrl);

  const lib = scheme === 'https:' ? https : http;
  const port = parsedUrl.port
    ? parseInt(parsedUrl.port)
    : scheme === 'https:'
      ? 443
      : 80;

  const path = (parsedUrl.pathname || '/') + (parsedUrl.search || '');

  return new Promise<InternalFetchResult>((resolve, reject) => {
    const baseOptions: http.RequestOptions = {
      host: validatedIp,        // connect to the pinned IP directly
      port,
      path,
      method: options.method ?? 'GET',
      headers: {
        ...(options.headers ?? {}),
        Host: parsedUrl.hostname, // restore original hostname for TLS SNI and vhosts
      },
    };
    // rejectUnauthorized is an https-only option — only add it for https requests
    const reqOptions: http.RequestOptions | https.RequestOptions =
      scheme === 'https:'
        ? { ...baseOptions, rejectUnauthorized: true } as https.RequestOptions
        : baseOptions;

    let connectTimedOut = false;
    let readTimedOut = false;

    const req = lib.request(reqOptions, (res) => {
      const status = res.statusCode ?? 0;
      const responseHeaders: Record<string, string> = {};
      for (const [k, v] of Object.entries(res.headers)) {
        if (typeof v === 'string') responseHeaders[k] = v;
        else if (Array.isArray(v)) responseHeaders[k] = v.join(', ');
      }

      // Handle redirects manually
      if (status >= 300 && status < 400) {
        const location = res.headers['location'];
        res.resume(); // drain the body
        if (!location) {
          return reject(new SsrfBlockedError(rawUrl, `blocked: redirect with no Location header`));
        }

        let nextUrl: string;
        try {
          nextUrl = new URL(location, rawUrl).toString();
        } catch {
          return reject(new SsrfBlockedError(rawUrl, `blocked: redirect has invalid Location: ${location}`));
        }

        _fetch(nextUrl, options, hopCount + 1, scheme)
          .then(resolve)
          .catch(reject);
        return;
      }

      resolve({ status, responseHeaders, rawResponse: res });
    });

    req.on('error', (err) => {
      if (connectTimedOut) {
        reject(new SsrfTimeoutError(rawUrl));
      } else {
        reject(err);
      }
    });

    // Connect timeout: fires if connection is not established within 5s
    req.setTimeout(CONNECT_TIMEOUT_MS, () => {
      connectTimedOut = true;
      req.destroy();
      reject(new SsrfTimeoutError(rawUrl));
    });

    if (options.body) {
      req.write(options.body);
    }
    req.end();
  });
}

// ─── safeFetch (public entry point) ──────────────────────────────────────────

export async function safeFetch(
  url: string,
  options: SafeFetchOptions = {},
): Promise<SafeFetchResponse> {
  const maxBytes = resolveMaxBytes(options.maxBytes);
  const result = await _fetch(url, options, 0, null);
  const { status, responseHeaders, rawResponse } = result;

  // Read-timeout state (shared across buffer/stream/text/json)
  let readTimer: NodeJS.Timeout | null = null;
  let readTimedOut = false;

  function startReadTimer(): void {
    if (readTimer) return;
    readTimer = setTimeout(() => {
      readTimedOut = true;
      rawResponse.destroy();
    }, READ_TIMEOUT_MS);
  }

  function clearReadTimer(): void {
    if (readTimer) {
      clearTimeout(readTimer);
      readTimer = null;
    }
  }

  return {
    status,
    headers: responseHeaders,

    stream(): Readable {
      const pass = new PassThrough();
      let total = 0;

      rawResponse.on('data', (chunk: Buffer) => {
        startReadTimer();
        total += chunk.length;
        if (total > maxBytes) {
          pass.destroy(
            new SsrfBlockedError(url, `blocked: response size exceeded ${Math.round(maxBytes / (1024 * 1024))} MiB`),
          );
          rawResponse.destroy();
          clearReadTimer();
          return;
        }
        pass.write(chunk);
      });

      rawResponse.on('end', () => {
        clearReadTimer();
        pass.end();
      });

      rawResponse.on('error', (err) => {
        clearReadTimer();
        if (readTimedOut) {
          pass.destroy(new SsrfTimeoutError(url));
        } else {
          pass.destroy(err);
        }
      });

      return pass;
    },

    buffer(): Promise<Buffer> {
      return new Promise<Buffer>((resolve, reject) => {
        const chunks: Buffer[] = [];
        let total = 0;

        rawResponse.on('data', (chunk: Buffer) => {
          startReadTimer();
          total += chunk.length;
          if (total > maxBytes) {
            clearReadTimer();
            rawResponse.destroy();
            reject(
              new SsrfBlockedError(url, `blocked: response size exceeded ${Math.round(maxBytes / (1024 * 1024))} MiB`),
            );
            return;
          }
          chunks.push(chunk);
        });

        rawResponse.on('end', () => {
          clearReadTimer();
          resolve(Buffer.concat(chunks));
        });

        rawResponse.on('error', (err) => {
          clearReadTimer();
          if (readTimedOut) {
            reject(new SsrfTimeoutError(url));
          } else {
            reject(err);
          }
        });
      });
    },

    async text(): Promise<string> {
      const buf = await this.buffer();
      return buf.toString('utf8');
    },

    async json<T = unknown>(): Promise<T> {
      const txt = await this.text();
      return JSON.parse(txt) as T;
    },
  };
}
