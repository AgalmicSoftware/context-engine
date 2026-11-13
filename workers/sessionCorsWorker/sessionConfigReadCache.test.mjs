import assert from 'node:assert/strict';
import test from 'node:test';

import { Wallet } from 'ethers';
import { SESSION_CONFIG_CACHE_MS } from './sessionConfigAuthority.js';
import {
  SESSION_ID, SLUG, createSessionEnv, fetchWorker, login, makeRequest, signedAdminRequest, uploadJson,
} from './sessionWorkerRuntimeFixture.mjs';

// Ordinary requests may reuse a session's config for up to a second. Each
// Worker instance keeps its own copy, so a second binding object over the same
// session objects stands in for another instance.
const setup = (t) => {
  let now = Date.now();
  t.mock.method(Date, 'now', () => now);
  let configReads = 0;
  let failNext = false;
  const created = createSessionEnv({ onCoordinatorFetch: (request) => {
    if (new URL(request.url).pathname !== '/session-config/current') return;
    configReads += 1;
    if (failNext) { failNext = false; throw new Error('synthetic coordinator outage'); }
  } });
  const binding = created.env.CE_SESSION_COORDINATOR;
  const other = { ...created.env, CE_SESSION_COORDINATOR: { idFromName: binding.idFromName, get: (id) => binding.get(id) } };
  return {
    ...created,
    other,
    reads: () => configReads,
    failNextRead: () => { failNext = true; },
    advance: (ms) => { now += ms; },
    publicList: (env) => fetchWorker(makeRequest('/storage/list?resource=questions&limit=10'), env).then((r) => r.status),
    memberList: (env, token) => fetchWorker(makeRequest('/storage/list?resource=questions&limit=10', { token }), env).then((r) => r.status),
    // A valid full config, as the admin page sends it, with the given changes.
    setConfig: (changes) => signedAdminRequest({ env: created.env, wallet: created.admin, action: 'set-config', body: { config: {
      ...created.config,
      sessionModeProfile: { ...created.config.sessionModeProfile, preset: 'custom', export: { scope: 'all_session' },
        results: { ...created.config.sessionModeProfile.results,
          exposure: { aggregateResultsEnabled: true, anonymizedGroupsEnabled: false, minGroupSize: 2 } } },
      ...changes,
    } } }),
  };
};

test('a config read is reused for at most a second from when it finished, and a failed read is never kept', async (t) => {
  const s = setup(t);
  assert.equal(await s.publicList(s.env), 200);
  const first = s.reads();
  s.advance(SESSION_CONFIG_CACHE_MS - 400);
  assert.equal(await s.publicList(s.env), 200);
  assert.equal(s.reads(), first, 'a read within the second reuses the copy');
  // That reuse did not extend the copy's life.
  s.advance(401);
  assert.equal(await s.publicList(s.env), 200);
  assert.equal(s.reads(), first + 1);

  s.advance(SESSION_CONFIG_CACHE_MS + 1);
  s.failNextRead();
  assert.equal(await s.publicList(s.env), 503);
  assert.equal(await s.publicList(s.env), 200);
  assert.equal(s.reads(), first + 3, 'the failed read was not kept');
});

test('a sign-out everywhere reaches the instance that made it at once and every other instance within a second', async (t) => {
  const s = setup(t);
  const token = await login({ env: s.env, wallet: Wallet.createRandom() });
  assert.equal(await s.memberList(s.env, token), 200);
  assert.equal(await s.memberList(s.other, token), 200);

  // A config change bumps the sign-in epoch, signing everyone out.
  const changed = await s.setConfig({ sessionName: 'Renamed session' });
  assert.equal(changed.status, 200, JSON.stringify(changed.body));
  assert.equal(await s.memberList(s.env, token), 401, 'the changing instance drops its copy');
  s.advance(SESSION_CONFIG_CACHE_MS + 1);
  assert.equal(await s.memberList(s.other, token), 401, 'other instances follow within the second');
});

test('an admin never acts on a cached config', async (t) => {
  const s = setup(t);
  const participant = await login({ env: s.env, wallet: Wallet.createRandom() });
  const oldAdmin = await login({ env: s.other, wallet: s.admin });
  assert.equal(await s.memberList(s.other, participant), 200);

  // The admin hands over; the other instance still holds the old config.
  const successor = Wallet.createRandom();
  const handover = await s.setConfig({ adminAddress: successor.address });
  assert.equal(handover.status, 200, JSON.stringify(handover.body));
  const question = { id: 'q-late', type: 'binary', prompt: 'Late statement', sessionId: SESSION_ID, sessionSlug: SLUG };
  const upload = await uploadJson({ env: s.other, token: oldAdmin, resource: 'questions', data: question });
  assert.equal(upload.status, 401, JSON.stringify(upload.body));
  const action = await signedAdminRequest({ env: s.other, wallet: s.admin, action: 'storage/set-hidden', body: { resource: 'questions', id: 'q-late', hidden: true } });
  assert.notEqual(action.status, 200, JSON.stringify(action.body));
});

test('a session made private stops signed-out reads within a second', async (t) => {
  const s = setup(t);
  assert.equal(await s.publicList(s.env), 200);
  assert.equal(await s.publicList(s.other), 200);

  // Only the admin may read stored payloads now.
  const gated = { gate: 'role_gate', encryption: 'none', accessConditions: { match: 'all', conditions: [
    { kind: 'worker_role', role: 'admin' },
  ] } };
  const changed = await s.setConfig({
    storageProfile: { ...s.config.storageProfile, payloadAccessControl: gated },
    sessionModeProfile: { ...s.config.sessionModeProfile, preset: 'custom', export: { scope: 'all_session' },
      storage: { backend: 'cloudflare', payloadAccessControl: gated },
      results: { ...s.config.sessionModeProfile.results, visibility: 'session_member_full',
        exposure: { aggregateResultsEnabled: true, anonymizedGroupsEnabled: false, minGroupSize: 2 } } },
  });
  assert.equal(changed.status, 200, JSON.stringify(changed.body));
  assert.notEqual(await s.publicList(s.env), 200, 'the changing instance drops its copy');
  s.advance(SESSION_CONFIG_CACHE_MS + 1);
  assert.notEqual(await s.publicList(s.other), 200, 'other instances follow within the second');
});
