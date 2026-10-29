import { isWorkerGroupMember, executeCoordinatedWorkerGroupMutation } from './workerGroups.js';
import { dispatchAdminRequest } from './adminRequestDispatch.js';
import { executeCoordinatedStorageVisibilityMutation } from './sessionConfigAuthority.js';
import { createWorkerRouteShellWithWorkerDeps } from './workerRouteShellBinding.js';
import { authorizeCloudflareStorageResourceRead, storageRoute } from './storageRouteExecution.js';
import { dispatchAuthenticatedRoute } from './authenticatedRouteDispatch.js';
import { dispatchAuthenticatedSecretPathRoute } from './authenticatedSecretPathRouteDispatch.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { SessionWriteCoordinator, executeCoordinatedSessionConfigMutation } from './sessionWriteCoordinator.js';
import { resolveAuthenticatedRouteContext } from './authenticatedRouteContextResolution.js';
import { resolveExistingSessionCors } from './existingSessionCorsResolution.js';
import { resolveAdminRequestAuthority } from './adminRequestAuthority.js';
import { buildAdminActionBodyHash } from './adminTypedData.mjs';
import { updateSessionSecretsAfterLitRepair, ensureSessionLitAuthorizationSigner, finalizeSessionLitAuthorization } from './sessionLitAuthorizationCoordinator.js';
import { ethers } from 'ethers';
import { readCurrentSessionConfig } from './sessionConfigAuthority.js';

const ACTOR_A = `0x${'aa'.repeat(20)}`;
const ACTOR_B = `0x${'bb'.repeat(20)}`;
const KEY = `0x${'11'.repeat(32)}`;
const json = (body, status, headers) => ({ body, status, headers });
const createFixture = (config = { slug: 'fixture', adminAddress: ACTOR_A }) => {
  const kv = new Map(config ? [['session:fixture:config', JSON.stringify(config)]] : []);
  const durable = new Map();
  const writes = [];
  const env = { CE_STORAGE_ENVELOPE_KEK: 'synthetic-test-kek', GROUP_KV: {
    get: async (key) => kv.get(key) ?? null,
    put: async (key, value) => { writes.push(key); kv.set(key, value); },
  } };
  const storage = {
    get: async (key) => structuredClone(durable.get(key)),
    put: async (key, value) => durable.set(key, structuredClone(value)),
    delete: async (key) => durable.delete(key),
  };
  storage.transaction = async (fn) => fn(storage);
  const coordinator = new SessionWriteCoordinator({ storage }, env);
  env.CE_SESSION_COORDINATOR = { idFromName: (x) => x, get: () => ({ fetch: (url, init) => coordinator.fetch(new Request(url, init)) }) };
  const snapshot = async () => {
    const response = await coordinator.fetch(new Request('https://session-coordinator.internal/session-config/current', {
      method: 'POST', body: JSON.stringify({ slug: 'fixture' }),
    }));
    assert.equal(response.status, 200);
    return response.json();
  };
  const authorized = async (actor = ACTOR_A) => {
    const value = await snapshot();
    return { actor, revision: value.revision, authzEpoch: value.config?.authzEpoch ?? 0 };
  };
  const rotate = async () => executeCoordinatedSessionConfigMutation({ env, slug: 'fixture', existingConfig: config,
    expectedAuthority: await authorized(), mutation: { kind: 'set-config', incomingConfig: { adminAddress: ACTOR_B } },
  });
  const context = (authzEpoch = 0) => resolveAuthenticatedRouteContext({ env,
    request: new Request('https://worker.example/storage/decrypt'), auth: { slug: 'fixture', payload: { sub: ACTOR_A, authzEpoch, scopes: { storage: true } } },
    deps: { json, toStr: String, getSessionConfig: async () => config, getCorsContext: async () => ({ ok: true, headers: {} }) },
  });
  return { env, kv, durable, writes, snapshot, authorized, rotate, context, config, coordinator };
};

test('legacy authority seeding accepts normalized historical configs without an AI policy', async () => {
  const f = createFixture({ adminAddress: ACTOR_A, allowOrigins: 'https://app.example, https://other.example', deployHelperEnabled: true });
  const value = await readCurrentSessionConfig({ env: f.env, slug: 'fixture' });
  assert.equal(value.revision, 1);
  assert.deepEqual(value.config.allowOrigins, ['https://app.example', 'https://other.example']);
  assert.equal(value.config.embeddedDeployHelperEnabled, true);
  assert.equal(value.config.aiPolicy, undefined);
});

test('invalid legacy configs require operator migration without leaking stored values or seeding authority', async () => {
  // Keep the synthetic userinfo intact when public text scrubbing prepares this test.
  const credentialedEndpoint = (origin) => {
    const url = new URL(origin);
    url.username = 'synthetic-user';
    url.password = 'synthetic-pass';
    return url.href;
  };
  for (const raw of ['{broken-json', 'null', '[]', JSON.stringify({ adminAddress: ACTOR_A, customRpcKey: 'synthetic-private-key' }),
    JSON.stringify({ adminAddress: ACTOR_A, ai: { apiKey: 'synthetic-provider-key' } }),
    JSON.stringify({ adminAddress: ACTOR_A, ai: { endpoint: credentialedEndpoint('https://provider.example') } }),
    JSON.stringify({ adminAddress: ACTOR_A, storageProfile: { backend: 'cloudflare', endpoint: credentialedEndpoint('https://storage.example') } })]) {
    const f = createFixture();
    f.kv.set('session:fixture:config', raw);
    await assert.rejects(readCurrentSessionConfig({ env: f.env, slug: 'fixture' }), (error) => {
      assert.equal(error.status, 503);
      assert.equal(error.message, 'Stored legacy session config requires operator migration before use.');
      assert.equal(error.reason, 'session_config_migration_required');
      return true;
    });
    assert.equal(f.durable.has('session-config-authority'), false);
    assert.equal(f.writes.length, 0);
    assert.equal(f.kv.get('session:fixture:config'), raw);
  }
});

test('legacy config read outages remain transient and cannot expose backend error text', async () => {
  const f = createFixture();
  f.env.GROUP_KV.get = async () => { throw new Error('synthetic-private-backend-detail'); };
  await assert.rejects(readCurrentSessionConfig({ env: f.env, slug: 'fixture' }), (error) => {
    assert.equal(error.status, 503);
    assert.equal(error.message, 'Session config coordination is unavailable; retry.');
    assert.equal(error.reason, undefined);
    return true;
  });
  assert.equal(f.durable.has('session-config-authority'), false);
});

test('publication rejects an admin upload revoked while external payload storage is paused', async () => {
  for (const storageLayer of ['kv', 'r2']) {
    const f = createFixture({ adminAddress: ACTOR_A, storageProfile: { backend: 'cloudflare', payloadAccessControl: { gate: 'none', encryption: 'none' } } });
    const rows = new Map();
    let reached;
    let resume;
    const storing = new Promise((resolve) => { reached = resolve; });
    const blocked = new Promise((resolve) => { resume = resolve; });
    const pause = async () => { reached(); await blocked; };
    f.env.CE_STORAGE_INDEX_KV = {
      get: async (key) => rows.get(key) ?? null,
      put: async (key, value) => { if (key.startsWith('ce-storage-payload:')) await pause(); rows.set(key, value); },
      list: async ({ prefix }) => ({ keys: [...rows.keys()].filter((key) => key.startsWith(prefix)).map((name) => ({ name })), list_complete: true }),
    };
    const blobs = new Map();
    if (storageLayer === 'r2') f.env.CE_STORAGE_R2 = { put: async (key, value) => { await pause(); blobs.set(key, value); } };
    const context = await f.context();
    assert.equal(context.ok, true);
    const request = new Request('https://worker.example/storage/upload', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resource: 'questions', data: { id: 'published-question', type: 'binary', prompt: 'Corrected prompt?' },
        expectedAuthority: { actor: ACTOR_B, revision: 2, authzEpoch: 1 } }) });
    const upload = dispatchAuthenticatedRoute({ path: '/storage/upload', method: 'POST', request, authenticatedContext: context,
      deps: { dispatchAuthenticatedSecretPathRoute: (args) => dispatchAuthenticatedSecretPathRoute({ ...args, env: f.env, deps: {
        evaluateAuthenticatedRoutePreflight: async () => ({ ok: true }),
        storageRoute: (value) => storageRoute({ ...value, deps: { json, randomBytes: () => new Uint8Array(32).fill(7) } }),
      } }) } });
    await storing;
    try { assert.equal((await f.rotate()).status, 200); } finally { resume(); }
    const result = await upload;
    assert.equal(result.status, 409, storageLayer);
    assert.match(result.body.error, /Session authorization changed/);
    assert.equal([...rows.keys()].some((key) => key.startsWith('ce-storage:')), false);
    assert.equal([...rows.keys()].some((key) => key.startsWith('ce-storage-owner:')), false);
    const listed = await storageRoute({ path: '/storage/list', method: 'GET', request: new Request('https://worker.example/storage/list?resource=questions'),
      env: f.env, config: (await f.snapshot()).config, slug: 'fixture', deps: { json } });
    assert.deepEqual(listed.body.items, []);
    assert.equal(storageLayer === 'r2' ? blobs.size : [...rows.keys()].filter((key) => key.startsWith('ce-storage-payload:')).length, 1,
      'payload storage may leave one orphan, but it must not become a canonical/listed publication');
  }
});

test('publication with current authority records server stamps and rejects missing or mismatched proof', async () => {
  for (const resource of ['questions', 'surveys']) {
    const f = createFixture({ adminAddress: ACTOR_A, storageProfile: { backend: 'cloudflare', payloadAccessControl: { gate: 'none', encryption: 'none' } } });
    const v = visibilityIndex(0);
    f.env.CE_STORAGE_INDEX_KV = v.index;
    const expectedAuthority = await f.authorized();
    let sequence = 1;
    const upload = (proof) => storageRoute({ path: '/storage/upload', method: 'POST', env: f.env, config: f.config, slug: 'fixture',
      uploaderAddress: ACTOR_A, expectedAuthority: proof, request: new Request('https://worker.example/storage/upload', { method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resource, data: resource === 'questions'
          ? { id: 'published-id', type: 'binary', prompt: 'Published prompt?' } : { surveyID: 'published-id', title: 'Published survey' } }) }),
      deps: { json, randomBytes: () => new Uint8Array(32).fill(sequence++) } });
    for (const proof of [undefined, { ...expectedAuthority, actor: ACTOR_B }]) {
      assert.equal((await upload(proof)).status, 409);
      assert.equal([...v.values.keys()].some((key) => key.startsWith('ce-storage:')), false);
      assert.equal([...v.values.keys()].some((key) => key.startsWith('ce-storage-owner:')), false);
    }
    assert.equal((await upload(expectedAuthority)).status, 200);
    const rows = [...v.values].filter(([key]) => key.startsWith('ce-storage:')).map(([, value]) => JSON.parse(value));
    assert.equal(rows.length, 1);
    assert.equal(rows[0].uploadAuthority, 'admin');
    assert.equal(rows[0].uploader, ACTOR_A);
    assert.equal([...v.values.keys()].filter((key) => key.startsWith('ce-storage-owner:')).length, 1);
    assert.equal((await f.rotate()).status, 200);
    const storedRow = [...v.values].find(([key]) => key.startsWith('ce-storage:'));
    assert.equal(JSON.parse(storedRow[1]).uploadAuthority, 'admin', 'a completed publication retains its upload-time authority');
  }
});

test('current config reads finish while an existing visibility scan is waiting on storage', async () => {
  const f = createFixture();
  const expectedAuthority = await f.authorized();
  let reached;
  let resume;
  const scanning = new Promise((resolve) => { reached = resolve; });
  const blocked = new Promise((resolve) => { resume = resolve; });
  f.env.CE_STORAGE_INDEX_KV = {
    get: async () => null, put: async () => {}, delete: async () => {},
    list: async ({ prefix }) => {
      if (prefix.startsWith('ce-storage:')) { reached(); await blocked; }
      return { keys: [], list_complete: true };
    },
  };
  const hidden = executeCoordinatedStorageVisibilityMutation({ env: f.env, slug: 'fixture', expectedAuthority,
    body: { resource: 'questions', id: 'fixture-question', hidden: true } });
  await scanning;
  let timer;
  try {
    const current = await Promise.race([
      f.snapshot(), new Promise((resolve) => { timer = setTimeout(() => resolve(null), 250); }),
    ]);
    assert.ok(current, 'an unchanged current-config read must not wait for the visibility scan');
    assert.equal(current.config.adminAddress, ACTOR_A);
  } finally {
    clearTimeout(timer);
    resume();
    await hidden;
  }
});

test('current config fast reads still require pending Lit/config projections to repair', async () => {
  for (const pendingKind of ['config', 'lit']) {
    const f = createFixture();
    await f.snapshot();
    if (pendingKind === 'config') {
      f.durable.get('session-config-authority').projectionPending = true;
      f.env.GROUP_KV.put = async () => { throw new Error('projection unavailable'); };
    } else {
      f.durable.set('session-lit-authorization-pending-v1', { version: 1, slug: 'fixture', revision: 1, envelope: {} });
    }
    const response = await f.coordinator.executeSessionConfigCurrent({ slug: 'fixture' });
    assert.equal(response.status, 503);
  }
});

const visibilityIndex = (count = 121) => {
  const values = new Map(Array.from({ length: count }, (_, i) => {
    const id = `version-${String(i).padStart(3, '0')}`;
    return [`ce-storage:fixture:questions:${id}`, JSON.stringify({ id, resourceId: 'fixture-question', resource: 'questions' })];
  }));
  const writes = [];
  const pageLimits = [];
  const index = {
    get: async (key) => values.get(key) ?? null,
    put: async (key, value) => { writes.push([key, value]); values.set(key, value); },
    delete: async (key) => values.delete(key),
    list: async ({ prefix, cursor = '', limit = 1000 }) => {
      if (prefix.startsWith('ce-storage:')) pageLimits.push(limit);
      const keys = [...values.keys()].filter((key) => key.startsWith(prefix)).sort();
      const offset = Number(cursor || 0);
      const end = Math.min(offset + limit, keys.length);
      return { keys: keys.slice(offset, end).map((name) => ({ name })), list_complete: end === keys.length, cursor: String(end) };
    },
  };
  return { values, writes, pageLimits, index };
};

test('visibility pages recheck authority after scan reads and stop writes after a completed rotation', async () => {
  const f = createFixture();
  const v = visibilityIndex();
  f.env.CE_STORAGE_INDEX_KV = v.index;
  const expectedAuthority = await f.authorized();
  let reached;
  let resume;
  const reachedSecondPage = new Promise((resolve) => { reached = resolve; });
  const blocked = new Promise((resolve) => { resume = resolve; });
  const originalList = v.index.list;
  v.index.list = async (args) => {
    if (args.prefix.startsWith('ce-storage:') && args.cursor === '50') { reached(); await blocked; }
    return originalList(args);
  };
  const hidden = executeCoordinatedStorageVisibilityMutation({ env: f.env, slug: 'fixture', expectedAuthority,
    body: { resource: 'questions', id: 'fixture-question', hidden: true } });
  await reachedSecondPage;
  try {
    assert.equal((await f.rotate()).status, 200);
  } finally {
    resume();
  }
  assert.equal((await hidden).status, 409);
  assert.ok(v.pageLimits.every((limit) => limit === 50));
  assert.equal(v.writes.filter(([key]) => key.startsWith('ce-storage:')).length, 50);
  assert.equal(JSON.parse(v.values.get('ce-storage:fixture:questions:version-120')).hidden, undefined);
  const repaired = await executeCoordinatedStorageVisibilityMutation({ env: f.env, slug: 'fixture', expectedAuthority: await f.authorized(ACTOR_B),
    body: { resource: 'questions', id: 'fixture-question', hidden: false } });
  assert.equal(repaired.status, 200);
  assert.equal(repaired.body.matchedRows, 121);
  assert.ok([...v.values].filter(([key]) => key.startsWith('ce-storage:')).every(([, value]) => JSON.parse(value).hidden !== true));
});

test('concurrent same-id hide and unhide complete in order across bounded pages', async () => {
  const f = createFixture();
  const v = visibilityIndex();
  f.env.CE_STORAGE_INDEX_KV = v.index;
  const expectedAuthority = await f.authorized();
  const call = (hidden) => f.coordinator.executeStorageVisibilityMutation({ slug: 'fixture', expectedAuthority,
    body: { resource: 'questions', id: 'fixture-question', hidden } });
  const responses = await Promise.all([call(true), call(false)]);
  assert.deepEqual(responses.map((response) => response.status), [200, 200]);
  assert.ok(v.pageLimits.every((limit) => limit === 50));
  const flags = v.writes.filter(([key]) => key.startsWith('ce-storage:')).map(([, value]) => JSON.parse(value).hidden === true);
  assert.deepEqual(flags, [...Array(121).fill(true), ...Array(121).fill(false)]);
  assert.deepEqual((await responses[1].json()).hiddenIds, []);
});

test('visibility write failure within a page is an explicit failure and can be completed on retry', async () => {
  const f = createFixture();
  const v = visibilityIndex();
  f.env.CE_STORAGE_INDEX_KV = v.index;
  const expectedAuthority = await f.authorized();
  const originalPut = v.index.put;
  v.index.put = async (key, value) => {
    if (key.endsWith('version-060')) throw new Error('temporary storage write failure');
    return originalPut(key, value);
  };
  const args = { env: f.env, slug: 'fixture', expectedAuthority, body: { resource: 'questions', id: 'fixture-question', hidden: true } };
  const failed = await executeCoordinatedStorageVisibilityMutation(args);
  assert.equal(failed.ok, false);
  assert.equal(failed.status, 503);
  assert.equal(JSON.parse(v.values.get('ce-storage:fixture:questions:version-120')).hidden, undefined);
  v.index.put = originalPut;
  const retry = await executeCoordinatedStorageVisibilityMutation(args);
  assert.equal(retry.status, 200);
  assert.equal(retry.body.matchedRows, 121);
});

test('coordinator current policy ignores stale KV after rotation, including token key-release admission', async () => {
  const f = createFixture();
  assert.equal((await f.rotate()).ok, true);
  f.kv.set('session:fixture:config', JSON.stringify(f.config));
  assert.equal((await f.snapshot()).config.adminAddress, ACTOR_B);
  const stale = await f.context();
  assert.equal(stale.response.status, 401);
  assert.equal((await f.context(1)).ok, true);
});

test('pending config, secret, and Lit writes reject superseded authority before effects', async () => {
  const f = createFixture();
  const expectedAuthority = await f.authorized();
  await ensureSessionLitAuthorizationSigner({ env: f.env, slug: 'fixture', baseConfig: f.config, expectedAuthority, proposedPrivateKey: KEY });
  assert.equal((await f.rotate()).ok, true);
  const before = [...f.kv];
  const staleConfig = await executeCoordinatedSessionConfigMutation({ env: f.env, slug: 'fixture', existingConfig: f.config, expectedAuthority,
    mutation: { kind: 'set-config', incomingConfig: { adminAddress: ACTOR_A } } });
  assert.equal(staleConfig.status, 409);
  const staleSecret = await updateSessionSecretsAfterLitRepair({ env: f.env, slug: 'fixture', expectedAuthority, incomingSecrets: { openaiKey: 'synthetic-stale-key' } });
  assert.equal(staleSecret.status, 409);
  const staleLit = await finalizeSessionLitAuthorization({ env: f.env, slug: 'fixture', baseConfig: f.config, expectedAuthority,
    litCredentials: { litAuthorizationVersion: 'worker-signed-v1', litAuthorizationSigner: new ethers.Wallet(KEY).address },
    secretOutputs: { litAuthorizationPrivateKey: KEY, litUsageApiKey: 'synthetic-stale-usage' } });
  assert.equal(staleLit.status, 409);
  assert.deepEqual([...f.kv], before);
  const current = await updateSessionSecretsAfterLitRepair({ env: f.env, slug: 'fixture', expectedAuthority: await f.authorized(ACTOR_B), incomingSecrets: { openaiKey: 'synthetic-current-key' } });
  assert.equal(current.status, 200);
});

test('current-policy reads fail closed without coordination even when cached config is present', async () => {
  const f = createFixture();
  delete f.env.CE_SESSION_COORDINATOR;
  assert.equal((await f.context()).response.status, 503);
});

test('first bootstrap may create authority once; a concurrent bootstrap cannot replace it', async () => {
  const f = createFixture(null);
  const expectedAuthority = await f.authorized();
  const args = { env: f.env, slug: 'fixture', expectedAuthority,
    mutation: { kind: 'set-config', incomingConfig: { adminAddress: ACTOR_A } } };
  assert.equal((await executeCoordinatedSessionConfigMutation(args)).status, 200);
  assert.equal((await executeCoordinatedSessionConfigMutation({ ...args, mutation: { kind: 'set-config', incomingConfig: { adminAddress: ACTOR_B } } })).status, 409);
});

const adminAuthority = (f, address) => {
  const request = new Request('https://worker.example/admin/set-config');
  const body = { address, action: 'set-config', slug: 'fixture', nonce: 'testnonce', signature: 'synthetic',
    audience: 'https://worker.example', expiration: Math.floor(Date.now() / 1000) + 300, config: { adminAddress: address } };
  body.bodyHash = buildAdminActionBodyHash(body);
  return resolveAdminRequestAuthority({ env: f.env, request, body, action: 'set-config', deps: {
    json, normalizeSignedWorkerRequest: (value) => value, isAddress: ethers.isAddress,
    resolveWorkerBodySlugContext: () => ({ ok: true, explicitSlugProvided: true, targetSlug: 'fixture' }),
    resolveExistingSessionCors: (args) => resolveExistingSessionCors({ ...args, deps: {
      json, normalizeWorkerSessionSlug: (x) => x, getSessionConfig: async () => f.config,
      getCorsContext: async () => ({ ok: true, headers: {} }),
    } }),
    verifyAdminActionSignature: () => ({ valid: true }), validateAdminActionAudience: () => ({ ok: true }),
    consumeNonce: async () => ({ ok: true }), validateAdmin: async ({ address: actor, config }) => actor === config.adminAddress,
  } });
};

test('old admin is denied against current authority despite a stale replica; current admin is admitted', async () => {
  const f = createFixture();
  assert.equal((await f.rotate()).ok, true);
  f.kv.set('session:fixture:config', JSON.stringify(f.config));
  assert.equal((await adminAuthority(f, ACTOR_A)).response.status, 403);
  const current = await adminAuthority(f, ACTOR_B);
  assert.equal(current.ok, true);
  assert.equal(current.expectedAuthority.actor, ACTOR_B);
  assert.equal(current.expectedAuthority.authzEpoch, 1);
});

test('a verified admin request delayed by authorization work cannot overwrite a completed rotation', async () => {
  const f = createFixture();
  let reached;
  let resume;
  const reachedAuthority = new Promise((resolve) => { reached = resolve; });
  const resumeAuthority = new Promise((resolve) => { resume = resolve; });
  const pending = dispatchAdminRequest({
    env: f.env, action: 'set-config', request: { json: async () => ({ config: { adminAddress: ACTOR_A },
      expectedAuthority: { actor: ACTOR_B, revision: 2, authzEpoch: 1 },
    }) },
    deps: { json, resolveAdminRequestAuthority: async () => {
      const authority = await adminAuthority(f, ACTOR_A);
      reached();
      await resumeAuthority;
      return authority;
    } },
  });
  await reachedAuthority;
  assert.equal((await f.rotate()).ok, true);
  resume();
  assert.equal((await pending).status, 409);
  assert.equal((await f.snapshot()).config.adminAddress, ACTOR_B);
});

const groupAuthorityFixture = async () => {
  const sessionId = '0x' + 'ab'.repeat(16);
  const f = createFixture({ slug: 'fixture', adminAddress: ACTOR_A, sessionId });
  f.env.CE_WORKER_GROUPS_BOOTSTRAP = 'fresh-template-v2';
  f.env.GROUP_KV.delete = async (key) => { f.writes.push(key); f.kv.delete(key); };
  f.env.GROUP_KV.list = async ({ prefix = '' } = {}) => ({
    keys: [...f.kv.keys()].filter((name) => name.startsWith(prefix)).map((name) => ({ name })), list_complete: true,
  });
  const groupStore = new Map();
  const storage = {
    get: async (key) => structuredClone(groupStore.get(key)),
    put: async (key, value) => groupStore.set(key, structuredClone(value)),
    delete: async (key) => groupStore.delete(key),
    list: async ({ prefix = '' } = {}) => new Map([...groupStore].filter(([key]) => key.startsWith(prefix))),
  };
  storage.transaction = async (fn) => fn(storage);
  const groups = new SessionWriteCoordinator({ storage }, f.env);
  f.env.CE_WORKER_GROUP_COORDINATOR = { idFromName: (name) => name, get: (name) => {
    assert.equal(name, `worker-groups:fixture:${sessionId}`);
    return { fetch: (url, init) => groups.fetch(new Request(url, init)) };
  } };
  const args = { env: f.env, slug: 'fixture', sessionId, groupId: 'reviewers', principal: { kind: 'evm_address', address: ACTOR_A }, actorPrincipal: { kind: 'evm_address', address: ACTOR_A } };
  const created = await groups.fetch(new Request('https://session-coordinator.internal/worker-groups/mutate', {
    method: 'POST', body: JSON.stringify({ ...args, env: undefined, operation: 'create',
      input: { groupId: 'reviewers', label: 'Reviewers', joinMode: 'open' } }),
  }));
  assert.equal(created.status, 200, JSON.stringify(await created.json()));
  return { ...f, args, groupStore, groups, sessionId };
};

test('a stale authority proof never changes membership in a separate group coordinator', async () => {
  const f = await groupAuthorityFixture();
  let admitted;
  let resume;
  const admission = new Promise((resolve) => { admitted = resolve; });
  const blocked = new Promise((resolve) => { resume = resolve; });
  const pending = dispatchAdminRequest({ env: f.env, action: 'groups/add-member',
    request: { json: async () => ({ sessionId: f.sessionId, groupId: 'reviewers', principal: f.args.principal }) },
    deps: { json, resolveAdminRequestAuthority: async () => {
      const authority = await adminAuthority(f, ACTOR_A);
      admitted(); await blocked; return authority;
    } },
  });
  await admission;
  assert.equal((await f.rotate()).ok, true);
  const before = { kv: [...f.kv], groups: structuredClone([...f.groupStore]), writes: f.writes.length };
  resume();
  assert.equal((await pending).status, 409);
  assert.deepEqual([...f.kv], before.kv);
  assert.deepEqual([...f.groupStore], before.groups);
  assert.equal(f.writes.length, before.writes);
  const fresh = await dispatchAdminRequest({ env: f.env, action: 'groups/add-member',
    request: { json: async () => ({ sessionId: f.sessionId, groupId: 'reviewers', principal: f.args.principal }) },
    deps: { json, resolveAdminRequestAuthority: () => adminAuthority(f, ACTOR_B) },
  });
  assert.equal(fresh.status, 200);
  assert.equal((await isWorkerGroupMember(f.args)).ok, true);
  assert.equal(f.groupStore.has('session-config-authority'), false, 'only session config owns the authority');
});

test('rotation waits for an admitted group commit and missing authority never enters the group object', async () => {
  const f = await groupAuthorityFixture();
  const before = structuredClone([...f.groupStore]);
  assert.equal((await executeCoordinatedWorkerGroupMutation({ ...f.args, operation: 'add-member' })).status, 409);
  assert.deepEqual([...f.groupStore], before);
  const proof = await f.authorized();
  const put = f.env.GROUP_KV.put;
  let entered;
  let resume;
  const committing = new Promise((resolve) => { entered = resolve; });
  const blocked = new Promise((resolve) => { resume = resolve; });
  f.env.GROUP_KV.put = async (key, value) => { entered(); await blocked; await put(key, value); };
  const mutation = executeCoordinatedWorkerGroupMutation({ ...f.args, operation: 'add-member', expectedAuthority: proof });
  await committing;
  let rotated = false;
  const rotation = f.rotate().then((result) => { rotated = true; return result; });
  try {
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(rotated, false);
  } finally { resume(); }
  assert.equal((await mutation).ok, true);
  assert.equal((await rotation).ok, true);
  assert.equal((await isWorkerGroupMember(f.args)).ok, true);
});

test('participant join and leave preserve the admitted epoch through group dispatch', async () => {
  for (const path of ['/groups/join', '/groups/leave']) {
    const f = await groupAuthorityFixture();
    const admitted = await f.authorized();
    assert.equal((await executeCoordinatedWorkerGroupMutation({ ...f.args, operation: 'join', expectedAuthority: admitted })).ok, true);
    assert.equal((await f.rotate()).ok, true);
    const before = structuredClone([...f.groupStore]);
    const result = await dispatchAuthenticatedSecretPathRoute({ env: f.env, path, method: 'POST',
      request: new Request(`https://worker.example${path}`, { method: 'POST',
        body: JSON.stringify({ sessionId: f.sessionId, groupId: 'reviewers' }) }),
      config: f.config, slug: 'fixture', address: ACTOR_A, expectedAuthority: admitted, scopes: { groups: true },
      deps: { json, evaluateAuthenticatedRoutePreflight: async () => ({ ok: true }) },
    });
    assert.equal(result.response.status, 409, path);
    assert.deepEqual([...f.groupStore], before);
  }
});

test('a committed group intent finishes recovery after the admitting authority changes', async () => {
  const f = await groupAuthorityFixture();
  const put = f.env.GROUP_KV.put;
  let interrupted = false;
  f.env.GROUP_KV.put = async (key, value) => {
    await put(key, value);
    if (!interrupted && key.includes('member')) { interrupted = true; throw new Error('interrupted projection'); }
  };
  const started = await executeCoordinatedWorkerGroupMutation({ ...f.args, operation: 'add-member', expectedAuthority: await f.authorized() });
  assert.equal(started.status, 503);
  assert.equal(interrupted, true);
  assert.equal((await f.rotate()).ok, true);
  assert.equal((await isWorkerGroupMember(f.args)).ok, true);
  assert.equal(f.groupStore.has('session-config-authority'), false);
  assert.equal([...f.groupStore.values()].some((value) => value?.pendingMutation), false);
});

test('Lit provisioning in flight rejects completion after rotation and does not persist its remote outputs', async () => {
  const f = createFixture();
  let reached;
  let resume;
  const provisioning = new Promise((resolve) => { reached = resolve; });
  const resumeProvisioning = new Promise((resolve) => { resume = resolve; });
  const expectedAuthority = await f.authorized();
  const pending = dispatchAdminRequest({
    env: f.env, action: 'lit-chipotle-bootstrap-session', request: { json: async () => ({}) },
    deps: { json, getSessionSecrets: async () => ({}),
      resolveAdminRequestAuthority: async () => ({ ok: true, existingConfig: f.config, targetSlug: 'fixture', expectedAuthority }),
      bootstrapLitChipotleSession: async ({ persistAuthorizationSecret }) => {
        const privateKey = await persistAuthorizationSecret(KEY);
        reached();
        await resumeProvisioning;
        return { litCredentials: { litAuthorizationVersion: 'worker-signed-v1', litAuthorizationSigner: new ethers.Wallet(privateKey).address },
          secretOutputs: { litAuthorizationPrivateKey: privateKey, litUsageApiKey: 'synthetic-delayed-output' } };
      },
    },
  });
  await provisioning;
  assert.equal((await f.rotate()).ok, true);
  resume();
  assert.equal((await pending).status, 409);
  assert.equal(f.kv.has('session:fixture:secrets'), false);
  assert.equal((await f.snapshot()).config.litCredentials, undefined);
});

test('visibility updates and signer reservations reject stale or missing verified authority without effects', async () => {
  const f = createFixture();
  const expectedAuthority = await f.authorized();
  assert.equal((await f.rotate()).ok, true);
  const before = [...f.kv];
  for (const authority of [expectedAuthority, undefined]) {
    const visibility = await executeCoordinatedStorageVisibilityMutation({ env: f.env, slug: 'fixture',
      expectedAuthority: authority, body: { resource: 'questions', id: 'fixture-question', hidden: true,
        expectedAuthority: await f.authorized(ACTOR_B) },
    });
    assert.equal(visibility.status, 409);
    await assert.rejects(ensureSessionLitAuthorizationSigner({ env: f.env, slug: 'fixture', baseConfig: f.config,
      expectedAuthority: authority, proposedPrivateKey: KEY,
    }), (error) => error.status === 409);
  }
  assert.deepEqual([...f.kv], before);
  assert.equal(f.durable.has('session-lit-authorization-signer-v1'), false);
});

const makeShell = (f, overrides = {}) => createWorkerRouteShellWithWorkerDeps({
  constants: { missingSlugError: 'Missing session slug.', sessionConfigNotFoundError: 'Session config not found.' },
  deps: {
    toStr: String, json: (body, status = 200, headers = {}) => new Response(JSON.stringify(body), { status, headers }),
    corsHeaders: () => ({}), getCorsContext: async () => ({ ok: true, headers: {} }),
    resolveRequestSlugWithoutToken: () => ({ ok: true, slug: 'fixture', explicitSlugProvided: true }),
    getSessionConfig: async () => f.config,
    checkRateLimit: async () => true, resolveAnonymousRateIdentity: () => 'synthetic',
    ...overrides,
  },
});

test('public ungated storage routes require coordinator availability and report legacy migration failures', async () => {
  const config = { adminAddress: ACTOR_A, storageProfile: { backend: 'cloudflare', payloadAccessControl: { gate: 'none', encryption: 'none' } } };
  for (const failure of ['missing-binding', 'invalid-legacy']) {
    const f = createFixture(config);
    if (failure === 'missing-binding') delete f.env.CE_SESSION_COORDINATOR;
    else f.kv.set('session:fixture:config', JSON.stringify({ ...config, customRpcKey: 'synthetic-private-value' }));
    let dispatched = 0;
    const shell = makeShell(f, { storageRoute: () => { dispatched += 1; return new Response('{}'); } });
    for (const path of ['/storage/list?resource=questions', '/storage/read?id=fixture']) {
      const response = await shell.fetch(new Request(`https://worker.example${path}`), f.env);
      assert.equal(response.status, 503);
      assert.equal((await response.json()).error, failure === 'invalid-legacy'
        ? 'Stored legacy session config requires operator migration before use.'
        : 'Session config coordination is unavailable; retry.');
    }
    assert.equal(dispatched, 0);
  }
});

test('anonymous storage and artifact reads use current gates despite stale public KV policy', async () => {
  const config = { slug: 'fixture', adminAddress: ACTOR_A,
    storageProfile: { backend: 'cloudflare', payloadAccessControl: { gate: 'none', encryption: 'none' } } };
  const f = createFixture(config);
  let released = 0;
  const read = async ({ config: policy, env, slug, baseHeaders }) => {
    const access = await authorizeCloudflareStorageResourceRead({ config: policy, env, slug, baseHeaders, resource: 'questions' });
    if (!access.ok) return access.response;
    released += 1;
    return new Response('{}');
  };
  const shell = makeShell(f, { storageRoute: read, dispatchResultsAnalysisArtifactRequest: read });
  const paths = ['/storage/list?resource=questions', '/storage/read?id=fixture', '/results-analysis/artifact?slug=fixture'];
  for (const path of paths) assert.equal((await shell.fetch(new Request(`https://worker.example${path}`), f.env)).status, 200);
  const rotated = await executeCoordinatedSessionConfigMutation({ env: f.env, slug: 'fixture', expectedAuthority: await f.authorized(),
    mutation: { kind: 'set-config', incomingConfig: { storageProfile: { backend: 'cloudflare', payloadAccessControl: { gate: 'sbt_gate', encryption: 'none' } } } },
  });
  assert.equal(rotated.status, 200);
  f.kv.set('session:fixture:config', JSON.stringify(config));
  for (const path of paths) assert.equal((await shell.fetch(new Request(`https://worker.example${path}`), f.env)).status, 401);
  assert.equal(released, 3);
  f.env.CE_SESSION_COORDINATOR.get = () => { throw new Error('synthetic coordination outage'); };
  for (const path of paths) assert.equal((await shell.fetch(new Request(`https://worker.example${path}`), f.env)).status, 503);
  assert.equal(released, 3);
});

test('stale tokens never dispatch payload reads, response field key release, or Lit authorization', async () => {
  const f = createFixture();
  assert.equal((await f.rotate()).ok, true);
  f.kv.set('session:fixture:config', JSON.stringify(f.config));
  let dispatched = 0;
  let authzEpoch = 0;
  const shell = makeShell(f, {
    requireAuth: async () => ({ ok: true, slug: 'fixture', payload: { sub: ACTOR_A, authzEpoch, scopes: { storage: true, lit: true } } }),
    dispatchAuthenticatedRoute: async () => { dispatched += 1; return new Response('{}'); },
  });
  for (const path of ['/storage/read', '/storage/response-field-key/unwrap', '/lit/chipotle-action']) {
    const response = await shell.fetch(new Request(`https://worker.example${path}`, { method: 'POST', headers: { Authorization: 'Bearer synthetic' } }), f.env);
    assert.equal(response.status, 401);
  }
  assert.equal(dispatched, 0);
  authzEpoch = 1;
  assert.equal((await shell.fetch(new Request('https://worker.example/storage/response-field-key/unwrap', { method: 'POST', headers: { Authorization: 'Bearer synthetic' } }), f.env)).status, 200);
  assert.equal(dispatched, 1);
});
