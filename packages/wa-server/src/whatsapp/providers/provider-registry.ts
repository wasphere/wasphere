import { Inject, Injectable } from '@nestjs/common';
import { WHATSAPP_ADAPTER, IWhatsAppAdapter, SendResult } from '../whatsapp-adapter.interface';
import { BaileysProvider } from './baileys.provider';
import { MetaCloudProvider } from './meta-cloud.provider';
import { MessageProvider, ProviderId } from './provider.types';
import { CapabilityError } from './capability-error';

/** The Meta provider only routes when explicitly opted in (decision #4). */
function metaEnabled(): boolean {
  return process.env.META_PROVIDER_ENABLED === 'true';
}

/**
 * Is this send failure worth retrying on the fallback provider? Transport/5xx/
 * disconnected errors are; a capability mismatch (e.g. polls on Meta) or a bad
 * request is NOT — those would fail identically on the fallback.
 */
function isRetryable(err: unknown): boolean {
  if (err instanceof CapabilityError) return false;
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
  if (/\b4\d\d\b/.test(msg) && !/\b429\b/.test(msg)) return false; // 4xx (except 429) = client error
  return /timeout|timed out|econn|enotfound|socket|network|disconnect|not connected|5\d\d|429|fetch failed|unavailable/.test(msg);
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
    // Meta sessions live in the MetaCloudProvider, NOT the Baileys adapter — so
    // ask the Meta provider directly. (Asking only the adapter resolved every
    // Meta session to Baileys, which then 404'd with "not found or not connected".)
    if (metaEnabled() && this.meta.has?.(sessionId)) return this.meta;
    return this.baileys;
  }

  /** Look up a provider by id. */
  get(id: ProviderId): MessageProvider {
    return id === 'meta' ? this.meta : this.baileys;
  }

  /** Session config from whichever provider owns the session (Meta or Baileys). */
  private sessionConfig(sessionId: string) {
    try {
      if (this.meta.has?.(sessionId)) return this.meta.getSessionInfo(sessionId)?.config;
      return this.adapter.getSessionInfo(sessionId)?.config;
    } catch {
      return undefined;
    }
  }

  /**
   * The opt-in backup provider for a session (`config.fallbackProvider`), or null.
   * Only active when Meta is enabled (the only non-Baileys provider today).
   */
  fallbackFor(sessionId: string): MessageProvider | null {
    if (!metaEnabled()) return null;
    const fb = this.sessionConfig(sessionId)?.fallbackProvider;
    return fb ? this.get(fb) : null;
  }

  /**
   * Run a send through the session's primary provider; on a *retryable* failure,
   * retry once through the opt-in fallback provider (design §11). Records `via`
   * on the result. With no fallback configured this is just the primary send.
   */
  async withFailover(
    sessionId: string,
    op: (provider: MessageProvider) => Promise<SendResult>,
  ): Promise<SendResult> {
    const primary = this.for(sessionId);
    try {
      const r = await op(primary);
      return { ...r, via: 'primary' };
    } catch (err) {
      const fallback = this.fallbackFor(sessionId);
      if (fallback && fallback !== primary && isRetryable(err)) {
        const r = await op(fallback);
        return { ...r, via: 'fallback' };
      }
      throw err;
    }
  }
}
