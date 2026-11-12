import assert from 'node:assert/strict';
import test from 'node:test';

import { loadAdminSnapshotResultsAnalysisSource } from './resultsAnalysisGeneration.js';
import {
  RESULTS_ANALYSIS_MAX_DRAFT_CHARS, finalizeCoordinatedResultsAnalysis, readCoordinatedResultsAnalysisStatus,
  reserveCoordinatedResultsAnalysis,
} from './sessionWriteCoordinator.js';
import {
  SESSION_ID, SLUG, createSessionEnv, fetchWorker, makeRequest, readJson,
} from './sessionWorkerRuntimeFixture.mjs';
import { sha256Hex } from '../shared/deployHelperCore.mjs';

// AI Views keeps its views and every answer they cover in the session's
// coordinator object. These tests store salon-sized drafts through that object
// and read them back the way people open AI Views.
const ROUND_TRIP_MS = 10;
const OLD_LIMIT_CHARS = 64 * 24_000;
const LONG = { questions: 53, written: 10, writtenChars: 1_500, commentChars: 500, commentShare: 0.5 };

const prose = (chars, seed) => {
  let text = '';
  while (text.length < chars) text += `Point ${seed}: we'd want the group to weigh this "carefully".\n`;
  return text.slice(0, chars);
};

// Everyone answers every question; `written` of them take written answers and
// `commentShare` of all answers carry a comment. The answers pass through the
// same cleaning AI Views gives them before they are stored.
const salonDraft = async ({ config, people, questions, written, writtenChars, commentChars, commentShare }, id) => {
  const questionList = Array.from({ length: questions }, (_, index) => (index < written
    ? { id: `q-${index}`, type: 'freeform', prompt: `Written question ${index}?` }
    : { id: `q-${index}`, type: 'binary', prompt: `Statement ${index} about the topic.` }));
  const responses = [];
  let count = 0;
  for (let person = 1; person <= people; person += 1) {
    for (const question of questionList) {
      count += 1;
      responses.push({
        sessionSlug: SLUG, sessionId: SESSION_ID, questionId: question.id,
        participantId: `0x${person.toString(16).padStart(40, '0')}`,
        answer: question.type === 'freeform' ? prose(writtenChars, count) : (count % 2 ? 'Agree' : 'Disagree'),
        ...((count * 37) % 100 < commentShare * 100 ? { additional: prose(commentChars, count) } : {}),
        importance: 3, submittedAt: '2026-11-24T18:00:00.000Z',
      });
    }
  }
  const source = await loadAdminSnapshotResultsAnalysisSource({
    body: { source: { snapshot: { sessionSlug: SLUG, sessionId: SESSION_ID, questions: questionList, responses } } },
    slug: SLUG, config,
  });
  assert.equal(source.ok, true, source.error);
  return {
    draftId: `draft-${id}`, generatedAt: '2026-11-24T19:00:00.000Z', source: { kind: 'admin-snapshot', ...source.counts },
    sections: ['breakdown'], artifact: { version: 1, sections: { breakdown: { available: true, summary: prose(6_000, id) } } },
    snapshot: source.snapshot, participantWatermark: source.participantDigests,
  };
};

// A session whose results, AI Views included, everyone may open.
const openResults = (config) => ({ sessionModeProfile: { ...config.sessionModeProfile, preset: 'custom', export: { scope: 'all_session' },
  results: { visibility: 'public_full_if_storage_public', exposure: { aggregateResultsEnabled: true, anonymizedGroupsEnabled: false, minGroupSize: 2 } } } });

const setup = async () => {
  const base = createSessionEnv().config;
  const created = createSessionEnv({ configOverrides: openResults(base) });
  const { env } = created;
  const sessionObject = `memory:${await sha256Hex(`session-config:${SLUG}`)}`;
  const calls = [];
  const get = env.CE_SESSION_COORDINATOR.get;
  // Each call to the session's object crosses the network, as on Cloudflare.
  env.CE_SESSION_COORDINATOR.get = (objectId) => {
    const stub = get(objectId);
    if (objectId !== sessionObject) return stub;
    return { fetch: async (input, init) => {
      calls.push(new URL(input instanceof Request ? input.url : input).pathname);
      await new Promise((resolve) => setTimeout(resolve, ROUND_TRIP_MS));
      return stub.fetch(input, init);
    } };
  };
  const build = async (draft, targetEnv = env) => {
    const reservation = { requestId: draft.draftId, reservationKey: `rk-${draft.draftId}`, sourceSignature: draft.draftId, viewSignature: 'views', refresh: true, trigger: 'manual' };
    const reserved = await reserveCoordinatedResultsAnalysis({ env: targetEnv, slug: SLUG, reservation });
    assert.equal(reserved.kind, 'execute', JSON.stringify(reserved));
    return finalizeCoordinatedResultsAnalysis({ env: targetEnv, slug: SLUG, finalization: {
      requestId: reservation.requestId, reservationKey: reservation.reservationKey, attemptId: reserved.attemptId,
      success: true, receipt: { ok: true, draft },
    } });
  };
  const view = async ({ token, targetEnv = env } = {}) => readJson(await fetchWorker(makeRequest('/results-analysis/artifact', { token }), targetEnv));
  const statusCalls = () => calls.filter((path) => path === '/results-analysis/status').length;
  return { ...created, build, view, statusCalls, calls };
};

test('a 50-person salon with long written answers, too large before, is stored and read back whole', async () => {
  const s = await setup();
  const draft = await salonDraft({ config: s.config, people: 50, ...LONG }, 'salon');
  const chars = JSON.stringify(draft).length;
  assert.ok(chars > OLD_LIMIT_CHARS, `${chars} characters should exceed the old limit`);
  const built = await s.build(draft);
  assert.equal(built.ok, true, JSON.stringify(built));

  const read = await s.view();
  assert.equal(read.status, 200, JSON.stringify(read.body).slice(0, 300));
  assert.equal(read.body.snapshot.responses.length, 50 * 53);
  assert.deepEqual(read.body.snapshot, draft.snapshot);
});

test('a draft at the ceiling is stored; one just past it is refused in plain words and the last one kept', async () => {
  const s = await setup();
  const atCeiling = await salonDraft({ config: s.config, people: 118, ...LONG }, 'ceiling');
  const chars = JSON.stringify(atCeiling).length;
  assert.ok(chars > 0.97 * RESULTS_ANALYSIS_MAX_DRAFT_CHARS && chars <= RESULTS_ANALYSIS_MAX_DRAFT_CHARS, `${chars} characters`);
  assert.equal((await s.build(atCeiling)).ok, true);
  const stored = await s.view();
  assert.equal(stored.status, 200);
  assert.deepEqual(stored.body.snapshot, atCeiling.snapshot);

  const past = await salonDraft({ config: s.config, people: 122, ...LONG }, 'past');
  const refused = await s.build(past);
  assert.equal(refused.status, 413);
  assert.match(refused.error, /^AI Views could not be saved: its answers and views come to 4\.7 million characters, over its limit of 4\.6 million/);
  assert.match(refused.error, /hiding long written-answer questions it does not need/);
  const kept = await readCoordinatedResultsAnalysisStatus({ env: s.env, slug: SLUG });
  assert.equal(kept.state.lastGood.draftId, 'draft-ceiling');
  assert.equal(kept.state.jobState, 'failed');
});
