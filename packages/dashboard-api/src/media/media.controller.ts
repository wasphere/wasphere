import { Controller, Get, Param, Query, Res, NotFoundException, ForbiddenException } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { verifyMediaToken } from './media-token';

/**
 * Public, token-protected media download. Lets webhook consumers (n8n etc.)
 * fetch a message's media by URL instead of receiving a multi-MB base64 blob
 * inline. The HMAC token is stateless — no session/cookie needed.
 */
@ApiExcludeController()
@Controller('media')
export class MediaController {
  constructor(private readonly prisma: PrismaService) {}

  @Get(':workspaceId/:waMessageId')
  async get(
    @Param('workspaceId') workspaceId: string,
    @Param('waMessageId') waMessageId: string,
    @Query('t') token: string,
    @Res() res: Response,
  ): Promise<void> {
    if (!verifyMediaToken(workspaceId, waMessageId, token)) {
      throw new ForbiddenException('Invalid media token');
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
    const fileName =
      (msg?.payload as Record<string, unknown> | null)?.fileName as string | undefined;

    res.setHeader('Content-Type', mime);
    res.setHeader('Content-Length', String(buffer.length));
    res.setHeader('Cache-Control', 'private, max-age=3600');
    if (fileName) res.setHeader('Content-Disposition', `inline; filename="${fileName.replace(/"/g, '')}"`);
    res.end(buffer);
  }
}
