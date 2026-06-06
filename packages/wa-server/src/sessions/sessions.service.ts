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
    const info = this.adapter.getSessionInfo(sessionId); // throws 404 if unknown
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

  async createSession(sessionId: string, proxy?: string, config?: Partial<SessionConfig>): Promise<SessionInfo> {
    // Meta sessions can't be created through the QR/Baileys lifecycle yet — the
    // setup wizard validates credentials + shows the callback URL; live Meta
    // session management lands with the unified provider lifecycle (v1.2 preview).
    if (config?.provider === 'meta') {
      throw new BadRequestException(
        'Meta Cloud API session creation is not available yet — validate your credentials in the setup wizard. Full Meta sessions arrive in the v1.2 preview.',
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

  getSessionInfo(sessionId: string): SessionInfo {
    return this.adapter.getSessionInfo(sessionId);
  }

  getAllSessions(): SessionInfo[] {
    return this.adapter.getAllSessions();
  }

  async deleteSession(sessionId: string): Promise<void> {
    return this.adapter.deleteSession(sessionId);
  }

  async logoutSession(sessionId: string): Promise<void> {
    return this.adapter.logoutSession(sessionId);
  }

  async patchSessionConfig(sessionId: string, dto: PatchSessionConfigDto): Promise<{ config: SessionConfig }> {
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
