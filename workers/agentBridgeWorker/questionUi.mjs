import {
  DEFAULT_RATING_SCALE,
  QUESTION_TYPES,
  TELEGRAM_BRIDGE_ACTIONS,
} from './constants.mjs';
import { buildOpaqueActionId } from './opaqueActions.mjs';
import { sanitizeForGroup } from './redaction.mjs';

function safeString(value) {
  return String(value || '').trim();
}

function normalizeQuestionType(value = '') {
  const normalized = safeString(value).toLowerCase();
  if (['text', 'freeform', 'free_response'].includes(normalized)) return QUESTION_TYPES.FREEFORM;
  if (['agree_unsure_disagree', 'agree-disagree', 'boolean'].includes(normalized)) return QUESTION_TYPES.AGREE_UNSURE_DISAGREE;
  if (['rating', 'scale', 'linear_scale'].includes(normalized)) return QUESTION_TYPES.RATING;
  if (['multichoice', 'multi_choice', 'multiple_choice', 'single_choice'].includes(normalized)) return QUESTION_TYPES.MULTICHOICE;
  return QUESTION_TYPES.FREEFORM;
}

function baseControl(action, label, questionId, targetLane = 'private') {
  return {
    actionId: buildOpaqueActionId(`${action}|${questionId}|${label}`),
    action,
    label,
    targetLane,
  };
}

export function buildTelegramQuestionControls(question = {}, {
  docsExist = false,
  microphoneSupported = true,
} = {}) {
  const questionId = safeString(question.questionId || question.id);
  const questionType = normalizeQuestionType(question.questionType || question.type);
  const controls = [];
  if (questionType === QUESTION_TYPES.AGREE_UNSURE_DISAGREE) {
    controls.push(
      baseControl(TELEGRAM_BRIDGE_ACTIONS.DRAFT_RESPONSE, 'Agree', questionId),
      baseControl(TELEGRAM_BRIDGE_ACTIONS.DRAFT_RESPONSE, 'Unsure', questionId),
      baseControl(TELEGRAM_BRIDGE_ACTIONS.DRAFT_RESPONSE, 'Disagree', questionId),
    );
  } else if (questionType === QUESTION_TYPES.RATING) {
    const scale = {
      ...DEFAULT_RATING_SCALE,
      ...(question.ratingScale || {}),
    };
    controls.push({
      ...baseControl(TELEGRAM_BRIDGE_ACTIONS.DRAFT_RESPONSE, `${scale.min}-${scale.max}`, questionId),
      controlType: 'rating',
      min: 0,
      max: 10,
      step: 1,
    });
  } else if (questionType === QUESTION_TYPES.MULTICHOICE) {
    const options = Array.isArray(question.options) ? question.options : [];
    for (const option of options) {
      const label = safeString(option.label || option.text || option);
      if (label) controls.push(baseControl(TELEGRAM_BRIDGE_ACTIONS.DRAFT_RESPONSE, label, questionId));
    }
  } else {
    controls.push(baseControl(TELEGRAM_BRIDGE_ACTIONS.DRAFT_RESPONSE, 'Answer', questionId));
  }
  controls.push(baseControl(TELEGRAM_BRIDGE_ACTIONS.ADDITIONAL_COMMENTS, 'Comment', questionId, 'private'));
  if (microphoneSupported) {
    controls.push(baseControl(TELEGRAM_BRIDGE_ACTIONS.MICROPHONE_INPUT, 'Microphone', questionId, 'private'));
  }
  if (docsExist) {
    controls.push(baseControl(TELEGRAM_BRIDGE_ACTIONS.DOC_CONTEXT, 'Context', questionId, 'mini_app'));
  }
  return controls;
}

export function buildTelegramQuestionCard(question = {}, options = {}) {
  const questionId = safeString(question.questionId || question.id);
  const questionType = normalizeQuestionType(question.questionType || question.type);
  return sanitizeForGroup({
    type: 'telegram_question_card',
    questionId,
    questionType,
    questionText: safeString(question.questionText || question.prompt),
    answerLabels: Array.isArray(question.options)
      ? question.options.map((option) => safeString(option.label || option.text || option)).filter(Boolean)
      : [],
    controls: buildTelegramQuestionControls(question, options),
  });
}

export function buildTelegramScreenState(screen = '', fields = {}) {
  return sanitizeForGroup({
    type: 'telegram_screen_state',
    screen: safeString(screen),
    ...fields,
  });
}

export function assertQuestionCardParity(card = {}) {
  const controls = Array.isArray(card.controls) ? card.controls : [];
  const actions = new Set(controls.map((control) => control.action));
  if (card.questionType === QUESTION_TYPES.RATING) {
    const rating = controls.find((control) => control.controlType === 'rating');
    if (!rating || rating.min !== 0 || rating.max !== 10) {
      return { ok: false, reason: 'rating_scale_must_match_ce_client_0_10' };
    }
  }
  if (!actions.has(TELEGRAM_BRIDGE_ACTIONS.ADDITIONAL_COMMENTS)) {
    return { ok: false, reason: 'additional_comments_action_required' };
  }
  if (!actions.has(TELEGRAM_BRIDGE_ACTIONS.MICROPHONE_INPUT)) {
    return { ok: false, reason: 'microphone_input_action_required' };
  }
  return { ok: true, reason: 'telegram_question_card_matches_ce_conventions' };
}
