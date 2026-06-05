import { Inject, Injectable } from '@nestjs/common';
import { WHATSAPP_ADAPTER, IWhatsAppAdapter } from '../whatsapp-adapter.interface';
import { BaileysProvider } from './baileys.provider';
import { MetaCloudProvider } from './meta-cloud.provider';
import { MessageProvider, ProviderId } from './provider.types';

/** The Meta provider only routes when explicitly opted in (decision #4). */
function metaEnabled(): boolean {
  return process.env.META_PROVIDER_ENABLED === 'true';
}

/**
 * Resolves the {@link MessageProvider} for a session (design §2.3).
 *
 * A session routes to {@link MetaCloudProvider} only when **both** the
 * `META_PROVIDER_ENABLED` flag is on **and** the session's `config.provider` is
 * `'meta'`. The flag ships **off** in v1.2.0, so every session resolves to
 * Baileys and behaviour is identical to the previous direct-adapter wiring.
 */
@Injectable()
export class ProviderRegistry {
  constructor(
    private readonly baileys: BaileysProvider,
    private readonly meta: MetaCloudProvider,
    @Inject(WHATSAPP_ADAPTER) private readonly adapter: IWhatsAppAdapter,
  ) {}

  /** The provider for a given session — reads `session.provider` when Meta is enabled. */
  for(sessionId: string): MessageProvider {
    if (metaEnabled()) {
      try {
        if (this.adapter.getSessionInfo(sessionId).config?.provider === 'meta') {
          return this.meta;
        }
      } catch {
        // Unknown session (or Meta-only session not in the Baileys map) — default below.
      }
    }
    return this.baileys;
  }

  /** Look up a provider by id. */
  get(id: ProviderId): MessageProvider {
    return id === 'meta' ? this.meta : this.baileys;
  }
}
