import test from 'node:test';
import assert from 'node:assert/strict';
import { selectNextAgentQuestion } from './agentQuestionQueue.mjs';

const question = id => ({ questionId: id, questionType: 'binary', prompt: `Question ${id}`, answerable: true });
function fixture() {
  let stored;
  const env = { AGENT_ACTION_KV: {
    get: async () => stored || null,
    put: async (_key, value) => { stored = value; },
  } };
  return {
    next: (questions, extra = {}) => selectNextAgentQuestion({ env, sessionSlug: 'fixture', telegramUserId: 'participant', questions, ...extra }),
    state: () => JSON.parse(stored),
  };
}

test('a 300-question cycle serves every eligible question once before repeating', async () => {
  const f = fixture();
  const questions = Array.from({ length: 300 }, (_, index) => question(`q-${index + 1}`));
  const served = new Set();
  for (let i = 0; i < questions.length; i += 1) {
    const next = await f.next(questions, { sponsoredQuestionIds: ['q-300'] });
    if (i === 0) assert.equal(next.question.questionId, 'q-300', 'sponsored questions still come first');
    assert.equal(next.queue.cycled, false);
    assert.ok(!served.has(next.question.questionId), 'no question repeats before the full catalog is served');
    served.add(next.question.questionId);
    assert.equal(next.queue.servedCount, i + 1);
  }
  assert.equal(f.state().servedQuestionIds.length, 300);
  assert.equal(f.state().history.length, 50);
  const next = await f.next(questions, { sponsoredQuestionIds: ['q-300'] });
  assert.equal(next.queue.cycled, true);
  assert.equal(next.question.questionId, 'q-300');
  assert.equal(next.queue.servedCount, 1);
});

test('a question added mid-cycle is served before the cycle resets', async () => {
  const f = fixture();
  const questions = [question('q-1'), question('q-2')];
  await f.next(questions);
  questions.push(question('q-3'));
  for (const expected of ['q-2', 'q-3']) {
    const next = await f.next(questions);
    assert.equal(next.question.questionId, expected);
    assert.equal(next.queue.cycled, false);
  }
  assert.equal((await f.next(questions)).queue.cycled, true);
});

test('served IDs are pruned to the eligible catalog, including when the catalog becomes empty', async () => {
  const f = fixture();
  const questions = [question('removed'), question('ineligible'), question('remaining'), question('next')];
  for (let i = 0; i < 3; i += 1) await f.next(questions);
  const changed = [{ ...questions[1], answerable: false }, questions[2], questions[3]];
  const next = await f.next(changed);
  assert.equal(next.question.questionId, 'next');
  assert.deepEqual(f.state().servedQuestionIds, ['remaining', 'next']);
  assert.equal(next.queue.servedCount, 2);
  const empty = await f.next([]);
  assert.equal(empty.ok, false);
  assert.equal(empty.queue.cycled, false);
  assert.equal(empty.queue.servedCount, 0);
  assert.deepEqual(f.state().servedQuestionIds, []);
  assert.equal(f.state().history.length, 4, 'pruning does not add history entries');
});
