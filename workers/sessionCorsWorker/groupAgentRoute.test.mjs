import test from 'node:test';
import assert from 'node:assert/strict';

import { evaluateAuthenticatedRoutePreflight } from './authenticatedRoutePreflight.js';
import { resolveAuthenticatedRouteSecrets } from './authenticatedRouteSecretsResolution.js';
import { dispatchAuthenticatedSecretActionRoute } from './authenticatedSecretActionRouteDispatch.js';
import { groupLockedAccess } from '../../shared/sessionContextSources.mjs';
import { ADMIN, PARTICIPANT, harness, idOf, json } from './contextSourceTestFixture.mjs';

const MEMBER = `0x${'3'.repeat(40)}`;
const encode = (text) => new TextEncoder().encode(text);
const everyone = { match: 'any', conditions: [{ kind: 'agent_grant_scope', scope: 'ai' }] };
const salonMembers = { match: 'any', conditions: [{ kind: 'worker_group', groupIds: ['salon'] }] };
const twoAudiences = { audiences: [{ who: salonMembers, answers: 'detailed' }, { who: everyone, answers: 'general' }] };

// One file of each reach, published results, and one member's answer. The
// capitalized words mark each piece, so a prompt shows what it was given.
const seeded = async (groupAgent = twoAudiences) => {
  const h = harness();
  h.state.config.sessionContext = { title: 'Context', paragraphs: ['CONTEXT for everyone.'], links: [] };
  await idOf(await h.uploadFile({ name: 'agenda.md', type: 'text/markdown', bytes: encode('OPEN agenda') }));
  await idOf(await h.uploadFile({ name: 'board.txt', type: 'text/plain', bytes: encode('ADMINS plan'), adminsOnly: true }));
  await idOf(await h.uploadFile({
    name: 'group.txt',
    type: 'text/plain',
    bytes: encode('GROUP notes'),
    extra: { accessConditions: JSON.stringify(groupLockedAccess(['salon'])) },
  }));
  if (groupAgent) h.state.config.groupAgent = groupAgent;
  return h;
};

const ask = async (h, {
  path = '/group-agent/ask',
  address = PARTICIPANT,
  body = { question: 'What do people want?' },
  current = { ai: true },
  provider = () => json({ completion: 'They want shorter meetings.', raw: { id: 'RAW provider data' } }),
  deps = {},
} = {}) => {
  const calls = { ai: [], rate: [] };
  const { handled, response } = await dispatchAuthenticatedSecretActionRoute({
    path,
    action: 'ai',
    body,
    config: h.state.config,
    slug: 'salon',
    address,
    env: h.env,
    limit: 10,
    headers: {},
    scopes: { ai: true, storage: true },
    deps: {
      ...h.deps,
      evaluateAuthenticatedRoutePreflight,
      resolveAuthenticatedRouteSecrets,
      computeScopesForLogin: async () => current,
      checkRateLimit: async ({ route }) => { calls.rate.push(route); return true; },
      isWorkerGroupMember: async ({ groupId, requesterAddress }) => (groupId === 'salon' && requesterAddress === MEMBER
        ? { ok: true }
        : { ok: false, status: 403, reason: 'worker_group_membership_denied' }),
      evaluateResultsAnalysisViewerEligibility: () => ({ ok: true }),
      readPublishedResultsAnalysisArtifact: async () => ({
        ok: true,
        artifact: { sections: { overview: { available: true, overview: 'RESULTS: shorter meetings.' } } },
      }),
      loadWorkerCanonicalResultsAnalysisSource: async () => ({
        ok: true,
        aiSnapshot: {
          responses: [{ questionId: 'q1', questionPrompt: 'What should change?', answer: 'ANSWER meet less', participantId: 'participant_001' }],
        },
        participantAddresses: new Map([['participant_001', MEMBER]]),
      }),
      proxyAnthropic: async ({ payload }) => { calls.ai.push(payload); return provider(payload); },
      ...deps,
    },
  });
  assert.equal(handled, true);
  const prompt = calls.ai[0]?.messages.map((message) => message.content).join('\n') || '';
  return { status: response.status, body: await response.json(), calls, prompt };
};

test('with no setting the Group Agent is off: status says so, and a question is refused before the AI', async () => {
  const h = await seeded(null);
  assert.deepEqual((await ask(h, { path: '/group-agent/status', body: {} })).body, { on: false, answers: null, audience: null });
  const refused = await ask(h);
  assert.equal(refused.status, 403);
  assert.equal(refused.body.reason, 'group_agent_off');
  assert.deepEqual(refused.calls.ai, []);
});

test('the first audience that admits someone sets their answers, admins get Detailed, and the reply names the audience', async () => {
  const h = await seeded();
  const status = async (address) => (await ask(h, { path: '/group-agent/status', body: {}, address })).body;
  assert.deepEqual(await status(MEMBER), { on: true, answers: 'detailed', audience: 0, optedOut: false });
  assert.deepEqual(await status(PARTICIPANT), { on: true, answers: 'general', audience: 1, optedOut: false });
  assert.deepEqual(await status(ADMIN), { on: true, answers: 'detailed', audience: 'admin', optedOut: false });
  // The path decides, whatever action the body names.
  const answered = await ask(h, { address: MEMBER });
  assert.equal(answered.status, 200);
  assert.deepEqual([answered.body.answers, answered.body.audience], ['detailed', 0]);
});

test('no audience admits someone whose AI access has lapsed, or who is in no listed group', async () => {
  const lapsed = await ask(await seeded({ audiences: [{ who: everyone, answers: 'general' }] }), { current: { ai: false } });
  assert.equal(lapsed.status, 403);
  assert.equal(lapsed.body.reason, 'group_agent_not_admitted');
  assert.deepEqual(lapsed.calls.ai, []);
  const h = await seeded({ audiences: [{ who: salonMembers, answers: 'general' }] });
  assert.deepEqual((await ask(h, { path: '/group-agent/status', body: {} })).body, { on: true, answers: null, audience: null, optedOut: false });
  const outsider = await ask(h);
  assert.equal(outsider.status, 403);
  assert.deepEqual(outsider.calls.ai, []);
});

test('a group check that fails before any audience admits refuses with 503, since the answers are unknown', async () => {
  const h = await seeded();
  const deps = { isWorkerGroupMember: async () => { throw new Error('coordinator down'); } };
  assert.equal((await ask(h, { path: '/group-agent/status', body: {}, deps })).status, 503);
  const refused = await ask(h, { deps });
  assert.equal(refused.status, 503);
  assert.deepEqual(refused.calls.ai, []);
});

test('an SBT check the chain can’t answer refuses with 503, rather than passing to a later audience', async () => {
  const holders = { match: 'any', conditions: [{ kind: 'sbt_onchain', chainId: 84532, contract: `0x${'c'.repeat(40)}`, anyOrAll: 'any' }] };
  const h = await seeded({ audiences: [{ who: holders, answers: 'general' }, { who: everyone, answers: 'detailed' }] });
  const chain = (answer) => ({ resolveRpcUrlListForGate: () => ['https://rpc.example.test'], checkSbtGate: async () => answer });
  assert.equal((await ask(h, { path: '/group-agent/status', body: {}, deps: chain(null) })).status, 503);
  const refused = await ask(h, { deps: chain(null) });
  assert.equal(refused.status, 503);
  assert.deepEqual(refused.calls.ai, []);
  // Once the chain answers, a holder gets the holders' style, and anyone else the next audience's.
  assert.equal((await ask(h, { deps: chain(true) })).body.answers, 'general');
  assert.equal((await ask(h, { deps: chain(false) })).body.answers, 'detailed');
});

test('General answers read the context, open files and visible results, never answers or locked files', async () => {
  const general = await ask(await seeded());
  assert.equal(general.status, 200);
  assert.deepEqual([general.body.answers, general.body.audience], ['general', 1]);
  for (const piece of ['CONTEXT', 'OPEN agenda', 'RESULTS', 'What do people want?']) assert.match(general.prompt, new RegExp(piece));
  for (const piece of ['GROUP notes', 'ADMINS plan', 'ANSWER']) assert.doesNotMatch(general.prompt, new RegExp(piece));
  assert.equal(general.body.read.answers, 0);
  assert.equal(general.calls.ai[0].taskType, 'group-agent');
  assert.equal(general.calls.ai[0].model, 'claude-sonnet-5-5');
  assert.deepEqual(general.calls.rate, ['ai']);
  // The style decides, not what the asker could open: a member of the
  // file's group who gets General answers still gets none of it.
  const member = await ask(await seeded({ audiences: [{ who: salonMembers, answers: 'general' }] }), { address: MEMBER });
  assert.equal(member.body.answers, 'general');
  assert.match(member.prompt, /OPEN agenda/);
  for (const piece of ['GROUP notes', 'ANSWER']) assert.doesNotMatch(member.prompt, new RegExp(piece));
});

test('Detailed answers add what the asker may read and members’ answers, and never a participant’s label or address', async () => {
  const h = await seeded();
  const member = await ask(h, { address: MEMBER });
  for (const piece of ['OPEN agenda', 'GROUP notes', 'RESULTS', 'ANSWER meet less', 'What should change?']) {
    assert.match(member.prompt, new RegExp(piece));
  }
  for (const piece of ['ADMINS plan', 'participant_001', MEMBER]) assert.doesNotMatch(member.prompt, new RegExp(piece));
  assert.equal(member.body.read.answers, 1);
  const admin = await ask(h, { address: ADMIN });
  for (const piece of ['ADMINS plan', 'GROUP notes', 'ANSWER meet less']) assert.match(admin.prompt, new RegExp(piece));
  // Answers that can't be read leave them out, and the reply says so.
  const unread = await ask(h, { address: MEMBER, deps: { loadWorkerCanonicalResultsAnalysisSource: async () => ({ ok: false }) } });
  assert.equal(unread.status, 200);
  assert.doesNotMatch(unread.prompt, /ANSWER/);
  assert.match(unread.body.note, /couldn’t be read/);
});

test('results reach a non-admin’s answer only where the page shows them results', async () => {
  const h = await seeded();
  const deps = { evaluateResultsAnalysisViewerEligibility: () => ({ ok: false }) };
  assert.doesNotMatch((await ask(h, { address: MEMBER, deps })).prompt, /RESULTS/);
  assert.match((await ask(h, { address: ADMIN, deps })).prompt, /RESULTS/);
  const unreadable = { authorizeCloudflareStorageResourceRead: async ({ resource }) => ({ ok: resource !== 'responses' }) };
  assert.doesNotMatch((await ask(h, { deps: unreadable })).prompt, /RESULTS/);
});

test('the payment step sees only who is asking, after the material is fixed, and a refusal stops the AI call', async () => {
  const seen = [];
  const refused = await ask(await seeded(), {
    address: MEMBER,
    deps: { checkGroupAgentPayment: async (value) => { seen.push(value); return { ok: false }; } },
  });
  assert.equal(refused.status, 402);
  assert.deepEqual(seen, [{ audience: 0, answers: 'detailed' }]);
  assert.deepEqual(refused.calls.ai, []);
});

test('questions share the /ai rate limit', async () => {
  const limited = await ask(await seeded(), { deps: { checkRateLimit: async () => false } });
  assert.equal(limited.status, 429);
  assert.deepEqual(limited.calls.ai, []);
});

test('the reply is the model’s text alone, clipped, and failures never come back as a 401', async () => {
  const h = await seeded();
  const answered = await ask(h);
  assert.equal(answered.body.answer, 'They want shorter meetings.');
  assert.doesNotMatch(JSON.stringify(answered.body), /RAW|raw/);
  const long = await ask(h, { provider: () => json({ completion: 'word '.repeat(600) }) });
  assert.equal(long.body.answer.length, 1500);
  assert.equal((await ask(h, { provider: () => json({ error: 'bad key' }, 401) })).status, 502);
  assert.equal((await ask(h, { provider: () => json({ error: 'slow down' }, 429) })).status, 429);
  assert.equal((await ask(h, { provider: () => json({ completion: '  ' }) })).status, 502);
  const unset = await ask(h, { deps: { getSessionSecrets: async () => null } });
  assert.equal(unset.status, 503);
  assert.deepEqual(unset.calls.ai, []);
});

test('a question must be there and short, and an ended session or AI turned off answers none', async () => {
  const h = await seeded();
  assert.equal((await ask(h, { body: { question: '   ' } })).status, 400);
  assert.equal((await ask(h, { body: { question: 'x'.repeat(501) } })).status, 400);
  assert.equal((await ask(h, { body: { question: 'x'.repeat(500) } })).status, 200);
  h.state.config.scopes = { ai: false };
  const off = await ask(h);
  assert.deepEqual([off.status, off.body.reason], [403, 'ai_disabled']);
  h.state.config.scopes = {};
  h.state.config.sessionEndsAt = '2020-01-01T00:00:00.000Z';
  const ended = await ask(h);
  assert.equal(ended.status, 410);
  assert.deepEqual(ended.calls.ai, []);
});

test('each person can turn off the Group Agent’s use of their answers and files, and turn it back on', async () => {
  const h = await seeded();
  const optOut = (address, optedOut) => ask(h, { path: '/group-agent/opt-out', address, body: { optedOut } });
  assert.deepEqual((await optOut(MEMBER, true)).body, { optedOut: true });
  assert.equal((await ask(h, { path: '/group-agent/status', body: {}, address: MEMBER })).body.optedOut, true);
  assert.doesNotMatch((await ask(h, { address: ADMIN })).prompt, /ANSWER/);
  // The admin added the files: opted out, they leave every answer, but the
  // session's own context stays.
  await optOut(ADMIN, true);
  const general = await ask(h);
  assert.doesNotMatch(general.prompt, /OPEN agenda/);
  assert.match(general.prompt, /CONTEXT/);
  await optOut(MEMBER, false);
  await optOut(ADMIN, false);
  const admin = await ask(h, { address: ADMIN });
  for (const piece of ['ANSWER meet less', 'OPEN agenda', 'ADMINS plan']) assert.match(admin.prompt, new RegExp(piece));
  assert.equal((await optOut(MEMBER, 'yes')).status, 400);
});

test('answers without an address stay out, and no question goes ahead when opt-outs can’t be read', async () => {
  const h = await seeded();
  const anonymous = await ask(h, {
    address: ADMIN,
    deps: {
      loadWorkerCanonicalResultsAnalysisSource: async () => ({
        ok: true,
        aiSnapshot: { responses: [{ questionId: 'q1', questionPrompt: 'What should change?', answer: 'ANSWER from no one', participantId: 'participant_001' }] },
        participantAddresses: new Map(),
      }),
    },
  });
  assert.doesNotMatch(anonymous.prompt, /ANSWER/);
  const down = async () => ({ ok: false, status: 503, body: {} });
  const refused = await ask(h, { deps: { callGroupAgentOptOutStore: down } });
  assert.equal(refused.status, 503);
  assert.deepEqual(refused.calls.ai, []);
  assert.equal((await ask(h, { path: '/group-agent/status', body: {}, deps: { callGroupAgentOptOutStore: down } })).status, 503);
  assert.equal((await ask(h, { path: '/group-agent/opt-out', body: { optedOut: true }, deps: { callGroupAgentOptOutStore: down } })).status, 503);
});
