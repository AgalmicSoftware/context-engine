import test from 'node:test';
import assert from 'node:assert/strict';
import { SessionWriteCoordinator, coordinateResponseUploadReceipt } from './sessionWriteCoordinator.js';
import { readSessionDiagnosticsAuthority, readUploadReceiptDiagnostics } from './sessionDiagnostics.js';
import { dispatchAdminResultsAnalysisStatusRequest } from './adminResultsAnalysisDispatch.js';
import { resolveTopLevelRouteSelection } from './topLevelRouteSelection.js';
import { sha256Hex } from '../shared/deployHelperCore.mjs';

const ADMIN = `0x${'1'.repeat(40)}`;
const PARTICIPANT = `0x${'2'.repeat(40)}`;
const SESSION_ID = `0x${'a'.repeat(32)}`;
const DAY = 24 * 60 * 60 * 1000;
const ref = { backend: 'cloudflare', resource: 'responses', id: 'AQIDBAUGBwgJCgsMDQ4PEBESExQVFhcYGRobHB0eHyA' };
const json = (body, status = 200, headers = {}) => new Response(JSON.stringify(body), { status, headers });

const fixture = async () => {
  let now = 10_000;
  let failProjection = false;
  const instances = new Map();
  const kv = new Map();
  const config = { slug: 'fixture', adminAddress: ADMIN, sessionId: SESSION_ID,
    sessionModeProfile: {
      profileVersion: 1, preset: 'custom', authority: { mode: 'worker_canonical' }, evm: { registryChainId: null },
      storage: { backend: 'cloudflare', payloadAccessControl: { gate: 'none', encryption: 'none' } },
      identity: { default: 'passkey', enabled: ['passkey'] }, authorization: { mechanisms: ['worker_roles'] },
      encryption: { mode: 'none' }, surfaces: { web: true, telegram: false, miniApp: false, agentHttp: false, mcp: false, ceCc: false },
      results: { visibility: 'public_full_if_storage_public', exposure: { aggregateResultsEnabled: true, anonymizedGroupsEnabled: false, minGroupSize: 2 } },
      export: { scope: 'all_session' },
    },
    storageProfile: {
      type: 'session_storage_profile', version: 'session-storage-profile-v1', backend: 'cloudflare', sessionOwned: true,
      resources: { docsContext: 'active', questions: 'active', surveys: 'active', responses: 'active' },
      payloadAccessControl: { gate: 'none', encryption: 'none', mode: 'public_read', enforcement: 'session_worker_public_read', litRequired: false },
    } };
  const env = { TOKEN_HMAC_SECRET: 'synthetic-diagnostics-hmac',
    GROUP_KV: { get: async key => kv.get(key) ?? null, put: async (key, value) => kv.set(key, value) },
  };
  const get = (name) => {
    if (!instances.has(name)) {
      const store = new Map();
      let alarm = null;
      let tail = Promise.resolve();
      const access = (values) => ({
        get: async key => structuredClone(values.get(key)),
        put: async (key, value) => values.set(key, structuredClone(value)),
        delete: async key => values.delete(key),
        list: async ({ prefix = '', startAfter = '', limit = Infinity } = {}) => new Map([...values]
          .filter(([key]) => key.startsWith(prefix) && key > startAfter)
          .sort(([a], [b]) => a < b ? -1 : 1).slice(0, limit)),
      });
      const storage = { ...access(store), getAlarm: async () => alarm, setAlarm: async at => { alarm = at; },
        transaction: (run) => {
          const result = tail.then(async () => {
            const staged = structuredClone(store);
            const value = await run(access(staged));
            store.clear();
            for (const [key, entry] of staged) store.set(key, entry);
            return value;
          });
          tail = result.catch(() => {});
          return result;
        },
      };
      const coordinator = new SessionWriteCoordinator({ storage }, env, {
        now: () => now,
        putSessionConfig: async (_env, slug, value) => {
          if (failProjection) throw new Error('Synthetic KV outage');
          kv.set(`session:${slug}:config`, JSON.stringify(value));
        },
      });
      instances.set(name, { store, coordinator, fetch: (input, init) => coordinator.fetch(input instanceof Request ? input : new Request(input, init)) });
    }
    return instances.get(name);
  };
  env.CE_SESSION_COORDINATOR = { idFromName: name => name, get };
  const named = async identity => get(await sha256Hex(identity));
  const authority = await named('session-config:fixture');
  authority.store.set('session-config-authority', { schemaVersion: 1, slug: 'fixture', revision: 1, config, projectionPending: false });
  const receipt = (responder, requestId, operation = 'reserve', extra = {}) => coordinateResponseUploadReceipt({
    env, slug: 'fixture', responder, operation, payload: { requestId, payloadDigest: 'a'.repeat(64), ...extra },
  });
  const status = (payload = { sub: ADMIN, sessionId: SESSION_ID, authzEpoch: 0 }, cursor = '', authenticated = true) => dispatchAdminResultsAnalysisStatusRequest({
    request: new Request(`https://worker.example/admin/diagnostics?sessionSlug=fixture${cursor ? `&cursor=${cursor}` : ''}`),
    env, slug: '', baseHeaders: new Headers(), diagnostics: true,
    deps: { json, toStr: String, now: () => now,
      requireAuth: async ({ request }) => authenticated
        ? { ok: true, slug: request.headers.get('x-session-slug'), payload }
        : { ok: false, response: json({ error: 'Sign in required.' }, 401) },
      readCurrentSessionConfig: async () => { throw new Error('Diagnostics must not repair before reading.'); },
      getCorsContext: async () => ({ ok: true, headers: new Headers({ 'Access-Control-Allow-Origin': 'https://admin.example', Vary: 'Origin' }) }),
      validateAdmin: async ({ address, config: current }) => address === current.adminAddress,
    },
  });
  return { env, authority, instances, named, receipt, status, get now() { return now; },
    advance: ms => { now += ms; }, failProjection: value => { failProjection = value; } };
};

test('diagnostics count all receipt stores, ignore expired leases, and contain no participant or payload data', async () => {
  const f = await fixture();
  const first = await f.receipt(PARTICIPANT, 'pending-one');
  assert.equal(first.kind, 'execute');
  f.advance(5_000);
  const second = await f.receipt(ADMIN, 'stored-two');
  await f.receipt(ADMIN, 'stored-two', 'settle', { attemptId: second.attemptId, storageRef: ref });
  f.advance(2_000);
  await f.receipt(ADMIN, 'pending-three');
  const response = await f.status();
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Cache-Control'), 'private, no-store');
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), 'https://admin.example');
  assert.equal(response.headers.get('Vary'), 'Origin');
  const raw = await response.text();
  const body = JSON.parse(raw);
  assert.deepEqual(body.uploadReceipts, { pendingLeases: 2, oldestPendingAgeMs: 7_000, settledCount: 1, cursor: null, complete: true });
  for (const sensitive of [ADMIN, PARTICIPANT, 'pending-one', ref.id, 'synthetic-diagnostics-hmac', 'payloadDigest', 'config"']) assert.equal(raw.includes(sensitive), false, sensitive);
  f.advance(120_000);
  assert.deepEqual((await (await f.status()).json()).uploadReceipts, { pendingLeases: 0, oldestPendingAgeMs: null, settledCount: 1, cursor: null, complete: true });
  f.advance(7 * DAY);
  assert.equal((await (await f.status()).json()).uploadReceipts.settledCount, 0);
});

test('receipt aggregation pages at 25 stores, isolates sessions, and bounds index cleanup', async () => {
  const f = await fixture();
  for (let n = 1; n <= 27; n += 1) await f.receipt(`0x${n.toString(16).padStart(40, '0')}`, `request-${n}`);
  const first = await readUploadReceiptDiagnostics({ env: f.env, slug: 'fixture' });
  assert.equal(first.pendingLeases, 25);
  assert.equal(first.complete, false);
  const last = await readUploadReceiptDiagnostics({ env: f.env, slug: 'fixture', cursor: first.cursor });
  assert.equal(last.pendingLeases, 2);
  assert.equal(last.complete, true);
  assert.equal((await readUploadReceiptDiagnostics({ env: f.env, slug: 'elsewhere' })).pendingLeases, 0);
  await assert.rejects(readUploadReceiptDiagnostics({ env: f.env, slug: 'fixture', cursor: '../bad' }), { status: 400 });
  const index = await f.named('upload-receipt-index:fixture');
  for (let n = 100; n < 205; n += 1) index.store.set(`upload-receipt-store-v1:${n.toString(16).padStart(64, '0')}`, { expiresAtMs: f.now });
  f.advance(9 * DAY);
  await index.coordinator.alarm();
  assert.equal([...index.store.keys()].filter(key => key.startsWith('upload-receipt-store-v1:')).length, 32);
  await index.coordinator.alarm();
  assert.equal(index.store.size, 0);
});

test('receipt totals include every storage page up to the retained per-participant cap', async () => {
  const f = await fixture();
  await f.receipt(PARTICIPANT, 'pending');
  const owner = await f.named(`upload-receipts:fixture:${PARTICIPANT}`);
  for (let n = 0; n < 2000; n += 1) owner.store.set(`upload-receipt-v1:${n.toString(16).padStart(64, '0')}`, { state: 'settled', settledAt: f.now });
  const counts = await readUploadReceiptDiagnostics({ env: f.env, slug: 'fixture' });
  assert.equal(counts.settledCount, 2000);
  assert.equal(counts.pendingLeases, 1);
});

test('receipt store registration renews while active and an index failure admits no hidden receipt', async () => {
  const f = await fixture();
  await f.receipt(PARTICIPANT, 'one');
  const index = await f.named('upload-receipt-index:fixture');
  const expiry = [...index.store.values()].find(value => value.expiresAtMs)?.expiresAtMs;
  f.advance(DAY);
  await f.receipt(PARTICIPANT, 'two');
  assert.equal([...index.store.values()].find(value => value.expiresAtMs)?.expiresAtMs, expiry + DAY);
  f.advance(DAY);
  index.fetch = async () => { throw new Error('Synthetic index outage'); };
  assert.equal((await f.receipt(PARTICIPANT, 'three')).status, 503);
  const owner = await f.named(`upload-receipts:fixture:${PARTICIPANT}`);
  assert.equal([...owner.store.values()].filter(value => value?.state === 'pending').length, 1);
});

test('diagnostics expose a failed config projection and its start time without repairing it', async () => {
  const f = await fixture();
  f.failProjection(true);
  const response = await f.authority.coordinator.executeSessionConfigMutation({ slug: 'fixture',
    expectedAuthority: { actor: ADMIN, revision: 1, authzEpoch: 0 },
    mutation: { kind: 'set-limits', incomingLimits: { perIpPerHour: 8 } },
  });
  assert.equal(response.status, 503, await response.text());
  f.advance(50_000);
  assert.deepEqual((await (await f.status()).json()).configProjection, { pending: true, sinceMs: 10_000 });
  f.failProjection(false);
  await f.authority.coordinator.repairPendingSessionConfigProjection();
  assert.deepEqual((await (await f.status()).json()).configProjection, { pending: false, sinceMs: null });
});

test('a receipt store renewed concurrently with expiry remains indexed', async () => {
  const f = await fixture();
  await f.receipt(PARTICIPANT, 'old');
  const index = await f.named('upload-receipt-index:fixture');
  f.advance(9 * DAY);
  await Promise.all([index.coordinator.alarm(), f.receipt(PARTICIPANT, 'new')]);
  const counts = await readUploadReceiptDiagnostics({ env: f.env, slug: 'fixture' });
  assert.equal(counts.pendingLeases, 1);
  assert.equal(counts.complete, true);
});

test('automatic success survives a later manual run, and diagnostics retain the exhausted retry number', async () => {
  const f = await fixture();
  const coordinator = f.authority.coordinator;
  const succeed = async (trigger, id) => {
    const reservation = { trigger, requestId: id, reservationKey: id, sourceSignature: id, viewSignature: id };
    const attempt = await coordinator.reserveResultsAnalysis(reservation);
    assert.equal(attempt.kind, 'execute');
    const result = await coordinator.finalizeResultsAnalysis({ ...reservation, attemptId: attempt.attemptId, success: true, receipt: { ok: true, draft: { draftId: id } } });
    assert.equal(result.ok, true);
  };
  await succeed('automatic', 'auto-success');
  f.advance(1000);
  await succeed('manual', 'manual-success');
  coordinator.runResultsAnalysisAutoJob = async () => ({ ok: false, status: 503, error: 'Synthetic provider outage' });
  await coordinator.enqueueResultsAnalysisAutoJob({ slug: 'fixture', requestId: 'auto-failure', committedResponses: [] });
  for (const [index, delay] of [60_000, 300_000, 1_800_000].entries()) {
    await coordinator.runQueuedResultsAnalysisAutoJob();
    const snapshot = await readSessionDiagnosticsAuthority({ env: f.env, slug: 'fixture' });
    assert.equal(snapshot.analysis.lastSuccessAtMs, 10_000);
    assert.equal(snapshot.analysis.retryAttempt, index + 1);
    assert.equal(snapshot.analysis.nextAttemptAtMs, f.now + delay);
    f.advance(delay);
  }
  await coordinator.runQueuedResultsAnalysisAutoJob();
  assert.deepEqual((await (await f.status()).json()).analysis, { lastSuccessAtMs: 10_000, retryAttempt: 3, nextAttemptAtMs: null, retriesExhausted: true });
});

test('diagnostics use the same current admin, token identity, and authorization epoch checks as analysis status', async () => {
  const f = await fixture();
  const token = { sub: ADMIN, sessionId: SESSION_ID, authzEpoch: 0 };
  assert.equal((await f.status(token, '', false)).status, 401);
  assert.equal((await f.status({ ...token, sub: PARTICIPANT })).status, 403);
  assert.equal((await f.status({ ...token, sessionId: `0x${'b'.repeat(32)}` })).status, 401);
  assert.equal((await f.status({ ...token, authzEpoch: 1 })).status, 401);
  const authority = f.authority.store.get('session-config-authority');
  authority.config.adminAddress = PARTICIPANT;
  authority.projectionPending = true;
  assert.equal((await f.status(token)).status, 403, 'A removed admin cannot use stale projected config');
  assert.equal((await f.status({ ...token, sub: PARTICIPANT })).status, 200);
  assert.deepEqual(resolveTopLevelRouteSelection({ path: '/admin/diagnostics', method: 'GET', request: new Request('https://worker.example/admin/diagnostics'), deps: { toStr: String } }), { kind: 'admin-session-diagnostics' });
});
