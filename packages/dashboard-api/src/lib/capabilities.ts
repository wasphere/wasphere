import { WorkspaceRole } from '@prisma/client';

/**
 * Workspace *capabilities* — what a member is allowed to do in the dashboard.
 * Distinct from API-key PermissionScopes (which gate the public HTTP API for
 * machine clients). Capabilities gate the UI/owner endpoints.
 *
 *   inbox     — view + reply in the Inbox
 *   contacts  — view + edit the contact book
 *   messages  — the Messages page (manual / API sends)
 *   sessions  — manage WhatsApp connections (link/unlink numbers)
 *   webhooks  — manage outbound webhooks
 *   api_keys  — manage API keys (machine credentials)
 *   settings  — workspace settings, branding, danger-zone
 *
 * OWNER/ADMIN (authority tiers) always have every capability. A MEMBER (agent)
 * has exactly the capabilities of their assigned custom role.
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

export function isCapability(value: unknown): value is Capability {
  return typeof value === 'string' && CAPABILITIES.includes(value as Capability);
}

/** Keep only valid capability strings from arbitrary input (deduped). */
export function sanitizeCapabilities(input: unknown): Capability[] {
  if (!Array.isArray(input)) return [];
  const out = new Set<Capability>();
  for (const v of input) if (isCapability(v)) out.add(v);
  return [...out];
}

/**
 * Effective capability set for a member: owners/admins get everything; an
 * agent gets exactly their custom role's capabilities (empty if none).
 */
export function resolveCapabilities(
  role: WorkspaceRole,
  roleCapabilities: unknown,
): Capability[] {
  if (role === 'OWNER' || role === 'ADMIN') return [...CAPABILITIES];
  return sanitizeCapabilities(roleCapabilities);
}

export function hasCapability(
  role: WorkspaceRole,
  roleCapabilities: unknown,
  required: Capability,
): boolean {
  return resolveCapabilities(role, roleCapabilities).includes(required);
}
