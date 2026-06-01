/**
 * DEMO_MODE — serves seeded, read-only fixtures so demo.wasphere.com can show a
 * fully-populated dashboard with NO backend, NO database, and NO real WhatsApp
 * connection. Enabled with DEMO_MODE=true.
 *
 * Reads return canned data; writes are no-ops. Nothing here touches a real API.
 */

export const DEMO_MODE = process.env.DEMO_MODE === "true";

const WS_ID = "demo-workspace";

const sessions = [
  { id: "sales-team", status: "connected", phoneNumber: "+1 415 555 0142", name: "Sales Team", connectedAt: "2026-05-28T09:12:00.000Z", proxy: null },
  { id: "support-bot", status: "connected", phoneNumber: "+44 20 7946 0958", name: "Support Bot", connectedAt: "2026-05-30T14:03:00.000Z", proxy: "socks5://proxy.internal:1080" },
  { id: "billing-alerts", status: "qr_ready", phoneNumber: null, name: "Billing Alerts", connectedAt: null, proxy: null },
];

const webhooks = [
  { id: "wh_orders", name: "n8n — New Orders", url: "https://n8n.your-domain.com/webhook/whatsapp-orders", events: ["message.received", "message.read"], isActive: true, failureCount: 0, retryMax: 5, lastDeliveryAt: "2026-06-01T10:41:00.000Z", createdAt: "2026-05-22T08:00:00.000Z" },
  { id: "wh_crm", name: "CRM Sync", url: "https://crm.your-domain.com/api/wa/inbound", events: ["*"], isActive: true, failureCount: 1, retryMax: 5, lastDeliveryAt: "2026-06-01T09:58:00.000Z", createdAt: "2026-05-25T16:30:00.000Z" },
];

const apiKeys = [
  { id: "key_live", name: "Production key", prefix: "wsk_live_8fA2", permissions: ["*"], sessionScope: null, lastUsedAt: "2026-06-01T10:40:00.000Z", expiresAt: null, createdAt: "2026-05-20T12:00:00.000Z" },
  { id: "key_sales", name: "Sales (send only)", prefix: "wsk_live_3kP9", permissions: ["messages:send", "sessions:read"], sessionScope: "sales-team", lastUsedAt: "2026-06-01T08:15:00.000Z", expiresAt: null, createdAt: "2026-05-26T09:30:00.000Z" },
];

const stats = {
  messages24h: { count: 1284, previousDayCount: 1107 },
  successRate24h: { percentage: 98.6, failed: 18 },
  eventsToday: { count: 2431, byType: { "message.received": 1502, "message.read": 612, "session.connected": 4, "message.failed": 18 } },
  messages7d: [
    { date: "2026-05-26", count: 920 }, { date: "2026-05-27", count: 1045 },
    { date: "2026-05-28", count: 1198 }, { date: "2026-05-29", count: 877 },
    { date: "2026-05-30", count: 1320 }, { date: "2026-05-31", count: 1107 },
    { date: "2026-06-01", count: 1284 },
  ],
  recentActivity: [
    { id: "a1", method: "POST", endpoint: "/sessions/sales-team/messages/text", statusCode: 200, timestamp: "2026-06-01T10:41:12.000Z" },
    { id: "a2", method: "POST", endpoint: "/sessions/support-bot/messages/image", statusCode: 200, timestamp: "2026-06-01T10:39:50.000Z" },
    { id: "a3", method: "GET", endpoint: "/sessions", statusCode: 200, timestamp: "2026-06-01T10:38:02.000Z" },
    { id: "a4", method: "POST", endpoint: "/sessions/sales-team/messages/text", statusCode: 429, timestamp: "2026-06-01T10:36:44.000Z" },
  ],
};

const auditLogs = {
  items: stats.recentActivity.map((a) => ({ ...a, sessionId: a.endpoint.split("/")[2] ?? null, ipAddress: "203.0.113.10" })),
  total: 1284,
};

const workspace = {
  id: WS_ID,
  name: "Acme Co (Demo)",
  waServerUrl: "http://wa-server:3001",
  waServerToken: null,
  waServerConfigured: true,
};

interface DemoResult { ok: boolean; status: number; data: unknown }
const ok = (data: unknown): DemoResult => ({ ok: true, status: 200, data });

/**
 * Returns a seeded response for a given API path, or null if the path is not
 * recognised (caller then falls back to a generic empty-success in demo mode).
 */
export function demoApiResponse(path: string, method: string): DemoResult {
  const p = path.split("?")[0];
  const m = method.toUpperCase();

  // Writes never hit a backend in demo mode — accept them as harmless no-ops.
  if (m !== "GET") {
    if (/\/proxy\/api\/sessions\/[^/]+\/messages\//.test(p)) {
      return ok({ id: "demo-msg", status: "sent", to: "demo", timestamp: new Date(0).toISOString() });
    }
    return ok({ success: true, demo: true });
  }

  if (p === "/workspaces") return ok([workspace]);
  if (/^\/workspaces\/[^/]+$/.test(p)) return ok(workspace);
  if (/\/proxy\/api\/sessions\/[^/]+$/.test(p)) {
    const id = p.split("/").pop();
    return ok(sessions.find((s) => s.id === id) ?? sessions[0]);
  }
  if (/\/proxy\/api\/sessions$/.test(p)) return ok(sessions);
  if (/\/proxy\/api\/health(\/live|\/ready)?$/.test(p)) return ok({ status: "ok", version: "1.0.0" });
  if (/\/stats$/.test(p)) return ok(stats);
  if (/\/webhooks$/.test(p)) return ok(webhooks);
  if (/\/webhooks\/[^/]+\/test$/.test(p)) return ok({ success: true, statusCode: 200, error: null });
  if (/\/api-keys$/.test(p)) return ok(apiKeys);
  if (/\/audit-logs$/.test(p)) return ok(auditLogs);

  // Unknown GET — empty success so the UI renders without errors.
  return ok({});
}
