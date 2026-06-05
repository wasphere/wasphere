// Unit tests for MetaCloudProvider — the Graph HTTP boundary is mocked (global
// fetch is stubbed). This tests OUR request mapping + error translation, not
// WhatsApp behaviour, so it complies with the no-mock-WhatsApp testing rule.
const { test } = require('node:test');
const assert = require('node:assert');

const { MetaCloudProvider } = require('../dist/whatsapp/providers/meta-cloud.provider');
const { MetaApiError } = require('../dist/whatsapp/providers/meta-api-error');
const { CapabilityError } = require('../dist/whatsapp/providers/capability-error');
const { META_CAPABILITIES } = require('../dist/whatsapp/providers/capabilities');

const CREDS = { kind: 'meta', phoneNumberId: '100', accessToken: 'TOK', wabaId: 'W', verifyToken: 'V' };
const okGet = { verified_name: 'My Biz', display_phone_number: '+1 555-0100' };
const okSend = { messages: [{ id: 'wamid.ABC' }] };

function res(ok, status, json) {
  return { ok, status, json: async () => json };
}

// Install a fetch stub that records calls and answers GET (validate) vs POST (send).
function stubFetch({ sendResponse = res(true, 200, okSend), getResponse = res(true, 200, okGet) } = {}) {
  const calls = [];
  const orig = globalThis.fetch;
  globalThis.fetch = async (url, opts = {}) => {
    const method = (opts.method || 'GET').toUpperCase();
    calls.push({ url, method, body: opts.body ? JSON.parse(opts.body) : undefined, headers: opts.headers });
    return method === 'POST' ? sendResponse : getResponse;
  };
  return { calls, restore: () => { globalThis.fetch = orig; } };
}

async function withProvider(fn, opts) {
  const s = stubFetch(opts);
  const p = new MetaCloudProvider();
  try {
    await p.init('s1', CREDS);
    return await fn(p, s);
  } finally {
    s.restore();
  }
}

const lastPost = (s) => [...s.calls].reverse().find((c) => c.method === 'POST');

test('init validates creds via GET and reports connected', async () => {
  const s = stubFetch();
  const p = new MetaCloudProvider();
  try {
    const info = await p.init('s1', CREDS);
    assert.equal(info.status, 'connected');
    assert.equal(info.name, 'My Biz');
    assert.equal(info.config.provider, 'meta');
    assert.equal(p.status('s1'), 'connected');
    const get = s.calls[0];
    assert.equal(get.method, 'GET');
    assert.match(get.url, /\/v22\.0\/100\?fields=verified_name/);
    assert.equal(get.headers.Authorization, 'Bearer TOK');
  } finally {
    s.restore();
  }
});

test('init with bad creds reports failed (not thrown)', async () => {
  const s = stubFetch({ getResponse: res(false, 401, { error: { code: 190, message: 'bad token' } }) });
  const p = new MetaCloudProvider();
  try {
    const info = await p.init('s1', CREDS);
    assert.equal(info.status, 'failed');
    assert.equal(p.status('s1'), 'failed');
  } finally {
    s.restore();
  }
});

test('sendText maps to a text message body', async () => {
  await withProvider(async (p, s) => {
    const r = await p.sendText('s1', '15550100@s.whatsapp.net', 'hi there');
    assert.equal(r.messageId, 'wamid.ABC');
    assert.equal(r.status, 'sent');
    const b = lastPost(s).body;
    assert.equal(b.messaging_product, 'whatsapp');
    assert.equal(b.type, 'text');
    assert.equal(b.to, '15550100'); // jid suffix stripped
    assert.deepEqual(b.text, { body: 'hi there' });
    assert.match(lastPost(s).url, /\/v22\.0\/100\/messages$/);
  });
});

test('sendMedia image uses link mode with caption', async () => {
  await withProvider(async (p, s) => {
    await p.sendMedia('s1', '15550100', { kind: 'image', url: 'https://x/y.jpg', caption: 'cap' });
    const b = lastPost(s).body;
    assert.equal(b.type, 'image');
    assert.deepEqual(b.image, { link: 'https://x/y.jpg', caption: 'cap' });
  });
});

test('sendMedia document carries filename; audio drops caption', async () => {
  await withProvider(async (p, s) => {
    await p.sendMedia('s1', '15550100', { kind: 'document', url: 'https://x/f.pdf', fileName: 'f.pdf', caption: 'c' });
    assert.deepEqual(lastPost(s).body.document, { link: 'https://x/f.pdf', caption: 'c', filename: 'f.pdf' });
    await p.sendMedia('s1', '15550100', { kind: 'audio', url: 'https://x/a.ogg', caption: 'ignored' });
    assert.deepEqual(lastPost(s).body.audio, { link: 'https://x/a.ogg' }); // no caption on audio
  });
});

test('sendMedia rejects data: URIs (link mode only in v1.2)', async () => {
  await withProvider(async (p) => {
    await assert.rejects(
      () => p.sendMedia('s1', '15550100', { kind: 'image', url: 'data:image/png;base64,AAAA' }),
      (e) => e instanceof MetaApiError && e.code === 'UNSUPPORTED_MEDIA_SOURCE',
    );
  });
});

test('sendReaction maps message_id + emoji', async () => {
  await withProvider(async (p, s) => {
    await p.sendReaction('s1', '15550100', 'wamid.X', '😀', true);
    assert.deepEqual(lastPost(s).body.reaction, { message_id: 'wamid.X', emoji: '😀' });
  });
});

test('sendInteractive buttons → interactive button payload (max 3)', async () => {
  await withProvider(async (p, s) => {
    await p.sendInteractive('s1', '15550100', {
      kind: 'buttons', text: 'Pick', footer: 'ft',
      buttons: [{ id: 'a', text: 'A' }, { id: 'b', text: 'B' }, { id: 'c', text: 'C' }, { id: 'd', text: 'D' }],
    });
    const it = lastPost(s).body.interactive;
    assert.equal(it.type, 'button');
    assert.deepEqual(it.body, { text: 'Pick' });
    assert.deepEqual(it.footer, { text: 'ft' });
    assert.equal(it.action.buttons.length, 3);
    assert.deepEqual(it.action.buttons[0], { type: 'reply', reply: { id: 'a', title: 'A' } });
  });
});

test('sendInteractive list → interactive list payload', async () => {
  await withProvider(async (p, s) => {
    await p.sendInteractive('s1', '15550100', {
      kind: 'list', title: 'Menu', text: 'choose', buttonText: 'Open',
      sections: [{ title: 'S1', rows: [{ id: 'r1', title: 'Row 1', description: 'd' }] }],
    });
    const it = lastPost(s).body.interactive;
    assert.equal(it.type, 'list');
    assert.deepEqual(it.header, { type: 'text', text: 'Menu' });
    assert.equal(it.action.button, 'Open');
    assert.equal(it.action.sections[0].rows[0].id, 'r1');
  });
});

test('sendTemplate maps name + language', async () => {
  await withProvider(async (p, s) => {
    await p.sendTemplate('s1', '15550100', { name: 'order_confirm', languageCode: 'en_US' });
    const t = lastPost(s).body.template;
    assert.equal(lastPost(s).body.type, 'template');
    assert.equal(t.name, 'order_confirm');
    assert.deepEqual(t.language, { code: 'en_US' });
  });
});

test('sendLocation + sendContact map correctly', async () => {
  await withProvider(async (p, s) => {
    await p.sendLocation('s1', '15550100', { latitude: 1.5, longitude: 2.5, name: 'HQ' });
    assert.deepEqual(lastPost(s).body.location, { latitude: 1.5, longitude: 2.5, name: 'HQ' });
    await p.sendContact('s1', '15550100', { displayName: 'Sam', phoneNumber: '15551234' });
    assert.equal(lastPost(s).body.contacts[0].name.formatted_name, 'Sam');
    assert.equal(lastPost(s).body.contacts[0].phones[0].phone, '15551234');
  });
});

test('markRead posts status:read per message id', async () => {
  await withProvider(async (p, s) => {
    await p.markRead('s1', '15550100', ['m1', 'm2']);
    const posts = s.calls.filter((c) => c.method === 'POST');
    assert.equal(posts.length, 2);
    assert.deepEqual(posts[0].body, { messaging_product: 'whatsapp', status: 'read', message_id: 'm1' });
  });
});

test('24h-window error → OUTSIDE_24H_WINDOW', async () => {
  await withProvider(async (p) => {
    await assert.rejects(
      () => p.sendText('s1', '15550100', 'late'),
      (e) => e instanceof MetaApiError && e.code === 'OUTSIDE_24H_WINDOW',
    );
  }, { sendResponse: res(false, 400, { error: { code: 131047, message: 're-engagement' } }) });
});

test('auth error → META_AUTH_FAILED', async () => {
  await withProvider(async (p) => {
    await assert.rejects(
      () => p.sendText('s1', '15550100', 'x'),
      (e) => e instanceof MetaApiError && e.code === 'META_AUTH_FAILED',
    );
  }, { sendResponse: res(false, 401, { error: { code: 190, message: 'expired' } }) });
});

test('sendPoll is a capability error (Meta has no polls)', async () => {
  await withProvider(async (p) => {
    await assert.rejects(() => p.sendPoll(), (e) => e instanceof CapabilityError && e.capability === 'polls');
  });
});

test('send before init throws (not initialised)', async () => {
  const p = new MetaCloudProvider();
  await assert.rejects(
    () => p.sendText('nope', '15550100', 'x'),
    (e) => e instanceof MetaApiError && /not initialised/.test(e.message),
  );
});

test('capabilities reflect Meta limits', () => {
  const p = new MetaCloudProvider();
  assert.equal(p.id, 'meta');
  assert.equal(p.capabilities, META_CAPABILITIES);
  assert.equal(p.capabilities.templates, true);
  assert.equal(p.capabilities.polls, false);
  assert.equal(p.capabilities.freeformAlways, false);
});
