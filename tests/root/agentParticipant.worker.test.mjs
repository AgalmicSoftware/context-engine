import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { ethers } from 'ethers';
import sessionCorsWorker from '../../workers/sessionCorsWorker/worker.js';
import { installSessionCoordinatorBinding } from '../helpers/sessionCorsWorkerTestUtils.mjs';
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
  sessionContext: { title: 'Context', paragraphs: ['Answer as yourself.'], links: [] },
  allowOrigins: ['http://localhost:3000', 'https://contextengine.sh'],
  workerAuthority: { version: 1, participantScopes: ['ai', 'transcribe', 'storage', 'groups', 'fetch'] },
  sessionModeProfile: publicProfile(visibility),
  storageProfile: {
    type: 'session_storage_profile',
    version: 'session-storage-profile-v1',
    backend: 'cloudflare',
    sessionOwned: true,
    telegramOwned: false,
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
    async get(key) {
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

const createAgent = async (env, displayName, seen, fetchImpl = null, { now, sbt, createProvider, wallet: existingWallet } = {}) => {
  const stateDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ce-agent-'));
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

test('agent answer uploads use one operation per tool call and forward their content digest', async () => {
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
  assert.ok(uploads.every(({ requestId }) => /^answer:v1:[^:]+:0x[a-f0-9]{64}:[a-f0-9]{64}$/.test(requestId)));
  assert.equal(uploads[0].requestId.split(':')[2], uploads[1].requestId.split(':')[2]);
  for (const upload of uploads) assert.equal(upload.requestId.split(':').at(-1), ethers.utils.sha256(ethers.utils.toUtf8Bytes(upload.data)).slice(2));
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

test('a session that changes identity behind the same link does not reuse remembered answers', async () => {
  const env = createEnv([sessionConfig()]);
  const { participant } = await createAgent(env, 'mover', []);
  await participant.joinSession({ link: LINK });
  const { questionId } = await participant.addStatement({ prompt: 'Same words, new session.' });
  await participant.answer({ answers: [{ questionId, value: 'Agree' }] });
  // The Worker is reset and now serves a different session under the same slug.
  const fresh = createEnv([sessionConfig({ sessionId: '0xffeeddccbbaa99887766554433221100' })]);
  env.CE_SESSION_COORDINATOR = fresh.CE_SESSION_COORDINATOR;
  for (const kv of ['GROUP_KV', 'CE_STORAGE_INDEX_KV']) {
    env[kv].store.clear();
    for (const [key, value] of fresh[kv].store) env[kv].store.set(key, value);
  }
  await participant.joinSession({ link: LINK });
  const again = await participant.addStatement({ prompt: 'Same words, new session.' });
  assert.equal(again.created, true);
  const listed = await participant.listQuestions({ filter: 'all' });
  assert.equal(listed.answeredByMe, 0);
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
  const agent = await createAgent(env, 'state-fixture');
  t.after(() => fs.rm(agent.stateDir, { recursive: true, force: true }));
  await agent.participant.joinSession({ link: LINK });
  const { questionId } = await agent.participant.addStatement({ prompt: STATEMENT });
  await fs.rename(path.join(agent.stateDir, 'state.json'), path.join(agent.stateDir, 'state.saved.json'));
  await fs.mkdir(path.join(agent.stateDir, 'state.json'));
  const result = await agent.participant.answer({ answers: [{ questionId, value: 'Agree' }] });
  assert.equal(result.submitted, 1);
  assert.equal(result.failed, 0);
  assert.match(result.warning, /submitted.*local answer history.*not.*saved/i);
});
