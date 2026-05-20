import { Injectable, NestMiddleware, UnauthorizedException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class AuthMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const token = req.headers['x-api-token'] as string | undefined;
    const serverToken = process.env.WA_TOKEN;

    if (!token || token !== serverToken) {
      throw new UnauthorizedException('Invalid or missing token');
    }

    next();
  }
}
