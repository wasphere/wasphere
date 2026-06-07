import { ProviderCapabilities } from './provider.types';

/**
 * Capability presets per provider (design §9 mapping table, §10).
 *
 * Baileys (unofficial web protocol): everything except templates. No 24h window.
 * Meta Cloud API (official): no groups/presence/profile/polls/view-once/GIF;
 * templates supported; free-form only inside the 24h customer-service window.
 *
 * These are declarations only — the providers that expose them are wired in a
 * later PR.
 */

export const BAILEYS_CAPABILITIES: Readonly<ProviderCapabilities> = Object.freeze({
  groups: true,
  presence: true,
  profileEdit: true,
  polls: true,
  templates: false,
  interactiveButtons: true,
  reactions: true,
  viewOnce: true,
  mediaUpload: true,
  freeformAlways: true,
});

export const META_CAPABILITIES: Readonly<ProviderCapabilities> = Object.freeze({
  groups: false,
  presence: false,
  profileEdit: false,
  polls: false,
  templates: true,
  interactiveButtons: true,
  reactions: true,
  viewOnce: false,
  // v1.2 sends media to Meta in LINK mode only (public URL). The inbox/composer
  // uploads base64 — not supported until upload-mode lands in v1.3. Keep false so
  // the composer hides Photo/Document for Meta instead of failing at send.
  mediaUpload: false,
  freeformAlways: false,
});
