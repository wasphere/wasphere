import { Module } from '@nestjs/common';
import { MediaController } from './media.controller';
import { ApiKeysModule } from '../api-keys/api-keys.module';

@Module({
  imports: [ApiKeysModule], // provides ApiKeysService for CombinedAuthGuard
  controllers: [MediaController],
})
export class MediaModule {}
