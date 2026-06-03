import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { InternalSecretGuard } from './internal-secret.guard';
import { InternalService } from './internal.service';
import { InboxIngestService } from '../inbox/inbox-ingest.service';
import { AuditEventDto } from './dto/audit-event.dto';
import { WebhookEventDto } from './dto/webhook-event.dto';

@ApiTags('Internal')
@Controller('internal')
@UseGuards(InternalSecretGuard)
export class InternalController {
  constructor(
    private readonly internalService: InternalService,
    private readonly inboxIngest: InboxIngestService,
  ) {}

  @Post('audit')
  @HttpCode(HttpStatus.CREATED)
  async audit(@Body() dto: AuditEventDto) {
    await this.internalService.ingestAudit(dto);
    return { success: true };
  }

  @Post('webhook-event/:workspaceId')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: 'Receive a WhatsApp event from wa-server and fan out to subscribed webhooks',
    description:
      'Called by wa-server only. workspaceId is embedded in DASHBOARD_WEBHOOK_URL so ' +
      'wa-server code is unchanged. Returns 202 immediately; delivery runs in background.',
  })
  @ApiParam({ name: 'workspaceId', description: 'Workspace UUID' })
  @ApiResponse({ status: 202, description: 'Accepted — fanout dispatched in background' })
  @ApiResponse({ status: 400, description: 'Invalid event type or payload' })
  @ApiResponse({ status: 401, description: 'Missing or invalid X-Internal-Secret' })
  webhookEvent(
    @Param('workspaceId') workspaceId: string,
    @Body() dto: WebhookEventDto,
  ) {
    // Run the two in parallel: existing webhook fan-out + new Inbox ingestion.
    // Both are fire-and-forget so the 202 returns immediately.
    this.internalService.fanoutWebhookEvent(workspaceId, dto);
    this.inboxIngest.ingest(workspaceId, dto);
    return { accepted: true };
  }
}
