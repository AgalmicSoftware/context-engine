import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { ethers } from 'ethers';
import sessionCorsWorker from '../../workers/sessionCorsWorker/worker.js';
import { installSessionCoordinatorBinding } from '../helpers/sessionCorsWorkerTestUtils.mjs';
import { loadParticipantContextSources } from '../../workers/sessionCorsWorker/contextSourceLoader.js';
import { createParticipant } from '../../mcp/lib/participant.mjs';
import { createWorkerClient } from '../../mcp/lib/workerClient.mjs';

// End to end: agents using the Context Engine MCP participant layer against
// the real Session Worker, stored exactly like web-client participants.

const WORKER_ORIGIN = 'https://ce-town-hall.example.workers.dev';
const SLUG = 'town-hall';
const SESSION_ID = '0x00112233445566778899aabbccddeeff';
const LINK = `https://contextengine.sh/session/${SLUG}?worker=${encodeURIComponent(WORKER_ORIGIN)}`;
const STATEMENT = 'Every account should say plainly whether a human or an agent is writing.';

const publicProfile = (visibility = 'public_full_if_storage_public') => ({
  profileVersion: 1,
  preset: 'custom',
  authority: { mode: 'worker_canonical' },
  evm: { registryChainId: null },
  storage: { backend: 'cloudflare', payloadAccessControl: { gate: 'none', encryption: 'none' } },
  identity: { default: 'passkey', enabled: ['passkey'] },
  authorization: { mechanisms: ['worker_roles'] },
  encryption: { mode: 'none' },
  surfaces: { web: true, telegram: false, miniApp: false, agentHttp: false, mcp: false, ceCc: false },
  results: { visibility, exposure: { aggregateResultsEnabled: true, anonymizedGroupsEnabled: false, minGroupSize: 2 } },
  export: { scope: 'all_session' },
});

const sessionConfig = ({ slug = SLUG, sessionId = SESSION_ID, visibility } = {}) => ({
  slug,
  sessionId,
  sessionName: 'Town Hall',
  sessionInfo: 'What do residents owe each other?',
  sessionContext: {
    title: 'Context',
    paragraphs: ['Answer as yourself.'],
    links: [{ label: 'Essay', url: 'https://example.org/essay' }, { label: 'Plain', url: 'http://example.org/plain' }],
  },
  allowOrigins: ['http://localhost:3000', 'https://contextengine.sh'],
  workerAuthority: { version: 1, participantScopes: ['ai', 'transcribe', 'storage', 'groups', 'fetch'] },
  sessionModeProfile: publicProfile(visibility),
  storageProfile: {
    type: 'session_storage_profile',
    version: 'session-storage-profile-v1',
    backend: 'cloudflare',
    sessionOwned: true,
    resources: { docsContext: 'active', questions: 'active', surveys: 'active', responses: 'active' },
    payloadAccessControl: {
      gate: 'none',
      encryption: 'none',
      mode: 'public_read',
      enforcement: 'session_worker_public_read',
      litRequired: false,
      label: 'Public-read Cloudflare payloads',
    },
  },
  HIGHLIGHTED_QUESTION_IDS: [],
  BLOCKED_QUESTION_IDS: [],
});

const memoryKv = (seed = {}) => {
  const store = new Map(Object.entries(seed));
  return {
    store,
    // A key list is a bulk get, as in KV.
    async get(key) {
      if (Array.isArray(key)) return new Map(key.map((name) => [name, store.has(name) ? store.get(name) : null]));
      return store.has(key) ? store.get(key) : null;
    },
    async put(key, value) {
      store.set(key, value);
    },
    async delete(key) {
      store.delete(key);
    },
    async list({ prefix = '', cursor = '', limit = 1000 } = {}) {
      const names = [...store.keys()].filter((key) => key.startsWith(prefix)).sort();
      const start = cursor ? Number(cursor) : 0;
      const keys = names.slice(start, start + limit).map((name) => ({ name }));
      const done = start + keys.length >= names.length;
      return { keys, list_complete: done, cursor: done ? '' : String(start + keys.length) };
    },
  };
};

const createEnv = (configs) => {
  const seed = Object.fromEntries(configs.map((config) => [`session:${config.slug}:config`, JSON.stringify(config)]));
  return installSessionCoordinatorBinding({
    GROUP_KV: memoryKv(seed),
    CE_STORAGE_INDEX_KV: memoryKv(),
    TOKEN_HMAC_SECRET: 'agent-participant-test-secret',
  });
};

// Routes the agent's HTTP calls straight into the Worker.
const workerFetch = (env, seen = []) => async (url, init = {}) => {
  seen.push({ url: String(url), method: init.method || 'GET', origin: init.headers?.Origin || '' });
  const request = new Request(url, { method: init.method || 'GET', headers: init.headers, body: init.body });
  return sessionCorsWorker.fetch(request, env, { waitUntil: () => {}, passThroughOnException: () => {} });
};

const createAgent = async (env, displayName, seen, fetchImpl = null, { now, sbt, createProvider, wallet: existingWallet, stateDir: existingStateDir } = {}) => {
  const stateDir = existingStateDir || await fs.mkdtemp(path.join(os.tmpdir(), 'ce-agent-'));
  const wallet = existingWallet || ethers.Wallet.createRandom();
  const participant = createParticipant({
    ...(now ? { now } : {}),
    ...(sbt ? { sbt } : {}),
    ...(createProvider ? { createProvider } : {}),
    config: {
      stateDir,
      profile: { displayName, modelId: 'test-model', platform: 'test-harness' },
      appOrigin: 'https://contextengine.sh',
      trustedAppOrigins: ['https://contextengine.sh', 'https://www.contextengine.sh'],
      allowLocalWorkers: false,
    },
    wallet,
    fetchImpl: fetchImpl || workerFetch(env, seen),
  });
  return { participant, wallet, stateDir };
};

test('agents discover a hosted faucet and receive test ETH through the real Worker', async (t) => {
  const config = sessionConfig();
  config.networkChainId = 11155420;
  config.workerAuthority.participantScopes.push('faucet_self');
  const env = createEnv([config]);
  const faucet = ethers.Wallet.createRandom();
  const rpcUrl = 'https://faucet-rpc.example.test';
  await env.GROUP_KV.put(`session:${SLUG}:secrets`, JSON.stringify({ faucetPrivateKey: faucet.privateKey, customRpcUrl: rpcUrl }));
  let balance = ethers.constants.Zero;
  let recipient = '';
  let txHash = '';
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    assert.equal(url, rpcUrl);
    const body = JSON.parse(init.body);
    let result;
    if (body.method === 'eth_chainId') result = '0xaa37dc';
    else if (body.method === 'eth_getBalance') result = balance.toHexString();
    else if (body.method === 'eth_getTransactionCount') result = '0x0';
    else if (body.method === 'eth_gasPrice') result = '0x1';
    else if (body.method === 'eth_sendRawTransaction') {
      const transaction = ethers.utils.parseTransaction(body.params[0]);
      assert.equal(transaction.chainId, 11155420);
      assert.equal(transaction.from, faucet.address);
      recipient = transaction.to;
      balance = balance.add(transaction.value);
      txHash = ethers.utils.keccak256(body.params[0]);
      result = txHash;
    } else throw new Error(`Unexpected RPC method ${body.method}`);
    return new Response(JSON.stringify({ jsonrpc: '2.0', id: body.id, result }));
  });
  const { participant, wallet } = await createAgent(env, 'faucet-agent', [], null, {
    createProvider: () => ({ send: async () => 11155420, getBalance: async () => balance }),
  });
  const joined = await participant.joinSession({ link: LINK });
  assert.equal(joined.testEth.offered, true);
  assert.equal(joined.testEth.tokenHasFaucetScope, true);
  assert.equal((await participant.getSession()).testEth.offered, true);
  assert.equal((await participant.whoami()).sessions[0].testEth.offered, true);
  assert.deepEqual(await participant.requestTestEth(), {
    sent: true, txHash, amountEth: '0.0002', chainId: 11155420, balanceEth: '0.0002',
  });
  assert.equal(recipient, wallet.address);
});

// Stores a record with the Worker's own key layout, cloned from a real one of the same resource.
const plantRecord = (env, resource, payload, metaChanges = {}) => {
  const store = env.CE_STORAGE_INDEX_KV.store;
  const [indexKey, rawMeta] = [...store.entries()].find(([key]) => key.startsWith(`ce-storage:${SLUG}:${resource}:`));
  const meta = JSON.parse(rawMeta);
  const id = `${meta.id.slice(0, -6)}${Math.random().toString(36).slice(2, 8).padEnd(6, 'x')}`;
  const planted = { ...JSON.parse(JSON.stringify(meta).split(meta.id).join(id)), ...metaChanges };
  if (resource === 'questions') planted.resourceId = payload.id;
  store.set(indexKey.replace(meta.id, id), JSON.stringify(planted));
  store.set(
    `ce-storage-payload:${SLUG}:${id}`,
    JSON.stringify({ metadata: planted, payloadBase64url: Buffer.from(JSON.stringify(payload)).toString('base64url') }),
  );
  return id;
};

const storedRecords = (env, resource) =>
  [...env.CE_STORAGE_INDEX_KV.store.entries()]
    .filter(([key]) => key.includes(`:${resource}:`))
    .map(([, value]) => (typeof value === 'string' ? JSON.parse(value) : value));

test('first encrypted question uploads preserve the authorization checked before key initialization', async () => {
  const config = sessionConfig({ visibility: 'participant_aggregate' });
  const accessConditions = { match: 'any', conditions: [{ kind: 'agent_grant_scope', scope: 'storage' }] };
  config.sessionModeProfile.encryption = { mode: 'worker_envelope', keyProvider: 'worker_secret' };
  config.sessionModeProfile.storage.payloadAccessControl = { gate: 'role_gate', encryption: 'worker_envelope', accessConditions };
  config.storageProfile.payloadAccessControl = { gate: 'role_gate', encryption: 'worker_envelope', mode: 'worker_sbt_gate', accessConditions };
  const env = createEnv([config]);
  env.CE_STORAGE_ENVELOPE_KEK = 'synthetic-first-upload-envelope-key';
  const writers = await Promise.all(['first', 'second'].map(name => createAgent(env, `fixture-${name}`, [])));
  await Promise.all(writers.map(({ participant }) => participant.joinSession({ link: LINK })));
  const results = await Promise.all(writers.map(({ participant }, index) => participant.addStatement({ prompt: `Synthetic first encrypted statement ${index}` })));
  assert.ok(results.every(result => result.created));
  for (const { wallet } of writers) {
    const client = createWorkerClient({ workerOrigin: WORKER_ORIGIN, slug: SLUG, trustedOrigins: ['https://contextengine.sh'], wallet, fetchImpl: workerFetch(env) });
    const listed = await client.listAll('questions');
    assert.equal(listed.items.length, 2);
    for (const item of listed.items) assert.match((await client.read(item.storageRef.id)).prompt, /^Synthetic first encrypted statement/);
  }
});

test('agent answer uploads omit content digests and use fresh keys after success', async () => {
  const env = createEnv([sessionConfig()]);
  const uploads = [];
  const fetchWorker = workerFetch(env);
  const { participant } = await createAgent(env, 'synthetic-agent', [], async (url, init) => {
    if (new URL(url).pathname === '/storage/upload') {
      const body = JSON.parse(init.body);
      if (body.resource === 'responses') uploads.push(body);
    }
    return fetchWorker(url, init);
  });
  await participant.joinSession({ link: LINK });
  const first = await participant.addStatement({ prompt: 'Should the pilot run on weekdays?' });
  const second = await participant.addStatement({ prompt: 'Should the pilot run on weekends?' });
  const answers = [first, second].map(({ questionId }) => ({ questionId, value: 'Agree' }));
  assert.equal((await participant.answer({ answers })).submitted, 2);
  assert.ok(uploads.every(({ requestId }) => /^answer:v1:[^:]+:0x[a-f0-9]{64}$/.test(requestId)));
  assert.equal(uploads[0].requestId.split(':')[2], uploads[1].requestId.split(':')[2]);
  for (const upload of uploads) assert.equal(upload.requestId.includes(ethers.utils.sha256(ethers.utils.toUtf8Bytes(upload.data)).slice(2)), false);
  assert.equal((await participant.answer({ answers })).submitted, 2);
  assert.notEqual(uploads[0].requestId.split(':')[2], uploads[2].requestId.split(':')[2]);
});

test('agents join a public hosted session, add statements, answer, and read results like web participants', async () => {
  const env = createEnv([sessionConfig()]);
  const seen = [];
  const alice = await createAgent(env, 'alice.delve.town', seen);
  const bob = await createAgent(env, 'bob.delve.town', seen);

  const joined = await alice.participant.joinSession({ link: LINK });
  assert.equal(joined.signedIn, true);
  assert.equal(joined.resultsPublic, true);
  assert.ok(joined.scopes.includes('storage'));
  assert.deepEqual(joined.context.paragraphs, ['Answer as yourself.']);
  // The session page's reader: https links only.
  assert.deepEqual(joined.context.links, [{ label: 'Essay', url: 'https://example.org/essay' }]);
  // Sign-in carries the app origin; data calls send none, like a non-browser client.
  assert.ok(seen.filter((call) => call.url.includes('/auth/')).every((call) => call.origin === 'https://contextengine.sh'));
  assert.ok(seen.filter((call) => call.url.includes('/storage/')).every((call) => call.origin === ''));

  const created = await alice.participant.addStatement({ prompt: STATEMENT });
  assert.equal(created.created, true);
  await bob.participant.joinSession({ link: LINK });
  const duplicate = await bob.participant.addStatement({ prompt: `  ${STATEMENT.toUpperCase()} ` });
  assert.deepEqual({ created: duplicate.created, alreadyExists: duplicate.alreadyExists, questionId: duplicate.questionId }, {
    created: false,
    alreadyExists: true,
    questionId: created.questionId,
  });

  const open = await bob.participant.listQuestions();
  assert.equal(open.total, 1);
  assert.equal(open.questions[0].id, created.questionId);
  assert.equal(open.questions[0].authoredBySelfDeclaredAgent, true);

  const bobAnswer = await bob.participant.answer({ answers: [{ questionId: created.questionId, value: 'agree', comment: 'Labels help.' }] });
  assert.equal(bobAnswer.submitted, 1);
  await alice.participant.answer({ answers: [{ questionId: created.questionId, value: 'Disagree' }] });
  const changed = await alice.participant.answer({ answers: [{ questionId: created.questionId, value: 'Unsure', conviction: 4 }] });
  assert.equal(changed.submitted, 1);
  const rejected = await alice.participant.answer({ answers: [{ questionId: created.questionId, value: 'maybe' }, { questionId: '0xnope', value: 'Agree' }] });
  assert.equal(rejected.failed, 2);

  const mine = await alice.participant.listQuestions({ filter: 'answered' });
  assert.equal(mine.questions[0].myAnswer.value, 'Unsure');

  const results = await bob.participant.getResults();
  assert.equal(results.participants, 2);
  assert.deepEqual(results.questions[0].counts, { Agree: 1, Unsure: 1, Disagree: 0 });
  assert.equal(results.questions[0].selfDeclaredAgents, 2);

  // The Worker stored client-shaped records attributed to each agent's own address.
  const responseRows = storedRecords(env, 'responses').filter((row) => row.resource === 'responses');
  assert.equal(responseRows.length, 3);
  assert.deepEqual(
    new Set(responseRows.map((row) => row.responder)),
    new Set([alice.wallet.address.toLowerCase(), bob.wallet.address.toLowerCase()]),
  );
  const session = await bob.participant.getSession();
  assert.equal(session.questions, 1);
  assert.equal(session.answeredByMe, 1);
});

test("agents read a session's uploaded HTML context as its words, not its markup", async () => {
  const html = '<h2>Atlas</h2><details><summary>Trust</summary><p>Who decides?</p></details><script>x()</script>';
  const config = sessionConfig();
  const env = createEnv([{ ...config, sessionContext: { title: 'Context', html, paragraphs: [], links: [] } }]);
  const alice = await createAgent(env, 'alice.delve.town', []);
  const joined = await alice.participant.joinSession({ link: LINK });
  assert.deepEqual(joined.context, { title: 'Context', paragraphs: ['Atlas\nTrust\nWho decides?'], links: [] });

  // A page of pictures alone has no words, so agents get no paragraph rather than an empty one.
  const pictures = '<img src="https://example.org/map.png" alt="">';
  const bare = createEnv([{ ...config, sessionContext: { title: 'Context', html: pictures, paragraphs: [], links: [] } }]);
  const bob = await createAgent(bare, 'bob.delve.town', []);
  const seen = await bob.participant.joinSession({ link: LINK });
  assert.deepEqual(seen.context, { title: 'Context', paragraphs: [], links: [] });
});

test('agents sign in again when their session token is revoked', async () => {
  const env = createEnv([sessionConfig()]);
  const { participant } = await createAgent(env, 'carol', []);
  await participant.joinSession({ link: LINK });
  const { questionId } = await participant.addStatement({ prompt: 'Posting limits should be the same for humans and agents.' });
  for (const key of [...env.GROUP_KV.store.keys()]) if (key.startsWith('authToken:')) env.GROUP_KV.store.delete(key);
  const answered = await participant.answer({ answers: [{ questionId, value: 'Agree' }] });
  assert.equal(answered.submitted, 1);
});

test('sessions without public results only show an agent its own answers', async () => {
  const env = createEnv([sessionConfig({ visibility: 'participant_aggregate' })]);
  const { participant } = await createAgent(env, 'dave', []);
  await participant.joinSession({ link: LINK });
  const results = await participant.getResults();
  assert.equal(results.resultsPublic, false);
});

test('joining checks the Worker’s session identity', async () => {
  const env = createEnv([sessionConfig()]);
  const { participant } = await createAgent(env, 'erin', []);
  await assert.rejects(
    participant.joinSession({ link: `https://contextengine.sh/session/missing?worker=${encodeURIComponent(WORKER_ORIGIN)}` }),
    /No hosted session with that name/,
  );
});

test('agents sign in only as a trusted Context Engine origin, whatever the link or Worker suggests', async () => {
  const env = createEnv([sessionConfig()]);
  const seen = [];
  const { participant } = await createAgent(env, 'frank', seen);
  const outcome = await participant.joinSession({
    link: `https://app.third-party.example/session/${SLUG}?worker=${encodeURIComponent(WORKER_ORIGIN)}`,
  });
  assert.equal(outcome.signedIn, true);
  assert.ok(outcome.webUrl.startsWith('https://contextengine.sh/session/'));
  assert.ok(seen.filter((call) => call.url.includes('/auth/')).every((call) => call.origin === 'https://contextengine.sh'));

  const thirdParty = createEnv([{ ...sessionConfig(), allowOrigins: ['https://app.third-party.example'] }]);
  const { participant: other } = await createAgent(thirdParty, 'gina', []);
  await assert.rejects(other.joinSession({ link: LINK }), /only allows sign-in from other web apps/);
});

test('agents refuse Worker redirects', async () => {
  const env = createEnv([sessionConfig()]);
  const redirecting = async (url, init = {}) => {
    assert.equal(init.redirect, 'error');
    return new Response(null, { status: 307, headers: { Location: 'http://127.0.0.1:9/internal' } });
  };
  const { participant } = await createAgent(env, 'hal', [], redirecting);
  await assert.rejects(participant.joinSession({ link: LINK }), /redirect/);
});

test('malformed records from another participant do not break the agent tools', async () => {
  const env = createEnv([sessionConfig()]);
  const { participant: author } = await createAgent(env, 'author', []);
  await author.joinSession({ link: LINK });
  const { questionId } = await author.addStatement({ prompt: 'A normal statement.' });
  await author.answer({ answers: [{ questionId, value: 'Agree' }] });

  // Plant hostile records with the Worker's own key layout, cloned from real ones.
  const store = env.CE_STORAGE_INDEX_KV.store;
  const plant = (resource, payload) => {
    const [indexKey, rawMeta] = [...store.entries()].find(([key]) => key.startsWith(`ce-storage:${SLUG}:${resource}:`));
    const meta = JSON.parse(rawMeta);
    const id = `${meta.id.slice(0, -4)}${meta.id.endsWith('zzzz') ? 'yyyy' : 'zzzz'}`;
    const planted = JSON.parse(JSON.stringify(meta).split(meta.id).join(id));
    if (resource === 'questions') planted.resourceId = payload.id;
    store.set(indexKey.replace(meta.id, id), JSON.stringify(planted));
    store.set(
      `ce-storage-payload:${SLUG}:${id}`,
      JSON.stringify({ metadata: planted, payloadBase64url: Buffer.from(JSON.stringify(payload)).toString('base64url') }),
    );
    return id;
  };
  plant('questions', { id: `0x${'9'.repeat(64)}`, type: 'multichoice', prompt: 'Broken', options: [7, { toString: 1 }], sessionSlug: SLUG, sessionId: SESSION_ID });
  plant('responses', { questionID: questionId, sessionSlug: { toString: 1, valueOf: 1 }, sessionId: SESSION_ID, answer: { value: 'constructor' } });

  const { participant } = await createAgent(env, 'reader', []);
  await participant.joinSession({ link: LINK });
  const listed = await participant.listQuestions({ filter: 'all' });
  assert.deepEqual(
    listed.questions.map((question) => question.id).sort(),
    [questionId, `0x${'9'.repeat(64)}`].sort(),
    'the planted question is read (its bad options are ignored) alongside the real one',
  );
  const answered = await participant.answer({ answers: [{ questionId, value: 'Disagree' }] });
  assert.equal(answered.submitted, 1);
  const results = await participant.getResults();
  const summary = results.questions.find((question) => question.questionId === questionId);
  assert.deepEqual(summary.counts, { Agree: 1, Unsure: 0, Disagree: 1 });
});

test('agents page through more than 100 statements and answers', async () => {
  const env = createEnv([sessionConfig()]);
  const { participant } = await createAgent(env, 'pager', []);
  await participant.joinSession({ link: LINK });
  const ids = [];
  for (let index = 0; index < 120; index += 1) ids.push((await participant.addStatement({ prompt: `Statement number ${index}.` })).questionId);
  for (let offset = 0; offset < 105; offset += 25) {
    const batch = ids.slice(offset, Math.min(offset + 25, 105)).map((questionId) => ({ questionId, value: 'Agree' }));
    assert.equal((await participant.answer({ answers: batch })).failed, 0);
  }
  const listed = await participant.listQuestions({ filter: 'unanswered', limit: 100 });
  assert.equal(listed.total, 120);
  assert.equal(listed.answeredByMe, 105);
  assert.equal(listed.matching, 15);
  const results = await participant.getResults();
  assert.equal(results.questions.filter((question) => question.responses === 1).length, 105);
  assert.equal(results.participants, 1);
});

test('locked questions are listed as locked and cannot be answered', async () => {
  const env = createEnv([sessionConfig()]);
  const { participant } = await createAgent(env, 'locksmith', []);
  await participant.joinSession({ link: LINK });
  await participant.addStatement({ prompt: 'An open statement.' });
  const lockedId = `0x${'7'.repeat(64)}`;
  plantRecord(env, 'questions', {
    id: lockedId, type: 'binary', prompt: '[encrypted]', promptEncrypted: { ciphertext: 'x' }, encryption: { gates: [{ id: 'g' }] },
    sessionSlug: SLUG, sessionId: SESSION_ID,
  });
  const listed = await participant.listQuestions({ filter: 'all' });
  assert.equal(listed.total, 1);
  assert.equal(listed.lockedQuestions, 1);
  const answered = await participant.answer({ answers: [{ questionId: lockedId, value: 'Agree' }] });
  assert.equal(answered.failed, 1);
  assert.equal(storedRecords(env, 'responses').filter((row) => row.resource === 'responses').length, 0);
});

test('an earlier stored version wins even when a later upload hashes to either id encoding', async () => {
  const env = createEnv([sessionConfig()]);
  const { participant: author } = await createAgent(env, 'author', []);
  await author.joinSession({ link: LINK });
  await author.addStatement({ prompt: 'A seed statement.' });
  const genuine = { type: 'multichoice', prompt: 'Which budget?', options: ['$1,000', '$2,000'], sessionSlug: SLUG, sessionId: SESSION_ID };
  // The legacy id published for these comma options, and the id they get now.
  const ids = [
    ethers.utils.id('multichoice:which budget?:$1,000,$2,000'),
    ethers.utils.id('["ce-question-id",2,"multichoice","which budget?",["$1,000","$2,000"],false]'),
  ];
  for (const id of ids) {
    plantRecord(env, 'questions', { ...genuine, id, prompt: 'Rewritten budget?' }, { createdAt: '2026-01-01T00:00:00.000Z', uploaderIsAdmin: false });
    plantRecord(env, 'questions', { ...genuine, id }, { createdAt: '2026-02-01T00:00:00.000Z', uploaderIsAdmin: false });
  }
  const { participant } = await createAgent(env, 'reader', []);
  await participant.joinSession({ link: LINK });
  const { questions } = await participant.listQuestions({ filter: 'all' });
  for (const id of ids) assert.equal(questions.find((question) => question.id === id)?.prompt, 'Rewritten budget?');
});

test('a long-running agent picks up admin changes to the session', async () => {
  const env = createEnv([sessionConfig()]);
  let clock = Date.now();
  const { participant } = await createAgent(env, 'steady', [], null, { now: () => clock });
  await participant.joinSession({ link: LINK });
  const { questionId } = await participant.addStatement({ prompt: 'Soon to be blocked.' });
  assert.equal((await participant.getResults()).resultsPublic, true);
  const changed = { ...sessionConfig({ visibility: 'participant_aggregate' }), BLOCKED_QUESTION_IDS: [questionId] };
  env.GROUP_KV.store.set(`session:${SLUG}:config`, JSON.stringify(changed));
  clock += 31_000;
  assert.equal((await participant.listQuestions({ filter: 'all' })).total, 0);
  assert.equal((await participant.getResults()).resultsPublic, false);
  assert.equal((await participant.answer({ answers: [{ questionId, value: 'Agree' }] })).failed, 1);
});

test('results count only participants with a valid answer, and cleared answers drop out', async () => {
  const env = createEnv([sessionConfig()]);
  const alice = await createAgent(env, 'alice', []);
  const bob = await createAgent(env, 'bob', []);
  await alice.participant.joinSession({ link: LINK });
  await bob.participant.joinSession({ link: LINK });
  const { questionId } = await alice.participant.addStatement({ prompt: 'Count me once.' });
  await alice.participant.answer({ answers: [{ questionId, value: 'Agree' }] });
  await bob.participant.answer({ answers: [{ questionId, value: 'Disagree' }] });
  // Bob clears his answer the way the web client does: a newer record with ''.
  plantRecord(env, 'responses', { questionID: questionId, sessionSlug: SLUG, sessionId: SESSION_ID, answer: { value: '' } }, {
    responder: bob.wallet.address.toLowerCase(),
    createdAt: '2999-01-01T00:00:00.000Z',
  });
  const results = await alice.participant.getResults();
  assert.equal(results.participants, 1);
  assert.deepEqual(results.questions[0].counts, { Agree: 1, Unsure: 0, Disagree: 0 });
});

test('a statement an admin hid is not reported as already existing', async () => {
  const env = createEnv([sessionConfig()]);
  const { participant: author } = await createAgent(env, 'author', []);
  const { participant: other } = await createAgent(env, 'other', []);
  await author.joinSession({ link: LINK });
  await other.joinSession({ link: LINK });
  const { questionId } = await author.addStatement({ prompt: 'Hide me.' });
  const store = env.CE_STORAGE_INDEX_KV.store;
  const [indexKey, rawMeta] = [...store.entries()].find(([key, value]) => key.startsWith(`ce-storage:${SLUG}:questions:`) && value.includes(questionId));
  store.set(indexKey, JSON.stringify({ ...JSON.parse(rawMeta), hidden: true }));
  await assert.rejects(other.addStatement({ prompt: 'Hide me.' }), /not available to participants/);
  const again = await author.addStatement({ prompt: 'A visible one.' });
  const duplicate = await other.addStatement({ prompt: 'A visible one.' });
  assert.equal(duplicate.alreadyExists, true);
  assert.equal(duplicate.questionId, again.questionId);
});

test('duplicate answers in one call are refused', async () => {
  const env = createEnv([sessionConfig()]);
  const { participant } = await createAgent(env, 'twice', []);
  await participant.joinSession({ link: LINK });
  const { questionId } = await participant.addStatement({ prompt: 'Once only.' });
  const result = await participant.answer({ answers: [{ questionId, value: 'Agree' }, { questionId, value: 'Disagree' }] });
  assert.equal(result.submitted, 1);
  assert.match(result.results[1].error, /more than once/);
});

test('a refused sign-in ends the join before any SBT claim', async () => {
  const gated = { ...sessionConfig(), workerAuthority: { version: 1, participantScopes: ['storage'], loginGate: { match: 'any', conditions: [{ kind: 'worker_role', role: 'admin' }] } } };
  const env = createEnv([gated]);
  const claims = [];
  const sbt = { claim: async (input) => { claims.push(input); return { status: 'claimed' }; } };
  const { participant } = await createAgent(env, 'outsider', [], null, { sbt });
  const link = `${LINK}&sbt=0x00000000000000000000000000000000000000aa&inv=code&auto=1`;
  await assert.rejects(participant.joinSession({ link }), /Not allowed/);
  assert.equal(claims.length, 0);
});

test('a 401 that is not about the token is reported as it is, without signing in again', async () => {
  const faucetSession = { ...sessionConfig(), workerAuthority: { version: 1, participantScopes: ['storage', 'faucet'] } };
  const env = createEnv([faucetSession]);
  const seen = [];
  const wallet = ethers.Wallet.createRandom();
  const client = createWorkerClient({
    workerOrigin: WORKER_ORIGIN,
    slug: SLUG,
    trustedOrigins: ['https://contextengine.sh'],
    wallet,
    fetchImpl: workerFetch(env, seen),
  });
  await client.login();
  // This session has no Worker secrets, so the faucet action is refused with a 401.
  await assert.rejects(
    client.request('/', { method: 'POST', auth: true, headers: { 'X-Session-Slug': SLUG }, body: { action: 'request_test_eth', to: wallet.address } }),
    (error) => {
      assert.equal(error.status, 401);
      assert.match(error.message, /secrets/i);
      assert.doesNotMatch(error.message, /Sign-in expired/);
      return true;
    },
  );
  assert.equal(seen.filter((call) => call.url.endsWith('/auth/login')).length, 1);
});

test('sessions whose config uses a UUID session id can be joined', async () => {
  const uuid = '00112233-4455-6677-8899-aabbccddeeff';
  const env = createEnv([{ ...sessionConfig(), sessionId: uuid }]);
  const { participant } = await createAgent(env, 'uuid', []);
  const joined = await participant.joinSession({ link: LINK });
  assert.equal(joined.signedIn, true);
  const { questionId } = await participant.addStatement({ prompt: 'UUID sessions work.' });
  assert.equal((await participant.answer({ answers: [{ questionId, value: 'Agree' }] })).submitted, 1);
});

test('Worker own-answer scans remain complete while the cached listing precedes a new answer', async () => {
  const env = createEnv([sessionConfig()]);
  const fetch = workerFetch(env);
  let ownReads = 0;
  const { participant } = await createAgent(env, 'own-scan-cache', [], async (url, init) => {
    const parsed = new URL(url);
    if (parsed.pathname === '/storage/list' && parsed.searchParams.get('resource') === 'responses') {
      ownReads++;
      return Response.json({ items: [], listComplete: true, cursor: null });
    }
    return fetch(url, init);
  });
  await participant.joinSession({ link: LINK });
  const { questionId } = await participant.addStatement({ prompt: 'A newly saved answer stays complete.' });
  assert.notEqual((await participant.listQuestions({ filter: 'all' })).myAnswersComplete, false);
  assert.equal((await participant.answer({ answers: [{ questionId, value: 'Agree' }] })).submitted, 1);
  const listed = await participant.listQuestions({ filter: 'all' });
  const before = ownReads;
  const cached = await participant.listQuestions({ filter: 'all' });
  assert.equal(ownReads, before, 'The own-answer scan is still cached');
  assert.notEqual(cached.myAnswersComplete, false);
  assert.equal(listed.answeredByMe, 1);
  assert.equal(listed.questions[0].myAnswer.value, 'Agree');
  assert.notEqual(listed.myAnswersComplete, false);
  assert.doesNotMatch(listed.note || '', /large/);
});

test('own answers are found by paging the Worker alone, without the local record', async () => {
  const env = createEnv([sessionConfig()]);
  const first = await createAgent(env, 'paged', []);
  await first.participant.joinSession({ link: LINK });
  const ids = [];
  for (let index = 0; index < 110; index += 1) ids.push((await first.participant.addStatement({ prompt: `Paged statement ${index}.` })).questionId);
  for (let offset = 0; offset < 105; offset += 25) {
    await first.participant.answer({ answers: ids.slice(offset, Math.min(offset + 25, 105)).map((questionId) => ({ questionId, value: 'Unsure' })) });
  }
  // Same key, fresh state directory: only the Worker listing can know the answers.
  const second = await createAgent(env, 'paged', [], null, { wallet: first.wallet });
  await second.participant.joinSession({ link: LINK });
  const listed = await second.participant.listQuestions({ filter: 'all', limit: 1 });
  assert.equal(listed.total, 110);
  assert.equal(listed.answeredByMe, 105);
});

test('malformed question fields from another participant cannot break listing, results, or other answers', async () => {
  const env = createEnv([sessionConfig()]);
  const { participant } = await createAgent(env, 'sturdy', []);
  await participant.joinSession({ link: LINK });
  const { questionId } = await participant.addStatement({ prompt: 'A sturdy statement.' });
  const hostile = { toString: 1, valueOf: 1 };
  const ratingId = `0x${'5'.repeat(64)}`;
  const choiceId = `0x${'6'.repeat(64)}`;
  plantRecord(env, 'questions', { id: ratingId, type: 'rating', prompt: 'Rate', scale: { min: hostile, max: 10 }, maxLabel: hostile, sessionSlug: SLUG, sessionId: SESSION_ID });
  plantRecord(env, 'questions', { id: choiceId, type: 'multichoice', prompt: 'Pick', options: ['a', 'b'], maxSelections: hostile, voiceCredits: hostile, sessionSlug: SLUG, sessionId: SESSION_ID });
  const listed = await participant.listQuestions({ filter: 'all' });
  assert.equal(listed.total, 3);
  const results = await participant.getResults();
  assert.equal(results.questions.length, 3);
  const answered = await participant.answer({
    answers: [
      { questionId, value: 'Agree' },
      { questionId: choiceId, value: ['a'] },
      { questionId: ratingId, value: 5 },
    ],
  });
  assert.equal(answered.results[0].ok, true);
  assert.equal(answered.submitted + answered.failed, 3);
});

// The Worker is reset and now serves a different session under the same slug.
const serveAnotherSession = (env) => {
  const fresh = createEnv([sessionConfig({ sessionId: '0xffeeddccbbaa99887766554433221100' })]);
  env.CE_SESSION_COORDINATOR = fresh.CE_SESSION_COORDINATOR;
  for (const kv of ['GROUP_KV', 'CE_STORAGE_INDEX_KV']) {
    env[kv].store.clear();
    for (const [key, value] of fresh[kv].store) env[kv].store.set(key, value);
  }
};

test('a session that changes identity behind the same link does not reuse remembered answers', async () => {
  const env = createEnv([sessionConfig()]);
  const { participant } = await createAgent(env, 'mover', []);
  await participant.joinSession({ link: LINK });
  const { questionId } = await participant.addStatement({ prompt: 'Same words, new session.' });
  await participant.answer({ answers: [{ questionId, value: 'Agree' }] });
  serveAnotherSession(env);
  await participant.joinSession({ link: LINK });
  const again = await participant.addStatement({ prompt: 'Same words, new session.' });
  assert.equal(again.created, true);
  const listed = await participant.listQuestions({ filter: 'all' });
  assert.equal(listed.answeredByMe, 0);
});

test('an agent restarted after its session changed identity is asked to join again', async (t) => {
  const env = createEnv([sessionConfig()]);
  const first = await createAgent(env, 'mover', []);
  t.after(() => fs.rm(first.stateDir, { recursive: true, force: true }));
  await first.participant.joinSession({ link: LINK });
  serveAnotherSession(env);
  const restarted = await createAgent(env, 'mover', [], null, { wallet: first.wallet, stateDir: first.stateDir });
  for (const session of [undefined, SLUG, LINK]) {
    await assert.rejects(restarted.participant.getSession({ session }), /The session behind this link changed identity; join it again\./);
  }
  await restarted.participant.joinSession({ link: LINK });
  assert.equal((await restarted.participant.getSession()).session, SLUG);
});

test('a stopped answer call sends nothing', async () => {
  const env = createEnv([sessionConfig()]);
  const { participant } = await createAgent(env, 'stopper', []);
  await participant.joinSession({ link: LINK });
  const { questionId } = await participant.addStatement({ prompt: 'Not answered.' });
  const stopped = new AbortController();
  stopped.abort();
  const result = await participant.answer({ answers: [{ questionId, value: 'Agree' }] }, { signal: stopped.signal });
  assert.equal(result.submitted, 0);
  assert.equal(storedRecords(env, 'responses').filter((row) => row.resource === 'responses').length, 0);
});

test('a hosted answer remains submitted when saving its local history fails after upload', async (t) => {
  const env = createEnv([sessionConfig()]);
  let agent;
  const fetchWorker = workerFetch(env);
  agent = await createAgent(env, 'state-fixture', [], async (url, init) => {
    const response = await fetchWorker(url, init);
    if (new URL(url).pathname === '/storage/upload' && JSON.parse(init.body).resource === 'responses') {
      await fs.rename(path.join(agent.stateDir, 'state.json'), path.join(agent.stateDir, 'state.saved.json'));
      await fs.mkdir(path.join(agent.stateDir, 'state.json'));
    }
    return response;
  });
  t.after(() => fs.rm(agent.stateDir, { recursive: true, force: true }));
  await agent.participant.joinSession({ link: LINK });
  const { questionId } = await agent.participant.addStatement({ prompt: STATEMENT });
  const result = await agent.participant.answer({ answers: [{ questionId, value: 'Agree' }] });
  assert.equal(result.submitted, 1);
  assert.equal(result.failed, 0);
  assert.match(result.warning, /submitted.*local answer history.*not.*saved/i);
});


test('a timed-out answer reuses its persisted request after an agent restart', async (t) => {
  const env = createEnv([sessionConfig()]);
  const fetchWorker = workerFetch(env);
  let agent;
  let loseReply = true;
  const uploads = [];
  const fetchImpl = async (url, init) => {
    const body = init.body ? JSON.parse(init.body) : {};
    if (new URL(url).pathname === '/storage/upload' && body.resource === 'responses') {
      uploads.push(body);
      const saved = JSON.parse(await fs.readFile(path.join(agent.stateDir, 'state.json'), 'utf8'));
      const pending = Object.values(saved.sessions)[0].pendingUploads?.[JSON.parse(body.data).questionID];
      assert.equal(pending?.requestId, body.requestId, 'the retry key is durable before sending');
      assert.equal(pending?.payloadDigest, ethers.utils.sha256(ethers.utils.toUtf8Bytes(body.data)).slice(2));
      const result = await fetchWorker(url, init);
      if (loseReply) { loseReply = false; throw new DOMException('Timed out', 'TimeoutError'); }
      return result;
    }
    return fetchWorker(url, init);
  };
  agent = await createAgent(env, 'retry-fixture', [], fetchImpl);
  t.after(() => fs.rm(agent.stateDir, { recursive: true, force: true }));
  await agent.participant.joinSession({ link: LINK });
  const { questionId } = await agent.participant.addStatement({ prompt: STATEMENT });
  const answers = [{ questionId, value: 'Agree' }];
  assert.equal((await agent.participant.answer({ answers })).failed, 1);
  assert.equal(storedRecords(env, 'responses').length, 1);
  const restarted = await createAgent(env, 'retry-fixture', [], fetchImpl, { wallet: agent.wallet, stateDir: agent.stateDir });
  assert.equal((await restarted.participant.answer({ answers })).submitted, 1);
  assert.equal(uploads[0].requestId, uploads[1].requestId);
  assert.equal(storedRecords(env, 'responses').length, 1);
  const saved = JSON.parse(await fs.readFile(path.join(agent.stateDir, 'state.json'), 'utf8'));
  assert.deepEqual(Object.values(saved.sessions)[0].pendingUploads, {});
  assert.equal((await restarted.participant.answer({ answers })).submitted, 1);
  assert.notEqual(uploads[1].requestId, uploads[2].requestId);
  assert.equal(storedRecords(env, 'responses').length, 2);
});


test('an answer is not sent when its retry key cannot be persisted', async (t) => {
  const env = createEnv([sessionConfig()]);
  const agent = await createAgent(env, 'state-fixture');
  t.after(() => fs.rm(agent.stateDir, { recursive: true, force: true }));
  await agent.participant.joinSession({ link: LINK });
  const { questionId } = await agent.participant.addStatement({ prompt: STATEMENT });
  await fs.rename(path.join(agent.stateDir, 'state.json'), path.join(agent.stateDir, 'state.saved.json'));
  await fs.mkdir(path.join(agent.stateDir, 'state.json'));
  const result = await agent.participant.answer({ answers: [{ questionId, value: 'Agree' }] });
  assert.equal(result.submitted, 0);
  assert.equal(result.failed, 1);
  assert.equal(storedRecords(env, 'responses').length, 0);
});

for (const value of ['Disagree', '']) test(`an unread newer ${value || 'cleared'} answer keeps MCP results and own answers incomplete`, async (t) => {
  const env = createEnv([sessionConfig()]);
  const author = await createAgent(env, 'synthetic-author', []);
  t.after(() => fs.rm(author.stateDir, { recursive: true, force: true }));
  await author.participant.joinSession({ link: LINK });
  const { questionId } = await author.participant.addStatement({ prompt: 'Synthetic read-recovery statement.' });
  await author.participant.answer({ answers: [{ questionId, value: 'Agree' }] });
  const newerId = plantRecord(env, 'responses', {
    questionID: questionId, sessionSlug: SLUG, sessionId: SESSION_ID, type: 'binary', answer: { value }, additional: { value: '' },
  }, { createdAt: new Date(Date.now() + 5000).toISOString() });
  let unread = true;
  let reads = 0;
  let now = Date.now();
  const fetchWorker = workerFetch(env);
  const reader = await createAgent(env, 'synthetic-reader', [], async (url, init) => {
    if (new URL(url).pathname === '/storage/read' && new URL(url).searchParams.get('id') === newerId) {
      reads++;
      if (unread) return Response.json({ error: 'Payload is not available yet.' }, { status: 404 });
    }
    return fetchWorker(url, init);
  }, { wallet: author.wallet, now: () => now });
  t.after(() => fs.rm(reader.stateDir, { recursive: true, force: true }));
  await reader.participant.joinSession({ link: LINK });
  for (let attempt = 0; attempt < 2; attempt++) {
    const result = await reader.participant.getResults();
    assert.equal(result.partial, true);
    assert.equal(result.unreadAnswers, 1);
    assert.deepEqual(result.questions[0].counts, { Agree: 1, Unsure: 0, Disagree: 0 });
    const own = await reader.participant.listQuestions({ filter: 'all' });
    assert.equal(own.myAnswersComplete, false);
    assert.equal(own.unreadMyAnswers, 1);
    assert.equal(own.questions[0].myAnswer.value, 'Agree');
  }
  assert.equal(reads, 1, 'the negative-cache minute remains incomplete without another request');
  unread = false;
  now += 60001;
  const result = await reader.participant.getResults();
  assert.equal(result.partial, false);
  assert.equal(result.unreadAnswers, 0);
  assert.deepEqual(result.questions[0].counts, { Agree: 0, Unsure: 0, Disagree: value ? 1 : 0 });
  const own = await reader.participant.listQuestions({ filter: 'all' });
  assert.notEqual(own.myAnswersComplete, false);
  assert.equal(own.answeredByMe, value ? 1 : 0);
  if (value) assert.equal(own.questions[0].myAnswer.value, value);
});

test('a listed unread question is incomplete until its payload can be read', async (t) => {
  const env = createEnv([sessionConfig()]);
  let now = Date.now();
  const author = await createAgent(env, 'synthetic-author', []);
  t.after(() => fs.rm(author.stateDir, { recursive: true, force: true }));
  await author.participant.joinSession({ link: LINK });
  await author.participant.addStatement({ prompt: 'Synthetic readable statement.' });
  const id = plantRecord(env, 'questions', { id: ethers.utils.id('unread-question'), sessionSlug: SLUG, sessionId: SESSION_ID, type: 'binary', prompt: 'Synthetic delayed statement.' });
  let unread = true;
  const fetchWorker = workerFetch(env);
  const reader = await createAgent(env, 'synthetic-reader', [], async (url, init) => {
    if (unread && new URL(url).pathname === '/storage/read' && new URL(url).searchParams.get('id') === id) return Response.json({}, { status: 404 });
    return fetchWorker(url, init);
  }, { now: () => now });
  t.after(() => fs.rm(reader.stateDir, { recursive: true, force: true }));
  await reader.participant.joinSession({ link: LINK });
  for (let attempt = 0; attempt < 2; attempt++) {
    const listed = await reader.participant.listQuestions({ filter: 'all' });
    assert.equal(listed.questionsComplete, false);
    assert.equal(listed.unreadQuestions, 1);
    assert.equal(listed.total, 1);
    assert.equal((await reader.participant.getResults()).partial, true);
  }
  unread = false;
  now += 60001;
  const listed = await reader.participant.listQuestions({ filter: 'all' });
  assert.notEqual(listed.questionsComplete, false);
  assert.equal(listed.total, 2);
});

test('excluded and malformed payloads do not count as unread MCP records', async (t) => {
  const env = createEnv([sessionConfig()]);
  const { participant, stateDir } = await createAgent(env, 'synthetic-reader', []);
  t.after(() => fs.rm(stateDir, { recursive: true, force: true }));
  await participant.joinSession({ link: LINK });
  const { questionId } = await participant.addStatement({ prompt: 'Synthetic readable statement.' });
  await participant.answer({ answers: [{ questionId, value: 'Agree' }] });
  plantRecord(env, 'responses', { questionID: questionId, sessionSlug: 'another-session', sessionId: SESSION_ID, answer: { value: 'Disagree' } });
  plantRecord(env, 'responses', null);
  const hidden = plantRecord(env, 'questions', { id: ethers.utils.id('hidden'), sessionSlug: SLUG, type: 'binary', prompt: 'Synthetic hidden statement.' }, { hidden: true });
  env.CE_STORAGE_INDEX_KV.store.delete(`ce-storage-payload:${SLUG}:${hidden}`);
  plantRecord(env, 'questions', { id: ethers.utils.id('malformed'), sessionSlug: SLUG });
  const result = await participant.getResults();
  assert.equal(result.partial, false);
  assert.equal(result.unreadAnswers, 0);
  assert.equal(result.questions.length, 1);
  assert.deepEqual(result.questions[0].counts, { Agree: 1, Unsure: 0, Disagree: 0 });
});

test('cancellation while persisting an answer retry key prevents its upload', async t => {
  const env = createEnv([sessionConfig()]);
  const seen = [];
  const agent = await createAgent(env, 'Fixture', seen);
  t.after(() => fs.rm(agent.stateDir, { recursive: true, force: true }));
  await agent.participant.joinSession({ link: LINK });
  const statement = await agent.participant.addStatement({ prompt: STATEMENT });
  const controller = new AbortController();
  const rename = fs.rename.bind(fs);
  t.mock.method(fs, 'rename', async (from, to) => {
    await rename(from, to);
    if (to === path.join(agent.stateDir, 'state.json')) {
      const saved = JSON.parse(await fs.readFile(to, 'utf8'));
      if (Object.values(saved.sessions).some(session => Object.keys(session.pendingUploads || {}).length)) controller.abort();
    }
  });
  const uploadsBefore = seen.filter(call => new URL(call.url).pathname === '/storage/upload').length;
  const result = await agent.participant.answer({ answers: [{ questionId: statement.questionId, value: 'Agree' }] }, { signal: controller.signal });
  assert.equal(result.submitted, 0);
  assert.match(result.results[0].error, /Stopped/);
  assert.equal(seen.filter(call => new URL(call.url).pathname === '/storage/upload').length, uploadsBefore);
});

// Normal links, context, groups and the session's own instructions.

const SITE = 'https://contextengine.sh';
const NORMAL_LINK = `${SITE}/session/${SLUG}`;
const LIST_URL = `${SITE}/known-sessions.json`;

// The agent's network: the site's /known-sessions.json from `list`, the Worker for the rest.
const siteFetch = (env, list, seen = []) => {
  const worker = workerFetch(env, seen);
  return async (url, init = {}) => {
    if (new URL(url).origin !== SITE) return worker(url, init);
    seen.push({ url: String(url), method: init.method || 'GET', origin: '' });
    return list(url, init);
  };
};
const listing = (entries) => async (url) =>
  new URL(url).pathname === '/known-sessions.json' ? Response.json(entries) : new Response('Not found', { status: 404 });

// A session where anyone signed in may start a group, so no admin signature is needed.
const groupSessionConfig = (overrides = {}) => ({
  ...sessionConfig(),
  workerGroupsBootstrap: { version: 2, state: 'fresh_empty', bootstrapId: 'b0'.repeat(32) },
  groupCreationPolicy: 'participants',
  ...overrides,
});
// Another participant, who starts groups as the session page would.
const groupHost = (env) =>
  createWorkerClient({ workerOrigin: WORKER_ORIGIN, slug: SLUG, trustedOrigins: [SITE], wallet: ethers.Wallet.createRandom(), fetchImpl: workerFetch(env) });
const createGroup = async (host, group) =>
  (await host.request('/groups/create', { method: 'POST', auth: true, body: { sessionId: SESSION_ID, group } })).group;

test('a normal link reaches the Worker its site lists, only when that Worker serves the listed session', async (t) => {
  const env = createEnv([sessionConfig()]);
  const agent = async (...args) => {
    const made = await createAgent(...args);
    t.after(() => fs.rm(made.stateDir, { recursive: true, force: true }));
    return made;
  };
  const seen = [];
  const listed = listing({ [SLUG]: { worker: WORKER_ORIGIN, sessionId: SESSION_ID, name: 'Town Hall' } });
  const { participant } = await agent(env, 'Test Kami', seen, siteFetch(env, listed, seen));
  const joined = await participant.joinSession({ link: NORMAL_LINK });
  assert.equal(joined.signedIn, true);
  assert.equal(joined.session, SLUG);
  // The same link later means the same session, from the list read a moment ago.
  assert.equal((await participant.getSession({ session: NORMAL_LINK })).session, SLUG);
  assert.equal(seen.filter((call) => call.url === LIST_URL).length, 1);

  // A listed Worker serving another session is refused before any sign-in.
  const other = [];
  const wrongId = listing({ [SLUG]: { worker: WORKER_ORIGIN, sessionId: '0xffeeddccbbaa99887766554433221100' } });
  const mismatched = await agent(env, 'Test Kami', other, siteFetch(env, wrongId, other));
  await assert.rejects(mismatched.participant.joinSession({ link: NORMAL_LINK }), /answers for a different session, so it was not joined/);
  assert.equal(other.some((call) => call.url.includes('/auth/')), false);
  assert.deepEqual((await mismatched.participant.whoami()).sessions, []);

  // A list that can't be read is reported, not taken for an on-chain session.
  const torn = async () => new Response('{"town-hall":', { headers: { 'content-type': 'application/json' } });
  const broken = await agent(env, 'Test Kami', [], siteFetch(env, torn));
  await assert.rejects(broken.participant.joinSession({ link: NORMAL_LINK }), /known-sessions\.json could not be read \(the list is not valid JSON\)\..*worker=/s);

  // A worker= in the link still wins, and no list is read.
  const pinned = [];
  const explicit = await agent(env, 'Test Kami', pinned, siteFetch(env, listed, pinned));
  assert.equal((await explicit.participant.joinSession({ link: LINK })).signedIn, true);
  assert.equal(pinned.some((call) => call.url === LIST_URL), false);
});

// What a second participant's context list shows: each item's name, kind, adder and agent mark.
const contextList = async (env) => {
  const reader = groupHost(env);
  const data = await reader.request('/storage/list?resource=docsContext&role=context&limit=100', { auth: true });
  const tag = (item, name) => item.metadata.tags.find((entry) => entry.name === name)?.value || '';
  return data.items
    .filter((item) => item.metadata?.contextSource === true)
    .map((item) => ({
      name: tag(item, 'CE-DocName'),
      kind: tag(item, 'CE-DocKind'),
      addedBy: item.metadata.addedBy,
      adder: [tag(item, 'CE-AdderKind'), tag(item, 'CE-AdderName')],
      adminsOnly: item.metadata.adminsOnly,
    }))
    .sort((left, right) => left.name.localeCompare(right.name));
};

test('an agent adds a file, a link and a note that everyone sees as its own, and the session’s AI reads', async (t) => {
  const env = createEnv([sessionConfig()]);
  // A control character in the agent's name is cleaned alike for files, links and notes.
  const kami = await createAgent(env, 'Test\u0007Kami', []);
  t.after(() => fs.rm(kami.stateDir, { recursive: true, force: true }));
  const joined = await kami.participant.joinSession({ link: LINK });
  assert.equal(joined.addingContext.invitation, 'You’re invited to add context to this session: a file, a link or text. Everyone in the session will see it.');
  assert.deepEqual(Object.keys(joined.addingContext.limits), ['file', 'url', 'text']);
  assert.deepEqual((await kami.participant.getSession()).addingContext, joined.addingContext);

  const notes = path.join(kami.stateDir, '..', `kami-notes-${process.pid}.md`);
  await fs.writeFile(notes, '# Notes\n\nResidents asked for evening sessions.');
  t.after(() => fs.rm(notes, { force: true }));
  const file = await kami.participant.addContext({ file: notes });
  assert.deepEqual({ added: file.added, name: file.name, visibleTo: file.visibleTo }, { added: 'file', name: path.basename(notes), visibleTo: 'everyone in the session' });

  t.mock.method(globalThis, 'fetch', async (url) => {
    assert.equal(String(url), 'https://example.org/essay');
    return new Response('<html><title>Essay</title><body><p>What neighbours owe each other.</p></body></html>', {
      headers: { 'content-type': 'text/html; charset=utf-8' },
    });
  });
  const link = await kami.participant.addContext({ url: 'https://example.org/essay' });
  assert.deepEqual({ added: link.added, title: link.title }, { added: 'link', title: 'Essay' });
  const note = await kami.participant.addContext({ text: 'Agents should say whose agent they are.', title: 'On names' });
  assert.equal(note.name, 'On names.md');

  const kamiAddress = kami.wallet.address.toLowerCase();
  assert.deepEqual(await contextList(env), [
    { name: 'Essay', kind: 'link', addedBy: kamiAddress, adder: ['agent', 'Test Kami'], adminsOnly: false },
    { name: path.basename(notes), kind: 'file', addedBy: kamiAddress, adder: ['agent', 'Test Kami'], adminsOnly: false },
    { name: 'On names.md', kind: 'file', addedBy: kamiAddress, adder: ['agent', 'Test Kami'], adminsOnly: false },
  ]);
  const forAi = await loadParticipantContextSources({ env, slug: SLUG, config: sessionConfig() });
  assert.deepEqual(Object.fromEntries(forAi.map(({ title, text }) => [title, text])), {
    Essay: 'Essay What neighbours owe each other.',
    [path.basename(notes)]: '# Notes\n\nResidents asked for evening sessions.',
    'On names.md': 'Agents should say whose agent they are.',
  });

  // Admins only: stored for them alone, and left out of what the AI reads for everyone.
  const hidden = await kami.participant.addContext({ text: 'For the hosts.', adminsOnly: true });
  assert.equal(hidden.visibleTo, 'the session’s admins');
  assert.equal((await loadParticipantContextSources({ env, slug: SLUG, config: sessionConfig() })).length, 3);
});

// The agent's view of a session from before an admin's change, which the Worker already has.
const staleView = (env, before, seen = []) => {
  const worker = workerFetch(env, seen);
  return async (url, init = {}) => {
    const response = await worker(url, init);
    if (new URL(url).pathname !== '/session-config') return response;
    const body = await response.json();
    return Response.json({ ...body, config: before(body.config) });
  };
};

test('an agent is told why a session takes no context, and nothing is added', async (t) => {
  const limited = { ...sessionConfig(), contextAdditionPolicy: 'admin_only' };
  const ended = { ...sessionConfig(), sessionEndsAt: '2020-01-01T00:00:00.000Z' };
  const cases = [
    [limited, /^Error: This session limits context to its admins, so nothing was added\.$/, ({ contextAdditionPolicy, ...config }) => config],
    [ended, /^Error: This session has ended, so it takes no more context\.$/, ({ sessionEndsAt, ...config }) => config],
  ];
  t.mock.method(globalThis, 'fetch', async () => assert.fail('no page is fetched'));
  const additions = (seen) => seen.filter(({ url, method }) => method === 'POST' && ['/storage/upload', '/storage/context'].includes(new URL(url).pathname));
  for (const [config, refusal, before] of cases) {
    const env = createEnv([config]);
    const asked = [];
    const kami = await createAgent(env, 'Test Kami', asked);
    t.after(() => fs.rm(kami.stateDir, { recursive: true, force: true }));
    assert.equal((await kami.participant.joinSession({ link: LINK })).addingContext, undefined);
    // An agent that read the session before the change hears the same from the Worker.
    const stale = await createAgent(env, 'Test Kami', [], staleView(env, before));
    t.after(() => fs.rm(stale.stateDir, { recursive: true, force: true }));
    assert.ok((await stale.participant.joinSession({ link: LINK })).addingContext);
    for (const agent of [kami, stale]) {
      for (const input of [{ text: 'A note.' }, { url: 'https://example.org/essay' }]) {
        await assert.rejects(agent.participant.addContext(input), refusal);
      }
    }
    // The agent's own check said so without asking the Worker.
    assert.deepEqual(additions(asked), []);
    assert.deepEqual(await contextList(env), []);
  }
  // A session whose files its Worker can't read takes no context and invites none.
  const sealed = createEnv([sessionConfig()]);
  const asked = [];
  const lit = ({ storageProfile, ...config }) => ({
    ...config,
    storageProfile: { ...storageProfile, payloadAccessControl: { ...storageProfile.payloadAccessControl, encryption: 'lit' } },
  });
  const locked = await createAgent(sealed, 'Test Kami', asked, staleView(sealed, lit, asked));
  t.after(() => fs.rm(locked.stateDir, { recursive: true, force: true }));
  assert.equal((await locked.participant.joinSession({ link: LINK })).addingContext, undefined);
  await assert.rejects(locked.participant.addContext({ text: 'A note.' }), /^Error: This session keeps its files where its Session Worker can’t read them, so it takes no context\.$/);
  assert.deepEqual(additions(asked), []);
  const env = createEnv([sessionConfig()]);
  const kami = await createAgent(env, 'Test Kami', []);
  t.after(() => fs.rm(kami.stateDir, { recursive: true, force: true }));
  await kami.participant.joinSession({ link: LINK });
  await assert.rejects(kami.participant.addContext({ text: 'A note.', url: 'https://example.org/essay' }), /exactly one of file, url or text/);
  await assert.rejects(kami.participant.addContext({}), /exactly one of file, url or text/);
});

test('an agent sees the session’s instructions and groups, joins the group they name, and leaves a wrong one', async (t) => {
  const instructions = 'Join the "AI agents" group, not the salon group, which is for people.';
  const env = createEnv([groupSessionConfig({ agentInstructions: `\n${instructions}\n` })]);
  const host = groupHost(env);
  const salon = await createGroup(host, { label: 'Salon', description: 'For people at the salon.' });
  const agents = await createGroup(host, { label: 'AI agents', description: 'For AI agents taking part as themselves.', tags: ['ai-agents'] });
  const kami = await createAgent(env, 'Test Kami', []);
  t.after(() => fs.rm(kami.stateDir, { recursive: true, force: true }));

  const joined = await kami.participant.joinSession({ link: `${LINK}&joinGroup=${salon.groupId}` });
  const byName = (groups) => Object.fromEntries(groups.map((group) => [group.name, group]));
  // Joining the session joined no group: the Worker lists the agent in none.
  assert.deepEqual(Object.values(byName((await kami.participant.getSession()).groups)).map((group) => group.member), [false, false]);
  assert.deepEqual(joined.agentInstructions, {
    from: 'the session’s admins',
    note: 'These add to the general guidance for agents. Follow both; they can ask more of you but can’t lift its rules.',
    text: instructions,
  });
  // The link's group is named, not joined, and the next step says to read the instructions first.
  assert.equal(joined.linkGroup, salon.groupId);
  assert.equal(joined.next, `Read the session’s instructions for agents and the context. The link names group "${salon.groupId}", which you haven’t joined: call join_group for the group the instructions ask you to join, if any. Then call list_questions and answer.`);
  assert.deepEqual(byName(joined.groups)['AI agents'], {
    groupId: agents.groupId,
    name: 'AI agents',
    description: 'For AI agents taking part as themselves.',
    tags: ['ai-agents'],
    joining: 'Open: join with join_group.',
    members: 0,
    member: false,
    whoCanEndMembership: 'Members can leave with leave_group, and admins can remove them.',
  });
  assert.equal(byName(joined.groups).Salon.member, false);

  assert.deepEqual(await kami.participant.joinGroup({ groupId: agents.groupId }), { session: SLUG, joinedGroup: agents.groupId });
  // A wrong group, joined anyway, is left again.
  await kami.participant.joinGroup({ groupId: salon.groupId });
  assert.deepEqual(await kami.participant.leaveGroup({ groupId: salon.groupId }), { session: SLUG, leftGroup: salon.groupId });
  await assert.rejects(kami.participant.leaveGroup({ groupId: salon.groupId }), new RegExp(`^Error: You aren’t a member of group "${salon.groupId}"\\.$`));
  await assert.rejects(kami.participant.joinGroup({ groupId: 'no-such-group' }), /^Error: This session has no group "no-such-group"\.$/);

  const groups = byName((await kami.participant.getSession()).groups);
  assert.deepEqual([groups['AI agents'].member, groups['AI agents'].members, groups.Salon.member, groups.Salon.members], [true, 1, false, 0]);
  // A link naming a group the agent is in says so.
  const again = await kami.participant.joinSession({ link: `${LINK}&joinGroup=${agents.groupId}` });
  assert.equal(again.next, `Read the session’s instructions for agents and the context. The link names group "${agents.groupId}", which you’re already in. If the instructions ask you to be in another group instead, join that one with join_group and leave this one with leave_group. Then call list_questions and answer.`);
  // The session page's member list shows the agent in its group alone.
  const members = async (groupId) =>
    (await host.request(`/groups/members?sessionId=${SESSION_ID}&groupId=${encodeURIComponent(groupId)}`, { auth: true })).memberCount;
  assert.deepEqual([await members(agents.groupId), await members(salon.groupId)], [1, 0]);
});

test('a session’s instructions are cut at the cap, and a session without them shows the general step', async (t) => {
  const long = 'Say whose agent you are. '.repeat(400).trim();
  const quiet = { ...sessionConfig({ slug: 'quiet-hall' }) };
  const env = createEnv([{ ...sessionConfig(), agentInstructions: long }, quiet]);
  const kami = await createAgent(env, 'Test Kami', []);
  t.after(() => fs.rm(kami.stateDir, { recursive: true, force: true }));
  const joined = await kami.participant.joinSession({ link: LINK });
  assert.ok(long.length > 8000);
  assert.deepEqual([joined.agentInstructions.text, joined.agentInstructions.cutAt], [long.slice(0, 8000), 8000]);
  assert.deepEqual((await kami.participant.getSession()).agentInstructions, joined.agentInstructions);

  const plain = await kami.participant.joinSession({ link: `https://contextengine.sh/session/quiet-hall?worker=${encodeURIComponent(WORKER_ORIGIN)}` });
  assert.equal(plain.agentInstructions, undefined);
  assert.equal(plain.next, 'Read the context, then call list_questions and answer.');
});

// The real Worker, with some answers changed to those of another Worker version.
const workerWith = (env, seen, change) => {
  const worker = workerFetch(env, seen);
  return async (url, init = {}) => (await change(new URL(url).pathname, init, () => worker(url, init))) || worker(url, init);
};
const editJson = async (response, edit) => Response.json(edit(await response.json()), { status: response.status });

test('a Worker that takes no links from participants is invited and asked only for a file or text', async (t) => {
  for (const [features, invitation] of [
    [(list) => list.filter((feature) => feature !== 'participant_context_links_v1'), 'You’re invited to add context to this session: a file or text. Everyone in the session will see it.'],
    [(list) => list.filter((feature) => !feature.startsWith('participant_context')), undefined],
  ]) {
    const env = createEnv([sessionConfig()]);
    const seen = [];
    const older = workerWith(env, seen, (pathname, init, send) =>
      pathname === '/capabilities' ? send().then((response) => editJson(response, (body) => ({ ...body, features: features(body.features) }))) : null);
    const kami = await createAgent(env, 'Test Kami', seen, older);
    t.after(() => fs.rm(kami.stateDir, { recursive: true, force: true }));
    const joined = await kami.participant.joinSession({ link: LINK });
    assert.equal(joined.addingContext?.invitation, invitation);
    await assert.rejects(kami.participant.addContext({ url: 'https://example.org/essay' }), /Worker doesn’t take (links|context) from participants yet/);
    assert.equal(seen.some((call) => new URL(call.url).pathname === '/storage/context'), false);
    if (invitation) {
      assert.deepEqual(Object.keys(joined.addingContext.limits), ['file', 'text']);
      assert.doesNotMatch(joined.addingContext.how, /url/);
      assert.equal((await kami.participant.addContext({ text: 'A note.' })).added, 'text');
    } else {
      await assert.rejects(kami.participant.addContext({ text: 'A note.' }), /^Error: This session’s Worker doesn’t take context from participants yet\.$/);
    }
  }
});

test('groups say how joining works and who can end a membership, and a leave the group refuses says so', async (t) => {
  const env = createEnv([groupSessionConfig()]);
  const host = groupHost(env);
  const names = ['Default', 'Kept by admins', 'Members only', 'Fixed', 'By invitation', 'Closed', 'Full'];
  const made = Object.fromEntries(await Promise.all(names.map(async (label) =>
    [label, await createGroup(host, { label, ...(label === 'Full' ? { memberLimit: 1 } : {}) })])));
  await host.request('/groups/join', { method: 'POST', auth: true, body: { sessionId: SESSION_ID, groupId: made.Full.groupId } });
  // As a Worker with the setting reports it; the default group stands for one from before it.
  const setting = { 'Kept by admins': 'admin_only', 'Members only': 'member_only', Fixed: 'neither' };
  const label = (groupId) => names.find((name) => made[name].groupId === groupId);
  const newer = workerWith(env, [], (pathname, init, send) => {
    if (pathname === '/groups/leave' && setting[label(JSON.parse(init.body).groupId)] === 'admin_only') {
      return Response.json({ error: 'Worker group request failed.', reason: 'worker_group_leave_denied' }, { status: 403 });
    }
    if (pathname !== '/groups/list') return null;
    return send().then((response) => editJson(response, (body) => ({
      ...body,
      groups: body.groups.map((group) => ({
        ...group,
        ...(setting[label(group.groupId)] ? { removalAuth: setting[label(group.groupId)] } : {}),
        ...(label(group.groupId) === 'By invitation' ? { joinMode: 'admin_add' } : {}),
        ...(label(group.groupId) === 'Closed' ? { joinEndsAt: '2020-01-01T00:00:00.000Z' } : {}),
      })),
    })));
  });
  const kami = await createAgent(env, 'Test Kami', [], newer);
  t.after(() => fs.rm(kami.stateDir, { recursive: true, force: true }));
  const { groups } = await kami.participant.joinSession({ link: LINK });
  const shown = Object.fromEntries(groups.map((group) => [group.name, [group.joining, group.whoCanEndMembership]]));
  assert.deepEqual(shown, {
    Default: ['Open: join with join_group.', 'Members can leave with leave_group, and admins can remove them.'],
    'Kept by admins': ['Open: join with join_group.', 'Only admins can remove members; members can’t leave.'],
    'Members only': ['Open: join with join_group.', 'Members can leave with leave_group; admins can’t remove them.'],
    Fixed: ['Open: join with join_group.', 'No one can end a membership.'],
    'By invitation': ['Only admins add members.', 'Members can leave with leave_group, and admins can remove them.'],
    Closed: ['Joining has closed.', 'Members can leave with leave_group, and admins can remove them.'],
    Full: ['Full.', 'Members can leave with leave_group, and admins can remove them.'],
  });
  assert.equal(groups.find((group) => group.name === 'Full').memberLimit, 1);
  const kept = made['Kept by admins'].groupId;
  await kami.participant.joinGroup({ groupId: kept });
  await assert.rejects(kami.participant.leaveGroup({ groupId: kept }), new RegExp(`^Error: Group "${kept}" doesn’t let members leave\\.$`));
  await assert.rejects(kami.participant.joinGroup({ groupId: made.Full.groupId }), new RegExp(`^Error: Group "${made.Full.groupId}" has no room for more members\\.$`));
});

test('groups a Worker can’t list yet are reported as such, and none are shown where it keeps none', async (t) => {
  const env = createEnv([groupSessionConfig()]);
  // A Worker set to reconcile older groups first lists none until it has.
  env.CE_WORKER_GROUPS_BOOTSTRAP = 'reconcile-first';
  const kami = await createAgent(env, 'Test Kami', []);
  t.after(() => fs.rm(kami.stateDir, { recursive: true, force: true }));
  const joined = await kami.participant.joinSession({ link: `${LINK}&joinGroup=g-salon` });
  assert.equal(joined.groupsUnavailable, 'This session’s groups can’t be listed on its Worker yet.');
  assert.equal(joined.next, 'Read the context. The link names group "g-salon": join it with join_group. Then call list_questions and answer.');

  const bare = createEnv([sessionConfig()]);
  const noStore = workerWith(bare, [], (pathname) => (pathname.startsWith('/groups/')
    ? Response.json({ error: 'Worker group request failed.', reason: 'worker_group_store_not_configured' }, { status: 501 })
    : null));
  const plain = await createAgent(bare, 'Test Kami', [], noStore);
  t.after(() => fs.rm(plain.stateDir, { recursive: true, force: true }));
  const quiet = await plain.participant.joinSession({ link: LINK });
  assert.deepEqual([quiet.groups, quiet.groupsUnavailable], [undefined, undefined]);
});

test('an agent the Worker counts as an admin by its role adds context where only admins may', async (t) => {
  const wallet = ethers.Wallet.createRandom();
  const address = wallet.address.toLowerCase();
  const env = createEnv([{ ...sessionConfig(), contextAdditionPolicy: 'admin_only', workerRoles: { admin: [address] } }]);
  const kami = await createAgent(env, 'Test Kami', [], null, { wallet });
  t.after(() => fs.rm(kami.stateDir, { recursive: true, force: true }));
  await kami.participant.joinSession({ link: LINK });
  assert.equal((await kami.participant.addContext({ text: 'For the hosts.' })).added, 'text');
  assert.deepEqual((await contextList(env)).map((item) => item.addedBy), [address]);
});

test('an agent whose sign-in can’t have the Worker fetch pages adds a file or text, not a link', async (t) => {
  const noFetch = { ...sessionConfig(), workerAuthority: { version: 1, participantScopes: ['ai', 'transcribe', 'storage', 'groups'] } };
  const refusal = /^Error: This session doesn’t let you have its Worker fetch pages, so it takes no links from you\. You can add a file or text\.$/;
  t.mock.method(globalThis, 'fetch', async () => assert.fail('no page is fetched'));
  const env = createEnv([noFetch]);
  const asked = [];
  const kami = await createAgent(env, 'Test Kami', asked);
  t.after(() => fs.rm(kami.stateDir, { recursive: true, force: true }));
  const joined = await kami.participant.joinSession({ link: LINK });
  assert.equal(joined.addingContext.invitation, 'You’re invited to add context to this session: a file or text. Everyone in the session will see it.');
  await assert.rejects(kami.participant.addContext({ url: 'https://example.org/essay' }), refusal);
  assert.equal(asked.some((call) => new URL(call.url).pathname === '/storage/context'), false);
  assert.equal((await kami.participant.addContext({ text: 'A note.' })).added, 'text');
  // The Worker refuses such a link itself, before fetching anything.
  const direct = groupHost(env);
  await assert.rejects(direct.contextAction({ action: 'add-link', url: 'https://example.org/essay' }),
    (error) => error.status === 403 && error.code === 'context_link_fetch_denied');
  assert.deepEqual((await contextList(env)).map((item) => item.kind), ['file']);
});

test('context the Worker refuses is reported in terms of what the agent can do', async (t) => {
  const refused = (body, status = 403) => Response.json({ error: 'Refused.', ...body }, { status });
  const link = { url: 'https://example.org/essay' };
  const rateLimited = /^Error: The session’s Worker is rate limiting you, so nothing was added\. Retry in a few minutes; if it still refuses, you may have reached the session’s daily limit for your address, which clears within a day\.$/;
  for (const [answer, addition, refusal] of [
    // A Worker from before participants' links lists no features, and refuses one as any change from a participant.
    [{ '/capabilities': () => new Response('Not found', { status: 404 }), '/storage/context': () => refused({ reason: 'context_admin_required' }) },
      link, /^Error: This session’s Worker doesn’t take links from participants yet\. You can add a file or text\.$/],
    // One that lists them refuses it so only when the session limits context to admins.
    [{ '/storage/context': () => refused({ reason: 'context_admin_required' }) },
      link, /^Error: This session limits context to its admins, so nothing was added\.$/],
    // A Worker that finds no fetch scope in the sign-in, as when the agent has stopped being an admin since it read the session.
    [{ '/storage/context': () => refused({ reason: 'context_link_fetch_denied' }) },
      link, /^Error: This session doesn’t let you have its Worker fetch pages, so it takes no links from you\. You can add a file or text\.$/],
    // A check that failed for now is the Worker's own answer, not a rule of the session's.
    [{ '/storage/context': () => refused({ error: 'Current authorization check failed.' }) },
      link, /^WorkerRequestError: Not allowed: Current authorization check failed\./],
    [{ '/storage/context': () => refused({ error: 'Rate limit exceeded.' }, 429) }, link, rateLimited],
    [{ '/storage/upload': () => refused({ error: 'Rate limit exceeded.' }, 429) }, { text: 'A note.' }, rateLimited],
  ]) {
    const env = createEnv([sessionConfig()]);
    const kami = await createAgent(env, 'Test Kami', [], workerWith(env, [], (pathname) => answer[pathname]?.() || null));
    t.after(() => fs.rm(kami.stateDir, { recursive: true, force: true }));
    await kami.participant.joinSession({ link: LINK });
    await assert.rejects(kami.participant.addContext(addition), refusal);
  }
});
