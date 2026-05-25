import { Module } from '@nestjs/common';
import { WebhooksModule } from '../webhooks/webhooks.module';
import { InternalController } from './internal.controller';
import { InternalService } from './internal.service';
import { InternalSecretGuard } from './internal-secret.guard';

@Module({
  imports: [WebhooksModule],
  controllers: [InternalController],
  providers: [InternalService, InternalSecretGuard],
})
export class InternalModule {}
