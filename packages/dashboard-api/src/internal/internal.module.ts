import { Module } from '@nestjs/common';
import { InternalController } from './internal.controller';
import { InternalService } from './internal.service';
import { InternalSecretGuard } from './internal-secret.guard';

@Module({
  controllers: [InternalController],
  providers: [InternalService, InternalSecretGuard],
})
export class InternalModule {}
