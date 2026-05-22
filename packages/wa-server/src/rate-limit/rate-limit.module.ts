import { Module } from '@nestjs/common';
import { RateLimitGuard } from './rate-limit.guard';

@Module({
  providers: [RateLimitGuard],
  exports: [RateLimitGuard],
})
export class RateLimitModule {}
