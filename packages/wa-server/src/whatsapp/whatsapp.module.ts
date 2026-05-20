import { Global, Module } from '@nestjs/common';
import { BaileysAdapter } from './baileys.adapter';
import { WHATSAPP_ADAPTER } from './whatsapp-adapter.interface';

@Global()
@Module({
  providers: [{ provide: WHATSAPP_ADAPTER, useClass: BaileysAdapter }],
  exports: [WHATSAPP_ADAPTER],
})
export class WhatsAppModule {}
