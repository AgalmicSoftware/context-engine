import test from 'node:test';
import assert from 'node:assert/strict';

import { evaluateAuthenticatedRoutePreflight } from './authenticatedRoutePreflight.js';
import { resolveAuthenticatedRouteSecrets } from './authenticatedRouteSecretsResolution.js';
import { dispatchAuthenticatedSecretActionRoute } from './authenticatedSecretActionRouteDispatch.js';
import { groupLockedAccess } from '../../shared/sessionContextSources.mjs';
import { ADMIN, PARTICIPANT, harness, idOf, json } from './contextSourceTestFixture.mjs';
import { dispatchSessionAgentHistoryStore, listSessionAgentHistory } from './sessionAgentHistory.js';
import { SESSION_AGENT_SIGNED_OUT, dispatchSessionAgentRoute, resultsQuestions } from './sessionAgentRoute.js';
import { getStorageIndexBinding } from './storageKvBindings.js';
import { hiddenStorageResourcePrefix } from './storageResourceOwnership.js';
import { createDurableStorage } from './workerGroupTestFixture.mjs';

const MEMBER = `0x${'3'.repeat(40)}`;
const encode = (text) => new TextEncoder().encode(text);
const everyone = { match: 'any', conditions: [{ kind: 'agent_grant_scope', scope: 'ai' }] };
const salonMembers = { match: 'any', conditions: [{ kind: 'worker_group', groupIds: ['salon'] }] };
const twoAudiences = { audiences: [{ who: salonMembers, answers: 'detailed' }, { who: everyone, answers: 'general' }] };

// One file of each reach, published results, and one member's answer. The
// capitalized words mark each piece, so a prompt shows what it was given.
const seeded = async (sessionAgent = twoAudiences) => {
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
  if (sessionAgent) h.state.config.sessionAgent = sessionAgent;
  return h;
};

const ask = async (h, {
  path = '/session-agent/ask',
  address = PARTICIPANT,
  body = { question: 'What do people want?' },
  scopes = { ai: true, storage: true },
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
    scopes,
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
        snapshot: {
          questions: [{ id: 'q1', prompt: 'What should change?', type: 'text' }],
          responses: [{ questionId: 'q1', answer: 'ANSWER meet less', participantId: 'participant_001' }],
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

test('with no setting the Session Agent is off: status says so, and a question is refused before the AI', async () => {
  const h = await seeded(null);
  assert.deepEqual((await ask(h, { path: '/session-agent/status', body: {} })).body, { on: false, answers: null, audience: null });
  const refused = await ask(h);
  assert.equal(refused.status, 403);
  assert.equal(refused.body.reason, 'session_agent_off');
  assert.deepEqual(refused.calls.ai, []);
});

test('the first audience that admits someone sets their answers, admins get Detailed, and the reply names the audience', async () => {
  const h = await seeded();
  const status = async (address) => (await ask(h, { path: '/session-agent/status', body: {}, address })).body;
  assert.deepEqual(await status(MEMBER), { on: true, answers: 'detailed', audience: 0, optedOut: false, unattributed: false, recording: false });
  assert.deepEqual(await status(PARTICIPANT), { on: true, answers: 'general', audience: 1, optedOut: false, unattributed: false, recording: false });
  assert.deepEqual(await status(ADMIN), { on: true, answers: 'detailed', audience: 'admin', optedOut: false, unattributed: false, recording: false });
  // The path decides, whatever action the body names.
  const answered = await ask(h, { address: MEMBER });
  assert.equal(answered.status, 200);
  assert.deepEqual([answered.body.answers, answered.body.audience], ['detailed', 0]);
});

test('every asker needs the session’s AI access, whichever audience would admit them, admins included', async () => {
  const h = await seeded();
  // A group member whose AI access lapsed after signing in, as on /ai.
  const lapsed = await ask(h, { address: MEMBER, current: { ai: false } });
  assert.equal(lapsed.status, 403);
  assert.equal(lapsed.body.reason, 'session_agent_not_admitted');
  assert.deepEqual(lapsed.calls.ai, []);
  for (const address of [MEMBER, ADMIN]) {
    const withoutAi = { address, scopes: { storage: true } };
    assert.deepEqual((await ask(h, { ...withoutAi, path: '/session-agent/status', body: {} })).body, {
      on: true, answers: null, audience: null, optedOut: false, unattributed: false, recording: false,
    });
    const refused = await ask(h, withoutAi);
    assert.deepEqual([refused.status, refused.body.reason], [403, 'session_agent_not_admitted']);
    assert.deepEqual(refused.calls.ai, []);
  }
});

test('no audience admits someone in no listed group', async () => {
  const h = await seeded({ audiences: [{ who: salonMembers, answers: 'general' }] });
  assert.deepEqual((await ask(h, { path: '/session-agent/status', body: {} })).body, { on: true, answers: null, audience: null, optedOut: false, unattributed: false, recording: false });
  const outsider = await ask(h);
  assert.equal(outsider.status, 403);
  assert.deepEqual(outsider.calls.ai, []);
});

test('a group check that fails before any audience admits refuses with 503, since the answers are unknown', async () => {
  const h = await seeded();
  const deps = { isWorkerGroupMember: async () => { throw new Error('coordinator down'); } };
  assert.equal((await ask(h, { path: '/session-agent/status', body: {}, deps })).status, 503);
  const refused = await ask(h, { deps });
  assert.equal(refused.status, 503);
  assert.deepEqual(refused.calls.ai, []);
});

test('an SBT check the chain can’t answer refuses with 503, rather than passing to a later audience', async () => {
  const holders = { match: 'any', conditions: [{ kind: 'sbt_onchain', chainId: 84532, contract: `0x${'c'.repeat(40)}`, anyOrAll: 'any' }] };
  const h = await seeded({ audiences: [{ who: holders, answers: 'general' }, { who: everyone, answers: 'detailed' }] });
  const chain = (answer) => ({ resolveRpcUrlListForGate: () => ['https://rpc.example.test'], checkSbtGate: async () => answer });
  assert.equal((await ask(h, { path: '/session-agent/status', body: {}, deps: chain(null) })).status, 503);
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
  assert.equal(general.calls.ai[0].taskType, 'session-agent');
  assert.equal(general.calls.ai[0].model, 'claude-sonnet-5-5');
  assert.deepEqual(general.calls.rate, ['ai']);
  // The style decides, not what the asker could open: a member of the
  // file's group who gets General answers still gets none of it.
  const member = await ask(await seeded({ audiences: [{ who: salonMembers, answers: 'general' }] }), { address: MEMBER });
  assert.equal(member.body.answers, 'general');
  assert.match(member.prompt, /OPEN agenda/);
  for (const piece of ['GROUP notes', 'ANSWER']) assert.doesNotMatch(member.prompt, new RegExp(piece));
});

const NOT_ALL_READ = 'Some of the session’s context wasn’t read: the Session Agent reads at most 320,000 characters or 48 items of it, and 12,000 characters of any one.';

test('an answer says when some of the session’s context wasn’t read', async () => {
  const h = await seeded();
  const fitted = await ask(h);
  assert.equal(fitted.body.note, undefined, 'all of it fitted');
  // Long notes: the Session Agent reads each to 12,000 characters, and 320,000 in all.
  const names = Array.from({ length: 28 }, (_, index) => `LONG${String(index).padStart(2, '0')}`);
  for (const name of names) {
    await idOf(await h.uploadFile({ name: `${name}.md`, type: 'text/markdown', bytes: encode(`${name} `.repeat(1800)) }));
  }
  // What isn't needed isn't read: the last note's bytes are never fetched.
  const read = [];
  const get = h.r2.get;
  h.r2.get = async (key) => {
    const object = await get(key);
    if (object) read.push(new TextDecoder().decode(await object.arrayBuffer()).slice(0, 6));
    return object;
  };
  const crowded = await ask(h);
  h.r2.get = get;
  assert.equal(crowded.status, 200);
  assert.equal(crowded.body.note, NOT_ALL_READ);
  assert.match(crowded.prompt, /LONG00/);
  assert.doesNotMatch(crowded.prompt, /LONG27/);
  assert.ok(read.includes('LONG00') && !read.includes('LONG27'), JSON.stringify(read));
  // A long item is read to 12,000 characters, not all 12,600 of it: that many of its words, and its name.
  assert.equal(crowded.prompt.match(/LONG00/g).length, Math.floor(12000 / 'LONG00 '.length) + 1);

  // More items than it reads at once: the first 48, and the note says so.
  const many = await seeded();
  for (let index = 0; index < 50; index += 1) {
    await idOf(await many.uploadFile({ name: `note-${index}.md`, type: 'text/markdown', bytes: encode(`SHORT${String(index).padStart(2, '0')}`) }));
  }
  const capped = await ask(many, { address: ADMIN });
  assert.equal(capped.body.note, NOT_ALL_READ);
  assert.equal(capped.body.sources.filter((source) => source.kind === 'file').length, 48);
  assert.doesNotMatch(capped.prompt, /SHORT49/);
});

test('a session answering on Cloudflare’s model reads less context: the most that model was tried at', async () => {
  const h = await seeded();
  await idOf(await h.uploadFile({ name: 'long.md', type: 'text/markdown', bytes: encode('Z'.repeat(10000)) }));
  const own = await ask(h);
  assert.equal(own.prompt.match(/Z/g).length, 10000);
  // The same file, cut at 6,000 characters for Cloudflare's model.
  const ownAi = h.state.config.ai;
  h.state.config.ai = { ...ownAi, models: { ...ownAi.models, 'session-agent': { provider: 'workers-ai', model: '@cf/zai-org/glm-5.3' } } };
  const calls = [];
  const cloudflare = await ask(h, { deps: { proxyWorkersAi: async ({ payload }) => { calls.push(payload); return json({ completion: 'An answer.' }); } } });
  assert.equal(cloudflare.status, 200, JSON.stringify(cloudflare.body));
  assert.equal(calls.length, 1);
  const prompt = calls[0].messages.map((message) => message.content).join('\n');
  assert.equal(prompt.match(/Z/g).length, 5999);
  // 27 such files pass 160,000 characters, which the note then names.
  for (let index = 0; index < 27; index += 1) {
    await idOf(await h.uploadFile({ name: `fill-${index}.md`, type: 'text/markdown', bytes: encode('Y'.repeat(7000)) }));
  }
  const filled = await ask(h, { deps: { proxyWorkersAi: async () => json({ completion: 'An answer.' }) } });
  assert.equal(filled.body.note, 'Some of the session’s context wasn’t read: the Session Agent reads at most 160,000 characters or 48 items of it, and 6,000 characters of any one.');
  h.state.config.ai = ownAi;
  assert.equal((await ask(h)).body.note, undefined, 'on the session’s own model all of it fits');
});

test('the session’s own gate comes first: someone it keeps out may not ask, whatever the audiences say', async () => {
  // Everyone signed in gets Detailed answers, on a session only the salon group may view.
  const h = await seeded({ audiences: [{ who: everyone, answers: 'detailed' }], minAnswers: 1 });
  // As Settings writes a session locked to a group.
  h.state.config.storageProfile.payloadAccessControl = {
    gate: 'role_gate', encryption: 'none', accessConditions: { match: 'any', conditions: [{ kind: 'worker_role', role: 'admin' }, salonMembers.conditions[0]] },
  };
  // Signed in, with the session's AI access, but outside the group.
  const outsider = await ask(h);
  assert.equal(outsider.status, 403);
  assert.equal(outsider.body.reason, 'session_agent_not_admitted');
  assert.deepEqual(outsider.calls.ai, []);
  assert.deepEqual((await ask(h, { path: '/session-agent/status', body: {} })).body, {
    on: true, answers: null, audience: null, optedOut: false, unattributed: false, recording: false,
  });
  const member = await ask(h, { address: MEMBER });
  assert.equal(member.status, 200);
  assert.match(member.prompt, /ANSWER meet less/);
  assert.equal((await ask(h, { address: ADMIN })).body.audience, 'admin');
  // A gate that can't be checked just now refuses without saying they're kept out.
  const outage = await ask(h, { address: MEMBER, deps: { isWorkerGroupMember: async () => { throw new Error('store down'); } } });
  assert.equal(outage.status, 503);
  assert.deepEqual(outage.calls.ai, []);
  // On a session open to everyone signed in, the same outsider is answered.
  const open = await ask(await seeded({ audiences: [{ who: everyone, answers: 'detailed' }] }));
  assert.equal(open.status, 200);
});

test('Detailed answers add what the asker may read and members’ answers, and never a participant’s label or address', async () => {
  const h = await seeded();
  // Three members answered the question; the fixture's default has one.
  const three = { loadWorkerCanonicalResultsAnalysisSource: async () => ({
    ok: true,
    snapshot: {
      questions: [{ id: 'q1', prompt: 'What should change?', type: 'text' }],
      responses: ['meet less', 'meet later', 'meet outside'].map((answer, index) => (
        { questionId: 'q1', answer: `ANSWER ${answer}`, participantId: `participant_00${index + 1}` })),
    },
    participantAddresses: new Map([MEMBER, `0x${'7'.repeat(40)}`, `0x${'8'.repeat(40)}`].map((address, index) => [`participant_00${index + 1}`, address])),
  }) };
  const member = await ask(h, { address: MEMBER, deps: three });
  for (const piece of ['OPEN agenda', 'GROUP notes', 'RESULTS', 'ANSWER meet less', 'ANSWER meet outside', 'What should change?']) {
    assert.match(member.prompt, new RegExp(piece));
  }
  for (const piece of ['ADMINS plan', 'participant_001', MEMBER]) assert.doesNotMatch(member.prompt, new RegExp(piece));
  assert.equal(member.body.read.answers, 3);
  // A question fewer than three members answered gives someone who is not an
  // admin neither its count nor its text: it would be one person's answer.
  const few = await ask(h, { address: MEMBER });
  assert.doesNotMatch(few.prompt, /ANSWER/);
  assert.equal(few.body.read.answers, 0);
  // An admin may lower how many answers a question needs; at 1, one member's answer is used.
  const lowered = await seeded({ ...twoAudiences, minAnswers: 1 });
  const one = await ask(lowered, { address: MEMBER });
  assert.match(one.prompt, /ANSWER/);
  assert.equal(one.body.read.answers, 1);
  const admin = await ask(h, { address: ADMIN });
  for (const piece of ['ADMINS plan', 'GROUP notes', 'ANSWER meet less']) assert.match(admin.prompt, new RegExp(piece));
  // Answers that can't be read leave them out, and the reply says so.
  const unread = await ask(h, { address: MEMBER, deps: { loadWorkerCanonicalResultsAnalysisSource: async () => ({ ok: false }) } });
  assert.equal(unread.status, 200);
  assert.doesNotMatch(unread.prompt, /ANSWER/);
  assert.match(unread.body.note, /couldn’t be read/);
  // Past the build limit the note says which limit, in plain words.
  const tooMany = await ask(h, { address: MEMBER, deps: { loadWorkerCanonicalResultsAnalysisSource: async () => ({
    ok: false, status: 503, reason: 'results_analysis_snapshot_limit' }) } });
  assert.doesNotMatch(tooMany.prompt, /ANSWER/);
  assert.match(tooMany.body.note, /weren’t read: this session stores more than 10,000 question and answer versions/);
});

test('a signed-in asker is told which context items the answer read, each one theirs to read; a visitor gets the count alone', async () => {
  const h = await seeded();
  h.state.config.sessionContext = {
    title: 'Context', paragraphs: ['CONTEXT for everyone.'], links: [{ label: 'The charter', url: 'https://example.org/charter' }],
  };
  const titles = (reply) => reply.body.sources.map((source) => `${source.kind}: ${source.title}`);
  // General: the session's own link and note, then the one file open to everyone.
  const general = await ask(h);
  assert.deepEqual(titles(general), ['session-link: The charter', 'session-note: CONTEXT for everyone.', 'file: agenda.md']);
  assert.equal(general.body.read.context, general.body.sources.length);
  assert.equal(general.body.sources[0].url, 'https://example.org/charter');
  // A file's name and kind: nothing about who added it or what it says.
  assert.deepEqual(general.body.sources[2], { kind: 'file', title: 'agenda.md' });
  // A group's file is listed only for someone the group's rule lets read it, and an admins' file only for an admin.
  const member = await ask(h, { address: MEMBER });
  assert.deepEqual(titles(member).slice(2), ['file: agenda.md', 'file: group.txt']);
  const admin = await ask(h, { address: ADMIN });
  assert.deepEqual(titles(admin).slice(2).sort(), ['file: agenda.md', 'file: board.txt', 'file: group.txt']);
  for (const reply of [general, member]) assert.doesNotMatch(JSON.stringify(reply.body), /board\.txt/);
  assert.doesNotMatch(JSON.stringify(general.body), /group\.txt/);
  // An item that didn't fit the prompt was not read, so it is not listed.
  for (let index = 0; index < 27; index += 1) {
    await idOf(await h.uploadFile({ name: `long-${index}.md`, type: 'text/markdown', bytes: encode('L'.repeat(12500)) }));
  }
  await idOf(await h.uploadFile({ name: 'late.md', type: 'text/markdown', bytes: encode('LATE file') }));
  const full = await ask(h);
  assert.equal(full.body.read.context, full.body.sources.length);
  assert.ok(titles(full).includes('file: long-0.md') && !titles(full).includes('file: late.md'));
  assert.match(full.body.note, /wasn’t read/);

  // Each listed item is the one read, whatever was passed over ahead of it: a file with no words, and a
  // file whose adder keeps theirs out of the agent.
  const mixed = await seeded();
  mixed.state.config.sessionContext = { title: 'Context', paragraphs: [], links: [] };
  await idOf(await mixed.uploadFile({ name: 'blank.md', type: 'text/markdown', bytes: encode('   ') }));
  await idOf(await mixed.uploadFile({ name: 'theirs.md', type: 'text/markdown', bytes: encode('THEIRS'), address: PARTICIPANT }));
  await idOf(await mixed.uploadFile({ name: 'last.md', type: 'text/markdown', bytes: encode('LAST words') }));
  const optedOut = { callSessionAgentOptOutStore: async (env, slug, operation) => (
    { ok: true, body: operation === 'list' ? { addresses: [PARTICIPANT] } : {} }) };
  const passedOver = await ask(mixed, { address: ADMIN, deps: optedOut });
  assert.match(passedOver.prompt, /LAST words/);
  assert.doesNotMatch(passedOver.prompt, /THEIRS/);
  assert.deepEqual(titles(passedOver).sort(), ['file: agenda.md', 'file: board.txt', 'file: group.txt', 'file: last.md']);

  // Not signed in, the answer reads what a first sign-in could, which the page may not list to a visitor.
  const visitor = await askSignedOut(await seeded());
  assert.equal(visitor.body.read.context, 2);
  assert.equal('sources' in visitor.body, false);
  assert.doesNotMatch(JSON.stringify(visitor.body), /agenda\.md/);
});

test('an answer links the questions it read that are closest to the one asked, never by what a member wrote', async () => {
  const address = (digit) => `0x${String(digit).repeat(40)}`;
  const people = [MEMBER, address(7), address(8)];
  const answered = (questionId, words) => people.map((_, index) => (
    { questionId, answer: `${words} ${index}`, participantId: `participant_00${index + 1}` }));
  const source = { loadWorkerCanonicalResultsAnalysisSource: async () => ({
    ok: true,
    snapshot: {
      questions: [
        { id: '0xAA', prompt: 'Should meetings be shorter?', type: 'text' },
        { id: '0xBB', prompt: 'Who should chair the budget committee?', type: 'text' },
        { id: '0xCC', prompt: 'Is parking a problem?', type: 'text' },
      ],
      responses: [
        ...answered('0xAA', 'Dana of Oakland says parking'),
        ...answered('0xBB', 'someone local'),
        // Too few answered this one for anyone but an admin to hear from it.
        { questionId: '0xCC', answer: 'yes', participantId: 'participant_001' },
      ],
    },
    participantAddresses: new Map(people.map((person, index) => [`participant_00${index + 1}`, person])),
  }) };
  const h = await seeded();
  const detailed = await ask(h, { address: MEMBER, deps: source, body: { question: 'How long should meetings be, and who sets the budget?' } });
  assert.deepEqual(detailed.body.questions, [
    { id: '0xaa', question: 'Should meetings be shorter?' },
    { id: '0xbb', question: 'Who should chair the budget committee?' },
  ]);
  assert.equal(detailed.body.questionsFrom, 'answers');
  // The ids are for the page: the model is never given them.
  assert.doesNotMatch(detailed.prompt, /0xaa|0xbb/i);
  // A question's own words decide, not its answers: a name or place only an answer holds links nothing.
  const byAnswer = await ask(h, { address: MEMBER, deps: source, body: { question: 'What did Dana of Oakland say?' } });
  assert.equal('questions' in byAnswer.body, false);
  // A thinly answered question is neither read nor linked for a member; an admin reads it.
  const parking = { question: 'Is parking a problem?' };
  assert.equal('questions' in (await ask(h, { address: MEMBER, deps: source, body: parking })).body, false);
  assert.deepEqual((await ask(h, { address: ADMIN, deps: source, body: parking })).body.questions, [{ id: '0xcc', question: 'Is parking a problem?' }]);

  // General answers read no member's answer: they link the questions the published results cite.
  const published = { readPublishedResultsAnalysisArtifact: async ({ includeSnapshot }) => ({
    ok: true,
    artifact: { sections: {
      overview: { available: true, overview: 'RESULTS: shorter meetings.' },
      breakdown: { available: true, groups: [{ label: 'Meetings', questionIds: ['0xAA', '0xDD'] }] },
      atlas: { available: false, nodes: [{ label: 'Hidden', questionIds: ['0xBB'] }] },
    } },
    ...(includeSnapshot ? { snapshot: { questions: [
      { id: '0xAA', prompt: 'Should meetings be shorter?' },
      { id: '0xBB', prompt: 'Who should chair the budget meetings?' },
      { id: '0xDD', prompt: 'Should meetings move online?' },
    ] } } : {}),
  }) };
  const question = { question: 'What about meetings?' };
  const general = await ask(h, { deps: published, body: question });
  assert.deepEqual(general.body.questions.map((item) => item.id).sort(), ['0xaa', '0xdd']);
  assert.equal(general.body.questionsFrom, 'results');
  // Someone not signed in gets the same links: the results are theirs to see.
  assert.deepEqual((await askSignedOut(h, { deps: published, body: question })).body.questions.map((item) => item.id).sort(), ['0xaa', '0xdd']);
  // A question an admin has since removed is left out, and so is every link where the asker may not see results.
  h.state.config.BLOCKED_QUESTION_IDS = ['0xDD'];
  assert.deepEqual((await ask(h, { deps: published, body: question })).body.questions, [{ id: '0xaa', question: 'Should meetings be shorter?' }]);
  // So is one hidden from the Storage panel, which the settings don't list.
  await getStorageIndexBinding(h.env).put(`${hiddenStorageResourcePrefix({ slug: 'salon', resource: 'questions' })}0xaa`, '1');
  assert.equal('questions' in (await ask(h, { deps: published, body: question })).body, false);
  assert.match((await ask(h, { deps: published, body: question })).prompt, /RESULTS/);
  const hidden = { ...published, evaluateResultsAnalysisViewerEligibility: () => ({ ok: false }) };
  assert.equal('questions' in (await ask(h, { deps: hidden, body: question })).body, false);
  assert.deepEqual(resultsQuestions({ artifact: null, snapshot: null, config: {} }), []);
});

test('results reach an answer only where the page shows the asker results', async () => {
  const h = await seeded();
  const deps = { evaluateResultsAnalysisViewerEligibility: () => ({ ok: false }) };
  assert.doesNotMatch((await ask(h, { address: MEMBER, deps })).prompt, /RESULTS/);
  assert.match((await ask(h, { address: ADMIN, deps })).prompt, /RESULTS/);
  // A results admin sees results on any session, as on the Results page, and is answered as their audience says.
  h.state.config.resultsAdminAddresses = [MEMBER];
  const resultsAdmin = await ask(h, { address: MEMBER, deps });
  assert.match(resultsAdmin.prompt, /RESULTS/);
  assert.equal(resultsAdmin.body.audience, 0);
  delete h.state.config.resultsAdminAddresses;
  const unreadable = { authorizeCloudflareStorageResourceRead: async ({ resource }) => ({ ok: resource !== 'responses' }) };
  assert.doesNotMatch((await ask(h, { deps: unreadable })).prompt, /RESULTS/);
});

test('the payment step sees only who is asking, after the material is fixed, and a refusal stops the AI call', async () => {
  const seen = [];
  const refused = await ask(await seeded(), {
    address: MEMBER,
    deps: { checkSessionAgentPayment: async (value) => { seen.push(value); return { ok: false }; } },
  });
  assert.equal(refused.status, 402);
  assert.deepEqual(seen, [{ audience: 0, answers: 'detailed' }]);
  assert.deepEqual(refused.calls.ai, []);
});

test('questions count against the AI daily limit, not the general one', async () => {
  const h = await seeded();
  h.state.config.limits = { perWalletPerDay: 400, aiPerWalletPerDay: 15 };
  const seen = [];
  await ask(h, { deps: { checkRateLimit: async ({ route, limit }) => { seen.push({ route, limit }); return true; } } });
  assert.deepEqual(seen, [{ route: 'ai', limit: 15 }]);
});

test('a question refused before any AI runs costs nothing from the day', async () => {
  const h = await seeded();
  const refusals = [
    await ask(h, { address: MEMBER, current: { ai: false } }),
    await ask(h, { deps: { getSessionSecrets: async () => null } }),
    await ask(h, { deps: { callSessionAgentOptOutStore: async () => ({ ok: false, status: 503, body: {} }) } }),
  ];
  assert.deepEqual(refusals.map((refused) => [refused.status, refused.calls.rate]), [[403, []], [503, []], [503, []]]);
  assert.deepEqual((await ask(h)).calls.rate, ['ai']);
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
  // Status says so too, so the dialog doesn't offer a question that would fail,
  // and still answers: each person's switches stay theirs after the session
  // ends, when its material is most likely to be exported.
  const status = async () => (await ask(h, { path: '/session-agent/status', body: {} }));
  h.state.config.scopes = { ai: false };
  const off = await ask(h);
  assert.deepEqual([off.status, off.body.reason], [403, 'ai_disabled']);
  assert.deepEqual([(await status()).status, (await status()).body],
    [200, { on: true, answers: null, audience: null, optedOut: false, unattributed: false, recording: false, closed: 'ai_disabled' }]);
  h.state.config.scopes = {};
  h.state.config.sessionEndsAt = '2020-01-01T00:00:00.000Z';
  const ended = await ask(h);
  assert.equal(ended.status, 410);
  assert.deepEqual(ended.calls.ai, []);
  // Both switches can still be set, and status shows them.
  assert.deepEqual((await ask(h, { path: '/session-agent/opt-out', body: { optedOut: true } })).body, { optedOut: true });
  assert.deepEqual((await ask(h, { path: '/session-agent/attribution', body: { unattributed: true } })).body, { unattributed: true });
  assert.deepEqual([(await status()).status, (await status()).body],
    [200, { on: true, answers: null, audience: null, optedOut: true, unattributed: true, recording: false, closed: 'session_ended' }]);
  // Who may ask is never worked out for a session that answers no one.
  const unreached = await ask(h, { path: '/session-agent/status', body: {}, deps: { isWorkerGroupMember: async () => { throw new Error('not asked'); } } });
  assert.equal(unreached.status, 200);
});

test('someone signed in without an address has no switch, and status still says how they’d be answered', async () => {
  const status = await ask(await seeded(), { path: '/session-agent/status', body: {}, address: 'agent:delve-town' });
  // No address, so neither switch: nothing of theirs could carry one.
  assert.deepEqual(status.body, { on: true, answers: 'general', audience: 1, optedOut: false, recording: false });
});

test('each person can turn off the Session Agent’s use of their answers and files, and turn it back on', async () => {
  const h = await seeded();
  const optOut = (address, optedOut) => ask(h, { path: '/session-agent/opt-out', address, body: { optedOut } });
  assert.deepEqual((await optOut(MEMBER, true)).body, { optedOut: true });
  assert.equal((await ask(h, { path: '/session-agent/status', body: {}, address: MEMBER })).body.optedOut, true);
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

test('each person can leave their address off exported items, which changes nothing the agent reads', async () => {
  const h = await seeded();
  const leaveOff = (address, unattributed) => ask(h, { path: '/session-agent/attribution', address, body: { unattributed } });
  const statusOf = async (address) => (await ask(h, { path: '/session-agent/status', body: {}, address })).body;
  const before = (await ask(h, { address: ADMIN })).prompt;
  assert.deepEqual((await leaveOff(MEMBER, true)).body, { unattributed: true });
  assert.deepEqual([(await statusOf(MEMBER)).unattributed, (await statusOf(MEMBER)).optedOut], [true, false]);
  assert.equal((await statusOf(PARTICIPANT)).unattributed, false);
  // Their answers are still read: this is about the export's address, not the agent.
  assert.equal((await ask(h, { address: ADMIN })).prompt, before);
  assert.deepEqual((await leaveOff(MEMBER, false)).body, { unattributed: false });
  assert.equal((await statusOf(MEMBER)).unattributed, false);
  // Only the signed-in person's own choice is set: an address sent in the body is not read.
  await ask(h, { path: '/session-agent/attribution', address: MEMBER, body: { unattributed: true, address: PARTICIPANT } });
  assert.deepEqual([(await statusOf(MEMBER)).unattributed, (await statusOf(PARTICIPANT)).unattributed], [true, false]);
  await leaveOff(MEMBER, false);
  assert.equal((await leaveOff(MEMBER, 'yes')).status, 400);
  assert.equal((await leaveOff('agent:delve-town', true)).status, 400);
  const down = async () => ({ ok: false, status: 503, body: {} });
  assert.equal((await ask(h, { path: '/session-agent/attribution', body: { unattributed: true }, deps: { callSessionAgentOptOutStore: down } })).status, 503);
});

const recording = { ...twoAudiences, history: true };
// The session's own store of chats, as its coordinator keeps them. The
// coordinator holds the setting as it is now, which `setting.current` stands for.
const chatStore = () => {
  const { storage } = createDurableStorage();
  const setting = { current: recording };
  const coordinator = { state: { storage }, readSessionConfigAuthority: async () => ({ config: { sessionAgent: setting.current } }) };
  const callSessionAgentHistoryStore = async (env, slug, operation, payload) => {
    const response = await dispatchSessionAgentHistoryStore(coordinator, operation, { slug, ...payload });
    return { ok: response.ok, status: response.status, body: await response.json() };
  };
  return {
    deps: { callSessionAgentHistoryStore, now: () => Date.parse('2026-11-24T23:30:00.000Z') }, kept: () => listSessionAgentHistory(storage), setting,
  };
};

test('each question tells the agent whether this session records chats', async () => {
  assert.match((await ask(await seeded())).prompt, /About this chat: this session does not record chats with you/);
  const kept = await ask(await seeded(recording), { deps: chatStore().deps });
  const STORES = /About this chat: this session stores a chat with you in its records, for its organisers, unless the asker turns that off for a chat/;
  assert.match(kept.prompt, STORES);
  assert.match((await askSignedOut(await seeded())).prompt, /About this chat: this session does not record chats with you/);
  // Someone not signed in is told the same of a session that records, and their chat is stored when they ask for it.
  const store = chatStore();
  const visitor = await askSignedOut(await seeded(recording), { body: { question: 'What do people want?', store: true }, deps: store.deps });
  assert.match(visitor.prompt, STORES);
  assert.equal(visitor.body.stored, true);
  assert.deepEqual((await store.kept()).map(({ question, by, signedOut }) => ({ question, by, signedOut })), [
    { question: 'What do people want?', by: undefined, signedOut: true },
  ]);
});

test('a General answer is told the counts are on the Results page, and a Detailed one is given them', async () => {
  const NOT_GIVEN = /you are not given those counts here, beyond any figure the summary itself states\. Asked for other numbers, say that you are not given them and that the Results page shows them, never that there are none\./;
  const general = await ask(await seeded());
  assert.equal(general.body.answers, 'general');
  assert.match(general.prompt, NOT_GIVEN);
  assert.match((await askSignedOut(await seeded())).prompt, NOT_GIVEN);
  // Three members answered, so a Detailed answer has their answers and their counts to read.
  const three = { loadWorkerCanonicalResultsAnalysisSource: async () => ({
    ok: true,
    snapshot: {
      questions: [{ id: 'q1', prompt: 'What should change?', type: 'text' }],
      responses: ['meet less', 'meet later', 'meet outside'].map((answer, index) => (
        { questionId: 'q1', answer: `ANSWER ${answer}`, participantId: `participant_00${index + 1}` })),
    },
    participantAddresses: new Map([MEMBER, `0x${'7'.repeat(40)}`, `0x${'8'.repeat(40)}`].map((address, index) => [`participant_00${index + 1}`, address])),
  }) };
  const detailed = await ask(await seeded(), { address: MEMBER, deps: three });
  assert.equal(detailed.body.answers, 'detailed');
  assert.match(detailed.prompt, /ANSWER meet less/);
  assert.doesNotMatch(detailed.prompt, NOT_GIVEN);
});

test('nothing asked is kept unless the session stores chats and the asker asked for it', async () => {
  const off = chatStore();
  const h = await seeded();
  const unasked = await ask(h, { body: { question: 'What do people want?', store: true, attribution: 'address', name: 'Sam' }, deps: off.deps });
  assert.equal(unasked.status, 200);
  // A session that stores nothing says nothing about storing.
  assert.equal('stored' in unasked.body, false);
  assert.deepEqual(await off.kept(), []);
  assert.equal((await ask(h, { path: '/session-agent/status', body: {} })).body.recording, false);

  const on = chatStore();
  const stores = await seeded(recording);
  assert.equal((await ask(stores, { path: '/session-agent/status', body: {} })).body.recording, true);
  for (const body of [{ question: 'What do people want?' }, { question: 'What do people want?', store: false, attribution: 'address', name: 'Sam' }]) {
    const reply = await ask(stores, { body, deps: on.deps });
    assert.deepEqual([reply.status, reply.body.stored, reply.body.note], [200, false, undefined]);
  }
  assert.deepEqual(await on.kept(), []);
});

test('a stored chat holds the exchange, and who asked only as far as they chose', async () => {
  const { deps, kept } = chatStore();
  const h = await seeded(recording);
  const question = 'What do people want?';
  const anonymous = await ask(h, { address: MEMBER, body: { question, store: true }, deps });
  assert.deepEqual([anonymous.status, anonymous.body.stored], [200, true]);
  const named = await ask(h, { address: MEMBER, body: { question, store: true, attribution: 'anonymous', name: '  Sam’s agent ' }, deps });
  const withAddress = await ask(h, {
    address: PARTICIPANT.toUpperCase().replace('0X', '0x'), body: { question, store: true, attribution: 'address' }, deps,
  });
  // Someone signed in without an address has none to store.
  const agent = await ask(h, { address: 'agent:delve-town', body: { question, store: true, attribution: 'address' }, deps });
  assert.deepEqual([named.body.stored, withAddress.body.stored, agent.body.stored], [true, true, true]);
  const exchange = (answers, extra = {}) => ({ day: '2026-11-24', answers, question, answer: 'They want shorter meetings.', ...extra });
  // The member's Detailed answers drew on the file locked to their group, so those chats are for that group.
  assert.deepEqual((await kept()).map(({ id, ...entry }) => entry), [
    exchange('detailed', { groups: ['salon'] }),
    exchange('detailed', { groups: ['salon'], name: 'Sam’s agent' }),
    exchange('general', { by: PARTICIPANT }),
    exchange('general'),
  ]);
  // No asker rides along unasked, and how much each answer drew on, which differs by who asks, isn't kept.
  assert.ok(anonymous.body.read.context > 0);
  assert.ok(!JSON.stringify(await kept()).includes(MEMBER));
  assert.ok((await kept()).every((entry) => !('read' in entry)));
  // Only the signed-in person's own address is ever stored: one sent in the body is not read.
  await ask(h, { address: PARTICIPANT, body: { question, store: true, attribution: 'address', address: ADMIN, by: ADMIN }, deps });
  assert.equal((await kept()).at(-1).by, PARTICIPANT);
});

test('a stored chat says whom its answer was fit for: an admin’s, a results admin’s, or a group’s', async () => {
  const { deps, kept } = chatStore();
  const h = await seeded(recording);
  h.state.config.resultsAdminAddresses = [PARTICIPANT];
  const body = { question: 'What do people want?', store: true };
  // An admin's answer may hold admins-only context and thinly answered questions.
  const admin = await ask(h, { address: ADMIN, body, deps });
  assert.match(admin.prompt, /ADMINS plan/);
  // A results admin's may hold results not yet open to everyone, whatever style they are answered in.
  const builder = await ask(h, { address: PARTICIPANT, body, deps });
  assert.equal(builder.body.answers, 'general');
  const member = await ask(h, { address: MEMBER, body, deps });
  assert.match(member.prompt, /GROUP notes/);
  assert.deepEqual((await kept()).map(({ answers, scope, groups }) => ({ answers, scope, groups })), [
    { answers: 'detailed', scope: 'admin', groups: undefined },
    { answers: 'general', scope: 'admin', groups: undefined },
    { answers: 'detailed', scope: undefined, groups: ['salon'] },
  ]);
});

test('a chat whose answer comes back after recording was turned off is not kept', async () => {
  const { deps, kept, setting } = chatStore();
  const h = await seeded(recording);
  // The admin turns recording off while the AI is answering: the route's own view is from before.
  setting.current = twoAudiences;
  const reply = await ask(h, { body: { question: 'What do people want?', store: true }, deps });
  assert.deepEqual([reply.status, reply.body.answer, reply.body.stored], [200, 'They want shorter meetings.', false]);
  assert.match(reply.body.note, /This chat wasn’t stored: the session no longer records chats\./);
  assert.deepEqual(await kept(), []);
});

test('a question that may name someone is answered but not kept, and a failed write never fails the answer', async () => {
  const { deps, kept } = chatStore();
  const h = await seeded(recording);
  const mail = ['dee', 'mail.example'].join('@');
  for (const question of [`What did ${mail} say?`, `Is ${MEMBER} for it?`, 'Call 07700 900123?']) {
    const reply = await ask(h, { body: { question, store: true }, deps });
    assert.deepEqual([reply.status, reply.body.answer, reply.body.stored], [200, 'They want shorter meetings.', false], question);
    assert.match(reply.body.note, /This chat wasn’t stored: the question holds an address, an email or a long number\./);
  }
  assert.deepEqual(await kept(), []);
  for (const callSessionAgentHistoryStore of [
    async () => { throw new Error('coordinator down'); },
    async () => ({ ok: false, status: 503, body: {} }),
  ]) {
    const reply = await ask(h, { body: { question: 'What do people want?', store: true }, deps: { ...deps, callSessionAgentHistoryStore } });
    assert.deepEqual([reply.status, reply.body.answer, reply.body.stored], [200, 'They want shorter meetings.', false]);
    assert.match(reply.body.note, /This chat couldn’t be stored just now\./);
  }
});

test('what to store is checked before the AI is asked', async () => {
  const { deps, kept } = chatStore();
  for (const h of [await seeded(recording), await seeded()]) {
    for (const [extra, error] of [
      [{ store: 'yes' }, 'Say whether to store this chat.'],
      [{ store: true, attribution: 'name' }, 'A stored chat carries your address or no address.'],
      [{ store: true, name: 7 }, 'A name must be text.'],
      [{ store: true, name: 'x'.repeat(61) }, 'A name can be at most 60 characters.'],
    ]) {
      const refused = await ask(h, { body: { question: 'What do people want?', ...extra }, deps });
      assert.deepEqual([refused.status, refused.body.error, refused.calls.ai.length, refused.calls.rate.length], [400, error, 0, 0]);
    }
  }
  const longest = await ask(await seeded(recording), { body: { question: 'What do people want?', store: true, name: 'x'.repeat(60) }, deps });
  assert.equal(longest.body.stored, true);
  assert.equal((await kept()).length, 1);
});

// Someone who isn't signed in: no address, the scopes a first sign-in would be given, and a network address to count.
const NETWORK = 'anon:203.0.113.9';
const askSignedOut = async (h, {
  path = '/session-agent/ask',
  body = { question: 'What do people want?' },
  scopes = { ai: true, storage: true },
  limits = () => true,
  deps = {},
} = {}) => {
  const calls = { ai: [], rate: [] };
  const response = await dispatchSessionAgentRoute({
    path, body, config: h.state.config, slug: 'salon', address: '', env: h.env, headers: {}, scopes, signedOut: { identity: NETWORK },
    deps: {
      ...h.deps,
      resolveAuthenticatedRouteSecrets,
      evaluateAuthenticatedRoutePreflight: async () => { throw new Error('a signed-out question has no sign-in to check'); },
      checkRateLimit: async ({ address, limit, route }) => { calls.rate.push([address, limit, route]); return limits({ address, route }); },
      isWorkerGroupMember: async () => ({ ok: false, status: 403, reason: 'worker_group_membership_denied' }),
      evaluateResultsAnalysisViewerEligibility: () => ({ ok: true }),
      readPublishedResultsAnalysisArtifact: async () => ({
        ok: true, artifact: { sections: { overview: { available: true, overview: 'RESULTS: shorter meetings.' } } },
      }),
      loadWorkerCanonicalResultsAnalysisSource: async () => ({
        ok: true,
        snapshot: {
          questions: [{ id: 'q1', prompt: 'What should change?', type: 'text' }],
          responses: [{ questionId: 'q1', answer: 'ANSWER meet less', participantId: 'participant_001' }],
        },
        participantAddresses: new Map([['participant_001', MEMBER]]),
      }),
      proxyAnthropic: async ({ payload }) => { calls.ai.push(payload); return json({ completion: 'They want shorter meetings.' }); },
      ...deps,
    },
  });
  const prompt = calls.ai[0]?.messages.map((message) => message.content).join('\n') || '';
  return { status: response.status, body: await response.json(), calls, prompt };
};

test('someone not signed in is answered as a first sign-in would be, with General answers only', async () => {
  const h = await seeded();
  const status = await askSignedOut(h, { path: '/session-agent/status', body: {} });
  assert.deepEqual(status.body, { on: true, answers: 'general', audience: 1, optedOut: false, recording: false, signedOut: true });
  const reply = await askSignedOut(h);
  assert.deepEqual([reply.status, reply.body.answer, reply.body.answers], [200, 'They want shorter meetings.', 'general']);
  // The shared material only: no member's answer, nothing locked to a group, nothing for admins.
  for (const piece of ['CONTEXT for everyone', 'OPEN agenda', 'RESULTS: shorter meetings']) assert.match(reply.prompt, new RegExp(piece));
  assert.doesNotMatch(reply.prompt, /ANSWER|GROUP notes|ADMINS plan/);

  // Even where everyone signed in gets Detailed answers, someone not signed in gets General.
  const detailed = await seeded({ audiences: [{ who: everyone, answers: 'detailed' }] });
  assert.equal((await ask(detailed)).body.answers, 'detailed');
  const general = await askSignedOut(detailed);
  assert.deepEqual([general.status, general.body.answers], [200, 'general']);
  assert.doesNotMatch(general.prompt, /ANSWER|GROUP notes/);
  assert.equal((await askSignedOut(detailed, { path: '/session-agent/status', body: {} })).body.answers, 'general');
});

test('a sign-in is asked for where the setting is off, the session keeps people out, or only groups may ask', async () => {
  const signIn = { error: 'Sign in to ask the Session Agent.', reason: 'session_agent_sign_in_required' };
  for (const [label, h, options] of [
    ['turned off by an admin', await seeded({ ...twoAudiences, anyoneCanAsk: false }), {}],
    ['only a group may ask', await seeded({ audiences: [{ who: salonMembers, answers: 'detailed' }] }), {}],
    // The session's sign-in rule would not let them in, so a first sign-in is given nothing.
    ['the session admits only some', await seeded(), { scopes: {} }],
    ['the session gives a sign-in no AI', await seeded(), { scopes: { storage: true } }],
  ]) {
    const refused = await askSignedOut(h, options);
    assert.deepEqual([refused.status, refused.body, refused.calls.ai.length, refused.calls.rate.length], [401, signIn, 0, 0], label);
    const status = await askSignedOut(h, { ...options, path: '/session-agent/status', body: {} });
    assert.deepEqual([status.status, status.body.answers, status.body.signedOut], [200, null, true], label);
  }
  // A session's own AI endpoint takes nothing from someone who isn't signed in, as on the Worker's other routes.
  const own = await seeded();
  own.state.config.ai = { mode: 'custom', models: { fast: { provider: 'custom', model: 'own-model' }, thinking: { provider: 'custom', model: 'own-model' } } };
  let reached = 0;
  const custom = await askSignedOut(own, { deps: { proxyCustomRPC: async () => { reached += 1; return json({ completion: 'From the session’s own endpoint.' }); } } });
  assert.deepEqual([custom.status, custom.body, custom.calls.rate.length, reached], [401, signIn, 0, 0]);
  assert.equal((await askSignedOut(own, { path: '/session-agent/status', body: {} })).body.answers, null);
  // A check that can't be made is an outage, not a refusal to sign in over.
  const down = await askSignedOut(await seeded({ audiences: [{ who: salonMembers, answers: 'detailed' }, { who: everyone, answers: 'general' }] }), {
    deps: { isWorkerGroupMember: async () => ({ ok: false, status: 503, reason: 'worker_group_store_unavailable' }) },
  });
  assert.deepEqual([down.status, down.calls.ai.length], [503, 0]);
  // Neither switch is theirs to set.
  for (const [path, body] of [['/session-agent/opt-out', { optedOut: true }], ['/session-agent/attribution', { unattributed: true }]]) {
    assert.equal((await askSignedOut(await seeded(), { path, body })).status, 401, path);
  }
});

test('signed-out questions are counted by network and for the whole session, after everything else has passed', async () => {
  const h = await seeded();
  const reply = await askSignedOut(h);
  assert.equal(reply.status, 200);
  // Both are the Session Agent's own counts: neither the session's other signed-out AI use nor anyone's
  // signed-in use shares them, so one can't use up the other.
  assert.deepEqual(reply.calls.rate, [
    [NETWORK, SESSION_AGENT_SIGNED_OUT.perNetworkPerDay, 'session-agent-signed-out'],
    ['anon:everyone', SESSION_AGENT_SIGNED_OUT.perSessionPerDay, 'session-agent-signed-out-all'],
  ]);
  assert.deepEqual([SESSION_AGENT_SIGNED_OUT.perNetworkPerDay, SESSION_AGENT_SIGNED_OUT.perSessionPerDay], [10, 300]);
  // A session's own daily limit for a network address that isn't signed in, when lower, is kept;
  // its limits for signed-in people say nothing about visitors.
  h.state.config.limits = { perAnonymousIpPerDay: 3, perWalletPerDay: 200, aiPerWalletPerDay: 2 };
  assert.deepEqual((await askSignedOut(h)).calls.rate[0], [NETWORK, 3, 'session-agent-signed-out']);
  h.state.config.limits = { perAnonymousIpPerDay: 50, aiPerWalletPerDay: 2 };
  assert.deepEqual((await askSignedOut(h)).calls.rate[0], [NETWORK, 10, 'session-agent-signed-out']);
  h.state.config.limits = { aiPerWalletPerDay: 2 };
  assert.deepEqual((await askSignedOut(h)).calls.rate[0], [NETWORK, 10, 'session-agent-signed-out']);

  const over = { error: 'The Session Agent has answered all it can today for people who aren’t signed in. Sign in to ask, or try again tomorrow.', reason: 'session_agent_signed_out_limit' };
  for (const used of ['session-agent-signed-out', 'session-agent-signed-out-all']) {
    const refused = await askSignedOut(h, { limits: ({ route }) => route !== used });
    assert.deepEqual([refused.status, refused.body, refused.calls.ai.length], [429, over, 0], used);
  }
  const uncounted = await askSignedOut(h, { limits: () => null });
  assert.deepEqual([uncounted.status, uncounted.calls.ai.length], [503, 0]);
  // Nothing is counted for a question that is refused anyway.
  for (const body of [{ question: ' ' }, { question: 'x'.repeat(501) }, { question: 'Why?', store: 'yes' }]) {
    const refused = await askSignedOut(h, { body });
    assert.deepEqual([refused.status, refused.calls.rate.length, refused.calls.ai.length], [400, 0, 0], JSON.stringify(body).slice(0, 40));
  }
  h.state.config.sessionEndsAt = '2020-01-01T00:00:00.000Z';
  const ended = await askSignedOut(h);
  assert.deepEqual([ended.status, ended.calls.rate.length], [410, 0]);
  assert.equal((await askSignedOut(h, { path: '/session-agent/status', body: {} })).body.closed, 'session_ended');
});

test('a signed-out chat is stored only if asked, and never with an address', async () => {
  const { deps, kept } = chatStore();
  const h = await seeded(recording);
  assert.equal((await askSignedOut(h, { path: '/session-agent/status', body: {} })).body.recording, true);
  const stored = await askSignedOut(h, { body: { question: 'What do people want?', store: true, attribution: 'address', name: 'A visitor' }, deps });
  assert.deepEqual([stored.status, stored.body.stored], [200, true]);
  const unasked = await askSignedOut(h, { deps });
  assert.equal(unasked.body.stored, false);
  const entries = await kept();
  // Marked as asked without signing in, so an admin can tell it from a member's chat with no address.
  assert.deepEqual(entries.map(({ question, name, by, answers, signedOut }) => ({ question, name, by, answers, signedOut })), [
    { question: 'What do people want?', name: 'A visitor', by: undefined, answers: 'general', signedOut: true },
  ]);
  await ask(h, { body: { question: 'What do people want?', store: true }, deps });
  assert.equal('signedOut' in (await kept()).at(-1), false);
  // The network address the limit counts is never written with the chat.
  assert.ok(!JSON.stringify(entries).includes('203.0.113.9'));
});

test('answers without an address stay out, and no question goes ahead when opt-outs can’t be read', async () => {
  const h = await seeded();
  const anonymous = await ask(h, {
    address: ADMIN,
    deps: {
      loadWorkerCanonicalResultsAnalysisSource: async () => ({
        ok: true,
        snapshot: {
          questions: [{ id: 'q1', prompt: 'What should change?', type: 'text' }],
          responses: [{ questionId: 'q1', answer: 'ANSWER from no one', participantId: 'participant_001' }],
        },
        participantAddresses: new Map(),
      }),
    },
  });
  assert.doesNotMatch(anonymous.prompt, /ANSWER/);
  const down = async () => ({ ok: false, status: 503, body: {} });
  const refused = await ask(h, { deps: { callSessionAgentOptOutStore: down } });
  assert.equal(refused.status, 503);
  assert.deepEqual(refused.calls.ai, []);
  assert.equal((await ask(h, { path: '/session-agent/status', body: {}, deps: { callSessionAgentOptOutStore: down } })).status, 503);
  assert.equal((await ask(h, { path: '/session-agent/opt-out', body: { optedOut: true }, deps: { callSessionAgentOptOutStore: down } })).status, 503);
});

test('a Detailed answer counts every member’s choice, leaving out anyone who turned that off', async () => {
  const h = await seeded();
  const members = Array.from({ length: 6 }, (_, index) => [`participant_00${index + 1}`, `0x${String(index + 4).repeat(40)}`]);
  const snapshot = {
    questions: [
      { id: 'q1', prompt: 'Meet less?', type: 'binary' },
      { id: 'q2', prompt: 'Which days?', type: 'multichoice' },
      { id: 'q3', prompt: 'What should change?', type: 'text' },
      { id: 'q4', prompt: 'Meetings run well.', type: 'rating', scale: { min: 1, max: 5, minLabel: 'Strongly agree', maxLabel: '5' } },
    ],
    responses: members.flatMap(([participantId], index) => [
      { questionId: 'q1', participantId, answer: index < 4 ? 'Agree' : 'Disagree', ...(index === 0 ? { additional: 'COMMENT too many' } : {}) },
      { questionId: 'q2', participantId, answer: index % 2 ? ['Monday'] : ['Monday', 'Friday'] },
      { questionId: 'q3', participantId, answer: `WRITTEN ${index}` },
      { questionId: 'q4', participantId, answer: index < 5 ? '1' : '5' },
      { questionId: 'gone', participantId, answer: 'ORPHAN' },
    ]),
  };
  const deps = {
    loadWorkerCanonicalResultsAnalysisSource: async () => ({ ok: true, snapshot, participantAddresses: new Map(members) }),
  };
  const answersIn = ({ prompt }) =>
    JSON.parse(prompt.slice(prompt.indexOf('<member_answers>') + '<member_answers>'.length, prompt.indexOf('</member_answers>')));
  const all = await ask(h, { address: ADMIN, deps });
  const [meet, days, change, run] = answersIn(all);
  assert.deepEqual(meet, { question: 'Meet less?', answered: 6, counts: { Agree: 4, Disagree: 2 }, written: ['COMMENT too many'] });
  assert.deepEqual(days, { question: 'Which days?', answered: 6, counts: { Monday: 6, Friday: 3 } });
  // What members wrote comes in an order drawn for each question asked.
  assert.deepEqual({ ...change, written: [...change.written].sort() }, {
    question: 'What should change?', answered: 6, written: [0, 1, 2, 3, 4, 5].map((index) => `WRITTEN ${index}`),
  });
  // A rating's counts say what its numbers mean; a label that only repeats the number is left out.
  assert.deepEqual(run, { question: 'Meetings run well.', scale: '1 (Strongly agree) to 5', answered: 6, counts: { 1: 5, 5: 1 } });
  assert.equal(all.body.read.answers, 24);
  assert.doesNotMatch(all.prompt, /ORPHAN|participant_/);

  // The first member, who agreed and commented, turns it off.
  await ask(h, { path: '/session-agent/opt-out', address: members[0][1], body: { optedOut: true } });
  const without = answersIn(await ask(h, { address: ADMIN, deps }));
  assert.deepEqual(without[0], { question: 'Meet less?', answered: 5, counts: { Agree: 3, Disagree: 2 } });
  assert.deepEqual(without[1].counts, { Monday: 5, Friday: 2 });
  assert.equal(without[2].written.includes('WRITTEN 0'), false);
});
