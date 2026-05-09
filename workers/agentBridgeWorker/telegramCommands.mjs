import {
  ACCOUNT_MODES,
  AGENT_BRIDGE_EVENT_TYPES,
  RISK_CEILINGS,
  TELEGRAM_BRIDGE_ACTIONS,
  TELEGRAM_CHAT_LANES,
} from './constants.mjs';
import { listDocumentsForSession, summarizeDocumentForGroup } from './docLibrary.mjs';
import { deriveManagedDemoAccount } from './managedAccounts.mjs';
import {
  createTelegramCallbackAction,
  createTelegramStartAction,
  parseOpaqueActionId,
} from './opaqueActions.mjs';
import {
  buildTelegramGroupSessionCardState,
  buildTelegramMyAccountState,
  buildTelegramPoseQuestionState,
  buildTelegramQuestionListState,
} from './questionUi.mjs';
import { assertNoSecretShape } from './redaction.mjs';
import { normalizeSessionPolicy, resolveSessionInvocation } from './sessionPolicy.mjs';
import {
  normalizeTelegramGroup,
  normalizeTelegramMockUpdate,
  normalizeTelegramPrincipal,
} from './telegramUpdates.mjs';
import { editTelegramMessageText, sendTelegramMessage } from './telegramSender.mjs';

const ACTION_KV_PREFIX = 'telegram:action:';
const DEFAULT_ACTION_TTL_SECONDS = 30 * 60;

const DEFAULT_QUESTION = Object.freeze({
  questionId: 'question-demo-1',
  questionType: 'rating',
  prompt: 'How ready is this group to try the Telegram account lane?',
  aggregateCount: 0,
  options: [],
});

const COMMANDS = Object.freeze({
  START: '/start',
  JOIN: '/ce_join',
  SESSIONS: '/ce_sessions',
  QUESTIONS: '/ce_questions',
  POSE_QUESTION: '/ce_pose_question',
  POSE_QUESTION_SHORT: '/q',
  DOCS: '/ce_docs',
  ME: '/ce_me',
  ACCOUNT: '/ce_account',
});

function safeString(value) {
  return String(value || '').trim();
}

function lower(value) {
  return safeString(value).toLowerCase();
}

function nowIso(now = null) {
  if (now instanceof Date) return now.toISOString();
  if (safeString(now)) return new Date(now).toISOString();
  return new Date().toISOString();
}

function safeJsonParse(value, fallback = null) {
  const text = safeString(value);
  if (!text) return fallback;
  try {
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}

function normalizeBotUsername(value = '') {
  return lower(value).replace(/^@/, '');
}

function sanitizeSessionSlug(value = '') {
  return lower(value).replace(/[^a-z0-9_-]/g, '').slice(0, 128);
}

function sessionLabel(session = {}) {
  return safeString(session.sessionName || session.sessionSlug || session.slug || 'general');
}

function questionText(question = {}) {
  return safeString(question.questionText || question.prompt || question.title || 'Untitled question');
}

function questionId(question = {}) {
  return safeString(question.questionId || question.id);
}

function loadSessionPolicy(env = {}) {
  const configured = safeJsonParse(env.AGENT_BRIDGE_SESSION_POLICY_JSON, null);
  if (configured && typeof configured === 'object' && !Array.isArray(configured)) {
    return normalizeSessionPolicy(configured);
  }
  const defaultSessionSlug = sanitizeSessionSlug(
    env.AGENT_BRIDGE_DEFAULT_SESSION_SLUG ||
    env.DEFAULT_SESSION_SLUG ||
    'general'
  ) || 'general';
  return normalizeSessionPolicy({
    defaultSessionSlug,
    riskCeiling: RISK_CEILINGS.SUBMIT,
    allowQuestionGeneration: true,
    allowGenerateQuestion: true,
    sessions: [{
      sessionSlug: defaultSessionSlug,
      sessionName: defaultSessionSlug,
      default: true,
      telegramBridgeEnabled: true,
      managedAccountSubmitAllowed: true,
      sponsoredAiAllowed: true,
      sponsoredRpcAllowed: true,
      sponsoredFaucetAllowed: true,
      sbtJoinModes: ['public', 'password'],
      docLibraryEnabled: true,
    }],
  });
}

function loadDemoQuestions(env = {}) {
  const parsed = safeJsonParse(env.AGENT_BRIDGE_DEMO_QUESTIONS_JSON, null);
  const questions = Array.isArray(parsed) ? parsed : [DEFAULT_QUESTION];
  const normalized = questions
    .filter((entry) => entry && typeof entry === 'object')
    .map((entry, index) => ({
      ...entry,
      questionId: questionId(entry) || `question-demo-${index + 1}`,
      prompt: questionText(entry),
    }));
  assertNoSecretShape(normalized, 'Telegram demo questions must not serialize secrets.');
  return normalized.length ? normalized : [DEFAULT_QUESTION];
}

function loadDemoDocuments(env = {}) {
  const parsed = safeJsonParse(env.AGENT_BRIDGE_DEMO_DOCS_JSON, null);
  const docs = Array.isArray(parsed) ? parsed : [];
  assertNoSecretShape(docs, 'Telegram demo docs must not serialize secrets.');
  return docs;
}

function parseTelegramCommandText(text = '', {
  botUsername = '',
} = {}) {
  const trimmed = safeString(text);
  if (!trimmed.startsWith('/')) {
    return {
      isCommand: false,
      command: '',
      args: [],
      argText: '',
      addressedToOtherBot: false,
    };
  }
  const [rawHead = '', ...args] = trimmed.split(/\s+/).filter(Boolean);
  const [rawCommand = '', rawMention = ''] = rawHead.split('@');
  const expectedUsername = normalizeBotUsername(botUsername);
  const mention = normalizeBotUsername(rawMention);
  return {
    isCommand: true,
    command: lower(rawCommand),
    args,
    argText: args.join(' '),
    mention: mention || null,
    addressedToOtherBot: Boolean(mention && expectedUsername && mention !== expectedUsername),
  };
}

function findQuestion(questions = [], selector = '') {
  const needle = lower(selector);
  if (!needle) return questions[0] || null;
  return questions.find((question) => lower(questionId(question)) === needle)
    || questions.find((question) => lower(questionText(question)).includes(needle))
    || null;
}

function buildAdHocQuestion(text = '', {
  sessionSlug = '',
  updateId = '',
} = {}) {
  const prompt = safeString(text);
  if (!prompt) return null;
  return {
    questionId: `telegram-${createTelegramCallbackAction({
      seed: `ad_hoc_question|${sessionSlug}|${prompt}|${updateId}`,
      action: TELEGRAM_BRIDGE_ACTIONS.POSE_QUESTION,
      lane: TELEGRAM_CHAT_LANES.GROUP_LOBBY,
      serverContextRef: { sessionSlug },
    }).record.actionId}`,
    questionType: 'freeform',
    prompt,
    source: 'telegram_command',
  };
}

async function persistActionRecord(env = {}, actionId = '', record = {}) {
  const id = safeString(actionId);
  if (!id || !env?.AGENT_ACTION_KV || typeof env.AGENT_ACTION_KV.put !== 'function') {
    return { ok: false, reason: 'action_kv_unavailable' };
  }
  assertNoSecretShape(record, 'Telegram action records must not serialize secrets.');
  await env.AGENT_ACTION_KV.put(`${ACTION_KV_PREFIX}${id}`, JSON.stringify(record), {
    expirationTtl: DEFAULT_ACTION_TTL_SECONDS,
  });
  return { ok: true, actionId: id };
}

async function readActionRecord(env = {}, actionId = '') {
  const id = safeString(actionId);
  if (!id || !env?.AGENT_ACTION_KV || typeof env.AGENT_ACTION_KV.get !== 'function') {
    return null;
  }
  const text = await env.AGENT_ACTION_KV.get(`${ACTION_KV_PREFIX}${id}`);
  const parsed = safeJsonParse(text, null);
  if (!parsed || typeof parsed !== 'object') return null;
  assertNoSecretShape(parsed, 'Telegram action records must not serialize secrets.');
  return parsed;
}

async function makeCallbackButton({
  env = {},
  label = '',
  action = '',
  lane = TELEGRAM_CHAT_LANES.GROUP_LOBBY,
  serverContextRef = {},
  seed = '',
  createdAt = null,
} = {}) {
  const callback = createTelegramCallbackAction({
    seed,
    action,
    lane,
    serverContextRef,
    createdAt,
  });
  await persistActionRecord(env, callback.callbackData, {
    ...callback.record,
    callbackData: callback.callbackData,
  });
  return {
    text: safeString(label),
    callback_data: callback.callbackData,
  };
}

async function makeStartButton({
  env = {},
  botUsername = '',
  label = 'Join Session',
  sessionSlug = '',
  groupChatId = '',
  seed = '',
  createdAt = null,
} = {}) {
  const username = normalizeBotUsername(botUsername);
  if (!username) {
    return makeCallbackButton({
      env,
      label,
      action: TELEGRAM_BRIDGE_ACTIONS.JOIN_SESSION,
      lane: TELEGRAM_CHAT_LANES.PRIVATE_ACCOUNT,
      serverContextRef: { sessionSlug, groupChatId },
      seed: seed || `join_session|${sessionSlug}|${groupChatId}`,
      createdAt,
    });
  }
  const start = createTelegramStartAction({
    seed: seed || `start_private|${sessionSlug}|${groupChatId}`,
    action: TELEGRAM_BRIDGE_ACTIONS.START_PRIVATE,
    lane: TELEGRAM_CHAT_LANES.PRIVATE_ACCOUNT,
    serverContextRef: { sessionSlug, groupChatId },
    createdAt,
  });
  await persistActionRecord(env, start.deepLinkPayload, {
    ...start.record,
    deepLinkPayload: start.deepLinkPayload,
  });
  return {
    text: safeString(label),
    url: `https://t.me/${username}?start=${start.deepLinkPayload}`,
  };
}

function reply({
  method = 'sendMessage',
  chatId = '',
  messageId = '',
  text = '',
  replyMarkup = null,
  screen = '',
  command = '',
  normalized = {},
  extra = {},
} = {}) {
  return {
    ok: true,
    command,
    screen,
    updateId: normalized.updateId ?? null,
    response: {
      method,
      chatId,
      messageId,
      text: safeString(text),
      replyMarkup,
    },
    ...extra,
  };
}

function errorReply({
  normalized = {},
  command = '',
  reason = '',
  text = '',
  method = 'sendMessage',
  messageId = '',
} = {}) {
  return reply({
    method,
    chatId: normalized.chat?.chatId,
    messageId,
    text: text || 'That action is not available. Try /ce_sessions or /start.',
    command,
    normalized,
    extra: {
      ok: false,
      reason,
    },
  });
}

function formatHelpText() {
  return [
    'Context Engine Telegram demo',
    '',
    '/ce_join <session> - link this chat to a session',
    '/ce_sessions - list linked sessions',
    '/ce_questions - view session questions',
    '/ce_pose_question <question-id-or-text> - pose a question',
    '/q <question-id-or-text> - short pose command',
    '/ce_docs - view linked docs',
    '/ce_me - view your managed demo account',
  ].join('\n');
}

async function buildHelpResponse({ normalized, command = COMMANDS.START, env, createdAt }) {
  const policy = loadSessionPolicy(env);
  const sessionSlug = policy.defaultSessionSlug || 'general';
  const keyboard = [[
    await makeCallbackButton({
      env,
      label: 'View Questions',
      action: TELEGRAM_BRIDGE_ACTIONS.VIEW_QUESTIONS,
      lane: TELEGRAM_CHAT_LANES.GROUP_LOBBY,
      serverContextRef: { sessionSlug },
      seed: `help|questions|${sessionSlug}|${normalized.updateId}`,
      createdAt,
    }),
    await makeCallbackButton({
      env,
      label: 'View / Add Docs',
      action: TELEGRAM_BRIDGE_ACTIONS.LIST_DOCS,
      lane: TELEGRAM_CHAT_LANES.GROUP_LOBBY,
      serverContextRef: { sessionSlug },
      seed: `help|docs|${sessionSlug}|${normalized.updateId}`,
      createdAt,
    }),
  ]];
  return reply({
    chatId: normalized.chat.chatId,
    text: formatHelpText(),
    replyMarkup: { inline_keyboard: keyboard },
    screen: 'setup_welcome',
    command,
    normalized,
  });
}

async function buildSessionsResponse({ normalized, command, env, createdAt }) {
  const policy = loadSessionPolicy(env);
  const sessions = policy.linkedSessions.length ? policy.linkedSessions : [{
    sessionSlug: policy.defaultSessionSlug || 'general',
    sessionName: policy.defaultSessionSlug || 'general',
  }];
  const rows = [];
  for (const session of sessions) {
    rows.push([await makeCallbackButton({
      env,
      label: sessionLabel(session),
      action: TELEGRAM_BRIDGE_ACTIONS.JOIN_SESSION,
      lane: TELEGRAM_CHAT_LANES.PRIVATE_ACCOUNT,
      serverContextRef: { sessionSlug: session.sessionSlug, groupChatId: normalized.chat.chatId },
      seed: `sessions|join|${session.sessionSlug}|${normalized.chat.chatId}|${normalized.updateId}`,
      createdAt,
    })]);
  }
  return reply({
    chatId: normalized.chat.chatId,
    text: [
      'Linked sessions:',
      ...sessions.map((session) => `- ${session.sessionSlug} (${sessionLabel(session)})`),
      '',
      'Use /ce_join <session> to link the current chat.',
    ].join('\n'),
    replyMarkup: { inline_keyboard: rows },
    screen: 'group_session_card',
    command,
    normalized,
  });
}

async function buildJoinResponse({
  normalized,
  command,
  env,
  args = [],
  sessionSlugOverride = '',
  createdAt,
} = {}) {
  const policy = loadSessionPolicy(env);
  const sessionSlug = sanitizeSessionSlug(sessionSlugOverride || args[0] || policy.defaultSessionSlug || 'general') || 'general';
  const resolved = resolveSessionInvocation(policy, sessionSlug);
  if (!resolved.ok) {
    return errorReply({
      normalized,
      command,
      reason: resolved.reason,
      text: `Session "${sessionSlug}" is not linked to this bridge. Run /ce_sessions to see available sessions.`,
    });
  }

  if (normalized.chat.isPrivate) {
    const account = await deriveManagedDemoAccount({
      principal: normalizeTelegramPrincipal(normalized),
      deploymentId: env.AGENT_BRIDGE_DEPLOYMENT_ID || 'agent-bridge-live-demo',
      rootSecret: env.DEMO_SIGNER_ROOT_SECRET || '',
      lifecycle: AGENT_BRIDGE_EVENT_TYPES.ACCOUNT_CREATED,
      createdAt,
    });
    const accountState = buildTelegramMyAccountState({
      account,
      joinedSessions: [{
        sessionSlug: resolved.session.sessionSlug,
        sessionName: resolved.session.sessionName,
        joinedAt: createdAt,
      }],
      createdAt,
    });
    return reply({
      chatId: normalized.chat.chatId,
      text: [
        `Joined session: ${sessionLabel(resolved.session)}`,
        '',
        `Managed demo account: ${account.accountAddress}`,
        `Mode: ${ACCOUNT_MODES.MANAGED_TELEGRAM_DEMO}`,
        `Chain: ${safeString(env.DEFAULT_CHAIN_ID || '11155420')}`,
        '',
        'Use /ce_questions, /ce_docs, or /ce_me.',
      ].join('\n'),
      replyMarkup: {
        inline_keyboard: [[
          await makeCallbackButton({
            env,
            label: 'View Questions',
            action: TELEGRAM_BRIDGE_ACTIONS.VIEW_QUESTIONS,
            lane: TELEGRAM_CHAT_LANES.PRIVATE_ACCOUNT,
            serverContextRef: { sessionSlug: resolved.session.sessionSlug },
            seed: `private_join|questions|${resolved.session.sessionSlug}|${normalized.user.telegramUserId}`,
            createdAt,
          }),
          await makeCallbackButton({
            env,
            label: 'My Account',
            action: TELEGRAM_BRIDGE_ACTIONS.MY_ACCOUNT,
            lane: TELEGRAM_CHAT_LANES.PRIVATE_ACCOUNT,
            serverContextRef: { sessionSlug: resolved.session.sessionSlug },
            seed: `private_join|me|${resolved.session.sessionSlug}|${normalized.user.telegramUserId}`,
            createdAt,
          }),
        ]],
      },
      screen: accountState.screen,
      command,
      normalized,
      extra: { sessionSlug: resolved.session.sessionSlug },
    });
  }

  const group = normalizeTelegramGroup(normalized);
  const state = buildTelegramGroupSessionCardState({
    sessionSlug: resolved.session.sessionSlug,
    sessionName: resolved.session.sessionName,
    policy: resolved.policy,
    createdAt,
  });
  const buttons = [
    await makeStartButton({
      env,
      botUsername: env.TELEGRAM_BOT_USERNAME,
      label: 'Join Session',
      sessionSlug: resolved.session.sessionSlug,
      groupChatId: group.groupChatId,
      seed: `group_join|start|${resolved.session.sessionSlug}|${group.groupChatId}|${normalized.updateId}`,
      createdAt,
    }),
    await makeCallbackButton({
      env,
      label: 'View Questions',
      action: TELEGRAM_BRIDGE_ACTIONS.VIEW_QUESTIONS,
      lane: TELEGRAM_CHAT_LANES.GROUP_LOBBY,
      serverContextRef: { sessionSlug: resolved.session.sessionSlug, groupChatId: group.groupChatId },
      seed: `group_join|questions|${resolved.session.sessionSlug}|${group.groupChatId}|${normalized.updateId}`,
      createdAt,
    }),
    await makeCallbackButton({
      env,
      label: 'View / Add Docs',
      action: TELEGRAM_BRIDGE_ACTIONS.LIST_DOCS,
      lane: TELEGRAM_CHAT_LANES.GROUP_LOBBY,
      serverContextRef: { sessionSlug: resolved.session.sessionSlug, groupChatId: group.groupChatId },
      seed: `group_join|docs|${resolved.session.sessionSlug}|${group.groupChatId}|${normalized.updateId}`,
      createdAt,
    }),
  ];
  if (resolved.policy.allowPoseQuestion !== false) {
    buttons.push(await makeCallbackButton({
      env,
      label: 'Pose Question',
      action: TELEGRAM_BRIDGE_ACTIONS.POSE_QUESTION,
      lane: TELEGRAM_CHAT_LANES.GROUP_LOBBY,
      serverContextRef: { sessionSlug: resolved.session.sessionSlug, groupChatId: group.groupChatId },
      seed: `group_join|pose|${resolved.session.sessionSlug}|${group.groupChatId}|${normalized.updateId}`,
      createdAt,
    }));
  }

  return reply({
    chatId: normalized.chat.chatId,
    text: [
      state.text,
      '',
      'Use the buttons below, or run /ce_questions, /ce_docs, or /q <question>.',
    ].join('\n'),
    replyMarkup: { inline_keyboard: [buttons] },
    screen: state.screen,
    command,
    normalized,
    extra: { sessionSlug: resolved.session.sessionSlug },
  });
}

async function buildQuestionsResponse({
  normalized,
  command,
  env,
  args = [],
  sessionSlugOverride = '',
  method = 'sendMessage',
  messageId = '',
  createdAt,
} = {}) {
  const policy = loadSessionPolicy(env);
  const sessionSlug = sanitizeSessionSlug(sessionSlugOverride || args[0] || policy.defaultSessionSlug || 'general') || 'general';
  const resolved = resolveSessionInvocation(policy, sessionSlug);
  if (!resolved.ok) {
    return errorReply({
      normalized,
      command,
      reason: resolved.reason,
      text: `Session "${sessionSlug}" is not linked to this bridge. Run /ce_sessions to see available sessions.`,
      method,
      messageId,
    });
  }
  const questions = loadDemoQuestions(env);
  const state = buildTelegramQuestionListState({
    sessionSlug: resolved.session.sessionSlug,
    questions,
    createdAt,
  });
  const rows = [];
  for (const [index, question] of questions.entries()) {
    rows.push([await makeCallbackButton({
      env,
      label: `Pose ${index + 1}`,
      action: TELEGRAM_BRIDGE_ACTIONS.POSE_QUESTION,
      lane: TELEGRAM_CHAT_LANES.GROUP_LOBBY,
      serverContextRef: { sessionSlug: resolved.session.sessionSlug, questionId: questionId(question) },
      seed: `questions|pose|${resolved.session.sessionSlug}|${questionId(question)}|${normalized.updateId}`,
      createdAt,
    })]);
  }
  return reply({
    method,
    chatId: normalized.chat.chatId,
    messageId,
    text: [
      `Questions for ${resolved.session.sessionSlug}:`,
      ...state.questions.map((question) => `${question.displayIndex}. ${question.questionId} - ${question.title}`),
      '',
      'Use /q <question-id-or-text> to pose one to the group.',
    ].join('\n'),
    replyMarkup: rows.length ? { inline_keyboard: rows } : null,
    screen: state.screen,
    command,
    normalized,
    extra: { sessionSlug: resolved.session.sessionSlug, questionCount: state.count },
  });
}

async function buildPoseQuestionResponse({
  normalized,
  command,
  env,
  args = [],
  sessionSlugOverride = '',
  questionIdOverride = '',
  createdAt,
} = {}) {
  const policy = loadSessionPolicy(env);
  const sessionSlug = sanitizeSessionSlug(sessionSlugOverride || policy.defaultSessionSlug || 'general') || 'general';
  const resolved = resolveSessionInvocation(policy, sessionSlug);
  if (!resolved.ok) {
    return errorReply({
      normalized,
      command,
      reason: resolved.reason,
      text: `Session "${sessionSlug}" is not linked to this bridge. Run /ce_sessions to see available sessions.`,
    });
  }

  const selector = safeString(questionIdOverride || args.join(' '));
  const questions = loadDemoQuestions(env);
  const matched = findQuestion(questions, selector);
  const selected = matched || buildAdHocQuestion(selector, {
    sessionSlug: resolved.session.sessionSlug,
    updateId: normalized.updateId,
  });
  if (!selected) {
    return buildQuestionsResponse({
      normalized,
      command,
      env,
      sessionSlugOverride: resolved.session.sessionSlug,
      createdAt,
    });
  }

  const state = buildTelegramPoseQuestionState({
    sessionSlug: resolved.session.sessionSlug,
    question: selected,
    source: matched ? 'existing_session_question' : 'telegram_command',
    createdAt,
  });
  const group = state.groupSafeOutput || {};
  const text = group.locked
    ? `Question ${group.questionId} is locked for group chat. Open it privately from /ce_questions.`
    : [
      `Question for ${resolved.session.sessionSlug}:`,
      group.questionText,
      ...(Array.isArray(group.answerLabels) && group.answerLabels.length
        ? ['', `Options: ${group.answerLabels.join(', ')}`]
        : []),
    ].join('\n');
  return reply({
    chatId: normalized.chat.chatId,
    text,
    replyMarkup: {
      inline_keyboard: [[
        await makeCallbackButton({
          env,
          label: 'View Questions',
          action: TELEGRAM_BRIDGE_ACTIONS.VIEW_QUESTIONS,
          lane: TELEGRAM_CHAT_LANES.GROUP_LOBBY,
          serverContextRef: { sessionSlug: resolved.session.sessionSlug },
          seed: `pose|questions|${resolved.session.sessionSlug}|${questionId(selected)}|${normalized.updateId}`,
          createdAt,
        }),
      ]],
    },
    screen: state.screen,
    command,
    normalized,
    extra: {
      sessionSlug: resolved.session.sessionSlug,
      questionId: group.questionId,
      posed: group.locked !== true,
    },
  });
}

async function buildDocsResponse({
  normalized,
  command,
  env,
  args = [],
  sessionSlugOverride = '',
  method = 'sendMessage',
  messageId = '',
  createdAt,
} = {}) {
  const policy = loadSessionPolicy(env);
  const sessionSlug = sanitizeSessionSlug(sessionSlugOverride || args[0] || policy.defaultSessionSlug || 'general') || 'general';
  const resolved = resolveSessionInvocation(policy, sessionSlug);
  if (!resolved.ok) {
    return errorReply({
      normalized,
      command,
      reason: resolved.reason,
      text: `Session "${sessionSlug}" is not linked to this bridge. Run /ce_sessions to see available sessions.`,
      method,
      messageId,
    });
  }
  const docs = listDocumentsForSession(loadDemoDocuments(env), {
    sessionSlug: resolved.session.sessionSlug,
  });
  const summaries = docs.docs.map((doc) => summarizeDocumentForGroup(doc)).filter((entry) => entry.ok);
  const lines = summaries.length
    ? summaries.map((entry, index) => `${index + 1}. ${entry.summary.docTitle} (${entry.summary.fileType}, ${entry.summary.visibility})`)
    : ['No docs are linked to this session yet.'];
  return reply({
    method,
    chatId: normalized.chat.chatId,
    messageId,
    text: [
      `Docs for ${resolved.session.sessionSlug}:`,
      ...lines,
      '',
      'Private or SBT-gated contents stay behind the session worker.',
    ].join('\n'),
    replyMarkup: {
      inline_keyboard: [[
        await makeCallbackButton({
          env,
          label: 'View Questions',
          action: TELEGRAM_BRIDGE_ACTIONS.VIEW_QUESTIONS,
          lane: TELEGRAM_CHAT_LANES.GROUP_LOBBY,
          serverContextRef: { sessionSlug: resolved.session.sessionSlug },
          seed: `docs|questions|${resolved.session.sessionSlug}|${normalized.updateId}`,
          createdAt,
        }),
      ]],
    },
    screen: 'doc_library',
    command,
    normalized,
    extra: { sessionSlug: resolved.session.sessionSlug, docCount: docs.count },
  });
}

async function buildMeResponse({ normalized, command, env, createdAt, method = 'sendMessage', messageId = '' }) {
  const policy = loadSessionPolicy(env);
  const account = await deriveManagedDemoAccount({
    principal: normalizeTelegramPrincipal(normalized),
    deploymentId: env.AGENT_BRIDGE_DEPLOYMENT_ID || 'agent-bridge-live-demo',
    rootSecret: env.DEMO_SIGNER_ROOT_SECRET || '',
    lifecycle: AGENT_BRIDGE_EVENT_TYPES.ACCOUNT_CREATED,
    createdAt,
  });
  const joinedSessions = policy.linkedSessions.map((session) => ({
    sessionSlug: session.sessionSlug,
    sessionName: session.sessionName,
  }));
  const state = buildTelegramMyAccountState({
    account,
    joinedSessions,
    joinedSbts: [],
    createdAt,
  });
  return reply({
    method,
    chatId: normalized.chat.chatId,
    messageId,
    text: [
      'Managed Telegram demo account',
      `Address: ${account.accountAddress}`,
      `Mode: ${state.accountMode}`,
      `Chain: ${safeString(env.DEFAULT_CHAIN_ID || '11155420')}`,
      `Joined sessions: ${joinedSessions.map((session) => session.sessionSlug).join(', ') || 'none'}`,
      '',
      'Demo signing stays inside the worker Durable Object boundary.',
    ].join('\n'),
    replyMarkup: {
      inline_keyboard: [[
        await makeCallbackButton({
          env,
          label: 'View Questions',
          action: TELEGRAM_BRIDGE_ACTIONS.VIEW_QUESTIONS,
          lane: TELEGRAM_CHAT_LANES.PRIVATE_ACCOUNT,
          serverContextRef: { sessionSlug: policy.defaultSessionSlug || 'general' },
          seed: `me|questions|${normalized.user.telegramUserId}|${normalized.updateId}`,
          createdAt,
        }),
      ]],
    },
    screen: state.screen,
    command,
    normalized,
    extra: { accountMode: state.accountMode },
  });
}

async function buildStartPayloadResponse({
  normalized,
  command,
  env,
  payload = '',
  createdAt,
} = {}) {
  const parsed = parseOpaqueActionId(payload);
  if (!parsed.ok) {
    return buildHelpResponse({ normalized, command, env, createdAt });
  }
  const record = await readActionRecord(env, parsed.actionId);
  if (!record) {
    return reply({
      chatId: normalized.chat.chatId,
      text: [
        'This private start link is no longer active.',
        '',
        'Run /ce_sessions or /ce_join <session> to continue.',
      ].join('\n'),
      screen: 'private_start',
      command,
      normalized,
      extra: { startPayload: parsed.actionId, active: false },
    });
  }
  return buildJoinResponse({
    normalized,
    command,
    env,
    sessionSlugOverride: record.serverContextRef?.sessionSlug || '',
    createdAt,
  });
}

async function buildCallbackResponse({ normalized, env, createdAt }) {
  const callbackData = safeString(normalized.callbackData);
  const parsed = parseOpaqueActionId(callbackData);
  const callback = normalized.raw?.callback_query || {};
  const message = callback.message || {};
  const method = message.chat?.id && message.message_id ? 'editMessageText' : 'sendMessage';
  const messageId = safeString(message.message_id);
  if (!parsed.ok) {
    return errorReply({
      normalized,
      command: 'callback',
      reason: 'invalid_callback_data',
      text: 'This action is not available. Callback data must be an opaque Context Engine action id.',
      method,
      messageId,
    });
  }
  const record = await readActionRecord(env, parsed.actionId);
  if (!record) {
    return errorReply({
      normalized,
      command: 'callback',
      reason: 'action_not_found',
      text: 'This action expired. Run /ce_sessions or /start to refresh the buttons.',
      method,
      messageId,
    });
  }
  const sessionSlug = record.serverContextRef?.sessionSlug || '';
  if (record.action === TELEGRAM_BRIDGE_ACTIONS.VIEW_QUESTIONS) {
    return buildQuestionsResponse({
      normalized,
      command: 'callback:view_questions',
      env,
      sessionSlugOverride: sessionSlug,
      method,
      messageId,
      createdAt,
    });
  }
  if (record.action === TELEGRAM_BRIDGE_ACTIONS.LIST_DOCS) {
    return buildDocsResponse({
      normalized,
      command: 'callback:list_docs',
      env,
      sessionSlugOverride: sessionSlug,
      method,
      messageId,
      createdAt,
    });
  }
  if (record.action === TELEGRAM_BRIDGE_ACTIONS.POSE_QUESTION) {
    return buildPoseQuestionResponse({
      normalized,
      command: 'callback:pose_question',
      env,
      sessionSlugOverride: sessionSlug,
      questionIdOverride: record.serverContextRef?.questionId || '',
      createdAt,
    });
  }
  if (record.action === TELEGRAM_BRIDGE_ACTIONS.MY_ACCOUNT) {
    return buildMeResponse({
      normalized,
      command: 'callback:my_account',
      env,
      createdAt,
      method,
      messageId,
    });
  }
  if ([TELEGRAM_BRIDGE_ACTIONS.JOIN_SESSION, TELEGRAM_BRIDGE_ACTIONS.START_PRIVATE].includes(record.action)) {
    return buildJoinResponse({
      normalized,
      command: 'callback:join_session',
      env,
      sessionSlugOverride: sessionSlug,
      createdAt,
    });
  }
  return errorReply({
    normalized,
    command: 'callback',
    reason: 'unsupported_callback_action',
    text: 'This action is not available in the Telegram demo yet.',
    method,
    messageId,
  });
}

export async function buildTelegramCommandResponse({
  update = {},
  env = {},
  now = null,
} = {}) {
  if (!update || typeof update !== 'object' || Array.isArray(update)) {
    return { ok: false, reason: 'invalid_telegram_update' };
  }
  const normalized = {
    ...normalizeTelegramMockUpdate(update),
    raw: update,
  };
  if (!safeString(normalized.chat?.chatId)) {
    return { ok: false, reason: 'telegram_chat_missing', updateId: normalized.updateId ?? null };
  }
  const createdAt = nowIso(now);
  if (normalized.kind === 'callback') {
    return buildCallbackResponse({ normalized, env, createdAt });
  }

  const parsed = parseTelegramCommandText(normalized.text, {
    botUsername: env.TELEGRAM_BOT_USERNAME,
  });
  if (parsed.addressedToOtherBot) {
    return {
      ok: true,
      ignored: true,
      reason: 'addressed_to_other_bot',
      updateId: normalized.updateId ?? null,
    };
  }
  if (!parsed.isCommand) {
    return buildHelpResponse({ normalized, command: 'message', env, createdAt });
  }
  if (parsed.command === COMMANDS.START) {
    return parsed.args[0]
      ? buildStartPayloadResponse({
        normalized,
        command: parsed.command,
        env,
        payload: parsed.args[0],
        createdAt,
      })
      : buildHelpResponse({ normalized, command: parsed.command, env, createdAt });
  }
  if (parsed.command === COMMANDS.JOIN) {
    return buildJoinResponse({
      normalized,
      command: parsed.command,
      env,
      args: parsed.args,
      createdAt,
    });
  }
  if (parsed.command === COMMANDS.SESSIONS) {
    return buildSessionsResponse({ normalized, command: parsed.command, env, createdAt });
  }
  if (parsed.command === COMMANDS.QUESTIONS) {
    return buildQuestionsResponse({
      normalized,
      command: parsed.command,
      env,
      args: parsed.args,
      createdAt,
    });
  }
  if ([COMMANDS.POSE_QUESTION, COMMANDS.POSE_QUESTION_SHORT].includes(parsed.command)) {
    return buildPoseQuestionResponse({
      normalized,
      command: parsed.command,
      env,
      args: parsed.args,
      createdAt,
    });
  }
  if (parsed.command === COMMANDS.DOCS) {
    return buildDocsResponse({
      normalized,
      command: parsed.command,
      env,
      args: parsed.args,
      createdAt,
    });
  }
  if ([COMMANDS.ME, COMMANDS.ACCOUNT].includes(parsed.command)) {
    return buildMeResponse({
      normalized,
      command: parsed.command,
      env,
      createdAt,
    });
  }

  return buildHelpResponse({ normalized, command: parsed.command, env, createdAt });
}

function summarizeTelegramSendResult(result = {}) {
  return result.ok
    ? { ok: true, status: result.status || 200 }
    : {
      ok: false,
      status: result.status || 502,
      error: safeString(result.error || 'Telegram API request failed.'),
      telegramErrorCode: result.telegramErrorCode || null,
    };
}

export async function dispatchTelegramCommandResponse({
  commandResponse = {},
  env = {},
  fetchImpl = globalThis.fetch,
} = {}) {
  if (commandResponse.ignored === true || !commandResponse.response) {
    return { ...commandResponse, telegram: { ok: true, skipped: true } };
  }
  const response = commandResponse.response;
  const botToken = env.TELEGRAM_BOT_TOKEN || '';
  const sendResult = response.method === 'editMessageText'
    ? await editTelegramMessageText({
      botToken,
      chatId: response.chatId,
      messageId: response.messageId,
      text: response.text,
      replyMarkup: response.replyMarkup,
      fetchImpl,
    })
    : await sendTelegramMessage({
      botToken,
      chatId: response.chatId,
      text: response.text,
      replyMarkup: response.replyMarkup,
      fetchImpl,
    });
  return {
    ...commandResponse,
    telegram: summarizeTelegramSendResult(sendResult),
  };
}

export async function handleTelegramWebhookUpdate({
  update = {},
  env = {},
  fetchImpl = globalThis.fetch,
  now = null,
} = {}) {
  const commandResponse = await buildTelegramCommandResponse({ update, env, now });
  if (!commandResponse.ok && !commandResponse.response) {
    return commandResponse;
  }
  return dispatchTelegramCommandResponse({
    commandResponse,
    env,
    fetchImpl,
  });
}

export {
  ACTION_KV_PREFIX,
  COMMANDS,
  parseTelegramCommandText,
  readActionRecord,
};
