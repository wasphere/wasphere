import { Module } from '@nestjs/common';
import { MessagesService } from './messages.service';
import { MessagesController } from './messages.controller';
import { OutboundEventInterceptor } from './outbound-event.interceptor';

@Module({
  providers: [MessagesService, OutboundEventInterceptor],
  controllers: [MessagesController],
})
export class MessagesModule {}
