import test from 'node:test';
import assert from 'node:assert/strict';

import { __test__sessionQuestions } from './sessionQuestions.mjs';
import {
  buildTelegramQuestionAnswerSchema,
  buildTelegramQuestionCard,
  normalizeTelegramRatingScale,
} from './questionUi.mjs';
import { normalizeRatingScale as sharedCatalogScale } from '../../shared/interviewQuestionCatalog.mjs';
import { formatValidAnalysisAnswer } from '../../workers/sessionCorsWorker/resultsAnalysisAnswerValidation.js';

const id = `0x${'ab'.repeat(32)}`;
const payload = {
  id,
  prompt: 'How much do you trust AI summaries of public input?',
  type: 'rating',
  scale: { min: 1, max: 10, minLabel: 'Not at all', maxLabel: 'Completely' },
  sessionSlug: 'eddy26',
};

test('bridge Telegram schema uses the stored 1..10 scale like the shared catalog', () => {
  const shared = sharedCatalogScale(payload);
  const bridgeQuestion = __test__sessionQuestions.normalizeQuestionPayload(payload, {
    questionId: id,
    pointerId: 'x'.repeat(43),
    sessionSlug: 'eddy26',
  });
  const schema = buildTelegramQuestionAnswerSchema(bridgeQuestion).answerSchema;
  const cardScale = buildTelegramQuestionCard(bridgeQuestion).ratingScale;
  const directScale = normalizeTelegramRatingScale(payload);
  assert.deepEqual({ min: schema.min, max: schema.max }, { min: shared.min, max: shared.max });
  assert.deepEqual(cardScale, { min: 1, max: 10, step: 1 });
  assert.deepEqual(directScale, cardScale);
  assert.equal(formatValidAnalysisAnswer(0, { type: 'rating', scale: shared }), null);
  assert.notEqual(formatValidAnalysisAnswer(1, { type: 'rating', scale: shared }), null);
});
