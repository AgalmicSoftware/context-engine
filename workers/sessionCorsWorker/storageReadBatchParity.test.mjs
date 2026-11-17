// A batch read gives each reader exactly what single reads give them, item by
// item (access checks, the rule each item was stored under, an item's own
// rule, research material), while reading every payload in one bulk KV get and asking the
// session's gate once.
import test from 'node:test';
import assert from 'node:assert/strict';
import { groupLockedAccess } from '../../shared/sessionContextSources.mjs';
import { buildPayloadKey, publishCloudflareOwnedStorageMetadata, storageRoute } from './storageRouteExecution.js';

const SESSION_ID = `0x${'ab'.repeat(16)}`;
const ADMIN = `0x${'a'.repeat(40)}`;
const FIRST = `0x${'1'.repeat(40)}`;
const SECOND = `0x${'2'.repeat(40)}`;
const MEMBERS = { first: [FIRST], second: [SECOND] };

const json = (body, status = 200, headers = {}) => new Response(JSON.stringify(body), { status, headers });
// A KV namespace that counts single and bulk gets of payloads, and can refuse bulk gets as KV does over 25 MB.
const createKv = () => {
  const store = new Map();
  const reads = { single: 0, bulk: 0, refuseBulk: false };
  const isPayload = (key) => key.includes(':payload:') || key === buildPayloadKey({ slug: 's', id: key.split(':').pop() });
  return {
    store, reads,
    put: async (key, value) => { store.set(key, value); },
    get: async (key) => {
      if (Array.isArray(key)) {
        reads.bulk += 1;
        if (reads.refuseBulk) throw new Error('KV GET_BULK failed: 413 Payload Too Large');
        return new Map(key.map((name) => [name, store.get(name) ?? null]));
      }
      if (isPayload(key)) reads.single += 1;
      return store.get(key) ?? null;
    },
    delete: async (key) => { store.delete(key); },
    list: async ({ prefix = '' } = {}) => ({ keys: [...store.keys()].filter((name) => name.startsWith(prefix)).map((name) => ({ name })), list_complete: true }),
  };
};

const configFor = (rule) => {
  const payloadAccessControl = { gate: 'none', encryption: 'none', ...(rule ? { accessConditions: rule } : {}) };
  return {
    slug: 's', sessionSlug: 's', adminAddress: ADMIN, sessionId: SESSION_ID,
    sessionModeProfile: {
      profileVersion: 1, preset: 'custom', authority: { mode: 'worker_canonical' }, evm: { registryChainId: null },
      storage: { backend: 'cloudflare', payloadAccessControl },
      identity: { default: 'passkey', enabled: ['passkey'] }, authorization: { mechanisms: ['worker_roles'] }, encryption: { mode: 'none' },
      surfaces: { web: true, telegram: false, miniApp: false, agentHttp: false, mcp: false, ceCc: false },
      results: { visibility: 'session_member_full', exposure: { aggregateResultsEnabled: true, anonymizedGroupsEnabled: false, minGroupSize: 2 } },
      export: { scope: 'admin_raw' },
    },
    storageProfile: { backend: 'cloudflare', payloadAccessControl },
  };
};

const depsFor = (config, actor, extra = {}) => ({
  json,
  isWorkerGroupMember: async ({ groupId, requesterAddress }) => ((MEMBERS[groupId] || []).includes(requesterAddress)
    ? { ok: true, principal: requesterAddress }
    : { ok: false, status: 403, reason: 'worker_group_membership_denied' }),
  executeCoordinatedStoragePublication: async (publication) => {
    await publishCloudflareOwnedStorageMetadata({ ...publication, config, actor });
    return { ok: true, status: 200, body: { ok: true } };
  },
  ...extra,
});
const route = (env, config, who, path, init, extra) => storageRoute({
  env, config, slug: 's', uploaderAddress: who, authScopes: who ? { storage: true } : {}, baseHeaders: {}, deps: depsFor(config, who, extra),
  path: path.split('?')[0], method: init?.method || 'GET', request: new Request(`https://w.test${path}`, init),
});
const upload = async (env, config, who, body, extra) => {
  const response = await route(env, config, who, '/storage/upload', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contentType: 'application/json', ...body }),
  }, extra);
  assert.equal(response.status, 200, await response.clone().text());
  return (await response.json()).id;
};
const answer = (extra = {}) => ({ questionId: 'q-1', answer: 'Agree', sessionSlug: 's', sessionId: SESSION_ID, ...extra });
const docTags = [
  { name: 'CE-DocLibrary', value: '1' }, { name: 'CE-DocKind', value: 'file' }, { name: 'CE-DocStorage', value: 'cloudflare' },
  { name: 'CE-DocRole', value: 'context' }, { name: 'CE-DocName', value: 'plan' },
];

// What a reader gets for an id, read alone, in the shape a batch item takes.
const single = async (env, config, who, id, extra) => {
  const response = await route(env, config, who, `/storage/read?id=${id}`, undefined, extra);
  if (!response.ok) {
    const body = await response.json();
    return { id, status: response.status, error: body.error, ...(body.reason ? { reason: body.reason } : {}) };
  }
  return { id, status: 200, contentType: response.headers.get('Content-Type'), text: await response.text() };
};
const batch = async (env, config, who, ids, extra) => {
  const response = await route(env, config, who, '/storage/read-batch', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids }),
  }, extra);
  assert.equal(response.status, 200);
  return (await response.json()).items;
};

// Answers given before the session widened to two groups: one whose author
// kept it to the first group, one with research material, one given to
// everyone; a question; a context item locked to the second group by its
// uploader; and an id that was never stored.
const seed = async (env) => {
  const first = configFor(groupLockedAccess(['first']));
  const open = configFor(null);
  return [
    await upload(env, first, ADMIN, { resource: 'questions', data: { id: 'q-1', type: 'binary', prompt: 'Continue?', sessionSlug: 's', sessionId: SESSION_ID } }),
    await upload(env, first, FIRST, { resource: 'responses', accessConditions: groupLockedAccess(['first']), data: answer() }),
    await upload(env, first, FIRST, { resource: 'responses', data: answer({ interviewProvenance: { version: 2, researchTier: 'minimal', blindAnswer: 'Disagree' } }) }),
    await upload(env, open, SECOND, { resource: 'responses', data: answer({ interviewProvenance: { version: 2, researchTier: 'minimal', blindAnswer: 'Agree' } }) }),
    await upload(env, open, ADMIN, { resource: 'docsContext', contentType: 'text/markdown', data: '# Plan', tags: docTags, accessConditions: groupLockedAccess(['second']) }),
    'cf_never_stored_0000000000',
  ];
};
const WIDENED = configFor(groupLockedAccess(['first', 'second']));
const READERS = { signedOut: '', first: FIRST, second: SECOND, admin: ADMIN };

for (const refuseBulk of [false, true]) {
  test(refuseBulk
    ? 'when KV refuses the bulk get, a batch reads each item alone and still matches single reads'
    : 'a batch matches single reads for every reader, item by item, from one bulk KV get', async () => {
    const env = { CE_STORAGE_INDEX_KV: createKv() };
    const ids = await seed(env);
    env.CE_STORAGE_INDEX_KV.reads.refuseBulk = refuseBulk;
    const statuses = {};
    for (const [reader, who] of Object.entries(READERS)) {
      const expected = [];
      for (const id of ids) expected.push(await single(env, WIDENED, who, id));
      env.CE_STORAGE_INDEX_KV.reads.single = 0;
      env.CE_STORAGE_INDEX_KV.reads.bulk = 0;
      const items = await batch(env, WIDENED, who, ids);
      assert.deepEqual(items, expected, reader);
      assert.deepEqual(env.CE_STORAGE_INDEX_KV.reads, { single: refuseBulk ? ids.length : 0, bulk: 1, refuseBulk }, reader);
      statuses[reader] = items.map((item) => item.status);
    }
    // The cases differ by reader, so the comparison above covers each rule.
    assert.deepEqual(statuses, {
      signedOut: [403, 403, 403, 403, 403, 404],
      first: [200, 200, 200, 200, 403, 404],
      // Items stored while the session was the first group's keep that rule.
      second: [403, 403, 403, 200, 200, 404],
      admin: [200, 200, 200, 200, 200, 404],
    });
    // Research material reaches an answer's author and the admins, and no other reader.
    const research = async (who, id) => JSON.parse((await batch(env, WIDENED, who, [id]))[0].text);
    assert.equal('interviewProvenance' in await research(ADMIN, ids[3]), true);
    assert.equal('interviewProvenance' in await research(SECOND, ids[3]), true);
    assert.equal((await research(FIRST, ids[3])).interviewProvenanceWithheld, true);
  });
}

test('a batch on an SBT-gated session checks the reader’s tokens once, not per item', async () => {
  const env = { CE_STORAGE_INDEX_KV: createKv() };
  const gated = {
    ...configFor(null),
    storageProfile: { backend: 'cloudflare', payloadAccessControl: { mode: 'worker_sbt_gate' } },
    __registry: { gatesByResource: { docUploads: { sbtAddresses: [`0x${'c'.repeat(40)}`], chainId: 84532, mode: 'all' } } },
  };
  delete gated.sessionModeProfile;
  const checks = [];
  const sbt = (holds) => ({
    resolveRpcUrlListForGate: () => ['https://rpc.example'],
    checkSbtGate: async ({ address }) => { checks.push(address); return holds; },
  });
  const ids = [];
  for (let index = 0; index < 12; index += 1) {
    ids.push(await upload(env, gated, ADMIN, { resource: 'docsContext', contentType: 'text/plain', data: `note ${index}` }, sbt(true)));
  }
  checks.length = 0;
  const held = await batch(env, gated, FIRST, ids, sbt(true));
  assert.deepEqual(held.map((item) => item.status), ids.map(() => 200));
  assert.deepEqual(checks, [FIRST]);
  // A refusal is not remembered: each item is refused with its own reason.
  checks.length = 0;
  const refused = await batch(env, gated, SECOND, ids, sbt(false));
  assert.deepEqual(refused.map((item) => [item.status, item.error]), ids.map(() => [403, 'Access denied: Cloudflare worker SBT gate failed.']));
  assert.equal(checks.length, ids.length, 'each refusal asks again');
});
