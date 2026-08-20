import assert from 'node:assert/strict';
import test from 'node:test';

import { buildReportSnapshot, compareLongitudinalSnapshots } from '../src/longitudinal.mjs';

const report = ({ scoreA, scoreB, similarity, generatedAt }) => ({
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
      'model-a': { q1: { meanScore: scoreA, counts: {} } },
      'model-b': { q1: { meanScore: scoreB, counts: {} } },
    },
    similarityEdges: [{ source: 'model-a', target: 'model-b', similarity }],
  },
});

test('longitudinal snapshots report stance direction and participant-similarity drift', () => {
  const baseline = buildReportSnapshot(report({
    scoreA: -0.5, scoreB: 0.2, similarity: 0.8, generatedAt: '2026-01-01T00:00:00.000Z',
  }), { label: 'baseline' });
  const current = buildReportSnapshot(report({
    scoreA: 0.5, scoreB: 0.1, similarity: 0.6, generatedAt: '2026-06-01T00:00:00.000Z',
  }), { label: 'current' });
  const comparison = compareLongitudinalSnapshots(baseline, current);

  assert.equal(comparison.commonModels, 2);
  assert.equal(comparison.modelDrift[0].meanAbsoluteShift, 1);
  assert.equal(comparison.modelDrift[0].directionChanges, 1);
  assert.equal(comparison.similarityDrift[0].signedShift, -0.2);
  assert.equal(comparison.summary.totalDirectionChanges, 1);
});

test('longitudinal comparison rejects incompatible benchmark contexts', () => {
  const baseline = buildReportSnapshot(report({
    scoreA: 0, scoreB: 0, similarity: 1, generatedAt: '2026-01-01T00:00:00.000Z',
  }));
  const current = { ...baseline, source: { ...baseline.source, mode: 'persona' } };
  assert.throws(() => compareLongitudinalSnapshots(baseline, current), /mode values do not match/);
});
