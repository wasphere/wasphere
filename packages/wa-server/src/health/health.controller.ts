import { Controller, Get, Inject, HttpException, HttpCode } from '@nestjs/common';
import { ApiExcludeEndpoint } from '@nestjs/swagger';
import { readFileSync } from 'fs';
import { WHATSAPP_ADAPTER, IWhatsAppAdapter } from '../whatsapp/whatsapp-adapter.interface';

const { version } = JSON.parse(readFileSync('package.json', 'utf8')) as { version: string };

@Controller('health')
export class HealthController {
  constructor(
    @Inject(WHATSAPP_ADAPTER) private readonly adapter: IWhatsAppAdapter,
  ) {}

  @ApiExcludeEndpoint()
  @Get()
  check() {
    const sessions = this.adapter.getAllSessions().map(s => ({ id: s.id, status: s.status }));
    const connectedSessions = sessions.filter(s => s.status === 'connected').length;
    return {
      status: 'ok',
      version,
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      memory: process.memoryUsage(),
      whatsapp: {
        totalSessions: sessions.length,
        connectedSessions,
        sessions,
      },
    };
  }

  @ApiExcludeEndpoint()
  @Get('live')
  live() {
    return { status: 'ok' };
  }

  @ApiExcludeEndpoint()
  @Get('ready')
  ready() {
    const connected = this.adapter.getAllSessions()
      .filter(s => s.status === 'connected').length;
    if (connected === 0) {
      throw new HttpException({ status: 'not_ready', connectedSessions: 0 }, 503);
    }
    return { status: 'ready', connectedSessions: connected };
  }
}
