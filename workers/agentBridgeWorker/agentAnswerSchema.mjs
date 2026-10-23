import { normalizeAgentRatingScale } from './ratingScale.mjs';

import { safeString } from './runtimePrimitives.mjs';

import { QUESTION_TYPES } from './constants.mjs';

function ratingButtonValuesForScale(scale = {}) {
  const { min, max, step } = normalizeAgentRatingScale({ ratingScale: scale });
  const lastIndex = Math.floor((max - min) / step + 1e-9);
  const count = Math.min(lastIndex, 20);
  // Button sampling limits chat chrome without changing the stored scale or the slider.
  return Array.from({ length: count + 1 }, (_, index) =>
    Number((min + (count ? Math.round(index * lastIndex / count) : 0) * step).toPrecision(12)));
}

function normalizeQuestionType(value = '') {
  const normalized = safeString(value).toLowerCase();
  if (['text', 'freeform', 'free_response'].includes(normalized)) return QUESTION_TYPES.FREEFORM;
  if (['agree_unsure_disagree', 'agree-disagree', 'boolean', 'binary', 'yes_no', 'yes-no'].includes(normalized)) return QUESTION_TYPES.AGREE_UNSURE_DISAGREE;
  if (normalized === 'quadratic') return QUESTION_TYPES.QUADRATIC;
  if (['rating', 'scale', 'linear_scale'].includes(normalized)) return QUESTION_TYPES.RATING;
  if ([
    'multichoice',
    'multi_choice',
    'multi-choice',
    'multi_select',
    'multi-select',
    'multiple_choice',
    'multiple-choice',
    'single_choice',
    'single-choice',
  ].includes(normalized)) return QUESTION_TYPES.MULTICHOICE;
  return QUESTION_TYPES.FREEFORM;
}

function normalizeChoiceSelectionMode(question = {}) {
  const rawType = safeString(question.questionType || question.type).toLowerCase();
  if (
    rawType === 'single_choice'
    || rawType === 'single-choice'
    || question.singleSelect === true
    || question.singleChoice === true
    || question.oneSelectionOnly === true
  ) {
    return 'single';
  }
  return 'multi';
}

function normalizeOptions(question = {}) {
  return (Array.isArray(question.options) ? question.options : [])
    .map((option) => safeString(option.label || option.text || option))
    .filter(Boolean);
}

function buildAgentQuestionAnswerSchema(question = {}) {
  const questionType = normalizeQuestionType(question.questionType || question.type);
  if (questionType === QUESTION_TYPES.AGREE_UNSURE_DISAGREE) {
    const values = ['agree', 'disagree', 'unsure'];
    return {
      questionType: 'binary',
      answerSchema: { kind: 'choice', values },
    };
  }
  if (questionType === QUESTION_TYPES.RATING) {
    const scale = normalizeAgentRatingScale(question);
    const values = ratingButtonValuesForScale(scale);
    return {
      questionType: 'rating',
      answerSchema: {
        kind: 'rating',
        min: scale.min,
        max: scale.max,
        step: scale.step,
        values,
      },
    };
  }
  if (questionType === QUESTION_TYPES.QUADRATIC) {
    return { questionType: 'quadratic', answerSchema: { kind: 'quadratic', options: normalizeOptions(question), voiceCredits: question.voiceCredits ?? 99 } };
  }
  if (questionType === QUESTION_TYPES.MULTICHOICE) {
    const selectionMode = normalizeChoiceSelectionMode(question);
    const options = [...new Set(normalizeOptions(question))];
    return {
      questionType: 'multichoice',
      answerSchema: {
        kind: 'multichoice',
        options,
        minSelections: 1,
        maxSelections: selectionMode === 'single' ? 1 : options.length,
        selectionMode,
      },
    };
  }
  return {
    questionType: 'freeform',
    answerSchema: { kind: 'text', maxChars: 280 },
  };
}

export {
  buildAgentQuestionAnswerSchema,
};
