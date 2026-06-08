import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

interface ContactRow {
  id: string;
  savedName: string | null;
  whatsappName: string | null;
  phone: string;
  jid: string;
  avatarUrl: string | null;
  tags: string[];
  notes: string | null;
  updatedAt: Date;
}

const SELECT = {
  id: true, savedName: true, whatsappName: true, phone: true, jid: true,
  avatarUrl: true, tags: true, notes: true, updatedAt: true,
} as const;

function view(c: ContactRow) {
  return {
    id: c.id,
    name: c.savedName || c.whatsappName || c.phone,
    savedName: c.savedName,
    whatsappName: c.whatsappName,
    phone: c.phone,
    jid: c.jid,
    avatarUrl: c.avatarUrl,
    tags: c.tags ?? [],
    notes: c.notes,
    updatedAt: c.updatedAt,
  };
}

/** Trim, drop empties, cap length, dedupe (case-insensitive), cap count. */
function sanitizeTags(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of input) {
    if (typeof raw !== 'string') continue;
    const t = raw.trim().slice(0, 30);
    if (!t) continue;
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
    if (out.length >= 20) break;
  }
  return out;
}

function csvCell(v: string | null): string {
  const s = (v ?? '').replace(/"/g, '""');
  return /[",\n]/.test(s) ? `"${s}"` : s;
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
    q: { search?: string; tag?: string; limit?: number; cursor?: string },
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
    if (q.tag?.trim()) where.tags = { has: q.tag.trim() };

    const rows = await this.prisma.contact.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      take: take + 1,
      ...(q.cursor ? { cursor: { id: q.cursor }, skip: 1 } : {}),
      select: SELECT,
    });

    const nextCursor = rows.length > take ? rows[take - 1].id : null;
    return { items: rows.slice(0, take).map(view), nextCursor };
  }

  /** Distinct tags used across the workspace (for the filter + suggestions). */
  async listTags(userId: string, workspaceId: string): Promise<string[]> {
    await this.assertMember(workspaceId, userId);
    const rows = await this.prisma.$queryRaw<{ tag: string }[]>(
      Prisma.sql`SELECT DISTINCT unnest(tags) AS tag FROM contacts WHERE workspace_id = ${workspaceId}::uuid ORDER BY tag`,
    );
    return rows.map((r) => r.tag);
  }

  /** Manually add a contact by phone number. */
  async create(userId: string, workspaceId: string, dto: { phone: string; savedName?: string; tags?: unknown }) {
    await this.assertMember(workspaceId, userId);
    const digits = (dto.phone ?? '').replace(/[^0-9]/g, '');
    if (digits.length < 6) throw new BadRequestException('Enter a valid phone number (with country code).');
    const jid = `${digits}@s.whatsapp.net`;

    const existing = await this.prisma.contact.findUnique({
      where: { workspaceId_jid: { workspaceId, jid } },
      select: { id: true },
    });
    if (existing) throw new BadRequestException('A contact with this number already exists.');

    const created = await this.prisma.contact.create({
      data: {
        workspaceId,
        jid,
        phone: digits,
        savedName: dto.savedName?.trim() || null,
        tags: sanitizeTags(dto.tags),
      },
      select: SELECT,
    });
    return view(created);
  }

  async update(
    userId: string,
    workspaceId: string,
    contactId: string,
    dto: { savedName?: string | null; tags?: unknown; notes?: string | null },
  ) {
    await this.assertMember(workspaceId, userId);
    const existing = await this.prisma.contact.findFirst({
      where: { id: contactId, workspaceId },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException('Contact not found');

    const data: Prisma.ContactUpdateInput = {};
    if (dto.savedName !== undefined) data.savedName = dto.savedName?.trim() ? dto.savedName.trim() : null;
    if (dto.tags !== undefined) data.tags = sanitizeTags(dto.tags);
    if (dto.notes !== undefined) data.notes = dto.notes?.trim() ? dto.notes.trim().slice(0, 2000) : null;

    const updated = await this.prisma.contact.update({
      where: { id: contactId },
      data,
      select: SELECT,
    });
    return view(updated);
  }

  async remove(userId: string, workspaceId: string, contactId: string) {
    await this.assertMember(workspaceId, userId);
    const existing = await this.prisma.contact.findFirst({
      where: { id: contactId, workspaceId },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException('Contact not found');
    await this.prisma.contact.delete({ where: { id: contactId } });
    return { ok: true };
  }

  /** Apply a tag-add / tag-remove / delete across many contacts at once. */
  async bulk(
    userId: string,
    workspaceId: string,
    dto: { ids: string[]; action: 'addTag' | 'removeTag' | 'delete'; tag?: string },
  ) {
    await this.assertMember(workspaceId, userId);
    const ids = [...new Set(dto.ids)].slice(0, 500);
    if (ids.length === 0) throw new BadRequestException('No contacts selected');

    if (dto.action === 'delete') {
      const res = await this.prisma.contact.deleteMany({ where: { workspaceId, id: { in: ids } } });
      return { ok: true, affected: res.count };
    }

    const tag = dto.tag?.trim();
    if (!tag) throw new BadRequestException('Tag is required');
    const rows = await this.prisma.contact.findMany({
      where: { workspaceId, id: { in: ids } },
      select: { id: true, tags: true },
    });
    await this.prisma.$transaction(
      rows.map((c) => {
        const next =
          dto.action === 'addTag'
            ? sanitizeTags([...c.tags, tag])
            : c.tags.filter((t) => t.toLowerCase() !== tag.toLowerCase());
        return this.prisma.contact.update({ where: { id: c.id }, data: { tags: next } });
      }),
    );
    return { ok: true, affected: rows.length };
  }

  /** Build a CSV of the workspace's contacts (optionally a selected subset). */
  async exportCsv(userId: string, workspaceId: string, ids?: string[]) {
    await this.assertMember(workspaceId, userId);
    const where: Prisma.ContactWhereInput = { workspaceId };
    if (ids && ids.length) where.id = { in: [...new Set(ids)].slice(0, 10000) };
    const rows = await this.prisma.contact.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      take: 10000,
      select: SELECT,
    });
    const header = ['Name', 'Phone', 'Saved Name', 'WhatsApp Name', 'Tags', 'Notes'];
    const lines = [header.join(',')];
    for (const c of rows) {
      const v = view(c);
      lines.push([
        csvCell(v.name),
        csvCell(v.phone),
        csvCell(v.savedName),
        csvCell(v.whatsappName),
        csvCell(v.tags.join('; ')),
        csvCell(v.notes),
      ].join(','));
    }
    return { filename: `contacts-${workspaceId}.csv`, csv: lines.join('\n'), count: rows.length };
  }
}
