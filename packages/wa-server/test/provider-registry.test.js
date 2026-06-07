// Unit tests for ProviderRegistry.withFailover (design §11). Pure logic — stub
// providers + adapter, no network.
const { test } = require('node:test');
const assert = require('node:assert');
const { ProviderRegistry } = require('../dist/whatsapp/providers/provider-registry');
const { CapabilityError } = require('../dist/whatsapp/providers/capability-error');

function makeReg({ provider = 'baileys', fallbackProvider, metaEnabled = true } = {}) {
  const baileys = { id: 'baileys' };
  const cfg = { provider, fallbackProvider };
  // A Meta session lives in the Meta provider (meta.has === true), not the adapter.
  const meta = { id: 'meta', has: () => provider === 'meta', getSessionInfo: () => ({ config: cfg }) };
  const adapter = { getSessionInfo: () => ({ config: cfg }) };
  if (metaEnabled) process.env.META_PROVIDER_ENABLED = 'true';
  else delete process.env.META_PROVIDER_ENABLED;
  return { reg: new ProviderRegistry(baileys, meta, adapter), baileys, meta };
}
const ok = { messageId: 'wamid.1', status: 'sent' };
const reset = () => { delete process.env.META_PROVIDER_ENABLED; };

test('primary success → via=primary, fallback never called', async () => {
  const { reg, baileys } = makeReg({ fallbackProvider: 'meta' });
  const calls = [];
  const r = await reg.withFailover('s', (p) => { calls.push(p.id); return Promise.resolve(ok); });
  assert.deepEqual(calls, ['baileys']);
  assert.equal(r.via, 'primary');
  assert.equal(r.messageId, 'wamid.1');
  reset();
});

test('retryable failure + fallback configured → retries on fallback, via=fallback', async () => {
  const { reg, baileys } = makeReg({ provider: 'baileys', fallbackProvider: 'meta' });
  const calls = [];
  const r = await reg.withFailover('s', (p) => {
    calls.push(p.id);
    if (p === baileys) throw new Error('socket timeout / disconnected');
    return Promise.resolve(ok);
  });
  assert.deepEqual(calls, ['baileys', 'meta']);
  assert.equal(r.via, 'fallback');
  reset();
});

test('non-retryable (CapabilityError) → rethrows, no fallback attempt', async () => {
  const { reg } = makeReg({ fallbackProvider: 'meta' });
  const calls = [];
  await assert.rejects(
    () => reg.withFailover('s', (p) => { calls.push(p.id); throw new CapabilityError('polls', 'baileys'); }),
    (e) => e instanceof CapabilityError,
  );
  assert.deepEqual(calls, ['baileys']); // fallback not tried
  reset();
});

test('4xx client error → not retried', async () => {
  const { reg } = makeReg({ fallbackProvider: 'meta' });
  const calls = [];
  await assert.rejects(
    () => reg.withFailover('s', (p) => { calls.push(p.id); throw new Error('HTTP 400 bad request'); }),
    /400/,
  );
  assert.deepEqual(calls, ['baileys']);
  reset();
});

test('no fallback configured → retryable failure just rethrows', async () => {
  const { reg } = makeReg({ fallbackProvider: undefined });
  await assert.rejects(
    () => reg.withFailover('s', () => { throw new Error('network timeout'); }),
    /timeout/,
  );
  reset();
});

test('flag off → fallback inactive even if configured', async () => {
  const { reg } = makeReg({ fallbackProvider: 'meta', metaEnabled: false });
  const calls = [];
  await assert.rejects(
    () => reg.withFailover('s', (p) => { calls.push(p.id); throw new Error('5xx unavailable'); }),
    /unavailable/,
  );
  assert.deepEqual(calls, ['baileys']); // no fallback when flag off
  reset();
});

test('meta session (meta.has) routes to meta provider — regression for 404 on send', async () => {
  const { reg, meta } = makeReg({ provider: 'meta' });
  assert.equal(reg.for('s'), meta);
  const calls = [];
  const r = await reg.withFailover('s', (p) => { calls.push(p.id); return Promise.resolve(ok); });
  assert.deepEqual(calls, ['meta']); // not baileys → no "not found or not connected"
  assert.equal(r.via, 'primary');
  reset();
});

test('fallbackFor / get helpers', () => {
  const { reg, meta, baileys } = makeReg({ fallbackProvider: 'meta' });
  assert.equal(reg.get('meta'), meta);
  assert.equal(reg.get('baileys'), baileys);
  assert.equal(reg.fallbackFor('s'), meta);
  reset();
});
