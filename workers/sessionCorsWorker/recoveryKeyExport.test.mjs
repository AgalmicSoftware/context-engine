import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { installSessionCoordinatorBinding, createSignedSiweBody, makeJsonRequest } from '../../tests/helpers/sessionCorsWorkerTestUtils.mjs';
import { createWorkerRuntime } from './worker.js';
import { callSessionConfigCoordinator } from './sessionConfigAuthority.js';
import { recoveryKeyFingerprint } from '../shared/recoveryKey.mjs';

const { ethers } = createRequire(new URL('../../package.json', import.meta.url))('ethers');
const admin = new ethers.Wallet(`0x${'4'.repeat(64)}`);
const stranger = new ethers.Wallet(`0x${'5'.repeat(64)}`);
const slug = 'recovery-fixture';
const action = 'export-recovery-key';
const origin = 'https://app.example';
const kv = () => { const values = new Map(); return { values,
  get: async (key) => values.get(key) ?? null,
  put: async (key, value) => { values.set(key, value); },
  delete: async (key) => values.delete(key),
}; };
const fixture = () => {
  const group = kv();
  group.values.set(`session:${slug}:config`, JSON.stringify({ slug, sessionId: `0x${'1'.repeat(32)}`,
    adminAddress: admin.address, chainId: 11155420, allowOrigins: [origin] }));
  return installSessionCoordinatorBinding({ GROUP_KV: group, CE_STORAGE_ENVELOPE_KEK: 'a'.repeat(64),
    DEFAULT_SESSION_SLUG: slug, TOKEN_HMAC_SECRET: 'synthetic-token-secret', CE_STORAGE_AUDIT_KV: kv() });
};

test('recovery key export requires admin signature and explicit signed confirmation, limits and audits exports', async (t) => {
  let clock = Date.now();
  t.mock.method(Date, 'now', () => clock);
  const env = fixture();
  const worker = createWorkerRuntime(env, { now: () => clock });
  const request = async (wallet = admin, extra = { confirm: action }) => {
    clock += 61_000;
    const body = await createSignedSiweBody({ worker, env, wallet, sessionSlug: slug, adminAction: action,
      adminOrigin: origin, audience: origin, body: { slug, ...extra } });
    return worker.fetch(makeJsonRequest(`/admin/${action}`, body, { headers: { Origin: origin } }), env);
  };
  assert.notEqual((await worker.fetch(makeJsonRequest(`/admin/${action}`, { slug, confirm: action }), env)).status, 200);
  assert.equal((await request(stranger)).status, 403);
  assert.equal((await request(admin, {})).status, 400);
  assert.equal(env.CE_STORAGE_AUDIT_KV.values.size, 0);
  for (let i = 0; i < 3; i++) {
    const response = await request();
    assert.equal(response.status, 200, await response.clone().text());
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
    assert.equal(response.headers.get('Access-Control-Allow-Origin'), origin);
    assert.equal(response.headers.get('Vary'), 'Origin');
    assert.deepEqual(await response.json(), { ok: true, recoveryKey: env.CE_STORAGE_ENVELOPE_KEK,
      fingerprint: await recoveryKeyFingerprint(env.CE_STORAGE_ENVELOPE_KEK) });
  }
  const limited = await request();
  assert.equal(limited.status, 429);
  assert.equal((await limited.json()).reason, 'recovery_key_export_limit');
  assert.equal(env.CE_STORAGE_AUDIT_KV.values.size, 3);
  const audits = [...env.CE_STORAGE_AUDIT_KV.values.values()].map(JSON.parse);
  assert.ok(audits.every((row) => row.adminAddress.toLowerCase() === admin.address.toLowerCase() && row.timestamp && row.action === action));
  assert.doesNotMatch(JSON.stringify(audits), new RegExp(env.CE_STORAGE_ENVELOPE_KEK));
  clock += 24 * 60 * 60_000;
  assert.equal((await request()).status, 200);
});

test('concurrent exports share a durable per-session limit and fail closed without the key or audit storage', async () => {
  const env = fixture();
  const current = await callSessionConfigCoordinator({ env, slug, path: 'current' });
  const args = { env, slug, path: 'recovery-key/export', confirm: action,
    expectedAuthority: { actor: admin.address, revision: current.body.revision, authzEpoch: 0 } };
  const responses = await Promise.all(Array.from({ length: 5 }, () => callSessionConfigCoordinator(args)));
  assert.deepEqual(responses.map((r) => r.status).sort(), [200, 200, 200, 429, 429]);
  const fresh = fixture();
  delete fresh.CE_STORAGE_ENVELOPE_KEK;
  assert.equal((await callSessionConfigCoordinator({ ...args, env: fresh })).status, 503);
  const broken = fixture();
  broken.CE_STORAGE_AUDIT_KV.put = async () => { throw new Error('offline'); };
  const failed = await callSessionConfigCoordinator({ ...args, env: broken });
  assert.equal(failed.status, 503);
  assert.equal(failed.body.recoveryKey, undefined);
});


test('backup export success and failure keep the signed request CORS headers', async (t) => {
  let clock = Date.now();
  t.mock.method(Date, 'now', () => clock);
  const env = fixture();
  env.CE_STORAGE_INDEX_KV = { ...kv(), list: async () => ({ keys: [], list_complete: true }) };
  env.GROUP_KV.list = async () => ({ keys: [], list_complete: true });
  const worker = createWorkerRuntime(env, { now: () => clock });
  for (const cursor of ['', 'invalid']) {
    clock += 61_000;
    const body = await createSignedSiweBody({ worker, env, wallet: admin, sessionSlug: slug,
      adminAction: 'export-session-backup', adminOrigin: origin, audience: origin, body: { slug, cursor } });
    const response = await worker.fetch(makeJsonRequest('/admin/export-session-backup', body, { headers: { Origin: origin } }), env);
    assert.equal(response.status, cursor ? 403 : 200, await response.clone().text());
    assert.equal(response.headers.get('Access-Control-Allow-Origin'), origin);
    assert.equal(response.headers.get('Vary'), 'Origin');
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
  }
});


for (const configuredSlug of [undefined, '', 'another-session']) {
  test(`key export refuses deployment-scoped keys without spending an allowance (${configuredSlug})`, async () => {
    const env = fixture();
    env.DEFAULT_SESSION_SLUG = configuredSlug;
    const current = await callSessionConfigCoordinator({ env, slug, path: 'current' });
    const args = { env, slug, path: 'recovery-key/export', confirm: action,
      expectedAuthority: { actor: admin.address, revision: current.body.revision, authzEpoch: 0 } };
    const denied = await callSessionConfigCoordinator(args);
    assert.equal(denied.status, 403);
    assert.equal(denied.body.reason, 'recovery_key_deployment_scoped');
    assert.equal(env.CE_STORAGE_AUDIT_KV.values.size, 0);
    env.DEFAULT_SESSION_SLUG = slug;
    for (let i = 0; i < 3; i++) assert.equal((await callSessionConfigCoordinator(args)).status, 200);
  });
}


test('hex recovery key fingerprints are independent of letter case', async () => {
  assert.equal(await recoveryKeyFingerprint('AB'.repeat(32)), await recoveryKeyFingerprint('ab'.repeat(32)));
  assert.notEqual(await recoveryKeyFingerprint('Case-sensitive passphrase'), await recoveryKeyFingerprint('case-sensitive passphrase'));
});
