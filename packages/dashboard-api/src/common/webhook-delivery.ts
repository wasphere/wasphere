import { safeFetch, SsrfBlockedError, SsrfTimeoutError } from './safe-fetch';

/**
 * Result of an SSRF-guarded webhook delivery attempt.
 *
 * `error` is always a generic, safe-to-surface message — the real SSRF block
 * reason is logged server-side by safeFetch and never returned to the caller,
 * so an attacker cannot probe the guard through the test-fire response.
 */
export interface WebhookDeliveryResult {
  statusCode: number | null;
  success: boolean;
  /** True when the SSRF guard refused the destination (private/loopback/etc). */
  blocked: boolean;
  error: string | null;
}

// Webhook receivers only ever return a small ack body; we read it solely to
// drain the socket so the connection is released. Cap generously.
const DRAIN_MAX_BYTES = 1024 * 1024; // 1 MiB

/**
 * Delivers a webhook payload through the SSRF guard (DNS pinning, private-IP
 * denylist, manual redirect handling). Replaces raw `fetch()` on every
 * outbound webhook path so a user-controlled URL can never reach internal
 * services or cloud metadata endpoints.
 */
export async function deliverWebhook(
  url: string,
  rawBody: string,
  headers: Record<string, string>,
): Promise<WebhookDeliveryResult> {
  try {
    const resp = await safeFetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: rawBody,
      maxBytes: DRAIN_MAX_BYTES,
    });
    // Drain the response body so the underlying socket is freed.
    await resp.text().catch(() => '');
    const success = resp.status >= 200 && resp.status < 300;
    return {
      statusCode: resp.status,
      success,
      blocked: false,
      error: success ? null : `Endpoint returned ${resp.status}.`,
    };
  } catch (err) {
    if (err instanceof SsrfBlockedError) {
      return {
        statusCode: null,
        success: false,
        blocked: true,
        error: 'Delivery failed: destination not allowed.',
      };
    }
    if (err instanceof SsrfTimeoutError) {
      return {
        statusCode: null,
        success: false,
        blocked: false,
        error: 'Delivery failed: timeout.',
      };
    }
    return {
      statusCode: null,
      success: false,
      blocked: false,
      error: 'Delivery failed.',
    };
  }
}
