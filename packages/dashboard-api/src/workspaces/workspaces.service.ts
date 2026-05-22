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
