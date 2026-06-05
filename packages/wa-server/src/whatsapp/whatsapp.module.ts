import { Global, Module } from '@nestjs/common';
import { BaileysAdapter } from './baileys.adapter';
import { WHATSAPP_ADAPTER } from './whatsapp-adapter.interface';
import { BaileysProvider } from './providers/baileys.provider';
import { MetaCloudProvider } from './providers/meta-cloud.provider';
import { ProviderRegistry } from './providers/provider-registry';

@Global()
@Module({
  providers: [
    { provide: WHATSAPP_ADAPTER, useClass: BaileysAdapter },
    BaileysProvider,
    MetaCloudProvider,
    ProviderRegistry,
  ],
  exports: [WHATSAPP_ADAPTER, BaileysProvider, MetaCloudProvider, ProviderRegistry],
})
export class WhatsAppModule {}
