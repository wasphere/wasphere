// Integration tests for InboxService reads/writes against a REAL PostgreSQL.
// The WorkspacesService dependency is only used by sendReply (not covered here),
// so a bare stub is injected. Run: pnpm build && node --test test/inbox-service.test.js

process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ||
  'postgresql://wasphere:wasphere_dev@localhost:5432/wasphere_test';

const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

const { PrismaService } = require('../dist/prisma/prisma.service');
const { InboxEventsService } = require('../dist/inbox/inbox-events.service');
const { InboxService } = require('../dist/inbox/inbox.service');

const prisma = new PrismaService();
const svc = new InboxService(prisma, /* workspaces stub */ {}, new InboxEventsService());

let wsId;
let userId;

async function seedContact(name, phone) {
  const contact = await prisma.contact.create({
    data: { workspaceId: wsId, jid: `${phone}@s.whatsapp.net`, phone, whatsappName: name },
  });
  return prisma.conversation.create({
    data: { workspaceId: wsId, contactId: contact.id, sessionId: 's1', lastPreview: `hi from ${name}` },
  });
}

before(async () => {
  await prisma.$connect();
  await prisma.message.deleteMany({});
  await prisma.conversation.deleteMany({});
  await prisma.contact.deleteMany({});
  await prisma.workspaceMember.deleteMany({});
  await prisma.workspace.deleteMany({});
  await prisma.user.deleteMany({ where: { email: 'svc-test@example.com' } });
  const user = await prisma.user.create({ data: { email: 'svc-test@example.com', passwordHash: 'x' } });
  userId = user.id;
  const ws = await prisma.workspace.create({ data: { name: 'Svc WS', ownerId: user.id } });
  wsId = ws.id;
  await prisma.workspaceMember.create({ data: { workspaceId: wsId, userId, role: 'OWNER' } });
});

beforeEach(async () => {
  await prisma.message.deleteMany({});
  await prisma.conversation.deleteMany({});
  await prisma.contact.deleteMany({});
});

after(async () => {
  await prisma.$disconnect();
});

test('rejects a non-member', async () => {
  await assert.rejects(() => svc.listConversations('00000000-0000-0000-0000-000000000000', wsId, {}));
});

test('search matches by name but a non-matching term returns nothing (regression)', async () => {
  await seedContact('Alice', '923010000001');
  await seedContact('Bob', '923020000002');

  const byName = await svc.listConversations(userId, wsId, { q: 'alice' });
  assert.equal(byName.items.length, 1);
  assert.equal(byName.items[0].contact.name, 'Alice');

  // The bug: a non-numeric, non-matching term built `phone contains ""` and
  // matched EVERY row. It must now match nothing.
  const noMatch = await svc.listConversations(userId, wsId, { q: 'zzz' });
  assert.equal(noMatch.items.length, 0);

  const byPhone = await svc.listConversations(userId, wsId, { q: '923020' });
  assert.equal(byPhone.items.length, 1);
  assert.equal(byPhone.items[0].contact.name, 'Bob');
});

test('markRead clears the unread counter', async () => {
  const contact = await prisma.contact.create({
    data: { workspaceId: wsId, jid: '923030000003@s.whatsapp.net', phone: '923030000003', whatsappName: 'Carol' },
  });
  const convo = await prisma.conversation.create({
    data: { workspaceId: wsId, contactId: contact.id, sessionId: 's1', unreadCount: 5 },
  });
  await svc.markRead(userId, wsId, convo.id);
  const after = await prisma.conversation.findUnique({ where: { id: convo.id } });
  assert.equal(after.unreadCount, 0);
});

test('patchConversation updates status, tags and notes', async () => {
  const convo = await seedContact('Dave', '923040000004');
  await svc.patchConversation(userId, wsId, convo.id, { status: 'RESOLVED', tags: ['vip', 'lead'], notes: 'paid customer' });
  const view = await svc.getConversation(userId, wsId, convo.id);
  assert.equal(view.status, 'RESOLVED');
  assert.deepEqual(view.tags, ['vip', 'lead']);
  assert.equal(view.notes, 'paid customer');
});

test('status filter returns only matching conversations', async () => {
  const a = await seedContact('Open1', '923050000005');
  await seedContact('Open2', '923060000006');
  await svc.patchConversation(userId, wsId, a.id, { status: 'RESOLVED' });

  const open = await svc.listConversations(userId, wsId, { status: 'OPEN' });
  assert.equal(open.items.length, 1);
  const resolved = await svc.listConversations(userId, wsId, { status: 'RESOLVED' });
  assert.equal(resolved.items.length, 1);
  assert.equal(resolved.items[0].contact.name, 'Open1');
});
