import assert from 'node:assert/strict';
import test from 'node:test';

import { mergeRunsFiles } from '../src/report-inputs.mjs';
import { buildResultsReport } from '../src/scoring.mjs';
import { validateModelRoster, validateReleaseRunFile, validateRuns } from '../src/schema.mjs';

const question = (id) => ({
  id,
  canonicalPrompt: `${id} should happen.`,
  reversedPrompt: `${id} should not happen.`,
  topic: 'test',
});

const model = (id, provider = 'local') => ({ id, label: id, model: id, provider, traits: {} });

test('question aggregates weight each model participant once regardless of repeat count', () => {
  const questionBank = { benchmarkId: 'bench', runPlan: { repeatsPerPolarity: 1 }, questions: [question('q1')] };
  const modelRoster = { models: [model('model-a'), model('model-b')] };
  const runs = [
    ...Array.from({ length: 10 }, (_, index) => ({
      modelId: 'model-a',
      questionId: 'q1',
      polarity: index % 2 ? 'reversed' : 'canonical',
      normalizedAnswer: 'Agree',
    })),
    { modelId: 'model-b', questionId: 'q1', polarity: 'canonical', normalizedAnswer: 'Disagree' },
    { modelId: 'model-b', questionId: 'q1', polarity: 'reversed', normalizedAnswer: 'Disagree' },
  ];

  const report = buildResultsReport({ questionBank, modelRoster, runsFile: { repeats: 1, runs } });
  const summary = report.polisReport.byQuestion.q1;

  assert.equal(summary.meanScore, 0);
  assert.deepEqual(summary.counts, { Agree: 1, Unsure: 0, Disagree: 1 });
  assert.equal(summary.total, 2);
  assert.equal(summary.runSummary.meanScore, 0.6667);
  assert.equal(report.polisReport.aggregationUnit, 'model-participant');
});

test('distributional similarity distinguishes oscillation from consistent uncertainty', () => {
  const questionBank = {
    benchmarkId: 'bench',
    runPlan: { repeatsPerPolarity: 10 },
    questions: [question('q1'), question('q2')],
  };
  const modelRoster = { models: [model('model-a'), model('model-b')] };
  const runs = [];
  for (let index = 0; index < 10; index += 1) {
    for (const polarity of ['canonical', 'reversed']) {
      runs.push({ modelId: 'model-a', questionId: 'q1', polarity, normalizedAnswer: index < 5 ? 'Agree' : 'Disagree' });
      runs.push({ modelId: 'model-b', questionId: 'q1', polarity, normalizedAnswer: 'Unsure' });
      runs.push({ modelId: 'model-a', questionId: 'q2', polarity, normalizedAnswer: 'Agree' });
      runs.push({ modelId: 'model-b', questionId: 'q2', polarity, normalizedAnswer: 'Agree' });
    }
  }

  const report = buildResultsReport({ questionBank, modelRoster, runsFile: { repeats: 10, runs } });

  assert.equal(report.polisReport.byModelQuestion['model-a'].q1.meanScore, 0);
  assert.equal(report.polisReport.byModelQuestion['model-b'].q1.meanScore, 0);
  assert.equal(report.polisReport.similarityMatrix['model-a']['model-b'], 0.5);
  const similarity = report.polisReport.similarityDetails['model-a']['model-b'];
  assert.equal(similarity.similarity, 0.5);
  assert.equal(similarity.questionsCompared, 2);
  assert.equal(similarity.requiredQuestions, 1);
  assert.equal(similarity.overlapRate, 1);
  assert.equal(similarity.sufficientOverlap, true);
  assert.deepEqual(similarity.similarityInterval, {
    low: 0,
    high: 1,
    confidenceLevel: 0.95,
    iterations: 1000,
    method: 'deterministic-percentile-bootstrap',
  });
});

test('report exposes deterministic uncertainty and canonical-versus-reversed sensitivity', () => {
  const questionBank = {
    benchmarkId: 'bench',
    runPlan: { repeatsPerPolarity: 2 },
    questions: [question('q1')],
  };
  const modelRoster = { models: [model('model-a')] };
  const runs = [
    { modelId: 'model-a', questionId: 'q1', polarity: 'canonical', normalizedAnswer: 'Agree' },
    { modelId: 'model-a', questionId: 'q1', polarity: 'canonical', normalizedAnswer: 'Agree' },
    { modelId: 'model-a', questionId: 'q1', polarity: 'reversed', normalizedAnswer: 'Disagree' },
    { modelId: 'model-a', questionId: 'q1', polarity: 'reversed', normalizedAnswer: 'Disagree' },
  ];

  const first = buildResultsReport({ questionBank, modelRoster, runsFile: { repeats: 2, runs } });
  const second = buildResultsReport({ questionBank, modelRoster, runsFile: { repeats: 2, runs } });
  const cell = first.polisReport.byModelQuestion['model-a'].q1;

  assert.deepEqual(cell.meanScoreInterval, second.polisReport.byModelQuestion['model-a'].q1.meanScoreInterval);
  assert.deepEqual(cell.polarity.wordingSensitivity, {
    paired: true,
    meanAbsoluteShift: 2,
    signedShift: -2,
    level: 'high',
  });
  assert.deepEqual(first.polisReport.byModel['model-a'].wordingSensitivity, {
    pairedUnits: 1,
    totalUnits: 1,
    meanAbsoluteShift: 2,
    meanSignedShift: -2,
    highSensitivityRate: 1,
    moderateOrHighRate: 1,
  });
  assert.equal(first.statistics.bootstrapIterations, 1000);
});

test('release eligibility rejects fixture and incomplete participants', () => {
  const questionBank = {
    benchmarkId: 'bench',
    releaseStatus: 'validated',
    runPlan: { repeatsPerPolarity: 1 },
    questions: [question('q1'), question('q2')],
  };
  const modelRoster = { models: [model('real-model'), model('stub-model', 'mock')] };
  const runs = [
    { modelId: 'real-model', questionId: 'q1', polarity: 'canonical', normalizedAnswer: 'Agree' },
    { modelId: 'real-model', questionId: 'q1', polarity: 'reversed', normalizedAnswer: 'Agree' },
  ];

  const report = buildResultsReport({ questionBank, modelRoster, runsFile: { repeats: 1, runs } });

  assert.equal(report.status, 'preview');
  assert.equal(report.integrity.releaseReady, false);
  assert.equal(report.integrity.coverageByModel['real-model'].coverageRate, 0.5);
  assert.equal(report.integrity.coverageByModel['stub-model'].fixtureProvider, true);
  assert.equal(report.participantGraph.nodes.find((entry) => entry.id === 'real-model').coverage.eligibleForSimilarity, true);
});

test('release eligibility enforces bank repeats and detects provider overrides', () => {
  const questionBank = {
    benchmarkId: 'bench',
    runPlan: { repeatsPerPolarity: 10 },
    questions: [question('q1')],
  };
  const modelRoster = { models: [model('model-a'), model('model-b')] };
  const oneRepeatRuns = modelRoster.models.flatMap((entry) => ['canonical', 'reversed'].map((polarity) => ({
    modelId: entry.id,
    questionId: 'q1',
    polarity,
    repeatIndex: 1,
    normalizedAnswer: 'Agree',
    provider: entry.id === 'model-a' ? 'mock' : 'local',
  })));
  const report = buildResultsReport({ questionBank, modelRoster, runsFile: { repeats: 1, runs: oneRepeatRuns } });

  assert.equal(report.integrity.expectedRepeatsPerPolarity, 10);
  assert.equal(report.integrity.repeatConfigurationValid, false);
  assert.equal(report.integrity.coverageByModel['model-a'].fixtureProvider, true);
  assert.equal(report.integrity.coverageByModel['model-b'].completionRate, 0);
  assert.equal(report.integrity.releaseReady, false);
});

test('complete non-fixture participants can satisfy the release gate', () => {
  const questionBank = {
    benchmarkId: 'bench',
    releaseStatus: 'validated',
    runPlan: { repeatsPerPolarity: 1 },
    questions: [question('q1')],
  };
  const modelRoster = { models: [model('model-a'), model('model-b')] };
  const runs = modelRoster.models.flatMap((entry) => ['canonical', 'reversed'].map((polarity) => ({
    runId: `${entry.id}:${polarity}`,
    modelId: entry.id,
    questionId: 'q1',
    polarity,
    repeatIndex: 1,
    normalizedAnswer: 'Agree',
    provider: 'local',
  })));
  const report = buildResultsReport({ questionBank, modelRoster, runsFile: { repeats: 1, runs } });

  assert.equal(report.integrity.repeatConfigurationValid, true);
  assert.equal(report.integrity.releaseReady, true);
  assert.equal(report.status, 'release-ready');
});

test('run merging rejects incompatible benchmark families, modes, and personas', () => {
  const runFile = (benchmarkId, mode = 'self', personaId = null) => ({ benchmarkId, mode, personaId, runs: [] });
  assert.throws(() => mergeRunsFiles([runFile('bench-a'), runFile('bench-b')]), /incompatible benchmark families/);
  assert.throws(() => mergeRunsFiles([runFile('bench', 'self'), runFile('bench', 'persona', 'ada')]), /mix benchmark modes/);
  assert.throws(() => mergeRunsFiles([runFile('bench', 'persona', 'ada'), runFile('bench', 'persona', 'norbert')]), /mix persona targets/);

  const merged = mergeRunsFiles([runFile('bench'), runFile('bench-first-5')]);
  assert.equal(merged.benchmarkId, 'bench');
  assert.deepEqual(merged.sourceBenchmarkIds, ['bench', 'bench-first-5']);
});

test('contextual run validation catches duplicate coordinates and foreign references', () => {
  const errors = validateRuns({
    runs: [
      { runId: 'same', modelId: 'model-a', questionId: 'q1', polarity: 'canonical', repeatIndex: 1, normalizedAnswer: 'Agree' },
      { runId: 'same', modelId: 'model-a', questionId: 'q1', polarity: 'canonical', repeatIndex: 1, normalizedAnswer: 'Agree' },
      { runId: 'foreign', modelId: 'model-a', questionId: 'missing', polarity: 'canonical', repeatIndex: 2, normalizedAnswer: 'Agree' },
    ],
  }, {
    modelIds: new Set(['model-a']),
    questionIds: new Set(['q1']),
    requireRunIds: true,
    requireRepeatIndex: true,
    maxRepeatIndex: 1,
  });

  assert.ok(errors.some((error) => error.includes('runId duplicates same')));
  assert.ok(errors.some((error) => error.includes('unknown question missing')));
  assert.ok(errors.some((error) => error.includes('duplicates run coordinate')));
  assert.ok(errors.some((error) => error.includes('repeatIndex must not exceed 1')));
});

test('release run validation requires repeat coordinates and model generation settings are bounded', () => {
  const runErrors = validateRuns({
    runs: [{ runId: 'run', modelId: 'model-a', questionId: 'q1', polarity: 'canonical', normalizedAnswer: 'Agree' }],
  }, { requireRunIds: true, requireRepeatIndex: true, maxRepeatIndex: 10 });
  assert.ok(runErrors.some((error) => error.includes('repeatIndex is required')));

  const rosterErrors = validateModelRoster({
    models: [{
      id: 'model-a', label: 'Model A', model: 'model-a', provider: 'local', traits: {},
      temperature: 3, maxTokens: 0, timeoutMs: -1,
    }],
  });
  assert.ok(rosterErrors.some((error) => error.includes('temperature')));
  assert.ok(rosterErrors.some((error) => error.includes('maxTokens')));
  assert.ok(rosterErrors.some((error) => error.includes('timeoutMs')));
});

test('release provenance rejects missing, incomplete, or mismatched manifests', () => {
  assert.deepEqual(validateReleaseRunFile({ runs: [] }, { questionBankHash: 'a'.repeat(64), requiredRepeats: 10 }), [
    'manifest must be an object for release',
  ]);

  const errors = validateReleaseRunFile({
    manifest: {
      kind: 'ai_discourse_bench_run_manifest',
      harnessVersion: '0.2.0',
      questionBankHash: 'b'.repeat(64),
      modelRosterHash: 'c'.repeat(64),
      promptTemplateVersion: 'v1',
      promptTemplateHash: 'd'.repeat(64),
      scheduleSeed: 'seed',
      repeats: 1,
      expectedRuns: 2,
      completedRuns: 1,
    },
    runs: [],
  }, { questionBankHash: 'a'.repeat(64), requiredRepeats: 10 });

  assert.ok(errors.some((error) => error.includes('questionBankHash does not match')));
  assert.ok(errors.some((error) => error.includes('repeats must equal')));
  assert.ok(errors.some((error) => error.includes('completedRuns must equal')));
  assert.ok(errors.some((error) => error.includes('run count must equal')));
});

test('release provenance binds provider and model identity to the manifest', () => {
  const manifest = {
    kind: 'ai_discourse_bench_run_manifest',
    harnessVersion: '0.2.0',
    harnessCommit: 'a'.repeat(40),
    questionBankHash: 'b'.repeat(64),
    modelRosterHash: 'c'.repeat(64),
    promptTemplateVersion: 'v1',
    promptTemplateHash: 'd'.repeat(64),
    scheduleSeed: 'seed',
    repeats: 1,
    expectedRuns: 2,
    completedRuns: 2,
    models: [{ id: 'model-a', model: 'provider/model-a', provider: 'local' }],
  };
  const runs = ['canonical', 'reversed'].map((polarity) => ({
    modelId: 'model-a', model: 'provider/model-a', provider: 'local', polarity,
  }));
  const options = { questionBankHash: 'b'.repeat(64), requiredRepeats: 1, questionCount: 1 };

  assert.deepEqual(validateReleaseRunFile({ manifest, runs }, options), []);
  const errors = validateReleaseRunFile({
    manifest,
    runs: [{ ...runs[0], provider: 'mock' }, runs[1]],
  }, options);
  assert.ok(errors.some((error) => error.includes('provider does not match manifest.models')));

  const routedManifest = {
    ...manifest,
    models: [{
      ...manifest.models[0],
      temperature: 0.2,
      maxTokens: 220,
      structuredOutput: 'json_schema',
      providerRouting: { allow_fallbacks: false },
      provenance: { modelRevision: 'revision-a' },
    }],
  };
  const routedRuns = runs.map((run) => ({
    ...run,
    generation: {
      temperature: 0.2,
      maxTokens: 220,
      timeoutMs: null,
      structuredOutput: 'json_schema',
      providerRouting: { allow_fallbacks: true },
    },
    modelProvenance: { modelRevision: 'revision-b' },
  }));
  const routedErrors = validateReleaseRunFile({ manifest: routedManifest, runs: routedRuns }, options);
  assert.ok(routedErrors.some((error) => error.includes('generation does not match manifest.models')));
  assert.ok(routedErrors.some((error) => error.includes('modelProvenance does not match manifest.models')));
});

test('release provenance binds manifest models to the selected report roster', () => {
  const selectedModel = {
    id: 'model-a', label: 'Model A', model: 'provider/model-a', provider: 'local', traits: {},
    temperature: 0.3, maxTokens: 300, timeoutMs: 90000,
  };
  const manifest = {
    kind: 'ai_discourse_bench_run_manifest',
    harnessVersion: '0.2.0',
    harnessCommit: 'a'.repeat(40),
    questionBankHash: 'b'.repeat(64),
    modelRosterHash: 'c'.repeat(64),
    promptTemplateVersion: 'v1',
    promptTemplateHash: 'd'.repeat(64),
    scheduleSeed: 'seed',
    repeats: 1,
    expectedRuns: 2,
    completedRuns: 2,
    models: [{
      id: 'model-a', model: 'provider/model-a', provider: 'local',
      temperature: 0.3, maxTokens: 300, timeoutMs: 90000,
      traits: {}, provenance: {}, pricing: null,
    }],
  };
  const runs = ['canonical', 'reversed'].map((polarity) => ({
    modelId: 'model-a', model: 'provider/model-a', provider: 'local', polarity,
  }));
  const options = {
    questionBankHash: 'b'.repeat(64),
    requiredRepeats: 1,
    questionCount: 1,
    selectedModelsById: new Map([[selectedModel.id, selectedModel]]),
  };

  assert.deepEqual(validateReleaseRunFile({ manifest, runs }, options), []);
  const relabeledRoster = new Map([['model-a', { ...selectedModel, model: 'provider/different-model' }]]);
  const errors = validateReleaseRunFile({ manifest, runs }, { ...options, selectedModelsById: relabeledRoster });
  assert.ok(errors.some((error) => error.includes('model does not match the selected model roster')));

  const changedGenerationRoster = new Map([['model-a', { ...selectedModel, temperature: 0.8 }]]);
  const generationErrors = validateReleaseRunFile({
    manifest,
    runs,
  }, { ...options, selectedModelsById: changedGenerationRoster });
  assert.ok(generationErrors.some((error) => error.includes('generation settings do not match')));

  const changedTraitsRoster = new Map([['model-a', { ...selectedModel, traits: { ossStatus: 'closed' } }]]);
  const traitErrors = validateReleaseRunFile({ manifest, runs }, {
    ...options,
    selectedModelsById: changedTraitsRoster,
  });
  assert.ok(traitErrors.some((error) => error.includes('traits does not match')));
});

test('strict run provenance ties run ids to their coordinates', () => {
  const errors = validateRuns({
    runs: [{
      benchmarkId: 'bench',
      runId: 'forged',
      mode: 'self',
      personaId: null,
      modelId: 'model-a',
      questionId: 'q1',
      polarity: 'canonical',
      repeatIndex: 1,
      provider: 'local',
      promptHash: 'a'.repeat(64),
      generation: { temperature: 0.2, maxTokens: 220, timeoutMs: null },
      normalizedAnswer: 'Agree',
    }],
  }, {
    benchmarkId: 'bench',
    mode: 'self',
    personaId: null,
    requireRunIds: true,
    requireRepeatIndex: true,
    requireProvenance: true,
  });
  assert.ok(errors.some((error) => error.includes('runId does not match its run coordinates')));
});

test('ordinary preview validation does not impose a release repeat ceiling', () => {
  const errors = validateRuns({
    runs: [{ modelId: 'model-a', questionId: 'q1', polarity: 'canonical', repeatIndex: 1, normalizedAnswer: 'Agree' }],
  });
  assert.deepEqual(errors, []);
});
