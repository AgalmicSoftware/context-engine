import test from 'node:test';
import assert from 'node:assert/strict';
import {
  __test__telegramQuestionProposals,
  listTelegramProposedQuestionsForSession,
  persistTelegramProposedQuestion,
} from './telegramQuestionProposals.mjs';

class MemoryKv {
  constructor() {
    this.store = new Map();
    this.options = new Map();
  }

  async put(key, value, options = null) {
    this.store.set(key, value);
    this.options.set(key, options);
  }

  async get(key) {
    return this.store.get(key) || null;
  }

  async list({ prefix = '', limit = 1000 } = {}) {
    const keys = Array.from(this.store.keys())
      .filter((key) => key.startsWith(prefix))
      .sort()
      .slice(0, limit)
      .map((name) => ({ name }));
    return { keys, list_complete: true };
  }
}

test('proposed question ids use compact ceq prefix for new records', async () => {
  const env = { AGENT_ACTION_KV: new MemoryKv() };
  const saved = await persistTelegramProposedQuestion({
    env,
    normalized: {
      user: { telegramUserId: '42' },
      chat: { chatId: '-1001' },
    },
    sessionSlug: 'alpha',
    prompt: 'Should the session ask shorter questions?',
    questionType: 'binary',
    tags: ['format'],
    createdAt: '2026-05-30T12:00:00.000Z',
  });

  assert.equal(saved.ok, true);
  assert.match(saved.questionId, /^ceq_[a-z0-9]{10}$/);
  assert.equal(saved.question.questionId, saved.questionId);
  assert.equal(saved.record.questionId, saved.questionId);
  assert.equal(env.AGENT_ACTION_KV.store.has(`telegram:proposed-question:alpha:${saved.questionId}`), true);

  const repeat = __test__telegramQuestionProposals.questionIdFromPrompt({
    sessionSlug: 'alpha',
    prompt: 'Should the session ask shorter questions?',
    questionType: 'binary',
    telegramUserId: '42',
    chatId: '-1001',
  });
  assert.equal(repeat, saved.questionId);
});

test('legacy telegram-proposed question ids remain listable', async () => {
  const env = { AGENT_ACTION_KV: new MemoryKv() };
  await env.AGENT_ACTION_KV.put('telegram:proposed-question:alpha:telegram-proposed-ceab_0000legacy1', JSON.stringify({
    version: 1,
    questionId: 'telegram-proposed-ceab_0000legacy1',
    sessionSlug: 'alpha',
    questionType: 'binary',
    prompt: 'Should older proposed question ids stay answerable?',
    tags: ['legacy'],
    source: 'telegram_question_proposal',
    status: 'active',
    createdAt: '2026-05-29T12:00:00.000Z',
  }));

  const listed = await listTelegramProposedQuestionsForSession(env, 'alpha');
  assert.equal(listed.length, 1);
  assert.equal(listed[0].questionId, 'telegram-proposed-ceab_0000legacy1');
  assert.equal(listed[0].proposed, true);
});
