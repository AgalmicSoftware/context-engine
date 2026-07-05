import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ensureTelegramQuestionNumbers,
  findQuestionByStableNumber,
  telegramQuestionNumberKvKey,
} from './telegramQuestionNumbers.mjs';

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
  const key = telegramQuestionNumberKvKey(sessionSlug);

  const first = await ensureTelegramQuestionNumbers({
    env,
    sessionSlug,
    questions: [
      { questionId: firstId, prompt: 'First question?' },
      { questionId: secondId, prompt: 'Second question?' },
    ],
    createdAt: 'not-a-date',
  });

  assert.equal(first.ok, true);
  assert.equal(first.questions[0].stableQuestionNumber, 1);
  assert.equal(first.questions[1].stableQuestionNumber, 2);
  assert.equal(kv.options.get(key), null);

  const stored = JSON.parse(await kv.get(key));
  assert.equal(stored.numberToQuestionId['1'], firstId);
  assert.equal(stored.numberToQuestionId['2'], secondId);
  assert.equal(stored.questionIdToNumber[firstId], 1);
  assert.equal(stored.questionIdToNumber[secondId], 2);
  assert.equal(stored.nextNumber, 3);

  const reordered = await ensureTelegramQuestionNumbers({
    env,
    sessionSlug,
    questions: [
      { questionId: secondId, prompt: 'Second question?' },
      { questionId: firstId, prompt: 'First question?' },
      { questionId: 'q-new', prompt: 'New question?' },
    ],
    createdAt: '2026-05-08T12:01:00.000Z',
  });
  assert.equal(reordered.questions[0].stableQuestionNumber, 2);
  assert.equal(reordered.questions[1].stableQuestionNumber, 1);
  assert.equal(reordered.questions[2].stableQuestionNumber, 3);

  const selected = await findQuestionByStableNumber({
    env,
    sessionSlug,
    selector: 'question 2',
    questions: reordered.questions,
  });
  assert.equal(selected.questionId, secondId);
});
