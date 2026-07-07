import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ABUSE_COUNTER_TYPES,
  DEFAULT_ABUSE_COUNTER_WINDOW_MS,
  buildAbuseCounterKey,
  readAbuseCounterSummary,
  recordAbuseEvent,
} from './abuseObservability.js';

const createKv = (initial = {}) => {
  const store = new Map(Object.entries(initial));
  const calls = [];
  return {
    calls,
    async get(key) {
      calls.push(['get', key]);
      return store.has(key) ? store.get(key) : null;
    },
    async put(key, value, opts) {
      calls.push(['put', key, value, opts]);
      store.set(key, value);
    },
  };
};

test('recordAbuseEvent stores aggregate window counters without principal data', async () => {
  const kv = createKv();
  const env = { CE_ABUSE_COUNTERS_KV: kv };
  const now = () => Date.parse('2026-07-06T20:15:10.000Z');

  const result = await recordAbuseEvent({
    env,
    type: ABUSE_COUNTER_TYPES.AUTH_FAILURE,
    now,
  });

  assert.equal(result.ok, true);
  const key = buildAbuseCounterKey({
    type: ABUSE_COUNTER_TYPES.AUTH_FAILURE,
    now,
  });
  assert.equal(key, 'abuse:v1:2026-07-06T20:00:00.000Z:auth_failures');
  assert.equal(key.includes('0xabc'), false);
  assert.deepEqual(kv.calls, [
    ['get', key],
    ['put', key, '1', { expirationTtl: 604800 }],
  ]);
});

test('recordAbuseEvent never throws when the counter store fails', async () => {
  const result = await recordAbuseEvent({
    env: {
      CE_ABUSE_COUNTERS_KV: {
        get: async () => {
          throw new Error('kv down');
        },
      },
    },
    type: ABUSE_COUNTER_TYPES.NONCE_REPLAY,
  });

  assert.deepEqual(result, {
    ok: false,
    skipped: false,
    error: 'kv down',
  });
});

test('readAbuseCounterSummary returns counts by recent window', async () => {
  const current = Date.parse('2026-07-06T20:15:10.000Z');
  const prior = current - DEFAULT_ABUSE_COUNTER_WINDOW_MS;
  const env = {
    CE_ABUSE_COUNTERS_KV: createKv({
      [buildAbuseCounterKey({ type: ABUSE_COUNTER_TYPES.AUTH_FAILURE, now: () => current })]: '2',
      [buildAbuseCounterKey({ type: ABUSE_COUNTER_TYPES.NONCE_REPLAY, now: () => current })]: '1',
      [buildAbuseCounterKey({ type: ABUSE_COUNTER_TYPES.RATE_LIMIT_TRIP, now: () => prior })]: '3',
    }),
  };

  assert.deepEqual(
    await readAbuseCounterSummary({
      env,
      now: () => current,
      windows: 2,
    }),
    {
      ok: true,
      windowMs: DEFAULT_ABUSE_COUNTER_WINDOW_MS,
      windows: [
        {
          windowStart: Date.parse('2026-07-06T20:00:00.000Z'),
          window: '2026-07-06T20:00:00.000Z',
          counts: {
            auth_failures: 2,
            nonce_replays: 1,
            rate_limit_trips: 0,
          },
        },
        {
          windowStart: Date.parse('2026-07-06T19:00:00.000Z'),
          window: '2026-07-06T19:00:00.000Z',
          counts: {
            auth_failures: 0,
            nonce_replays: 0,
            rate_limit_trips: 3,
          },
        },
      ],
    }
  );
});
