// Logic moved to main.ts app.use() — NestJS MiddlewareConsumer does not fire on unmatched routes.
import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

// Patterns that indicate path traversal in the raw URL before Express normalises it
const TRAVERSAL_RE = /(?:\/|%2f)(?:\.\.?|%2e%2e?)(?:\/|%2f|$)/i;

@Injectable()
export class RawUrlGuardMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    if (TRAVERSAL_RE.test(req.url)) {
      res.status(400).json({ error: 'INVALID_SESSION_ID' });
      return;
    }
    next();
  }
}
