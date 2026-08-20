import assert from 'node:assert/strict';
import test from 'node:test';

import { clusterBySimilarity } from '../src/opinion-groups.mjs';

const matrix = {
  a: { a: 1, b: 0.95, c: 0.1, d: 0.1 },
  b: { a: 0.95, b: 1, c: 0.1, d: 0.1 },
  c: { a: 0.1, b: 0.1, c: 1, d: 0.9 },
  d: { a: 0.1, b: 0.1, c: 0.9, d: 1 },
};

test('deterministic K-medoids separates strong similarity cohorts', () => {
  const first = clusterBySimilarity({ participantIds: ['d', 'b', 'a', 'c'], similarityMatrix: matrix, count: 2 });
  const second = clusterBySimilarity({ participantIds: ['a', 'b', 'c', 'd'], similarityMatrix: matrix, count: 2 });

  assert.deepEqual(first, second);
  assert.equal(first.method, 'deterministic-k-medoids');
  assert.equal(first.count, 2);
  assert.equal(first.assignments.a, first.assignments.b);
  assert.equal(first.assignments.c, first.assignments.d);
  assert.notEqual(first.assignments.a, first.assignments.c);
});

test('manual group count is bounded and every participant remains assigned', () => {
  const result = clusterBySimilarity({ participantIds: ['a', 'b', 'c'], similarityMatrix: matrix, count: 99 });

  assert.equal(result.count, 3);
  assert.equal(new Set(Object.values(result.assignments)).size, 3);
  assert.deepEqual(Object.keys(result.assignments).sort(), ['a', 'b', 'c']);
});

test('missing similarities remain deterministic instead of producing unassigned models', () => {
  const result = clusterBySimilarity({ participantIds: ['c', 'a', 'b'], similarityMatrix: {}, count: 2 });

  assert.equal(result.count, 2);
  assert.deepEqual(Object.keys(result.assignments).sort(), ['a', 'b', 'c']);
  assert.ok(Object.values(result.assignments).every((group) => group === 0 || group === 1));
});
