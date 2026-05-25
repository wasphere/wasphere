import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiKeysService } from '../api-keys/api-keys.service';

@Injectable()
export class CombinedAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly apiKeysService: ApiKeysService) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{ headers: Record<string, string | undefined>; user: unknown }>();
    const authHeader = request.headers['authorization'];

    if (typeof authHeader === 'string' && authHeader.startsWith('Bearer wsk_')) {
      const token = authHeader.slice(7);
      const apiKeyUser = await this.apiKeysService.validateApiKey(token);
      if (!apiKeyUser) throw new UnauthorizedException('Invalid or expired API key');
      request.user = apiKeyUser;
      return true;
    }

    return super.canActivate(context) as Promise<boolean>;
  }
}
