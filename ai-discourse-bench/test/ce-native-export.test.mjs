import assert from 'node:assert/strict';
import test from 'node:test';

import { buildContextEngineBenchmarkDataset } from '../src/ce-native-export.mjs';

test('native Context Engine export preserves response distributions and uncertainty', () => {
  const summary = {
    counts: { Agree: 6, Unsure: 2, Disagree: 2 },
    valid: 10,
    total: 10,
    meanScore: 0.4,
    meanScoreInterval: { low: 0, high: 0.8, confidenceLevel: 0.95 },
    polarity: { wordingSensitivity: { meanAbsoluteShift: 0.2, level: 'low' } },
  };
  const report = {
    benchmarkId: 'bench',
    generatedAt: '2026-01-01T00:00:00.000Z',
    questions: [{ id: 'q1', prompt: 'Question one' }],
    participants: [{
      id: 'model-a', label: 'Model A', model: 'provider/model-a', provider: 'local',
      traits: { ossStatus: 'open-weights' }, provenance: { modelRevision: 'rev-1' },
      runtimeProvenance: { resolvedModels: ['model-a'] }, summary,
    }],
    polisReport: {
      aggregationUnit: 'model-participant',
      byModelQuestion: { 'model-a': { q1: summary } },
      byQuestion: { q1: summary },
      similarityMatrix: { 'model-a': { 'model-a': 1 } },
      similarityDetails: {},
      similarityEdges: [],
    },
    integrity: { releaseReady: false },
    importance: { available: true, byQuestion: { q1: { meanVotes: 3 } } },
    debateAtlas: { sizeMetric: 'quadratic-importance' },
  };

  const dataset = buildContextEngineBenchmarkDataset(report);
  assert.equal(dataset.kind, 'ce_benchmark_results_dataset');
  assert.equal(dataset.responses.length, 1);
  assert.deepEqual(dataset.responses[0].summary, summary);
  assert.deepEqual(dataset.participants[0].provenance, { modelRevision: 'rev-1' });
  assert.equal(dataset.importance.byQuestion.q1.meanVotes, 3);
  assert.equal(dataset.debateAtlas.sizeMetric, 'quadratic-importance');
  assert.match(dataset.note, /not discretized/);
});
