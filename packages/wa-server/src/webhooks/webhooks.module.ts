import { Module, Global } from '@nestjs/common';
import { WebhookService } from './webhook.service';
import { WebhooksController } from './webhooks.controller';
import { MetaWebhookController } from './meta-webhook.controller';
import { MetaWebhookService } from './meta-webhook.service';

@Global() // WebhookService available everywhere without re-importing
@Module({
  providers: [WebhookService, MetaWebhookService],
  controllers: [WebhooksController, MetaWebhookController],
  exports: [WebhookService],
})
export class WebhooksModule {}
