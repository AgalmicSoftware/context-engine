import assert from 'node:assert/strict';
import test from 'node:test';

import { Wallet } from 'ethers';
import {
  SESSION_ID, SLUG, createSessionEnv, fetchWorker, login, makeRequest, readJson, uploadJson,
} from './sessionWorkerRuntimeFixture.mjs';
import { storageRoute } from './storageRouteExecution.js';
import { loadWorkerCanonicalResultsAnalysisSource } from './resultsAnalysisGeneration.js';
import { answerPayloadForReader, readsResearchFields } from './researchFieldAccess.js';

const session = { sessionId: SESSION_ID, sessionSlug: SLUG };
// What a shared draft comparison stores with an answer (surveyToolResponsePayloadController.ts).
const provenance = {
  version: 2,
  researchTier: 'minimal',
  draftOrigin: 'voice_interview',
  predictionCondition: 'blind',
  blindAnswer: 'Disagree',
  revealedAt: 1_763_000_000_000,
  source: { platform: 'chatgpt', modelId: 'model-x', verification: 'self_reported' },
  originalPrediction: { answer: 'Agree', confidence: 0.82 },
  predictionRevisions: [{ revision: 1, modelId: 'model-x', confidence: 0.82 }],
  finalSubmitted: { answer: 'Disagree' },
  changedFields: ['answer'],
  userEditedFields: ['answer'],
  redactedFields: [],
  predictionComparison: { version: 2, original: { answer: 'Agree' }, submitted: { answer: 'Disagree' }, changedFields: ['answer'] },
  appliedAt: 1_763_000_000_000,
};
const answer = (questionID) => ({ questionID, type: 'binary', answer: { value: 'Disagree', encrypted: false }, interviewProvenance: provenance, ...session });

// A session where one participant answered with research material, read by everyone who might ask.
const seed = async ({ bundle = false } = {}) => {
  const resultsAdmin = Wallet.createRandom();
  const { admin, env, config } = createSessionEnv({ configOverrides: { resultsAdminAddresses: [resultsAdmin.address] } });
  const adminToken = await login({ env, wallet: admin });
  for (const id of ['q-1', 'q-2']) {
    assert.equal((await uploadJson({ env, token: adminToken, resource: 'questions', data: { id, type: 'binary', prompt: `Statement ${id}`, ...session } })).status, 200);
  }
  const author = Wallet.createRandom();
  const other = Wallet.createRandom();
  const authorToken = await login({ env, wallet: author });
  const data = bundle ? { surveyID: 'survey-1', responses: [answer('q-1'), answer('q-2')], ...session } : answer('q-1');
  const stored = await uploadJson({ env, token: authorToken, resource: 'responses', data });
  assert.equal(stored.status, 200, JSON.stringify(stored.body));
  const id = stored.body.storageRef?.id || stored.body.id;
  assert.ok(id, JSON.stringify(stored.body));
  return {
    env, config, id, author,
    tokens: {
      signedOut: '',
      other: await login({ env, wallet: other }),
      resultsAdmin: await login({ env, wallet: resultsAdmin }),
      author: authorToken,
      admin: adminToken,
    },
  };
};

const items = (payload) => (Array.isArray(payload.responses) ? payload.responses : [payload]);
const read = async (env, id, token) => {
  const response = await fetchWorker(makeRequest(`/storage/read?id=${encodeURIComponent(id)}`, { token }), env);
  assert.equal(response.status, 200);
  return { payload: JSON.parse(await response.text()), cache: response.headers.get('Cache-Control') || '' };
};
const readBatch = async (env, id, token) => {
  const batch = await readJson(await fetchWorker(makeRequest('/storage/read-batch', { method: 'POST', token, body: { ids: [id] } }), env));
  assert.equal(batch.status, 200, JSON.stringify(batch.body));
  assert.equal(batch.body.items[0].status, 200, JSON.stringify(batch.body.items[0]));
  return JSON.parse(batch.body.items[0].text);
};

for (const bundle of [false, true]) {
  const shape = bundle ? 'a survey bundle' : 'one answer';
  test(`${shape}: a read and a batch read leave the research material out for everyone but its author and the admins`, async () => {
    const { env, id, tokens } = await seed({ bundle });
    const expected = { signedOut: false, other: false, resultsAdmin: false, author: true, admin: true };
    for (const [reader, sees] of Object.entries(expected)) {
      const single = await read(env, id, tokens[reader]);
      const batched = await readBatch(env, id, tokens[reader]);
      for (const payload of [single.payload, batched]) {
        assert.equal(items(payload).length, bundle ? 2 : 1, reader);
        for (const item of items(payload)) {
          // The answer itself is unchanged for everyone.
          assert.equal(item.answer.value, 'Disagree', reader);
          assert.equal(item.questionID.startsWith('q-'), true, reader);
          if (sees) assert.deepEqual(item.interviewProvenance, provenance, reader);
          else {
            assert.equal('interviewProvenance' in item, false, `${reader} read the research material`);
            assert.equal(item.interviewProvenanceWithheld, true, reader);
          }
        }
      }
      // The body depends on who reads it, so no shared cache may keep it.
      assert.match(single.cache, /private/, reader);
    }
  });
}

test('an Agent HTTP or MCP agent reading through the storage route gets the answer without the material', async () => {
  const { env, config, id } = await seed();
  const agent = Wallet.createRandom().address.toLowerCase();
  const response = await storageRoute({
    path: '/storage/read', method: 'GET', request: new Request(`https://worker.example/storage/read?id=${id}`),
    env, config, slug: SLUG, uploaderAddress: agent, authScopes: { storage: true }, baseHeaders: {}, deps: {},
  });
  assert.equal(response.status, 200);
  const payload = JSON.parse(await response.text());
  assert.equal(payload.answer.value, 'Disagree');
  assert.equal('interviewProvenance' in payload, false);
  assert.equal(payload.interviewProvenanceWithheld, true);
});

test('the AI inputs (AI Views, the atlas, the risk matrix, the Session Agent) never carry the material', async () => {
  const { env, config } = await seed();
  const source = await loadWorkerCanonicalResultsAnalysisSource({ env, slug: SLUG, config });
  assert.equal(source.ok, true, JSON.stringify(source));
  assert.equal(source.snapshot.responses.length, 1, JSON.stringify(source.counts));
  const text = JSON.stringify(source.snapshot);
  for (const field of ['interviewProvenance', 'originalPrediction', 'blindAnswer', 'predictionComparison', 'changedFields']) {
    assert.equal(text.includes(field), false, field);
  }
});

test('an answer without research material is sent exactly as stored', () => {
  const stored = JSON.stringify({ questionID: 'q-1', answer: { value: 'Agree' } });
  assert.equal(answerPayloadForReader(stored, { reads: false }), null);
  assert.equal(answerPayloadForReader('not json', { reads: false }), null);
  assert.equal(answerPayloadForReader(JSON.stringify(answer('q-1')), { reads: true }).withheld, false);
});

test('only the stored responder or a session admin reads the material', () => {
  const responder = '0x00000000000000000000000000000000000000aa';
  const admins = new Set(['0x00000000000000000000000000000000000000bb']);
  const reads = (requesterAddress, authScopes = {}) =>
    readsResearchFields({ metadata: { responder }, requesterAddress, authScopes, adminAddresses: admins });
  assert.equal(reads(responder.toUpperCase()), true);
  assert.equal(reads('0x00000000000000000000000000000000000000bb'), true);
  assert.equal(reads('0x00000000000000000000000000000000000000cc', { admin: true }), true);
  assert.equal(reads('0x00000000000000000000000000000000000000cc', { storage: true }), false);
  assert.equal(reads(''), false);
  // A row stored without its responder is nobody's own.
  assert.equal(readsResearchFields({ metadata: {}, requesterAddress: responder, adminAddresses: admins }), false);
});
