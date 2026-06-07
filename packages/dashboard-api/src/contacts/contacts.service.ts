import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

interface ContactRow {
  id: string;
  savedName: string | null;
  whatsappName: string | null;
  phone: string;
  jid: string;
  avatarUrl: string | null;
  updatedAt: Date;
}

function view(c: ContactRow) {
  return {
    id: c.id,
    name: c.savedName || c.whatsappName || c.phone,
    savedName: c.savedName,
    whatsappName: c.whatsappName,
    phone: c.phone,
    jid: c.jid,
    avatarUrl: c.avatarUrl,
    updatedAt: c.updatedAt,
  };
}

@Injectable()
export class ContactsService {
  constructor(private readonly prisma: PrismaService) {}

  private async assertMember(workspaceId: string, userId: string): Promise<void> {
    const m = await this.prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
      select: { id: true },
    });
    if (!m) throw new ForbiddenException('Not a member of this workspace');
  }

  async list(
    userId: string,
    workspaceId: string,
    q: { search?: string; limit?: number; cursor?: string },
  ) {
    await this.assertMember(workspaceId, userId);
    const take = Math.min(Math.max(q.limit ?? 50, 1), 100);

    const where: Prisma.ContactWhereInput = { workspaceId };
    const s = q.search?.trim();
    if (s) {
      where.OR = [
        { phone: { contains: s.replace(/[^0-9]/g, '') || s } },
        { savedName: { contains: s, mode: 'insensitive' } },
        { whatsappName: { contains: s, mode: 'insensitive' } },
      ];
    }

    const rows = await this.prisma.contact.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      take: take + 1,
      ...(q.cursor ? { cursor: { id: q.cursor }, skip: 1 } : {}),
      select: { id: true, savedName: true, whatsappName: true, phone: true, jid: true, avatarUrl: true, updatedAt: true },
    });

    const nextCursor = rows.length > take ? rows[take - 1].id : null;
    return { items: rows.slice(0, take).map(view), nextCursor };
  }

  async rename(userId: string, workspaceId: string, contactId: string, savedName: string | null) {
    await this.assertMember(workspaceId, userId);
    const existing = await this.prisma.contact.findFirst({
      where: { id: contactId, workspaceId },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException('Contact not found');
    const updated = await this.prisma.contact.update({
      where: { id: contactId },
      data: { savedName: savedName?.trim() ? savedName.trim() : null },
      select: { id: true, savedName: true, whatsappName: true, phone: true, jid: true, avatarUrl: true, updatedAt: true },
    });
    return view(updated);
  }
}
