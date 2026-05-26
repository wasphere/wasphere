import { Injectable, OnModuleInit } from '@nestjs/common';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import * as http from 'http';
import * as https from 'https';

function computeSignature(secret: string, timestamp: number, rawBody: string): string {
  const signedString = `${timestamp}.${rawBody}`;
  const hex = crypto.createHmac('sha256', secret).update(signedString).digest('hex');
  return `v1,sha256=${hex}`;
}

export interface WebhookPayload {
  event: string;
  sessionId: string;
  timestamp: string;
  data: any;
}

// Persist the callback URL to disk so it survives container restarts.
// The sessions volume (/app/sessions) is already mounted as a named Docker
// volume, so this file outlives any individual container lifecycle.
const URL_PERSIST_PATH = path.join(
  process.env.SESSIONS_DIR ?? '/app/sessions',
  '.dashboard-callback-url',
);

function loadPersistedUrl(): string {
  try {
    const saved = fs.readFileSync(URL_PERSIST_PATH, 'utf8').trim();
    return saved || '';
  } catch {
    return '';
  }
}

function persistUrl(url: string): void {
  try {
    fs.mkdirSync(path.dirname(URL_PERSIST_PATH), { recursive: true });
    fs.writeFileSync(URL_PERSIST_PATH, url, 'utf8');
  } catch (err) {
    console.warn('[Webhook] Could not persist callback URL to disk:', (err as Error).message);
  }
}

// A valid callback URL must point to dashboard-api, not back to wa-server itself.
// Operators sometimes set DASHBOARD_WEBHOOK_URL to a wa-server URL by mistake —
// detect and ignore that to avoid a silent self-loop.
function isValidCallbackUrl(url: string): boolean {
  if (!url) return false;
  try {
    const { hostname } = new URL(url);
    // Reject any URL that resolves back to this process's own hostname
    const ownHost = process.env.HOSTNAME ?? 'wa-server';
    return hostname !== ownHost && hostname !== 'wa-server' && hostname !== 'localhost';
  } catch {
    return false;
  }
}

@Injectable()
export class WebhookService implements OnModuleInit {
  // Priority: 1) persisted file on sessions volume
  //           2) DASHBOARD_WEBHOOK_URL env (only if it points to dashboard-api, not wa-server)
  //           3) empty — bootstrap will register it shortly after startup
  private dashboardUrl: string = '';

  onModuleInit(): void {
    const persisted = loadPersistedUrl();
    if (persisted) {
      this.dashboardUrl = persisted;
      console.log(`[Webhook] Loaded callback URL from disk: ${persisted}`);
      return;
    }

    const envUrl = process.env.DASHBOARD_WEBHOOK_URL ?? '';
    if (isValidCallbackUrl(envUrl)) {
      this.dashboardUrl = envUrl;
      console.log(`[Webhook] Using DASHBOARD_WEBHOOK_URL env: ${envUrl}`);
    } else if (envUrl) {
      console.warn(`[Webhook] DASHBOARD_WEBHOOK_URL looks invalid or self-referential ("${envUrl}") — ignoring. Dashboard bootstrap will register the correct URL.`);
    }
  }

  setDashboardUrl(url: string) {
    const secret = process.env.WEBHOOK_SIGNING_SECRET ?? '';
    if (url && (!secret || secret.length < 32)) {
      console.warn(
        '[WA Server] WARNING: Webhook URL registered but WEBHOOK_SIGNING_SECRET is missing/short. ' +
        'Signatures will be computed with an empty key — receivers cannot verify. ' +
        'Set WEBHOOK_SIGNING_SECRET (min 32 chars) and restart the server. ' +
        'v1.1 will reject this configuration outright.'
      );
    }
    this.dashboardUrl = url;
    persistUrl(url);
  }

  getDashboardUrl(): string | null {
    return this.dashboardUrl || null;  // empty string normalises to null
  }

  async fire(event: string, sessionId: string, data: any) {
    if (!this.dashboardUrl) return;

    const payload: WebhookPayload = {
      event,
      sessionId,
      timestamp: new Date().toISOString(),
      data,
    };

    try {
      await this.post(this.dashboardUrl, payload);
    } catch (err) {
      // Silent fail — dashboard might be temporarily down
      console.warn(`[Webhook] Failed to fire event ${event}: ${(err as Error).message}`);
    }
  }

  // DASHBOARD_WEBHOOK_URL is operator-configured (not user-supplied), so safeFetch's
  // SSRF protection is not appropriate here — it would block Docker-internal URLs used
  // in self-hosted deployments. Uses native http like audit.middleware.ts.
  private post(url: string, payload: WebhookPayload): Promise<void> {
    const rawBody = JSON.stringify(payload);
    const timestamp = Math.floor(Date.now() / 1000);
    const signingSecret = process.env.WEBHOOK_SIGNING_SECRET ?? '';
    const internalSecret = process.env.INTERNAL_WEBHOOK_SECRET ?? '';
    const signature = computeSignature(signingSecret, timestamp, rawBody);

    return new Promise<void>((resolve, reject) => {
      let parsed: URL;
      try {
        parsed = new URL(url);
      } catch {
        return reject(new Error(`Invalid DASHBOARD_WEBHOOK_URL: ${url}`));
      }

      const mod = parsed.protocol === 'https:' ? https : http;
      const req = mod.request(
        {
          hostname: parsed.hostname,
          port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
          path: parsed.pathname + (parsed.search || ''),
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(rawBody),
            'X-WaSphere-Event': payload.event,
            'X-WaSphere-Session': payload.sessionId,
            'X-WaSphere-Signature': signature,
            'X-WaSphere-Timestamp': String(timestamp),
            'X-Internal-Secret': internalSecret,
          },
        },
        (res) => {
          res.resume(); // drain to free socket
          resolve();
        },
      );

      req.setTimeout(10_000, () => {
        req.destroy();
        reject(new Error('Webhook delivery timeout'));
      });

      req.on('error', reject);
      req.write(rawBody);
      req.end();
    });
  }
}
