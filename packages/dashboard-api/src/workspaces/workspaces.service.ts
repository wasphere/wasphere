import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EncryptionService } from './encryption.service';
import { CreateWorkspaceDto } from './dto/create-workspace.dto';
import { SetWaServerDto } from './dto/set-wa-server.dto';
import { GetAuditLogsQueryDto } from './dto/get-audit-logs-query.dto';

@Injectable()
export class WorkspacesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
  ) {}

  async listForUser(userId: string) {
    const memberships = await this.prisma.workspaceMember.findMany({
      where: { userId },
      include: { workspace: true },
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return memberships.map((m: any) => ({
      id: m.workspace.id,
      name: m.workspace.name,
      role: m.role,
      waServerConfigured: m.workspace.waServerToken !== null,
      createdAt: m.workspace.createdAt,
    }));
  }

  async create(userId: string, dto: CreateWorkspaceDto) {
    const { workspace } = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const workspace = await tx.workspace.create({
        data: { name: dto.name, ownerId: userId },
      });
      await tx.workspaceMember.create({
        data: { workspaceId: workspace.id, userId, role: 'OWNER' },
      });
      return { workspace };
    });
    return { id: workspace.id, name: workspace.name };
  }

  async getOne(userId: string, workspaceId: string) {
    const membership = await this.prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
      include: { workspace: true },
    });
    if (!membership) {
      throw new ForbiddenException('Not a member of this workspace');
    }
    const w = membership.workspace;
    return {
      id: w.id,
      name: w.name,
      role: membership.role,
      waServerUrl: w.waServerUrl,
      waServerConfigured: w.waServerToken !== null,
      createdAt: w.createdAt,
      updatedAt: w.updatedAt,
    };
  }

  async setWaServer(
    userId: string,
    workspaceId: string,
    dto: SetWaServerDto,
  ) {
    await this.requireOwner(userId, workspaceId);

    const { ciphertext, iv } = this.encryption.encrypt(dto.waServerToken);

    await this.prisma.workspace.update({
      where: { id: workspaceId },
      data: {
        waServerUrl: dto.waServerUrl,
        waServerToken: ciphertext,
        waServerTokenIv: iv,
      },
    });

    return { success: true };
  }

  async deleteWorkspace(userId: string, workspaceId: string) {
    await this.requireOwner(userId, workspaceId);
    await this.prisma.workspace.delete({ where: { id: workspaceId } });
    return { success: true };
  }

  async getDecryptedToken(
    userId: string,
    workspaceId: string,
  ): Promise<{ waServerUrl: string; token: string }> {
    const membership = await this.prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
      include: { workspace: true },
    });

    if (!membership) {
      throw new ForbiddenException('Not a member of this workspace');
    }

    const w = membership.workspace;

    if (!w.waServerUrl) {
      throw new BadRequestException('WA server not configured for this workspace');
    }

    if (!w.waServerToken || !w.waServerTokenIv) {
      throw new BadRequestException('WA server token not configured for this workspace');
    }

    const token = this.encryption.decrypt(w.waServerToken, w.waServerTokenIv);
    return { waServerUrl: w.waServerUrl, token };
  }

  async getAuditLogs(workspaceId: string, userId: string, query: GetAuditLogsQueryDto) {
    // Membership check — throws ForbiddenException if not a member
    const membership = await this.prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
    });
    if (!membership) throw new ForbiddenException('Not a member of this workspace');

    if (query.from && query.to && new Date(query.from) > new Date(query.to)) {
      throw new BadRequestException('"from" must be earlier than or equal to "to"');
    }

    const where: Prisma.AuditLogWhereInput = {};
    if (query.from || query.to) {
      where.timestamp = {
        ...(query.from ? { gte: new Date(query.from) } : {}),
        ...(query.to   ? { lte: new Date(query.to)   } : {}),
      };
    }
    if (query.sessionId  !== undefined) where.sessionId  = query.sessionId;
    if (query.statusCode !== undefined) where.statusCode = query.statusCode;

    const skip = (query.page - 1) * query.pageSize;

    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        skip,
        take: query.pageSize,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return { items, total, page: query.page, pageSize: query.pageSize };
  }

  async getStats(workspaceId: string, userId: string) {
    const membership = await this.prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
    });
    if (!membership) throw new ForbiddenException('Not a member of this workspace');

    const MESSAGE_PATTERN = /\/messages\/([^/?]+)/;
    const now = new Date();

    // Time boundaries
    const since24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const since48h = new Date(now.getTime() - 48 * 60 * 60 * 1000);
    const since7d = new Date(now);
    since7d.setUTCHours(0, 0, 0, 0);
    since7d.setUTCDate(since7d.getUTCDate() - 6);
    const todayStart = new Date(now);
    todayStart.setUTCHours(0, 0, 0, 0);

    const [
      count24hSuccess,
      countPrev24hSuccess,
      count24hFailed,
      recentMsgLogs,
      recentAll,
    ] = await Promise.all([
      // Messages last 24h, 2xx
      this.prisma.auditLog.count({
        where: {
          endpoint: { contains: '/messages/' },
          method: 'POST',
          statusCode: { gte: 200, lt: 300 },
          timestamp: { gte: since24h },
        },
      }),
      // Messages 24-48h ago, 2xx (for trend)
      this.prisma.auditLog.count({
        where: {
          endpoint: { contains: '/messages/' },
          method: 'POST',
          statusCode: { gte: 200, lt: 300 },
          timestamp: { gte: since48h, lt: since24h },
        },
      }),
      // Failed message sends last 24h
      this.prisma.auditLog.count({
        where: {
          endpoint: { contains: '/messages/' },
          method: 'POST',
          statusCode: { gte: 400 },
          timestamp: { gte: since24h },
        },
      }),
      // Successful message logs last 7 days (for day buckets + type breakdown)
      this.prisma.auditLog.findMany({
        where: {
          endpoint: { contains: '/messages/' },
          method: 'POST',
          statusCode: { gte: 200, lt: 300 },
          timestamp: { gte: since7d },
        },
        select: { endpoint: true, timestamp: true },
      }),
      // Recent 8 audit entries (all methods) for activity feed
      this.prisma.auditLog.findMany({
        orderBy: { timestamp: 'desc' },
        take: 8,
        select: { id: true, method: true, endpoint: true, statusCode: true, timestamp: true, sessionId: true },
      }),
    ]);

    // messages7d — 7-day buckets
    const buckets: Record<string, number> = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setUTCHours(0, 0, 0, 0);
      d.setUTCDate(d.getUTCDate() - i);
      buckets[d.toISOString().slice(0, 10)] = 0;
    }
    for (const log of recentMsgLogs) {
      const key = new Date(log.timestamp).toISOString().slice(0, 10);
      if (key in buckets) buckets[key]++;
    }

    // eventsToday — type breakdown from today's message logs
    const todayMsgLogs = recentMsgLogs.filter(
      (l) => new Date(l.timestamp) >= todayStart,
    );
    const byTypeRaw: Record<string, number> = {};
    for (const log of todayMsgLogs) {
      const m = MESSAGE_PATTERN.exec(log.endpoint);
      const type = m?.[1] ?? 'other';
      byTypeRaw[type] = (byTypeRaw[type] ?? 0) + 1;
    }

    // successRate
    const total24h = count24hSuccess + count24hFailed;
    const successPct = total24h > 0 ? Math.round((count24hSuccess / total24h) * 100) : 100;

    return {
      messages24h: { count: count24hSuccess, previousDayCount: countPrev24hSuccess },
      successRate24h: { percentage: successPct, failed: count24hFailed },
      eventsToday: {
        count: todayMsgLogs.length,
        byType: byTypeRaw,
      },
      messages7d: Object.entries(buckets).map(([date, count]) => ({ date, count })),
      recentActivity: recentAll.map((log) => ({
        id: log.id,
        method: log.method,
        endpoint: log.endpoint,
        statusCode: log.statusCode,
        sessionId: log.sessionId ?? null,
        createdAt: log.timestamp,
      })),
    };
  }

  private async requireOwner(userId: string, workspaceId: string) {
    const membership = await this.prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
    });
    if (!membership) {
      throw new NotFoundException('Workspace not found');
    }
    if (membership.role !== 'OWNER') {
      throw new ForbiddenException('Owner access required');
    }
  }
}
