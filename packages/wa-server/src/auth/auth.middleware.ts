import { Injectable, NestMiddleware, UnauthorizedException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { timingSafeEqual } from 'crypto';

@Injectable()
export class AuthMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const incoming = req.headers['x-api-token'] as string | undefined;
    const serverToken = process.env.WA_TOKEN ?? '';

    const a = Buffer.from(incoming ?? '');
    const b = Buffer.from(serverToken);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new UnauthorizedException('Invalid or missing token');
    }

    next();
  }
}
