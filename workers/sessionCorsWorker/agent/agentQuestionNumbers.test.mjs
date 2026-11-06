import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assignAgentQuestionNumber,
  agentQuestionNumberKvKey,
} from './agentQuestionNumbers.mjs';

class MemoryKv {
  constructor() {
    this.store = new Map();
    this.options = new Map();
  }

  async put(key, value, options = undefined) {
    this.store.set(key, value);
    this.options.set(key, options || null);
  }

  async get(key) {
    return this.store.get(key) || null;
  }
}

test('stable question numbers persist a durable map for bytes32 ids', async () => {
  const kv = new MemoryKv();
  const env = { AGENT_ACTION_KV: kv };
  const sessionSlug = 'alpha';
  const firstId = `0x${'12'.repeat(32)}`;
  const secondId = `0x${'34'.repeat(32)}`;
  const key = agentQuestionNumberKvKey(sessionSlug);

  const assign = (questionId, createdAt) => assignAgentQuestionNumber({ env, sessionSlug, questionId, createdAt });
  assert.equal((await assign(firstId, 'not-a-date')).number, 1);
  assert.equal((await assign(secondId, 'not-a-date')).number, 2);
  assert.equal(kv.options.get(key), null);

  const stored = JSON.parse(await kv.get(key));
  assert.equal(stored.numberToQuestionId['1'], firstId);
  assert.equal(stored.numberToQuestionId['2'], secondId);
  assert.equal(stored.questionIdToNumber[firstId], 1);
  assert.equal(stored.questionIdToNumber[secondId], 2);
  assert.equal(stored.nextNumber, 3);

  assert.equal((await assign(secondId, '2026-05-08T12:01:00.000Z')).number, 2);
  assert.equal((await assign(firstId, '2026-05-08T12:01:00.000Z')).number, 1);
  assert.equal((await assign('q-new', '2026-05-08T12:01:00.000Z')).number, 3);
});
