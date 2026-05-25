import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import * as argon2 from 'argon2';
import { PrismaService } from '../prisma/prisma.service';
import { isValidPermissions, PermissionScope, WILDCARD_PERMISSION } from '../lib/permissions';
import { CreateApiKeyDto } from './dto/create-api-key.dto';
import { UpdateApiKeyDto } from './dto/update-api-key.dto';

const BASE62 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
};
const LAST_USED_DEBOUNCE_MS = 60_000;

export interface ApiKeyUser {
  userId: string;
  apiKeyId: string;
  workspaceId: string;
  permissions: (PermissionScope | typeof WILDCARD_PERMISSION)[];
  sessionScope: string | null;
}

@Injectable()
export class ApiKeysService {
  constructor(private readonly prisma: PrismaService) {}

  private generateRawKey(): string {
    const bytes = randomBytes(32);
    let n = BigInt('0x' + bytes.toString('hex'));
    let body = '';
    const base = BigInt(62);
    for (let i = 0; i < 43; i++) {
      body = BASE62[Number(n % base)] + body;
      n = n / base;
    }
    return 'wsk_' + body;
  }

  private keyPrefix(raw: string): string {
    return raw.slice(0, 16); // 'wsk_' + 12 chars
  }

  private async requireMembership(userId: string, workspaceId: string): Promise<void> {
    const membership = await this.prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
    });
    if (!membership) throw new ForbiddenException('Not a member of this workspace');
  }

  async list(userId: string, workspaceId: string) {
    await this.requireMembership(userId, workspaceId);
    const keys = await this.prisma.apiKey.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        permissions: true,
        sessionId: true,
        isActive: true,
        createdAt: true,
        lastUsedAt: true,
        expiresAt: true,
      },
    });
    return keys;
  }

  async create(userId: string, workspaceId: string, dto: CreateApiKeyDto) {
    await this.requireMembership(userId, workspaceId);

    if (!isValidPermissions(dto.permissions)) {
      throw new BadRequestException(
        'Invalid permissions. Use known scopes or ["*"] for full access.',
      );
    }

    const raw = this.generateRawKey();
    const prefix = this.keyPrefix(raw);
    const hash = await argon2.hash(raw, ARGON2_OPTIONS);

    const key = await this.prisma.apiKey.create({
      data: {
        workspaceId,
        createdById: userId,
        name: dto.name,
        keyPrefix: prefix,
        keyHash: hash,
        permissions: dto.permissions,
        sessionId: dto.sessionId ?? null,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        method: 'POST',
        endpoint: 'api_key.created',
        actorTokenPrefix: prefix,
      },
    });

    return {
      id: key.id,
      key: raw,
      keyPrefix: prefix,
      name: key.name,
      permissions: key.permissions,
      sessionId: key.sessionId,
      isActive: key.isActive,
      createdAt: key.createdAt,
      expiresAt: key.expiresAt,
    };
  }

  async update(userId: string, workspaceId: string, keyId: string, dto: UpdateApiKeyDto) {
    await this.requireMembership(userId, workspaceId);

    const existing = await this.prisma.apiKey.findFirst({
      where: { id: keyId, workspaceId },
    });
    if (!existing) throw new NotFoundException('API key not found');

    if (dto.permissions !== undefined && !isValidPermissions(dto.permissions)) {
      throw new BadRequestException(
        'Invalid permissions. Use known scopes or ["*"] for full access.',
      );
    }

    const updated = await this.prisma.apiKey.update({
      where: { id: keyId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.permissions !== undefined && { permissions: dto.permissions }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        ...('sessionId' in dto && { sessionId: dto.sessionId }),
        ...('expiresAt' in dto && { expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null }),
      },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        permissions: true,
        sessionId: true,
        isActive: true,
        createdAt: true,
        lastUsedAt: true,
        expiresAt: true,
      },
    });

    if (dto.isActive === false) {
      await this.prisma.auditLog.create({
        data: { method: 'PATCH', endpoint: 'api_key.deactivated', actorTokenPrefix: existing.keyPrefix },
      });
    }

    return updated;
  }

  async rotate(userId: string, workspaceId: string, keyId: string) {
    await this.requireMembership(userId, workspaceId);

    const existing = await this.prisma.apiKey.findFirst({
      where: { id: keyId, workspaceId },
    });
    if (!existing) throw new NotFoundException('API key not found');

    const raw = this.generateRawKey();
    const prefix = this.keyPrefix(raw);
    const hash = await argon2.hash(raw, ARGON2_OPTIONS);

    const updated = await this.prisma.apiKey.update({
      where: { id: keyId },
      data: { keyPrefix: prefix, keyHash: hash },
    });

    await this.prisma.auditLog.create({
      data: { method: 'POST', endpoint: 'api_key.rotated', actorTokenPrefix: prefix },
    });

    return {
      id: updated.id,
      key: raw,
      keyPrefix: prefix,
      name: updated.name,
      permissions: updated.permissions,
      sessionId: updated.sessionId,
      isActive: updated.isActive,
      expiresAt: updated.expiresAt,
    };
  }

  async remove(userId: string, workspaceId: string, keyId: string) {
    await this.requireMembership(userId, workspaceId);

    const existing = await this.prisma.apiKey.findFirst({
      where: { id: keyId, workspaceId },
    });
    if (!existing) throw new NotFoundException('API key not found');

    await this.prisma.apiKey.delete({ where: { id: keyId } });

    await this.prisma.auditLog.create({
      data: { method: 'DELETE', endpoint: 'api_key.deleted', actorTokenPrefix: existing.keyPrefix },
    });

    return { success: true };
  }

  async validateApiKey(token: string): Promise<ApiKeyUser | null> {
    if (!token.startsWith('wsk_') || token.length < 17) return null;

    const prefix = token.slice(0, 16); // 'wsk_' + 12 chars
    const key = await this.prisma.apiKey.findUnique({
      where: { keyPrefix: prefix },
      include: { workspace: { select: { ownerId: true } } },
    });

    if (!key || !key.isActive) return null;
    if (key.expiresAt && key.expiresAt < new Date()) return null;

    const valid = await argon2.verify(key.keyHash, token, ARGON2_OPTIONS);
    if (!valid) return null;

    // Debounced last_used_at update — fire and forget
    const shouldUpdate =
      !key.lastUsedAt ||
      Date.now() - key.lastUsedAt.getTime() > LAST_USED_DEBOUNCE_MS;
    if (shouldUpdate) {
      this.prisma.apiKey
        .update({ where: { id: key.id }, data: { lastUsedAt: new Date() } })
        .catch(() => undefined);
    }

    return {
      userId: key.workspace.ownerId,
      apiKeyId: key.id,
      workspaceId: key.workspaceId,
      permissions: key.permissions as (PermissionScope | typeof WILDCARD_PERMISSION)[],
      sessionScope: key.sessionId,
    };
  }
}
