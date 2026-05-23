export const PERMISSION_SCOPES = [
  'messages:send',
  'messages:send_bulk',
  'messages:read',
  'sessions:read',
  'sessions:write',
  'sessions:delete',
  'webhooks:read',
  'webhooks:write',
  'webhooks:delete',
  'workspace:read',
  'workspace:write',
  'audit:read',
] as const;

export type PermissionScope = (typeof PERMISSION_SCOPES)[number];

export const WILDCARD_PERMISSION = '*' as const;

export function isValidPermissions(perms: unknown): perms is (PermissionScope | typeof WILDCARD_PERMISSION)[] {
  if (!Array.isArray(perms) || perms.length === 0) return false;
  if (perms.length === 1 && perms[0] === WILDCARD_PERMISSION) return true;
  return perms.every(
    (p) => typeof p === 'string' && PERMISSION_SCOPES.includes(p as PermissionScope),
  );
}

export function hasPermission(
  granted: (PermissionScope | typeof WILDCARD_PERMISSION)[],
  required: PermissionScope,
): boolean {
  return granted.includes(WILDCARD_PERMISSION) || granted.includes(required);
}
