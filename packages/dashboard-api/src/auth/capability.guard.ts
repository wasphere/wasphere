import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { Capability, hasCapability } from '../lib/capabilities';
import { PrismaService } from '../prisma/prisma.service';
import { CAPABILITY_KEY } from './require-capability.decorator';

interface Principal {
  userId: string;
  apiKeyId?: string;
}

/**
 * Enforces a `@RequireCapability(...)` on the route for human members.
 *
 * - API-key principals (have `apiKeyId`) are skipped — the public API is
 *   gated by ApiKeyPermissionGuard, not by workspace capabilities.
 * - JWT members are checked against their effective capabilities
 *   (role defaults + granular grants). Owners/admins always pass.
 *
 * Must run AFTER the auth guard (so `req.user` is populated). Reads the
 * workspace id from the `workspaceId` or `id` route param.
 */
@Injectable()
export class CapabilityGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<Capability | undefined>(
      CAPABILITY_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required) return true;

    const req = context
      .switchToHttp()
      .getRequest<Request & { user?: Principal; params: Record<string, string> }>();
    const user = req.user;
    if (!user) throw new ForbiddenException('Not authenticated');

    // API-key auth is gated elsewhere (ApiKeyPermissionGuard).
    if (user.apiKeyId) return true;

    const workspaceId = req.params.workspaceId ?? req.params.id;
    if (!workspaceId) throw new ForbiddenException('Missing workspace');

    const member = await this.prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId: user.userId } },
      select: { role: true, permissions: true },
    });
    if (!member) throw new ForbiddenException('Not a member of this workspace');

    if (!hasCapability(member.role, member.permissions, required)) {
      throw new ForbiddenException(
        `You don't have the "${required}" permission in this workspace`,
      );
    }
    return true;
  }
}
