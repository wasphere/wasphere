import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes, createHash } from 'crypto';
import { WorkspaceRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function hashInviteToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

@Injectable()
export class TeamService {
  constructor(private readonly prisma: PrismaService) {}

  /** Require the caller to be OWNER or ADMIN of the workspace. */
  private async assertManager(workspaceId: string, userId: string): Promise<WorkspaceRole> {
    const m = await this.prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
      select: { role: true },
    });
    if (!m) throw new ForbiddenException('Not a member of this workspace');
    if (m.role !== 'OWNER' && m.role !== 'ADMIN') {
      throw new ForbiddenException('Only owners and admins can manage the team');
    }
    return m.role;
  }

  async listMembers(workspaceId: string, userId: string) {
    await this.assertManager(workspaceId, userId);
    const members = await this.prisma.workspaceMember.findMany({
      where: { workspaceId },
      select: { userId: true, role: true, createdAt: true, user: { select: { email: true } } },
      orderBy: { createdAt: 'asc' },
    });
    return members.map((m) => ({ userId: m.userId, email: m.user.email, role: m.role, joinedAt: m.createdAt }));
  }

  async changeRole(workspaceId: string, actorId: string, targetUserId: string, role: WorkspaceRole) {
    const actorRole = await this.assertManager(workspaceId, actorId);
    if (role === 'OWNER') throw new BadRequestException('Cannot assign OWNER — transfer ownership is not supported here.');
    const target = await this.prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId: targetUserId } },
      select: { role: true },
    });
    if (!target) throw new NotFoundException('Member not found');
    if (target.role === 'OWNER') throw new BadRequestException('Cannot change the owner’s role');
    // An admin cannot manage another admin (only the owner can).
    if (actorRole === 'ADMIN' && target.role === 'ADMIN') throw new ForbiddenException('Only the owner can change an admin’s role');
    await this.prisma.workspaceMember.update({
      where: { workspaceId_userId: { workspaceId, userId: targetUserId } },
      data: { role },
    });
    return { ok: true };
  }

  async removeMember(workspaceId: string, actorId: string, targetUserId: string) {
    const actorRole = await this.assertManager(workspaceId, actorId);
    if (targetUserId === actorId) throw new BadRequestException('You cannot remove yourself');
    const target = await this.prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId: targetUserId } },
      select: { role: true },
    });
    if (!target) throw new NotFoundException('Member not found');
    if (target.role === 'OWNER') throw new BadRequestException('Cannot remove the owner');
    if (actorRole === 'ADMIN' && target.role === 'ADMIN') throw new ForbiddenException('Only the owner can remove an admin');
    await this.prisma.workspaceMember.delete({
      where: { workspaceId_userId: { workspaceId, userId: targetUserId } },
    });
    return { ok: true };
  }

  async createInvite(workspaceId: string, actorId: string, role: WorkspaceRole) {
    const actorRole = await this.assertManager(workspaceId, actorId);
    if (role === 'OWNER') throw new BadRequestException('Cannot invite as OWNER');
    if (role === 'ADMIN' && actorRole !== 'OWNER') throw new ForbiddenException('Only the owner can invite admins');

    const token = randomBytes(24).toString('base64url');
    const expiresAt = new Date(Date.now() + INVITE_TTL_MS);
    await this.prisma.workspaceInvite.create({
      data: { workspaceId, tokenHash: hashInviteToken(token), role, createdBy: actorId, expiresAt },
    });
    const base = (process.env.DASHBOARD_UI_URL ?? '').replace(/\/+$/, '');
    return {
      token,
      inviteUrl: base ? `${base}/invite/${token}` : `/invite/${token}`,
      role,
      expiresAt,
    };
  }

  async listInvites(workspaceId: string, userId: string) {
    await this.assertManager(workspaceId, userId);
    const invites = await this.prisma.workspaceInvite.findMany({
      where: { workspaceId, acceptedAt: null, expiresAt: { gt: new Date() } },
      select: { id: true, role: true, createdAt: true, expiresAt: true },
      orderBy: { createdAt: 'desc' },
    });
    return invites;
  }

  async revokeInvite(workspaceId: string, userId: string, inviteId: string) {
    await this.assertManager(workspaceId, userId);
    const invite = await this.prisma.workspaceInvite.findFirst({ where: { id: inviteId, workspaceId }, select: { id: true } });
    if (!invite) throw new NotFoundException('Invite not found');
    await this.prisma.workspaceInvite.delete({ where: { id: inviteId } });
    return { ok: true };
  }

  /** Public preview of an invite (workspace name + role) for the accept page. */
  async previewInvite(token: string) {
    const invite = await this.prisma.workspaceInvite.findUnique({
      where: { tokenHash: hashInviteToken(token) },
      select: { role: true, acceptedAt: true, expiresAt: true, workspace: { select: { name: true } } },
    });
    if (!invite || invite.acceptedAt || invite.expiresAt < new Date()) {
      throw new NotFoundException('Invite is invalid or has expired');
    }
    return { workspaceName: invite.workspace.name, role: invite.role };
  }
}
