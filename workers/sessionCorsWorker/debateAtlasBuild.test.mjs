import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEBATE_ATLAS_BUILD_ACTION,
  DEBATE_ATLAS_LIMITS,
  buildDebateAtlas,
  buildDebateAtlasPlanPrompt,
  describeNextDebateAtlasBuild,
  dispatchDebateAtlasReadRequest,
  normalizeDebateAtlasPlan,
  normalizeDebateAtlasQuestion,
  normalizeDebateAtlasTopic,
  runWithConcurrency,
} from './debateAtlasBuild.js';
import { dispatchResultsBuildStore } from './resultsBuildStore.js';
import { dispatchAdminRequest } from './adminRequestDispatch.js';
import { buildIndexKey, buildPayloadKey } from './storageRouteExecution.js';
import { ATLAS_QUESTION_SUMMARY_SETTINGS } from '../../shared/atlasQuestionSummaries.mjs';

// The defaults a session without its own atlasQuestionSummaries setting uses.
const DEFAULTS = Object.fromEntries(Object.entries(ATLAS_QUESTION_SUMMARY_SETTINGS).map(([key, bound]) => [key, bound.default]));

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
  const callBuildStore = async (_env, _slug, operation, payload = {}) => {
    calls.push(operation);
    const response = await dispatchResultsBuildStore(coordinator, 'debate-atlas', operation, payload);
    const body = await response.json();
    return { ok: response.ok && body.ok === true, status: response.status, body };
  };
  return { callBuildStore, calls };
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
    // Every row the build may read; the AI sample is drawn from these.
    snapshot: { responses: responses.map(({ participantId, questionId, answer }) => ({ participantId, questionId, answer })) },
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

const questionReply = {
  summary: 'Most want care.',
  categories: [
    { label: 'Care first', summary: 'Slow and safe.', participantIds: ['participant_001', 'participant_002'] },
    { label: 'Move now', participantIds: ['participant_003', 'participant_999'] },
  ],
};

const isPlanPrompt = (prompt) => prompt.startsWith('You are planning');
const isBranchPrompt = (prompt) => prompt.startsWith('You are mapping one branch');
const isQuestionPrompt = (prompt) => prompt.startsWith('You are summarising');
const isTopicPrompt = (prompt) => prompt.startsWith('You are mapping one topic');
const withoutAnalysis = ({ analysis: _analysis, ...question }) => question;

const runBuild = async ({ source = createSource(), provider, store = createStore(), config = {}, body = {}, now, attemptId, env = {} } = {}) => {
  const prompts = [];
  const timeouts = [];
  const result = await buildDebateAtlas({
    env,
    slug: 'atlas-session',
    config: { sessionName: 'Salon', ai: { model: 'test-model' }, ...config },
    body,
    builderAddress: RESULTS_ADMIN.toUpperCase().replace('0X', '0x'),
    ...(attemptId ? { attemptId } : {}),
    deps: {
      callBuildStore: store.callBuildStore,
      ...(source ? { loadSource: async () => source } : {}),
      getSessionSecrets: async () => ({}),
      loadParticipantContextSources: async () => [],
      ...(now ? { now } : {}),
      callProvider: async ({ prompt, deps: callDeps }) => {
        prompts.push(prompt);
        timeouts.push(callDeps.resultsAnalysisProviderTimeoutMs);
        return provider(prompt);
      },
    },
  });
  return { result, prompts, timeouts, store };
};

test('builds an atlas from a planning call, a call per topic and one per branch, each response reaching its topic and branch and no address', async () => {
  const source = createSource();
  const { result, prompts, store } = await runBuild({
    source,
    provider: async (prompt) => ({
      ok: true,
      value: isPlanPrompt(prompt) ? planFor(['q1', 'q2', 'q3', 'q4']) : isQuestionPrompt(prompt) ? questionReply : topicReply,
    }),
  });

  assert.equal(result.ok, true, result.error);
  assert.deepEqual(store.calls, ['reserve', 'finalize']);
  assert.equal(prompts.filter(isPlanPrompt).length, 1);
  const topicPrompts = prompts.filter(isTopicPrompt);
  const branchPrompts = prompts.filter(isBranchPrompt);
  const questionPrompts = prompts.filter(isQuestionPrompt);
  assert.equal(topicPrompts.length, 4);
  assert.equal(branchPrompts.length, 2);
  assert.equal(questionPrompts.length, 4);
  assert.equal(prompts.length, 11);
  // Topics, then branches, then questions, so a build short of time loses a
  // question's summary first and a branch compass next.
  assert.deepEqual(prompts.map((prompt) => (isPlanPrompt(prompt) ? 'plan' : isTopicPrompt(prompt) ? 'topic' : isBranchPrompt(prompt) ? 'branch' : 'question')),
    ['plan', 'topic', 'topic', 'topic', 'topic', 'branch', 'branch', 'question', 'question', 'question', 'question']);
  for (const response of source.aiSnapshot.responses) {
    assert.equal(topicPrompts.filter((prompt) => prompt.includes(response.answer)).length, 1, response.answer);
    assert.equal(branchPrompts.filter((prompt) => prompt.includes(response.answer)).length, 1, response.answer);
    // A question's call reads its own answers and no other question's.
    assert.deepEqual(questionPrompts.map((prompt) => prompt.includes(response.answer)),
      questionPrompts.map((prompt) => prompt.includes(`"id":"${response.questionId}"`)), response.answer);
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
  assert.deepEqual(build.questionSummaries, { listed: 4, summarised: 4, outOfTime: 0 });
  const topic = build.branches[0].topics[0];
  // Each category counts only those who answered the question, the most held first.
  assert.deepEqual(topic.questions, [{
    id: 'q1',
    prompt: 'Question 1?',
    type: 'freeform',
    analysis: {
      summary: 'Most want care.',
      categories: [{ label: 'Care first', summary: 'Slow and safe.', participantCount: 2 }, { label: 'Move now', participantCount: 1 }],
      answered: 3,
    },
  }]);
  assert.ok(build.branches.every((branch) => branch.topics.every((each) => each.questions.every((question) => question.analysis))));
  assert.ok(build.branches.every((branch) => !('analysis' in branch) && branch.topics.every((each) => !('analysis' in each))));
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
  const stored = await store.callBuildStore({}, 'atlas-session', 'read', {});
  assert.deepEqual(stored.body.build, build);
});

test('keeps the choices a topic question offers, so the atlas can show them', async () => {
  const source = createSource();
  const [, multichoice, quadratic] = source.aiSnapshot.questions;
  Object.assign(multichoice, { type: 'multichoice', options: ['Assemblies', 'Open data'] });
  Object.assign(quadratic, { type: 'quadratic', options: ['Parks', 'Roads'], voiceCredits: 25 });
  const { result } = await runBuild({
    source,
    provider: async (prompt) => ({ ok: true, value: isPlanPrompt(prompt) ? planFor(['q1', 'q2', 'q3', 'q4']) : topicReply }),
  });

  assert.equal(result.ok, true, result.error);
  const questions = result.build.branches.flatMap((branch) => branch.topics.flatMap((topic) => topic.questions));
  assert.deepEqual(questions.slice(0, 3).map(withoutAnalysis), [
    { id: 'q1', prompt: 'Question 1?', type: 'freeform' },
    { id: 'q2', prompt: 'Question 2?', type: 'multichoice', options: ['Assemblies', 'Open data'] },
    { id: 'q3', prompt: 'Question 3?', type: 'quadratic', options: ['Parks', 'Roads'], voiceCredits: 25 },
  ]);
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
  // The plan, 12 topics, the 2 branches and the 12 questions.
  assert.equal(prompts.length, 27);
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
    const read = await store.callBuildStore({}, 'atlas-session', 'read', {});
    assert.deepEqual(read.body.builds, []);
    assert.equal(read.body.active, null);
  }
});

test('refuses before any AI call when a build runs, AI is off, the input is thin, or the source is not stored', async () => {
  const busy = createStore();
  await busy.callBuildStore({}, 'atlas-session', 'reserve', {});
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
  assert.equal((await store.callBuildStore({}, 'atlas-session', 'read', {})).body.active, null);
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

const reply = (prompt) => (isPlanPrompt(prompt) ? null : isQuestionPrompt(prompt) ? questionReply : topicReply);

test('a question keeps its summary and categories counted among those who answered it, the most held first', () => {
  const answeredBy = new Set(['participant_001', 'participant_002', 'participant_003']);
  const many = Array.from({ length: 7 }, (_, index) => ({
    label: `Category ${index + 1}`,
    participantIds: ['participant_001', 'participant_002', 'participant_003', 'participant_999'].slice(0, (index % 3) + 1),
  }));
  const question = normalizeDebateAtlasQuestion({
    answeredBy,
    value: {
      summary: `Mostly agree; see ${address(9)}.`,
      categories: [
        ...many,
        { label: '', participantIds: ['participant_001'] },
        { label: 'Nobody here', participantIds: ['participant_999'] },
        { label: 'Repeats', summary: 'x'.repeat(500), participantIds: ['participant_001', 'participant_001'] },
      ],
    },
  });
  assert.equal(question.summary, 'Mostly agree; see [redacted-address].');
  assert.equal(question.answered, 3);
  assert.equal(question.categories.length, DEFAULTS.categories);
  assert.deepEqual(question.categories.map((category) => category.participantCount), [3, 3, 2, 2, 1]);
  assert.ok(question.categories.every((category) => category.participantCount <= question.answered && !category.label.startsWith('Nobody')));
  assert.equal(normalizeDebateAtlasQuestion({ answeredBy, value: { summary: 'S.', categories: [{ label: 'Repeats', summary: 'x'.repeat(500), participantIds: ['participant_001'] }] } })
    .categories[0].summary.length, 200);

  // A summary alone is kept; categories without a summary, nothing usable, or not an object, is no analysis.
  assert.deepEqual(normalizeDebateAtlasQuestion({ answeredBy, value: { summary: 'Split.', categories: 'many' } }), { summary: 'Split.', categories: [], answered: 3 });
  for (const value of [{}, { summary: '  ', categories: [{ label: 'Care', participantIds: ['participant_001'] }] }, 'Split.', null]) {
    assert.equal(normalizeDebateAtlasQuestion({ answeredBy, value }), null);
  }
});

test('question calls have a shorter limit, start after every map call, and are the first left out when time runs short', async () => {
  // Every call is answered at once; the clock jumps when the last branch call is made.
  let clock = 0;
  let branchesLeft = 2;
  const { result, prompts, timeouts } = await runBuild({
    now: () => clock,
    provider: async (prompt) => {
      if (isPlanPrompt(prompt)) return { ok: true, value: planFor(['q1', 'q2', 'q3', 'q4']) };
      if (isBranchPrompt(prompt) && (branchesLeft -= 1) === 0) clock = DEBATE_ATLAS_LIMITS.buildMs - DEBATE_ATLAS_LIMITS.minCallMs + 1;
      return { ok: true, value: reply(prompt) };
    },
  });
  assert.equal(result.ok, true, result.error);
  // The plan, 4 topics and 2 branches ran with the full limit; no question call started.
  assert.equal(prompts.length, 7);
  assert.equal(prompts.filter(isQuestionPrompt).length, 0);
  assert.deepEqual(timeouts, Array(7).fill(DEBATE_ATLAS_LIMITS.callMs));
  assert.deepEqual(result.build.missingTopics, []);
  assert.ok(result.build.branches.every((branch) => branch.compass && branch.topics.every((topic) => topic.questions.every((question) => !('analysis' in question)))));
  assert.deepEqual(result.build.questionSummaries, { listed: 4, summarised: 0, outOfTime: 4 });

  // With time to spare, each question call gets its own shorter limit, and less when the build has less left.
  clock = 0;
  const roomy = await runBuild({ now: () => clock, provider: async (prompt) => ({ ok: true, value: isPlanPrompt(prompt) ? planFor(['q1', 'q2', 'q3', 'q4']) : reply(prompt) }) });
  assert.deepEqual(roomy.timeouts, [...Array(7).fill(DEBATE_ATLAS_LIMITS.callMs), ...Array(4).fill(DEFAULTS.callSeconds * 1000)]);
  assert.ok(DEFAULTS.callSeconds * 1000 < DEBATE_ATLAS_LIMITS.callMs);
  // The setting can't go below the time a build needs left to start a call, nor above a call's limit.
  assert.equal(ATLAS_QUESTION_SUMMARY_SETTINGS.callSeconds.min * 1000, DEBATE_ATLAS_LIMITS.minCallMs);
  assert.equal(ATLAS_QUESTION_SUMMARY_SETTINGS.callSeconds.max * 1000, DEBATE_ATLAS_LIMITS.callMs);
  let late = 0;
  const squeezed = await runBuild({
    now: () => late,
    provider: async (prompt) => {
      if (isPlanPrompt(prompt)) return { ok: true, value: planFor(['q1', 'q2', 'q3', 'q4']) };
      if (isBranchPrompt(prompt)) late = DEBATE_ATLAS_LIMITS.buildMs - 30_000;
      return { ok: true, value: reply(prompt) };
    },
  });
  assert.deepEqual(squeezed.timeouts.slice(-4), Array(4).fill(30_000));
});

test('a question call reads every answer the build may read, not only the sample its topic call reads, within its caps', async () => {
  const source = createSource({ questionCount: 2 });
  const extra = Array.from({ length: DEFAULTS.answers + 10 }, (_, index) => ({
    participantId: `participant_${String(index + 4).padStart(3, '0')}`, questionId: 'q1', answer: `extra answer ${index}`,
  }));
  source.snapshot.responses.push(...extra);
  source.snapshot.responses.push({ participantId: 'participant_001', questionId: 'q2', answer: ['Parks 3', 'Roads -1'], additional: 'a note' });
  const plan = { title: 'Atlas', branches: [{ label: 'All', topics: [{ label: 'One', questionIds: ['q1'] }, { label: 'Two', questionIds: ['q2'] }] }] };
  const { result, prompts } = await runBuild({ source, provider: async (prompt) => ({ ok: true, value: isPlanPrompt(prompt) ? plan : reply(prompt) }) });
  assert.equal(result.ok, true, result.error);
  const [q1Prompt, q2Prompt] = prompts.filter(isQuestionPrompt);
  const q1Input = JSON.parse(q1Prompt.slice(q1Prompt.lastIndexOf('\n{')));
  assert.equal(q1Input.responses.length, DEFAULTS.answers);
  assert.ok(q1Input.responses.every((response) => Object.keys(response).join() === 'participantId,answer'));
  // The topic's own call still reads only the sample.
  assert.equal(prompts.filter(isTopicPrompt).some((prompt) => prompt.includes('extra answer')), false);
  assert.equal(result.build.branches[0].topics[0].questions[0].analysis.answered, DEFAULTS.answers);
  // A list answer reads as text, as in the sample.
  assert.deepEqual(JSON.parse(q2Prompt.slice(q2Prompt.lastIndexOf('\n{'))).responses.at(-1), { participantId: 'participant_001', answer: 'Parks 3; Roads -1', additional: 'a note' });

  // Long answers stop at the text cap, the last one cut, and only those read are counted.
  const long = createSource({ questionCount: 1 });
  long.snapshot.responses = Array.from({ length: 60 }, (_, index) => ({ participantId: `participant_${String(index + 1).padStart(3, '0')}`, questionId: 'q1', answer: 'x'.repeat(5000) }));
  const capped = await runBuild({
    source: long,
    provider: async (prompt) => ({ ok: true, value: isPlanPrompt(prompt) ? { title: 'A', branches: [{ label: 'B', topics: [{ label: 'T', questionIds: ['q1'] }] }] } : reply(prompt) }),
  });
  const longPrompt = capped.prompts.find(isQuestionPrompt);
  const read = JSON.parse(longPrompt.slice(longPrompt.lastIndexOf('\n{'))).responses;
  const whole = Math.floor(DEFAULTS.answerChars / 1400);
  assert.deepEqual(read.map((response) => response.answer.length), [...Array(whole).fill(1400), DEFAULTS.answerChars - whole * 1400]);
  assert.equal(capped.result.build.branches[0].topics[0].questions[0].analysis.answered, whole + 1);
});

test('a topic whose own call fails shows none of its questions, summarised or not', async () => {
  const { result } = await runBuild({
    provider: async (prompt) => {
      if (isPlanPrompt(prompt)) return { ok: true, value: planFor(['q1', 'q2', 'q3', 'q4']) };
      return isTopicPrompt(prompt) && prompt.includes('"Topic 1.2"') ? { ok: false, status: 502, error: 'upstream' } : { ok: true, value: reply(prompt) };
    },
  });
  assert.equal(result.ok, true, result.error);
  assert.deepEqual(result.build.missingTopics, ['Topic 1.2']);
  const shown = result.build.branches.flatMap((branch) => branch.topics.flatMap((topic) => topic.questions.map((question) => question.id)));
  assert.deepEqual(shown, ['q1', 'q3', 'q4']);
  assert.deepEqual(result.build.questionSummaries, { listed: 3, summarised: 3, outOfTime: 0 });
});

test('a failed question call leaves that question without a summary and the build whole', async () => {
  const { result } = await runBuild({
    provider: async (prompt) => {
      if (isPlanPrompt(prompt)) return { ok: true, value: planFor(['q1', 'q2', 'q3', 'q4']) };
      // As callAi passes on a provider that hit the call's limit.
      if (isQuestionPrompt(prompt) && prompt.includes('"id":"q2"')) return { ok: false, status: 502, error: 'AI results analysis generation timed out.' };
      return { ok: true, value: reply(prompt) };
    },
  });
  assert.equal(result.ok, true, result.error);
  assert.deepEqual(result.build.missingTopics, []);
  const questions = result.build.branches.flatMap((branch) => branch.topics.flatMap((topic) => topic.questions));
  assert.deepEqual(questions.map((question) => [question.id, 'analysis' in question]), [['q1', true], ['q2', false], ['q3', true], ['q4', true]]);
  // A call that ran out of its own time counts as out of time; one that failed otherwise, as neither.
  assert.deepEqual(result.build.questionSummaries, { listed: 4, summarised: 3, outOfTime: 1 });
  const failed = await runBuild({
    provider: async (prompt) => {
      if (isPlanPrompt(prompt)) return { ok: true, value: planFor(['q1', 'q2', 'q3', 'q4']) };
      return isQuestionPrompt(prompt) ? { ok: false, status: 502, error: 'upstream' } : { ok: true, value: reply(prompt) };
    },
  });
  assert.deepEqual(failed.result.build.questionSummaries, { listed: 4, summarised: 0, outOfTime: 0 });
});

test('a rate-limited question call costs only that summary: the map calls run and keep their limits', async () => {
  const { result, timeouts, prompts } = await runBuild({
    provider: async (prompt) => {
      if (isPlanPrompt(prompt)) return { ok: true, value: planFor(['q1', 'q2', 'q3', 'q4']) };
      return isQuestionPrompt(prompt) ? { ok: false, status: 429, error: 'rate limited' } : { ok: true, value: reply(prompt) };
    },
  });
  assert.equal(result.ok, true, result.error);
  assert.deepEqual(result.build.missingTopics, []);
  assert.ok(result.build.branches.every((branch) => branch.compass && branch.topics.every((topic) => topic.positions.length)));
  assert.deepEqual(timeouts.filter((_, index) => !isQuestionPrompt(prompts[index])), Array(7).fill(DEBATE_ATLAS_LIMITS.callMs));
  // Counted as neither summarised nor out of time.
  assert.deepEqual(result.build.questionSummaries, { listed: 4, summarised: 0, outOfTime: 0 });
});

test('a build summarises every question listed under its topics, with no ceiling of its own', async () => {
  const count = 45;
  const ids = Array.from({ length: count }, (_, index) => `q${index + 1}`);
  const { result, prompts } = await runBuild({
    source: createSource({ questionCount: count }),
    provider: async (prompt) => ({ ok: true, value: isPlanPrompt(prompt) ? planFor(ids, 2) : reply(prompt) }),
  });
  assert.equal(result.ok, true, result.error);
  assert.equal(prompts.filter(isQuestionPrompt).length, count);
  const questions = result.build.branches.flatMap((branch) => branch.topics.flatMap((topic) => topic.questions));
  assert.ok(questions.length === count && questions.every((question) => question.analysis));
  assert.deepEqual(result.build.questionSummaries, { listed: count, summarised: count, outOfTime: 0 });
});

test('the session setting sets each question call’s time, input and output; a bad stored value falls back to its default', async () => {
  const source = createSource({ questionCount: 1 });
  source.snapshot.responses = Array.from({ length: 30 }, (_, index) => ({ participantId: `participant_${String(index + 1).padStart(3, '0')}`, questionId: 'q1', answer: 'y'.repeat(100) }));
  const plan = { title: 'A', branches: [{ label: 'B', topics: [{ label: 'T', questionIds: ['q1'] }] }] };
  const long = {
    summary: 's'.repeat(2000),
    categories: Array.from({ length: 6 }, (_, index) => ({ label: `${index}${'l'.repeat(200)}`, summary: 'c'.repeat(500), participantIds: ['participant_001'] })),
  };
  const run = (atlasQuestionSummaries) => runBuild({
    source,
    config: { atlasQuestionSummaries },
    provider: async (prompt) => ({ ok: true, value: isPlanPrompt(prompt) ? plan : isQuestionPrompt(prompt) ? long : topicReply }),
  });
  const set = await run({ callSeconds: 25, answers: 20, answerChars: 1000, summaryChars: 150, categories: 2, labelChars: 30, categorySummaryChars: 0 });
  assert.equal(set.result.ok, true, set.result.error);
  assert.equal(set.timeouts[set.prompts.findIndex(isQuestionPrompt)], 25_000);
  const prompt = set.prompts.find(isQuestionPrompt);
  // 20 answers allowed, but only 10 of 100 characters fit in 1,000.
  assert.equal(JSON.parse(prompt.slice(prompt.lastIndexOf('\n{'))).responses.length, 10);
  assert.match(prompt, /under 150 characters in all/);
  assert.match(prompt, /1 to 2 distinct categories/);
  assert.equal(prompt.includes('on what these responses share'), false);
  const { analysis } = set.result.build.branches[0].topics[0].questions[0];
  assert.equal(analysis.summary.length, 150);
  assert.equal(analysis.answered, 10);
  assert.deepEqual(analysis.categories.map((category) => [category.label.length, 'summary' in category]), [[30, false], [30, false]]);

  // An answer and note longer than the whole cap are cut to it, not dropped.
  const first = createSource({ questionCount: 1 });
  first.snapshot.responses = ['participant_001', 'participant_002'].map((participantId) => ({ participantId, questionId: 'q1', answer: 'z'.repeat(1400), additional: 'n'.repeat(900) }));
  const cut = await runBuild({
    source: first,
    config: { atlasQuestionSummaries: { answerChars: 1000 } },
    provider: async (prompt) => ({ ok: true, value: isPlanPrompt(prompt) ? plan : isQuestionPrompt(prompt) ? long : topicReply }),
  });
  const cutPrompt = cut.prompts.find(isQuestionPrompt);
  assert.deepEqual(JSON.parse(cutPrompt.slice(cutPrompt.lastIndexOf('\n{'))).responses, [{ participantId: 'participant_001', answer: 'z'.repeat(1000) }]);
  assert.equal(cut.result.build.branches[0].topics[0].questions[0].analysis.answered, 1);

  // No categories at all, when the session wants a summary only.
  const none = await run({ categories: 0 });
  assert.match(none.prompts.find(isQuestionPrompt), /Leave "categories" empty\./);
  assert.deepEqual(none.result.build.branches[0].topics[0].questions[0].analysis.categories, []);

  // A value out of bounds (stored by an older path, say) is read as the default.
  const bad = await run({ callSeconds: 999, categories: -1, summaryChars: 'long' });
  assert.equal(bad.timeouts[bad.prompts.findIndex(isQuestionPrompt)], DEFAULTS.callSeconds * 1000);
  assert.equal(bad.result.build.branches[0].topics[0].questions[0].analysis.categories.length, DEFAULTS.categories);
  assert.equal(bad.result.build.branches[0].topics[0].questions[0].analysis.summary.length, DEFAULTS.summaryChars);
});

// Stored as the Worker keeps them: a session open to everyone, with answers
// it may never summarise beside the ones it may.
test('no call of a build reads an encrypted, restricted, withheld-audience or hidden-question answer', async () => {
  const sessionId = `0x${'a'.repeat(32)}`;
  const config = {
    slug: 'atlas-session', sessionIdHex: sessionId, sessionName: 'Atlas session', ai: { model: 'test-model' },
    sessionModeProfile: { authority: { mode: 'worker_canonical' }, storage: { backend: 'cloudflare' } },
    storageProfile: { backend: 'cloudflare', payloadAccessControl: { gate: 'none', encryption: 'none' } },
    BLOCKED_QUESTION_IDS: ['blocked'],
  };
  const values = new Map();
  const kv = {
    get: async (key) => (Array.isArray(key) ? new Map(key.map((name) => [name, values.get(name) ?? null])) : values.get(key) ?? null),
    put: async (key, value) => { values.set(key, value); },
    list: async ({ prefix = '' } = {}) => ({ keys: [...values.keys()].filter((name) => name.startsWith(prefix)).sort().map((name) => ({ name })), list_complete: true }),
  };
  const put = async (resource, id, payload, metadata = {}) => {
    const full = { id, resource, backend: 'cloudflare', contentType: 'application/json', encrypted: false, createdAt: '2026-11-20T00:00:00.000Z', ...metadata };
    await kv.put(buildIndexKey({ slug: 'atlas-session', resource, id }), JSON.stringify(full));
    await kv.put(buildPayloadKey({ slug: 'atlas-session', id }), JSON.stringify({ metadata: full, payloadBase64url: Buffer.from(JSON.stringify(payload)).toString('base64url') }));
  };
  const question = (questionId) => put('questions', `ref-${questionId}`, { sessionSlug: 'atlas-session', sessionId, id: questionId, prompt: `Prompt ${questionId}?`, type: 'freeform' }, { resourceId: questionId });
  for (const id of ['open', 'blocked', 'flagged']) await question(id);
  await kv.put('ce-storage-hidden:atlas-session:questions:flagged', JSON.stringify({ version: 1, hidden: true }));
  const answer = (id, digit, questionId, text, metadata = {}) => put('responses', id,
    { sessionSlug: 'atlas-session', sessionId, questionId, answer: text }, { responder: `0x${digit.repeat(40)}`, ...metadata });
  await answer('r1', '1', 'open', 'Open answer one');
  await answer('r2', '2', 'open', 'Open answer two');
  await answer('r3', '3', 'open', 'Open answer three');
  await answer('r4', '4', 'open', 'SECRET encrypted answer', { encrypted: true });
  await answer('r5', '5', 'open', 'SECRET admins-only answer', { accessConditions: { match: 'any', conditions: [{ kind: 'role', role: 'admin' }] } });
  await answer('r6', '6', 'open', 'SECRET narrower answer', { payloadAccessControl: { gate: 'sbt', encryption: 'none' } });
  await answer('r7', '1', 'blocked', 'SECRET answer to a hidden question');
  await answer('r8', '2', 'flagged', 'SECRET answer to a flagged question');

  const { result, prompts } = await runBuild({
    source: null,
    env: { CE_STORAGE_INDEX_KV: kv },
    config,
    provider: async (prompt) => ({
      ok: true,
      value: isPlanPrompt(prompt) ? { title: 'Atlas', branches: [{ label: 'All', topics: [{ label: 'Open', questionIds: ['open', 'blocked', 'flagged'] }] }] } : reply(prompt),
    }),
  });
  assert.equal(result.ok, true, result.error);
  assert.equal(prompts.filter(isQuestionPrompt).length, 1);
  for (const prompt of prompts) {
    assert.equal(prompt.includes('SECRET'), false);
    assert.equal(/blocked|flagged/.test(prompt), false);
  }
  const questionPrompt = prompts.find(isQuestionPrompt);
  assert.ok(['one', 'two', 'three'].every((word) => questionPrompt.includes(`Open answer ${word}`)));
  const [topic] = result.build.branches[0].topics;
  assert.deepEqual(topic.questions.map((entry) => entry.id), ['open']);
  assert.equal(topic.questions[0].analysis.answered, 3);
});

// The store is shape-blind; this records that both shapes go in and come out
// as given. The way-back drill checks released Workers read them.
test('the build store keeps a build with or without question summaries as given', async () => {
  const store = createStore();
  const before = { title: 'Atlas', missingTopics: [], branches: [{ id: 'b1', label: 'B', topics: [{ id: 'b1t1', label: 'T', questions: [{ id: 'q1', prompt: 'Q?', type: 'freeform' }] }] }] };
  const after = structuredClone(before);
  after.branches[0].topics[0].questions[0].analysis = { summary: 'Split.', categories: [{ label: 'Care', participantCount: 1 }], answered: 2 };
  for (const build of [{ id: 'atlas_old_00000001', ...before }, { id: 'atlas_new_00000002', ...after }]) {
    const { attemptId } = (await store.callBuildStore({}, 'atlas-session', 'reserve', {})).body;
    assert.equal((await store.callBuildStore({}, 'atlas-session', 'finalize', { attemptId, build })).ok, true);
  }
  for (const [id, expected] of [['atlas_old_00000001', before], ['atlas_new_00000002', after]]) {
    const read = await store.callBuildStore({}, 'atlas-session', 'read', { id });
    assert.deepEqual(read.body.build, { id, ...expected });
  }
});

test('runWithConcurrency keeps order', async () => {
  const results = await runWithConcurrency([30, 10, 20], 2, async (delay, index) => {
    await new Promise((resolve) => setTimeout(resolve, delay));
    return index;
  });
  assert.deepEqual(results, [0, 1, 2]);
});

const json = (body, status = 200, headers = {}) => new Response(JSON.stringify(body), { status, headers });
const readAtlas = async ({ config, address: requester = '', validateAdmin = async () => false, id = '', job = null } = {}) => {
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
      callBuildStore: async (_env, _slug, operation, payload) => {
        storeCalls.push([operation, payload]);
        return { ok: true, status: 200, body: { ok: true, builds: [], build: null, active: null, ...(job ? { job } : {}) } };
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

test('the plan prompt asks for distinct branches of linked topics, with short, clear labels', () => {
  const prompt = buildDebateAtlasPlanPrompt({ sessionName: 'Salon', questions: [{ id: 'q1', prompt: 'Cap rents?', type: 'binary', responses: 3 }] });
  // The reply's shape and limits are as before: the branch labels' rule is the only change.
  assert.ok(prompt.includes(`2 to ${DEBATE_ATLAS_LIMITS.branches} branches`) && prompt.includes(`at most ${DEBATE_ATLAS_LIMITS.topics} topics in all`));
  assert.ok(prompt.includes('{ "title": "short atlas title", "branches": [{ "label": "2-5 word branch name", "summary": "one neutral sentence", "topics": [{ "label": "2-6 word topic name", "questionIds": ["q1"] }] }] }'));
  const rules = prompt.split('\nRules:\n')[1].split('\n\n')[0].split('\n');
  const branchRules = rules.filter((rule) => rule.startsWith('- Branch labels'));
  assert.equal(branchRules.length, 1);
  assert.match(branchRules[0], /short and clear/);
  assert.match(branchRules[0], /not a list/);
  assert.match(branchRules[0], /No two share a main word or mean nearly the same/);
  assert.match(branchRules[0], /none is a catch-all/);
  // Topics keep their one naming rule, and the rules stay ahead of the session's own text.
  assert.ok(rules.includes('- Name branches and topics after what the questions ask, in plain words.'));
  assert.ok(prompt.indexOf('- Branch labels') < prompt.indexOf('Session: "Salon"'));
  // The opening says what a session is in plain words, with no product name a model would not know.
  const [opening, grouping] = prompt.split('\n');
  assert.match(opening, /^You are planning a debate atlas for a group sensemaking session: /);
  assert.ok(!prompt.includes('Context Engine'));
  // Branches: distinct from one another, their topics linked; a topic is defined as before.
  assert.match(grouping, /Branches are the atlas's top level/);
  assert.match(grouping, /logically distinct from the others/);
  assert.match(grouping, /topics inside one share a clear link/);
  assert.ok(grouping.includes('A topic gathers questions people can disagree about along the same lines.'));
});

test('only those who may build are told how the latest build went, a failure with why', async () => {
  const failed = { jobId: 'job1', state: 'done', startedAtMs: 1, finishedAtMs: 2, outcome: { ok: false, status: 422, error: 'Too few answers to build from.', reason: 'thin' } };
  assert.equal((await readAtlas({ config: publicResults, job: failed })).body.job, undefined);
  assert.equal((await readAtlas({ config: publicResults, address: address(8), job: failed })).body.job, undefined);
  const read = (job) => readAtlas({ config: privateResults, address: RESULTS_ADMIN, job }).then(({ body }) => body.job);
  assert.deepEqual(await read(failed), { jobId: 'job1', state: 'done', startedAtMs: 1, finishedAtMs: 2, ok: false, error: 'Too few answers to build from.' });
  assert.deepEqual(
    await read({ jobId: 'job2', state: 'done', startedAtMs: 3, finishedAtMs: 4, outcome: { ok: true, status: 200, buildId: 'atlas_k1_00000001' } }),
    { jobId: 'job2', state: 'done', startedAtMs: 3, finishedAtMs: 4, ok: true, buildId: 'atlas_k1_00000001' },
  );
  assert.deepEqual(await read({ jobId: 'job3', state: 'running', startedAtMs: 5 }), { jobId: 'job3', state: 'running', startedAtMs: 5 });
  assert.equal(await read(null), undefined);
});

test('the next build is described with the session model and placeholder prompts', () => {
  const next = describeNextDebateAtlasBuild({ sessionName: 'Salon', ai: { models: { thinking: 'deep-model' } } });
  assert.equal(next.model, 'deep-model');
  assert.ok(next.prompts.plan.startsWith('You are planning') && next.prompts.plan.includes('"Salon"'));
  assert.match(next.prompts.plan, /\n<Questions>\n/);
  assert.match(next.prompts.map, /\{"questions":<Questions>,"responses":<Responses>,"placeParticipants":<Participants>\}$/);
  assert.match(next.prompts.question, /^You are summarising/);
  assert.deepEqual(next.questionSummaries, DEFAULTS);
  const own = describeNextDebateAtlasBuild({ atlasQuestionSummaries: { summaryChars: 250, categories: 0 } });
  assert.deepEqual(own.questionSummaries, { ...DEFAULTS, summaryChars: 250, categories: 0 });
  assert.match(own.prompts.question, /under 250 characters in all[\s\S]*Leave "categories" empty\./);
  assert.match(next.prompts.question, /\{"question":<Question>,"responses":<Responses>\}$/);
  assert.ok(!/"</.test(next.prompts.plan + next.prompts.map + next.prompts.question));
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
      pressResultsBuild: async ({ builderAddress }) => {
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
  assert.equal((await dispatchAs({ action: 'set-secrets', signer: RESULTS_ADMIN, config })).status, 403);
});

test('a build its job runs uses the lease the job holds, and ends it even when the session no longer allows the build', async () => {
  const provider = async (prompt) => ({ ok: true, value: isPlanPrompt(prompt) ? planFor(['q1', 'q2', 'q3', 'q4']) : topicReply });
  const store = createStore();
  const held = await store.callBuildStore({}, 'atlas-session', 'reserve', {});
  const { result } = await runBuild({ provider, store, attemptId: held.body.attemptId });
  assert.equal(result.ok, true, result.error);
  assert.deepEqual(store.calls, ['reserve', 'finalize'], 'no second lease is taken');
  assert.equal((await store.callBuildStore({}, 'atlas-session', 'read', {})).body.build.id, result.build.id);

  const off = createStore();
  const offHeld = await off.callBuildStore({}, 'atlas-session', 'reserve', {});
  const { result: refused, prompts } = await runBuild({ provider, store: off, attemptId: offHeld.body.attemptId, config: { scopes: { ai: false } } });
  assert.deepEqual([refused.ok, refused.status], [false, 403]);
  assert.equal(prompts.length, 0);
  assert.deepEqual(off.calls, ['reserve', 'finalize']);
  assert.equal((await off.callBuildStore({}, 'atlas-session', 'read', {})).body.active, null);
});
