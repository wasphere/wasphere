import { Injectable } from '@nestjs/common';
import * as https from 'https';
import * as http from 'http';

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
      // Silent fail — dashboard might be temporarily down
      console.warn(`[Webhook] Failed to fire event ${event}: ${err.message}`);
    }
  }

  private post(url: string, payload: WebhookPayload): Promise<void> {
    return new Promise((resolve, reject) => {
      const body = JSON.stringify(payload);
      const urlObj = new URL(url);
      const isHttps = urlObj.protocol === 'https:';
      const lib = isHttps ? https : http;

      const req = lib.request(
        {
          hostname: urlObj.hostname,
          port: urlObj.port || (isHttps ? 443 : 80),
          path: urlObj.pathname + urlObj.search,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(body),
            'X-WaSphere-Event': payload.event,
            'X-WaSphere-Session': payload.sessionId,
          },
          timeout: 5000,
        },
        (res) => {
          res.on('data', () => {});
          res.on('end', () => resolve());
        },
      );

      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Webhook timeout'));
      });
      req.write(body);
      req.end();
    });
  }
}
