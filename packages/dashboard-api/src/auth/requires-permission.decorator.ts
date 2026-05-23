import { SetMetadata } from '@nestjs/common';
import { PermissionScope } from '../lib/permissions';

export const REQUIRES_PERMISSION_KEY = 'requires_permission';

export const RequiresPermission = (scope: PermissionScope) =>
  SetMetadata(REQUIRES_PERMISSION_KEY, scope);
