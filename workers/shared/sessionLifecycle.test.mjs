import test from 'node:test';
import assert from 'node:assert/strict';

import {
  normalizeSessionEndsAt,
  resolveSessionLifecycle,
} from './sessionLifecycle.mjs';

test('normalizeSessionEndsAt accepts an optional ISO-compatible timestamp', () => {
  assert.deepEqual(normalizeSessionEndsAt(''), { ok: true, value: '' });
  assert.deepEqual(normalizeSessionEndsAt('2030-01-02T03:04:00Z'), {
    ok: true,
    value: '2030-01-02T03:04:00.000Z',
  });
  assert.deepEqual(normalizeSessionEndsAt('not-a-date'), { ok: false, value: '' });
});

test('resolveSessionLifecycle closes at the configured instant', () => {
  assert.equal(
    resolveSessionLifecycle(
      { sessionEndsAt: '2030-01-02T03:04:00Z' },
      { now: () => Date.parse('2030-01-02T03:03:59Z') },
    ).ended,
    false,
  );
  assert.equal(
    resolveSessionLifecycle(
      { sessionEndsAt: '2030-01-02T03:04:00Z' },
      { now: () => Date.parse('2030-01-02T03:04:00Z') },
    ).ended,
    true,
  );
});
