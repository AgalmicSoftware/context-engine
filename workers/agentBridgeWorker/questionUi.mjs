import {
  DEFAULT_RATING_SCALE,
  QUESTION_TYPES,
  TELEGRAM_BRIDGE_ACTIONS,
  TELEGRAM_CHAT_LANES,
} from './constants.mjs';
import { buildOpaqueActionId } from './opaqueActions.mjs';
import { sanitizeForGroup } from './redaction.mjs';

const OPAQUE_CALLBACK_LAUNCH = 'callback:<opaque-action-id>';
const OPAQUE_DEEP_LINK_LAUNCH = 't.me/<bot>?start=<opaque-action-id>';
const RATING_BUTTON_VALUES = Object.freeze([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);

export const TELEGRAM_SCREEN_IDS = Object.freeze([
  'setup_welcome',
  'test_checklist',
  'group_session_card',
  'private_start',
  'account_created',
  'account_recovered',
  'onboarding',
  'freeform_question',
  'agree_unsure_disagree_question',
  'rating_question',
  'multichoice_question',
  'doc_library',
  'doc_detail',
  'generate_questions',
  'confirmation_signing',
  'submitted',
  'draft_saved',
  'event_log_summary',
  'error_retry',
]);

export const TELEGRAM_SCREEN_LAUNCHES = Object.freeze({
  setup_welcome: { command: '/start', deepLink: OPAQUE_DEEP_LINK_LAUNCH },
  test_checklist: { command: '/start' },
  group_session_card: { command: '/ce_join', callback: OPAQUE_CALLBACK_LAUNCH },
  private_start: { command: '/start <opaque-action-id>', deepLink: OPAQUE_DEEP_LINK_LAUNCH },
  account_created: { command: '/ce_join', callback: OPAQUE_CALLBACK_LAUNCH },
  account_recovered: { command: '/ce_recover_key', callback: OPAQUE_CALLBACK_LAUNCH },
  onboarding: { command: '/ce_onboarding', callback: OPAQUE_CALLBACK_LAUNCH },
  freeform_question: { command: '/ce_questions', callback: OPAQUE_CALLBACK_LAUNCH },
  agree_unsure_disagree_question: { command: '/ce_questions', callback: OPAQUE_CALLBACK_LAUNCH },
  rating_question: { command: '/ce_questions', callback: OPAQUE_CALLBACK_LAUNCH },
  multichoice_question: { command: '/ce_questions', callback: OPAQUE_CALLBACK_LAUNCH },
  doc_library: { command: '/ce_docs', callback: OPAQUE_CALLBACK_LAUNCH },
  doc_detail: { command: '/ce_docs', callback: OPAQUE_CALLBACK_LAUNCH },
  generate_questions: { command: '/ce_generate_questions', callback: OPAQUE_CALLBACK_LAUNCH },
  confirmation_signing: { callback: OPAQUE_CALLBACK_LAUNCH },
  submitted: { command: '/ce_questions', callback: OPAQUE_CALLBACK_LAUNCH },
  draft_saved: { command: '/ce_questions', callback: OPAQUE_CALLBACK_LAUNCH },
  event_log_summary: { command: '/ce_events', callback: OPAQUE_CALLBACK_LAUNCH },
  error_retry: { callback: OPAQUE_CALLBACK_LAUNCH },
});

function safeString(value) {
  return String(value || '').trim();
}

function normalizeQuestionType(value = '') {
  const normalized = safeString(value).toLowerCase();
  if (['text', 'freeform', 'free_response'].includes(normalized)) return QUESTION_TYPES.FREEFORM;
  if (['agree_unsure_disagree', 'agree-disagree', 'boolean', 'binary', 'yes_no', 'yes-no'].includes(normalized)) return QUESTION_TYPES.AGREE_UNSURE_DISAGREE;
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

function selectedChoiceSet(question = {}) {
  const raw = Array.isArray(question.selectedValues)
    ? question.selectedValues
    : (Array.isArray(question.selectedOptions) ? question.selectedOptions : question.value);
  const values = Array.isArray(raw) ? raw : [raw];
  return new Set(values.map(safeString).filter(Boolean));
}

function baseControl(action, label, questionId, targetLane = TELEGRAM_CHAT_LANES.PRIVATE_ACCOUNT, extra = {}) {
  return {
    actionId: buildOpaqueActionId(`${action}|${questionId}|${label}`),
    action,
    label,
    targetLane,
    ...extra,
  };
}

function buildScreenButton(action, label, targetLane = TELEGRAM_CHAT_LANES.PRIVATE_ACCOUNT, extra = {}) {
  return {
    actionId: buildOpaqueActionId(`screen_button|${action}|${label}|${targetLane}`),
    action,
    label,
    targetLane,
    callback: OPAQUE_CALLBACK_LAUNCH,
    ...extra,
  };
}

function buildDefaultScreenButtons(screen) {
  if (screen === 'account_created') {
    return [
      buildScreenButton(TELEGRAM_BRIDGE_ACTIONS.VIEW_QUESTIONS, 'View Questions'),
      buildScreenButton(TELEGRAM_BRIDGE_ACTIONS.LIST_DOCS, 'View / Add Docs'),
      buildScreenButton(TELEGRAM_BRIDGE_ACTIONS.START_ONBOARDING, 'Enter Startup Info'),
    ];
  }
  if (screen === 'onboarding') {
    return [
      buildScreenButton(TELEGRAM_BRIDGE_ACTIONS.START_ONBOARDING, 'Enter Startup Info'),
      buildScreenButton(TELEGRAM_BRIDGE_ACTIONS.VIEW_QUESTIONS, 'Skip'),
    ];
  }
  if (screen === 'doc_library') {
    return [
      buildScreenButton(TELEGRAM_BRIDGE_ACTIONS.LIST_DOCS, 'View / Add Docs'),
      buildScreenButton(TELEGRAM_BRIDGE_ACTIONS.SELECT_DOCS, 'Select Docs'),
      buildScreenButton(TELEGRAM_BRIDGE_ACTIONS.GENERATE_QUESTION, 'Generate Questions'),
      buildScreenButton(TELEGRAM_BRIDGE_ACTIONS.USE_DOCS_AS_ANSWER_CONTEXT, 'Use as Answer Context'),
    ];
  }
  if (screen === 'generate_questions') {
    return [
      buildScreenButton(TELEGRAM_BRIDGE_ACTIONS.SELECT_DOCS, 'Select Docs'),
      buildScreenButton(TELEGRAM_BRIDGE_ACTIONS.GENERATE_QUESTION, 'Generate Questions'),
    ];
  }
  if (screen === 'confirmation_signing') {
    return [
      buildScreenButton(TELEGRAM_BRIDGE_ACTIONS.DRAFT_RESPONSE, 'Save draft'),
      buildScreenButton(TELEGRAM_BRIDGE_ACTIONS.EDIT_RESPONSE, 'Edit'),
    ];
  }
  return [];
}

function buildDefaultScreenCopy(screen) {
  if (screen === 'account_created') {
    return {
      title: 'Account ready',
      text: 'Your Telegram account is ready for this session.',
    };
  }
  if (screen === 'onboarding') {
    return {
      title: 'Startup Info',
      text: 'Enter startup info so I can suggest answers for you.',
    };
  }
  if (screen === 'doc_library') {
    return {
      title: 'View / Add Docs',
      text: 'Select docs to generate questions or save them for answer context.',
      buttonLabel: 'View / Add Docs',
    };
  }
  if (screen === 'generate_questions') {
    return {
      title: 'Generate Questions',
      text: 'Selected docs are inputs for Generate Questions.',
    };
  }
  if (screen === 'confirmation_signing') {
    return {
      title: 'Submit Response',
      text: 'Submit this response?',
    };
  }
  return {};
}

export function getTelegramScreenLaunch(screen = '') {
  const screenId = safeString(screen);
  return {
    ...(TELEGRAM_SCREEN_LAUNCHES[screenId] || { callback: OPAQUE_CALLBACK_LAUNCH }),
  };
}

export function listTelegramScreenLaunchContracts() {
  return TELEGRAM_SCREEN_IDS.map((screen) => ({
    screen,
    launch: getTelegramScreenLaunch(screen),
  }));
}

export function buildTelegramGroupSessionCardState({
  sessionName = '',
  sessionSlug = '',
  policy = {},
  createdAt = null,
} = {}) {
  const sessionLabel = safeString(sessionName || sessionSlug || 'general');
  const buttons = [
    buildScreenButton(TELEGRAM_BRIDGE_ACTIONS.JOIN_SESSION, 'Join Session', TELEGRAM_CHAT_LANES.PRIVATE_ACCOUNT, {
      command: '/ce_join',
      deepLink: OPAQUE_DEEP_LINK_LAUNCH,
    }),
    buildScreenButton(TELEGRAM_BRIDGE_ACTIONS.VIEW_QUESTIONS, 'View Questions', TELEGRAM_CHAT_LANES.GROUP_LOBBY, {
      command: '/ce_questions',
      default: true,
    }),
    buildScreenButton(TELEGRAM_BRIDGE_ACTIONS.LIST_DOCS, 'View / Add Docs', TELEGRAM_CHAT_LANES.GROUP_LOBBY, {
      command: '/ce_docs',
    }),
  ];
  const policyActions = [];
  if (policy.allowAddQuestion === true) {
    policyActions.push(buildScreenButton(TELEGRAM_BRIDGE_ACTIONS.ADD_QUESTION, 'Add Question', TELEGRAM_CHAT_LANES.PRIVATE_ACCOUNT));
  }
  if (policy.allowGenerateQuestion === true || policy.allowQuestionGeneration === true) {
    policyActions.push(buildScreenButton(TELEGRAM_BRIDGE_ACTIONS.GENERATE_QUESTION, 'Generate Questions', TELEGRAM_CHAT_LANES.PRIVATE_ACCOUNT, {
      command: '/ce_generate_questions',
    }));
  }
  return buildTelegramScreenState('group_session_card', {
    text: `Context Engine session linked: ${sessionLabel}`,
    sessionSlug: safeString(sessionSlug),
    sessionName: safeString(sessionName),
    buttons,
    policyActions,
    defaultAction: TELEGRAM_BRIDGE_ACTIONS.VIEW_QUESTIONS,
    createdAt,
  });
}

export function buildTelegramQuestionControls(question = {}, {
  docsExist = false,
  docsRelevant = false,
  microphoneSupported = true,
} = {}) {
  const questionId = safeString(question.questionId || question.id);
  const questionType = normalizeQuestionType(question.questionType || question.type);
  const controls = [];
  if (questionType === QUESTION_TYPES.AGREE_UNSURE_DISAGREE) {
    controls.push(
      baseControl(TELEGRAM_BRIDGE_ACTIONS.DRAFT_RESPONSE, 'Agree', questionId, TELEGRAM_CHAT_LANES.PRIVATE_ACCOUNT, { controlType: 'agree_unsure_disagree', value: 'agree', selectionMode: 'single' }),
      baseControl(TELEGRAM_BRIDGE_ACTIONS.DRAFT_RESPONSE, 'Unsure', questionId, TELEGRAM_CHAT_LANES.PRIVATE_ACCOUNT, { controlType: 'agree_unsure_disagree', value: 'unsure', selectionMode: 'single' }),
      baseControl(TELEGRAM_BRIDGE_ACTIONS.DRAFT_RESPONSE, 'Disagree', questionId, TELEGRAM_CHAT_LANES.PRIVATE_ACCOUNT, { controlType: 'agree_unsure_disagree', value: 'disagree', selectionMode: 'single' }),
    );
  } else if (questionType === QUESTION_TYPES.RATING) {
    const scale = {
      ...DEFAULT_RATING_SCALE,
      ...(question.ratingScale || {}),
    };
    for (const value of RATING_BUTTON_VALUES) {
      controls.push(baseControl(TELEGRAM_BRIDGE_ACTIONS.DRAFT_RESPONSE, String(value), questionId, TELEGRAM_CHAT_LANES.PRIVATE_ACCOUNT, {
        controlType: 'rating_button',
        value,
        min: 0,
        max: 10,
        step: 1,
        requestedMin: scale.min,
        requestedMax: scale.max,
        selectionMode: 'single',
      }));
    }
  } else if (questionType === QUESTION_TYPES.MULTICHOICE) {
    const selectionMode = normalizeChoiceSelectionMode(question);
    const selected = selectedChoiceSet(question);
    for (const label of normalizeOptions(question)) {
      controls.push(baseControl(TELEGRAM_BRIDGE_ACTIONS.DRAFT_RESPONSE, label, questionId, TELEGRAM_CHAT_LANES.PRIVATE_ACCOUNT, {
        controlType: selectionMode === 'single' ? 'single_select' : 'multi_select_toggle',
        value: label,
        selectionMode,
        selected: selected.has(label),
      }));
    }
  } else {
    controls.push(baseControl(TELEGRAM_BRIDGE_ACTIONS.DRAFT_RESPONSE, 'Type', questionId, TELEGRAM_CHAT_LANES.PRIVATE_ACCOUNT, {
      controlType: 'text_input',
    }));
    if (microphoneSupported) {
      controls.push(baseControl(TELEGRAM_BRIDGE_ACTIONS.MICROPHONE_INPUT, 'Voice', questionId, TELEGRAM_CHAT_LANES.PRIVATE_ACCOUNT, {
        controlType: 'voice_input',
      }));
    }
  }
  controls.push(baseControl(TELEGRAM_BRIDGE_ACTIONS.ADDITIONAL_COMMENTS, 'Additional comments', questionId, TELEGRAM_CHAT_LANES.PRIVATE_ACCOUNT, {
    controlType: 'additional_comments',
  }));
  if (microphoneSupported && questionType !== QUESTION_TYPES.FREEFORM) {
    controls.push(baseControl(TELEGRAM_BRIDGE_ACTIONS.MICROPHONE_INPUT, 'Microphone', questionId, TELEGRAM_CHAT_LANES.PRIVATE_ACCOUNT, {
      controlType: 'voice_input',
    }));
  }
  if (docsExist || docsRelevant) {
    controls.push(baseControl(TELEGRAM_BRIDGE_ACTIONS.DOC_CONTEXT, 'Use as Answer Context', questionId, TELEGRAM_CHAT_LANES.MINI_APP, {
      controlType: 'doc_context',
    }));
  }
  return controls;
}

export function buildTelegramQuestionCard(question = {}, options = {}) {
  const questionId = safeString(question.questionId || question.id);
  const questionType = normalizeQuestionType(question.questionType || question.type);
  const docsContextAvailable = options.docsExist === true || options.docsRelevant === true;
  return sanitizeForGroup({
    type: 'telegram_question_card',
    questionId,
    questionType,
    selectionMode: questionType === QUESTION_TYPES.MULTICHOICE ? normalizeChoiceSelectionMode(question) : null,
    ratingScale: questionType === QUESTION_TYPES.RATING ? { min: 0, max: 10, step: 1 } : null,
    questionText: safeString(question.questionText || question.prompt),
    answerLabels: normalizeOptions(question),
    docsContextAvailable,
    microphoneSupported: options.microphoneSupported !== false,
    additionalCommentsSupported: true,
    controls: buildTelegramQuestionControls(question, options),
  });
}

export function buildTelegramScreenState(screen = '', fields = {}) {
  const screenId = safeString(screen);
  const { botUsername, launch, buttons, ...publicFields } = fields;
  const defaults = buildDefaultScreenCopy(screenId);
  const defaultButtons = buildDefaultScreenButtons(screenId);
  return sanitizeForGroup({
    type: 'telegram_screen_state',
    screen: screenId,
    launch: launch || getTelegramScreenLaunch(screenId, { botUsername }),
    ...defaults,
    buttons: buttons || defaultButtons,
    ...publicFields,
  });
}

export function assertQuestionCardParity(card = {}) {
  const controls = Array.isArray(card.controls) ? card.controls : [];
  const actions = new Set(controls.map((control) => control.action));
  if (card.questionType === QUESTION_TYPES.RATING) {
    const ratingValues = controls
      .filter((control) => control.controlType === 'rating_button')
      .map((control) => control.value);
    if (JSON.stringify(ratingValues) !== JSON.stringify(RATING_BUTTON_VALUES)) {
      return { ok: false, reason: 'rating_scale_must_match_ce_client_0_10' };
    }
  }
  if (card.questionType === QUESTION_TYPES.MULTICHOICE) {
    const choiceControls = controls.filter((control) => (
      control.controlType === 'single_select' || control.controlType === 'multi_select_toggle'
    ));
    if (card.selectionMode === 'single' && choiceControls.some((control) => control.controlType !== 'single_select')) {
      return { ok: false, reason: 'single_choice_controls_must_be_single_select' };
    }
    if (card.selectionMode === 'multi' && choiceControls.some((control) => control.controlType !== 'multi_select_toggle' || typeof control.selected !== 'boolean')) {
      return { ok: false, reason: 'multi_choice_controls_must_keep_selection_state' };
    }
  }
  if (card.questionType === QUESTION_TYPES.FREEFORM) {
    if (!controls.some((control) => control.controlType === 'text_input')) {
      return { ok: false, reason: 'freeform_type_action_required' };
    }
  }
  if (!actions.has(TELEGRAM_BRIDGE_ACTIONS.ADDITIONAL_COMMENTS)) {
    return { ok: false, reason: 'additional_comments_action_required' };
  }
  if (card.microphoneSupported !== false && !actions.has(TELEGRAM_BRIDGE_ACTIONS.MICROPHONE_INPUT)) {
    return { ok: false, reason: 'microphone_input_action_required' };
  }
  if (card.docsContextAvailable === false && actions.has(TELEGRAM_BRIDGE_ACTIONS.DOC_CONTEXT)) {
    return { ok: false, reason: 'doc_context_action_requires_docs_or_relevance' };
  }
  if (card.docsContextAvailable === true && !actions.has(TELEGRAM_BRIDGE_ACTIONS.DOC_CONTEXT)) {
    return { ok: false, reason: 'doc_context_action_required_when_docs_exist' };
  }
  return { ok: true, reason: 'telegram_question_card_matches_ce_conventions' };
}
