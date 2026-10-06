import test from 'node:test';
import assert from 'node:assert/strict';

import { __test__sessionQuestions } from './sessionQuestions.mjs';
import { __test__telegramQuestionQueue as queue } from './telegramQuestionQueue.mjs';

const id = `0x${'cd'.repeat(32)}`;
const aliases = [
  'binary',
  'boolean',
  'yes_no',
  'yes-no',
  'agree_disagree',
  'agree_unsure_disagree',
  'rating',
  'scale',
  'linear_scale',
  'multichoice',
  'multi_choice',
  'multiple_choice',
  'multi_select',
  'single_choice',
  'single_select',
  'quadratic',
  'freeform',
];

test('queue type filter matches every alias the session reader accepts', () => {
  const misses = [];
  for (const alias of aliases) {
    const question = __test__sessionQuestions.normalizeQuestionPayload(
      { id, prompt: 'Fixture question', type: alias, options: ['A', 'B'] },
      { questionId: id, pointerId: 'x'.repeat(43), sessionSlug: 'fixture' },
    );
    const criteria = queue.normalizeQuestionQueueCriteria({ questionTypes: [alias] });
    const matched = queue.questionMatchesCriteria({ ...question, answerable: true }, criteria);
    if (!matched) misses.push(alias);
  }
  assert.deepEqual(misses, []);
});
