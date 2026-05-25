import { Module } from '@nestjs/common';
import { ApiKeysController } from './api-keys.controller';
import { ApiKeysService } from './api-keys.service';
import { CombinedAuthGuard } from '../auth/combined-auth.guard';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [ApiKeysController],
  providers: [ApiKeysService, CombinedAuthGuard],
  exports: [ApiKeysService, CombinedAuthGuard],
})
export class ApiKeysModule {}
