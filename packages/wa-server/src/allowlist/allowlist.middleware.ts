import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import * as net from 'node:net';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type AllowlistEntry =
  | { family: 4; networkInt: number; maskInt: number }
  | { family: 6; networkBig: bigint; maskBig: bigint };

// ---------------------------------------------------------------------------
// IPv6 expansion helper — no npm package
// ---------------------------------------------------------------------------

function expandIPv6(addr: string): string | null {
  if (!net.isIPv6(addr)) return null;
  if (addr.includes('::')) {
    const sides = addr.split('::');
    const left = sides[0] ? sides[0].split(':') : [];
    const right = sides[1] ? sides[1].split(':') : [];
    const missing = 8 - left.length - right.length;
    const middle = Array(missing).fill('0000');
    return [...left, ...middle, ...right].map(g => g.padStart(4, '0')).join(':');
  }
  return addr.split(':').map(g => g.padStart(4, '0')).join(':');
}

// ---------------------------------------------------------------------------
// IPv6 BigInt conversion
// ---------------------------------------------------------------------------

function ipv6ToBigInt(addr: string): bigint | null {
  const expanded = expandIPv6(addr);
  if (expanded === null) return null;
  const groups = expanded.split(':');
  if (groups.length !== 8) return null;
  let result = 0n;
  for (const group of groups) {
    const n = parseInt(group, 16);
    if (isNaN(n) || n < 0 || n > 0xffff) return null;
    result = (result << 16n) | BigInt(n);
  }
  return result;
}

// ---------------------------------------------------------------------------
// IPv4 CIDR parsing — returns null on any invalid input
// ---------------------------------------------------------------------------

function parseIPv4Entry(entry: string): AllowlistEntry | null {
  const slashIdx = entry.indexOf('/');
  const ipPart = slashIdx === -1 ? entry : entry.slice(0, slashIdx);
  const prefixPart = slashIdx === -1 ? '32' : entry.slice(slashIdx + 1);

  if (!net.isIPv4(ipPart)) return null;

  const octets = ipPart.split('.');
  if (octets.length !== 4) return null;

  let networkInt = 0;
  for (const octet of octets) {
    const n = parseInt(octet, 10);
    if (isNaN(n) || n < 0 || n > 255) return null;
    networkInt = (networkInt << 8) | n;
  }

  const prefix = parseInt(prefixPart, 10);
  if (isNaN(prefix) || prefix < 0 || prefix > 32) return null;

  const maskInt = prefix === 0 ? 0 : (~0 << (32 - prefix)) >>> 0;
  networkInt = networkInt >>> 0;

  return { family: 4, networkInt: networkInt & maskInt, maskInt };
}

// ---------------------------------------------------------------------------
// IPv6 CIDR parsing — uses BigInt
// ---------------------------------------------------------------------------

function parseIPv6Entry(entry: string): AllowlistEntry | null {
  const slashIdx = entry.lastIndexOf('/');
  const ipPart = slashIdx === -1 ? entry : entry.slice(0, slashIdx);
  const prefixPart = slashIdx === -1 ? '128' : entry.slice(slashIdx + 1);

  if (!net.isIPv6(ipPart)) return null;

  const networkBig = ipv6ToBigInt(ipPart);
  if (networkBig === null) return null;

  const prefix = parseInt(prefixPart, 10);
  if (isNaN(prefix) || prefix < 0 || prefix > 128) return null;

  const maskBig =
    prefix === 0 ? 0n : ((1n << 128n) - 1n) - ((1n << BigInt(128 - prefix)) - 1n);

  return { family: 6, networkBig: networkBig & maskBig, maskBig };
}

// ---------------------------------------------------------------------------
// normalizeIP — strips ::ffff: prefix for IPv4-mapped IPv6
// ---------------------------------------------------------------------------

function normalizeIP(raw: string): { family: 4 | 6; addr: string } | null {
  if (raw.startsWith('::ffff:') && net.isIPv4(raw.slice(7))) {
    return { family: 4, addr: raw.slice(7) };
  }
  if (net.isIPv4(raw)) {
    return { family: 4, addr: raw };
  }
  if (net.isIPv6(raw)) {
    return { family: 6, addr: raw };
  }
  return null;
}

// ---------------------------------------------------------------------------
// parseEntry — tries IPv4 first, then IPv6
// ---------------------------------------------------------------------------

function parseEntry(entry: string): AllowlistEntry | null {
  const trimmed = entry.trim();
  return parseIPv4Entry(trimmed) ?? parseIPv6Entry(trimmed);
}

// ---------------------------------------------------------------------------
// initAllowlist — called once at module load
// ---------------------------------------------------------------------------

function initAllowlist(): AllowlistEntry[] {
  const raw = process.env.ALLOWED_IPS ?? '';
  if (!raw.trim()) return [];
  return raw
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
    .reduce<AllowlistEntry[]>((acc, entry) => {
      const parsed = parseEntry(entry);
      if (!parsed) console.warn(`[Allowlist] Malformed entry skipped: "${entry}"`);
      else acc.push(parsed);
      return acc;
    }, []);
}

// ---------------------------------------------------------------------------
// isAllowed — iterate ALLOWLIST, return true on first match
// ---------------------------------------------------------------------------

function isAllowed(
  normalized: { family: 4 | 6; addr: string },
  list: AllowlistEntry[],
): boolean {
  for (const entry of list) {
    if (entry.family !== normalized.family) continue;

    if (entry.family === 4) {
      const octets = normalized.addr.split('.');
      if (octets.length !== 4) continue;
      let clientInt = 0;
      let valid = true;
      for (const octet of octets) {
        const n = parseInt(octet, 10);
        if (isNaN(n) || n < 0 || n > 255) { valid = false; break; }
        clientInt = (clientInt << 8) | n;
      }
      if (!valid) continue;
      clientInt = clientInt >>> 0;
      if ((clientInt & entry.maskInt) === entry.networkInt) return true;
    } else {
      const clientBig = ipv6ToBigInt(normalized.addr);
      if (clientBig === null) continue;
      if ((clientBig & entry.maskBig) === entry.networkBig) return true;
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// Module-level constants — computed once at import time
// ---------------------------------------------------------------------------

const ALLOWLIST: AllowlistEntry[] = initAllowlist();
const ALLOWLIST_ENABLED: boolean = (process.env.ALLOWED_IPS ?? '').trim().length > 0;
// Strip leading/trailing slashes from SWAGGER_PATH to match main.ts normalisation
const swaggerBase = '/' + (process.env.SWAGGER_PATH ?? 'api/docs').replace(/^\/+|\/+$/g, '');
const BYPASS_PATHS = new Set([
  '/api/health/live',
  '/api/health/ready',
  '/api/health/live/',   // trailing-slash variants for load-balancers that append /
  '/api/health/ready/',
  '/api/reference',      // Scalar UI — publicly readable by design
  '/api/docs-json',      // OpenAPI spec — Scalar reads from this
  swaggerBase,           // old Swagger path (now redirects to /api/reference)
  swaggerBase + '-json',
]);

// ---------------------------------------------------------------------------
// AllowlistMiddleware
// ---------------------------------------------------------------------------

@Injectable()
export class AllowlistMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    if (!ALLOWLIST_ENABLED) return next();

    const urlPath = req.originalUrl.split('?')[0];
    if (BYPASS_PATHS.has(urlPath)) return next();

    // SECURITY: Only set TRUST_PROXY=true if your reverse proxy strips existing
    // X-Forwarded-For headers before appending the real client IP. Otherwise
    // any client can spoof their source IP and bypass the allowlist entirely.
    const trustProxy = process.env.TRUST_PROXY === 'true';
    const rawIP: string =
      (trustProxy
        ? (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0].trim()
        : undefined) ??
      req.ip ??
      '';

    const normalized = normalizeIP(rawIP);
    if (normalized && isAllowed(normalized, ALLOWLIST)) return next();

    const safeIP = rawIP.replace(/[\r\n\t\x00-\x1f\x7f]/g, '_');
    const safePath = urlPath.replace(/[\r\n\t\x00-\x1f\x7f]/g, '_');
    console.warn(`[Allowlist] Blocked: ${safeIP} → ${req.method} ${safePath}`);
    res.status(403).json({ statusCode: 403, error: 'Forbidden' });
  }
}
