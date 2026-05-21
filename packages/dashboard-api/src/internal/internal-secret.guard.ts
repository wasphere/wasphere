import {
  CanActivate,
  ExecutionContext,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { timingSafeEqual } from 'crypto';
import { Request } from 'express';

@Injectable()
export class InternalSecretGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const incoming = req.headers['x-internal-secret'] as string | undefined;
    const expected = process.env.INTERNAL_WEBHOOK_SECRET ?? '';

    if (expected.length < 32) {
      throw new InternalServerErrorException(
        'INTERNAL_WEBHOOK_SECRET not configured',
      );
    }

    const a = Buffer.from(incoming ?? '');
    const b = Buffer.from(expected);

    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new UnauthorizedException('Invalid internal secret');
    }

    return true;
  }
}
