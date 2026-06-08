// Pure-logic tests for the workspace capability resolver (no DB).
// Exercises the COMPILED module from dist/ — the same code the guards use.

const { test } = require('node:test');
const assert = require('node:assert/strict');

const {
  resolveCapabilities,
  hasCapability,
  sanitizeGrants,
  CAPABILITIES,
  DEFAULT_MEMBER_CAPABILITIES,
  GRANTABLE_CAPABILITIES,
} = require('../dist/lib/capabilities');

test('owner and admin get every capability', () => {
  for (const role of ['OWNER', 'ADMIN']) {
    const caps = resolveCapabilities(role, []);
    assert.deepEqual([...caps].sort(), [...CAPABILITIES].sort());
    assert.equal(hasCapability(role, [], 'api_keys'), true);
    assert.equal(hasCapability(role, [], 'settings'), true);
  }
});

test('member defaults to inbox + contacts only', () => {
  const caps = resolveCapabilities('MEMBER', []);
  assert.deepEqual([...caps].sort(), [...DEFAULT_MEMBER_CAPABILITIES].sort());
  assert.equal(hasCapability('MEMBER', [], 'inbox'), true);
  assert.equal(hasCapability('MEMBER', [], 'webhooks'), false);
  assert.equal(hasCapability('MEMBER', [], 'api_keys'), false);
});

test('granted capabilities extend a member', () => {
  assert.equal(hasCapability('MEMBER', ['webhooks'], 'webhooks'), true);
  assert.equal(hasCapability('MEMBER', ['webhooks'], 'api_keys'), false);
  const caps = resolveCapabilities('MEMBER', ['webhooks', 'settings']);
  assert.ok(caps.includes('inbox'));
  assert.ok(caps.includes('webhooks'));
  assert.ok(caps.includes('settings'));
});

test('sanitizeGrants drops invalid and non-grantable values', () => {
  // inbox/contacts are defaults, not grantable; junk is dropped.
  assert.deepEqual(sanitizeGrants(['webhooks', 'inbox', 'nonsense', 42, 'api_keys']).sort(), ['api_keys', 'webhooks']);
  assert.deepEqual(sanitizeGrants(null), []);
  assert.deepEqual(sanitizeGrants('webhooks'), []);
});

test('members can never escalate to team management via grants', () => {
  // 'team' is not a capability at all, and not grantable.
  assert.ok(!CAPABILITIES.includes('team'));
  assert.ok(!GRANTABLE_CAPABILITIES.includes('team'));
  assert.equal(hasCapability('MEMBER', ['team', 'owner', '*'], 'settings'), false);
});
