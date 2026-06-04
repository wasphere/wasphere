export const WEBHOOK_EVENTS = [
  'message.sent',
  'message.delivered',
  'message.read',
  'message.failed',
  'message.received',
  // decrypted poll vote — used by Shopify/Woo order-confirmation flows (PRD §2.3)
  'poll.vote',
  'session.connected',
  'session.disconnected',
  'session.qr',
  'session.failed',
  'webhook.test',
] as const;

export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

export const WILDCARD_EVENT = '*' as const;

export function isValidEvents(events: unknown): events is (WebhookEvent | typeof WILDCARD_EVENT)[] {
  if (!Array.isArray(events) || events.length === 0) return false;
  if (events.length === 1 && events[0] === WILDCARD_EVENT) return true;
  return events.every(
    (e) => typeof e === 'string' && WEBHOOK_EVENTS.includes(e as WebhookEvent),
  );
}

export function eventMatchesFilter(
  filter: (WebhookEvent | typeof WILDCARD_EVENT)[],
  event: WebhookEvent,
): boolean {
  return filter.includes(WILDCARD_EVENT) || filter.includes(event);
}
