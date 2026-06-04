import { Injectable } from '@nestjs/common';
import { BaileysProvider } from './baileys.provider';
import { MessageProvider, ProviderId } from './provider.types';

/**
 * Resolves the {@link MessageProvider} for a session (design §2.3).
 *
 * v1.2 scope (this PR): **every session is Baileys**. Per-session provider
 * selection (`session.provider`) lands in a later PR, and `MetaCloudProvider` is
 * registered then. Until then `for()` always returns Baileys, so behaviour is
 * identical to the previous direct-adapter wiring.
 */
@Injectable()
export class ProviderRegistry {
  constructor(private readonly baileys: BaileysProvider) {}

  /**
   * The provider for a given session. Defaults to Baileys; once per-session
   * provider config exists this will read `session.provider`.
   */
  for(sessionId: string): MessageProvider {
    void sessionId; // reserved — used once per-session provider config exists
    return this.baileys;
  }

  /** Look up a provider by id. */
  get(id: ProviderId): MessageProvider {
    if (id === 'baileys') return this.baileys;
    // 'meta' is registered in a later PR (Meta send path).
    throw new Error(`Provider '${id}' is not available`);
  }
}
