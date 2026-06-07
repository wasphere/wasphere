import { ConflictException, Inject, Injectable, NotFoundException, NotImplementedException, OnApplicationShutdown } from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  WHATSAPP_ADAPTER,
  IWhatsAppAdapter,
  SendResult,
  PresenceType,
} from '../whatsapp/whatsapp-adapter.interface';
import { ProviderRegistry } from '../whatsapp/providers';
import { WebhookService } from '../webhooks/webhook.service';
import { BulkJob, BulkOutcome } from './bulk-message.types';
import { BulkMessageDto } from './dto/bulk-message.dto';

const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

// Map known adapter/Baileys error patterns to safe user-facing strings
function sanitiseError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes('not found') || msg.includes('not connected')) return 'Session not connected';
  if (msg.includes('rate') || msg.includes('429')) return 'Rate limit reached';
  if (msg.includes('timeout') || msg.includes('timed out')) return 'Request timed out';
  return 'Send failed';
}

@Injectable()
export class MessagesService implements OnApplicationShutdown {
  private readonly bulkJobs = new Map<string, BulkJob>();
  private readonly activeBulkSessions = new Set<string>();
  private readonly BULK_JOB_TTL_MS = 60 * 60 * 1000;
  private readonly evictionTimer: NodeJS.Timeout;

  constructor(
    @Inject(WHATSAPP_ADAPTER) private adapter: IWhatsAppAdapter,
    private readonly registry: ProviderRegistry,
    private readonly webhookService: WebhookService,
  ) {
    // Periodic eviction so memory is reclaimed even when no new jobs are submitted (SA-6)
    this.evictionTimer = setInterval(() => this.evictExpiredJobs(), 5 * 60 * 1000);
  }

  // Shared outbound methods route through the provider registry with opt-in
  // failover (design §2.3, §11). v1.2: the registry resolves to Baileys and no
  // fallback is configured by default, so behaviour is unchanged.

  async sendText(sessionId: string, to: string, text: string, quotedId?: string): Promise<SendResult> {
    return this.registry.withFailover(sessionId, (p) =>
      p.sendText(sessionId, to, text, quotedId ? { quotedMessageId: quotedId } : undefined),
    );
  }

  async sendImage(sessionId: string, to: string, imageUrl: string, caption?: string): Promise<SendResult> {
    return this.registry.withFailover(sessionId, (p) => p.sendMedia(sessionId, to, { kind: 'image', url: imageUrl, caption }));
  }

  async sendVideo(sessionId: string, to: string, videoUrl: string, caption?: string): Promise<SendResult> {
    return this.registry.withFailover(sessionId, (p) => p.sendMedia(sessionId, to, { kind: 'video', url: videoUrl, caption }));
  }

  async sendAudio(sessionId: string, to: string, audioUrl: string, isVoiceNote: boolean = false): Promise<SendResult> {
    return this.registry.withFailover(sessionId, (p) => p.sendMedia(sessionId, to, { kind: 'audio', url: audioUrl, isVoiceNote }));
  }

  async sendDocument(
    sessionId: string,
    to: string,
    docUrl: string,
    fileName: string,
    mimetype: string,
  ): Promise<SendResult> {
    return this.registry.withFailover(sessionId, (p) => p.sendMedia(sessionId, to, { kind: 'document', url: docUrl, fileName, mimetype }));
  }

  async sendSticker(sessionId: string, to: string, stickerUrl: string): Promise<SendResult> {
    return this.registry.withFailover(sessionId, (p) => p.sendMedia(sessionId, to, { kind: 'sticker', url: stickerUrl }));
  }

  async sendLocation(
    sessionId: string,
    to: string,
    latitude: number,
    longitude: number,
    name?: string,
    address?: string,
  ): Promise<SendResult> {
    return this.registry.withFailover(sessionId, (p) => p.sendLocation(sessionId, to, { latitude, longitude, name, address }));
  }

  async sendContact(
    sessionId: string,
    to: string,
    displayName: string,
    phoneNumber: string,
  ): Promise<SendResult> {
    return this.registry.withFailover(sessionId, (p) => p.sendContact(sessionId, to, { displayName, phoneNumber }));
  }

  async sendButtons(
    sessionId: string,
    to: string,
    text: string,
    footer: string,
    buttons: { id: string; text: string }[],
  ): Promise<SendResult> {
    return this.registry.withFailover(sessionId, (p) => p.sendInteractive(sessionId, to, { kind: 'buttons', text, footer, buttons }));
  }

  async sendList(
    sessionId: string,
    to: string,
    title: string,
    text: string,
    buttonText: string,
    sections: { title: string; rows: { id: string; title: string; description?: string }[] }[],
  ): Promise<SendResult> {
    return this.registry.withFailover(sessionId, (p) => p.sendInteractive(sessionId, to, { kind: 'list', title, text, buttonText, sections }));
  }

  // Baileys-only (not in the shared MessageProvider contract) — direct to adapter.
  /** True when this session runs on a provider other than Baileys (i.e. Meta). */
  private isMetaSession(sessionId: string): boolean {
    return this.registry.for(sessionId).id === 'meta';
  }

  /** Reject a Baileys-only operation on a Meta session with a clear 501 (not a confusing 404). */
  private assertBaileysOnly(sessionId: string, feature: string): void {
    if (this.isMetaSession(sessionId)) {
      throw new NotImplementedException(`${feature} is not supported on the Meta Cloud API provider.`);
    }
  }

  async sendPoll(
    sessionId: string,
    to: string,
    name: string,
    options: string[],
    selectableCount: number = 1,
  ): Promise<SendResult> {
    this.assertBaileysOnly(sessionId, 'Polls');
    return this.adapter.sendPoll(sessionId, to, name, options, selectableCount);
  }

  async sendReaction(
    sessionId: string,
    to: string,
    messageId: string,
    emoji: string,
    fromMe?: boolean,
  ): Promise<SendResult> {
    return this.registry.withFailover(sessionId, (p) => p.sendReaction(sessionId, to, messageId, emoji, fromMe ?? false));
  }

  async sendGif(sessionId: string, to: string, gifUrl: string, caption?: string): Promise<SendResult> {
    this.assertBaileysOnly(sessionId, 'GIF send');
    return this.adapter.sendGif(sessionId, to, gifUrl, caption);
  }

  async sendViewOnce(sessionId: string, to: string, imageUrl: string, caption?: string): Promise<SendResult> {
    this.assertBaileysOnly(sessionId, 'View-once messages');
    return this.adapter.sendViewOnce(sessionId, to, imageUrl, caption);
  }

  async editMessage(
    sessionId: string,
    to: string,
    messageId: string,
    newText: string,
  ): Promise<SendResult> {
    this.assertBaileysOnly(sessionId, 'Editing messages');
    return this.adapter.editMessage(sessionId, to, messageId, newText);
  }

  async deleteMessage(
    sessionId: string,
    to: string,
    messageId: string,
    forEveryone: boolean = true,
  ): Promise<{ status: string }> {
    this.assertBaileysOnly(sessionId, 'Deleting messages');
    return this.adapter.deleteMessage(sessionId, to, messageId, forEveryone);
  }

  async markRead(sessionId: string, to: string, messageIds: string[]): Promise<{ status: string }> {
    // Meta supports read receipts via the Graph API — route to the owning provider.
    if (this.isMetaSession(sessionId)) {
      await this.registry.for(sessionId).markRead(sessionId, to, messageIds);
      return { status: 'ok' };
    }
    return this.adapter.markRead(sessionId, to, messageIds);
  }

  async sendTyping(sessionId: string, to: string, isGroup: boolean = false): Promise<{ status: string }> {
    this.assertBaileysOnly(sessionId, 'Typing indicators');
    return this.adapter.sendTyping(sessionId, to, isGroup);
  }

  async sendPresence(
    sessionId: string,
    to: string,
    presence: PresenceType,
  ): Promise<{ status: string }> {
    this.assertBaileysOnly(sessionId, 'Presence updates');
    return this.adapter.sendPresence(sessionId, to, presence);
  }

  startBulkJob(sessionId: string, dto: BulkMessageDto): { jobId: string; total: number } {
    this.evictExpiredJobs();

    if (this.activeBulkSessions.has(sessionId)) {
      throw new ConflictException('A bulk job is already running for this session');
    }

    const jobId = randomUUID();
    const outcomes: BulkOutcome[] = dto.recipients.map((recipient, index) => ({
      recipient,
      index,
      status: 'pending',
    }));

    const job: BulkJob = {
      jobId,
      sessionId,
      total: dto.recipients.length,
      sent: 0,
      failed: 0,
      status: 'running',
      createdAt: Date.now(),
      outcomes,
    };

    this.bulkJobs.set(jobId, job);
    this.activeBulkSessions.add(sessionId);

    this.runBulkLoop(jobId, sessionId, dto).catch(() => {
      job.status = 'failed';
      this.activeBulkSessions.delete(sessionId);
    });

    return { jobId, total: job.total };
  }

  getBulkJobStatus(sessionId: string, jobId: string): BulkJob {
    const job = this.bulkJobs.get(jobId);
    if (!job) throw new NotFoundException(`Bulk job ${jobId} not found`);
    if (job.sessionId !== sessionId) throw new NotFoundException(`Bulk job ${jobId} not found`);
    return job;
  }

  private async runBulkLoop(jobId: string, sessionId: string, dto: BulkMessageDto): Promise<void> {
    const job = this.bulkJobs.get(jobId)!;

    try {
      for (let i = 0; i < dto.recipients.length; i++) {
        const recipient = dto.recipients[i];
        const outcome = job.outcomes[i];

        try {
          const result = await this.registry.withFailover(sessionId, (p) => p.sendText(sessionId, recipient, dto.message.text));
          outcome.status = 'sent';
          outcome.messageId = result.messageId;
          outcome.timestamp = Date.now();
          job.sent++;

          this.webhookService.fire('bulk.sent', sessionId, {
            jobId,
            recipient,
            index: i,
            total: job.total,
            result,
          });
        } catch (err) {
          const safeError = sanitiseError(err);
          outcome.status = 'failed';
          outcome.error = safeError;
          outcome.timestamp = Date.now();
          job.failed++;

          this.webhookService.fire('bulk.failed', sessionId, {
            jobId,
            recipient,
            index: i,
            total: job.total,
            error: safeError,
          });
        }

        if (i < dto.recipients.length - 1) {
          await sleep(dto.delayMs);
        }
      }

      job.status = job.failed === job.total ? 'failed' : 'completed';
    } finally {
      this.activeBulkSessions.delete(sessionId);
    }
  }

  onApplicationShutdown(): void {
    clearInterval(this.evictionTimer);
  }

  private evictExpiredJobs(): void {
    const cutoff = Date.now() - this.BULK_JOB_TTL_MS;
    for (const [id, job] of this.bulkJobs) {
      if (job.createdAt < cutoff) this.bulkJobs.delete(id);
    }
  }
}
