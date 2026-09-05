import { safeString } from './runtimePrimitives.mjs';
import {
  DEFAULT_RATING_SCALE,
  QUESTION_VISIBILITY,
  QUESTION_TYPES,
  SESSION_STORAGE_PROFILES,
  TELEGRAM_BRIDGE_ACTIONS,
  TELEGRAM_CHAT_LANES,
} from './constants.mjs';
import {
  buildCanonicalAgentRequest,
  describeTelegramAgentApiCatalog,
  listAgentApiCapabilities,
} from './agentApiCatalog.mjs';
import { buildOpaqueActionId } from './opaqueActions.mjs';
import { sanitizeForGroup } from './redaction.mjs';
import { evaluateSbtJoinPolicy, evaluateSessionSbtGateJoin } from './sessionPolicy.mjs';

const OPAQUE_CALLBACK_LAUNCH = 'callback:<opaque-action-id>';
const OPAQUE_DEEP_LINK_LAUNCH = 't.me/<bot>?start=<opaque-action-id>';
const POSE_QUESTION_CALLBACK_LAUNCH = 'callback:<pose_question_action>';
const SBT_ADDRESS_RE = /^0x[a-f0-9]{40}$/i;
const SBT_GROUP_ID_RE = /^[a-z0-9][a-z0-9_-]{2,127}$/i;
const SESSION_SLUG_RE = /^[a-z0-9][a-z0-9_-]{0,127}$/i;
const SBT_PRIVATE_CREDENTIAL_RE = /^(invite|password|proof|credential):/i;
const SBT_PRIVATE_LINK_VALUE_RE = /(?:[?&#](?:invite|password|proof|credential|token)=)/i;
const BYTES32_RE = /^0x[0-9a-fA-F]{64}$/;

export const TELEGRAM_SCREEN_IDS = Object.freeze([
  'setup_welcome',
  'test_checklist',
  'agent_action_menu',
  'agent_account_create',
  'agent_settings_overview',
  'agent_settings_edit',
  'group_session_card',
  'private_start',
  'question_list',
  'pose_question',
  'generated_question_candidates',
  'account_created',
  'account_recovered',
  'my_account',
  'joined_sbts',
  'onboarding',
  'sbt_group_card',
  'join_public_sbt',
  'join_password_sbt',
  'create_sbt_group',
  'session_join_sbt_gate',
  'freeform_question',
  'agree_unsure_disagree_question',
  'rating_question',
  'multichoice_question',
  'locked_private_question',
  'private_question_read',
  'doc_library',
  'doc_detail',
  'generate_questions',
  'submit_response',
  'confirmation_signing',
  'submitted',
  'draft_saved',
  'event_log_summary',
  'error_retry',
]);

export const TELEGRAM_SCREEN_LAUNCHES = Object.freeze({
  setup_welcome: { command: '/start', deepLink: OPAQUE_DEEP_LINK_LAUNCH },
  test_checklist: { command: '/start' },
  agent_action_menu: { command: '/agent', callback: OPAQUE_CALLBACK_LAUNCH },
  agent_account_create: { command: '/create_agent', callback: OPAQUE_CALLBACK_LAUNCH, deepLink: OPAQUE_DEEP_LINK_LAUNCH },
  agent_settings_overview: { command: '/settings', callback: OPAQUE_CALLBACK_LAUNCH, deepLink: OPAQUE_DEEP_LINK_LAUNCH },
  agent_settings_edit: { command: '/settings', callback: OPAQUE_CALLBACK_LAUNCH },
  group_session_card: { command: '/join', callback: OPAQUE_CALLBACK_LAUNCH },
  private_start: { command: '/start <opaque-action-id>', deepLink: OPAQUE_DEEP_LINK_LAUNCH },
  question_list: { command: '/questions', callback: OPAQUE_CALLBACK_LAUNCH },
  pose_question: {
    command: '/pose_question',
    aliases: ['/q'],
    deprecatedAliases: ['/drop_question'],
    callback: POSE_QUESTION_CALLBACK_LAUNCH,
  },
  generated_question_candidates: { command: '/generate_questions', callback: OPAQUE_CALLBACK_LAUNCH },
  account_created: { command: '/join', callback: OPAQUE_CALLBACK_LAUNCH },
  account_recovered: { command: '/recover_key', callback: OPAQUE_CALLBACK_LAUNCH },
  my_account: { command: '/account', callback: OPAQUE_CALLBACK_LAUNCH },
  joined_sbts: { command: '/account', callback: OPAQUE_CALLBACK_LAUNCH },
  onboarding: { command: '/onboarding', callback: OPAQUE_CALLBACK_LAUNCH },
  sbt_group_card: { command: '/sbt <sbt-address-or-group-id-or-link>', callback: OPAQUE_CALLBACK_LAUNCH },
  join_public_sbt: { command: '/join_sbt <sbt-address-or-invite-code-or-link>', callback: OPAQUE_CALLBACK_LAUNCH },
  join_password_sbt: { command: '/join_sbt <sbt-address-or-invite-code-or-link>', callback: OPAQUE_CALLBACK_LAUNCH },
  create_sbt_group: { command: '/create_sbt_group [session-slug]', callback: OPAQUE_CALLBACK_LAUNCH },
  session_join_sbt_gate: { command: '/join', callback: OPAQUE_CALLBACK_LAUNCH },
  freeform_question: { command: '/questions', callback: OPAQUE_CALLBACK_LAUNCH },
  agree_unsure_disagree_question: { command: '/questions', callback: OPAQUE_CALLBACK_LAUNCH },
  rating_question: { command: '/questions', callback: OPAQUE_CALLBACK_LAUNCH },
  multichoice_question: { command: '/questions', callback: OPAQUE_CALLBACK_LAUNCH },
  locked_private_question: { command: '/questions', callback: OPAQUE_CALLBACK_LAUNCH },
  private_question_read: { command: '/questions', callback: OPAQUE_CALLBACK_LAUNCH },
  doc_library: { command: '/attachments', aliases: ['/docs'], callback: OPAQUE_CALLBACK_LAUNCH },
  doc_detail: { command: '/attachments', aliases: ['/docs'], callback: OPAQUE_CALLBACK_LAUNCH },
  generate_questions: { command: '/generate_questions', callback: OPAQUE_CALLBACK_LAUNCH },
  submit_response: { callback: OPAQUE_CALLBACK_LAUNCH },
  confirmation_signing: { callback: OPAQUE_CALLBACK_LAUNCH },
  submitted: { command: '/questions', callback: OPAQUE_CALLBACK_LAUNCH },
  draft_saved: { command: '/questions', callback: OPAQUE_CALLBACK_LAUNCH },
  event_log_summary: { command: '/events', callback: OPAQUE_CALLBACK_LAUNCH },
  error_retry: { callback: OPAQUE_CALLBACK_LAUNCH },
});

function numberOrFallback(value, fallback) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

export function normalizeTelegramRatingScale(question = {}) {
  const source = question?.ratingScale && typeof question.ratingScale === 'object' && !Array.isArray(question.ratingScale)
    ? question.ratingScale
    : (
      question?.rating_scale && typeof question.rating_scale === 'object' && !Array.isArray(question.rating_scale)
        ? question.rating_scale
        : {}
    );
  let min = Math.floor(numberOrFallback(source.min, DEFAULT_RATING_SCALE.min));
  let max = Math.floor(numberOrFallback(source.max, DEFAULT_RATING_SCALE.max));
  let step = Math.floor(numberOrFallback(source.step, DEFAULT_RATING_SCALE.step || 1));
  if (step < 1) step = 1;
  min = Math.max(-100, Math.min(100, min));
  max = Math.max(-100, Math.min(100, max));
  if (max < min) {
    min = DEFAULT_RATING_SCALE.min;
    max = DEFAULT_RATING_SCALE.max;
    step = DEFAULT_RATING_SCALE.step || 1;
  }
  while (Math.floor((max - min) / step) + 1 > 21 && step < 10) step += 1;
  return { min, max, step };
}

function ratingButtonValuesForScale(scale = {}) {
  const normalized = normalizeTelegramRatingScale({ ratingScale: scale });
  const values = [];
  for (let value = normalized.min; value <= normalized.max && values.length < 25; value += normalized.step) {
    values.push(value);
  }
  return values;
}

function safeOpaqueSeedPart(value = '') {
  const text = safeString(value);
  if (BYTES32_RE.test(text)) return `${text.slice(2, 10)}${text.slice(-6)}`;
  return text;
}

function splitCommandText(text = '') {
  const [command = '', ...args] = safeString(text).split(/\s+/).filter(Boolean);
  return {
    command: command.toLowerCase(),
    args,
    argText: args.join(' '),
  };
}

function normalizeBotCommand(command = '') {
  const normalized = safeString(command).toLowerCase();
  return ({
    '/ce_sbt': '/sbt',
    '/ce_join_sbt': '/join_sbt',
    '/ce_create_sbt_group': '/create_sbt_group',
  })[normalized] || normalized;
}

function looksLikePublicLink(value = '') {
  return /^(?:https?:\/\/|t\.me\/|tg:\/\/)/i.test(value);
}

function classifySbtCommandTarget(value = '') {
  const target = safeString(value);
  if (!target) return { targetKind: 'missing', target: null, publicTarget: false };
  if (SBT_PRIVATE_CREDENTIAL_RE.test(target) || SBT_PRIVATE_LINK_VALUE_RE.test(target)) {
    return { targetKind: 'private_credential', target: null, publicTarget: false, credentialRef: 'telegram_private_input_ref' };
  }
  if (SBT_ADDRESS_RE.test(target)) return { targetKind: 'sbt_address', target, publicTarget: true };
  if (looksLikePublicLink(target)) return { targetKind: 'sbt_share_link', target, publicTarget: true };
  if (SBT_GROUP_ID_RE.test(target)) return { targetKind: 'sbt_group_id', target, publicTarget: true };
  return { targetKind: 'private_credential', target: null, publicTarget: false, credentialRef: 'telegram_private_input_ref' };
}

function privateCredentialCommandResult({ command = '', commandFamily = '', lane = TELEGRAM_CHAT_LANES.GROUP_LOBBY } = {}) {
  const targetLane = lane === TELEGRAM_CHAT_LANES.GROUP_LOBBY
    ? TELEGRAM_CHAT_LANES.PRIVATE_ACCOUNT
    : TELEGRAM_CHAT_LANES.MINI_APP;
  return sanitizeForGroup({
    ok: lane !== TELEGRAM_CHAT_LANES.GROUP_LOBBY,
    command,
    commandFamily,
    targetKind: 'private_credential',
    target: null,
    publicTarget: false,
    privateCredentialDetected: true,
    requiresPrivateLane: lane === TELEGRAM_CHAT_LANES.GROUP_LOBBY,
    targetLane,
    credentialInputLane: TELEGRAM_CHAT_LANES.MINI_APP,
    credentialRef: lane === TELEGRAM_CHAT_LANES.GROUP_LOBBY ? null : 'telegram_private_input_ref',
    reason: lane === TELEGRAM_CHAT_LANES.GROUP_LOBBY
      ? 'private_sbt_credential_required'
      : 'private_sbt_credential_ref_recorded',
  });
}

export function parseTelegramSbtCommand(text = '', {
  lane = TELEGRAM_CHAT_LANES.GROUP_LOBBY,
} = {}) {
  const parsed = splitCommandText(text);
  const command = normalizeBotCommand(parsed.command);
  const { args, argText } = parsed;
  if (!['/sbt', '/join_sbt', '/create_sbt_group'].includes(command)) {
    return sanitizeForGroup({
      ok: false,
      command,
      reason: 'unsupported_sbt_command',
    });
  }

  if (command === '/create_sbt_group') {
    const sessionSlug = safeString(args[0] || '');
    if (SBT_PRIVATE_CREDENTIAL_RE.test(sessionSlug) || SBT_PRIVATE_LINK_VALUE_RE.test(sessionSlug)) {
      return privateCredentialCommandResult({ command, commandFamily: 'create_sbt_group', lane });
    }
    if (sessionSlug && !SESSION_SLUG_RE.test(sessionSlug)) {
      return sanitizeForGroup({
        ok: false,
        command,
        commandFamily: 'create_sbt_group',
        reason: 'invalid_session_slug',
      });
    }
    return sanitizeForGroup({
      ok: true,
      command,
      commandFamily: 'create_sbt_group',
      sessionSlug: sessionSlug || null,
      targetLane: TELEGRAM_CHAT_LANES.MINI_APP,
      launch: getTelegramScreenLaunch('create_sbt_group'),
    });
  }

  const classified = classifySbtCommandTarget(argText);
  if (classified.targetKind === 'missing') {
    return sanitizeForGroup({
      ok: false,
      command,
      commandFamily: command === '/sbt' ? 'view_sbt' : 'join_sbt',
      reason: 'sbt_target_required',
    });
  }
  if (classified.targetKind === 'private_credential') {
    return privateCredentialCommandResult({
      command,
      commandFamily: command === '/sbt' ? 'view_sbt' : 'join_sbt',
      lane,
    });
  }
  return sanitizeForGroup({
    ok: true,
    command,
    commandFamily: command === '/sbt' ? 'view_sbt' : 'join_sbt',
    targetKind: classified.targetKind,
    target: classified.target,
    publicTarget: true,
    publicCommandTargetAllowed: true,
    targetLane: command === '/sbt'
      ? TELEGRAM_CHAT_LANES.GROUP_LOBBY
      : TELEGRAM_CHAT_LANES.PRIVATE_ACCOUNT,
    launch: getTelegramScreenLaunch(command === '/sbt' ? 'sbt_group_card' : 'join_public_sbt'),
  });
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
    actionId: buildOpaqueActionId(`${action}|${safeOpaqueSeedPart(questionId)}|${label}`),
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
  if (screen === 'agent_action_menu') {
    return [
      buildScreenButton(TELEGRAM_BRIDGE_ACTIONS.VIEW_AGENT_SETTINGS, 'Settings', TELEGRAM_CHAT_LANES.PRIVATE_ACCOUNT, {
        command: '/settings',
      }),
      buildScreenButton(TELEGRAM_BRIDGE_ACTIONS.VIEW_QUESTIONS, 'View Questions', TELEGRAM_CHAT_LANES.GROUP_LOBBY, {
        command: '/questions',
      }),
    ];
  }
  if (screen === 'agent_account_create') {
    return [
      buildScreenButton(TELEGRAM_BRIDGE_ACTIONS.VIEW_AGENT_SETTINGS, 'Settings', TELEGRAM_CHAT_LANES.PRIVATE_ACCOUNT, {
        command: '/settings',
      }),
      buildScreenButton(TELEGRAM_BRIDGE_ACTIONS.AGENT_ACTION_MENU, 'Actions', TELEGRAM_CHAT_LANES.PRIVATE_ACCOUNT, {
        command: '/agent',
      }),
    ];
  }
  if (screen === 'agent_settings_overview') {
    return [
      buildScreenButton(TELEGRAM_BRIDGE_ACTIONS.EDIT_AGENT_SETTINGS, 'Edit Settings', TELEGRAM_CHAT_LANES.MINI_APP),
      buildScreenButton(TELEGRAM_BRIDGE_ACTIONS.AGENT_ACTION_MENU, 'Actions', TELEGRAM_CHAT_LANES.PRIVATE_ACCOUNT, {
        command: '/agent',
      }),
    ];
  }
  if (screen === 'agent_settings_edit') {
    return [
      buildScreenButton(TELEGRAM_BRIDGE_ACTIONS.UPDATE_AGENT_SETTINGS, 'Save Settings', TELEGRAM_CHAT_LANES.MINI_APP),
    ];
  }
  if (screen === 'question_list') {
    return [
      buildScreenButton(TELEGRAM_BRIDGE_ACTIONS.VIEW_QUESTIONS, 'View Questions', TELEGRAM_CHAT_LANES.GROUP_LOBBY, {
        command: '/questions',
      }),
      buildScreenButton(TELEGRAM_BRIDGE_ACTIONS.POSE_QUESTION, 'Pose Question', TELEGRAM_CHAT_LANES.GROUP_LOBBY, {
        command: '/pose_question',
        aliases: ['/q'],
      }),
      buildScreenButton(TELEGRAM_BRIDGE_ACTIONS.GENERATE_QUESTION, 'Generate Questions', TELEGRAM_CHAT_LANES.PRIVATE_ACCOUNT, {
        command: '/generate_questions',
      }),
    ];
  }
  if (screen === 'pose_question') {
    return [
      buildScreenButton(TELEGRAM_BRIDGE_ACTIONS.POSE_QUESTION, 'Pose Question', TELEGRAM_CHAT_LANES.GROUP_LOBBY, {
        command: '/pose_question',
        aliases: ['/q'],
      }),
    ];
  }
  if (screen === 'generated_question_candidates') {
    return [
      buildScreenButton(TELEGRAM_BRIDGE_ACTIONS.SAVE_GENERATED_QUESTION, 'Save', TELEGRAM_CHAT_LANES.PRIVATE_ACCOUNT),
      buildScreenButton(TELEGRAM_BRIDGE_ACTIONS.POSE_QUESTION, 'Pose Question', TELEGRAM_CHAT_LANES.GROUP_LOBBY, {
        command: '/pose_question',
        aliases: ['/q'],
      }),
    ];
  }
  if (screen === 'account_created') {
    return [
      buildScreenButton(TELEGRAM_BRIDGE_ACTIONS.VIEW_QUESTIONS, 'View Questions'),
      buildScreenButton(TELEGRAM_BRIDGE_ACTIONS.START_ONBOARDING, 'Enter Startup Info'),
    ];
  }
  if (screen === 'my_account') {
    return [
      buildScreenButton(TELEGRAM_BRIDGE_ACTIONS.VIEW_JOINED_SBTS, 'Joined SBTs'),
      buildScreenButton(TELEGRAM_BRIDGE_ACTIONS.EXPORT_ACCOUNT, 'Export'),
      buildScreenButton(TELEGRAM_BRIDGE_ACTIONS.RESTORE_ACCOUNT, 'Restore'),
    ];
  }
  if (screen === 'joined_sbts') {
    return [
      buildScreenButton(TELEGRAM_BRIDGE_ACTIONS.MY_ACCOUNT, 'My Account'),
    ];
  }
  if (screen === 'onboarding') {
    return [
      buildScreenButton(TELEGRAM_BRIDGE_ACTIONS.START_ONBOARDING, 'Enter Startup Info'),
      buildScreenButton(TELEGRAM_BRIDGE_ACTIONS.VIEW_QUESTIONS, 'Skip'),
    ];
  }
  if (screen === 'sbt_group_card') {
    return [
      buildScreenButton(TELEGRAM_BRIDGE_ACTIONS.JOIN_SBT, 'Join SBT', TELEGRAM_CHAT_LANES.PRIVATE_ACCOUNT),
      buildScreenButton(TELEGRAM_BRIDGE_ACTIONS.VIEW_SBT_DETAILS, 'Details', TELEGRAM_CHAT_LANES.GROUP_LOBBY),
      buildScreenButton(TELEGRAM_BRIDGE_ACTIONS.MY_ACCOUNT, 'My Account', TELEGRAM_CHAT_LANES.PRIVATE_ACCOUNT),
    ];
  }
  if (screen === 'join_public_sbt') {
    return [
      buildScreenButton(TELEGRAM_BRIDGE_ACTIONS.JOIN_PUBLIC_SBT, 'Join SBT', TELEGRAM_CHAT_LANES.PRIVATE_ACCOUNT),
      buildScreenButton(TELEGRAM_BRIDGE_ACTIONS.MY_ACCOUNT, 'My Account', TELEGRAM_CHAT_LANES.PRIVATE_ACCOUNT),
    ];
  }
  if (screen === 'join_password_sbt') {
    return [
      buildScreenButton(TELEGRAM_BRIDGE_ACTIONS.JOIN_PASSWORD_SBT, 'Join SBT', TELEGRAM_CHAT_LANES.MINI_APP),
      buildScreenButton(TELEGRAM_BRIDGE_ACTIONS.MY_ACCOUNT, 'My Account', TELEGRAM_CHAT_LANES.PRIVATE_ACCOUNT),
    ];
  }
  if (screen === 'create_sbt_group') {
    return [
      buildScreenButton(TELEGRAM_BRIDGE_ACTIONS.CREATE_SBT_GROUP, 'Create SBT Group', TELEGRAM_CHAT_LANES.MINI_APP),
    ];
  }
  if (screen === 'session_join_sbt_gate') {
    return [
      buildScreenButton(TELEGRAM_BRIDGE_ACTIONS.RETRY_SESSION_JOIN, 'Retry Join Session', TELEGRAM_CHAT_LANES.PRIVATE_ACCOUNT, {
        command: '/join',
      }),
      buildScreenButton(TELEGRAM_BRIDGE_ACTIONS.MY_ACCOUNT, 'My Account', TELEGRAM_CHAT_LANES.PRIVATE_ACCOUNT),
    ];
  }
  if (screen === 'locked_private_question') {
    return [
      buildScreenButton(TELEGRAM_BRIDGE_ACTIONS.REQUEST_PRIVATE_QUESTION_DECRYPT, 'Open Privately', TELEGRAM_CHAT_LANES.PRIVATE_ACCOUNT),
    ];
  }
  if (screen === 'doc_library') {
    return [
      buildScreenButton(TELEGRAM_BRIDGE_ACTIONS.LIST_DOCS, 'Attachments'),
      buildScreenButton(TELEGRAM_BRIDGE_ACTIONS.SELECT_DOCS, 'Select Attachments'),
      buildScreenButton(TELEGRAM_BRIDGE_ACTIONS.GENERATE_QUESTION, 'Generate Questions'),
      buildScreenButton(TELEGRAM_BRIDGE_ACTIONS.USE_DOCS_AS_ANSWER_CONTEXT, 'Use as Answer Context'),
    ];
  }
  if (screen === 'generate_questions') {
    return [
      buildScreenButton(TELEGRAM_BRIDGE_ACTIONS.SELECT_DOCS, 'Select Attachments'),
      buildScreenButton(TELEGRAM_BRIDGE_ACTIONS.GENERATE_QUESTION, 'Generate Questions'),
    ];
  }
  if (screen === 'submit_response') {
    return [
      buildScreenButton(TELEGRAM_BRIDGE_ACTIONS.SUBMIT_RESPONSE, 'Submit Response'),
      buildScreenButton(TELEGRAM_BRIDGE_ACTIONS.DRAFT_RESPONSE, 'Save draft'),
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
  if (screen === 'agent_action_menu') {
    return {
      title: 'Agent Actions',
      text: 'Agent action launcher.',
    };
  }
  if (screen === 'agent_account_create') {
    return {
      title: 'Managed Account',
      text: 'Manage the Telegram-managed demo account through the canonical CE agent API.',
    };
  }
  if (screen === 'agent_settings_overview') {
    return {
      title: 'Settings',
      text: 'Agent settings overview.',
    };
  }
  if (screen === 'agent_settings_edit') {
    return {
      title: 'Edit Settings',
      text: 'Edit safe Telegram agent settings.',
    };
  }
  if (screen === 'question_list') {
    return {
      title: 'View Questions',
      text: 'Existing session questions.',
    };
  }
  if (screen === 'pose_question') {
    return {
      title: 'Pose Question',
      text: 'Choose one question to pose to the group.',
    };
  }
  if (screen === 'generated_question_candidates') {
    return {
      title: 'Generated Questions',
      text: 'Save a candidate or pose it to the group.',
    };
  }
  if (screen === 'account_created') {
    return {
      title: 'Account ready',
      text: 'Your Telegram account is ready for this session.',
    };
  }
  if (screen === 'my_account') {
    return {
      title: 'Account',
      text: 'Managed account summary.',
    };
  }
  if (screen === 'joined_sbts') {
    return {
      title: 'Joined SBTs',
      text: 'SBT groups joined by this account.',
    };
  }
  if (screen === 'onboarding') {
    return {
      title: 'Startup Info',
      text: 'Enter startup info so I can suggest answers for you.',
    };
  }
  if (screen === 'sbt_group_card') {
    return {
      title: 'SBT Group',
      text: 'Group membership card.',
    };
  }
  if (screen === 'join_public_sbt') {
    return {
      title: 'Join Public SBT',
      text: 'Join this open SBT with your managed account.',
    };
  }
  if (screen === 'join_password_sbt') {
    return {
      title: 'Join Password SBT',
      text: 'Enter the group credential in private chat or Mini App.',
    };
  }
  if (screen === 'create_sbt_group') {
    return {
      title: 'Create SBT Group',
      text: 'Create the group through the canonical CE agent API.',
    };
  }
  if (screen === 'session_join_sbt_gate') {
    return {
      title: 'Join Session',
      text: 'Required SBT groups for this session.',
    };
  }
  if (screen === 'locked_private_question') {
    return {
      title: 'Question Locked',
      text: 'Open privately with an eligible account.',
    };
  }
  if (screen === 'private_question_read') {
    return {
      title: 'Private Question',
      text: 'Private question content is shown only in private chat or Mini App.',
    };
  }
  if (screen === 'doc_library') {
    return {
      title: 'Attachments',
      text: 'Select attachments to generate questions or save them for answer context.',
      buttonLabel: 'Attachments',
    };
  }
  if (screen === 'generate_questions') {
    return {
      title: 'Generate Questions',
      text: 'Selected attachments are inputs for Generate Questions.',
    };
  }
  if (screen === 'submit_response') {
    return {
      title: 'Submit Response',
      text: 'Submit Response appears after an answer is present.',
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
      command: '/join',
      deepLink: OPAQUE_DEEP_LINK_LAUNCH,
    }),
    buildScreenButton(TELEGRAM_BRIDGE_ACTIONS.VIEW_QUESTIONS, 'View Questions', TELEGRAM_CHAT_LANES.GROUP_LOBBY, {
      command: '/questions',
      default: true,
    }),
  ];
  if (policy.allowPoseQuestion !== false) {
    buttons.push(buildScreenButton(TELEGRAM_BRIDGE_ACTIONS.POSE_QUESTION, 'Pose Question', TELEGRAM_CHAT_LANES.GROUP_LOBBY, {
      command: '/pose_question',
      aliases: ['/q'],
    }));
  }
  const policyActions = [];
  if (policy.allowAddQuestion === true) {
    policyActions.push(buildScreenButton(TELEGRAM_BRIDGE_ACTIONS.ADD_QUESTION, 'Add Question', TELEGRAM_CHAT_LANES.PRIVATE_ACCOUNT));
  }
  if (policy.allowGenerateQuestion === true || policy.allowQuestionGeneration === true) {
    policyActions.push(buildScreenButton(TELEGRAM_BRIDGE_ACTIONS.GENERATE_QUESTION, 'Generate Questions', TELEGRAM_CHAT_LANES.PRIVATE_ACCOUNT, {
      command: '/generate_questions',
    }));
  }
  return buildTelegramScreenState('group_session_card', {
    text: `Session: ${sessionLabel}`,
    sessionSlug: safeString(sessionSlug),
    sessionName: safeString(sessionName),
    buttons,
    policyActions,
    defaultAction: TELEGRAM_BRIDGE_ACTIONS.VIEW_QUESTIONS,
    createdAt,
  });
}

function normalizeQuestionVisibility(question = {}) {
  if (question.payloadUnavailable === true) return QUESTION_VISIBILITY.PAYLOAD_UNAVAILABLE;
  const raw = safeString(question.visibility || question.access || question.questionVisibility).toLowerCase();
  if ([
    QUESTION_VISIBILITY.PRIVATE,
    QUESTION_VISIBILITY.SBT_GATED,
    QUESTION_VISIBILITY.LIT_ENCRYPTED,
    QUESTION_VISIBILITY.PAYLOAD_UNAVAILABLE,
  ].includes(raw)) {
    return raw;
  }
  if (question.private === true || question.isPrivate === true) return QUESTION_VISIBILITY.PRIVATE;
  if (question.sbtGated === true || question.gated === true) return QUESTION_VISIBILITY.SBT_GATED;
  if (question.litEncrypted === true || question.encrypted === true) return QUESTION_VISIBILITY.LIT_ENCRYPTED;
  return QUESTION_VISIBILITY.PUBLIC;
}

function isGroupSafeQuestionVisible(question = {}) {
  return normalizeQuestionVisibility(question) === QUESTION_VISIBILITY.PUBLIC;
}

function normalizeQuestionSbtAddresses(question = {}) {
  const encryption = question.encryption && typeof question.encryption === 'object' && !Array.isArray(question.encryption)
    ? question.encryption
    : {};
  const gates = [
    ...(Array.isArray(encryption.gates) ? encryption.gates : []),
    ...(Array.isArray(question.gates) ? question.gates : []),
    question.gate,
    encryption.gate,
  ].filter(Boolean);
  const raw = [
    ...(Array.isArray(question.requiredSbtAddresses) ? question.requiredSbtAddresses : []),
    ...(Array.isArray(question.sbtAddresses) ? question.sbtAddresses : []),
    question.sbtAddress,
    ...(Array.isArray(encryption.sbtAddresses) ? encryption.sbtAddresses : []),
    encryption.sbtAddress,
    ...gates.flatMap((gate) => [
      ...(Array.isArray(gate?.sbtAddresses) ? gate.sbtAddresses : []),
      gate?.sbtAddress,
      gate?.address,
    ]),
  ];
  const seen = new Set();
  const out = [];
  raw.forEach((value) => {
    const text = safeString(value);
    if (!SBT_ADDRESS_RE.test(text)) return;
    const key = text.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push(text);
  });
  return out;
}

function isQuestionEncryptedForTelegram(question = {}, visibility = normalizeQuestionVisibility(question)) {
  return visibility === QUESTION_VISIBILITY.LIT_ENCRYPTED ||
    visibility === QUESTION_VISIBILITY.SBT_GATED ||
    question.encrypted === true ||
    question.litEncrypted === true ||
    Boolean(question.promptEncrypted || question.optionsEncrypted || question.tagsEncrypted);
}

function questionGateMode(question = {}) {
  const encryption = question.encryption && typeof question.encryption === 'object' && !Array.isArray(question.encryption)
    ? question.encryption
    : {};
  const raw = safeString(question.gateMode || encryption.mode || question.mode).toLowerCase();
  return raw === 'all' ? 'all' : (raw === 'any' ? 'any' : '');
}

function summarizeQuestionForList(question = {}, index = 0) {
  const questionId = safeString(question.questionId || question.id);
  const stableQuestionNumber = Math.floor(Number(question.stableQuestionNumber || question.questionNumber));
  const visibility = normalizeQuestionVisibility(question);
  const payloadUnavailable = question.payloadUnavailable === true || visibility === QUESTION_VISIBILITY.PAYLOAD_UNAVAILABLE;
  const visible = visibility === QUESTION_VISIBILITY.PUBLIC && !payloadUnavailable;
  const encrypted = isQuestionEncryptedForTelegram(question, visibility);
  const requiredSbtAddresses = normalizeQuestionSbtAddresses(question);
  return sanitizeForGroup({
    type: 'telegram_question_list_item',
    displayIndex: index + 1,
    stableQuestionNumber: Number.isInteger(stableQuestionNumber) && stableQuestionNumber > 0 ? stableQuestionNumber : null,
    questionId,
    questionType: normalizeQuestionType(question.questionType || question.type),
    title: payloadUnavailable
      ? 'Question unavailable'
      : visible
      ? safeString(question.title || question.questionText || question.prompt)
      : encrypted ? 'Encrypted question' : 'Locked question',
    visibility,
    locked: !visible && !payloadUnavailable,
    encrypted,
    requiredSbtAddresses,
    gateMode: questionGateMode(question),
    payloadUnavailable,
    unavailableInGroup: !visible && !payloadUnavailable,
    retryable: payloadUnavailable,
    source: safeString(question.source || 'existing_session_question'),
    poseActionId: buildOpaqueActionId(`pose_question|${safeOpaqueSeedPart(questionId)}|${index}`),
  });
}

function groupSafeQuestionForPose(question = {}) {
  const visibility = normalizeQuestionVisibility(question);
  const payloadUnavailable = question.payloadUnavailable === true || visibility === QUESTION_VISIBILITY.PAYLOAD_UNAVAILABLE;
  if (payloadUnavailable) {
    return sanitizeForGroup({
      type: 'telegram_group_posed_question',
      questionId: safeString(question.questionId || question.id),
      questionType: 'unavailable',
      visibility,
      locked: false,
      payloadUnavailable: true,
      retryable: true,
      questionText: null,
      answerLabels: [],
      status: 'payload_unavailable',
    });
  }
  const visible = visibility === QUESTION_VISIBILITY.PUBLIC;
  const encrypted = isQuestionEncryptedForTelegram(question, visibility);
  const requiredSbtAddresses = normalizeQuestionSbtAddresses(question);
  return sanitizeForGroup({
    type: 'telegram_group_posed_question',
    questionId: safeString(question.questionId || question.id),
    questionType: normalizeQuestionType(question.questionType || question.type),
    visibility,
    locked: !visible,
    encrypted,
    requiredSbtAddresses,
    gateMode: questionGateMode(question),
    questionText: visible ? safeString(question.questionText || question.prompt || question.title) : null,
    answerLabels: visible ? normalizeOptions(question) : [],
    status: visible ? 'posed' : (encrypted ? 'encrypted_unavailable_in_group' : 'locked_unavailable_in_group'),
  });
}

function normalizeSbtSummary(sbt = {}) {
  return sanitizeForGroup({
    type: 'telegram_sbt_group_summary',
    sbtId: safeString(sbt.sbtId || sbt.id || sbt.address),
    sbtAddress: safeString(sbt.sbtAddress || sbt.address) || null,
    groupId: safeString(sbt.groupId || sbt.sbtGroupId || sbt.groupSlug || sbt.slug) || null,
    shareLink: safeString(sbt.shareLink || sbt.link || sbt.url) || null,
    name: safeString(sbt.name || sbt.title) || 'SBT Group',
    description: safeString(sbt.description || sbt.summary) || null,
    image: safeString(sbt.image || sbt.imageUrl) || null,
    visibility: safeString(sbt.visibility || 'public'),
    joinMode: safeString(sbt.joinMode || sbt.mode || 'public'),
    sessionSlug: safeString(sbt.sessionSlug || sbt.session),
  });
}

function sbtPublicTarget(summary = {}) {
  return safeString(summary.sbtAddress || summary.groupId || summary.shareLink || summary.sbtId);
}

function buildSbtGateAction(group = {}, action, label, targetLane = TELEGRAM_CHAT_LANES.PRIVATE_ACCOUNT, extra = {}) {
  return sanitizeForGroup({
    actionId: buildOpaqueActionId(`sbt_gate|${action}|${group.sbtId || group.sbtAddress || group.groupId || group.shareLink}|${group.joinMode}`),
    action,
    label,
    targetLane,
    callback: OPAQUE_CALLBACK_LAUNCH,
    ...extra,
  });
}

function buildRequiredSbtGateGroup(group = {}, {
  sessionSlug = '',
  publicJoinEligible = true,
} = {}) {
  const summary = normalizeSbtSummary(group);
  const joinMode = safeString(group.joinMode || summary.joinMode || 'public').toLowerCase();
  const joined = group.joined === true;
  const publicTarget = sbtPublicTarget(summary);
  const publicOpen = ['public', 'open'].includes(joinMode);
  const credentialType = ['password', 'invite'].includes(joinMode) ? joinMode : null;
  const requiresFullCeAccount = group.requiresFullCeAccount === true
    || ['linked-wallet', 'wallet', 'wallet-proof', 'passkey', 'non-public', 'private'].includes(joinMode);
  let action = null;

  if (joined) {
    action = buildSbtGateAction(group, TELEGRAM_BRIDGE_ACTIONS.RETRY_SESSION_JOIN, 'Retry Join Session', TELEGRAM_CHAT_LANES.PRIVATE_ACCOUNT, {
      command: '/join',
    });
  } else if (publicOpen && publicJoinEligible === true) {
    action = buildSbtGateAction(group, TELEGRAM_BRIDGE_ACTIONS.JOIN_PUBLIC_SBT, 'Join SBT', TELEGRAM_CHAT_LANES.PRIVATE_ACCOUNT, {
      command: '/join_sbt <sbt-address-or-invite-code-or-link>',
      publicCommandTarget: publicTarget || null,
      publicCommandTargetAllowed: Boolean(publicTarget),
      privateEligibilityCheckLane: TELEGRAM_CHAT_LANES.PRIVATE_ACCOUNT,
      canonicalApiRequest: canonicalAgentRequest({
        path: '/api/agent/sbt-groups/claim-request',
        actionId: 'agent.sbt_group.claim_request',
        body: {
          session: safeString(sessionSlug || group.sessionSlug || summary.sessionSlug),
          sbtAddress: summary.sbtAddress,
          groupId: summary.groupId,
          shareLink: summary.shareLink,
          joinMode,
        },
      }),
    });
  } else if (credentialType) {
    action = buildSbtGateAction(group, TELEGRAM_BRIDGE_ACTIONS.JOIN_PASSWORD_SBT, 'Join SBT', TELEGRAM_CHAT_LANES.MINI_APP, {
      command: '/join_sbt <sbt-address-or-invite-code-or-link>',
      credentialType,
      credentialRequired: true,
      credentialInputLane: TELEGRAM_CHAT_LANES.MINI_APP,
      credentialRef: 'telegram_private_input_ref',
      canonicalApiRequest: canonicalAgentRequest({
        path: '/api/agent/sbt-groups/claim-request',
        actionId: 'agent.sbt_group.claim_request',
        body: {
          session: safeString(sessionSlug || group.sessionSlug || summary.sessionSlug),
          sbtAddress: summary.sbtAddress,
          groupId: summary.groupId,
          shareLink: summary.shareLink,
          joinMode,
          credentialRef: 'telegram_private_input_ref',
        },
      }),
    });
  } else if (requiresFullCeAccount || publicOpen !== true) {
    action = buildSbtGateAction(group, TELEGRAM_BRIDGE_ACTIONS.LINK_FULL_CE_ACCOUNT, 'Link CE Account', TELEGRAM_CHAT_LANES.MINI_APP, {
      reason: 'full_ce_account_required_for_sbt_eligibility',
      accountLinkApiRequest: canonicalAgentRequest({
        path: '/api/agent/accounts/link-request',
        actionId: 'agent.account.link_request',
        body: {
          session: safeString(sessionSlug || group.sessionSlug || summary.sessionSlug),
          sbtAddress: summary.sbtAddress,
          groupId: summary.groupId,
          shareLink: summary.shareLink,
          joinMode,
        },
      }),
    });
  }

  return sanitizeForGroup({
    ...summary,
    required: true,
    joined,
    joinMode,
    credentialRequired: Boolean(credentialType),
    credentialType,
    requiresFullCeAccount,
    privateHolderMetadataIncluded: false,
    action,
  });
}

function normalizeJoinedSbtSummary(sbt = {}) {
  return sanitizeForGroup({
    type: 'telegram_joined_sbt_summary',
    sbtId: safeString(sbt.sbtId || sbt.id || sbt.address),
    sbtAddress: safeString(sbt.sbtAddress || sbt.address) || null,
    name: safeString(sbt.name || sbt.title) || 'SBT Group',
    joinedAt: sbt.joinedAt || null,
    sessionSlug: safeString(sbt.sessionSlug || sbt.session),
  });
}

function normalizeJoinedSessionSummary(session = {}) {
  return sanitizeForGroup({
    type: 'telegram_joined_session_summary',
    sessionSlug: safeString(session.sessionSlug || session.slug || session),
    sessionName: safeString(session.sessionName || session.name || session),
    joinedAt: session.joinedAt || null,
  });
}

function canonicalAgentRequest(input = {}) {
  return buildCanonicalAgentRequest(input);
}

function normalizeDraftStyle(value = '') {
  const normalized = safeString(value).toLowerCase();
  return ['concise', 'balanced', 'detailed'].includes(normalized) ? normalized : 'balanced';
}

function normalizeBoolean(value, fallback = false) {
  if (value === true || value === false) return value;
  const normalized = safeString(value).toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return fallback;
}

export function buildTelegramAgentActionMenuState({
  lane = TELEGRAM_CHAT_LANES.PRIVATE_ACCOUNT,
  sessionSlug = '',
  createdAt = null,
} = {}) {
  const safeLane = safeString(lane) || TELEGRAM_CHAT_LANES.PRIVATE_ACCOUNT;
  const capabilities = listAgentApiCapabilities({
    lane: safeLane,
    includeGroupUnsafe: safeLane !== TELEGRAM_CHAT_LANES.GROUP_LOBBY,
  });
  return buildTelegramScreenState('agent_action_menu', {
    lane: safeLane,
    sessionSlug: safeString(sessionSlug),
    catalog: describeTelegramAgentApiCatalog({
      lane: safeLane,
      includeGroupUnsafe: safeLane !== TELEGRAM_CHAT_LANES.GROUP_LOBBY,
    }),
    capabilities: capabilities.map((capability) => sanitizeForGroup({
      id: capability.id,
      label: capability.label,
      category: capability.category,
      method: capability.method,
      path: capability.path,
      handoffStatus: capability.handoffStatus,
      requiredFields: capability.requiredFields,
      safeTelegramLanes: capability.safeTelegramLanes,
      groupSafe: capability.groupSafe === true,
      botCommands: capability.botCommands,
      miniAppRoutes: capability.miniAppRoutes,
    })),
    canonicalApiRequest: canonicalAgentRequest({
      capabilityId: 'agent.actions.list',
      body: {
        lane: safeLane,
        session: safeString(sessionSlug),
      },
    }),
    createdAt,
  });
}

export function buildTelegramAgentAccountCreateState({
  account = {},
  sessionSlug = '',
  requestId = '',
  idempotencyKey = '',
  createdAt = null,
} = {}) {
  return buildTelegramScreenState('agent_account_create', {
    managedAddress: safeString(account.accountAddress || account.address) || null,
    accountMode: safeString(account.accountMode || account.mode || 'managed_telegram_demo'),
    sessionSlug: safeString(sessionSlug),
    requestId: safeString(requestId) || null,
    canonicalApiRequest: canonicalAgentRequest({
      capabilityId: 'agent.account.create',
      body: {
        telegramPrincipalId: 'telegram_principal_id',
        accountMode: safeString(account.accountMode || account.mode || 'managed_telegram_demo'),
        session: safeString(sessionSlug),
        deploymentRef: 'agent_bridge_deployment_ref',
        idempotencyKey: safeString(idempotencyKey || requestId),
      },
    }),
    createdAt,
  });
}

export function buildTelegramAgentSettingsOverviewState({
  settings = {},
  sessionSlug = '',
  createdAt = null,
} = {}) {
  const normalizedSettings = sanitizeForGroup({
    draftStyle: normalizeDraftStyle(settings.draftStyle),
    showUnansweredFirst: normalizeBoolean(settings.showUnansweredFirst, true),
    showAgentResponses: normalizeBoolean(settings.showAgentResponses, true),
    agentAutoApplyQuestionVotes: normalizeBoolean(settings.agentAutoApplyQuestionVotes, false),
    topicPreferences: Array.isArray(settings.topicPreferences) ? settings.topicPreferences : [],
    demographicLinkOptIn: normalizeBoolean(settings.demographicLinkOptIn, false),
    attendanceLinkOptIn: normalizeBoolean(settings.attendanceLinkOptIn, false),
    draftDivergenceOptIn: normalizeBoolean(settings.draftDivergenceOptIn, false),
  });
  return buildTelegramScreenState('agent_settings_overview', {
    sessionSlug: safeString(sessionSlug),
    settings: normalizedSettings,
    editableFields: [
      'draftStyle',
      'showUnansweredFirst',
      'showAgentResponses',
      'agentAutoApplyQuestionVotes',
      'topicPreferences',
      'demographicLinkOptIn',
      'attendanceLinkOptIn',
      'draftDivergenceOptIn',
    ],
    canonicalApiRequest: canonicalAgentRequest({
      capabilityId: 'agent.settings.read',
      body: {
        agentAccountRef: 'telegram_managed_agent_ref',
        session: safeString(sessionSlug),
      },
    }),
    createdAt,
  });
}

export function buildTelegramAgentSettingsEditState({
  settings = {},
  sessionSlug = '',
  createdAt = null,
} = {}) {
  const current = sanitizeForGroup({
    draftStyle: normalizeDraftStyle(settings.draftStyle),
    showUnansweredFirst: normalizeBoolean(settings.showUnansweredFirst, true),
    showAgentResponses: normalizeBoolean(settings.showAgentResponses, true),
    agentAutoApplyQuestionVotes: normalizeBoolean(settings.agentAutoApplyQuestionVotes, false),
    topicPreferences: Array.isArray(settings.topicPreferences) ? settings.topicPreferences : [],
    demographicLinkOptIn: normalizeBoolean(settings.demographicLinkOptIn, false),
    attendanceLinkOptIn: normalizeBoolean(settings.attendanceLinkOptIn, false),
    draftDivergenceOptIn: normalizeBoolean(settings.draftDivergenceOptIn, false),
  });
  return buildTelegramScreenState('agent_settings_edit', {
    preferredLane: TELEGRAM_CHAT_LANES.MINI_APP,
    sessionSlug: safeString(sessionSlug),
    fields: [{
      field: 'draftStyle',
      label: 'Draft style',
      input: 'select',
      options: ['concise', 'balanced', 'detailed'],
      value: current.draftStyle,
  }, {
    field: 'showUnansweredFirst',
    label: 'Show un-answered questions first',
    input: 'toggle',
    value: current.showUnansweredFirst,
  }, {
    field: 'showAgentResponses',
    label: 'Show agent responses',
    input: 'toggle',
    value: current.showAgentResponses,
  }, {
    field: 'agentAutoApplyQuestionVotes',
    label: 'Allow agents to auto-apply question votes',
    input: 'toggle',
    value: current.agentAutoApplyQuestionVotes,
  }, {
    field: 'topicPreferences',
    label: 'Topics',
    input: 'textarea',
    value: current.topicPreferences,
  }, {
    field: 'demographicLinkOptIn',
    label: 'Link demographics',
    input: 'toggle',
    value: current.demographicLinkOptIn,
  }, {
    field: 'attendanceLinkOptIn',
    label: 'Share attendance buckets',
    input: 'toggle',
    value: current.attendanceLinkOptIn,
  }, {
    field: 'draftDivergenceOptIn',
    label: 'Draft edit research',
    input: 'toggle',
    value: current.draftDivergenceOptIn,
  }],
    canonicalApiRequest: canonicalAgentRequest({
      capabilityId: 'agent.settings.update',
      body: {
        agentAccountRef: 'telegram_managed_agent_ref',
        settingsPatchRef: 'telegram_settings_patch_ref',
        settingsPatchSummary: current,
        session: safeString(sessionSlug),
        idempotencyKey: 'provided_on_submit',
      },
    }),
    createdAt,
  });
}

export function buildTelegramQuestionListState({
  sessionSlug = '',
  questions = [],
  createdAt = null,
} = {}) {
  const items = (Array.isArray(questions) ? questions : []).map(summarizeQuestionForList);
  return buildTelegramScreenState('question_list', {
    sessionSlug: safeString(sessionSlug),
    count: items.length,
    source: 'canonical_agent_questions',
    canonicalApiRequest: canonicalAgentRequest({
      method: 'GET',
      path: '/api/agent/questions',
      actionId: 'agent.read.questions',
      status: 'implemented',
      body: {
        session: safeString(sessionSlug),
      },
    }),
    questions: items,
    createdAt,
  });
}

export function createTelegramPoseQuestionAction({
  sessionSlug = '',
  question = {},
  source = 'existing_session_question',
  createdAt = null,
} = {}) {
  const questionId = safeString(question.questionId || question.id);
  return sanitizeForGroup({
    type: 'telegram_pose_question_action',
    actionId: buildOpaqueActionId(`pose_question|${sessionSlug}|${safeOpaqueSeedPart(questionId)}|${source}`),
    action: TELEGRAM_BRIDGE_ACTIONS.POSE_QUESTION,
    label: 'Pose Question',
    command: '/pose_question',
    aliases: ['/q'],
    deprecatedAliases: ['/drop_question'],
    callback: POSE_QUESTION_CALLBACK_LAUNCH,
    targetLane: TELEGRAM_CHAT_LANES.GROUP_LOBBY,
    sessionSlug: safeString(sessionSlug),
    questionId,
    source: safeString(source),
    createdAt,
  });
}

export function buildTelegramPoseQuestionState({
  sessionSlug = '',
  question = {},
  source = 'existing_session_question',
  createdAt = null,
} = {}) {
  const action = createTelegramPoseQuestionAction({ sessionSlug, question, source, createdAt });
  const groupQuestion = groupSafeQuestionForPose(question);
  return buildTelegramScreenState('pose_question', {
    sessionSlug: safeString(sessionSlug),
    questionId: groupQuestion.questionId,
    source,
    action,
    groupSafeOutput: groupQuestion,
    card: groupQuestion.locked || groupQuestion.payloadUnavailable ? null : buildTelegramQuestionCard(question),
    status: groupQuestion.status,
    createdAt,
  });
}

export function buildTelegramGeneratedQuestionCandidatesState({
  sessionSlug = '',
  candidates = [],
  selectedDocIds = [],
  createdAt = null,
} = {}) {
  const normalizedCandidates = (Array.isArray(candidates) ? candidates : []).map((candidate, index) => {
    const question = {
      ...candidate,
      source: 'generated_candidate',
      questionId: safeString(candidate.questionId || candidate.candidateId || `generated-${index + 1}`),
    };
    return {
      ...summarizeQuestionForList(question, index),
      saveActionId: buildOpaqueActionId(`save_generated_question|${sessionSlug}|${safeOpaqueSeedPart(question.questionId)}`),
      poseAction: createTelegramPoseQuestionAction({
        sessionSlug,
        question,
        source: 'generated_candidate',
        createdAt,
      }),
    };
  });
  return buildTelegramScreenState('generated_question_candidates', {
    sessionSlug: safeString(sessionSlug),
    selectedDocIds: (Array.isArray(selectedDocIds) ? selectedDocIds : []).map(safeString).filter(Boolean),
    candidates: normalizedCandidates,
    count: normalizedCandidates.length,
    splitFromSubmitResponse: true,
    createdAt,
  });
}

export function buildTelegramSubmitResponseState({
  sessionSlug = '',
  questionId = '',
  answer = null,
  createdAt = null,
} = {}) {
  const hasAnswer = answer != null && safeString(answer.answerLabel || answer.answer || answer.value || answer).length > 0;
  if (!hasAnswer) {
    return buildTelegramScreenState('submit_response', {
      sessionSlug: safeString(sessionSlug),
      questionId: safeString(questionId),
      status: 'answer_required',
      submitAvailable: false,
      buttons: [],
      createdAt,
    });
  }
  return buildTelegramScreenState('submit_response', {
    sessionSlug: safeString(sessionSlug),
    questionId: safeString(questionId),
    status: 'ready_to_submit',
    submitAvailable: true,
    answerRef: {
      present: true,
      contentHash: safeString(answer.contentHash || answer.hash) || null,
    },
    createdAt,
  });
}

export function buildTelegramSbtGroupCardState({
  sbt = {},
  sessionSlug = '',
  createdAt = null,
} = {}) {
  const summary = normalizeSbtSummary({ ...sbt, sessionSlug: sessionSlug || sbt.sessionSlug });
  return buildTelegramScreenState('sbt_group_card', {
    sbt: summary,
    sessionSlug: safeString(sessionSlug || summary.sessionSlug),
    privateHolderMetadataIncluded: false,
    createdAt,
  });
}

export function buildTelegramSessionSbtGateJoinState({
  session = {},
  joinedSbtIds = [],
  publicJoinEligible = true,
  createdAt = null,
} = {}) {
  const evaluation = evaluateSessionSbtGateJoin(session, { joinedSbtIds });
  const sessionSlug = safeString(session.sessionSlug || session.slug);
  const requiredSbtGroups = evaluation.requiredSbtGroups.map((group) => buildRequiredSbtGateGroup(group, {
    sessionSlug,
    publicJoinEligible,
  }));
  const retryAction = evaluation.allSatisfied === true
    ? buildSbtGateAction({ sbtId: sessionSlug || 'session', joinMode: 'retry' }, TELEGRAM_BRIDGE_ACTIONS.RETRY_SESSION_JOIN, 'Retry Join Session', TELEGRAM_CHAT_LANES.PRIVATE_ACCOUNT, {
      command: '/join',
      deepLink: OPAQUE_DEEP_LINK_LAUNCH,
    })
    : null;
  return buildTelegramScreenState('session_join_sbt_gate', {
    sessionSlug,
    sessionName: safeString(session.sessionName || session.name),
    status: evaluation.status,
    joinAvailable: evaluation.allSatisfied === true,
    allRequiredSbtSatisfied: evaluation.allSatisfied === true,
    requiredSbtGroups,
    nextStep: evaluation.nextStep,
    retryAction,
    groupSafe: true,
    createdAt,
  });
}

export function buildTelegramJoinPublicSbtState({
  sbt = {},
  session = {},
  account = {},
  createdAt = null,
} = {}) {
  const summary = normalizeSbtSummary(sbt);
  const policy = evaluateSbtJoinPolicy(session, { mode: 'public' });
  return buildTelegramScreenState('join_public_sbt', {
    sbt: summary,
    managedAddress: safeString(account.accountAddress || account.address) || null,
    joinPolicy: {
      ok: policy.ok === true,
      reason: safeString(policy.reason),
      credentialRequired: policy.requiresPassword === true,
    },
    joinAvailable: policy.ok === true && policy.requiresPassword !== true,
    canonicalApiRequest: policy.ok ? canonicalAgentRequest({
      path: '/api/agent/sbt-groups/claim-request',
      actionId: 'agent.sbt_group.claim_request',
      body: {
        session: safeString(summary.sessionSlug || session.sessionSlug || session.slug),
        sbtAddress: summary.sbtAddress,
        accountAddress: safeString(account.accountAddress || account.address) || null,
        joinMode: 'public',
      },
    }) : null,
    createdAt,
  });
}

export function buildTelegramJoinPasswordSbtState({
  sbt = {},
  session = {},
  account = {},
  credentialEntered = false,
  createdAt = null,
} = {}) {
  const summary = normalizeSbtSummary({ ...sbt, joinMode: 'password' });
  const policy = evaluateSbtJoinPolicy(session, {
    mode: 'password',
    password: credentialEntered ? 'provided-by-private-input' : '',
  });
  return buildTelegramScreenState('join_password_sbt', {
    sbt: summary,
    managedAddress: safeString(account.accountAddress || account.address) || null,
    credentialRequired: true,
    credentialInputLane: TELEGRAM_CHAT_LANES.MINI_APP,
    credentialEntered: credentialEntered === true,
    joinPolicy: {
      ok: policy.ok === true,
      reason: safeString(policy.reason),
      credentialRequired: true,
    },
    joinAvailable: policy.ok === true,
    canonicalApiRequest: credentialEntered ? canonicalAgentRequest({
      path: '/api/agent/sbt-groups/claim-request',
      actionId: 'agent.sbt_group.claim_request',
      body: {
        session: safeString(summary.sessionSlug || session.sessionSlug || session.slug),
        sbtAddress: summary.sbtAddress,
        accountAddress: safeString(account.accountAddress || account.address) || null,
        joinMode: 'password',
        credentialRef: 'telegram_private_input_ref',
      },
    }) : null,
    createdAt,
  });
}

export function buildTelegramCreateSbtGroupState({
  sessionSlug = '',
  fields = {},
  createdAt = null,
} = {}) {
  const normalizedFields = sanitizeForGroup({
    name: safeString(fields.name),
    description: safeString(fields.description),
    image: safeString(fields.image || fields.imageUrl),
    visibility: safeString(fields.visibility || 'public'),
    joinMode: safeString(fields.joinMode || 'public'),
    credentialConfigured: fields.credentialConfigured === true || fields.hasCredential === true,
    sessionAssociation: safeString(fields.sessionAssociation || fields.sessionSlug || sessionSlug),
  });
  return buildTelegramScreenState('create_sbt_group', {
    preferredLane: TELEGRAM_CHAT_LANES.MINI_APP,
    fields: normalizedFields,
    canonicalApiRequest: canonicalAgentRequest({
      path: '/api/agent/sbt-groups/create-request',
      actionId: 'agent.sbt_group.create_request',
      body: {
        ...normalizedFields,
        session: safeString(sessionSlug || normalizedFields.sessionAssociation),
      },
    }),
    contractOnlyPlaceholder: true,
    createdAt,
  });
}

export function buildTelegramJoinedSbtsState({
  account = {},
  joinedSbts = [],
  createdAt = null,
} = {}) {
  return buildTelegramScreenState('joined_sbts', {
    managedAddress: safeString(account.accountAddress || account.address) || null,
    joinedSbts: (Array.isArray(joinedSbts) ? joinedSbts : []).map(normalizeJoinedSbtSummary),
    count: Array.isArray(joinedSbts) ? joinedSbts.length : 0,
    createdAt,
  });
}

export function buildTelegramMyAccountState({
  account = {},
  joinedSessions = [],
  joinedSbts = [],
  createdAt = null,
} = {}) {
  return buildTelegramScreenState('my_account', {
    managedAddress: safeString(account.accountAddress || account.address) || null,
    accountMode: safeString(account.accountMode || account.mode || 'managed_telegram_demo'),
    joinedSessions: (Array.isArray(joinedSessions) ? joinedSessions : []).map(normalizeJoinedSessionSummary),
    joinedSbts: (Array.isArray(joinedSbts) ? joinedSbts : []).map(normalizeJoinedSbtSummary),
    exportRestoreControls: {
      export: TELEGRAM_BRIDGE_ACTIONS.EXPORT_ACCOUNT,
      restore: TELEGRAM_BRIDGE_ACTIONS.RESTORE_ACCOUNT,
      lane: TELEGRAM_CHAT_LANES.PRIVATE_ACCOUNT,
    },
    createdAt,
  });
}

export function buildTelegramQuestionAccessState({
  sessionSlug = '',
  question = {},
  eligible = false,
  createdAt = null,
} = {}) {
  if (isGroupSafeQuestionVisible(question)) {
    return buildTelegramPoseQuestionState({
      sessionSlug,
      question,
      source: safeString(question.source || 'existing_session_question'),
      createdAt,
    });
  }
  const visibility = normalizeQuestionVisibility(question);
  return buildTelegramScreenState('locked_private_question', {
    sessionSlug: safeString(sessionSlug),
    questionId: safeString(question.questionId || question.id),
    visibility,
    locked: true,
    groupSafeOutput: groupSafeQuestionForPose(question),
    privateAvailable: eligible === true,
    status: eligible === true ? 'private_unlock_available' : 'locked_unavailable',
    createdAt,
  });
}

export function createTelegramPrivateQuestionDecryptRequest({
  sessionSlug = '',
  question = {},
  account = {},
  eligible = false,
  createdAt = null,
} = {}) {
  const questionId = safeString(question.questionId || question.id);
  if (eligible !== true) {
    return sanitizeForGroup({
      ok: false,
      status: 'locked_unavailable',
      reason: 'account_not_eligible',
      sessionSlug: safeString(sessionSlug),
      questionId,
      createdAt,
    });
  }
  return sanitizeForGroup({
    ok: true,
    type: 'telegram_private_question_decrypt_request',
    status: 'contract_only_request',
    requestId: buildOpaqueActionId(`decrypt_request|${sessionSlug}|${safeOpaqueSeedPart(questionId)}|${account.accountId || account.accountAddress || ''}`),
    sessionSlug: safeString(sessionSlug),
    questionId,
    accountAddress: safeString(account.accountAddress || account.address) || null,
    targetLane: TELEGRAM_CHAT_LANES.PRIVATE_ACCOUNT,
    canonicalApiRequest: canonicalAgentRequest({
      path: '/api/agent/decrypt/request',
      actionId: 'agent.decrypt.request',
      status: 'deferred_contract_only',
      body: {
        session: safeString(sessionSlug),
        questionId,
        accountAddress: safeString(account.accountAddress || account.address) || null,
        resourceType: 'private_question',
      },
    }),
    decryptAuthority: 'canonical_ce_agent_session_api',
    litAuthority: 'session_worker_lit_optional_for_lit_encrypted_payloads',
    telegramDecryptImplemented: false,
    createdAt,
  });
}

export function buildTelegramPrivateQuestionReadState({
  sessionSlug = '',
  question = {},
  decrypted = {},
  lane = TELEGRAM_CHAT_LANES.PRIVATE_ACCOUNT,
  eligible = false,
  createdAt = null,
} = {}) {
  const targetLane = lane === TELEGRAM_CHAT_LANES.MINI_APP ? TELEGRAM_CHAT_LANES.MINI_APP : TELEGRAM_CHAT_LANES.PRIVATE_ACCOUNT;
  if (eligible !== true) {
    return buildTelegramQuestionAccessState({ sessionSlug, question, eligible: false, createdAt });
  }
  return buildTelegramScreenState('private_question_read', {
    sessionSlug: safeString(sessionSlug),
    questionId: safeString(question.questionId || question.id),
    targetLane,
    visibility: normalizeQuestionVisibility(question),
    decryptedPrompt: safeString(decrypted.prompt || decrypted.questionText),
    decryptedContext: safeString(decrypted.context),
    groupSafe: false,
    createdAt,
  });
}

export function buildSessionStorageAccessContract({
  sessionSlug = '',
  storageProfile = SESSION_STORAGE_PROFILES.ARWEAVE,
  resource = 'docs',
  gate = {},
  payloadEncrypted = false,
  createdAt = null,
} = {}) {
  const profile = safeString(storageProfile).toLowerCase() === SESSION_STORAGE_PROFILES.CLOUDFLARE
    ? SESSION_STORAGE_PROFILES.CLOUDFLARE
    : SESSION_STORAGE_PROFILES.ARWEAVE;
  return sanitizeForGroup({
    type: 'session_storage_access_contract',
    sessionSlug: safeString(sessionSlug),
    storageProfile: profile,
    defaultProfile: SESSION_STORAGE_PROFILES.ARWEAVE,
    selectedInSessionConfig: true,
    telegramSelectedStorage: false,
    resource: safeString(resource),
    gateMode: safeString(gate.mode || 'none'),
    sbtGated: Array.isArray(gate.sbtAddresses) && gate.sbtAddresses.length > 0,
    litRequired: payloadEncrypted === true,
    canonicalApiRequest: canonicalAgentRequest({
      method: 'POST',
      path: profile === SESSION_STORAGE_PROFILES.CLOUDFLARE
        ? '/api/agent/session-storage/access-request'
        : '/api/agent/decrypt/request',
      actionId: profile === SESSION_STORAGE_PROFILES.CLOUDFLARE
        ? 'agent.session_storage.access_request'
        : 'agent.decrypt.request',
      status: 'planned_contract_only',
      body: {
        session: safeString(sessionSlug),
        storageProfile: profile,
        resource: safeString(resource),
        payloadEncrypted: payloadEncrypted === true,
      },
    }),
    exposesCloudflareCredential: false,
    exposesBucketName: false,
    exposesRawStoragePath: false,
    exposesLongLivedUrl: false,
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
      baseControl(TELEGRAM_BRIDGE_ACTIONS.DRAFT_RESPONSE, 'Disagree', questionId, TELEGRAM_CHAT_LANES.PRIVATE_ACCOUNT, { controlType: 'agree_unsure_disagree', value: 'disagree', selectionMode: 'single' }),
      baseControl(TELEGRAM_BRIDGE_ACTIONS.DRAFT_RESPONSE, 'Unsure', questionId, TELEGRAM_CHAT_LANES.PRIVATE_ACCOUNT, { controlType: 'agree_unsure_disagree', value: 'unsure', selectionMode: 'single' }),
    );
  } else if (questionType === QUESTION_TYPES.RATING) {
    const scale = normalizeTelegramRatingScale(question);
    for (const value of ratingButtonValuesForScale(scale)) {
      controls.push(baseControl(TELEGRAM_BRIDGE_ACTIONS.DRAFT_RESPONSE, String(value), questionId, TELEGRAM_CHAT_LANES.PRIVATE_ACCOUNT, {
        controlType: 'rating_button',
        value,
        min: scale.min,
        max: scale.max,
        step: scale.step,
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

export function buildTelegramQuestionAnswerSchema(question = {}) {
  const questionType = normalizeQuestionType(question.questionType || question.type);
  if (questionType === QUESTION_TYPES.AGREE_UNSURE_DISAGREE) {
    const values = buildTelegramQuestionControls(question, { microphoneSupported: false })
      .filter((control) => control.controlType === 'agree_unsure_disagree')
      .map((control) => control.value)
      .filter((value, index, list) => value !== undefined && value !== null && list.indexOf(value) === index);
    return {
      questionType: 'binary',
      answerSchema: { kind: 'choice', values },
    };
  }
  if (questionType === QUESTION_TYPES.RATING) {
    const scale = normalizeTelegramRatingScale(question);
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
  if (questionType === QUESTION_TYPES.MULTICHOICE) {
    const selectionMode = normalizeChoiceSelectionMode(question);
    const options = buildTelegramQuestionControls(question, { microphoneSupported: false })
      .filter((control) => ['single_select', 'multi_select_toggle'].includes(control.controlType))
      .map((control) => safeString(control.value || control.label))
      .filter((value, index, list) => value && list.indexOf(value) === index);
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

export function buildTelegramQuestionCard(question = {}, options = {}) {
  const questionId = safeString(question.questionId || question.id);
  const questionType = normalizeQuestionType(question.questionType || question.type);
  const docsContextAvailable = options.docsExist === true || options.docsRelevant === true;
  return sanitizeForGroup({
    type: 'telegram_question_card',
    questionId,
    questionType,
    selectionMode: questionType === QUESTION_TYPES.MULTICHOICE ? normalizeChoiceSelectionMode(question) : null,
    ratingScale: questionType === QUESTION_TYPES.RATING ? normalizeTelegramRatingScale(question) : null,
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
    if (JSON.stringify(ratingValues) !== JSON.stringify(ratingButtonValuesForScale(card.ratingScale || {}))) {
      return { ok: false, reason: 'rating_scale_must_match_card_scale' };
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
