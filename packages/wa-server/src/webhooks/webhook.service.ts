import { Injectable } from '@nestjs/common';
import { safeFetch, SsrfBlockedError } from '../common/safe-fetch';

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
    await safeFetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-WaSphere-Event': payload.event,
        'X-WaSphere-Session': payload.sessionId,
      },
      body: JSON.stringify(payload),
      maxBytes: 1 * 1024 * 1024, // 1 MiB — webhook responses are JSON only
    });
  }
}
