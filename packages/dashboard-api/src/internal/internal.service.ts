import { createHmac, randomBytes } from 'crypto';
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { WebhooksService } from '../webhooks/webhooks.service';
import { eventMatchesFilter, WebhookEvent } from '../lib/webhook-events';
import { deliverWebhook } from '../common/webhook-delivery';
import { AuditEventDto } from './dto/audit-event.dto';
import { WebhookEventDto } from './dto/webhook-event.dto';
import { mediaUrlFor } from '../media/media-token';

const RETRY_DELAYS_MS = [1_000, 5_000, 30_000]; // delays before attempt 2, 3, 4

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function sign(secret: string, timestamp: number, rawBody: string): string {
  const signed = `${timestamp}.${rawBody}`;
  return `v1,sha256=${createHmac('sha256', secret).update(signed).digest('hex')}`;
}

@Injectable()
export class InternalService {
  private readonly logger = new Logger(InternalService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly webhooks: WebhooksService,
  ) {}

  async ingestAudit(dto: AuditEventDto): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        sessionId: dto.sessionId,
        actorTokenPrefix: dto.actorTokenPrefix,
        method: dto.method,
        endpoint: dto.endpoint,
        statusCode: dto.statusCode,
        requestHash: dto.requestHash,
        ipAddress: dto.ipAddress,
      },
    });
  }

  // Returns immediately — fanout runs in the background.
  // Design: workspaceId comes from the URL path, so wa-server code is unchanged;
  // each workspace's DASHBOARD_WEBHOOK_URL is configured to include its own UUID.
  fanoutWebhookEvent(workspaceId: string, dto: WebhookEventDto): void {
    this.runFanout(workspaceId, dto).catch((err: unknown) => {
      this.logger.error(
        `[Fanout] Unexpected top-level error for workspace ${workspaceId}: ${String(err)}`,
      );
    });
  }

  private async runFanout(workspaceId: string, dto: WebhookEventDto): Promise<void> {
    const webhooks = await this.prisma.webhook.findMany({
      where: { workspaceId, isActive: true },
      select: { id: true, url: true, signingSecret: true, retryMax: true, events: true },
    });

    const matching = webhooks.filter((wh) =>
      eventMatchesFilter(wh.events as (WebhookEvent | '*')[], dto.event as WebhookEvent),
    );

    if (matching.length === 0) return;

    await Promise.allSettled(
      matching.map((wh) => this.deliverWithRetry(workspaceId, wh, dto, 1)),
    );
  }

  /**
   * Replace any inline base64 media with a fetchable download URL so consumers
   * (n8n etc.) get a small payload + a link, not a multi-MB blob. No-op when
   * MEDIA_BASE_URL is unset (keeps the inline data URI for backward compat).
   */
  private toDeliverableData(dto: WebhookEventDto): unknown {
    const data = dto.data as Record<string, any> | undefined;
    const content = data?.content as Record<string, any> | undefined;
    if (!data || !content?.dataUri || typeof data.messageId !== 'string') return dto.data;
    const url = mediaUrlFor(data.messageId);
    if (!url) return dto.data;
    const { dataUri, ...restContent } = content;
    void dataUri;
    return { ...data, content: { ...restContent, mediaUrl: url } };
  }

  private async deliverWithRetry(
    workspaceId: string,
    wh: { id: string; url: string; signingSecret: string; retryMax: number },
    dto: WebhookEventDto,
    attempt: number,
  ): Promise<void> {
    if (attempt > 1) {
      await sleep(RETRY_DELAYS_MS[attempt - 2] ?? 30_000);
    }

    const deliveryId = randomBytes(16).toString('hex');
    const timestamp = Math.floor(Date.now() / 1000);
    const rawBody = JSON.stringify({
      event: dto.event,
      sessionId: dto.sessionId,
      timestamp: dto.timestamp,
      deliveryId,
      data: this.toDeliverableData(dto),
    });
    const signature = sign(wh.signingSecret, timestamp, rawBody);
    const start = Date.now();

    // SSRF-guarded delivery — a user-controlled URL can never reach internal
    // services or cloud metadata (DNS pinning + private-IP denylist + manual
    // redirect handling live inside deliverWebhook → safeFetch).
    const result = await deliverWebhook(wh.url, rawBody, {
      'X-WaSphere-Event': dto.event,
      'X-WaSphere-Signature': signature,
      'X-WaSphere-Timestamp': String(timestamp),
      'X-WaSphere-Delivery-Id': deliveryId,
    });
    const statusCode = result.statusCode;
    const succeeded = result.success;

    if (result.blocked) {
      this.logger.warn(
        `[Fanout] webhook=${wh.id} attempt=${attempt} blocked: destination not allowed (SSRF guard) url=${wh.url}`,
      );
    } else if (!succeeded && result.error) {
      this.logger.warn(
        `[Fanout] webhook=${wh.id} attempt=${attempt} ${result.error}`,
      );
    }

    const latencyMs = Date.now() - start;

    if (succeeded) {
      this.logger.log(
        `[Fanout] webhook.delivered id=${wh.id} event=${dto.event} status=${statusCode} latency=${latencyMs}ms`,
      );
      await this.webhooks.recordDelivery(wh.id, true);
      return;
    }

    // Retry if attempts remain
    if (attempt < wh.retryMax) {
      return this.deliverWithRetry(workspaceId, wh, dto, attempt + 1);
    }

    // Retries exhausted
    this.logger.warn(
      `[Fanout] webhook.failed id=${wh.id} event=${dto.event} status=${statusCode ?? 'timeout'} attempt=${attempt}`,
    );
    await this.webhooks.recordDelivery(wh.id, false);
  }

  @Cron('0 2 * * *', { timeZone: 'UTC' })
  async purgeOldAuditLogs(): Promise<void> {
    const retentionDays = parseInt(
      process.env.AUDIT_RETENTION_DAYS ?? '90',
      10,
    );
    if (isNaN(retentionDays) || retentionDays < 1) {
      this.logger.warn('[AuditPurge] Invalid AUDIT_RETENTION_DAYS — skipping purge');
      return;
    }
    const cutoff = new Date(
      Date.now() - retentionDays * 24 * 60 * 60 * 1000,
    );
    const result = await this.prisma.auditLog.deleteMany({
      where: { timestamp: { lt: cutoff } },
    });
    this.logger.log(
      `[AuditPurge] Deleted ${result.count} audit log rows older than ${retentionDays} days`,
    );
  }
}
