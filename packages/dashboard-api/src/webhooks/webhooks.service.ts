import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes, createHmac } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { isValidEvents, WILDCARD_EVENT } from '../lib/webhook-events';
import { deliverWebhook } from '../common/webhook-delivery';
import { CreateWebhookDto } from './dto/create-webhook.dto';
import { UpdateWebhookDto } from './dto/update-webhook.dto';

const PROD_URL_RE = /^https:\/\//i;
const IS_PROD = process.env.NODE_ENV === 'production';
const AUTO_DEACTIVATE_THRESHOLD = 50;

function generateSigningSecret(): string {
  return randomBytes(32).toString('hex'); // 64 hex chars
}

function computeSignature(secret: string, timestamp: number, rawBody: string): string {
  const signed = `${timestamp}.${rawBody}`;
  return `v1,sha256=${createHmac('sha256', secret).update(signed).digest('hex')}`;
}

function validateUrl(url: string): void {
  if (IS_PROD && !PROD_URL_RE.test(url)) {
    throw new BadRequestException('Webhook URL must use HTTPS in production');
  }
}

const LIST_SELECT = {
  id: true,
  name: true,
  url: true,
  events: true,
  isActive: true,
  retryMax: true,
  failureCount: true,
  createdAt: true,
  lastDeliveredAt: true,
  lastFailedAt: true,
  // signingSecret intentionally excluded from list
} as const;

@Injectable()
export class WebhooksService {
  constructor(private readonly prisma: PrismaService) {}

  private async requireMembership(userId: string, workspaceId: string): Promise<void> {
    const m = await this.prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
    });
    if (!m) throw new ForbiddenException('Not a member of this workspace');
  }

  private async findOwned(workspaceId: string, webhookId: string) {
    const wh = await this.prisma.webhook.findFirst({
      where: { id: webhookId, workspaceId },
    });
    if (!wh) throw new NotFoundException('Webhook not found');
    return wh;
  }

  async list(userId: string, workspaceId: string) {
    await this.requireMembership(userId, workspaceId);
    return this.prisma.webhook.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' },
      select: LIST_SELECT,
    });
  }

  async create(userId: string, workspaceId: string, dto: CreateWebhookDto) {
    await this.requireMembership(userId, workspaceId);
    validateUrl(dto.url);

    if (!isValidEvents(dto.events)) {
      throw new BadRequestException(
        'Invalid events. Use known event types or ["*"] for all.',
      );
    }

    const signingSecret = generateSigningSecret();

    const wh = await this.prisma.webhook.create({
      data: {
        workspaceId,
        name: dto.name,
        url: dto.url,
        events: dto.events,
        signingSecret,
        isActive: dto.isActive ?? true,
        retryMax: dto.retryMax ?? 3,
      },
      select: { ...LIST_SELECT, signingSecret: true },
    });

    await this.prisma.auditLog.create({
      data: { method: 'POST', endpoint: 'webhook.created' },
    });

    return wh; // signingSecret shown once on creation
  }

  async update(userId: string, workspaceId: string, webhookId: string, dto: UpdateWebhookDto) {
    await this.requireMembership(userId, workspaceId);
    await this.findOwned(workspaceId, webhookId);

    if (dto.url) validateUrl(dto.url);
    if (dto.events !== undefined && !isValidEvents(dto.events)) {
      throw new BadRequestException(
        'Invalid events. Use known event types or ["*"] for all.',
      );
    }

    const updated = await this.prisma.webhook.update({
      where: { id: webhookId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.url !== undefined && { url: dto.url }),
        ...(dto.events !== undefined && { events: dto.events }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        ...(dto.retryMax !== undefined && { retryMax: dto.retryMax }),
        // Re-activate clears the failure counter
        ...(dto.isActive === true && { failureCount: 0 }),
      },
      select: LIST_SELECT,
    });

    return updated;
  }

  async remove(userId: string, workspaceId: string, webhookId: string) {
    await this.requireMembership(userId, workspaceId);
    await this.findOwned(workspaceId, webhookId);
    await this.prisma.webhook.delete({ where: { id: webhookId } });
    await this.prisma.auditLog.create({
      data: { method: 'DELETE', endpoint: 'webhook.deleted' },
    });
    return { success: true };
  }

  async testFire(userId: string, workspaceId: string, webhookId: string) {
    await this.requireMembership(userId, workspaceId);
    const wh = await this.findOwned(workspaceId, webhookId);

    const payload = {
      event: 'webhook.test' as const,
      workspaceId,
      webhookId: wh.id,
      timestamp: new Date().toISOString(),
      data: { message: 'This is a test delivery from WaSphere.' },
    };

    const rawBody = JSON.stringify(payload);
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = computeSignature(wh.signingSecret, timestamp, rawBody);

    // SSRF-guarded delivery. The returned error is always generic so the
    // test-fire response can never be used to probe the SSRF guard.
    const result = await deliverWebhook(wh.url, rawBody, {
      'X-WaSphere-Event': payload.event,
      'X-WaSphere-Signature': signature,
      'X-WaSphere-Timestamp': String(timestamp),
    });
    const { statusCode, success, error } = result;

    await this.prisma.auditLog.create({
      data: { method: 'POST', endpoint: 'webhook.test_fire', statusCode: statusCode ?? undefined },
    });

    return { success, statusCode, error };
  }

  // Called by Phase D fanout — updates delivery tracking and auto-deactivates at threshold.
  async recordDelivery(webhookId: string, succeeded: boolean): Promise<void> {
    if (succeeded) {
      await this.prisma.webhook.update({
        where: { id: webhookId },
        data: { lastDeliveredAt: new Date(), failureCount: 0 },
      });
    } else {
      const wh = await this.prisma.webhook.update({
        where: { id: webhookId },
        data: { lastFailedAt: new Date(), failureCount: { increment: 1 } },
        select: { failureCount: true },
      });
      if (wh.failureCount >= AUTO_DEACTIVATE_THRESHOLD) {
        await this.prisma.webhook.update({
          where: { id: webhookId },
          data: { isActive: false },
        });
      }
    }
  }
}
