import { Controller, Get, Param, Req, Res } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { InboxSseService } from './inbox-sse.service';

@ApiTags('Inbox')
@Controller('workspaces/:workspaceId/inbox')
export class InboxSseController {
  constructor(private readonly sse: InboxSseService) {}

  // Auth is handled inside the service (accepts a Bearer header OR a `wa_token`
  // cookie, since EventSource can't set headers). No NestJS guard here.
  @Get('stream')
  @SkipThrottle()
  @ApiOperation({
    summary: 'Realtime inbox event stream (Server-Sent Events)',
    description:
      'Long-lived text/event-stream. Emits `message.new`, `conversation.update`, ' +
      'and `message.status` events for the workspace. Auth via Bearer or `wa_token` cookie.',
  })
  @ApiParam({ name: 'workspaceId', description: 'Workspace UUID' })
  @ApiResponse({ status: 200, description: 'SSE stream opened (text/event-stream)' })
  @ApiResponse({ status: 401, description: 'Missing/invalid token or not a workspace member' })
  @ApiResponse({ status: 429, description: 'Connection cap reached — fall back to polling' })
  async stream(
    @Param('workspaceId') workspaceId: string,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    await this.sse.handle(workspaceId, req, res);
  }
}
