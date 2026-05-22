import { CanActivate, ExecutionContext, HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import { WHATSAPP_ADAPTER, IWhatsAppAdapter } from '../whatsapp/whatsapp-adapter.interface';

@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly windowStore = new Map<string, number[]>();
  private readonly max: number;
  private readonly windowMs: number;

  constructor(
    @Inject(WHATSAPP_ADAPTER) private readonly adapter: IWhatsAppAdapter,
  ) {
    this.max = parseInt(process.env.RATE_LIMIT_MAX ?? '30', 10);
    this.windowMs = parseInt(process.env.RATE_LIMIT_WINDOW_MS ?? '60000', 10);

    setInterval(() => this.evictStale(Date.now() - this.windowMs), Math.floor(this.windowMs / 2));
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<import('express').Request>();
    const sessionId: string = request.params['sessionId'];

    if (!sessionId || typeof sessionId !== 'string') return true;

    const sessions = this.adapter.getAllSessions();
    if (!sessions.some(s => s.id === sessionId)) return true;

    const response = context.switchToHttp().getResponse<import('express').Response>();
    this.checkLimit(sessionId, response);
    return true;
  }

  private checkLimit(sessionId: string, response: import('express').Response): void {
    const now = Date.now();
    const cutoff = now - this.windowMs;

    this.evictStale(cutoff);

    let timestamps = this.windowStore.get(sessionId);
    if (!timestamps) {
      timestamps = [];
      this.windowStore.set(sessionId, timestamps);
    }

    while (timestamps.length > 0 && timestamps[0] < cutoff) {
      timestamps.shift();
    }

    if (timestamps.length >= this.max) {
      const retryAfterSec = Math.ceil((this.windowMs - (now - timestamps[0])) / 1000);
      response.setHeader('Retry-After', String(retryAfterSec));
      throw new HttpException(
        { statusCode: 429, error: 'Too Many Requests', retryAfter: retryAfterSec },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    timestamps.push(now);
  }

  private evictStale(cutoff: number): void {
    for (const [sid, timestamps] of this.windowStore) {
      if (timestamps.length === 0 || timestamps[timestamps.length - 1] < cutoff) {
        this.windowStore.delete(sid);
      }
    }
  }
}
