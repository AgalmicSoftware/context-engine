import test from 'node:test';
import assert from 'node:assert/strict';

import { buildParticipantContextPrompt, loadParticipantContextSources } from './contextSourceLoader.js';
import { resolveInterviewStarter } from './interviewStarter.js';
import { runQueuedAutomaticResultsAnalysisJob } from './resultsAnalysisGeneration.js';
import { buildIndexKey, buildPayloadKey } from './storageRouteExecution.js';
import { groupLockedAccess } from '../../shared/sessionContextSources.mjs';
import { harness, idOf, json, pageResponse } from './contextSourceTestFixture.mjs';

const encode = (text) => new TextEncoder().encode(text);
const sessionContext = { title: 'Context', paragraphs: ['Notes for everyone.'], links: [] };

// One session holding every kind of item: what participants may read, an
// admins-only note, a PDF the AI read, one it did not, and an ordinary upload.
const seeded = async (options = {}) => {
  const h = harness({
    ...options,
    pages: { 'https://example.org/essay': pageResponse('<p>The essay says institutions adapt.</p>') },
    provider: async () => json({ content: [{ type: 'text', text: 'Deck: coalition goals.' }] }),
  });
  h.state.config.sessionContext = sessionContext;
  await idOf(await h.uploadFile({ name: 'agenda.md', type: 'text/markdown', bytes: encode('# Agenda for everyone') }));
  await idOf(await h.uploadFile({ name: 'board.txt', type: 'text/plain', bytes: encode('SECRET admins-only plan'), adminsOnly: true }));
  await idOf(await h.uploadFile({
    name: 'group.txt',
    type: 'text/plain',
    bytes: encode('SECRET notes for one group'),
    extra: { accessConditions: JSON.stringify(groupLockedAccess('salon')) },
  }));
  await idOf(await h.context({ action: 'add-link', url: 'https://example.org/essay' }));
  const deck = await idOf(await h.uploadFile({ name: 'deck.pdf' }));
  await idOf(await h.context({ action: 'read-pdf', id: deck }));
  await idOf(await h.uploadFile({ name: 'unread.pdf' }));
  const privateDeck = await idOf(await h.uploadFile({ name: 'private-deck.pdf', adminsOnly: true }));
  await idOf(await h.context({ action: 'read-pdf', id: privateDeck }));
  return h;
};

test('the Worker’s AI gets only what every participant may read', async () => {
  for (const encryption of ['none', 'worker_envelope']) {
    const h = await seeded({ encryption });
    const sources = await loadParticipantContextSources({ env: h.env, slug: 'salon', config: h.state.config, deps: h.deps });
    assert.deepEqual(sources.map((source) => [source.title, source.kind, source.text]), [
      ['agenda.md', 'file', '# Agenda for everyone'],
      ['example.org', 'link', 'The essay says institutions adapt.'],
      ['deck.pdf', 'file', 'Deck: coalition goals.'],
    ]);
    assert.equal(sources[1].url, 'https://example.org/essay');
    assert.deepEqual(sources.map((source) => source.readByAi), [false, false, true]);
    const prompt = await buildParticipantContextPrompt({ env: h.env, slug: 'salon', config: h.state.config, deps: h.deps });
    assert.match(prompt, /Notes for everyone/);
    assert.doesNotMatch(prompt, /SECRET|private-deck|unread/);
  }
});

test('a context row whose access no longer matches the session’s is left out', async () => {
  const h = await seeded();
  const tightened = {
    ...h.state.config,
    storageProfile: { backend: 'cloudflare', payloadAccessControl: { gate: 'role_gate', encryption: 'none', accessConditions: { match: 'all', conditions: [{ kind: 'worker_role', role: 'admin' }] } } },
  };
  assert.deepEqual(await loadParticipantContextSources({ env: h.env, slug: 'salon', config: tightened, deps: h.deps }), []);
});

test('the interview opening carries the participants’ context as untrusted data', async () => {
  const h = await seeded();
  const prompts = [];
  const result = await resolveInterviewStarter({
    env: { ...h.env, GROUP_KV: { get: async () => null, put: async () => {} } },
    slug: 'salon',
    config: { ...h.state.config, sessionName: 'Salon', ai: { mode: 'openai', models: { fast: 'gpt-4o-mini' } } },
    deps: {
      ...h.deps,
      loadPublicInterviewQuestions: async () => ({ questions: [{ id: 'q1', prompt: 'Should councils adapt?' }], incomplete: false }),
      getSessionSecrets: async () => ({ openaiKey: 'synthetic-key' }),
      proxyOpenAI: async ({ payload }) => {
        prompts.push(payload.messages[0].content);
        return Response.json({ completion: 'Which institution should change first?' });
      },
    },
  });
  assert.equal(result.openingPrompt, 'Which institution should change first?');
  const [prompt] = prompts;
  assert.match(prompt, /Should councils adapt\?/);
  assert.match(prompt, /<session_context>[\s\S]*The essay says institutions adapt\.[\s\S]*<\/session_context>/);
  assert.match(prompt, /Deck: coalition goals\./);
  assert.match(prompt, /untrusted reference data/);
  assert.doesNotMatch(prompt, /SECRET/);
  assert.ok(prompt.length < 24_000 + 4_500);
});

test('results analysis gives the AI the participants’ context, outside the source signature', async () => {
  const h = await seeded();
  const sessionId = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
  const question = { sessionSlug: 'salon', sessionId, questionId: 'q1', prompt: 'Question?', type: 'text' };
  const metadata = { id: 'qmeta1', resource: 'questions', backend: 'cloudflare', contentType: 'application/json', encrypted: false, createdAt: '2026-09-17T00:00:00.000Z' };
  await h.env.CE_STORAGE_INDEX_KV.put(buildIndexKey({ slug: 'salon', resource: 'questions', id: 'qmeta1' }), JSON.stringify(metadata));
  await h.env.CE_STORAGE_INDEX_KV.put(buildPayloadKey({ slug: 'salon', id: 'qmeta1' }), JSON.stringify({ metadata, payloadBase64url: Buffer.from(JSON.stringify(question)).toString('base64url') }));
  const committedResponses = [1, 2, 3].map((index) => ({
    metadata: { id: `r${index}`, responder: `0x${String(index).repeat(40)}`, createdAt: '2026-09-17T00:00:00.000Z' },
    payload: { sessionSlug: 'salon', sessionId, questionId: 'q1', answer: `View ${index}` },
  }));
  const config = {
    ...h.state.config,
    sessionIdHex: sessionId,
    sessionModeProfile: { authority: { mode: 'worker_canonical' }, storage: { backend: 'cloudflare' } },
    resultsAnalysis: { version: 1, generationMode: 'both', views: { circles: true, breakdown: true, riskMatrix: true }, autoAfter: { threshold: 2, unit: 'distinctParticipants' }, inputScope: 'submitted', publication: 'latest_success_visible' },
    ai: { models: { thinking: { provider: 'custom', model: 'fixture-model' } }, providers: { custom: { rpcUrl: 'https://analysis.example.test/complete' } } },
  };
  const prompts = [];
  const result = await runQueuedAutomaticResultsAnalysisJob({
    env: h.env,
    slug: 'salon',
    job: { requestId: 'context-auto', committedResponses },
    deps: {
      ...h.deps,
      getSessionConfig: async () => config,
      getSessionSecrets: async () => ({}),
      readCoordinatedResultsAnalysisStatus: async () => ({ ok: true, state: {} }),
      reserveCoordinatedResultsAnalysis: async () => ({ kind: 'execute', attemptId: 'attempt-context' }),
      finalizeCoordinatedResultsAnalysis: async () => ({ ok: true }),
      fetch: async (_url, init) => {
        prompts.push(JSON.parse(init.body).messages[0].content);
        return Response.json({ choices: [{ message: { content: JSON.stringify({ breakdown: { summary: { overview: 'Report' } } }) } }] });
      },
    },
  });
  assert.equal(result.ok, true, JSON.stringify(result));
  const [prompt] = prompts;
  assert.match(prompt, /never in this background/);
  assert.match(prompt, /The essay says institutions adapt\./);
  assert.doesNotMatch(prompt, /SECRET/);
  const snapshot = prompt.slice(prompt.indexOf('Session input:'), prompt.indexOf('The session\'s hosts gave'));
  assert.doesNotMatch(snapshot, /institutions adapt/, 'context stays out of the analysed snapshot');
  assert.equal(result.draft.source.signature.startsWith('sha256:'), true);
  // The same responses with no context give the same source signature.
  const bare = await runQueuedAutomaticResultsAnalysisJob({
    env: { CE_STORAGE_INDEX_KV: h.env.CE_STORAGE_INDEX_KV },
    slug: 'salon',
    job: { requestId: 'bare-auto', committedResponses },
    deps: {
      getSessionConfig: async () => ({ ...config, sessionContext: undefined }),
      getSessionSecrets: async () => ({}),
      readCoordinatedResultsAnalysisStatus: async () => ({ ok: true, state: {} }),
      reserveCoordinatedResultsAnalysis: async () => ({ kind: 'execute', attemptId: 'attempt-bare' }),
      finalizeCoordinatedResultsAnalysis: async () => ({ ok: true }),
      fetch: async () => Response.json({ choices: [{ message: { content: JSON.stringify({ breakdown: { summary: { overview: 'Report' } } }) } }] }),
    },
  });
  assert.equal(bare.draft.source.signature, result.draft.source.signature);
});
