import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEBATE_ATLAS_BUILD_ACTION,
  DEBATE_ATLAS_LIMITS,
  buildDebateAtlas,
  describeNextDebateAtlasBuild,
  dispatchDebateAtlasReadRequest,
  normalizeDebateAtlasPlan,
  normalizeDebateAtlasTopic,
  runWithConcurrency,
} from './debateAtlasBuild.js';
import { dispatchDebateAtlasStore } from './debateAtlasStore.js';
import { dispatchAdminRequest } from './adminRequestDispatch.js';

// Addresses are built at run time so no fixture holds a key-shaped string.
const address = (digit) => `0x${String(digit).repeat(40)}`;
const ADMIN = address(1);
const RESULTS_ADMIN = address(2);
const PARTICIPANTS = ['participant_001', 'participant_002', 'participant_003'];
const PARTICIPANT_ADDRESSES = new Map(PARTICIPANTS.map((id, index) => [id, address(index + 3)]));

const createStore = () => {
  const values = new Map();
  const storage = {
    // Durable Object storage hands back copies, so an edit is kept only by a put.
    get: async (key) => structuredClone(values.get(key)),
    put: async (key, value) => { values.set(key, structuredClone(value)); },
    delete: async (key) => values.delete(key),
    transaction: async (run) => run(storage),
  };
  const coordinator = { state: { storage }, now: () => 1_000 };
  const calls = [];
  const callAtlasStore = async (_env, _slug, operation, payload = {}) => {
    calls.push(operation);
    const response = await dispatchDebateAtlasStore(coordinator, operation, payload);
    const body = await response.json();
    return { ok: response.ok && body.ok === true, status: response.status, body };
  };
  return { callAtlasStore, calls };
};

const createSource = ({ questionCount = 4 } = {}) => {
  const questions = Array.from({ length: questionCount }, (_, index) => ({
    id: `q${index + 1}`, prompt: `Question ${index + 1}?`, type: 'freeform', options: [], tags: [],
  }));
  const responses = questions.flatMap((question) => PARTICIPANTS.map((participantId) => ({
    participantId, questionId: question.id, answer: `${participantId} on ${question.id}`, questionPrompt: question.prompt, questionType: 'freeform',
  })));
  return {
    ok: true,
    aiSnapshot: { questions, responses },
    counts: {
      responseCount: responses.length + 5,
      participantCount: 3,
      totalQuestionCount: questionCount + 1,
      aiInputResponseCount: responses.length,
      aiInputQuestionCount: questionCount,
      aiInputParticipantCount: 3,
    },
    participantAddresses: PARTICIPANT_ADDRESSES,
  };
};

const planFor = (questionIds, topicsPerBranch = 2) => ({
  title: 'Atlas',
  branches: [0, 1].map((branch) => ({
    label: `Branch ${branch + 1}`,
    summary: 'A branch.',
    topics: Array.from({ length: topicsPerBranch }, (_, topic) => ({
      label: `Topic ${branch + 1}.${topic + 1}`,
      questionIds: questionIds.filter((_, index) => index % (topicsPerBranch * 2) === branch * topicsPerBranch + topic),
    })),
  })),
});

const topicReply = {
  summary: 'They split.',
  compass: { x: { label: 'Pace', left: 'Slow', right: 'Fast' }, y: { label: 'Scope', top: 'Local', bottom: 'Global' } },
  positions: [
    { label: 'Go slow', summary: 'Care first.', participantIds: ['participant_001', 'participant_002', 'participant_999'], x: 0.1, y: 0.8 },
    { label: 'Invented view', participantIds: ['participant_999'], x: 0.5, y: 0.5 },
  ],
  participants: [
    { participantId: 'participant_001', x: 0.2, y: 0.9, reason: 'Wants care.' },
    { participantId: 'participant_001', x: 0.9, y: 0.1, reason: 'Duplicate.' },
    { participantId: 'participant_999', x: 0.5, y: 0.5, reason: 'Not in the session.' },
    { participantId: 'participant_003', x: 1.7, y: -2, reason: 'Clamped.' },
  ],
};

const isPlanPrompt = (prompt) => prompt.startsWith('You are planning');
const isBranchPrompt = (prompt) => prompt.startsWith('You are mapping one branch');

const runBuild = async ({ source = createSource(), provider, store = createStore(), config = {}, body = {}, now } = {}) => {
  const prompts = [];
  const result = await buildDebateAtlas({
    env: {},
    slug: 'atlas-session',
    config: { sessionName: 'Salon', ai: { model: 'test-model' }, ...config },
    body,
    builderAddress: RESULTS_ADMIN.toUpperCase().replace('0X', '0x'),
    deps: {
      callAtlasStore: store.callAtlasStore,
      loadSource: async () => source,
      getSessionSecrets: async () => ({}),
      loadParticipantContextSources: async () => [],
      ...(now ? { now } : {}),
      callProvider: async ({ prompt }) => {
        prompts.push(prompt);
        return provider(prompt);
      },
    },
  });
  return { result, prompts, store };
};

test('builds an atlas from a planning call, a call per topic and one per branch, each response reaching its topic and branch and no address', async () => {
  const source = createSource();
  const { result, prompts, store } = await runBuild({
    source,
    provider: async (prompt) => ({ ok: true, value: isPlanPrompt(prompt) ? planFor(['q1', 'q2', 'q3', 'q4']) : topicReply }),
  });

  assert.equal(result.ok, true, result.error);
  assert.deepEqual(store.calls, ['reserve', 'finalize']);
  assert.equal(prompts.filter(isPlanPrompt).length, 1);
  const topicPrompts = prompts.filter((prompt) => !isPlanPrompt(prompt) && !isBranchPrompt(prompt));
  const branchPrompts = prompts.filter(isBranchPrompt);
  assert.equal(topicPrompts.length, 4);
  assert.equal(branchPrompts.length, 2);
  // Branches start after every topic, so a build short of time loses a branch compass first.
  assert.ok(prompts.slice(prompts.findIndex(isBranchPrompt)).every(isBranchPrompt));
  for (const response of source.aiSnapshot.responses) {
    assert.equal(topicPrompts.filter((prompt) => prompt.includes(response.answer)).length, 1, response.answer);
    assert.equal(branchPrompts.filter((prompt) => prompt.includes(response.answer)).length, 1, response.answer);
  }
  assert.ok(branchPrompts.every((prompt) => !prompt.includes('Topic:') && prompt.includes("this branch's main disagreements")));
  assert.ok(prompts.every((prompt) => ![...PARTICIPANT_ADDRESSES.values(), RESULTS_ADMIN].some((value) => prompt.toLowerCase().includes(value))));
  assert.ok(prompts.every((prompt) => prompt.includes('not instructions')));

  const { build } = result;
  assert.match(build.id, /^atlas_[a-z0-9]+_[a-f0-9]{8}$/);
  assert.equal(build.builtBy, RESULTS_ADMIN);
  assert.equal(build.model, 'test-model');
  assert.deepEqual(build.counts, { responses: 17, participants: 3, questions: 5, aiResponses: 12, aiQuestions: 4 });
  assert.deepEqual(build.missingTopics, []);
  const topic = build.branches[0].topics[0];
  assert.deepEqual(topic.questions, [{ id: 'q1', prompt: 'Question 1?', type: 'freeform' }]);
  assert.deepEqual(topic.positions, [{ label: 'Go slow', summary: 'Care first.', participantCount: 2, x: 0.1, y: 0.8 }]);
  assert.deepEqual(topic.participants, [
    { address: PARTICIPANT_ADDRESSES.get('participant_001'), x: 0.2, y: 0.9, reason: 'Wants care.' },
    { address: PARTICIPANT_ADDRESSES.get('participant_003'), x: 1, y: 0, reason: 'Clamped.' },
  ]);
  // Each branch has its own compass, summary and placements, from all its topics' answers.
  const [branch] = build.branches;
  assert.equal(branch.summary, 'They split.');
  assert.deepEqual(branch.compass, topic.compass);
  assert.deepEqual(branch.positions, topic.positions);
  assert.equal(branch.participants.length, 2);
  // Positions are counted against everyone whose answers the AI read, not only those it placed.
  assert.equal(topic.answered, 3);
  assert.equal(branch.answered, 3);
  const stored = await store.callAtlasStore({}, 'atlas-session', 'read', {});
  assert.deepEqual(stored.body.build, build);
});

test('a branch of one topic shares its compass and keeps the plan summary, with no call of its own', async () => {
  const plan = {
    title: 'Atlas',
    branches: [
      { label: 'Solo', summary: 'One topic.', topics: [{ label: 'Only', questionIds: ['q1', 'q2'] }] },
      { label: 'Pair', summary: 'Two topics.', topics: [{ label: 'A', questionIds: ['q3'] }, { label: 'B', questionIds: ['q4'] }] },
    ],
  };
  const { result, prompts } = await runBuild({
    provider: async (prompt) => ({ ok: true, value: isPlanPrompt(prompt) ? plan : topicReply }),
  });
  assert.equal(result.ok, true, result.error);
  assert.equal(prompts.filter(isBranchPrompt).length, 1);
  const [solo, pair] = result.build.branches;
  assert.equal(solo.summary, 'One topic.');
  assert.deepEqual(solo.compass, solo.topics[0].compass);
  assert.deepEqual(solo.participants, solo.topics[0].participants);
  assert.equal(pair.summary, 'They split.');
  assert.ok(pair.compass);
});

test('a branch whose own call fails keeps its topics and plan summary, and no topic is missing', async () => {
  const { result } = await runBuild({
    provider: async (prompt) => {
      if (isPlanPrompt(prompt)) return { ok: true, value: planFor(['q1', 'q2', 'q3', 'q4']) };
      return isBranchPrompt(prompt) ? { ok: false, status: 502, error: 'upstream' } : { ok: true, value: topicReply };
    },
  });
  assert.equal(result.ok, true, result.error);
  assert.deepEqual(result.build.missingTopics, []);
  const [branch] = result.build.branches;
  assert.equal(branch.summary, 'A branch.');
  assert.equal(branch.compass, undefined);
  assert.equal(branch.topics.length, 2);
});

test(`runs at most ${DEBATE_ATLAS_LIMITS.concurrency} topic calls at once`, async () => {
  const questionIds = Array.from({ length: 12 }, (_, index) => `q${index + 1}`);
  let inFlight = 0;
  let peak = 0;
  const { result, prompts } = await runBuild({
    source: createSource({ questionCount: 12 }),
    provider: async (prompt) => {
      if (isPlanPrompt(prompt)) return { ok: true, value: planFor(questionIds, 6) };
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 5));
      inFlight -= 1;
      return { ok: true, value: topicReply };
    },
  });
  assert.equal(result.ok, true, result.error);
  // The plan, 12 topics and the 2 branches.
  assert.equal(prompts.length, 15);
  assert.equal(peak, DEBATE_ATLAS_LIMITS.concurrency);
});

test('keeps the topics that were mapped and names the ones that failed', async () => {
  const { result } = await runBuild({
    provider: async (prompt) => {
      if (isPlanPrompt(prompt)) return { ok: true, value: planFor(['q1', 'q2', 'q3', 'q4']) };
      return prompt.includes('"Topic 1.2"') ? { ok: false, status: 502, error: 'upstream' } : { ok: true, value: topicReply };
    },
  });
  assert.equal(result.ok, true);
  assert.deepEqual(result.build.missingTopics, ['Topic 1.2']);
  assert.deepEqual(result.build.branches.map((branch) => branch.topics.map((topic) => topic.label)), [['Topic 1.1'], ['Topic 2.1', 'Topic 2.2']]);
});

test('stops starting topic calls once the build deadline is near', async () => {
  let clock = 0;
  const { result, prompts } = await runBuild({
    now: () => clock,
    provider: async (prompt) => {
      if (isPlanPrompt(prompt)) {
        clock = DEBATE_ATLAS_LIMITS.buildMs - DEBATE_ATLAS_LIMITS.minCallMs + 1;
        return { ok: true, value: planFor(['q1', 'q2', 'q3', 'q4']) };
      }
      return { ok: true, value: topicReply };
    },
  });
  assert.equal(prompts.length, 1);
  assert.equal(result.ok, false);
  assert.equal(result.status, 502);
});

test('a failed build keeps nothing and frees the next press', async () => {
  for (const provider of [
    async () => ({ ok: false, status: 429, error: 'rate limited' }),
    async (prompt) => ({ ok: true, value: isPlanPrompt(prompt) ? planFor(['q1', 'q2', 'q3', 'q4']) : { positions: [] } }),
    async () => ({ ok: true, value: { branches: [] } }),
  ]) {
    const store = createStore();
    const { result } = await runBuild({ provider, store });
    assert.equal(result.ok, false);
    const read = await store.callAtlasStore({}, 'atlas-session', 'read', {});
    assert.deepEqual(read.body.builds, []);
    assert.equal(read.body.active, null);
  }
});

test('refuses before any AI call when a build runs, AI is off, the input is thin, or the source is not stored', async () => {
  const busy = createStore();
  await busy.callAtlasStore({}, 'atlas-session', 'reserve', {});
  const provider = async () => assert.fail('no AI call expected');
  const refused = (await runBuild({ provider, store: busy })).result;
  assert.equal(refused.status, 409);
  // The site shows the running build from these and checks back for it.
  assert.equal(refused.reason, 'debate_atlas_build_running');
  assert.deepEqual(refused.active, { startedAtMs: 1_000 });
  assert.equal((await runBuild({ provider, config: { scopes: { ai: false } } })).result.status, 403);
  assert.equal((await runBuild({ provider, body: { source: { kind: 'admin-snapshot', snapshot: {} } } })).result.status, 400);

  const thin = createSource();
  thin.counts.aiInputParticipantCount = 1;
  const store = createStore();
  assert.equal((await runBuild({ provider, source: thin, store })).result.status, 422);
  assert.equal((await store.callAtlasStore({}, 'atlas-session', 'read', {})).body.active, null);
});

test('a plan assigns each answered question to one topic and a rejected topic claims none', () => {
  const plan = normalizeDebateAtlasPlan({
    answeredQuestionIds: new Set(['q1', 'q2', 'q3']),
    value: {
      branches: [
        { label: 'One', topics: [{ label: '', questionIds: ['q1'] }, { label: 'A', questionIds: ['q1', 'q1', 'q9'] }] },
        { label: 'Two', topics: [{ label: 'B', questionIds: ['q1', 'q2'] }, { label: 'Empty', questionIds: ['q9'] }] },
        { label: '', topics: [{ label: 'C', questionIds: ['q3'] }] },
      ],
    },
  });
  assert.deepEqual(plan.branches.map((branch) => [branch.label, branch.topics.map((topic) => [topic.label, topic.questionIds])]), [
    ['One', [['A', ['q1']]]],
    ['Two', [['B', ['q2']]]],
  ]);
});

test(`a plan keeps at most ${DEBATE_ATLAS_LIMITS.topics} topics`, () => {
  const ids = Array.from({ length: 20 }, (_, index) => `q${index}`);
  const plan = normalizeDebateAtlasPlan({
    answeredQuestionIds: new Set(ids),
    value: { branches: [{ label: 'All', topics: ids.map((id) => ({ label: id, questionIds: [id] })) }] },
  });
  assert.equal(plan.branches[0].topics.length, DEBATE_ATLAS_LIMITS.topics);
});

test('a topic without a usable compass keeps its positions but places no one', () => {
  const topic = normalizeDebateAtlasTopic({
    value: { ...topicReply, compass: { x: { label: 'Pace', left: 'Slow' } } },
    answeredBy: new Map([['participant_001', 1], ['participant_002', 1]]),
    placeParticipants: ['participant_001'],
    participantAddresses: PARTICIPANT_ADDRESSES,
  });
  assert.equal(topic.compass, null);
  assert.deepEqual(topic.positions, [{ label: 'Go slow', summary: 'Care first.', participantCount: 2 }]);
  assert.deepEqual(topic.participants, []);
  assert.equal(topic.answered, 2);
});

test('participants without an address are labelled by number, and AI text loses addresses', () => {
  const topic = normalizeDebateAtlasTopic({
    value: {
      ...topicReply,
      summary: `Echoes ${address(9)} verbatim.`,
      participants: [{ participantId: 'participant_002', x: 0.5, y: 0.5, reason: 'Mixed.' }],
    },
    answeredBy: new Map([['participant_001', 1], ['participant_002', 1]]),
    placeParticipants: ['participant_002'],
    participantAddresses: new Map(),
  });
  assert.equal(topic.summary, 'Echoes [redacted-address] verbatim.');
  assert.deepEqual(topic.participants, [{ label: 'Participant 2', x: 0.5, y: 0.5, reason: 'Mixed.' }]);
});

test('runWithConcurrency keeps order', async () => {
  const results = await runWithConcurrency([30, 10, 20], 2, async (delay, index) => {
    await new Promise((resolve) => setTimeout(resolve, delay));
    return index;
  });
  assert.deepEqual(results, [0, 1, 2]);
});

const json = (body, status = 200, headers = {}) => new Response(JSON.stringify(body), { status, headers });
const readAtlas = async ({ config, address: requester = '', validateAdmin = async () => false, id = '' } = {}) => {
  const storeCalls = [];
  const adminChecks = [];
  const response = await dispatchDebateAtlasReadRequest({
    request: new Request(`https://worker.example/debate-atlas?sessionSlug=atlas-session${id ? `&id=${id}` : ''}`),
    env: {},
    config,
    slug: 'atlas-session',
    address: requester,
    scopes: {},
    headers: {},
    deps: {
      json,
      validateAdmin: async (args) => {
        adminChecks.push(args.address);
        return validateAdmin(args);
      },
      authorizeCloudflareStorageResourceRead: async () => ({ ok: true }),
      callAtlasStore: async (_env, _slug, operation, payload) => {
        storeCalls.push([operation, payload]);
        return { ok: true, status: 200, body: { ok: true, builds: [], build: null, active: null } };
      },
    },
  });
  return { status: response.status, body: await response.json(), storeCalls, adminChecks, cache: response.headers.get('cache-control') };
};

const publicResults = {
  sessionModeProfile: { results: { visibility: 'public_full_if_storage_public', exposure: { aggregateResultsEnabled: true } } },
};
const privateResults = {
  resultsAdminAddresses: [RESULTS_ADMIN],
  sessionModeProfile: { results: { visibility: 'participant_aggregate', exposure: { aggregateResultsEnabled: true } } },
};

test('everyone who sees full Results reads atlases; elsewhere only those who may build', async () => {
  const viewer = await readAtlas({ config: publicResults, id: 'atlas_k1_00000001' });
  assert.equal(viewer.status, 200);
  assert.equal(viewer.body.canBuild, false);
  assert.equal(viewer.cache, 'private, no-store');
  assert.deepEqual(viewer.storeCalls, [['read', { id: 'atlas_k1_00000001' }]]);

  const blocked = await readAtlas({ config: privateResults, address: address(7) });
  assert.equal(blocked.status, 403);
  assert.deepEqual(blocked.storeCalls, []);

  const resultsAdmin = await readAtlas({ config: privateResults, address: RESULTS_ADMIN });
  assert.equal(resultsAdmin.status, 200);
  assert.equal(resultsAdmin.body.canBuild, true);

  const hatWearer = await readAtlas({ config: privateResults, address: address(8), validateAdmin: async ({ address: who }) => who === address(8) });
  assert.equal(hatWearer.body.canBuild, true);
  assert.deepEqual(hatWearer.adminChecks, [address(8)]);

  // A listed builder is told so on a public session too, without an admin-hat chain read.
  const listedOnPublic = await readAtlas({ config: { ...publicResults, resultsAdminAddresses: [RESULTS_ADMIN] }, address: RESULTS_ADMIN });
  assert.equal(listedOnPublic.body.canBuild, true);
  assert.deepEqual(listedOnPublic.adminChecks, []);

  // Where viewers may read, a signed-in reader costs no admin-hat chain read.
  const signedInViewer = await readAtlas({ config: publicResults, address: address(8), validateAdmin: async () => true });
  assert.equal(signedInViewer.status, 200);
  assert.deepEqual(signedInViewer.adminChecks, []);
  assert.equal(resultsAdmin.adminChecks.length, 0);

  // Only those who may build are told the model and prompts a build would use.
  assert.equal(viewer.body.nextBuild, undefined);
  assert.equal(signedInViewer.body.nextBuild, undefined);
  assert.deepEqual(resultsAdmin.body.nextBuild, describeNextDebateAtlasBuild(privateResults));
});

test('the next build is described with the session model and placeholder prompts', () => {
  const next = describeNextDebateAtlasBuild({ sessionName: 'Salon', ai: { models: { thinking: 'deep-model' } } });
  assert.equal(next.model, 'deep-model');
  assert.ok(next.prompts.plan.startsWith('You are planning') && next.prompts.plan.includes('"Salon"'));
  assert.match(next.prompts.plan, /\n<Questions>\n/);
  assert.match(next.prompts.map, /\{"questions":<Questions>,"responses":<Responses>,"placeParticipants":<Participants>\}$/);
  assert.ok(!/"</.test(next.prompts.plan + next.prompts.map));
  // A summary short enough to lead a node's panel whole, as a tweet would.
  assert.match(next.prompts.map, /"summary": "[^"]*under 280 characters/);
});

const dispatchAs = async ({ action, signer, config }) => {
  let built = false;
  const response = await dispatchAdminRequest({
    request: new Request(`https://worker.example/admin/${action}`, { method: 'POST', body: JSON.stringify({ action }) }),
    env: {},
    baseHeaders: {},
    slug: 'atlas-session',
    action,
    deps: {
      json: (body, status) => ({ body, status }),
      validateAdmin: async ({ address: who }) => who === ADMIN,
      resolveAdminRequestAuthority: async ({ deps }) => (
        await deps.validateAdmin({ env: {}, slug: 'atlas-session', address: signer, config, body: {} })
          ? { ok: true, address: signer, existingConfig: config, headers: {}, targetSlug: 'atlas-session' }
          : { ok: false, response: { body: { error: 'Admin authorization failed.' }, status: 403 } }
      ),
      buildDebateAtlas: async ({ builderAddress }) => {
        built = true;
        return { ok: true, status: 200, build: { builtBy: builderAddress } };
      },
    },
  });
  return { status: response.status, built };
};

test('results admins and co-admins may build atlases and nothing else; strangers may not', async () => {
  const config = { adminAddress: ADMIN, adminAddresses: [address(5)], resultsAdminAddresses: [RESULTS_ADMIN] };
  for (const signer of [ADMIN, address(5), RESULTS_ADMIN]) {
    assert.deepEqual(await dispatchAs({ action: DEBATE_ATLAS_BUILD_ACTION, signer, config }), { status: 200, built: true }, signer);
  }
  assert.deepEqual(await dispatchAs({ action: DEBATE_ATLAS_BUILD_ACTION, signer: address(6), config }), { status: 403, built: false });
  assert.equal((await dispatchAs({ action: 'set-config', signer: RESULTS_ADMIN, config })).status, 403);
  assert.equal((await dispatchAs({ action: 'results-analysis/generate', signer: RESULTS_ADMIN, config })).status, 403);
});
