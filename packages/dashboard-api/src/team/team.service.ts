import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes, createHash } from 'crypto';
import { WorkspaceRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { resolveCapabilities, sanitizeCapabilities } from '../lib/capabilities';

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

// A role reference from the API: the literal 'ADMIN' tier, or a custom role id.
export const ADMIN_REF = 'ADMIN';

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

  /** Require the caller to be the OWNER (custom-role management). */
  private async assertOwner(workspaceId: string, userId: string): Promise<void> {
    const m = await this.prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
      select: { role: true },
    });
    if (!m) throw new ForbiddenException('Not a member of this workspace');
    if (m.role !== 'OWNER') throw new ForbiddenException('Only the owner can manage roles');
  }

  /**
   * Resolve an API role reference into a tier + optional custom role id.
   * 'ADMIN' → owner-only ADMIN tier. Anything else is treated as a custom
   * role id (must belong to this workspace) → MEMBER tier.
   */
  private async resolveRoleRef(
    workspaceId: string,
    actorRole: WorkspaceRole,
    roleRef: string,
  ): Promise<{ role: WorkspaceRole; customRoleId: string | null }> {
    if (roleRef === ADMIN_REF) {
      if (actorRole !== 'OWNER') throw new ForbiddenException('Only the owner can assign the Admin role');
      return { role: 'ADMIN', customRoleId: null };
    }
    const role = await this.prisma.customRole.findFirst({
      where: { id: roleRef, workspaceId },
      select: { id: true },
    });
    if (!role) throw new BadRequestException('Unknown role');
    return { role: 'MEMBER', customRoleId: role.id };
  }

  /**
   * The caller's own tier + effective capabilities + role name (drives UI nav
   * gating and feature visibility).
   */
  async myRole(workspaceId: string, userId: string) {
    const m = await this.prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
      select: { role: true, customRole: { select: { name: true, capabilities: true } } },
    });
    if (!m) throw new ForbiddenException('Not a member of this workspace');
    const roleName = m.role === 'MEMBER' ? (m.customRole?.name ?? 'Agent') : m.role === 'OWNER' ? 'Owner' : 'Admin';
    return {
      role: m.role,
      roleName,
      capabilities: resolveCapabilities(m.role, m.customRole?.capabilities),
    };
  }

  async listMembers(workspaceId: string, userId: string) {
    await this.assertManager(workspaceId, userId);
    const members = await this.prisma.workspaceMember.findMany({
      where: { workspaceId },
      select: {
        userId: true,
        role: true,
        createdAt: true,
        user: { select: { email: true } },
        customRole: { select: { id: true, name: true, capabilities: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
    return members.map((m) => ({
      userId: m.userId,
      email: m.user.email,
      role: m.role,
      // For agents, the assigned custom role (null if none).
      customRoleId: m.role === 'MEMBER' ? (m.customRole?.id ?? null) : null,
      roleName: m.role === 'MEMBER' ? (m.customRole?.name ?? 'No role') : m.role === 'OWNER' ? 'Owner' : 'Admin',
      capabilities: resolveCapabilities(m.role, m.customRole?.capabilities),
      joinedAt: m.createdAt,
    }));
  }

  /** Reassign a member's tier/role. Owner/admin only. roleRef = 'ADMIN' | customRoleId. */
  async assignRole(workspaceId: string, actorId: string, targetUserId: string, roleRef: string) {
    const actorRole = await this.assertManager(workspaceId, actorId);
    const target = await this.prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId: targetUserId } },
      select: { role: true },
    });
    if (!target) throw new NotFoundException('Member not found');
    if (target.role === 'OWNER') throw new BadRequestException('Cannot change the owner’s role');
    if (actorRole === 'ADMIN' && target.role === 'ADMIN') throw new ForbiddenException('Only the owner can change an admin’s role');

    const { role, customRoleId } = await this.resolveRoleRef(workspaceId, actorRole, roleRef);
    await this.prisma.workspaceMember.update({
      where: { workspaceId_userId: { workspaceId, userId: targetUserId } },
      data: { role, customRoleId },
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

  // ── Custom roles ──────────────────────────────────────────────────────────

  /** List custom roles + how many members hold each. Any manager can view. */
  async listRoles(workspaceId: string, userId: string) {
    await this.assertManager(workspaceId, userId);
    const roles = await this.prisma.customRole.findMany({
      where: { workspaceId },
      select: {
        id: true,
        name: true,
        capabilities: true,
        _count: { select: { members: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
    return roles.map((r) => ({
      id: r.id,
      name: r.name,
      capabilities: sanitizeCapabilities(r.capabilities),
      memberCount: r._count.members,
    }));
  }

  async createRole(workspaceId: string, userId: string, name: string, capabilities: unknown) {
    await this.assertOwner(workspaceId, userId);
    const cleanName = name.trim();
    if (!cleanName) throw new BadRequestException('Role name is required');
    if (cleanName.toUpperCase() === ADMIN_REF) throw new BadRequestException('That name is reserved');
    const exists = await this.prisma.customRole.findFirst({ where: { workspaceId, name: cleanName }, select: { id: true } });
    if (exists) throw new BadRequestException('A role with that name already exists');
    const role = await this.prisma.customRole.create({
      data: { workspaceId, name: cleanName, capabilities: sanitizeCapabilities(capabilities) },
      select: { id: true, name: true, capabilities: true },
    });
    return { id: role.id, name: role.name, capabilities: sanitizeCapabilities(role.capabilities) };
  }

  async updateRole(workspaceId: string, userId: string, roleId: string, name: string | undefined, capabilities: unknown) {
    await this.assertOwner(workspaceId, userId);
    const role = await this.prisma.customRole.findFirst({ where: { id: roleId, workspaceId }, select: { id: true } });
    if (!role) throw new NotFoundException('Role not found');
    const data: { name?: string; capabilities?: string[] } = {};
    if (typeof name === 'string') {
      const cleanName = name.trim();
      if (!cleanName) throw new BadRequestException('Role name is required');
      if (cleanName.toUpperCase() === ADMIN_REF) throw new BadRequestException('That name is reserved');
      const clash = await this.prisma.customRole.findFirst({ where: { workspaceId, name: cleanName, id: { not: roleId } }, select: { id: true } });
      if (clash) throw new BadRequestException('A role with that name already exists');
      data.name = cleanName;
    }
    if (capabilities !== undefined) data.capabilities = sanitizeCapabilities(capabilities);
    const updated = await this.prisma.customRole.update({
      where: { id: roleId },
      data,
      select: { id: true, name: true, capabilities: true },
    });
    return { id: updated.id, name: updated.name, capabilities: sanitizeCapabilities(updated.capabilities) };
  }

  async deleteRole(workspaceId: string, userId: string, roleId: string) {
    await this.assertOwner(workspaceId, userId);
    const role = await this.prisma.customRole.findFirst({
      where: { id: roleId, workspaceId },
      select: { id: true, _count: { select: { members: true } } },
    });
    if (!role) throw new NotFoundException('Role not found');
    if (role._count.members > 0) {
      throw new BadRequestException('Reassign the members using this role before deleting it.');
    }
    await this.prisma.customRole.delete({ where: { id: roleId } });
    return { ok: true };
  }

  // ── Invites ─────────────────────────────────────────────────────────────

  async createInvite(workspaceId: string, actorId: string, roleRef: string) {
    const actorRole = await this.assertManager(workspaceId, actorId);
    const { role, customRoleId } = await this.resolveRoleRef(workspaceId, actorRole, roleRef);

    const token = randomBytes(24).toString('base64url');
    const expiresAt = new Date(Date.now() + INVITE_TTL_MS);
    await this.prisma.workspaceInvite.create({
      data: { workspaceId, tokenHash: hashInviteToken(token), role, customRoleId, createdBy: actorId, expiresAt },
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
      select: { id: true, role: true, createdAt: true, expiresAt: true, customRole: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return invites.map((i) => ({
      id: i.id,
      role: i.role,
      roleName: i.role === 'ADMIN' ? 'Admin' : (i.customRole?.name ?? 'Agent'),
      createdAt: i.createdAt,
      expiresAt: i.expiresAt,
    }));
  }

  async revokeInvite(workspaceId: string, userId: string, inviteId: string) {
    await this.assertManager(workspaceId, userId);
    const invite = await this.prisma.workspaceInvite.findFirst({ where: { id: inviteId, workspaceId }, select: { id: true } });
    if (!invite) throw new NotFoundException('Invite not found');
    await this.prisma.workspaceInvite.delete({ where: { id: inviteId } });
    return { ok: true };
  }

  /** Public preview of an invite (workspace name + role name) for the accept page. */
  async previewInvite(token: string) {
    const invite = await this.prisma.workspaceInvite.findUnique({
      where: { tokenHash: hashInviteToken(token) },
      select: { role: true, acceptedAt: true, expiresAt: true, workspace: { select: { name: true } }, customRole: { select: { name: true } } },
    });
    if (!invite || invite.acceptedAt || invite.expiresAt < new Date()) {
      throw new NotFoundException('Invite is invalid or has expired');
    }
    const roleName = invite.role === 'ADMIN' ? 'Admin' : (invite.customRole?.name ?? 'Agent');
    return { workspaceName: invite.workspace.name, role: invite.role, roleName };
  }
}
