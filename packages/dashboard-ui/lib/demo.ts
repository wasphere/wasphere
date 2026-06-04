/**
 * DEMO_MODE — serves seeded, read-only fixtures so demo.wasphere.com can show a
 * fully-populated dashboard with NO backend, NO database, and NO real WhatsApp
 * connection. Enabled with DEMO_MODE=true.
 *
 * Reads return canned data; writes are no-ops. Nothing here touches a real API.
 *
 * Every ID, key, and prefix below is FAKE. Real API keys use the `wsk_` prefix;
 * these demo fixtures use `wsk_demo_` so they can never be mistaken for real
 * credentials.
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
  { id: "key_live", name: "Production key", prefix: "wsk_demo_8fA2", permissions: ["*"], sessionScope: null, lastUsedAt: "2026-06-01T10:40:00.000Z", expiresAt: null, createdAt: "2026-05-20T12:00:00.000Z" },
  { id: "key_sales", name: "Sales (send only)", prefix: "wsk_demo_3kP9", permissions: ["messages:send", "sessions:read"], sessionScope: "sales-team", lastUsedAt: "2026-06-01T08:15:00.000Z", expiresAt: null, createdAt: "2026-05-26T09:30:00.000Z" },
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

// ─── Inbox demo fixtures (fake numbers, recomputed fresh each request) ─────────

const mins = (n: number) => new Date(Date.now() - n * 60_000).toISOString();
const avatar = (seed: string) => `https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}`;
const contact = (id: string, phone: string, name: string, avatarUrl: string | null) =>
  ({ id, phone, name, savedName: null, whatsappName: name, avatarUrl });

function demoConversations() {
  return [
    { id: "conv-1", sessionId: "sales-team", status: "OPEN", lastMessageAt: mins(3), lastPreview: "Perfect, I just sent the brief 📎", unreadCount: 2, tags: ["lead", "website"], sessionDeletedAt: null, notes: "Interested in the Growth plan — follow up Friday.", contact: contact("ct-1", "923001234567", "Ayesha Khan", avatar("Ayesha")) },
    { id: "conv-2", sessionId: "support-bot", status: "OPEN", lastMessageAt: mins(64), lastPreview: "🗳️ Voted: Growth", unreadCount: 0, tags: ["support"], sessionDeletedAt: null, notes: null, contact: contact("ct-2", "14155550133", "Daniel Reyes", avatar("Daniel")) },
    { id: "conv-3", sessionId: "sales-team", status: "OPEN", lastMessageAt: mins(180), lastPreview: "📷 Photo", unreadCount: 1, tags: ["vip"], sessionDeletedAt: null, notes: null, contact: contact("ct-3", "923219876543", "Fatima Noor", null) },
    { id: "conv-4", sessionId: "support-bot", status: "OPEN", lastMessageAt: mins(330), lastPreview: "🎙️ Voice note", unreadCount: 0, tags: [], sessionDeletedAt: null, notes: null, contact: contact("ct-4", "447700900123", "Mark Chen", avatar("Mark")) },
    { id: "conv-5", sessionId: "sales-team", status: "RESOLVED", lastMessageAt: mins(1440), lastPreview: "Thank you so much! ⭐", unreadCount: 0, tags: ["vip", "lead"], sessionDeletedAt: null, notes: null, contact: contact("ct-5", "393331112233", "Sofia Rossi", avatar("Sofia")) },
  ];
}

function demoMessages(cid: string) {
  const mk = (i: number, o: Record<string, unknown>) => ({
    id: `${cid}-m${i}`, conversationId: cid, waMessageId: `wamid-${cid}-${i}`,
    direction: "INBOUND", type: "text", body: null, mediaUrl: null, payload: null,
    status: "DELIVERED", fromMe: false, waTimestamp: mins(60), createdAt: mins(60), ...o,
  });
  const out = (i: number, o: Record<string, unknown>) => mk(i, { direction: "OUTBOUND", fromMe: true, status: "READ", ...o });
  const map: Record<string, ReturnType<typeof mk>[]> = {
    "conv-1": [
      mk(1, { body: "Hi! Do you build WhatsApp automations?", waTimestamp: mins(20) }),
      out(2, { body: "Absolutely — what's your use case?", waTimestamp: mins(18) }),
      mk(3, { type: "image", mediaUrl: "https://picsum.photos/seed/wasphere-brief/420/280", body: "Here's our current flow", payload: { caption: "Here's our current flow" }, waTimestamp: mins(6) }),
      mk(4, { body: "Perfect, I just sent the brief 📎", waTimestamp: mins(3) }),
    ],
    "conv-2": [
      mk(1, { body: "Hey, my last invoice looks wrong.", waTimestamp: mins(190) }),
      out(2, { type: "document", body: "Invoice_2026_05.pdf", payload: { fileName: "Invoice_2026_05.pdf", mimetype: "application/pdf" }, waTimestamp: mins(175) }),
      out(3, { type: "poll", status: "DELIVERED", body: "Which plan works best for you?", payload: { name: "Which plan works best for you?", options: ["Starter", "Growth", "Scale"], selectableCount: 1 }, waTimestamp: mins(70) }),
      mk(4, { type: "poll_vote", body: "🗳️ Voted: Growth", payload: { pollName: "Which plan works best for you?", selectedOptions: ["Growth"] }, waTimestamp: mins(64) }),
    ],
    "conv-3": [
      mk(1, { type: "image", mediaUrl: "https://picsum.photos/seed/wasphere-product/420/300", body: "Is this still in stock?", payload: { caption: "Is this still in stock?" }, waTimestamp: mins(180) }),
    ],
    "conv-4": [
      mk(1, { body: "Can you give me a call?", waTimestamp: mins(335) }),
      mk(2, { type: "audio", payload: { seconds: 24, mimetype: "audio/ogg" }, waTimestamp: mins(330) }),
    ],
    "conv-5": [
      out(1, { body: "Your order #4821 has shipped 🚚", waTimestamp: mins(1500) }),
      mk(2, { body: "Thank you so much! ⭐", waTimestamp: mins(1440) }),
      mk(3, { type: "reaction", body: "❤️", waTimestamp: mins(1438) }),
    ],
  };
  // API returns newest-first; the UI reverses for display.
  return (map[cid] ?? []).slice().reverse();
}

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

  // Inbox
  if (/\/conversations$/.test(p)) {
    const qs = new URLSearchParams(path.split("?")[1] ?? "");
    const status = qs.get("status");
    const sessionId = qs.get("sessionId");
    const q = (qs.get("q") ?? "").toLowerCase();
    let items = demoConversations();
    if (status) items = items.filter((c) => c.status === status);
    if (sessionId) items = items.filter((c) => c.sessionId === sessionId);
    if (q) {
      const digits = q.replace(/[^0-9]/g, "");
      items = items.filter(
        (c) =>
          c.contact.name.toLowerCase().includes(q) ||
          (c.lastPreview ?? "").toLowerCase().includes(q) ||
          (digits && c.contact.phone.includes(digits)),
      );
    }
    return ok({ items, nextCursor: null });
  }
  if (/\/conversations\/[^/]+\/messages$/.test(p)) {
    const cid = p.split("/").slice(-2)[0];
    return ok({ items: demoMessages(cid), nextCursor: null });
  }
  if (/\/conversations\/[^/]+$/.test(p)) {
    const cid = p.split("/").pop();
    return ok(demoConversations().find((c) => c.id === cid) ?? demoConversations()[0]);
  }

  // Unknown GET — empty success so the UI renders without errors.
  return ok({});
}
