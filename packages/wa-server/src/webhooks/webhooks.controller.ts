import { Controller, Post, Body, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { WebhookService } from './webhook.service';
import { SetCallbackDto } from './dto/set-callback.dto';

@ApiTags('Webhooks')
@Controller('webhooks')
export class WebhooksController {
  constructor(private webhookService: WebhookService) {}

  // Dashboard calls this on registration to set where events go
  @Post('callback')
  @ApiOperation({
    summary: 'Register webhook callback URL',
    description: 'Sets the URL to which the WA Server will forward all incoming WhatsApp events (messages, status updates, presence). The Dashboard calls this endpoint on first connection. Only one callback URL is active at a time — calling this again replaces the previous one.',
  })
  @ApiResponse({ status: 201, description: 'Callback URL registered successfully.' })
  @ApiResponse({ status: 400, description: 'Malformed request body or invalid URL.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid X-Api-Token.' })
  setCallback(@Body() body: SetCallbackDto) {
    this.webhookService.setDashboardUrl(body.url);
    return { success: true, message: 'Callback URL registered' };
  }

  @Get('callback')
  @ApiOperation({
    summary: 'Get webhook callback URL',
    description: 'Returns the currently registered callback URL, or null if none has been set.',
  })
  @ApiResponse({
    status: 200,
    description: 'Current callback URL.',
    schema: {
      type: 'object',
      properties: {
        url: { type: 'string', nullable: true, example: 'https://dashboard.example.com/webhook' },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Missing or invalid X-Api-Token.' })
  getCallbackUrl(): { url: string | null } {
    return { url: this.webhookService.getDashboardUrl() };
  }
}
