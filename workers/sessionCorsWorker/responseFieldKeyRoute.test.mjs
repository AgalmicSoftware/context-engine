import test from 'node:test';
import assert from 'node:assert/strict';
import { storageRoute } from './storageRouteExecution.js';
import { dispatchAuthenticatedSecretPathRoute } from './authenticatedSecretPathRouteDispatch.js';
import { resolveResponseFieldPolicy } from '../../shared/encryption/responseFieldPolicy.mjs';

const owner = `0x${'11'.repeat(20)}`;
const admin = `0x${'22'.repeat(20)}`;
const member = `0x${'33'.repeat(20)}`;
const stranger = `0x${'44'.repeat(20)}`;
const context = `0x${'aa'.repeat(32)}`;
const key = Buffer.alloc(32, 19).toString('base64url');
const configFor = (isPrivate = false) => ({
  sessionId: `0x${'55'.repeat(16)}`, adminAddress: admin,
  roles: { member: [owner, member] },
  sessionModeProfile: { authority: { mode: 'worker_canonical' }, storage: { backend: 'cloudflare' }, encryption: { mode: 'worker_envelope' } },
  storageProfile: { backend: 'cloudflare', payloadAccessControl: {
    gate: 'none', encryption: 'worker_envelope',
    ...(isPrivate ? { accessConditions: { version: 1, match: 'all', conditions: [{ kind: 'worker_role', role: 'member' }] } } : {}),
  } },
  responseFieldEncryption: { version: 1 },
});
const fixture = (isPrivate = false) => {
  const config = configFor(isPrivate);
  const audits = [];
  const env = { CE_STORAGE_ENVELOPE_KEK: 'nonsecret-test-key-material', CE_STORAGE_AUDIT_KV: { put: async (...args) => audits.push(args) } };
  const call = (action, body, principal = owner, overrides = {}) => storageRoute({
    path: `/storage/response-field-key/${action}`, method: 'POST',
    request: new Request(`https://worker.example/storage/response-field-key/${action}`, { method: 'POST', body: JSON.stringify(body) }),
    env, config, slug: 'example', uploaderAddress: principal, authScopes: { storage: true },
    deps: { json: (body, status, headers) => new Response(JSON.stringify(body), { status, headers }) },
    ...overrides,
  });
  const wrap = async (audience = 'self_admin') => {
    const response = await call('wrap', { key, audience, context });
    assert.equal(response.status, 200, await response.clone().text());
    return (await response.json()).recipient;
  };
  return { config, env, audits, call, wrap };
};

test('advertises only supported audiences and hides locks for disabled sessions', () => {
  const config = configFor();
  assert.equal(resolveResponseFieldPolicy(config).admin, true);
  assert.equal(resolveResponseFieldPolicy(config).session, false);
  assert.equal(resolveResponseFieldPolicy(configFor(true)).session, true);
  delete config.responseFieldEncryption;
  assert.equal(resolveResponseFieldPolicy(config).admin, false);
  config.sessionModeProfile.encryption.mode = 'none';
  assert.equal(resolveResponseFieldPolicy(config).enabled, false);
  config.sessionModeProfile.encryption.mode = 'lit';
  assert.equal(resolveResponseFieldPolicy(config).self, true);
  assert.equal(resolveResponseFieldPolicy(config).admin, false);
});

test('Me + admin keys are released only to owner/admin, with audit and no-store', async () => {
  const f = fixture();
  const recipient = await f.wrap();
  assert.equal(JSON.stringify(recipient).includes(key), false);
  for (const principal of [owner, admin]) {
    const response = await f.call('unwrap', { recipient, context }, principal);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'private, no-store');
    assert.equal((await response.json()).key, key);
  }
  assert.equal(f.audits.length, 2);
  assert.equal((await f.call('unwrap', { recipient, context }, stranger)).status, 403);
  assert.equal((await f.call('unwrap', { recipient, context }, '')).status, 401);
  assert.equal((await f.call('unwrap', { recipient, context }, owner, { authScopes: {} })).status, 401);
  assert.equal(f.audits.length, 2);
  // Admin rights are evaluated afresh rather than encoded as an irrevocable grant.
  f.config.adminAddress = stranger;
  assert.equal((await f.call('unwrap', { recipient, context }, admin)).status, 403);
});

test('Only me never has a Worker key-release route; public sessions reject Session members', async () => {
  const f = fixture();
  for (const audience of ['self', 'none', 'gate', 'bogus']) {
    assert.equal((await f.call('wrap', { key, audience, context })).status, 400);
  }
  assert.equal((await f.call('wrap', { key, audience: 'session', context })).status, 403);
});

test('Session members requires current membership; admins have no implicit membership bypass', async () => {
  const f = fixture(true);
  const recipient = await f.wrap('session');
  for (const principal of [owner, member]) {
    const response = await f.call('unwrap', { recipient, context }, principal);
    assert.equal(response.status, 200);
    assert.equal((await response.json()).key, key);
  }
  for (const principal of [admin, stranger]) {
    assert.equal((await f.call('unwrap', { recipient, context }, principal)).status, 403);
    assert.equal((await f.call('wrap', { key, context, audience: 'session' }, principal)).status, 403);
  }
  f.config.roles.member = [owner];
  assert.equal((await f.call('unwrap', { recipient, context }, member)).status, 403);
  delete f.config.storageProfile.payloadAccessControl.accessConditions;
  assert.equal((await f.call('unwrap', { recipient, context }, owner)).status, 403);
});

test('a gate which resolves to public access never releases a Session members key', async () => {
  const f = fixture();
  f.config.storageProfile.payloadAccessControl.gate = 'sbt_gate';
  f.config.__registry = { gatesByResource: { questionResponses: { sbtAddresses: [], chainId: 11155420, mode: 0 } } };
  const response = await f.call('wrap', { key, audience: 'session', context });
  assert.equal(response.status, 403);
});

test('wrapped keys bind owner, audience, context and session against tampering', async () => {
  const f = fixture(true);
  const recipient = await f.wrap();
  for (const patch of [
    { owner: stranger }, { audience: 'session' }, { context: `0x${'bb'.repeat(32)}` },
    { sessionSlug: 'other' }, { sessionId: `0x${'66'.repeat(16)}` },
  ]) {
    const forged = { ...recipient, policy: { ...recipient.policy, ...patch } };
    const response = await f.call('unwrap', { recipient: forged, context: forged.policy.context }, patch.owner || owner);
    assert.notEqual(response.status, 200);
    assert.equal((await response.text()).includes(key), false);
  }
  assert.equal(f.audits.length, 0);
});

test('disabled encryption blocks new wraps without orphaning existing author/admin fields', async () => {
  const f = fixture();
  const recipient = await f.wrap();
  f.config.sessionModeProfile.encryption.mode = 'none';
  f.config.storageProfile.payloadAccessControl.encryption = 'none';
  assert.equal((await f.call('wrap', { key, audience: 'self_admin', context })).status, 403);
  const response = await f.call('unwrap', { recipient, context }, admin);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).key, key);
});

test('missing KEK/audit store and malformed requests fail closed', async () => {
  const f = fixture();
  const recipient = await f.wrap();
  f.env.CE_STORAGE_AUDIT_KV.put = async () => { throw new Error('audit unavailable'); };
  assert.equal((await f.call('unwrap', { recipient, context })).status, 503);
  delete f.env.CE_STORAGE_ENVELOPE_KEK;
  assert.equal((await f.call('wrap', { key, audience: 'self_admin', context })).status, 503);
  assert.equal((await f.call('wrap', null)).status, 400);
  assert.equal((await f.call('wrap', { key: 'a'.repeat(9000) })).status, 413);
});

test('both key routes pass through authenticated storage preflight before dispatch', async () => {
  for (const action of ['wrap', 'unwrap']) {
    let called = false;
    const result = await dispatchAuthenticatedSecretPathRoute({
      path: `/storage/response-field-key/${action}`, method: 'POST', scopes: { storage: true },
      deps: {
        evaluateAuthenticatedRoutePreflight: async ({ route, scope }) => {
          assert.equal(route, 'storage'); assert.equal(scope, 'storage');
          return { ok: false, response: { status: 403 } };
        },
        storageRoute: async () => { called = true; },
      },
    });
    assert.equal(result.response.status, 403);
    assert.equal(called, false);
  }
});

test('optional field encryption leaves public storage unchanged and enforces owner/admin access', async () => {
  const f = fixture();
  f.config.sessionModeProfile.encryption.mode = 'none';
  f.config.storageProfile.payloadAccessControl.encryption = 'none';
  f.config.responseFieldEncryption = { mode: 'optional', version: 1 };
  const policy = resolveResponseFieldPolicy(f.config);
  assert.equal(policy.self, true);
  assert.equal(policy.admin, true);
  assert.equal(policy.session, false);
  const recipient = await f.wrap();
  assert.equal((await f.call('unwrap', { recipient, context }, admin)).status, 200);
  assert.equal((await f.call('unwrap', { recipient, context }, stranger)).status, 403);
  assert.equal((await f.call('wrap', { key, audience: 'session', context })).status, 403);
  assert.equal(f.config.storageProfile.payloadAccessControl.encryption, 'none');
  f.config.responseFieldEncryption.version = 0;
  assert.equal(resolveResponseFieldPolicy(f.config).admin, false);
  delete f.config.responseFieldEncryption;
  assert.equal(resolveResponseFieldPolicy(f.config).enabled, false);
});
