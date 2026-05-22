import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  WHATSAPP_ADAPTER,
  IWhatsAppAdapter,
  SendResult,
  PresenceType,
} from '../whatsapp/whatsapp-adapter.interface';
import { WebhookService } from '../webhooks/webhook.service';
import { BulkJob, BulkOutcome } from './bulk-message.types';
import { BulkMessageDto } from './dto/bulk-message.dto';

const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

@Injectable()
export class MessagesService {
  private readonly bulkJobs = new Map<string, BulkJob>();
  private readonly activeBulkSessions = new Set<string>();
  private readonly BULK_JOB_TTL_MS = 60 * 60 * 1000;

  constructor(
    @Inject(WHATSAPP_ADAPTER) private adapter: IWhatsAppAdapter,
    private readonly webhookService: WebhookService,
  ) {}

  async sendText(sessionId: string, to: string, text: string, quotedId?: string): Promise<SendResult> {
    return this.adapter.sendText(sessionId, to, text, quotedId);
  }

  async sendImage(sessionId: string, to: string, imageUrl: string, caption?: string): Promise<SendResult> {
    return this.adapter.sendImage(sessionId, to, imageUrl, caption);
  }

  async sendVideo(sessionId: string, to: string, videoUrl: string, caption?: string): Promise<SendResult> {
    return this.adapter.sendVideo(sessionId, to, videoUrl, caption);
  }

  async sendAudio(sessionId: string, to: string, audioUrl: string, isVoiceNote: boolean = false): Promise<SendResult> {
    return this.adapter.sendAudio(sessionId, to, audioUrl, isVoiceNote);
  }

  async sendDocument(
    sessionId: string,
    to: string,
    docUrl: string,
    fileName: string,
    mimetype: string,
  ): Promise<SendResult> {
    return this.adapter.sendDocument(sessionId, to, docUrl, fileName, mimetype);
  }

  async sendSticker(sessionId: string, to: string, stickerUrl: string): Promise<SendResult> {
    return this.adapter.sendSticker(sessionId, to, stickerUrl);
  }

  async sendLocation(
    sessionId: string,
    to: string,
    latitude: number,
    longitude: number,
    name?: string,
    address?: string,
  ): Promise<SendResult> {
    return this.adapter.sendLocation(sessionId, to, latitude, longitude, name, address);
  }

  async sendContact(
    sessionId: string,
    to: string,
    displayName: string,
    phoneNumber: string,
  ): Promise<SendResult> {
    return this.adapter.sendContact(sessionId, to, displayName, phoneNumber);
  }

  async sendButtons(
    sessionId: string,
    to: string,
    text: string,
    footer: string,
    buttons: { id: string; text: string }[],
  ): Promise<SendResult> {
    return this.adapter.sendButtons(sessionId, to, text, footer, buttons);
  }

  async sendList(
    sessionId: string,
    to: string,
    title: string,
    text: string,
    buttonText: string,
    sections: { title: string; rows: { id: string; title: string; description?: string }[] }[],
  ): Promise<SendResult> {
    return this.adapter.sendList(sessionId, to, title, text, buttonText, sections);
  }

  async sendPoll(
    sessionId: string,
    to: string,
    name: string,
    options: string[],
    selectableCount: number = 1,
  ): Promise<SendResult> {
    return this.adapter.sendPoll(sessionId, to, name, options, selectableCount);
  }

  async sendReaction(
    sessionId: string,
    to: string,
    messageId: string,
    emoji: string,
  ): Promise<SendResult> {
    return this.adapter.sendReaction(sessionId, to, messageId, emoji);
  }

  async sendGif(sessionId: string, to: string, gifUrl: string, caption?: string): Promise<SendResult> {
    return this.adapter.sendGif(sessionId, to, gifUrl, caption);
  }

  async sendViewOnce(sessionId: string, to: string, imageUrl: string, caption?: string): Promise<SendResult> {
    return this.adapter.sendViewOnce(sessionId, to, imageUrl, caption);
  }

  async editMessage(
    sessionId: string,
    to: string,
    messageId: string,
    newText: string,
  ): Promise<SendResult> {
    return this.adapter.editMessage(sessionId, to, messageId, newText);
  }

  async deleteMessage(
    sessionId: string,
    to: string,
    messageId: string,
    forEveryone: boolean = true,
  ): Promise<{ status: string }> {
    return this.adapter.deleteMessage(sessionId, to, messageId, forEveryone);
  }

  async markRead(sessionId: string, to: string, messageIds: string[]): Promise<{ status: string }> {
    return this.adapter.markRead(sessionId, to, messageIds);
  }

  async sendTyping(sessionId: string, to: string, isGroup: boolean = false): Promise<{ status: string }> {
    return this.adapter.sendTyping(sessionId, to, isGroup);
  }

  async sendPresence(
    sessionId: string,
    to: string,
    presence: PresenceType,
  ): Promise<{ status: string }> {
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

    this.runBulkLoop(jobId, sessionId, dto).catch(() => {});

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
          const result = await this.adapter.sendText(sessionId, recipient, dto.message.text);
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
          outcome.status = 'failed';
          outcome.error = (err as Error).message;
          outcome.timestamp = Date.now();
          job.failed++;

          this.webhookService.fire('bulk.failed', sessionId, {
            jobId,
            recipient,
            index: i,
            total: job.total,
            error: (err as Error).message,
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

  private evictExpiredJobs(): void {
    const cutoff = Date.now() - this.BULK_JOB_TTL_MS;
    for (const [id, job] of this.bulkJobs) {
      if (job.createdAt < cutoff) this.bulkJobs.delete(id);
    }
  }
}
