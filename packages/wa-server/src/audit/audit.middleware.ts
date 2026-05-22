import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import * as crypto from 'crypto';
import * as http from 'http';
import * as https from 'https';

// Computed once at module load — never per-request
const WA_TOKEN = process.env.WA_TOKEN ?? '';
const ACTOR_TOKEN_PREFIX = crypto.createHash('sha256').update(WA_TOKEN).digest('hex').slice(0, 8);

const EXCLUDED_PATHS = new Set([
  '/health', '/health/live', '/health/ready',
  '/docs', '/docs-json',
]);

function isAuditable(method: string, statusCode: number): boolean {
  return ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method) || statusCode >= 400;
}

@Injectable()
export class AuditMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    // req.path is always '/' in NestJS MiddlewareConsumer — use originalUrl and strip global prefix
    const path = req.originalUrl.split('?')[0].replace(/^\/api/, '') || '/';

    res.on('finish', () => {
      // AuditMiddleware MUST NEVER throw or block — all errors caught and console.warn'd
      try {
        if (EXCLUDED_PATHS.has(path)) return;
        if (!isAuditable(req.method, res.statusCode)) {
          // GET 2xx — stdout debug only, not sent to dashboard
          console.log(JSON.stringify({
            audit: true, level: 'debug',
            method: req.method, path, statusCode: res.statusCode,
            actorTokenPrefix: ACTOR_TOKEN_PREFIX,
          }));
          return;
        }

        const trustProxy = process.env.TRUST_PROXY === 'true';
        const ipAddress = (
          trustProxy
            ? (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0].trim()
            : undefined
        ) ?? req.ip ?? 'unknown';

        // sessionId from path: /sessions/:sessionId/...
        const sessionMatch = path.match(/^\/sessions\/([^/]+)/);
        const sessionId = sessionMatch ? sessionMatch[1] : null;

        // requestHash: only for mutating methods with a body
        let requestHash: string | null = null;
        if (['POST', 'PUT', 'PATCH'].includes(req.method) && req.body) {
          requestHash = crypto
            .createHash('sha256')
            .update(JSON.stringify(req.body))
            .digest('hex')
            .slice(0, 16);
        }

        const event = {
          sessionId,
          actorTokenPrefix: ACTOR_TOKEN_PREFIX,
          method: req.method,
          endpoint: path,
          statusCode: res.statusCode,
          requestHash,
          ipAddress: ipAddress.slice(0, 45),
        };

        // Always log to stdout
        console.log(JSON.stringify({ audit: true, ...event }));

        // Fire-and-forget POST to dashboard-api using native http/https.
        // AUDIT_DASHBOARD_URL is operator-configured (not user-supplied), so safeFetch's
        // SSRF protection is not appropriate here — it would block private/localhost addresses
        // used in self-hosted deployments where wa-server and dashboard-api run on the same host.
        const auditUrl = process.env.AUDIT_DASHBOARD_URL;
        const secret = process.env.INTERNAL_WEBHOOK_SECRET ?? '';
        if (auditUrl) {
          try {
            const parsed = new URL(auditUrl);
            const mod = parsed.protocol === 'https:' ? https : http;
            const body = JSON.stringify(event);
            const req = mod.request({
              hostname: parsed.hostname,
              port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
              path: parsed.pathname,
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-Internal-Secret': secret,
                'Content-Length': Buffer.byteLength(body),
              },
            });
            req.on('error', (err) => {
              console.warn('[Audit] Failed to deliver audit event:', err.message);
            });
            req.write(body);
            req.end();
          } catch (deliveryErr) {
            console.warn('[Audit] Failed to deliver audit event:', (deliveryErr as Error).message);
          }
        }
      } catch (err) {
        // MUST NOT propagate — response is already sent
        console.warn('[Audit] Unexpected error in audit middleware:', (err as Error).message);
      }
    });

    next();
  }
}
