import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { WHATSAPP_ADAPTER, IWhatsAppAdapter, SessionInfo, SessionConfig } from '../whatsapp/whatsapp-adapter.interface';
import { PatchSessionConfigDto } from './dto/patch-session-config.dto';

@Injectable()
export class SessionsService {
  constructor(
    @Inject(WHATSAPP_ADAPTER) private adapter: IWhatsAppAdapter,
  ) {}

  async createSession(sessionId: string, proxy?: string, config?: Partial<SessionConfig>): Promise<SessionInfo> {
    if (config?.random_delay_min_ms !== undefined && config?.random_delay_max_ms !== undefined) {
      const { random_delay_min_ms: min, random_delay_max_ms: max } = config;
      if (min > 0 && max > 0 && max < min) {
        throw new BadRequestException('random_delay_max_ms must be >= random_delay_min_ms when both are non-zero');
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
    if (min !== undefined && max !== undefined && min > 0 && max > 0 && max < min) {
      throw new BadRequestException('random_delay_max_ms must be >= random_delay_min_ms when both are non-zero');
    }

    return this.adapter.patchSessionConfig(sessionId, dto);
  }
}
