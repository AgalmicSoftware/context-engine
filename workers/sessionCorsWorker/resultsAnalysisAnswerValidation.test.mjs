import test from 'node:test';
import assert from 'node:assert/strict';
import { buildIndexKey, buildPayloadKey } from './storageRouteExecution.js';
import { generateResultsAnalysisDraft, loadWorkerCanonicalResultsAnalysisSource } from './resultsAnalysisGeneration.js';

const slug = 'validation-session';
const sessionId = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const config = {
  slug, sessionIdHex: sessionId,
  sessionModeProfile: { authority: { mode: 'worker_canonical' }, storage: { backend: 'cloudflare' } },
  resultsAnalysis: { version: 1, generationMode: 'both', views: { breakdown: true }, autoAfter: { threshold: 2, unit: 'distinctParticipants' } },
};
const questions = [
  { id: 'rating', type: 'rating', scale: { min: 1, max: 10 } },
  { id: 'zero-rating', type: 'rating', scale: { min: 0, max: 100 } },
  { id: 'single', type: 'multichoice', options: ['A', 'B'], singleSelect: true },
  { id: 'multi', type: 'multichoice', options: ['A', 'B', 'C'], maxSelections: 2 },
  { id: 'quadratic', type: 'quadratic', options: ['A', 'B'], voiceCredits: 25 },
  { id: 'bad-budget', type: 'quadratic', options: ['A', 'B'], voiceCredits: 0 },
  { id: 'binary', type: 'binary' },
  { id: 'freeform', type: 'freeform' },
  { id: 'wide', type: 'multichoice', options: Array.from({ length: 13 }, (_, i) => `Option ${i}`) },
  { id: 'long', type: 'multichoice', options: ['A'.repeat(150), 'B'], singleSelect: true },
];
const valid = [
  ['rating', '7'], ['zero-rating', 0], ['single', ['A']], ['multi', ['A', 'B']],
  ['quadratic', [3, -4]], ['binary', 'Agree'], ['freeform', 'A useful concern'],
  ['wide', ['Option 12']], ['long', 'A'.repeat(150)], ['multi', ['A', 'A']], ['multi', []],
  ['rating', null], ['rating', ' '], ['freeform', 0], ['freeform', false], ['binary', false],
];
const invalid = [
  ['rating', 1000000], ['rating', false], ['rating', []],
  ['single', ['A', 'B']], ['single', ['unknown']], ['multi', ['A', 'B', 'C']], 
  ['bad-budget', [0, 0]], ['quadratic', [500, 500]], ['quadratic', [1.5, 0]], ['quadratic', [0]], ['quadratic', ['0', '0']],
  ['binary', 'invented'], ['freeform', { unexpected: 'object' }],
];
async function fixture(rows) {
  const store = new Map();
  const kv = {
    async put(key, value) { store.set(key, value); },
    async get(key) { return store.get(key) ?? null; },
    async list({ prefix }) { return { keys: [...store.keys()].filter((key) => key.startsWith(prefix)).map((name) => ({ name })), list_complete: true }; },
  };
  async function put(resource, id, payload, metadata = {}) {
    const info = { id, resource, backend: 'cloudflare', contentType: 'application/json', encrypted: false, createdAt: '2026-09-20T00:00:00.000Z', ...metadata };
    await kv.put(buildIndexKey({ slug, resource, id }), JSON.stringify(info));
    await kv.put(buildPayloadKey({ slug, id }), JSON.stringify({ metadata: info, payloadBase64url: Buffer.from(JSON.stringify({ sessionSlug: slug, sessionId, ...payload })).toString('base64url') }));
  }
  for (const question of questions) await put('questions', question.id, { ...question, prompt: `Question ${question.id}` });
  for (const [index, [questionId, answer, comment = 'Comments must not rescue an invalid answer']] of rows.entries()) {
    await put('responses', `r${index}`, { questionId, answer: { value: answer }, additionalComments: comment }, { responder: `0x${(index + 1).toString(16).padStart(40, '0')}` });
  }
  return { CE_STORAGE_INDEX_KV: kv };
}

test('canonical analysis excludes impossible answers before counts and the provider, preserving valid full question contracts', async () => {
  const env = await fixture([...valid, ...invalid]);
  const source = await loadWorkerCanonicalResultsAnalysisSource({ env, slug, config });
  assert.equal(source.ok, true);
  assert.equal(source.counts.responseCount, valid.length);
  assert.equal(source.counts.participantCount, valid.length);
  assert.equal(source.counts.excludedCount, invalid.length);
  assert.equal(source.snapshot.responses.find((row) => row.questionId === 'zero-rating').answer, '0');
  assert.equal(source.snapshot.responses.find((row) => row.questionId === 'quadratic').answer, 'A: +3; B: -4');
  assert.equal(source.snapshot.questions.find((row) => row.id === 'single').singleSelect, true);
  assert.equal(source.aiSnapshot.questions.find((row) => row.id === 'multi').maxSelections, 2);
  assert.equal(source.snapshot.responses.filter((row) => row.questionId === 'rating' && row.answer === '').length, 2);
  let providerSource;
  const result = await generateResultsAnalysisDraft({ env, slug, config, body: { requestId: 'valid-input', source: { kind: 'worker-canonical' } }, deps: {
    reserveCoordinatedResultsAnalysis: async () => ({ kind: 'execute', attemptId: 'test-attempt' }),
    finalizeCoordinatedResultsAnalysis: async () => ({ ok: true }),
    generateAnalysisArtifact: async ({ source: input }) => { providerSource = input; return { ok: true, value: { breakdown: { summary: { overview: 'Synthetic summary' } } } }; },
  } });
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(providerSource.counts.responseCount, valid.length);
  assert.equal(providerSource.aiSnapshot.responses.some((row) => row.answer.includes('500')), false);
});

test('invalid-only canonical data cannot satisfy generation eligibility', async () => {
  const env = await fixture(invalid);
  let called = false;
  const result = await generateResultsAnalysisDraft({ env, slug, config, body: { requestId: 'invalid-input', source: { kind: 'worker-canonical' } }, deps: {
    generateAnalysisArtifact: async () => { called = true; throw new Error('must not be called'); },
  } });
  assert.equal(result.status, 422, JSON.stringify(result));
  assert.equal(called, false);
});

test('empty choice without a comment is excluded, while a comment-only choice survives', async () => {
  const env = await fixture([['multi', [], ''], ['multi', [], 'A relevant comment']]);
  const source = await loadWorkerCanonicalResultsAnalysisSource({ env, slug, config });
  assert.equal(source.counts.responseCount, 1);
  assert.equal(source.counts.excludedCount, 1);
  assert.equal(source.snapshot.responses[0].answer, '');
  assert.equal(source.snapshot.responses[0].additional, 'A relevant comment');
});
