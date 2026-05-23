import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { hasPermission, PermissionScope, WILDCARD_PERMISSION } from '../lib/permissions';
import { ApiKeyUser } from '../api-keys/api-keys.service';
import { REQUIRES_PERMISSION_KEY } from './requires-permission.decorator';

@Injectable()
export class ApiKeyPermissionGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<PermissionScope | undefined>(
      REQUIRES_PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    );

    const req = context.switchToHttp().getRequest<{ user: unknown; params: Record<string, string> }>();
    const user = req.user as Partial<ApiKeyUser> & { email?: string };

    // JWT users (no permissions field) always pass — their access is controlled by
    // workspace membership checks in service layer.
    if (!('permissions' in user) || user.permissions === undefined) return true;

    // API key workspace scope: key must be scoped to the workspace being accessed.
    const routeWorkspaceId = req.params['id'] ?? req.params['workspaceId'];
    if (routeWorkspaceId && user.workspaceId && routeWorkspaceId !== user.workspaceId) {
      throw new ForbiddenException('API key is not authorized for this workspace');
    }

    // If no specific permission required, any valid API key passes.
    if (!required) return true;

    if (!hasPermission(user.permissions as (PermissionScope | typeof WILDCARD_PERMISSION)[], required)) {
      throw new ForbiddenException(`API key missing required permission: ${required}`);
    }

    return true;
  }
}
