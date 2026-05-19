import { Module, Global } from '@nestjs/common';
import { WebhookService } from './webhook.service';
import { WebhooksController } from './webhooks.controller';

@Global() // WebhookService available everywhere without re-importing
@Module({
  providers: [WebhookService],
  controllers: [WebhooksController],
  exports: [WebhookService],
})
export class WebhooksModule {}
