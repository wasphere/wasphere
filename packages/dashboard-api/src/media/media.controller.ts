import {
  Controller,
  Get,
  Param,
  Req,
  Res,
  UseGuards,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { CombinedAuthGuard } from '../auth/combined-auth.guard';

/**
 * Authenticated media download for webhook consumers (n8n etc.). Fetched with
 * `Authorization: Bearer <wsk_ API key>` — NO token in the URL, so the link is
 * not a public/shareable secret. The workspace is taken from the API key, so a
 * key can only ever read its own workspace's media (no IDOR).
 */
@ApiExcludeController()
@Controller('media')
@UseGuards(CombinedAuthGuard)
export class MediaController {
  constructor(private readonly prisma: PrismaService) {}

  @Get(':waMessageId')
  async get(
    @Param('waMessageId') waMessageId: string,
    @Req() req: Request & { user?: { workspaceId?: string } },
    @Res() res: Response,
  ): Promise<void> {
    const workspaceId = req.user?.workspaceId;
    if (!workspaceId) {
      // JWT sessions have no single workspace context here — media download is
      // an API-key feature (the key scopes the workspace).
      throw new UnauthorizedException('Use a workspace API key to download media');
    }

    const msg = await this.prisma.message.findUnique({
      where: { workspaceId_waMessageId: { workspaceId, waMessageId } },
      select: { mediaUrl: true, payload: true },
    });
    const dataUri = msg?.mediaUrl;
    const match = dataUri ? /^data:([^;]+);base64,(.*)$/s.exec(dataUri) : null;
    if (!match) throw new NotFoundException('Media not found');

    const mime = match[1];
    const buffer = Buffer.from(match[2], 'base64');
    const fileName = (msg?.payload as Record<string, unknown> | null)?.fileName as string | undefined;

    res.setHeader('Content-Type', mime);
    res.setHeader('Content-Length', String(buffer.length));
    res.setHeader('Cache-Control', 'private, max-age=3600');
    if (fileName) res.setHeader('Content-Disposition', `inline; filename="${fileName.replace(/"/g, '')}"`);
    res.end(buffer);
  }
}
