/**
 * Normalizes a phone number to E.164 format with leading +.
 * Handles:
 *   923001234567        → +923001234567
 *   +92 300 123 4567   → +923001234567  (strips spaces)
 *   00923001234567      → +923001234567  (strips 00 prefix, adds +)
 *   923001234567@s.whatsapp.net → +923001234567
 *   group-id@g.us       → group-id@g.us  (pass through untouched)
 */
export function normalizePhone(raw: string): string {
  if (!raw) return raw
  // Group JID — pass through
  if (raw.includes('@g.us')) return raw
  // Strip @s.whatsapp.net suffix
  const stripped = raw.replace(/@s\.whatsapp\.net$/, '')
  // Remove all non-digit characters except leading +
  const hasPlus = stripped.startsWith('+')
  const digits = stripped.replace(/\D/g, '')
  // Strip leading double-zero (international prefix)
  const normalized = digits.startsWith('00') ? digits.slice(2) : digits
  return (hasPlus || !normalized.startsWith('00')) ? `+${normalized}` : `+${normalized}`
}
