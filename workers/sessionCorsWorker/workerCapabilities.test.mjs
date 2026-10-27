import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorkerRuntime } from './worker.js';

const request = (query = '') => new Request(`https://worker.example/capabilities${query}`);
const envFor = (body, status = 200) => ({
  CE_BUNDLE_SHA256: 'synthetic-bundle',
  CE_STORAGE_INDEX_KV: { get() {}, put() {} },
  CE_STORAGE_ENVELOPE_KEK: 'synthetic-kek',
  TOKEN_HMAC_SECRET: 'synthetic-token',
  CE_SESSION_COORDINATOR: {
    idFromName: (name) => name,
    get: () => ({ fetch: async () => Response.json(body, { status }) }),
  },
});
const fetchCapabilities = (env, query = '') => createWorkerRuntime(env).fetch(request(query), env);

test('capabilities is public even without config authority and advertises sorted code features', async () => {
  const response = await fetchCapabilities({});
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Cache-Control'), 'public, max-age=30');
  const body = await response.json();
  assert.equal(body.type, 'ce_worker_capabilities');
  assert.equal(body.version, 1);
  assert.equal(body.apiVersion, 1);
  assert.equal(body.bundle, null);
  assert.deepEqual(body.features, [...body.features].sort());
  for (const feature of ['upload_authority_stamps', 'response_upload_receipts',
    'envelope_export_identity_v1', 'worker_groups', 'results_analysis_retry_v1']) {
    assert.ok(body.features.includes(feature));
  }
  assert.equal(body.session, undefined);
});

test('capabilities reports readiness without exposing config, addresses, counts or secrets', async () => {
  const env = envFor({ ok: true, revision: 9, config: { admin: 'private-address', secret: 'private-value' } });
  const response = await fetchCapabilities(env, '?slug=sample');
  const body = await response.json();
  assert.equal(body.bundle, 'synthetic-bundle');
  assert.deepEqual(body.session, { readiness: {
    coordinator: 'ok', configAuthority: 'ok', storage: 'ok', kek: 'ok', tokenHmac: 'ok',
  }, unavailable: [] });
  assert.doesNotMatch(JSON.stringify(body), /private-|synthetic-kek|synthetic-token|revision|admin"/);
});

test('readiness distinguishes missing, seeding, migration and unreachable authority', async () => {
  for (const [env, coordinator, configAuthority] of [
    [{}, 'missing', 'unavailable'],
    [envFor({ ok: true, revision: 0, config: null }), 'ok', 'seeding'],
    [envFor({ reason: 'session_config_migration_required' }, 503), 'ok', 'migration_required'],
    [envFor({ error: 'private diagnostic' }, 503), 'unavailable', 'unavailable'],
  ]) {
    const body = await (await fetchCapabilities(env, '?slug=sample')).json();
    assert.equal(body.session.readiness.coordinator, coordinator);
    assert.equal(body.session.readiness.configAuthority, configAuthority);
    assert.deepEqual(body.session.unavailable.map((item) => item.operation),
      ['submit', 'publish_question', 'admin_correction', 'backup']);
    assert.doesNotMatch(JSON.stringify(body), /private diagnostic/);
  }
});

test('missing KEK blocks envelope writes but leaves plaintext submissions available', async () => {
  for (const encryption of ['none', 'worker_envelope']) {
    const env = envFor({ ok: true, revision: 1, config: { storageProfile: { payloadAccessControl: { encryption } } } });
    delete env.CE_STORAGE_ENVELOPE_KEK;
    const body = await (await fetchCapabilities(env, '?slug=sample')).json();
    assert.equal(body.session.readiness.kek, 'missing');
    assert.equal(body.session.unavailable.some((item) => item.operation === 'submit'), encryption === 'worker_envelope');
  }
});

test('capabilities rejects malformed slugs without calling the coordinator', async () => {
  const env = envFor({});
  env.CE_SESSION_COORDINATOR.get = () => { throw new Error('must not call'); };
  assert.equal((await fetchCapabilities(env, '?slug=bad/slug')).status, 400);
});


test('key export is advertised only for the deployment’s single configured session', async () => {
  for (const [configuredSlug, requestedSlug, enabled] of [
    [undefined, 'sample', false], ['', 'sample', false], ['another-session', 'sample', false],
    ['sample', 'sample', true], [' Sample ', 'sample', true], ['debate', 'rxc', true],
    ['general', 'general', false], [' General ', 'general', false], ['', 'general', false],
  ]) {
    const env = { ...envFor({ ok: true, revision: 1, config: {} }), DEFAULT_SESSION_SLUG: configuredSlug };
    const body = await (await fetchCapabilities(env, `?slug=${requestedSlug}`)).json();
    assert.equal(body.features.includes('recovery_key_export'), enabled);
    assert.equal((await (await fetchCapabilities(env)).json()).features.includes('recovery_key_export'), false);
  }
});

test('agent capabilities bind readiness to fresh resources and current canonical identity/revision', async () => {
  const config = { sessionId: '0x11111111111111111111111111111111', sessionModeProfile: { surfaces: { agentHttp: true } },
    agentHttp: { invites: [{ tokenHash: 'fixture-private-verifier' }] } };
  const env = envFor({ ok: true, revision: 3, config });
  env.GROUP_KV = { get() {}, put() {}, delete() {}, list() {} };
  env.AGENT_MANAGED_ROOT_SECRET = 'fixture-private-root';
  const response = await fetchCapabilities(env, '?slug=sample');
  const first = await response.json(); assert.equal(first.agentHttp.ready, true); assert.equal(first.agentSessionWrapped.origin, 'https://worker.example');
  assert.ok(first.features.includes('agent_http_v1')); assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.ok(!JSON.stringify(first).includes('fixture-private'));
  env.CE_SESSION_COORDINATOR.get = () => ({ fetch: async () => Response.json({ ok: true, revision: 4, config }) });
  const next = await (await fetchCapabilities(env, '?slug=sample')).json(); assert.notEqual(first.agentSessionWrapped.revision, next.agentSessionWrapped.revision);
  delete env.AGENT_MANAGED_ROOT_SECRET;
  const missing = await (await fetchCapabilities(env, '?slug=sample')).json(); assert.equal(missing.agentHttp.ready, false);
  config.sessionModeProfile.surfaces.agentHttp = false;
  const disabled = await (await fetchCapabilities(env, '?slug=sample')).json(); assert.equal(disabled.agentHttp.enabled, false); assert.equal(disabled.agentSessionWrapped.enabled, false);
});
