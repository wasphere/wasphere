import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { WHATSAPP_ADAPTER, IWhatsAppAdapter, SessionInfo, SessionConfig } from '../whatsapp/whatsapp-adapter.interface';
import { PatchSessionConfigDto } from './dto/patch-session-config.dto';
import { MetaTestConnectionDto } from './dto/meta-test-connection.dto';
import { ProviderRegistry, MetaCloudProvider, ProviderId, ProviderCapabilities } from '../whatsapp/providers';

@Injectable()
export class SessionsService {
  constructor(
    @Inject(WHATSAPP_ADAPTER) private adapter: IWhatsAppAdapter,
    private readonly registry: ProviderRegistry,
    private readonly meta: MetaCloudProvider,
  ) {}

  /** Provider capabilities for a session (design §10) — drives capability-gated UI. */
  getCapabilities(sessionId: string): { provider: ProviderId; capabilities: ProviderCapabilities } {
    const info = this.getSessionInfo(sessionId); // unified (Baileys or Meta)
    const provider: ProviderId = info.config?.provider ?? 'baileys';
    return { provider, capabilities: this.registry.get(provider).capabilities };
  }

  /** Validate Meta credentials without creating a session (setup wizard "Test connection"). */
  testMetaConnection(dto: MetaTestConnectionDto) {
    return this.meta.testConnection({
      kind: 'meta',
      phoneNumberId: dto.phoneNumberId,
      accessToken: dto.accessToken,
      wabaId: '',
      verifyToken: '',
    });
  }

  async createSession(
    sessionId: string,
    proxy?: string,
    config?: Partial<SessionConfig>,
    metaCreds?: { phoneNumberId: string; accessToken: string; wabaId?: string; verifyToken?: string; appSecret?: string },
  ): Promise<SessionInfo> {
    if (config?.provider === 'meta') {
      if (process.env.META_PROVIDER_ENABLED !== 'true') {
        throw new BadRequestException('Meta provider is disabled — set META_PROVIDER_ENABLED=true to create Meta sessions.');
      }
      if (!metaCreds?.phoneNumberId || !metaCreds?.accessToken) {
        throw new BadRequestException('Meta sessions require phoneNumberId and accessToken.');
      }
      return this.meta.init(
        sessionId,
        {
          kind: 'meta',
          phoneNumberId: metaCreds.phoneNumberId,
          accessToken: metaCreds.accessToken,
          wabaId: metaCreds.wabaId ?? '',
          verifyToken: metaCreds.verifyToken ?? '',
          appSecret: metaCreds.appSecret,
        },
        config,
      );
    }

    if (config?.random_delay_min_ms !== undefined && config?.random_delay_max_ms !== undefined) {
      const { random_delay_min_ms: min, random_delay_max_ms: max } = config;
      if (max < min) {
        throw new BadRequestException('random_delay_max_ms must be >= random_delay_min_ms');
      }
    }
    return this.adapter.createSession(sessionId, proxy, config);
  }

  // ── Unified session view across providers (Baileys + Meta) ──────────────

  getSessionInfo(sessionId: string): SessionInfo {
    if (this.meta.has(sessionId)) return this.meta.getSessionInfo(sessionId)!;
    return this.adapter.getSessionInfo(sessionId);
  }

  getAllSessions(): SessionInfo[] {
    return [...this.adapter.getAllSessions(), ...this.meta.getAllSessions()];
  }

  async deleteSession(sessionId: string): Promise<void> {
    if (this.meta.has(sessionId)) return this.meta.destroy(sessionId);
    return this.adapter.deleteSession(sessionId);
  }

  async logoutSession(sessionId: string): Promise<void> {
    // Meta is stateless — "logout" just removes the stored session.
    if (this.meta.has(sessionId)) return this.meta.destroy(sessionId);
    return this.adapter.logoutSession(sessionId);
  }

  async patchSessionConfig(sessionId: string, dto: PatchSessionConfigDto): Promise<{ config: SessionConfig }> {
    if (this.meta.has(sessionId)) {
      throw new BadRequestException('Per-session anti-ban config applies to Baileys sessions only.');
    }
    // Verify session exists (throws 404 if not)
    this.adapter.getSessionInfo(sessionId);

    // Cross-field validation
    const min = dto.random_delay_min_ms;
    const max = dto.random_delay_max_ms;
    if (min !== undefined && max !== undefined && max < min) {
      throw new BadRequestException('random_delay_max_ms must be >= random_delay_min_ms');
    }

    return this.adapter.patchSessionConfig(sessionId, dto);
  }
}
