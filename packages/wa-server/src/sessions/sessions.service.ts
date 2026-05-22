import { Inject, Injectable } from '@nestjs/common';
import { WHATSAPP_ADAPTER, IWhatsAppAdapter, SessionInfo } from '../whatsapp/whatsapp-adapter.interface';

@Injectable()
export class SessionsService {
  constructor(
    @Inject(WHATSAPP_ADAPTER) private adapter: IWhatsAppAdapter,
  ) {}

  async createSession(sessionId: string, proxy?: string): Promise<SessionInfo> {
    return this.adapter.createSession(sessionId, proxy);
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
}
