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

test('missing similarities withhold manual grouping, including connected incomplete graphs', () => {
  for (const similarityMatrix of [{}, { a: { b: 1, c: null }, b: { a: 1, c: 1 }, c: { a: null, b: 1 } }]) {
    const result = clusterBySimilarity({ participantIds: ['c', 'a', 'b'], similarityMatrix, count: 2 });
    assert.equal(result.count, 0);
    assert.equal(result.status, 'unavailable');
    assert.equal(result.reason, 'incomplete-pairwise-similarity');
    assert.deepEqual(result.assignments, {});
  }
});

test('measured zero similarity remains a valid distance rather than missing overlap', () => {
  const result = clusterBySimilarity({
    participantIds: ['a', 'b'],
    similarityMatrix: { a: { b: 0 }, b: { a: 0 } },
    count: 2,
  });
  assert.equal(result.count, 2);
  assert.notEqual(result.assignments.a, result.assignments.b);
});
