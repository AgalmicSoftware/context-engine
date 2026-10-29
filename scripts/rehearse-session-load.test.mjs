import test from 'node:test';
import assert from 'node:assert/strict';
import { parseRehearsalArgs, runRehearsal } from './rehearse-session-load.mjs';

test('rehearsal accepts only bounded in-process options and refuses network targets', () => {
  assert.equal(parseRehearsalArgs([]).participants, 40);
  for (const args of [['--url', 'https://worker.example'], ['--host', '127.0.0.1'], ['--participants', '0'], ['--participants', '500'], ['--participants', 'oops']]) {
    assert.throws(() => parseRehearsalArgs(args));
  }
});

test('forty concurrent people complete invite, Wrapped and signed-in browser flows without leaking secrets', async () => {
  const result = await runRehearsal({ participants: 40, jitterMs: 0 });
  assert.equal(result.completed.agents, 20);
  assert.equal(result.completed.web, 20);
  assert.equal(result.completed.wrapped, 20);
  assert.equal(result.errors.total, 0, JSON.stringify(result));
  assert.equal(result.storedResponses, 40);
  assert.ok(result.requests >= 200);
  assert.ok(result.latencyMs.p95 >= result.latencyMs.p50);
  assert.doesNotMatch(JSON.stringify(result), /ceagt_|fresh-session-fixture-root|fixture-hmac-secret|"token"|"signature"/);
});

test('strict KV rehearsal verifies distinct participants without assuming throttling', async () => {
  const result = await runRehearsal({ participants: 4, jitterMs: 0, enforceKvLimit: true });
  assert.ok(result.kvCheckedWrites > 0);
  assert.equal(result.completed.agents + result.completed.web, 4, JSON.stringify(result));
  assert.equal(result.errors.total, 0, JSON.stringify(result));
});
