import { WorkspaceRole } from '@prisma/client';

/**
 * Workspace *capabilities* — what a human member is allowed to do in the
 * dashboard. Distinct from API-key PermissionScopes (which gate the public
 * HTTP API for machine clients). Capabilities gate the UI/owner endpoints.
 *
 * Each capability maps to a section of the product:
 *   inbox     — view + reply in the Inbox
 *   contacts  — view + edit the contact book
 *   messages  — the Messages page (manual / API sends)
 *   sessions  — manage WhatsApp connections (link/unlink numbers)
 *   webhooks  — manage outbound webhooks
 *   api_keys  — manage API keys (machine credentials)
 *   settings  — workspace settings, branding, danger-zone
 */
export const CAPABILITIES = [
  'inbox',
  'contacts',
  'messages',
  'sessions',
  'webhooks',
  'api_keys',
  'settings',
] as const;

export type Capability = (typeof CAPABILITIES)[number];

/** What an agent (MEMBER) can always do, with no extra grants. */
export const DEFAULT_MEMBER_CAPABILITIES: Capability[] = ['inbox', 'contacts'];

/**
 * Capabilities an OWNER/ADMIN may grant to an agent on top of the defaults.
 * `team` is intentionally NOT grantable — managing roles/permissions stays
 * owner/admin-only to avoid privilege escalation.
 */
export const GRANTABLE_CAPABILITIES: Capability[] = [
  'messages',
  'sessions',
  'webhooks',
  'api_keys',
  'settings',
];

export function isCapability(value: unknown): value is Capability {
  return typeof value === 'string' && CAPABILITIES.includes(value as Capability);
}

/** Keep only valid, grantable capabilities from arbitrary input. */
export function sanitizeGrants(input: unknown): Capability[] {
  if (!Array.isArray(input)) return [];
  const out = new Set<Capability>();
  for (const v of input) {
    if (isCapability(v) && GRANTABLE_CAPABILITIES.includes(v)) out.add(v);
  }
  return [...out];
}

/**
 * The effective capability set for a member: owners/admins get everything;
 * agents get their defaults plus whatever was granted to them.
 */
export function resolveCapabilities(
  role: WorkspaceRole,
  grants: unknown,
): Capability[] {
  if (role === 'OWNER' || role === 'ADMIN') return [...CAPABILITIES];
  return [...new Set([...DEFAULT_MEMBER_CAPABILITIES, ...sanitizeGrants(grants)])];
}

export function hasCapability(
  role: WorkspaceRole,
  grants: unknown,
  required: Capability,
): boolean {
  return resolveCapabilities(role, grants).includes(required);
}
