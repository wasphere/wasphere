import { Module } from '@nestjs/common';
import { WebhooksModule } from '../webhooks/webhooks.module';
import { InboxModule } from '../inbox/inbox.module';
import { InternalController } from './internal.controller';
import { InternalService } from './internal.service';
import { InternalSecretGuard } from './internal-secret.guard';

// InboxModule -> InboxIngestService persists inbound messages alongside fan-out
@Module({
  imports: [WebhooksModule, InboxModule],
  controllers: [InternalController],
  providers: [InternalService, InternalSecretGuard],
})
export class InternalModule {}
