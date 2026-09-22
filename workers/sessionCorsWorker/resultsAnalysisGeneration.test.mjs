import test from 'node:test';
import assert from 'node:assert/strict';
import { SessionWriteCoordinator } from './sessionWriteCoordinator.js';
import { dispatchResultsAnalysisArtifactRequest } from './resultsAnalysisArtifactDispatch.js';
import { validateWorkerConfigModeValues } from '../shared/workerConfigModeValidation.mjs';

import {
  buildIndexKey,
  buildPayloadKey,
} from './storageRouteExecution.js';
import {
  buildResultsAnalysisStatusBody,
  evaluateResultsAnalysisViewerEligibility,
  generateResultsAnalysisDraft,
  loadAdminSnapshotResultsAnalysisSource,
  loadWorkerCanonicalResultsAnalysisSource,
  maybeTriggerAutomaticResultsAnalysis,
  normalizeGeneratedArtifact,
  readPublishedResultsAnalysisArtifact,
  readResultsAnalysisAdminStatus,
  resolveAnalysisAiPayload,
  resolveResultsAnalysisCapability,
} from './resultsAnalysisGeneration.js';

const sessionId = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const config = {
  slug: 'session-a',
  sessionIdHex: sessionId,
  sessionName: 'Session A',
  sessionModeProfile: {
    authority: { mode: 'worker_canonical' },
    storage: { backend: 'cloudflare' },
  },
  resultsAnalysis: {
    version: 1,
    generationMode: 'both',
    views: { circles: true, breakdown: true, riskMatrix: true },
    autoAfter: { threshold: 2, unit: 'distinctParticipants' },
    inputScope: 'submitted',
    publication: 'latest_success_visible',
  },
};

const b64url = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');

const createKv = () => {
  const store = new Map();
  return {
    store,
    async put(key, value) { store.set(key, value); },
    async get(key) { return store.get(key) || null; },
    async list({ prefix = '' } = {}) {
      return {
        keys: [...store.keys()].filter((name) => name.startsWith(prefix)).map((name) => ({ name })),
        list_complete: true,
      };
    },
  };
};

const putPayload = async ({ kv, slug = 'session-a', resource, id, metadata = {}, payload }) => {
  const fullMetadata = {
    id,
    resource,
    backend: 'cloudflare',
    contentType: 'application/json',
    encrypted: false,
    createdAt: '2026-09-17T00:00:00.000Z',
    ...metadata,
  };
  await kv.put(buildIndexKey({ slug, resource, id }), JSON.stringify(fullMetadata));
  await kv.put(buildPayloadKey({ slug, id }), JSON.stringify({
    metadata: fullMetadata,
    payloadBase64url: b64url(payload),
  }));
};

test('generated and stored artifacts enforce current group thresholds and disabled views', async () => {
  const access = { gate: 'none', encryption: 'none' };
  const settings = { ...config, storageProfile: { backend: 'cloudflare', payloadAccessControl: access },
    sessionModeProfile: {
      profileVersion: 1, preset: 'custom', authority: { mode: 'worker_canonical' }, evm: { registryChainId: null },
      storage: { backend: 'cloudflare', payloadAccessControl: access }, identity: { default: 'passkey', enabled: ['passkey'] },
      authorization: { mechanisms: ['worker_roles'] }, encryption: { mode: 'none' },
      surfaces: { web: true, telegram: false, miniApp: false, agentHttp: false, mcp: false, ceCc: false },
      results: { visibility: 'public_full_if_storage_public', exposure: { aggregateResultsEnabled: true, anonymizedGroupsEnabled: true, minGroupSize: 2 } },
      export: { scope: 'all_session' },
    } };
  assert.equal(validateWorkerConfigModeValues(settings).ok, true);
  const values = new Map();
  const storage = { get: async (key) => structuredClone(values.get(key)), put: async (key, value) => values.set(key, structuredClone(value)),
    delete: async (key) => values.delete(key), transaction: async (callback) => callback(storage) };
  const env = {};
  const coordinator = new SessionWriteCoordinator({ storage }, env);
  env.CE_SESSION_COORDINATOR = { idFromName: (name) => name, get: () => ({ fetch: (url, init) => coordinator.fetch(new Request(url, init)) }) };
  const one = ['participant_001'];
  const pair = ['participant_001', 'participant_002'];
  const all = [...pair, 'participant_003'];
  const generatedValue = {
    breakdown: { summary: { overview: 'Overall synthesis' }, groups: [
      { id: 'small', label: 'Suppressed singleton', participantIds: [...one, ...one] },
      { id: 'pair', label: 'Pair', participantIds: pair },
      { id: 'all', label: 'Whole cohort', participantIds: all },
      { id: 'uncited', label: 'Unproven cohort' },
    ] },
    argumentMap: { debates: [{ id: 'topic', title: 'Topic', claims: [
      { id: 'small', label: 'Suppressed singleton', participantIds: one }, { id: 'all', label: 'Common claim', participantIds: all },
    ] }] },
    atlas: { nodes: [{ id: 'small', label: 'Suppressed singleton', participantIds: one }, { id: 'all', label: 'Common node', participantIds: all }],
      edges: [{ source: 'small', target: 'all' }] },
    riskMatrix: { categories: [
      { id: 'small', label: 'Suppressed singleton', likelihood: 'low', impact: 'high', participantIds: one },
      { id: 'all', label: 'Common risk', likelihood: 'high', impact: 'high', participantIds: all },
    ], comments: [{ categoryId: 'small', summary: 'Suppressed orphan', participantIds: all }] },
  };
  const body = { requestId: 'privacy-check', source: { kind: 'admin-snapshot', snapshot: { sessionSlug: 'session-a', sessionId,
    questions: [{ id: 'q1', prompt: 'Question?', type: 'text' }],
    responses: [1, 2, 3].map((i) => ({ questionId: 'q1', participantId: 'synthetic-' + i, answer: 'View ' + i })) } } };
  const generated = await generateResultsAnalysisDraft({ env, config: settings, slug: 'session-a', body,
    deps: { generateAnalysisArtifact: async () => ({ ok: true, value: generatedValue }) } });
  assert.equal(generated.ok, true, JSON.stringify(generated));
  const sections = generated.draft.artifact.sections;
  assert.deepEqual(sections.breakdown.groups.map((group) => group.id), ['pair', 'all']);
  const originalSections = normalizeGeneratedArtifact({ value: generatedValue,
    source: { participants: generated.draft.artifact.participants, aiSnapshot: { questions: [{ id: 'q1' }], responses: all.map((participantId) => ({ participantId, questionId: 'q1' })) } },
    sections: ['argumentMap', 'atlas', 'breakdown', 'riskMatrix'],
  }).sections;
  for (const key of ['argumentMap', 'atlas', 'riskMatrix']) assert.deepEqual(sections[key], originalSections[key]);
  const read = async (current) => {
    const response = await dispatchResultsAnalysisArtifactRequest({ request: new Request('https://worker.invalid/results-analysis/artifact'),
      env, slug: 'session-a', config: current, address: '', scopes: {}, headers: {},
      deps: { json: (value, status, headers) => new Response(JSON.stringify(value), { status, headers }) } });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'private, no-store');
    return response.json();
  };
  const stricter = structuredClone(settings);
  stricter.sessionModeProfile.results.exposure.minGroupSize = 3;
  assert.deepEqual((await read(stricter)).artifact.sections.breakdown.groups.map((group) => group.id), ['all']);
  const replay = await generateResultsAnalysisDraft({ env, config: stricter, slug: 'session-a', body,
    deps: { generateAnalysisArtifact: async () => ({ ok: true, value: generatedValue }) } });
  assert.deepEqual(replay.draft.artifact.sections.breakdown.groups.map((group) => group.id), ['all']);
  stricter.sessionModeProfile.results.exposure.anonymizedGroupsEnabled = false;
  const disabledGroups = await read(stricter);
  assert.deepEqual(disabledGroups.artifact.sections.breakdown.groups, []);
  assert.equal(disabledGroups.artifact.sections.breakdown.summary.overview, 'Overall synthesis');
  for (const key of ['argumentMap', 'atlas', 'riskMatrix']) assert.deepEqual(disabledGroups.artifact.sections[key], originalSections[key]);
  assert.deepEqual(disabledGroups.snapshot, generated.draft.snapshot);
  const adminStatus = await readResultsAnalysisAdminStatus({ env, slug: 'session-a', config: stricter });
  assert.deepEqual(adminStatus.state.lastGood.artifact.sections.breakdown.groups, []);
  assert.equal(disabledGroups.snapshot.responses.length, 3); // Raw public results remain independently available.
  const disabledGeneration = await generateResultsAnalysisDraft({ env, config: stricter, slug: 'session-a', body: { ...body, requestId: 'groups-disabled' },
    deps: { generateAnalysisArtifact: async () => ({ ok: true, value: generatedValue }) } });
  assert.deepEqual(disabledGeneration.draft.artifact.sections.breakdown.groups, []);
  const legacy = structuredClone(settings);
  delete legacy.sessionModeProfile.results.exposure;
  const legacyGenerated = await generateResultsAnalysisDraft({ env, config: legacy, slug: 'session-a', body: { ...body, requestId: 'legacy-groups' }, deps: { generateAnalysisArtifact: async () => ({ ok: true, value: generatedValue }) } });
  assert.equal(legacyGenerated.ok, true);
  assert.deepEqual(legacyGenerated.draft.artifact.sections.breakdown.groups.map((group) => group.id), ['small', 'pair', 'all', 'uncited']);
  stricter.resultsAnalysis.views = { circles: false, breakdown: false, riskMatrix: false };
  const hidden = await read(stricter);
  assert.equal(Object.values(hidden.artifact.sections).every((section) => section.available === false), true);
});

test('admin snapshot sanitizes to existing schema, accepts 0/false values, and rejects locked rows', async () => {
  const baseBody = {
    source: {
      kind: 'admin-snapshot',
      snapshot: {
        sessionSlug: 'session-a',
        sessionId,
        questions: [{ questionId: 'q1', prompt: 'Choose?', type: 'number' }],
        responses: [
          { questionId: 'q1', participantId: 'alice', answer: 0, additionalComments: false },
          { questionId: 'q1', participantId: 'bob', answer: 'yes' },
          { questionId: 'q1', participantId: 'cara', answer: 'no', additional: 'extra context' },
        ],
      },
    },
  };
  const source = await loadAdminSnapshotResultsAnalysisSource({ body: baseBody, slug: 'session-a', config });
  assert.equal(source.ok, true);
  assert.deepEqual(source.snapshot.questions, [{ id: 'q1', prompt: 'Choose?', type: 'number', options: [], tags: [] }]);
  const zeroRow = source.snapshot.responses.find((row) => row.answer === '0');
  assert.ok(zeroRow);
  assert.equal(zeroRow.additional, 'false');
  assert.equal(source.aiSnapshot.responses[0].participantId, 'participant_001');
  assert.equal(source.snapshot.responses.some((row) => row.additional === 'extra context'), true);

  const locked = structuredClone(baseBody);
  locked.source.snapshot.responses[0].answer = { value: 'decrypted text', encryptedPortion: 'ciphertext' };
  const rejected = await loadAdminSnapshotResultsAnalysisSource({ body: locked, slug: 'session-a', config });
  assert.equal(rejected.ok, false);
  assert.equal(rejected.status, 400);
});

test('worker-canonical source trusts metadata responder, dedupes latest per question and responder, and rejects unknown questions', async () => {
  const kv = createKv();
  const env = { CE_STORAGE_INDEX_KV: kv };
  await putPayload({
    kv,
    resource: 'questions',
    id: 'qmeta1',
    payload: { sessionSlug: 'session-a', sessionId, questionId: 'q1', prompt: 'Canonical question?', type: 'text' },
  });
  await putPayload({
    kv,
    resource: 'responses',
    id: 'r1',
    metadata: { responder: '0x1111111111111111111111111111111111111111', createdAt: '2026-09-17T00:00:00.000Z' },
    payload: { sessionSlug: 'session-a', sessionId, questionId: 'q1', participantId: 'spoof-a', answer: 'old', submittedAt: '2099-01-01T00:00:00.000Z' },
  });
  await putPayload({
    kv,
    resource: 'responses',
    id: 'r2',
    metadata: { responder: '0x1111111111111111111111111111111111111111', createdAt: '2026-09-17T00:01:00.000Z' },
    payload: { sessionSlug: 'session-a', sessionId, questionId: 'q1', participantId: 'spoof-b', answer: 'new' },
  });
  await putPayload({
    kv,
    resource: 'responses',
    id: 'r3',
    metadata: { responder: '0x2222222222222222222222222222222222222222', createdAt: '2026-09-17T00:02:00.000Z' },
    payload: { sessionSlug: 'session-a', sessionId, questionId: 'unknown', answer: 'ignored' },
  });
  await putPayload({
    kv,
    resource: 'responses',
    id: 'r4',
    metadata: { responder: '0x3333333333333333333333333333333333333333', createdAt: '2026-09-17T00:03:00.000Z' },
    payload: { sessionSlug: 'session-a', sessionId, questionId: 'q1', answer: '*' },
  });
  const source = await loadWorkerCanonicalResultsAnalysisSource({ env, slug: 'session-a', config });
  assert.equal(source.ok, true);
  assert.equal(source.counts.responseCount, 1);
  assert.equal(source.counts.excludedCount, 2);
  assert.equal(source.counts.lockedCount, 1);
  assert.equal(source.snapshot.responses[0].answer, 'new');
  assert.equal(source.snapshot.responses[0].submittedAt, '2026-09-17T00:01:00.000Z');
  assert.equal(source.snapshot.responses[0].participantId, 'participant_001');
});

test('worker-canonical source accepts public response envelopes with empty encrypted fields while rejecting non-empty encrypted envelopes', async () => {
  const kv = createKv();
  const env = { CE_STORAGE_INDEX_KV: kv };
  await putPayload({
    kv,
    resource: 'questions',
    id: 'qmeta1',
    payload: { sessionSlug: 'session-a', sessionId, questionId: 'q1', prompt: 'Public answer?', type: 'text' },
  });
  await putPayload({
    kv,
    resource: 'questions',
    id: 'qmeta2',
    payload: { sessionSlug: 'session-a', sessionId, questionId: 'q2', prompt: 'Research answer?', type: 'text' },
  });
  const publicAnswer = {
    value: 'plain public answer',
    encrypted: false,
    hash: '',
    encryptedPortion: '',
  };
  const publicAdditional = {
    value: 'plain public comment',
    encrypted: false,
    hash: '',
    encryptedPortion: '',
  };
  await putPayload({
    kv,
    resource: 'responses',
    id: 'public-normal',
    metadata: { responder: '0x1111111111111111111111111111111111111111', createdAt: '2026-09-17T00:00:00.000Z' },
    payload: {
      sessionSlug: 'session-a',
      sessionId,
      questionId: 'q1',
      answer: publicAnswer,
      additional: publicAdditional,
    },
  });
  await putPayload({
    kv,
    resource: 'responses',
    id: 'public-research',
    metadata: { responder: '0x2222222222222222222222222222222222222222', createdAt: '2026-09-17T00:01:00.000Z' },
    payload: {
      sessionSlug: 'session-a',
      sessionId,
      questionId: 'q2',
      answer: publicAnswer,
      additional: publicAdditional,
      interviewProvenance: {
        includeAiProvenance: true,
        includePredictionComparison: true,
        source: { platform: 'claude', modelId: 'self_reported', verification: 'self_reported' },
        originalPrediction: {
          answer: publicAnswer,
          additionalComments: publicAdditional,
          confidence: 0.7,
          evidence: 'Synthetic evidence.',
        },
        predictionComparison: {
          original: { answer: publicAnswer, additionalComments: publicAdditional },
          submitted: { answer: publicAnswer, additionalComments: publicAdditional },
          changedFields: [],
          userEditedFields: [],
          redactedFields: [],
        },
      },
    },
  });
  await putPayload({
    kv,
    resource: 'responses',
    id: 'locked-nonempty-string',
    metadata: { responder: '0x3333333333333333333333333333333333333333', createdAt: '2026-09-17T00:02:00.000Z' },
    payload: {
      sessionSlug: 'session-a',
      sessionId,
      questionId: 'q1',
      answer: { value: 'secret', encrypted: false, hash: '', encryptedPortion: 'ciphertext' },
    },
  });
  await putPayload({
    kv,
    resource: 'responses',
    id: 'locked-nonempty-object',
    metadata: { responder: '0x4444444444444444444444444444444444444444', createdAt: '2026-09-17T00:03:00.000Z' },
    payload: {
      sessionSlug: 'session-a',
      sessionId,
      questionId: 'q2',
      answer: { value: 'secret', encrypted: false, hash: '', encryptedKey: { wrapped: 'key' } },
    },
  });

  const source = await loadWorkerCanonicalResultsAnalysisSource({ env, slug: 'session-a', config });
  assert.equal(source.ok, true);
  assert.equal(source.counts.responseCount, 2);
  assert.equal(source.counts.excludedCount, 2);
  assert.equal(source.counts.lockedCount, 2);
  assert.deepEqual(
    source.snapshot.responses.map((response) => response.answer).sort(),
    ['plain public answer', 'plain public answer'],
  );
  assert.equal(source.snapshot.responses.some((response) => response.additional === 'plain public comment'), true);
});

test('worker-canonical queued responses apply ACL, encryption, and trusted metadata ordering before generation', async () => {
  const kv = createKv();
  const env = { CE_STORAGE_INDEX_KV: kv };
  await putPayload({
    kv,
    resource: 'questions',
    id: 'qmeta1',
    payload: { sessionSlug: 'session-a', sessionId, questionId: 'q1', prompt: 'Question?', type: 'text' },
  });
  const committedResponses = [
    {
      metadata: { id: 'old', responder: '0x1111111111111111111111111111111111111111', createdAt: '2026-09-17T00:00:00.000Z' },
      payload: { sessionSlug: 'session-a', sessionId, questionId: 'q1', answer: 'old', submittedAt: '2099-01-01T00:00:00.000Z' },
    },
    {
      metadata: { id: 'new', responder: '0x1111111111111111111111111111111111111111', createdAt: '2026-09-17T00:01:00.000Z' },
      payload: { sessionSlug: 'session-a', sessionId, questionId: 'q1', answer: 'new' },
    },
    {
      metadata: { id: 'private', responder: '0x2222222222222222222222222222222222222222', createdAt: '2026-09-17T00:02:00.000Z', payloadAccessControl: { gate: 'group_gate', encryption: 'none', groupIds: ['private'] } },
      payload: { sessionSlug: 'session-a', sessionId, questionId: 'q1', answer: 'private' },
    },
    {
      metadata: { id: 'locked-meta', responder: '0x3333333333333333333333333333333333333333', createdAt: '2026-09-17T00:03:00.000Z', payloadEncrypted: true },
      payload: { sessionSlug: 'session-a', sessionId, questionId: 'q1', answer: 'locked' },
    },
    {
      metadata: { id: 'locked-payload', responder: '0x4444444444444444444444444444444444444444', createdAt: '2026-09-17T00:04:00.000Z' },
      payload: { sessionSlug: 'session-a', sessionId, questionId: 'q1', answer: { value: 'secret', ciphertext: 'cipher' }, additional: 'plain fragment' },
    },
  ];
  const source = await loadWorkerCanonicalResultsAnalysisSource({ env, slug: 'session-a', config, committedResponses });
  assert.equal(source.ok, true);
  assert.equal(source.counts.responseCount, 1);
  assert.equal(source.counts.excludedCount, 3);
  assert.equal(source.counts.lockedCount, 2);
  assert.equal(source.snapshot.responses[0].answer, 'new');
  assert.equal(source.snapshot.responses[0].submittedAt, '2026-09-17T00:01:00.000Z');
});

test('AI input prioritizes answered questions before the question cap while watermarking the full snapshot', async () => {
  const questions = Array.from({ length: 81 }, (_, index) => ({
    questionId: `q${String(index + 1).padStart(3, '0')}`,
    prompt: `Question ${index + 1}`,
  }));
  const source = await loadAdminSnapshotResultsAnalysisSource({
    body: {
      source: {
        kind: 'admin-snapshot',
        snapshot: {
          sessionSlug: 'session-a',
          sessionId,
          questions,
          responses: Array.from({ length: 430 }, (_, index) => ({
            questionId: 'q081',
            participantId: `participant-${index + 1}`,
            answer: `answer ${index + 1}`,
          })),
        },
      },
    },
    slug: 'session-a',
    config,
  });
  assert.equal(source.ok, true);
  assert.equal(source.counts.totalQuestionCount, 81);
  assert.equal(source.counts.aiInputQuestionCount, 80);
  assert.equal(source.aiSnapshot.questions.some((question) => question.id === 'q081'), true);
  assert.equal(source.aiSnapshot.responses.length, 420);
  assert.equal(source.aiSnapshot.counts.participants, 420);
  assert.equal(source.counts.aiInputParticipantCount, 420);
  assert.equal(source.participantDigests.length, 430);
});

test('AI input response cap samples round-robin across answered questions and preserves question metadata', async () => {
  const questions = Array.from({ length: 42 }, (_, index) => {
    const questionId = `q${String(index + 1).padStart(3, '0')}`;
    if (index === 2) {
      return {
        questionId,
        prompt: 'Rate implementation confidence.',
        type: 'rating',
        scale: { min: 1, max: 10, minLabel: 'Strongly oppose', maxLabel: 'Strongly support' },
      };
    }
    if (index === 41) {
      return {
        questionId,
        prompt: 'Allocate support.',
        type: 'quadratic',
        options: ['Summarize', 'Moderate', 'Decide'],
        voiceCredits: 25,
      };
    }
    return { questionId, prompt: `Question ${index + 1}`, type: index % 2 ? 'binary' : 'freeform', options: index % 2 ? ['Agree', 'Unsure', 'Disagree'] : [] };
  });
  const responses = questions.flatMap((question) =>
    Array.from({ length: 30 }, (_, index) => ({
      questionId: question.questionId,
      participantId: `participant-${String(index + 1).padStart(2, '0')}`,
      answer: question.type === 'quadratic' ? [2, -1, 0] : question.type === 'rating' ? 7 : `answer ${index + 1} for ${question.questionId}`,
    })));
  const body = {
      source: {
        kind: 'admin-snapshot',
        snapshot: {
          sessionSlug: 'session-a',
          sessionId,
          questions,
          responses,
        },
      },
    };
  const source = await loadAdminSnapshotResultsAnalysisSource({
    body,
    slug: 'session-a',
    config,
  });
  assert.equal(source.ok, true);
  assert.equal(source.counts.responseCount, 1260);
  assert.equal(source.counts.aiInputResponseCount, 420);
  assert.equal(source.counts.aiInputQuestionCount, 42);
  assert.equal(source.counts.aiInputParticipantCount, 30);
  const aiQuestionIds = new Set(source.aiSnapshot.questions.map((question) => question.id));
  assert.equal(aiQuestionIds.size, 42);
  for (const question of questions) assert.equal(aiQuestionIds.has(question.questionId), true);
  assert.equal(new Set(source.aiSnapshot.responses.map((response) => response.participantId)).size, 30);
  const countsByQuestion = source.aiSnapshot.responses.reduce((counts, row) => {
    counts.set(row.questionId, (counts.get(row.questionId) || 0) + 1);
    return counts;
  }, new Map());
  assert.equal(Math.min(...countsByQuestion.values()), 10);
  assert.equal(Math.max(...countsByQuestion.values()), 10);
  assert.deepEqual(
    source.aiSnapshot.questions.find((question) => question.id === 'q003').scale,
    { min: 1, max: 10, minLabel: 'Strongly oppose', maxLabel: 'Strongly support' },
  );
  assert.equal(source.aiSnapshot.questions.find((question) => question.id === 'q042').voiceCredits, 25);
  assert.equal(source.snapshot.questions.find((question) => question.id === 'q042').voiceCredits, 25);

  const shuffledResponses = [...responses].sort((left, right) =>
    `${right.participantId}:${left.questionId}`.localeCompare(`${left.participantId}:${right.questionId}`));
  const shuffledSource = await loadAdminSnapshotResultsAnalysisSource({
    body: {
      source: {
        kind: 'admin-snapshot',
        snapshot: {
          sessionSlug: 'session-a',
          sessionId,
          questions,
          responses: shuffledResponses,
        },
      },
    },
    slug: 'session-a',
    config,
  });
  assert.equal(shuffledSource.ok, true);
  assert.deepEqual(shuffledSource.aiSnapshot.responses, source.aiSnapshot.responses);
});

test('generated artifact preserves client schema and rejects unknown source refs', () => {
  const source = {
    signature: 'sha256:test',
    participants: [{ syntheticId: 'participant_001' }],
    aiSnapshot: { questions: [{ id: 'q1' }], responses: [{ participantId: 'participant_001', questionId: 'q1' }] },
    snapshot: { questions: [{ id: 'q1' }] },
  };
  const artifact = normalizeGeneratedArtifact({
    source,
    sections: ['argumentMap', 'atlas', 'breakdown', 'riskMatrix'],
    generatedAt: '2026-09-17T00:00:00.000Z',
    value: {
      sections: {
        argumentMap: { debates: [{ id: 'd1', title: 'Main debate', claims: [{ label: 'Claim one', participantIds: ['participant_001'], questionIds: ['q1'] }] }] },
        atlas: { nodes: [], edges: [] },
        breakdown: { summary: { overview: 'ok' }, dimensions: [], groups: [] },
        riskMatrix: { categories: [], comments: [], heatmap: {}, scenarioLinks: [] },
      },
    },
  });
  assert.equal(artifact.kind, 'ce_session_results_analysis_artifact');
  assert.equal(artifact.inputSignature, 'sha256:test');
  assert.equal(artifact.sections.argumentMap.available, true);
  assert.throws(() => normalizeGeneratedArtifact({
    source,
    sections: ['argumentMap'],
    generatedAt: '2026-09-17T00:00:00.000Z',
    value: { argumentMap: { debates: [{ title: 'Bad debate', claims: [{ label: 'Bad claim', participantIds: ['participant_999'], questionIds: ['q1'] }] }] } },
  }), /unknown source ids/);
});





test('analysis AI routing accepts object-shaped thinking model config', () => {
  const payload = resolveAnalysisAiPayload({
    config: {
      ai: {
        models: {
          thinking: { provider: 'openai', model: 'gpt-5.6-terra' },
          fast: { provider: 'openai', model: 'gpt-5.6-luna' },
        },
      },
    },
    prompt: 'Analyze the session.',
  });
  assert.equal(payload.provider, 'openai');
  assert.equal(payload.model, 'gpt-5.6-terra');
});



test('results-analysis capability fails closed when AI scope is disabled', () => {
  const capability = resolveResultsAnalysisCapability({ config: { ...config, scopes: { ai: false } } });
  assert.equal(capability.manual.supported, false);
  assert.equal(capability.automatic.supported, false);
  assert.equal(capability.reason, 'ai_scope_disabled');
});

test('viewer eligibility only supports public full results with aggregate exposure', () => {
  const publicFull = {
    ...config,
    sessionModeProfile: {
      ...config.sessionModeProfile,
      results: { visibility: 'public_full_if_storage_public', exposure: { aggregateResultsEnabled: true } },
    },
  };
  assert.deepEqual(evaluateResultsAnalysisViewerEligibility({ config: publicFull }), { ok: true, visibility: 'public_full_if_storage_public' });
  const privateAdmin = {
    ...config,
    sessionModeProfile: {
      ...config.sessionModeProfile,
      results: { visibility: 'private_admin', exposure: { aggregateResultsEnabled: true } },
    },
  };
  assert.equal(evaluateResultsAnalysisViewerEligibility({ config: privateAdmin }).reason, 'private_admin_requires_admin_status');
  const aggregateOff = {
    ...publicFull,
    sessionModeProfile: {
      ...publicFull.sessionModeProfile,
      results: { visibility: 'public_full_if_storage_public', exposure: { aggregateResultsEnabled: false } },
    },
  };
  assert.equal(evaluateResultsAnalysisViewerEligibility({ config: aggregateOff }).reason, 'aggregate_results_disabled');
});



test('published viewer artifact response includes canonical session identity', async () => {
  const result = await readPublishedResultsAnalysisArtifact({
    env: {},
    slug: 'session-a',
    config,
    deps: {
      readCoordinatedResultsAnalysisStatus: async () => ({
        ok: true,
        state: {
          jobState: 'succeeded',
          lastGood: {
            draftId: 'draft-1',
            generatedAt: '2026-09-17T00:00:00.000Z',
            artifact: { kind: 'ce_session_results_analysis_artifact' },
            snapshot: { sessionSlug: 'session-a', sessionId, responses: [] },
            source: { kind: 'worker-canonical' },
            participantWatermark: ['hidden'],
          },
        },
      }),
    },
  });
  assert.equal(result.ok, true);
  assert.equal(result.sessionSlug, 'session-a');
  assert.equal(result.sessionId, sessionId);
  assert.equal(result.snapshot.sessionId, sessionId);
});

test('status body hides coordinator internals while preserving public draft source counts', () => {
  const body = buildResultsAnalysisStatusBody({
    slug: 'session-a',
    config,
    coordinatorState: {
      state: {
        jobState: 'failed',
        active: {
          requestId: 'req-active',
          trigger: 'manual',
          startedAtMs: 123,
          reservationKey: 'secret-reservation',
          sourceSignature: 'secret-source',
          viewSignature: 'secret-view',
          attemptId: 'secret-attempt',
        },
        lastFailure: {
          ok: false,
          error: 'provider failed',
          status: 502,
          requestId: 'req-failed',
          trigger: 'automatic',
          failedAtMs: 456,
          sourceSignature: 'secret-source',
          viewSignature: 'secret-view',
        },
        lastGood: {
          draftId: 'draft-1',
          artifact: { kind: 'ce_session_results_analysis_artifact' },
          snapshot: { responses: [] },
          participantWatermark: ['hidden-participant-digest'],
          participantDigests: ['hidden-participant-digest'],
          source: { kind: 'worker-canonical', participantCount: 3, responseCount: 5, signature: 'sha256:public-input' },
        },
      },
    },
  });
  assert.deepEqual(body.state.active, { requestId: 'req-active', trigger: 'manual', startedAtMs: 123 });
  assert.deepEqual(body.state.lastFailure, { ok: false, error: 'provider failed', status: 502, requestId: 'req-failed', trigger: 'automatic', failedAtMs: 456 });
  assert.equal('participantWatermark' in body.state.lastGood, false);
  assert.equal('participantDigests' in body.state.lastGood, false);
  assert.equal('sourceSignature' in body.state.lastGood, false);
  assert.equal('viewSignature' in body.state.lastGood, false);
  assert.equal(body.sessionId, sessionId);
  assert.equal(body.state.lastGood.source.signature, 'sha256:public-input');
});

test('manual generation enforces resultsAnalysis mode, eligibility, and hides watermarks', async () => {
  const sourceBody = {
    requestId: 'req-1',
    refresh: true,
    source: {
      kind: 'admin-snapshot',
      snapshot: {
        sessionSlug: 'session-a',
        sessionId,
        questions: [{ id: 'q1', prompt: 'Why?' }],
        responses: [
          { questionId: 'q1', participantId: 'alice', answer: 'a' },
          { questionId: 'q1', participantId: 'bob', answer: 'b' },
          { questionId: 'q1', participantId: 'cara', answer: 'c', submittedAt: '2026-09-17T00:01:00.000Z' },
        ],
      },
    },
  };
  const reservations = [];
  const deps = {
    now: () => Date.parse('2026-09-17T00:00:00.000Z'),
    reserveCoordinatedResultsAnalysis: async ({ reservation }) => {
      reservations.push(reservation);
      return { kind: 'execute', attemptId: 'attempt-1' };
    },
    finalizeCoordinatedResultsAnalysis: async () => ({ ok: true }),
    generateAnalysisArtifact: async () => ({ ok: true, value: { breakdown: { summary: { overview: 'ok' } } } }),
  };
  const disabled = await generateResultsAnalysisDraft({
    env: {}, slug: 'session-a', config: { ...config, resultsAnalysis: { ...config.resultsAnalysis, generationMode: 'automatic' } }, body: sourceBody, deps,
  });
  assert.equal(disabled.status, 409);

  const modelConfig = { ...config, ai: { models: { thinking: { provider: 'openai', model: 'gpt-5.6-terra' } } } };
  deps.generateAnalysisArtifact = async () => ({ ok: true, value: { model: 'provider-claimed-model', breakdown: { summary: { overview: 'ok' } } } });
  const result = await generateResultsAnalysisDraft({ env: {}, slug: 'session-a', config: modelConfig, body: sourceBody, deps });
  assert.equal(result.ok, true);
  assert.equal(result.draft.artifact.sections.breakdown.available, true);
  assert.equal(result.draft.artifact.model, 'gpt-5.6-terra');
  assert.equal('participantWatermark' in result.draft, false);
  assert.equal('participantDigests' in result.draft, false);
  assert.equal(reservations[0].requestId, 'req-1');
});




test('automatic-only sessions allow explicit admin retry after a prior failure', async () => {
  const sourceBody = {
    requestId: 'retry-1',
    refresh: true,
    source: {
      kind: 'admin-snapshot',
      snapshot: {
        sessionSlug: 'session-a',
        sessionId,
        questions: [{ id: 'q1', prompt: 'Why?' }],
        responses: [
          { questionId: 'q1', participantId: 'alice', answer: 'a' },
          { questionId: 'q1', participantId: 'bob', answer: 'b' },
          { questionId: 'q1', participantId: 'cara', answer: 'c' },
        ],
      },
    },
  };
  const automaticOnly = { ...config, resultsAnalysis: { ...config.resultsAnalysis, generationMode: 'automatic' } };
  const blocked = await generateResultsAnalysisDraft({
    env: {},
    slug: 'session-a',
    config: automaticOnly,
    body: sourceBody,
    deps: { readCoordinatedResultsAnalysisStatus: async () => ({ ok: true, state: {} }) },
  });
  assert.equal(blocked.status, 409);
  let reserved = false;
  const retry = await generateResultsAnalysisDraft({
    env: {},
    slug: 'session-a',
    config: automaticOnly,
    body: sourceBody,
    deps: {
      now: () => Date.parse('2026-09-17T00:00:00.000Z'),
      readCoordinatedResultsAnalysisStatus: async () => ({ ok: true, state: { lastFailure: { trigger: 'automatic' } } }),
      reserveCoordinatedResultsAnalysis: async () => { reserved = true; return { kind: 'execute', attemptId: 'attempt-retry' }; },
      finalizeCoordinatedResultsAnalysis: async () => ({ ok: true }),
      generateAnalysisArtifact: async () => ({ ok: true, value: { breakdown: { summary: { overview: 'ok' } } } }),
    },
  });
  assert.equal(retry.ok, true);
  assert.equal(reserved, true);
});


test('automatic generation carries queued fresh responses into the provider source before index visibility', async () => {
  const kv = createKv();
  const env = { CE_STORAGE_INDEX_KV: kv };
  await putPayload({
    kv,
    resource: 'questions',
    id: 'qmeta1',
    payload: { sessionSlug: 'session-a', sessionId, questionId: 'q1', prompt: 'Question?', type: 'text' },
  });
  const committedResponses = [
    ['r1', '0x1111111111111111111111111111111111111111', 'a'],
    ['r2', '0x2222222222222222222222222222222222222222', 'b'],
    ['r3', '0x3333333333333333333333333333333333333333', 'c'],
  ].map(([id, responder, answer], index) => ({
    metadata: { id, responder, createdAt: `2026-09-17T00:0${index}:00.000Z` },
    payload: { sessionSlug: 'session-a', sessionId, questionId: 'q1', answer },
  }));
  let providerSource = null;
  const result = await maybeTriggerAutomaticResultsAnalysis({
    env,
    slug: 'session-a',
    config,
    committedResponses,
    requestId: 'auto-fresh',
    deps: {
      now: () => Date.parse('2026-09-17T00:00:00.000Z'),
      readCoordinatedResultsAnalysisStatus: async () => ({ ok: true, state: {} }),
      reserveCoordinatedResultsAnalysis: async () => ({ kind: 'execute', attemptId: 'attempt-fresh' }),
      finalizeCoordinatedResultsAnalysis: async () => ({ ok: true }),
      generateAnalysisArtifact: async ({ source }) => {
        providerSource = source;
        return { ok: true, value: { breakdown: { summary: { overview: 'ok' } } } };
      },
    },
  });
  assert.equal(result.ok, true);
  assert.equal(providerSource.counts.responseCount, 3);
  assert.equal(providerSource.aiSnapshot.responses.length, 3);
});

test('automatic generation pauses after an automatic failure until manual recovery', async () => {
  const kv = createKv();
  const env = { CE_STORAGE_INDEX_KV: kv };
  await putPayload({
    kv,
    resource: 'questions',
    id: 'qmeta1',
    payload: { sessionSlug: 'session-a', sessionId, questionId: 'q1', prompt: 'Question?', type: 'text' },
  });
  for (const [id, responder, answer] of [
    ['r1', '0x1111111111111111111111111111111111111111', 'a'],
    ['r2', '0x2222222222222222222222222222222222222222', 'b'],
    ['r3', '0x3333333333333333333333333333333333333333', 'c'],
  ]) {
    await putPayload({
      kv,
      resource: 'responses',
      id,
      metadata: { responder, createdAt: '2026-09-17T00:00:00.000Z' },
      payload: { sessionSlug: 'session-a', sessionId, questionId: 'q1', answer },
    });
  }
  let generated = false;
  const result = await maybeTriggerAutomaticResultsAnalysis({
    env,
    slug: 'session-a',
    config,
    deps: {
      readCoordinatedResultsAnalysisStatus: async () => ({ ok: true, state: { lastFailure: { trigger: 'automatic' } } }),
      generateAnalysisArtifact: async () => { generated = true; return { ok: true, value: {} }; },
    },
  });
  assert.equal(result.skipped, true);
  assert.equal(result.reason, 'automatic_paused_after_failure');
  assert.equal(generated, false);
});
