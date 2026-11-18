import test from 'node:test';
import assert from 'node:assert/strict';

import { evaluateAuthenticatedRoutePreflight } from './authenticatedRoutePreflight.js';
import { resolveAuthenticatedRouteSecrets } from './authenticatedRouteSecretsResolution.js';
import { dispatchAuthenticatedSecretActionRoute } from './authenticatedSecretActionRouteDispatch.js';
import { groupLockedAccess } from '../../shared/sessionContextSources.mjs';
import { PARTICIPANT, harness, idOf, json } from './contextSourceTestFixture.mjs';
import { dispatchSessionAgentHistoryStore, listSessionAgentHistory } from './sessionAgentHistory.js';
import { createDurableStorage } from './workerGroupTestFixture.mjs';

const MEMBER = `0x${'3'.repeat(40)}`;
const OPEN = '<session_context>';
const CLOSE = '</session_context>';
const encode = (text) => new TextEncoder().encode(text);
const everyone = { match: 'any', conditions: [{ kind: 'agent_grant_scope', scope: 'ai' }] };
const salonMembers = { match: 'any', conditions: [{ kind: 'worker_group', groupIds: ['salon'] }] };
const cardReply = (card) => json({ content: [{ type: 'text', text: typeof card === 'string' ? card : JSON.stringify(card) }] });
const titleSent = (init) => /"title":"([^"]+)\.md"/.exec(JSON.parse(init.body).messages[0].content)?.[1];
// More sources than one answer reads, whatever its limits: sixty short notes, a second apart.
const addNotes = async (h) => {
  let at = Date.parse('2026-11-01T00:00:00.000Z');
  h.deps.now = () => (at += 1000);
  for (let index = 0; index < 60; index += 1) {
    const name = `note-${String(index).padStart(2, '0')}`;
    await idOf(await h.uploadFile({ name: `${name}.md`, type: 'text/markdown', bytes: encode(`BODY of ${name}`) }));
    await h.settled();
  }
};

// One question to the Session Agent, with its prompt as the provider received it.
const ask = async (h, { address = PARTICIPANT, body = { question: 'What do the files say?' }, deps = {} } = {}) => {
  const prompts = [];
  const { response } = await dispatchAuthenticatedSecretActionRoute({
    path: '/session-agent/ask',
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
      computeScopesForLogin: async () => ({ ai: true }),
      checkRateLimit: async () => true,
      isWorkerGroupMember: async ({ groupId, requesterAddress }) => (groupId === 'salon' && requesterAddress === MEMBER
        ? { ok: true }
        : { ok: false, status: 403, reason: 'worker_group_membership_denied' }),
      evaluateResultsAnalysisViewerEligibility: () => ({ ok: false }),
      loadWorkerCanonicalResultsAnalysisSource: async () => ({ ok: true, snapshot: { questions: [], responses: [] }, participantAddresses: new Map() }),
      proxyAnthropic: async ({ payload }) => {
        prompts.push(payload.messages.map((message) => message.content).join('\n'));
        return json({ completion: 'They cover the agenda.' });
      },
      ...deps,
    },
  });
  assert.equal(response.status, 200);
  return prompts[0];
};
const blockOf = (prompt) => JSON.parse(prompt.slice(prompt.indexOf(OPEN) + OPEN.length, prompt.indexOf(CLOSE)));

test('a Session Agent answer is given the cards of the sources it could not read, and nothing else of them', async () => {
  // Each source's card names it, so the prompt shows whose cards it was given.
  const h = harness({ cards: true, provider: async (url, init) => cardReply({ summary: `Card of ${titleSent(init)}.`, tags: ['notes'], names: [] }) });
  h.state.config.sessionAgent = { audiences: [{ who: everyone, answers: 'general' }] };
  await addNotes(h);
  const prompt = await ask(h);
  const block = blockOf(prompt);
  const read = block.sources.map((source) => source.title);
  assert.ok(read.length >= 1 && read.length < 60, String(read.length));
  assert.ok(block.notRead.length >= 1);
  // The list starts where the reading stopped, and gives each source's card, never its text.
  assert.equal(block.notRead[0].title, `note-${String(read.length).padStart(2, '0')}.md`);
  block.notRead.forEach((entry) => {
    assert.ok(!read.includes(entry.title));
    assert.equal(entry.summary, `Card of ${entry.title.replace('.md', '')}.`);
    assert.doesNotMatch(prompt, new RegExp(`BODY of ${entry.title.replace('.md', '')}\\b`));
  });
  assert.match(prompt.slice(0, prompt.indexOf(OPEN)), /Under "notRead" are further sources that did not fit here and were not read/);
});

test('a stored chat is marked for a group when the answer saw that group’s file only as its card', async () => {
  // Only the group's file has a card, so its card is the one the answer is shown.
  const h = harness({ cards: true, provider: async (url, init) => cardReply(titleSent(init) === 'group' ? { summary: 'CARD of the group plan.', tags: ['plan'] } : 'no card') });
  h.state.config.sessionAgent = { audiences: [{ who: salonMembers, answers: 'detailed' }, { who: everyone, answers: 'general' }], history: true };
  await addNotes(h);
  await idOf(await h.uploadFile({
    name: 'group.md', type: 'text/markdown', bytes: encode('GROUP notes'), extra: { accessConditions: JSON.stringify(groupLockedAccess(['salon'])) },
  }));
  await h.settled();
  const { storage } = createDurableStorage();
  const coordinator = { state: { storage }, readSessionConfigAuthority: async () => ({ config: { sessionAgent: h.state.config.sessionAgent } }) };
  const deps = {
    now: () => Date.parse('2026-11-24T23:30:00.000Z'),
    callSessionAgentHistoryStore: async (env, slug, operation, payload) => {
      const response = await dispatchSessionAgentHistoryStore(coordinator, operation, { slug, ...payload });
      return { ok: response.ok, status: response.status, body: await response.json() };
    },
  };
  const body = { question: 'What is planned?', store: true };
  // A member's Detailed answer: the group's file is past what it reads, so only its card arrives.
  const member = await ask(h, { address: MEMBER, body, deps });
  assert.deepEqual(blockOf(member).notRead, [{ title: 'group.md', kind: 'file', summary: 'CARD of the group plan.', tags: ['plan'] }]);
  assert.doesNotMatch(member, /GROUP notes/);
  // Someone outside the group is shown nothing of it, and their chat carries no group.
  const outsider = await ask(h, { body, deps });
  assert.doesNotMatch(outsider, /group\.md|CARD of the group plan|notRead/);
  assert.deepEqual((await listSessionAgentHistory(storage)).map(({ answers, groups }) => ({ answers, groups })), [
    { answers: 'detailed', groups: ['salon'] },
    { answers: 'general', groups: undefined },
  ]);
});
