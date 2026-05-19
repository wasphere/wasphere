import { Controller, Post, Body } from '@nestjs/common';
import { IsString } from 'class-validator';
import { WebhookService } from './webhook.service';

class SetCallbackDto {
  @IsString()
  url: string;
}

@Controller('webhooks')
export class WebhooksController {
  constructor(private webhookService: WebhookService) {}

  // Dashboard calls this on registration to set where events go
  @Post('callback')
  setCallback(@Body() body: SetCallbackDto) {
    this.webhookService.setDashboardUrl(body.url);
    return { success: true, message: 'Callback URL registered' };
  }
}
