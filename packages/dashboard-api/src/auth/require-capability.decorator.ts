import { SetMetadata } from '@nestjs/common';
import { Capability } from '../lib/capabilities';

export const CAPABILITY_KEY = 'required_capability';

/**
 * Gate a controller/route on a workspace capability. Enforced by
 * CapabilityGuard for human (JWT) members; API-key principals are skipped
 * (they're gated by ApiKeyPermissionGuard instead).
 */
export const RequireCapability = (capability: Capability) =>
  SetMetadata(CAPABILITY_KEY, capability);
