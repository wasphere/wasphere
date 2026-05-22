import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';
import { safeFetch, SsrfBlockedError } from '../common/safe-fetch';

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

@Injectable()
export class WebhookService {
  // Dashboard URL where events get sent
  // Dashboard sets this when registering this binary
  private dashboardUrl: string = process.env.DASHBOARD_WEBHOOK_URL || '';

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
      if (err instanceof SsrfBlockedError) {
        // SSRF block on DASHBOARD_WEBHOOK_URL indicates misconfigured or compromised Dashboard
        console.error(`[Webhook] SSRF_BLOCKED firing event ${event}: ${err.message}`);
      } else {
        // Silent fail — dashboard might be temporarily down
        console.warn(`[Webhook] Failed to fire event ${event}: ${err.message}`);
      }
    }
  }

  private async post(url: string, payload: WebhookPayload): Promise<void> {
    const rawBody = JSON.stringify(payload);
    const timestamp = Math.floor(Date.now() / 1000);
    const secret = process.env.WEBHOOK_SIGNING_SECRET ?? '';
    const signature = computeSignature(secret, timestamp, rawBody);

    await safeFetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-WaSphere-Event': payload.event,
        'X-WaSphere-Session': payload.sessionId,
        'X-WaSphere-Signature': signature,
        'X-WaSphere-Timestamp': String(timestamp),
      },
      body: rawBody,
      maxBytes: 1 * 1024 * 1024, // 1 MiB — webhook responses are JSON only
    });
  }
}
