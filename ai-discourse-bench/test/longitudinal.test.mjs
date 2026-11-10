import assert from 'node:assert/strict';
import test from 'node:test';

import { buildReportSnapshot, compareLongitudinalSnapshots } from '../src/longitudinal.mjs';

const rawMaterial = { runManifest: { mode: 'self', personaId: null, promptTemplateVersion: 'fixture-v1', promptTemplateHash: 'a'.repeat(64) } };

const report = ({ scoreA, scoreB, similarity, generatedAt }) => ({
  rawMaterial,
  benchmarkId: 'bench',
  generatedAt,
  mode: 'self',
  personaId: null,
  questions: [{ id: 'q1', prompt: 'Question one', topic: 'topic' }],
  participants: [
    { id: 'model-a', label: 'Model A', model: 'model-a', provider: 'local', summary: { meanScore: scoreA } },
    { id: 'model-b', label: 'Model B', model: 'model-b', provider: 'local', summary: { meanScore: scoreB } },
  ],
  polisReport: {
    byModelQuestion: {
      'model-a': { q1: { meanScore: scoreA, counts: { Agree: 1 + scoreA, Disagree: 1 - scoreA } } },
      'model-b': { q1: { meanScore: scoreB, counts: { Agree: 1 + scoreB, Disagree: 1 - scoreB } } },
    },
    similarityEdges: [{ source: 'model-a', target: 'model-b', similarity }],
  },
});

test('longitudinal snapshots report stance direction and participant-similarity drift', () => {
  const baseline = buildReportSnapshot(report({
    scoreA: -1, scoreB: -1, similarity: 1, generatedAt: '2026-01-01T00:00:00.000Z',
  }), { label: 'baseline' });
  const current = buildReportSnapshot(report({
    scoreA: 1, scoreB: -1, similarity: 0, generatedAt: '2026-06-01T00:00:00.000Z',
  }), { label: 'current' });
  const comparison = compareLongitudinalSnapshots(baseline, current);

  assert.equal(comparison.commonModels, 2);
  assert.equal(comparison.modelDrift[0].meanAbsoluteShift, 2);
  assert.equal(comparison.modelDrift[0].directionChanges, 1);
  assert.equal(comparison.similarityDrift[0].signedShift, -1);
  assert.equal(comparison.summary.totalDirectionChanges, 1);
});

test('longitudinal comparison rejects incompatible benchmark contexts', () => {
  const baseline = buildReportSnapshot(report({
    scoreA: 0, scoreB: 0, similarity: 1, generatedAt: '2026-01-01T00:00:00.000Z',
  }));
  const current = { ...baseline, source: { ...baseline.source, mode: 'persona' } };
  assert.throws(() => compareLongitudinalSnapshots(baseline, current), /mode values do not match/);
});

const snapshotWithAnswers = (answers, questionIds, similarity) => buildReportSnapshot({
  rawMaterial,
  benchmarkId: 'common-question-set', mode: 'self',
  questions: questionIds.map((id) => ({ id, prompt: id })),
  participants: ['a', 'b'].map((id) => ({ id, model: id, provider: 'local' })),
  polisReport: {
    byModelQuestion: Object.fromEntries(Object.entries(answers).map(([model, rows]) => [model,
      Object.fromEntries(Object.entries(rows).map(([id, answer]) => [id, answer ? {
        meanScore: answer === 'Agree' ? 1 : -1, counts: { [answer]: 1 },
      } : { meanScore: null, counts: {} }])),
    ])),
    similarityEdges: [{ source: 'a', target: 'b', similarity }],
  },
});

test('adding a disagreeing question outside the common set produces no similarity drift', () => {
  const baseline = snapshotWithAnswers({ a: { q1: 'Agree', q2: 'Agree' }, b: { q1: 'Agree', q2: 'Agree' } },
    ['q1', 'q2'], 1);
  const current = snapshotWithAnswers({ a: { q1: 'Agree', q2: 'Agree', q3: 'Agree' },
    b: { q1: 'Agree', q2: 'Agree', q3: 'Disagree' } }, ['q1', 'q2', 'q3'], 0.6667);
  const pair = compareLongitudinalSnapshots(baseline, current).similarityDrift[0];
  assert.deepEqual(pair.questionIds, ['q1', 'q2']);
  assert.equal(pair.questionsCompared, 2);
  assert.equal(pair.baselineSimilarity, 1);
  assert.equal(pair.currentSimilarity, 1);
  assert.equal(pair.signedShift, 0);
});

test('a newly available observation is excluded from both sides of similarity drift', () => {
  const baseline = snapshotWithAnswers({ a: { q1: 'Agree', q2: 'Agree', q3: null },
    b: { q1: 'Agree', q2: 'Agree', q3: 'Disagree' } }, ['q1', 'q2', 'q3'], 1);
  const current = snapshotWithAnswers({ a: { q1: 'Agree', q2: 'Agree', q3: 'Agree' },
    b: { q1: 'Agree', q2: 'Agree', q3: 'Disagree' } }, ['q1', 'q2', 'q3'], 0.6667);
  const pair = compareLongitudinalSnapshots(baseline, current).similarityDrift[0];
  assert.deepEqual(pair.questionIds, ['q1', 'q2']);
  assert.equal(pair.signedShift, 0);
});

test('a changed common distribution produces drift even when stored edge values agree', () => {
  const baseline = snapshotWithAnswers({ a: { q1: 'Agree', q2: 'Agree' }, b: { q1: 'Agree', q2: 'Agree' } },
    ['q1', 'q2'], 1);
  const current = snapshotWithAnswers({ a: { q1: 'Agree', q2: 'Agree' }, b: { q1: 'Disagree', q2: 'Agree' } },
    ['q1', 'q2'], 1);
  const pair = compareLongitudinalSnapshots(baseline, current).similarityDrift[0];
  assert.deepEqual(pair.questionIds, ['q1', 'q2']);
  assert.equal(pair.currentSimilarity, 0.5);
  assert.equal(pair.signedShift, -0.5);
});

test('less than half the common questions makes a pair unavailable and does not dilute the summary', () => {
  const baseline = snapshotWithAnswers({ a: { q1: 'Agree' }, b: { q1: 'Agree' } },
    ['q1', 'q2', 'q3'], 1);
  const current = snapshotWithAnswers({ a: { q1: 'Agree' }, b: { q1: 'Disagree' } },
    ['q1', 'q2', 'q3'], 0);
  const comparison = compareLongitudinalSnapshots(baseline, current);
  const pair = comparison.similarityDrift[0];
  assert.deepEqual(pair.questionIds, ['q1']);
  assert.equal(pair.questionsCompared, 1);
  assert.equal(pair.requiredQuestions, 2);
  assert.equal(pair.sufficientOverlap, false);
  assert.equal(pair.baselineSimilarity, null);
  assert.equal(pair.currentSimilarity, null);
  assert.equal(pair.signedShift, null);
  assert.equal(comparison.summary.meanSimilarityAbsoluteShift, null);
});

test('run-to-snapshot comparison binds the persona label and template that produced the answers', async () => {
  const fs = await import('node:fs/promises');
  const os = await import('node:os');
  const path = await import('node:path');
  const { execFileSync, spawnSync } = await import('node:child_process');
  const { fileURLToPath } = await import('node:url');
  const { runBenchmark } = await import('../src/runner.mjs');
  const cli = fileURLToPath(new URL('../bin/ai-discourse-bench.mjs', import.meta.url));
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'aidb-persona-context-'));
  try {
    const sample = JSON.parse(await fs.readFile(new URL('../data/question-bank.sample.json', import.meta.url), 'utf8'));
    const bank = { ...sample, runPlan: { ...sample.runPlan, repeatsPerPolarity: 1 }, questions: sample.questions.slice(0, 1) };
    const models = { models: [{ id: 'fixture', label: 'Fixture model', model: 'fixture', provider: 'mock', traits: {} }] };
    const invoke = (...args) => execFileSync(process.execPath, [cli, ...args], { cwd: root, stdio: 'pipe' });
    const json = async (name) => JSON.parse(await fs.readFile(path.join(root, name), 'utf8'));
    const write = (name, value) => fs.writeFile(path.join(root, name), JSON.stringify(value));
    await write('bank.json', bank);
    await write('models.json', models);
    for (const [name, id, label] of [
      ['first', 'figure', 'Fixture figure A'], ['same', 'figure', 'Fixture figure A'],
      ['changed-label', 'figure', 'Fixture figure B'], ['changed-id', 'another', 'Fixture figure A'],
    ]) {
      const persona = { id, label, publicFigure: true, profileType: 'public-figure-weights-only', evaluationClaim: 'model-interpretation-not-ground-truth' };
      const runs = await runBenchmark({ questionBank: bank, modelRoster: models, personasFile: { personas: [persona] },
        mode: 'persona', personaId: id, repeats: 1, maxAttempts: 1, concurrency: 1 });
      await write(name + '-runs.json', runs);
      invoke('build-report', '--questions', 'bank.json', '--models', 'models.json', '--runs', name + '-runs.json', '--out', name + '-report.json');
      invoke('snapshot-report', '--report', name + '-report.json', '--out', name + '.json');
    }
    invoke('compare-snapshots', '--baseline', 'first.json', '--current', 'same.json', '--out', 'comparison.json');
    assert.equal((await json('comparison.json')).summary.meanModelAbsoluteShift, 0);
    for (const [name, message] of [['changed-label', /experiment context/i], ['changed-id', /personaId/i]]) {
      const result = spawnSync(process.execPath, [cli, 'compare-snapshots', '--baseline', 'first.json', '--current', name + '.json', '--out', name + '-comparison.json'], { cwd: root, encoding: 'utf8' });
      assert.notEqual(result.status, 0, name);
      assert.match(result.stderr, message);
    }
    const baseline = await json('first.json');
    assert.match(baseline.source.experimentContextFingerprint, /^[a-f0-9]{64}$/);
    assert.equal(baseline.source.experimentContext.persona.label, 'Fixture figure A');
    assert.deepEqual((await json('comparison.json')).experimentContext, baseline.source.experimentContext);
    const missing = structuredClone(baseline);
    delete missing.source.experimentContextFingerprint;
    assert.throws(() => compareLongitudinalSnapshots(missing, baseline), /rebuild.*snapshot/i);
    const changedTemplate = structuredClone(baseline);
    changedTemplate.source.experimentContext.promptTemplate.hash = 'changed';
    assert.throws(() => compareLongitudinalSnapshots(baseline, changedTemplate), /experiment context/i);
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});
