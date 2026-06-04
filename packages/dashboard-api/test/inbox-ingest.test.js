// Integration tests for the Inbox ingestion pipeline.
//
// Per the project testing rule these run against a REAL PostgreSQL (the Docker
// container) — no mocks. They exercise the COMPILED services from dist/ (the
// same code that runs in production) by feeding realistic wa-server webhook
// payloads and asserting the resulting database state.
//
// Setup (once): create + migrate the test DB
//   docker exec wasphere-postgres createdb -U wasphere wasphere_test
//   DATABASE_URL=postgresql://wasphere:wasphere_dev@localhost:5432/wasphere_test \
//     npx prisma migrate deploy
// Run:  pnpm build && node --test --test-concurrency=1 test/

process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ||
  'postgresql://wasphere:wasphere_dev@localhost:5432/wasphere_test';

const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

const { PrismaService } = require('../dist/prisma/prisma.service');
const { InboxEventsService } = require('../dist/inbox/inbox-events.service');
const { InboxIngestService } = require('../dist/inbox/inbox-ingest.service');

const prisma = new PrismaService();
const ingest = new InboxIngestService(prisma, new InboxEventsService());

let wsId;

// Directly await the private handler (the public `ingest()` is fire-and-forget).
const handle = (dto) => ingest.handle(wsId, dto);

const received = (data) => ({
  event: 'message.received',
  sessionId: data.sessionId || 's1',
  timestamp: '2026-01-01T00:00:00Z',
  data: { type: 'conversation', timestamp: 1700000000, ...data },
});

const textMsg = (id, jid, sessionId = 's1') =>
  received({
    sessionId,
    messageId: id,
    from: jid,
    content: { text: 'hello' },
    message: { key: { remoteJid: jid, id }, pushName: 'Tester' },
  });

before(async () => {
  await prisma.$connect();
  await prisma.message.deleteMany({});
  await prisma.conversation.deleteMany({});
  await prisma.contact.deleteMany({});
  await prisma.workspace.deleteMany({});
  await prisma.user.deleteMany({});
  const user = await prisma.user.create({ data: { email: 'inbox-test@example.com', passwordHash: 'x' } });
  const ws = await prisma.workspace.create({ data: { name: 'Test WS', ownerId: user.id } });
  wsId = ws.id;
});

beforeEach(async () => {
  await prisma.message.deleteMany({});
  await prisma.conversation.deleteMany({});
  await prisma.contact.deleteMany({});
});

after(async () => {
  await prisma.$disconnect();
});

test('resolves a @lid chat to the real phone number via senderPn', async () => {
  await handle(
    received({
      messageId: 'lid1',
      from: '163299052261557@lid',
      senderJid: '923327685715@s.whatsapp.net',
      senderPn: '923327685715@s.whatsapp.net',
      avatarUrl: 'https://pps.whatsapp.net/a.jpg',
      content: { text: 'hi' },
      message: { key: { remoteJid: '163299052261557@lid', id: 'lid1' }, pushName: 'Waseer' },
    }),
  );
  const c = await prisma.contact.findFirst({ where: { workspaceId: wsId } });
  assert.equal(c.jid, '923327685715@s.whatsapp.net');
  assert.equal(c.phone, '923327685715');
  assert.equal(c.whatsappName, 'Waseer');
  assert.equal(c.avatarUrl, 'https://pps.whatsapp.net/a.jpg');
});

test('skips groups, newsletters, status and broadcast (1:1 only)', async () => {
  for (const jid of ['123@g.us', '456@newsletter', 'status@broadcast', '789@broadcast']) {
    await handle(textMsg('x-' + jid, jid));
  }
  assert.equal(await prisma.contact.count({ where: { workspaceId: wsId } }), 0);
  assert.equal(await prisma.message.count({ where: { workspaceId: wsId } }), 0);
});

test('is idempotent on (workspace, waMessageId)', async () => {
  const dto = textMsg('dup1', '923000000001@s.whatsapp.net');
  await handle(dto);
  await handle(dto);
  assert.equal(await prisma.message.count({ where: { workspaceId: wsId } }), 1);
});

test('upgrades an undecryptable placeholder when the decoded content arrives', async () => {
  const jid = '923000000002@s.whatsapp.net';
  // 1) arrives undecryptable (no content / unknown type) -> stored as "unknown"
  await handle(
    received({ messageId: 'u1', from: jid, type: undefined, content: {}, message: { key: { remoteJid: jid, id: 'u1' } } }),
  );
  let m = await prisma.message.findFirst({ where: { workspaceId: wsId, waMessageId: 'u1' } });
  assert.equal(m.type, 'unknown');
  // 2) same id arrives decoded (poll vote) -> upgraded in place, not duplicated
  await handle(
    received({ messageId: 'u1', from: jid, type: 'poll_vote', content: { text: '🗳️ Voted: A' }, message: { key: { remoteJid: jid, id: 'u1' } } }),
  );
  m = await prisma.message.findFirst({ where: { workspaceId: wsId, waMessageId: 'u1' } });
  assert.equal(m.type, 'poll_vote');
  assert.equal(m.body, '🗳️ Voted: A');
  assert.equal(await prisma.message.count({ where: { workspaceId: wsId } }), 1);
});

test('stores downloaded media in mediaUrl, not in the JSON payload', async () => {
  const jid = '923000000003@s.whatsapp.net';
  await handle(
    received({
      messageId: 'img1',
      from: jid,
      type: 'imageMessage',
      content: { caption: 'pic', dataUri: 'data:image/jpeg;base64,QUJD' },
      message: { key: { remoteJid: jid, id: 'img1' } },
    }),
  );
  const m = await prisma.message.findFirst({ where: { workspaceId: wsId, waMessageId: 'img1' } });
  assert.equal(m.type, 'image');
  assert.equal(m.mediaUrl, 'data:image/jpeg;base64,QUJD');
  assert.equal(m.payload?.dataUri, undefined); // base64 kept out of payload
});

test('increments unread on each inbound message', async () => {
  const jid = '923000000004@s.whatsapp.net';
  for (let i = 0; i < 3; i++) await handle(textMsg('unr' + i, jid));
  const c = await prisma.conversation.findFirst({ where: { workspaceId: wsId, contact: { phone: '923000000004' } } });
  assert.equal(c.unreadCount, 3);
});

test('archives conversations on session logout and restores them on reconnect', async () => {
  const jid = '923000000005@s.whatsapp.net';
  await handle(textMsg('arch1', jid, 'archsess'));
  // logout -> archived
  await handle({ event: 'session.logged_out', sessionId: 'archsess', timestamp: 't', data: {} });
  let c = await prisma.conversation.findFirst({ where: { workspaceId: wsId, sessionId: 'archsess' } });
  assert.notEqual(c.sessionDeletedAt, null);
  // reconnect -> restored
  await handle({ event: 'session.connected', sessionId: 'archsess', timestamp: 't', data: {} });
  c = await prisma.conversation.findFirst({ where: { workspaceId: wsId, sessionId: 'archsess' } });
  assert.equal(c.sessionDeletedAt, null);
});

test('a new inbound message also clears a stale archive flag', async () => {
  const jid = '923000000006@s.whatsapp.net';
  await handle(textMsg('rev1', jid, 'revsess'));
  await handle({ event: 'session.logged_out', sessionId: 'revsess', timestamp: 't', data: {} });
  await handle(textMsg('rev2', jid, 'revsess'));
  const c = await prisma.conversation.findFirst({ where: { workspaceId: wsId, sessionId: 'revsess' } });
  assert.equal(c.sessionDeletedAt, null);
});
