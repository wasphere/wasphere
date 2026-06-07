import { Module } from '@nestjs/common';
import { MediaController } from './media.controller';

@Module({
  controllers: [MediaController],
})
export class MediaModule {}
