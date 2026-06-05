import { Body, Controller, Get, HttpCode, Param, Post, Query, Req, Res } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { MetaWebhookService } from './meta-webhook.service';

/**
 * Public Meta Cloud API webhook endpoint (design §7) — `/api/meta/webhook/:sessionId`.
 * Excluded from API-token auth in `AppModule` (Meta sends no token); secured by the
 * verify-token handshake (GET) and the `X-Hub-Signature-256` HMAC (POST).
 */
@ApiExcludeController()
@Controller('meta/webhook')
export class MetaWebhookController {
  constructor(private readonly svc: MetaWebhookService) {}

  @Get(':sessionId')
  verify(
    @Param('sessionId') sessionId: string,
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string,
    @Res() res: Response,
  ): void {
    const echo = this.svc.verifyHandshake(sessionId, mode, token, challenge);
    res.status(200).type('text/plain').send(echo);
  }

  @Post(':sessionId')
  @HttpCode(200)
  async receive(
    @Param('sessionId') sessionId: string,
    @Req() req: Request,
    @Body() body: unknown,
  ): Promise<{ received: boolean }> {
    const rawBody = (req as Request & { rawBody?: Buffer }).rawBody;
    const sig = req.headers['x-hub-signature-256'] as string | undefined;
    await this.svc.ingest(sessionId, rawBody, sig, body);
    return { received: true };
  }
}
