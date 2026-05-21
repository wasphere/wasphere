import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { AuditEventDto } from './dto/audit-event.dto';

@Injectable()
export class InternalService {
  private readonly logger = new Logger(InternalService.name);

  constructor(private readonly prisma: PrismaService) {}

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
