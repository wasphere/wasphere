import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { WebhooksService } from './webhooks.service';
import { CreateWebhookDto } from './dto/create-webhook.dto';
import { UpdateWebhookDto } from './dto/update-webhook.dto';

interface AuthenticatedRequest extends Request {
  user: { userId: string };
}

@ApiTags('Webhooks')
@ApiBearerAuth()
@Controller('workspaces/:workspaceId/webhooks')
@UseGuards(JwtAuthGuard)
export class WebhooksController {
  constructor(private readonly webhooksService: WebhooksService) {}

  @Get()
  @ApiOperation({ summary: 'List all webhooks for a workspace' })
  @ApiParam({ name: 'workspaceId', description: 'Workspace UUID' })
  @ApiResponse({ status: 200, description: 'Array of webhook metadata (no signing secrets)' })
  @ApiResponse({ status: 403, description: 'Not a member of this workspace' })
  list(@Req() req: AuthenticatedRequest, @Param('workspaceId') workspaceId: string) {
    return this.webhooksService.list(req.user.userId, workspaceId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a webhook',
    description:
      'Returns the signingSecret exactly once. Store it securely — it cannot be retrieved again.',
  })
  @ApiParam({ name: 'workspaceId', description: 'Workspace UUID' })
  @ApiResponse({ status: 201, description: 'Created webhook including signingSecret (shown once)' })
  @ApiResponse({ status: 400, description: 'Invalid events or URL' })
  @ApiResponse({ status: 403, description: 'Not a member of this workspace' })
  create(
    @Req() req: AuthenticatedRequest,
    @Param('workspaceId') workspaceId: string,
    @Body() dto: CreateWebhookDto,
  ) {
    return this.webhooksService.create(req.user.userId, workspaceId, dto);
  }

  @Patch(':webhookId')
  @ApiOperation({ summary: 'Update a webhook (name, url, events, active status, retry limit)' })
  @ApiParam({ name: 'workspaceId', description: 'Workspace UUID' })
  @ApiParam({ name: 'webhookId', description: 'Webhook UUID' })
  @ApiResponse({ status: 200, description: 'Updated webhook metadata' })
  @ApiResponse({ status: 400, description: 'Invalid events or URL' })
  @ApiResponse({ status: 403, description: 'Not a member of this workspace' })
  @ApiResponse({ status: 404, description: 'Webhook not found' })
  update(
    @Req() req: AuthenticatedRequest,
    @Param('workspaceId') workspaceId: string,
    @Param('webhookId') webhookId: string,
    @Body() dto: UpdateWebhookDto,
  ) {
    return this.webhooksService.update(req.user.userId, workspaceId, webhookId, dto);
  }

  @Post(':webhookId/test')
  @ApiOperation({
    summary: 'Send a test delivery to a webhook URL',
    description: 'Fires a webhook.test event immediately and returns the HTTP status from the receiver.',
  })
  @ApiParam({ name: 'workspaceId', description: 'Workspace UUID' })
  @ApiParam({ name: 'webhookId', description: 'Webhook UUID' })
  @ApiResponse({ status: 200, description: 'Test result: { success, statusCode, error }' })
  @ApiResponse({ status: 403, description: 'Not a member of this workspace' })
  @ApiResponse({ status: 404, description: 'Webhook not found' })
  testFire(
    @Req() req: AuthenticatedRequest,
    @Param('workspaceId') workspaceId: string,
    @Param('webhookId') webhookId: string,
  ) {
    return this.webhooksService.testFire(req.user.userId, workspaceId, webhookId);
  }

  @Delete(':webhookId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Permanently delete a webhook' })
  @ApiParam({ name: 'workspaceId', description: 'Workspace UUID' })
  @ApiParam({ name: 'webhookId', description: 'Webhook UUID' })
  @ApiResponse({ status: 200, description: 'Deletion confirmed' })
  @ApiResponse({ status: 403, description: 'Not a member of this workspace' })
  @ApiResponse({ status: 404, description: 'Webhook not found' })
  remove(
    @Req() req: AuthenticatedRequest,
    @Param('workspaceId') workspaceId: string,
    @Param('webhookId') webhookId: string,
  ) {
    return this.webhooksService.remove(req.user.userId, workspaceId, webhookId);
  }
}
