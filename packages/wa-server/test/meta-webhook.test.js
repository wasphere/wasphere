// Unit tests for MetaWebhookService — translates Meta webhooks into the same
// internal events the Baileys path fires. WebhookService + MetaCloudProvider are
// stubbed; no network, no WhatsApp behaviour mocked.
const { test } = require('node:test');
const assert = require('node:assert');
const crypto = require('crypto');
const { ForbiddenException } = require('@nestjs/common');
const { MetaWebhookService } = require('../dist/webhooks/meta-webhook.service');

function make({ creds, media = 'data:image/jpeg;base64,QUJD' } = {}) {
  const fired = [];
  const webhooks = { fire: async (event, sessionId, data) => { fired.push({ event, sessionId, data }); } };
  const meta = {
    getCredentials: () => creds,
    downloadMedia: async () => media,
  };
  return { svc: new MetaWebhookService(webhooks, meta), fired };
}

const isForbidden = (e) => e instanceof ForbiddenException;
const lastFire = (fired, event) => [...fired].reverse().find((f) => f.event === event);

test('verifyHandshake echoes challenge on matching token', () => {
  const { svc } = make({ creds: { verifyToken: 'VT' } });
  assert.equal(svc.verifyHandshake('s1', 'subscribe', 'VT', 'CHAL'), 'CHAL');
});

test('verifyHandshake rejects wrong token / mode / missing creds', () => {
  const { svc } = make({ creds: { verifyToken: 'VT' } });
  assert.throws(() => svc.verifyHandshake('s1', 'subscribe', 'WRONG', 'c'), isForbidden);
  assert.throws(() => svc.verifyHandshake('s1', 'unsubscribe', 'VT', 'c'), isForbidden);
  const bare = make({ creds: undefined });
  assert.throws(() => bare.svc.verifyHandshake('s1', 'subscribe', 'VT', 'c'), isForbidden);
});

test('signature: valid HMAC passes, invalid is rejected', async () => {
  const { svc, fired } = make({ creds: { appSecret: 'SEC' } });
  const body = { entry: [{ changes: [{ value: { messages: [{ from: '1555', id: 'wamid.1', type: 'text', text: { body: 'hi' } }] } }] }] };
  const raw = Buffer.from(JSON.stringify(body));
  const sig = 'sha256=' + crypto.createHmac('sha256', 'SEC').update(raw).digest('hex');
  await svc.ingest('s1', raw, sig, body);
  assert.equal(lastFire(fired, 'message.received').data.content.text, 'hi');

  await assert.rejects(() => svc.ingest('s1', raw, 'sha256=deadbeef', body), isForbidden);
  await assert.rejects(() => svc.ingest('s1', raw, undefined, body), isForbidden);
});

test('unverified mode: blocked in production, allowed in dev', async () => {
  const { svc, fired } = make({ creds: { /* no appSecret */ } });
  const body = { entry: [{ changes: [{ value: { messages: [{ from: '1555', id: 'm', type: 'text', text: { body: 'x' } }] } }] }] };
  const prev = process.env.NODE_ENV;
  try {
    process.env.NODE_ENV = 'production';
    await assert.rejects(() => svc.ingest('s1', Buffer.from('{}'), undefined, body), isForbidden);
    process.env.NODE_ENV = 'development';
    await svc.ingest('s1', Buffer.from('{}'), undefined, body);
    assert.ok(lastFire(fired, 'message.received'));
  } finally {
    process.env.NODE_ENV = prev;
  }
});

// All translation tests run with no appSecret in dev (unverified) for brevity.
async function ingestMsg(msg, contacts = []) {
  const { svc, fired } = make({ creds: {} });
  const prev = process.env.NODE_ENV;
  process.env.NODE_ENV = 'test';
  try {
    await svc.ingest('s1', Buffer.from('{}'), undefined, { entry: [{ changes: [{ value: { messages: [msg], contacts } }] }] });
  } finally {
    process.env.NODE_ENV = prev;
  }
  return lastFire(fired, 'message.received')?.data;
}

test('text → conversation with contact pushName', async () => {
  const d = await ingestMsg(
    { from: '15551234', id: 'wamid.T', timestamp: '1700000000', type: 'text', text: { body: 'hello' } },
    [{ wa_id: '15551234', profile: { name: 'Sam' } }],
  );
  assert.equal(d.type, 'conversation');
  assert.equal(d.content.text, 'hello');
  assert.equal(d.from, '15551234@s.whatsapp.net');
  assert.equal(d.senderJid, '15551234@s.whatsapp.net');
  assert.equal(d.isGroup, false);
  assert.equal(d.message.pushName, 'Sam');
  assert.equal(d.message.key.fromMe, false);
  assert.equal(d.timestamp, 1700000000);
});

test('image → imageMessage with downloaded dataUri + caption', async () => {
  const d = await ingestMsg({ from: '1555', id: 'i', type: 'image', image: { id: 'MID', caption: 'cap', mime_type: 'image/jpeg' } });
  assert.equal(d.type, 'imageMessage');
  assert.equal(d.content.caption, 'cap');
  assert.equal(d.content.mimetype, 'image/jpeg');
  assert.equal(d.content.dataUri, 'data:image/jpeg;base64,QUJD');
});

test('document → documentMessage carries filename; audio has no caption', async () => {
  const doc = await ingestMsg({ from: '1555', id: 'd', type: 'document', document: { id: 'M', filename: 'f.pdf', mime_type: 'application/pdf' } });
  assert.equal(doc.type, 'documentMessage');
  assert.equal(doc.content.fileName, 'f.pdf');
  const au = await ingestMsg({ from: '1555', id: 'a', type: 'audio', audio: { id: 'M', mime_type: 'audio/ogg' } });
  assert.equal(au.type, 'audioMessage');
  assert.equal('caption' in au.content, false);
});

test('reaction → reactionMessage with emoji + target', async () => {
  const d = await ingestMsg({ from: '1555', id: 'r', type: 'reaction', reaction: { message_id: 'wamid.X', emoji: '😀' } });
  assert.equal(d.type, 'reactionMessage');
  assert.equal(d.content.reaction, '😀');
  assert.equal(d.content.replyMessageId, 'wamid.X');
});

test('location + interactive reply map correctly', async () => {
  const loc = await ingestMsg({ from: '1555', id: 'l', type: 'location', location: { latitude: 1, longitude: 2, name: 'HQ' } });
  assert.equal(loc.type, 'locationMessage');
  assert.equal(loc.content.latitude, 1);
  const it = await ingestMsg({ from: '1555', id: 'b', type: 'interactive', interactive: { button_reply: { id: 'yes', title: 'Yes' } } });
  assert.equal(it.type, 'conversation'); // shown as the tapped selection
  assert.equal(it.content.text, 'Yes');
  assert.equal(it.content.selectionId, 'yes'); // stable id for automation
  assert.equal(it.content.interactiveKind, 'button_reply');
  // list reply carries its row id too
  const lst = await ingestMsg({ from: '1555', id: 'c', type: 'interactive', interactive: { list_reply: { id: 'plan_b', title: 'Plan B' } } });
  assert.equal(lst.content.selectionId, 'plan_b');
  assert.equal(lst.content.interactiveKind, 'list_reply');
});

test('message without from/id is skipped', async () => {
  const d = await ingestMsg({ id: 'no-from', type: 'text', text: { body: 'x' } });
  assert.equal(d, undefined);
});

test('statuses → messages.update with Baileys numeric codes', async () => {
  const { svc, fired } = make({ creds: {} });
  const prev = process.env.NODE_ENV; process.env.NODE_ENV = 'test';
  try {
    await svc.ingest('s1', Buffer.from('{}'), undefined, {
      entry: [{ changes: [{ value: { statuses: [
        { id: 'wamid.1', status: 'sent' }, { id: 'wamid.2', status: 'delivered' },
        { id: 'wamid.3', status: 'read' }, { id: 'wamid.4', status: 'failed' },
      ] } }] }],
    });
  } finally { process.env.NODE_ENV = prev; }
  const upd = lastFire(fired, 'messages.update').data;
  assert.deepEqual(upd, [
    { messageId: 'wamid.1', status: 2 },
    { messageId: 'wamid.2', status: 3 },
    { messageId: 'wamid.3', status: 4 },
  ]); // 'failed' dropped (Inbox has no FAILED mapping)
});
