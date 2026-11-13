import test from 'node:test';
import assert from 'node:assert/strict';

import { markRetryableBusy } from './retryableBusy.js';
import {
  COORDINATOR_RETRY_DELAYS_MS, SESSION_COORDINATOR_UNAVAILABLE, coordinatorBusyBody, coordinatorRetryDelayMs, isRetryableBusy,
} from '../../shared/sessionCoordinatorBusy.mjs';

const reply = (body, status = 503, headers = { 'Content-Type': 'application/json', 'X-Kept': 'yes' }) =>
  new Response(typeof body === 'string' ? body : JSON.stringify(body), { status, headers });
const bodyOf = async (response) => response.clone().json().catch(async () => response.clone().text());

test('a busy answer is marked safe to send again, its reason and headers kept', async () => {
  const marked = await markRetryableBusy(reply({ error: SESSION_COORDINATOR_UNAVAILABLE, reason: 'rate_limit_unavailable' }));
  assert.equal(marked.status, 503);
  assert.deepEqual(await marked.json(), { error: SESSION_COORDINATOR_UNAVAILABLE, reason: 'rate_limit_unavailable', retryable: true });
  assert.equal(marked.headers.get('X-Kept'), 'yes');
  // A reply passed on from the coordinator may carry its own length, which no longer fits.
  const proxied = await markRetryableBusy(reply({ error: SESSION_COORDINATOR_UNAVAILABLE }, 503, { 'Content-Type': 'application/json', 'Content-Length': '62' }));
  assert.equal(proxied.headers.get('Content-Length'), null);
});

test('anything else goes out as it came', async () => {
  for (const [body, status, headers] of [
    [{ error: SESSION_COORDINATOR_UNAVAILABLE, retryable: false }],
    [{ error: 'The session’s AI isn’t set up.' }],
    [{ error: SESSION_COORDINATOR_UNAVAILABLE }, 429],
    [{ error: SESSION_COORDINATOR_UNAVAILABLE }, 200],
    [SESSION_COORDINATOR_UNAVAILABLE, 503, { 'Content-Type': 'text/plain' }],
    ['not json', 503],
    [[SESSION_COORDINATOR_UNAVAILABLE]],
  ]) {
    const original = reply(body, status, headers);
    const sent = await markRetryableBusy(original);
    assert.equal(sent, original, JSON.stringify(body));
    assert.deepEqual(await bodyOf(sent), await bodyOf(reply(body, status, headers)));
  }
});

// The shared rule clients use (shared/sessionCoordinatorBusy.mjs).
test('only a busy answer the Worker says may be repeated is sent again', () => {
  assert.equal(isRetryableBusy(503, coordinatorBusyBody({ reason: 'rate_limit_unavailable' })), true);
  assert.equal(isRetryableBusy(503, { error: 'Authorization state coordination is unavailable.', retryable: true }), true);
  // Workers before the field send only the sentence.
  assert.equal(isRetryableBusy(503, { error: SESSION_COORDINATOR_UNAVAILABLE }), true);
  for (const [status, body] of [
    [503, { error: SESSION_COORDINATOR_UNAVAILABLE, retryable: false }],
    [503, { error: 'Authorization state coordination is unavailable.' }],
    [503, { error: 'The session’s AI isn’t set up.' }],
    [429, coordinatorBusyBody()],
    [503, null],
    [503, 'busy'],
  ]) assert.equal(isRetryableBusy(status, body), false, JSON.stringify([status, body]));
});

test('a busy body keeps its reason and always says it may be repeated', () => {
  assert.deepEqual(coordinatorBusyBody({ reason: 'x', retryable: false }), { error: SESSION_COORDINATOR_UNAVAILABLE, reason: 'x', retryable: true });
});

test('retries wait the shared delays, spread by half either way, and stop when they run out', () => {
  assert.deepEqual(COORDINATOR_RETRY_DELAYS_MS.map((_, attempt) => coordinatorRetryDelayMs(attempt, () => 0)), [200, 500, 1000]);
  assert.deepEqual(COORDINATOR_RETRY_DELAYS_MS.map((_, attempt) => coordinatorRetryDelayMs(attempt, () => 1)), [600, 1500, 3000]);
  assert.equal(coordinatorRetryDelayMs(COORDINATOR_RETRY_DELAYS_MS.length, () => 0.5), null);
  assert.equal(coordinatorRetryDelayMs(-1, () => 0.5), null);
});
