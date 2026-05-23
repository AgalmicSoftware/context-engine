import {
  AGENT_BRIDGE_EVENT_TYPES,
  RISK_CEILINGS,
  TELEGRAM_BRIDGE_ACTIONS,
  TELEGRAM_CHAT_LANES,
} from './constants.mjs';
import { listDocumentsForSession, summarizeDocumentForGroup } from './docLibrary.mjs';
import { deriveManagedDemoAccount } from './managedAccounts.mjs';
import {
  requestManagedAccountFaucetOnJoin,
  submitTelegramResponseOnChain,
} from './onChainResponses.mjs';
import {
  buildOpaqueActionId,
  createTelegramCallbackAction,
  createRandomTelegramCallbackAction,
  createTelegramStartAction,
  parseOpaqueActionId,
} from './opaqueActions.mjs';
import {
  buildTelegramAgentAccountCreateState,
  buildTelegramAgentActionMenuState,
  buildTelegramAgentSettingsEditState,
  buildTelegramAgentSettingsOverviewState,
  buildTelegramGroupSessionCardState,
  buildTelegramMyAccountState,
  buildTelegramPoseQuestionState,
  buildTelegramQuestionListState,
} from './questionUi.mjs';
import { assertNoSecretShape } from './redaction.mjs';
import { listRegistrySessionsForBridge } from './registrySessions.mjs';
import { buildResultsImage } from './resultImage.mjs';
import { listCachedSessionQuestionsForBridge } from './sessionQuestions.mjs';
import { normalizeSessionPolicy, resolveSessionInvocation } from './sessionPolicy.mjs';
import {
  addResponseExportAllowedAddress,
  buildTelegramResponseExportArchive,
  canManageResponseExportAllowlist,
  canExportResponsesForTelegramUser,
  findLatestResponseExportSessionSlugForTelegramUser,
  listResponseExportAccess,
  removeResponseExportAllowedAddress,
} from './telegramResponseExport.mjs';
import {
  normalizeTelegramGroup,
  normalizeTelegramMockUpdate,
  normalizeTelegramPrincipal,
} from './telegramUpdates.mjs';
import {
  answerTelegramCallbackQuery,
  editTelegramMessageText,
  sendTelegramDocument,
  sendTelegramMessage,
  sendTelegramPhoto,
} from './telegramSender.mjs';

const ACTION_KV_PREFIX = 'telegram:action:';
const GROUP_SESSION_KV_PREFIX = 'telegram:group-session:';
const PRIVATE_SESSION_KV_PREFIX = 'telegram:private-session:';
const ANSWER_DRAFT_KV_PREFIX = 'telegram:answer-draft:';
const SUBMIT_REQUEST_KV_PREFIX = 'telegram:submit-request:';
const AGENT_REQUEST_KV_PREFIX = 'telegram:agent-request:';
const DEFAULT_ACTION_TTL_SECONDS = 30 * 60;
const DEFAULT_GROUP_SESSION_TTL_SECONDS = 30 * 24 * 60 * 60;
const SUBMIT_REQUEST_TTL_SECONDS = 30 * 24 * 60 * 60;
const TELEGRAM_QUESTION_LIST_LIMIT = 5;
const TELEGRAM_SESSION_LIST_LIMIT = 5;
const TELEGRAM_BUTTON_LABEL_MAX_BYTES = 64;
const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;
const ANSWER_BUTTON_CONTROL_TYPES = new Set([
  'agree_unsure_disagree',
  'rating_button',
  'single_select',
  'multi_select_toggle',
]);

const DEFAULT_QUESTION = Object.freeze({
  questionId: 'question-demo-1',
  questionType: 'rating',
  prompt: 'How ready is this group to try the Telegram account lane?',
  aggregateCount: 0,
  options: [],
});

const COMMANDS = Object.freeze({
  START: '/start',
  ACTIONS: '/actions',
  AGENT: '/agent',
  CREATE_AGENT: '/create_agent',
  SETTINGS: '/settings',
  JOIN: '/join',
  SESSIONS: '/sessions',
  QUESTIONS: '/questions',
  POSE_QUESTION: '/pose_question',
  POSE_QUESTION_SHORT: '/q',
  RESULTS: '/results',
  EXPORT_ALL: '/export_all',
  EXPORT_ACCESS: '/export_access',
  EXPORT_ALLOW: '/export_allow',
  EXPORT_REVOKE: '/export_revoke',
  ATTACHMENTS: '/attachments',
  DOCS: '/docs',
  ME: '/me',
  ACCOUNT: '/account',
});

const LEGACY_COMMAND_ALIASES = Object.freeze({
  '/ce_actions': COMMANDS.ACTIONS,
  '/ce_agent': COMMANDS.AGENT,
  '/ce_create_agent': COMMANDS.CREATE_AGENT,
  '/ce_settings': COMMANDS.SETTINGS,
  '/ce_join': COMMANDS.JOIN,
  '/ce_sessions': COMMANDS.SESSIONS,
  '/ce_questions': COMMANDS.QUESTIONS,
  '/ce_pose_question': COMMANDS.POSE_QUESTION,
  '/ce_drop_question': COMMANDS.POSE_QUESTION,
  '/drop_question': COMMANDS.POSE_QUESTION,
  '/ce_results': COMMANDS.RESULTS,
  '/ce_export_all': COMMANDS.EXPORT_ALL,
  '/ce_export_access': COMMANDS.EXPORT_ACCESS,
  '/ce_export_allow': COMMANDS.EXPORT_ALLOW,
  '/ce_export_revoke': COMMANDS.EXPORT_REVOKE,
  '/ce_attachments': COMMANDS.ATTACHMENTS,
  '/ce_docs': COMMANDS.DOCS,
  '/ce_me': COMMANDS.ME,
  '/ce_account': COMMANDS.ACCOUNT,
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

function shortQuestionId(value = '') {
  const text = safeString(value);
  if (/^0x[0-9a-fA-F]{64}$/.test(text)) return `${text.slice(0, 10)}...${text.slice(-6)}`;
  return text.length > 18 ? `${text.slice(0, 10)}...${text.slice(-6)}` : text;
}

function questionIdSeedPart(value = '') {
  const text = safeString(value);
  return /^0x[0-9a-fA-F]{64}$/.test(text) ? `${text.slice(2, 10)}${text.slice(-6)}` : text;
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => (
      `${JSON.stringify(key)}:${stableJson(value[key])}`
    )).join(',')}}`;
  }
  return JSON.stringify(value ?? null);
}

function stableFingerprint(value = {}) {
  const input = stableJson(value);
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36).padStart(10, '0');
}

function shortAddress(value = '') {
  const text = safeString(value);
  return ADDRESS_RE.test(text) ? `${text.slice(0, 6)}...${text.slice(-4)}` : text;
}

function shortTxHash(value = '') {
  const text = safeString(value);
  return /^0x[0-9a-fA-F]{64}$/.test(text) ? `${text.slice(0, 10)}...${text.slice(-6)}` : text;
}

function escapeTelegramHtml(value = '') {
  return safeString(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function chainDisplayName(value = '') {
  const chainId = safeString(value || '11155420');
  const names = {
    11155420: 'OP Sepolia Testnet',
    84532: 'Base Sepolia Testnet',
    11155111: 'Ethereum Sepolia Testnet',
  };
  return names[chainId] ? `${names[chainId]} (${chainId})` : chainId;
}

function addressExplorerUrl(address = '', chainId = '') {
  const normalizedAddress = safeString(address);
  if (!ADDRESS_RE.test(normalizedAddress)) return '';
  const id = safeString(chainId || '11155420');
  if (id === '11155420') return `https://optimism-sepolia.blockscout.com/address/${normalizedAddress}`;
  if (id === '84532') return `https://base-sepolia.blockscout.com/address/${normalizedAddress}`;
  if (id === '11155111') return `https://sepolia.etherscan.io/address/${normalizedAddress}`;
  return '';
}

function urlButton(label = '', url = '') {
  const text = safeString(label);
  const href = safeString(url);
  return text && href ? { text, url: href } : null;
}

function telegramButtonLabel(value = '', fallback = 'Question') {
  const source = safeString(value || fallback).replace(/\s+/g, ' ');
  const encoder = new TextEncoder();
  if (encoder.encode(source).length <= TELEGRAM_BUTTON_LABEL_MAX_BYTES) return source;
  let out = '';
  for (const char of source) {
    const next = `${out}${char}`;
    if (encoder.encode(`${next}...`).length > TELEGRAM_BUTTON_LABEL_MAX_BYTES) break;
    out = next;
  }
  return `${out.trimEnd()}...`;
}

function onChainAnswerFromDraft(draft = {}) {
  const controlType = safeString(draft.controlType);
  if (controlType === 'rating_button') {
    return {
      questionType: 'rating',
      value: Number(draft.answerValue),
      comments: '',
    };
  }
  if (controlType === 'agree_unsure_disagree') {
    return {
      questionType: 'agree_unsure_disagree',
      value: lower(draft.answerValue || draft.answerLabel),
      label: safeString(draft.answerLabel),
      comments: '',
    };
  }
  if (controlType === 'single_select' || controlType === 'multi_select_toggle') {
    return {
      questionType: 'multichoice',
      values: [safeString(draft.answerValue || draft.answerLabel)].filter(Boolean),
      selectionMode: controlType === 'single_select' ? 'single' : 'multi',
      comments: '',
    };
  }
  return {
    questionType: 'freeform',
    text: safeString(draft.answerValue || draft.answerLabel),
    comments: '',
  };
}

async function loadSessionPolicy(env = {}, {
  forceRefresh = false,
} = {}) {
  const configured = safeJsonParse(env.AGENT_BRIDGE_SESSION_POLICY_JSON, null);
  if (configured && typeof configured === 'object' && !Array.isArray(configured)) {
    return normalizeSessionPolicy(configured);
  }
  const registry = await listRegistrySessionsForBridge({ env, forceRefresh }).catch((error) => ({
    ok: false,
    reason: 'session_registry_unavailable',
    error: safeString(error?.message || error),
    sessions: [],
  }));
  if (registry.ok && registry.sessions.length) {
    return normalizeSessionPolicy({
      defaultSessionSlug: (
        sanitizeSessionSlug(env.AGENT_BRIDGE_DEFAULT_SESSION_SLUG || env.DEFAULT_SESSION_SLUG) ||
        registry.sessions.find((session) => session.default)?.sessionSlug ||
        registry.sessions[0]?.sessionSlug
      ),
      riskCeiling: RISK_CEILINGS.SUBMIT,
      allowQuestionGeneration: true,
      allowGenerateQuestion: true,
      sessions: registry.sessions,
    });
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

function questionSessionSlug(question = {}) {
  return sanitizeSessionSlug(question.sessionSlug || question.session);
}

function filterQuestionsForSession(questions = [], sessionSlug = '') {
  const selectedSlug = sanitizeSessionSlug(sessionSlug);
  if (!selectedSlug) return questions;
  return (Array.isArray(questions) ? questions : []).filter((question) => {
    const slug = questionSessionSlug(question);
    return !slug || slug === selectedSlug;
  });
}

function questionIsPayloadUnavailable(question = {}) {
  return question?.payloadUnavailable === true || lower(question?.visibility) === 'payload_unavailable';
}

function questionIsLocked(question = {}) {
  const visibility = lower(question?.visibility);
  return question?.locked === true || ['private', 'sbt_gated', 'lit_encrypted'].includes(visibility);
}

function questionPresentationRank(question = {}) {
  if (questionIsPayloadUnavailable(question)) return 2;
  if (questionIsLocked(question)) return 1;
  return 0;
}

function orderQuestionsForPresentation(questions = []) {
  return (Array.isArray(questions) ? questions : [])
    .map((question, index) => ({ question, index }))
    .sort((left, right) => (
      questionPresentationRank(left.question) - questionPresentationRank(right.question) ||
      left.index - right.index
    ))
    .map(({ question }) => question);
}

function envFlagEnabled(value = '') {
  return ['1', 'true', 'yes', 'on'].includes(lower(value));
}

function questionSourceMode(env = {}) {
  const mode = lower(env.AGENT_BRIDGE_QUESTION_SOURCE || 'live');
  if (['fixture', 'demo', 'demo_fixture'].includes(mode)) return 'fixture';
  if (['live_or_fixture', 'live-or-fixture', 'fallback'].includes(mode)) return 'live_or_fixture';
  return 'live';
}

function allowDemoQuestionFallback(env = {}) {
  return questionSourceMode(env) === 'live_or_fixture'
    || envFlagEnabled(env.AGENT_BRIDGE_ALLOW_DEMO_QUESTION_FALLBACK);
}

function allowAdHocQuestions(env = {}) {
  return envFlagEnabled(env.AGENT_BRIDGE_ALLOW_AD_HOC_QUESTIONS)
    || questionSourceMode(env) === 'fixture';
}

function questionLoadIssueText(result = {}) {
  const reason = safeString(result.reason);
  if (reason === 'question_scan_window_unscoped') {
    return 'Question source needs session block limits before it can be shown here.';
  }
  if (reason === 'question_rpc_url_missing') {
    return 'Question source is missing RPC config.';
  }
  if (reason === 'surveys_address_missing') {
    return 'Question source is missing Surveys contract config.';
  }
  if (reason === 'question_log_scan_failed' || reason === 'question_log_scan_partial_failed') {
    return 'Question source is unavailable. Try again shortly.';
  }
  if (reason === 'question_payload_load_failed') {
    return 'Question payloads could not be loaded. Try again shortly.';
  }
  if (reason === 'question_current_block_failed') {
    return 'Question source could not read the latest block. Try again shortly.';
  }
  if (reason === 'live_questions_indexing') {
    return 'Questions are indexing. Run /questions again shortly.';
  }
  return 'Questions could not be loaded. Try again shortly.';
}

function questionListPromptLine(question = {}) {
  const displayIndex = Number(question.displayIndex) || 0;
  const prefix = displayIndex > 0 ? `${displayIndex}. ` : '';
  if (question.payloadUnavailable === true) return `${prefix}Failed to load question prompt.`;
  if (question.locked === true) {
    const visibility = lower(question.visibility);
    return `${prefix}${visibility === 'lit_encrypted' ? 'Encrypted question' : 'Requires session access'}`;
  }
  return `${prefix}${safeString(question.title) || 'Failed to load question prompt.'}`;
}

async function loadQuestionsForSession(env = {}, sessionSlug = '', {
  waitUntil = null,
} = {}) {
  const mode = questionSourceMode(env);
  if (mode === 'fixture') {
    return {
      ok: true,
      reason: 'fixture_questions_loaded',
      source: 'demo_fixture',
      questions: orderQuestionsForPresentation(filterQuestionsForSession(loadDemoQuestions(env), sessionSlug)),
    };
  }
  const live = await listCachedSessionQuestionsForBridge({ env, sessionSlug, waitUntil }).catch((error) => ({
    ok: false,
    reason: 'live_question_cache_failed',
    error: safeString(error?.message || error),
    questions: [],
  }));
  if ((live.ok && Array.isArray(live.questions) && live.questions.length) || !allowDemoQuestionFallback(env)) {
    return {
      ...live,
      source: live.source || 'telegram_worker_question_cache',
      questions: orderQuestionsForPresentation(live.questions),
    };
  }
  return {
    ok: true,
    reason: 'fixture_questions_fallback',
    source: 'demo_fixture',
    fallbackFrom: live.reason || 'live_question_cache_unavailable',
    questions: orderQuestionsForPresentation(filterQuestionsForSession(loadDemoQuestions(env), sessionSlug)),
  };
}

function summarizeQuestionPrefetch(result = {}, sessionSlug = '') {
  const questions = Array.isArray(result.questions) ? result.questions : [];
  const questionCount = Number(result.questionCount ?? questions.length) || 0;
  const unavailableQuestionCount = questions.filter(questionIsPayloadUnavailable).length;
  const lockedQuestionCount = questions.filter(questionIsLocked).length;
  const availableQuestionCount = Math.max(0, questionCount - unavailableQuestionCount - lockedQuestionCount);
  const discoveredQuestionCount = Number(result.discoveredCount || result.indexedQuestionCount || questionCount) || questionCount;
  return {
    scheduled: true,
    sessionSlug: sanitizeSessionSlug(sessionSlug),
    ok: result.ok !== false,
    reason: safeString(result.reason || ''),
    questionCount,
    availableQuestionCount,
    unavailableQuestionCount,
    lockedQuestionCount,
    discoveredQuestionCount,
    complete: result.complete !== false,
  };
}

function questionAvailabilityLine(prefetch = {}) {
  if (prefetch.scheduled !== true) return 'Questions: not loaded yet.';
  if (prefetch.ok === false) return 'Questions: unavailable right now.';
  const available = Number(prefetch.availableQuestionCount ?? prefetch.questionCount ?? 0) || 0;
  const loaded = Number(prefetch.questionCount ?? available) || 0;
  if (prefetch.reason === 'live_questions_indexing' && loaded === 0) {
    return 'Questions: indexing now.';
  }
  return `Questions: ${available}.`;
}

async function prefetchQuestionsForJoinedSession({
  env = {},
  sessionSlug = '',
  waitUntil = null,
} = {}) {
  const slug = sanitizeSessionSlug(sessionSlug);
  if (!slug) return { scheduled: false, reason: 'session_slug_missing' };
  try {
    const result = await loadQuestionsForSession(env, slug, { waitUntil });
    return summarizeQuestionPrefetch(result, slug);
  } catch (error) {
    return {
      scheduled: true,
      sessionSlug: slug,
      ok: false,
      reason: safeString(error?.message || error) || 'question_prefetch_failed',
      questionCount: 0,
      availableQuestionCount: 0,
      unavailableQuestionCount: 0,
      lockedQuestionCount: 0,
      discoveredQuestionCount: 0,
      complete: false,
    };
  }
}

function loadDemoDocuments(env = {}) {
  const parsed = safeJsonParse(env.AGENT_BRIDGE_DEMO_DOCS_JSON, null);
  const docs = Array.isArray(parsed) ? parsed : [];
  assertNoSecretShape(docs, 'Telegram demo docs must not serialize secrets.');
  return docs;
}

function loadAgentSettings(env = {}) {
  const parsed = safeJsonParse(env.AGENT_BRIDGE_DEMO_AGENT_SETTINGS_JSON, null);
  const source = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  const draftStyle = ['concise', 'balanced', 'detailed'].includes(lower(source.draftStyle))
    ? lower(source.draftStyle)
    : 'balanced';
  const telegramReminders = source.telegramReminders === true ||
    ['1', 'true', 'yes', 'on'].includes(lower(source.telegramReminders));
  const settings = { draftStyle, telegramReminders };
  settings.showUnansweredFirst = source.showUnansweredFirst === false
    ? false
    : !['0', 'false', 'no', 'off'].includes(lower(source.showUnansweredFirst));
  assertNoSecretShape(settings, 'Telegram agent settings fixtures must not serialize secrets.');
  return settings;
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
  const command = lower(rawCommand);
  return {
    isCommand: true,
    command: LEGACY_COMMAND_ALIASES[command] || command,
    args,
    argText: args.join(' '),
    mention: mention || null,
    addressedToOtherBot: Boolean(mention && expectedUsername && mention !== expectedUsername),
  };
}

function findQuestion(questions = [], selector = '') {
  const needle = lower(selector);
  if (!needle) return null;
  const index = Number(needle);
  if (Number.isInteger(index) && index > 0 && index <= questions.length) {
    return questions[index - 1] || null;
  }
  return questions.find((question) => lower(questionId(question)) === needle)
    || questions.find((question) => lower(shortQuestionId(questionId(question))) === needle)
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

async function persistActionRecord(env = {}, actionId = '', record = {}, {
  ttlSeconds = DEFAULT_ACTION_TTL_SECONDS,
} = {}) {
  const id = safeString(actionId);
  if (!id || !env?.AGENT_ACTION_KV || typeof env.AGENT_ACTION_KV.put !== 'function') {
    return { ok: false, reason: 'action_kv_unavailable' };
  }
  assertNoSecretShape(record, 'Telegram action records must not serialize secrets.');
  await env.AGENT_ACTION_KV.put(`${ACTION_KV_PREFIX}${id}`, JSON.stringify(record), {
    expirationTtl: ttlSeconds,
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

function groupSessionBindingKey(normalized = {}) {
  const chatId = safeString(normalized.chat?.chatId);
  return chatId ? `${GROUP_SESSION_KV_PREFIX}${chatId}` : '';
}

async function persistGroupSessionBinding({
  env = {},
  normalized = {},
  session = {},
  createdAt = null,
} = {}) {
  if (normalized.chat?.isPrivate) return { ok: false, reason: 'private_chat' };
  const key = groupSessionBindingKey(normalized);
  if (!key || !env?.AGENT_ACTION_KV || typeof env.AGENT_ACTION_KV.put !== 'function') {
    return { ok: false, reason: 'action_kv_unavailable' };
  }
  const record = {
    version: 1,
    chatId: safeString(normalized.chat?.chatId),
    sessionSlug: sanitizeSessionSlug(session.sessionSlug || session.slug),
    sessionName: sessionLabel(session),
    linkedAt: createdAt || nowIso(),
  };
  if (!record.sessionSlug) return { ok: false, reason: 'session_slug_missing' };
  assertNoSecretShape(record, 'Telegram group session bindings must not serialize secrets.');
  await env.AGENT_ACTION_KV.put(key, JSON.stringify(record), {
    expirationTtl: DEFAULT_GROUP_SESSION_TTL_SECONDS,
  });
  return { ok: true, sessionSlug: record.sessionSlug };
}

async function readGroupSessionBinding(env = {}, normalized = {}) {
  if (normalized.chat?.isPrivate) return null;
  const key = groupSessionBindingKey(normalized);
  if (!key || !env?.AGENT_ACTION_KV || typeof env.AGENT_ACTION_KV.get !== 'function') return null;
  const parsed = safeJsonParse(await env.AGENT_ACTION_KV.get(key).catch(() => null), null);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
  assertNoSecretShape(parsed, 'Telegram group session bindings must not serialize secrets.');
  const sessionSlug = sanitizeSessionSlug(parsed.sessionSlug);
  return sessionSlug ? { ...parsed, sessionSlug } : null;
}

function privateSessionBindingKey(normalized = {}) {
  const telegramUserId = safeString(normalized.user?.telegramUserId);
  return telegramUserId ? `${PRIVATE_SESSION_KV_PREFIX}${telegramUserId}` : '';
}

async function persistPrivateSessionBinding({
  env = {},
  normalized = {},
  session = {},
  createdAt = null,
} = {}) {
  if (!normalized.chat?.isPrivate) return { ok: false, reason: 'not_private_chat' };
  const key = privateSessionBindingKey(normalized);
  if (!key || !env?.AGENT_ACTION_KV || typeof env.AGENT_ACTION_KV.put !== 'function') {
    return { ok: false, reason: 'action_kv_unavailable' };
  }
  const record = {
    version: 1,
    telegramUserId: safeString(normalized.user?.telegramUserId),
    sessionSlug: sanitizeSessionSlug(session.sessionSlug || session.slug),
    sessionName: sessionLabel(session),
    selectedAt: createdAt || nowIso(),
  };
  if (!record.sessionSlug) return { ok: false, reason: 'session_slug_missing' };
  assertNoSecretShape(record, 'Telegram private session bindings must not serialize secrets.');
  await env.AGENT_ACTION_KV.put(key, JSON.stringify(record), {
    expirationTtl: DEFAULT_GROUP_SESSION_TTL_SECONDS,
  });
  return { ok: true, sessionSlug: record.sessionSlug };
}

async function readPrivateSessionBinding(env = {}, normalized = {}) {
  if (!normalized.chat?.isPrivate) return null;
  const key = privateSessionBindingKey(normalized);
  if (!key || !env?.AGENT_ACTION_KV || typeof env.AGENT_ACTION_KV.get !== 'function') return null;
  const parsed = safeJsonParse(await env.AGENT_ACTION_KV.get(key).catch(() => null), null);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
  assertNoSecretShape(parsed, 'Telegram private session bindings must not serialize secrets.');
  const sessionSlug = sanitizeSessionSlug(parsed.sessionSlug);
  return sessionSlug ? { ...parsed, sessionSlug } : null;
}

function answerDraftKey({
  normalized = {},
  sessionSlug = '',
  questionId: selectedQuestionId = '',
} = {}) {
  const telegramUserId = safeString(normalized.user?.telegramUserId);
  const slug = sanitizeSessionSlug(sessionSlug);
  const qid = questionIdSeedPart(selectedQuestionId || 'question');
  return telegramUserId && slug && qid
    ? `${ANSWER_DRAFT_KV_PREFIX}${telegramUserId}:${slug}:${qid}`
    : '';
}

async function readAnswerDraft({
  env = {},
  normalized = {},
  sessionSlug = '',
  selectedQuestionId = '',
} = {}) {
  const key = answerDraftKey({ normalized, sessionSlug, questionId: selectedQuestionId });
  if (!key || !env?.AGENT_ACTION_KV || typeof env.AGENT_ACTION_KV.get !== 'function') return null;
  const parsed = safeJsonParse(await env.AGENT_ACTION_KV.get(key).catch(() => null), null);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
  assertNoSecretShape(parsed, 'Telegram answer drafts must not serialize secrets.');
  return { ...parsed, key };
}

async function deleteAnswerDraft({
  env = {},
  normalized = {},
  sessionSlug = '',
  selectedQuestionId = '',
} = {}) {
  const key = answerDraftKey({ normalized, sessionSlug, questionId: selectedQuestionId });
  if (!key || !env?.AGENT_ACTION_KV || typeof env.AGENT_ACTION_KV.delete !== 'function') {
    return { ok: false, reason: 'action_kv_delete_unavailable' };
  }
  await env.AGENT_ACTION_KV.delete(key);
  return { ok: true, key };
}

async function persistAnswerDraft({
  env = {},
  normalized = {},
  sessionSlug = '',
  selectedQuestionId = '',
  answerLabel = '',
  answerValue = '',
  controlType = '',
  submitLane = TELEGRAM_CHAT_LANES.PRIVATE_ACCOUNT,
  createdAt = null,
} = {}) {
  const key = answerDraftKey({ normalized, sessionSlug, questionId: selectedQuestionId });
  if (!key || !env?.AGENT_ACTION_KV || typeof env.AGENT_ACTION_KV.put !== 'function') {
    return { ok: false, reason: 'action_kv_unavailable' };
  }
  const record = {
    version: 1,
    telegramUserId: safeString(normalized.user?.telegramUserId),
    chatId: safeString(normalized.chat?.chatId),
    sessionSlug: sanitizeSessionSlug(sessionSlug),
    questionId: safeString(selectedQuestionId),
    answerLabel: safeString(answerLabel),
    answerValue: safeString(answerValue || answerLabel),
    controlType: safeString(controlType),
    status: 'draft_saved',
    submitLane: safeString(submitLane) || TELEGRAM_CHAT_LANES.PRIVATE_ACCOUNT,
    selectedAt: createdAt || nowIso(),
  };
  if (!record.telegramUserId || !record.sessionSlug || !record.questionId || !record.answerLabel) {
    return { ok: false, reason: 'answer_draft_incomplete' };
  }
  assertNoSecretShape(record, 'Telegram answer drafts must not serialize secrets.');
  await env.AGENT_ACTION_KV.put(key, JSON.stringify(record), {
    expirationTtl: DEFAULT_GROUP_SESSION_TTL_SECONDS,
  });
  return { ok: true, key, draft: record };
}

async function persistTelegramSubmitRequest({
  env = {},
  normalized = {},
  draft = {},
  sessionSlug = '',
  selectedQuestionId = '',
  createdAt = null,
} = {}) {
  if (!env?.AGENT_ACTION_KV || typeof env.AGENT_ACTION_KV.put !== 'function') {
    return { ok: false, reason: 'action_kv_unavailable' };
  }
  const telegramUserId = safeString(normalized.user?.telegramUserId);
  const slug = sanitizeSessionSlug(sessionSlug || draft.sessionSlug);
  const qid = safeString(selectedQuestionId || draft.questionId);
  if (!telegramUserId || !slug || !qid || draft.status !== 'draft_saved') {
    return { ok: false, reason: 'submit_request_incomplete' };
  }
  const answerFingerprint = stableFingerprint({
    answerLabel: safeString(draft.answerLabel),
    answerValue: safeString(draft.answerValue),
    controlType: safeString(draft.controlType),
  });
  const idempotencyKey = `telegram_bot_submit:${telegramUserId}:${slug}:${questionIdSeedPart(qid)}:${answerFingerprint}`;
  const requestId = buildOpaqueActionId(idempotencyKey);
  const kvKey = `${SUBMIT_REQUEST_KV_PREFIX}${requestId}`;
  const existing = env.AGENT_ACTION_KV && typeof env.AGENT_ACTION_KV.get === 'function'
    ? safeJsonParse(await env.AGENT_ACTION_KV.get(kvKey).catch(() => null), null)
    : null;
  if (existing && typeof existing === 'object' && !Array.isArray(existing)) {
    assertNoSecretShape(existing, 'Telegram submit requests must not serialize secrets.');
    return {
      ok: true,
      requestId,
      status: existing.status || 'submit_request_created',
      canonicalApiRequest: existing.canonicalApiRequest || null,
      idempotencyKey,
      onChain: existing.onChain || null,
      replayed: true,
    };
  }
  const policy = await loadSessionPolicy(env);
  const resolved = resolveSessionInvocation(policy, slug);
  const session = resolved.ok ? resolved.session : { sessionSlug: slug };
  const principal = normalizeTelegramPrincipal(normalized);
  const account = await deriveManagedDemoAccount({
    principal,
    deploymentId: env.AGENT_BRIDGE_DEPLOYMENT_ID || 'agent-bridge-live-demo',
    rootSecret: env.DEMO_SIGNER_ROOT_SECRET || '',
    lifecycle: AGENT_BRIDGE_EVENT_TYPES.ACCOUNT_CREATED,
    createdAt,
  });
  const directSubmit = await submitTelegramResponseOnChain({
    env,
    session,
    account,
    principal,
    questionRef: {
      sessionSlug: slug,
      questionId: qid,
    },
    answer: onChainAnswerFromDraft(draft),
    idempotencyKey,
    createdAt,
    contractFactory: env.AGENT_BRIDGE_CONTRACT_FACTORY,
  });
  if (directSubmit.ok === true || directSubmit.skipped !== true) {
    const record = {
      version: 1,
      requestId,
      idempotencyKey,
      answerFingerprint,
      action: TELEGRAM_BRIDGE_ACTIONS.DIRECT_SUBMIT_RESPONSE,
      status: directSubmit.ok === true ? 'direct_submitted' : 'direct_submit_failed',
      lane: TELEGRAM_CHAT_LANES.PRIVATE_ACCOUNT,
      telegramUserId,
      chatId: safeString(normalized.chat?.chatId),
      sessionSlug: slug,
      questionId: qid,
      questionIdShort: shortQuestionId(qid),
      answer: {
        label: safeString(draft.answerLabel),
        value: safeString(draft.answerValue),
        controlType: safeString(draft.controlType),
      },
      answerRef: draft.key ? { kind: 'telegram_answer_draft', key: draft.key } : null,
      canonicalApiRequest: {
        method: 'POST',
        path: '/api/agent/responses/submit-request',
        status: directSubmit.ok === true ? 'executed_direct_onchain' : 'direct_submit_failed',
        body: {
          session: slug,
          questionId: qid,
          answerRef: 'telegram_private_answer_ref',
          idempotencyKey,
        },
      },
      onChain: directSubmit,
      createdAt,
    };
    assertNoSecretShape(record, 'Telegram direct submit records must not serialize secrets.');
    await env.AGENT_ACTION_KV.put(kvKey, JSON.stringify(record), {
      expirationTtl: SUBMIT_REQUEST_TTL_SECONDS,
    });
    return directSubmit.ok === true
      ? {
        ok: true,
        requestId,
        status: record.status,
        canonicalApiRequest: record.canonicalApiRequest,
        idempotencyKey,
        onChain: directSubmit,
        replayed: false,
      }
      : {
        ok: false,
        reason: directSubmit.reason || 'direct_submit_failed',
        error: directSubmit.error || directSubmit.reason || 'direct_submit_failed',
        requestId,
        status: record.status,
        canonicalApiRequest: record.canonicalApiRequest,
        idempotencyKey,
        onChain: directSubmit,
        replayed: false,
      };
  }
  const record = {
    version: 1,
    requestId,
    idempotencyKey,
    answerFingerprint,
    action: TELEGRAM_BRIDGE_ACTIONS.SUBMIT_RESPONSE,
    status: 'submit_request_created',
    lane: TELEGRAM_CHAT_LANES.PRIVATE_ACCOUNT,
    telegramUserId,
    chatId: safeString(normalized.chat?.chatId),
    sessionSlug: slug,
    questionId: qid,
    questionIdShort: shortQuestionId(qid),
    answer: {
      label: safeString(draft.answerLabel),
      value: safeString(draft.answerValue),
      controlType: safeString(draft.controlType),
    },
    answerRef: draft.key ? { kind: 'telegram_answer_draft', key: draft.key } : null,
    canonicalApiRequest: {
      method: 'POST',
      path: '/api/agent/responses/submit-request',
      status: 'pending_canonical_handoff',
      body: {
        session: slug,
        questionId: qid,
        answerRef: 'telegram_private_answer_ref',
        idempotencyKey,
      },
    },
    directSubmitAttempt: directSubmit,
    createdAt,
  };
  assertNoSecretShape(record, 'Telegram submit requests must not serialize secrets.');
  await env.AGENT_ACTION_KV.put(kvKey, JSON.stringify(record), {
    expirationTtl: SUBMIT_REQUEST_TTL_SECONDS,
  });
  return {
    ok: true,
    requestId,
    status: record.status,
    canonicalApiRequest: record.canonicalApiRequest,
    idempotencyKey,
    directSubmitAttempt: directSubmit,
    replayed: false,
  };
}

async function persistAgentRequestRecord({
  env = {},
  requestId = '',
  record = {},
  ttlSeconds = SUBMIT_REQUEST_TTL_SECONDS,
} = {}) {
  const id = safeString(requestId);
  if (!id || !env?.AGENT_ACTION_KV || typeof env.AGENT_ACTION_KV.put !== 'function') {
    return { ok: false, reason: 'action_kv_unavailable' };
  }
  assertNoSecretShape(record, 'Telegram agent request records must not serialize secrets.');
  await env.AGENT_ACTION_KV.put(`${AGENT_REQUEST_KV_PREFIX}${id}`, JSON.stringify(record), {
    expirationTtl: ttlSeconds,
  });
  return { ok: true, requestId: id };
}

async function resolveCommandSessionSlug({
  env = {},
  normalized = {},
  policy = {},
  explicitSessionSlug = '',
} = {}) {
  const explicit = sanitizeSessionSlug(explicitSessionSlug);
  if (explicit) return explicit;
  const privateBinding = await readPrivateSessionBinding(env, normalized);
  if (privateBinding?.sessionSlug) return privateBinding.sessionSlug;
  const binding = await readGroupSessionBinding(env, normalized);
  return sanitizeSessionSlug(binding?.sessionSlug || policy.defaultSessionSlug || 'general') || 'general';
}

async function resolveResponseExportSessionSlug({
  env = {},
  normalized = {},
  policy = {},
  explicitSessionSlug = '',
  createdAt = null,
} = {}) {
  const explicit = sanitizeSessionSlug(explicitSessionSlug);
  if (explicit) return explicit;
  const privateBinding = await readPrivateSessionBinding(env, normalized);
  if (privateBinding?.sessionSlug) return privateBinding.sessionSlug;
  const latestSubmittedSession = sanitizeSessionSlug(await findLatestResponseExportSessionSlugForTelegramUser({
    env,
    normalized,
    createdAt,
  }));
  if (latestSubmittedSession) return latestSubmittedSession;
  const binding = await readGroupSessionBinding(env, normalized);
  return sanitizeSessionSlug(binding?.sessionSlug || policy.defaultSessionSlug || 'general') || 'general';
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

async function makePrivateStartActionButton({
  env = {},
  botUsername = '',
  label = '',
  action = '',
  serverContextRef = {},
  seed = '',
  createdAt = null,
} = {}) {
  const username = normalizeBotUsername(botUsername);
  if (!username) {
    return makeCallbackButton({
      env,
      label,
      action,
      lane: TELEGRAM_CHAT_LANES.PRIVATE_ACCOUNT,
      serverContextRef,
      seed: seed || `private_action|${action}|${stableFingerprint(serverContextRef)}`,
      createdAt,
    });
  }
  const start = createTelegramStartAction({
    seed: seed || `private_start_action|${action}|${stableFingerprint(serverContextRef)}`,
    action,
    lane: TELEGRAM_CHAT_LANES.PRIVATE_ACCOUNT,
    serverContextRef,
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

function resolveMiniAppBaseUrl(env = {}) {
  const configured = safeString(env.AGENT_BRIDGE_MINI_APP_URL);
  const publicUrl = safeString(env.AGENT_BRIDGE_PUBLIC_URL).replace(/\/+$/, '');
  const candidate = configured || (publicUrl ? `${publicUrl}/telegram/mini-app` : '');
  if (!candidate) return '';
  try {
    const url = new URL(candidate);
    const isLocal = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    if (url.protocol !== 'https:' && !(url.protocol === 'http:' && isLocal)) return '';
    return url.toString();
  } catch {
    return '';
  }
}

function miniAppUrlForLaunch(env = {}, launch = '') {
  const base = resolveMiniAppBaseUrl(env);
  if (!base) return '';
  const url = new URL(base);
  const payload = safeString(launch);
  if (payload) url.searchParams.set('launch', payload);
  return url.toString();
}

async function makeMiniAppButton({
  env = {},
  label = 'Open Mini App',
  action = TELEGRAM_BRIDGE_ACTIONS.VIEW_QUESTIONS,
  serverContextRef = {},
  seed = '',
  createdAt = null,
  privateChat = false,
  botUsername = '',
} = {}) {
  if (!resolveMiniAppBaseUrl(env)) return null;
  let callback;
  try {
    callback = createRandomTelegramCallbackAction({
      action,
      lane: TELEGRAM_CHAT_LANES.MINI_APP,
      serverContextRef,
      createdAt,
    });
  } catch {
    return null;
  }
  const stored = await persistActionRecord(env, callback.callbackData, {
    ...callback.record,
    callbackData: callback.callbackData,
    miniAppLaunch: true,
  });
  if (!stored.ok) return null;
  const url = miniAppUrlForLaunch(env, callback.callbackData);
  if (!url) return null;
  if (privateChat) {
    return {
      text: safeString(label),
      web_app: { url },
    };
  }
  const username = normalizeBotUsername(botUsername || env.TELEGRAM_BOT_USERNAME);
  return username ? {
    text: safeString(label),
    url: `https://t.me/${username}?start=${callback.callbackData}`,
  } : null;
}

async function makeAnswerButton({
  env = {},
  sessionSlug = '',
  selectedQuestionId = '',
  control = {},
  seed = '',
  createdAt = null,
} = {}) {
  const label = safeString(control.label).slice(0, 48);
  return makeCallbackButton({
    env,
    label,
    action: TELEGRAM_BRIDGE_ACTIONS.DRAFT_RESPONSE,
    lane: TELEGRAM_CHAT_LANES.PRIVATE_ACCOUNT,
    serverContextRef: {
      sessionSlug,
      questionId: selectedQuestionId,
      answerLabel: label,
      answerValue: safeString(control.value || label),
      controlType: safeString(control.controlType),
      submitLane: TELEGRAM_CHAT_LANES.PRIVATE_ACCOUNT,
    },
    seed: seed || `answer|${sessionSlug}|${questionIdSeedPart(selectedQuestionId)}|${safeString(control.controlType)}|${label}`,
    createdAt,
  });
}

async function buildAnswerButtonRows({
  env = {},
  sessionSlug = '',
  selectedQuestionId = '',
  controls = [],
  createdAt = null,
} = {}) {
  const buttons = [];
  for (const [index, control] of controls.entries()) {
    buttons.push(await makeAnswerButton({
      env,
      sessionSlug,
      selectedQuestionId,
      control,
      seed: `answer|${sessionSlug}|${questionIdSeedPart(selectedQuestionId)}|${index}|${safeString(control.label)}`,
      createdAt,
    }));
  }
  const rows = [];
  const numeric = buttons.every((button) => /^\d{1,2}$/.test(button.text));
  const chunkSize = numeric ? 4 : 2;
  for (let index = 0; index < buttons.length; index += chunkSize) {
    rows.push(buttons.slice(index, index + chunkSize));
  }
  return rows;
}

function reply({
  method = 'sendMessage',
  chatId = '',
  messageId = '',
  text = '',
  photo = null,
  document = null,
  replyMarkup = null,
  parseMode = '',
  screen = '',
  command = '',
  normalized = {},
  extra = {},
  preserveTextWhitespace = false,
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
      text: preserveTextWhitespace ? String(text || '') : safeString(text),
      photo,
      document,
      replyMarkup,
      parseMode: safeString(parseMode),
    },
    ...extra,
  };
}

function callbackOnly({
  normalized = {},
  command = 'callback',
  callbackQueryId = '',
  callbackAnswerText = '',
  callbackAnswerShowAlert = false,
  screen = '',
  extra = {},
} = {}) {
  return {
    ok: true,
    command,
    screen,
    updateId: normalized.updateId ?? null,
    callbackQueryId: safeString(callbackQueryId),
    callbackAnswerText: safeString(callbackAnswerText),
    callbackAnswerShowAlert: callbackAnswerShowAlert === true,
    response: null,
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
    text: text || 'That action is not available. Try /sessions or /start.',
    command,
    normalized,
    extra: {
      ok: false,
      reason,
    },
  });
}

function attachCallbackQueryId(commandResponse = {}, callbackQueryId = '') {
  const id = safeString(callbackQueryId);
  return id ? { ...commandResponse, callbackQueryId: id } : commandResponse;
}

function answerControlsFromPoseState(state = {}) {
  const controls = Array.isArray(state.card?.controls) ? state.card.controls : [];
  return controls.filter((control) => (
    control?.action === TELEGRAM_BRIDGE_ACTIONS.DRAFT_RESPONSE &&
    ANSWER_BUTTON_CONTROL_TYPES.has(safeString(control.controlType)) &&
    safeString(control.label)
  ));
}

function formatHelpText() {
  return [
    'Context Engine',
    '',
    '/sessions - list linked sessions',
    '/questions - view session questions',
    '/q <number> - pose a question',
    '/results [ consensus | group ] - view results',
    '/attachments - view attachments',
    '/me - view your account',
  ].join('\n');
}

function sessionVisibleInTelegram(session = {}) {
  const name = `${safeString(session.sessionSlug)} ${safeString(session.sessionName)}`;
  // Temporary smoke-test hygiene: hide old E2E registry spam until session metadata
  // has a durable production flag for Telegram visibility.
  if (/\be2e\b|e2e/i.test(name)) return false;
  return session.telegramBridgeEnabled === true;
}

function telegramVisibleSessions(policy = {}) {
  return (Array.isArray(policy.linkedSessions) ? policy.linkedSessions : [])
    .filter(sessionVisibleInTelegram);
}

async function makeResponseExportButton({
  env,
  normalized,
  policy,
  sessionSlug = '',
  seed = '',
  createdAt,
} = {}) {
  if (!normalized.chat?.isPrivate) return null;
  const resolvedSessionSlug = await resolveResponseExportSessionSlug({
    env,
    normalized,
    policy,
    explicitSessionSlug: sessionSlug,
    createdAt,
  });
  const resolved = resolveSessionInvocation(policy, resolvedSessionSlug);
  if (!resolved.ok) return null;
  const allowed = await canExportResponsesForTelegramUser({
    env,
    normalized,
    session: resolved.session,
    createdAt,
  });
  if (!allowed.ok) return null;
  return makeCallbackButton({
    env,
    label: 'export_all',
    action: TELEGRAM_BRIDGE_ACTIONS.EXPORT_ALL_RESPONSES,
    lane: TELEGRAM_CHAT_LANES.PRIVATE_ACCOUNT,
    serverContextRef: { sessionSlug: resolved.session.sessionSlug },
    seed: seed || `export_all|${resolved.session.sessionSlug}|${normalized.user.telegramUserId}|${normalized.updateId}`,
    createdAt,
  });
}

async function makeResponseExportAccessButton({
  env,
  normalized,
  policy,
  sessionSlug = '',
  seed = '',
  createdAt,
} = {}) {
  if (!normalized.chat?.isPrivate) return null;
  const resolvedSessionSlug = await resolveResponseExportSessionSlug({
    env,
    normalized,
    policy,
    explicitSessionSlug: sessionSlug,
    createdAt,
  });
  const resolved = resolveSessionInvocation(policy, resolvedSessionSlug);
  if (!resolved.ok) return null;
  const allowed = await canManageResponseExportAllowlist({
    env,
    normalized,
    session: resolved.session,
    createdAt,
  });
  if (!allowed.ok) return null;
  return makeCallbackButton({
    env,
    label: 'export_access',
    action: TELEGRAM_BRIDGE_ACTIONS.MANAGE_RESPONSE_EXPORT_ACCESS,
    lane: TELEGRAM_CHAT_LANES.PRIVATE_ACCOUNT,
    serverContextRef: { sessionSlug: resolved.session.sessionSlug },
    seed: seed || `export_access|${resolved.session.sessionSlug}|${normalized.user.telegramUserId}|${normalized.updateId}`,
    createdAt,
  });
}

async function buildHelpResponse({ normalized, command = COMMANDS.START, env, createdAt }) {
  const policy = await loadSessionPolicy(env);
  const privateBinding = normalized.chat.isPrivate
    ? await readPrivateSessionBinding(env, normalized)
    : null;
  const miniAppButton = await makeMiniAppButton({
    env,
    label: 'Open Mini App',
    action: TELEGRAM_BRIDGE_ACTIONS.VIEW_QUESTIONS,
    serverContextRef: privateBinding?.sessionSlug
      ? { sessionSlug: privateBinding.sessionSlug }
      : { sessionPicker: true },
    seed: `help|mini_app|${privateBinding?.sessionSlug || 'session_picker'}|${normalized.user.telegramUserId}|${normalized.updateId}`,
    createdAt,
    privateChat: normalized.chat.isPrivate,
    botUsername: env.TELEGRAM_BOT_USERNAME,
  });
  const keyboard = [];
  if (miniAppButton) {
    miniAppButton.text = 'Mini App';
    keyboard.push([miniAppButton]);
  }
  const exportButton = await makeResponseExportButton({
    env,
    normalized,
    policy,
    sessionSlug: privateBinding?.sessionSlug || '',
    createdAt,
  });
  if (exportButton) keyboard.push([exportButton]);
  const exportAccessButton = await makeResponseExportAccessButton({
    env,
    normalized,
    policy,
    sessionSlug: privateBinding?.sessionSlug || '',
    createdAt,
  });
  if (exportAccessButton) keyboard.push([exportAccessButton]);
  return reply({
    chatId: normalized.chat.chatId,
    text: formatHelpText(),
    replyMarkup: keyboard.length ? { inline_keyboard: keyboard } : null,
    screen: 'setup_welcome',
    command,
    normalized,
  });
}

async function buildSessionsResponse({
  normalized,
  command,
  env,
  createdAt,
  method = 'sendMessage',
  messageId = '',
  pageOffset = 0,
} = {}) {
  const policy = await loadSessionPolicy(env, { forceRefresh: true });
  const availableSessions = telegramVisibleSessions(policy);
  const sessions = availableSessions;
  const offset = Math.max(0, Math.min(Number(pageOffset) || 0, Math.max(0, sessions.length - 1)));
  const visibleSessions = sessions.slice(offset, offset + TELEGRAM_SESSION_LIST_LIMIT);
  const rows = [];
  for (const session of visibleSessions) {
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
  if (offset + TELEGRAM_SESSION_LIST_LIMIT < sessions.length) {
    rows.push([await makeCallbackButton({
      env,
      label: 'Load Next',
      action: TELEGRAM_BRIDGE_ACTIONS.LIST_SESSIONS,
      lane: normalized.chat.isPrivate ? TELEGRAM_CHAT_LANES.PRIVATE_ACCOUNT : TELEGRAM_CHAT_LANES.GROUP_LOBBY,
      serverContextRef: { pageOffset: offset + TELEGRAM_SESSION_LIST_LIMIT },
      seed: `sessions|next|${offset + TELEGRAM_SESSION_LIST_LIMIT}|${normalized.chat.chatId}|${normalized.updateId}`,
      createdAt,
    })]);
  }
  return reply({
    method,
    chatId: normalized.chat.chatId,
    messageId,
    text: [
      `Sessions (${Math.min(offset + visibleSessions.length, sessions.length)}/${sessions.length})`,
      '',
      ...(visibleSessions.length
        ? visibleSessions.map((session) => `- ${session.sessionSlug} (${sessionLabel(session)})`)
        : ['No Telegram-enabled sessions are available.']),
    ].join('\n'),
    replyMarkup: { inline_keyboard: rows },
    screen: 'group_session_card',
    command,
    normalized,
  });
}

async function buildAgentActionsResponse({
  normalized,
  command,
  env,
  method = 'sendMessage',
  messageId = '',
  sessionSlugOverride = '',
  createdAt,
} = {}) {
  const policy = await loadSessionPolicy(env);
  const sessionSlug = await resolveCommandSessionSlug({
    env,
    normalized,
    policy,
    explicitSessionSlug: sessionSlugOverride,
  });
  const lane = normalized.chat.isPrivate ? TELEGRAM_CHAT_LANES.PRIVATE_ACCOUNT : TELEGRAM_CHAT_LANES.GROUP_LOBBY;
  const state = buildTelegramAgentActionMenuState({ lane, sessionSlug, createdAt });
  const rows = [];
  if (normalized.chat.isPrivate) {
    rows.push([
      await makeCallbackButton({
        env,
        label: 'Settings',
        action: TELEGRAM_BRIDGE_ACTIONS.VIEW_AGENT_SETTINGS,
        lane: TELEGRAM_CHAT_LANES.PRIVATE_ACCOUNT,
        serverContextRef: { sessionSlug },
        seed: `agent_actions|settings|${sessionSlug}|${normalized.user.telegramUserId}|${normalized.updateId}`,
        createdAt,
      }),
    ]);
  } else {
    rows.push([
      await makePrivateStartActionButton({
        env,
        botUsername: env.TELEGRAM_BOT_USERNAME,
        label: 'Settings',
        action: TELEGRAM_BRIDGE_ACTIONS.VIEW_AGENT_SETTINGS,
        serverContextRef: { sessionSlug, groupChatId: normalized.chat.chatId },
        seed: `agent_actions|group_settings|${sessionSlug}|${normalized.chat.chatId}|${normalized.updateId}`,
        createdAt,
      }),
    ]);
  }
  rows.push([
    await makeCallbackButton({
      env,
      label: 'View Questions',
      action: TELEGRAM_BRIDGE_ACTIONS.VIEW_QUESTIONS,
      lane,
      serverContextRef: { sessionSlug },
      seed: `agent_actions|questions|${sessionSlug}|${normalized.updateId}`,
      createdAt,
    }),
  ]);
  const miniAppButton = await makeMiniAppButton({
    env,
    label: 'Open Mini App',
    action: TELEGRAM_BRIDGE_ACTIONS.AGENT_ACTION_MENU,
    serverContextRef: { sessionSlug },
    seed: `agent_actions|mini_app|${sessionSlug}|${normalized.updateId}`,
    createdAt,
    privateChat: normalized.chat.isPrivate,
    botUsername: env.TELEGRAM_BOT_USERNAME,
  });
  if (miniAppButton) rows.push([miniAppButton]);
  return reply({
    method,
    chatId: normalized.chat.chatId,
    messageId,
    text: [
      'Agent actions',
      `Session: ${sessionSlug}`,
      '',
      normalized.chat.isPrivate
        ? 'Edit settings or launch session workflows.'
        : 'Account and settings inputs open in private chat or Mini App.',
    ].join('\n'),
    replyMarkup: { inline_keyboard: rows },
    screen: state.screen,
    command,
    normalized,
    extra: {
      sessionSlug,
      catalog: state.catalog,
      capabilityCount: state.capabilities.length,
      canonicalApiRequest: state.canonicalApiRequest,
    },
  });
}

async function buildJoinResponse({
  normalized,
  command,
  env,
  args = [],
  sessionSlugOverride = '',
  createdAt,
  waitUntil = null,
} = {}) {
  const policy = await loadSessionPolicy(env, { forceRefresh: true });
  const sessionSlug = sanitizeSessionSlug(sessionSlugOverride || args[0] || policy.defaultSessionSlug || 'general') || 'general';
  const resolved = resolveSessionInvocation(policy, sessionSlug);
  if (!resolved.ok) {
    return errorReply({
      normalized,
      command,
      reason: resolved.reason,
      text: `Session "${sessionSlug}" is not available. Run /sessions to see sessions.`,
    });
  }

  if (normalized.chat.isPrivate) {
    await persistPrivateSessionBinding({
      env,
      normalized,
      session: resolved.session,
      createdAt,
    });
    const questionPrefetch = await prefetchQuestionsForJoinedSession({
      env,
      sessionSlug: resolved.session.sessionSlug,
      waitUntil,
    });
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
    const faucet = await requestManagedAccountFaucetOnJoin({
      env,
      session: resolved.session,
      account,
      principal: normalizeTelegramPrincipal(normalized),
      createdAt,
    }).catch((error) => ({
      ok: false,
      reason: 'faucet_request_failed',
      error: safeString(error?.message || error),
    }));
    return reply({
      chatId: normalized.chat.chatId,
      text: [
        `Joined session: ${sessionLabel(resolved.session)}`,
        '',
        `Account: ${shortAddress(account.accountAddress)}`,
        `Chain: ${chainDisplayName(env.DEFAULT_CHAIN_ID || '11155420')}`,
        questionAvailabilityLine(questionPrefetch),
        '',
        'Use /attachments for session files.',
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
      extra: { sessionSlug: resolved.session.sessionSlug, faucet, questionPrefetch },
    });
  }

  const group = normalizeTelegramGroup(normalized);
  await persistGroupSessionBinding({
    env,
    normalized,
    session: resolved.session,
    createdAt,
  });
  const questionPrefetch = await prefetchQuestionsForJoinedSession({
    env,
    sessionSlug: resolved.session.sessionSlug,
    waitUntil,
  });
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
      label: 'Attachments',
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
      questionAvailabilityLine(questionPrefetch),
      '',
      'Use /attachments for session files.',
    ].join('\n'),
    replyMarkup: { inline_keyboard: [buttons] },
    screen: state.screen,
    command,
    normalized,
    extra: { sessionSlug: resolved.session.sessionSlug, questionPrefetch },
  });
}

async function buildQuestionsResponse({
  normalized,
  command,
  env,
  args = [],
  sessionSlugOverride = '',
  introText = '',
  method = 'sendMessage',
  messageId = '',
  createdAt,
  waitUntil = null,
  pageOffset = 0,
} = {}) {
  const policy = await loadSessionPolicy(env);
  const sessionSlug = await resolveCommandSessionSlug({
    env,
    normalized,
    policy,
    explicitSessionSlug: sessionSlugOverride || args[0],
  });
  const resolved = resolveSessionInvocation(policy, sessionSlug);
  if (!resolved.ok) {
    return errorReply({
      normalized,
      command,
      reason: resolved.reason,
      text: `Session "${sessionSlug}" is not available. Run /sessions to see sessions.`,
      method,
      messageId,
    });
  }
  const loadedQuestions = await loadQuestionsForSession(env, resolved.session.sessionSlug, { waitUntil });
  const questions = loadedQuestions.questions;
  const state = buildTelegramQuestionListState({
    sessionSlug: resolved.session.sessionSlug,
    questions,
    createdAt,
  });
  const loadFailed = loadedQuestions.ok === false;
  const rows = [];
  const offset = Math.max(0, Math.min(Number(pageOffset) || 0, Math.max(0, state.questions.length - 1)));
  const displayQuestions = state.questions.slice(offset, offset + TELEGRAM_QUESTION_LIST_LIMIT);
  const promptLines = loadFailed
    ? [questionLoadIssueText(loadedQuestions)]
    : displayQuestions.map(questionListPromptLine);
  if (!loadFailed) {
    for (const [index, question] of displayQuestions.entries()) {
      rows.push([await makeCallbackButton({
        env,
        label: telegramButtonLabel(`Pose ${question.displayIndex}`, `Pose ${offset + index + 1}`),
        action: TELEGRAM_BRIDGE_ACTIONS.POSE_QUESTION,
        lane: TELEGRAM_CHAT_LANES.GROUP_LOBBY,
        serverContextRef: { sessionSlug: resolved.session.sessionSlug, questionId: questionId(question) },
        seed: `questions|pose|${resolved.session.sessionSlug}|${questionIdSeedPart(questionId(question))}|${normalized.updateId}`,
        createdAt,
      })]);
    }
    if (offset + TELEGRAM_QUESTION_LIST_LIMIT < state.questions.length) {
      rows.push([await makeCallbackButton({
        env,
        label: 'Load Next',
        action: TELEGRAM_BRIDGE_ACTIONS.VIEW_QUESTIONS,
        lane: normalized.chat.isPrivate ? TELEGRAM_CHAT_LANES.PRIVATE_ACCOUNT : TELEGRAM_CHAT_LANES.GROUP_LOBBY,
        serverContextRef: {
          sessionSlug: resolved.session.sessionSlug,
          pageOffset: offset + TELEGRAM_QUESTION_LIST_LIMIT,
        },
        seed: `questions|next|${resolved.session.sessionSlug}|${offset + TELEGRAM_QUESTION_LIST_LIMIT}|${normalized.updateId}`,
        createdAt,
      })]);
    }
  }
  return reply({
    method,
    chatId: normalized.chat.chatId,
    messageId,
    text: [
      `Questions (${Math.min(offset + displayQuestions.length, state.questions.length)}/${state.questions.length})`,
      '',
      ...(promptLines.length ? promptLines : ['No questions are available.']),
    ].join('\n'),
    replyMarkup: rows.length ? { inline_keyboard: rows } : null,
    screen: state.screen,
    command,
    normalized,
    extra: {
      sessionSlug: resolved.session.sessionSlug,
      questionCount: state.count,
      questionSource: loadedQuestions.source || 'telegram_worker_question_cache',
      questionSourceReason: loadedQuestions.reason || '',
    },
  });
}

function normalizeResultAnswerLabel(value = '') {
  const label = safeString(value);
  const normalized = lower(label);
  if (normalized === 'agree' || normalized === 'yes' || normalized === 'true') return 'Agree';
  if (normalized === 'disagree' || normalized === 'no' || normalized === 'false') return 'Disagree';
  if (normalized === 'unsure' || normalized === 'unknown') return 'Unsure';
  return label || 'Response';
}

async function listKvRecordsByPrefix(env = {}, prefix = '', {
  limit = 200,
} = {}) {
  const kv = env?.AGENT_ACTION_KV;
  if (!kv || typeof kv.list !== 'function' || typeof kv.get !== 'function') return [];
  const records = [];
  let cursor = undefined;
  do {
    const page = await kv.list({
      prefix,
      limit: Math.min(1000, Math.max(1, Number(limit) || 200)),
      ...(cursor ? { cursor } : {}),
    }).catch(() => null);
    const keys = Array.isArray(page?.keys) ? page.keys : [];
    for (const entry of keys) {
      const key = safeString(entry?.name || entry);
      if (!key) continue;
      const record = safeJsonParse(await kv.get(key).catch(() => null), null);
      if (record && typeof record === 'object' && !Array.isArray(record)) {
        records.push({ ...record, key });
      }
      if (records.length >= limit) return records;
    }
    cursor = page?.list_complete === false ? safeString(page.cursor) : '';
  } while (cursor);
  return records;
}

async function loadSubmittedResultRecords(env = {}, sessionSlug = '') {
  const slug = sanitizeSessionSlug(sessionSlug);
  const records = await listKvRecordsByPrefix(env, SUBMIT_REQUEST_KV_PREFIX, { limit: 500 });
  return records
    .filter((record) => (
      record?.status === 'direct_submitted' &&
      sanitizeSessionSlug(record.sessionSlug) === slug &&
      safeString(record.questionId)
    ))
    .map((record) => ({
      key: safeString(record.key),
      createdAt: safeString(record.createdAt),
      telegramUserId: safeString(record.telegramUserId),
      questionId: safeString(record.questionId),
      label: normalizeResultAnswerLabel(record.answer?.label || record.answer?.value || record.answer?.text),
      txHash: safeString(record.onChain?.txHash),
    }))
    .sort((left, right) => safeString(left.createdAt).localeCompare(safeString(right.createdAt)));
}

function questionPromptById(questions = []) {
  const map = new Map();
  for (const question of questions) {
    const id = questionId(question);
    if (id) map.set(id, questionText(question));
  }
  return map;
}

function summarizeQuestionResults(records = [], questions = []) {
  const promptMap = questionPromptById(questions);
  const byQuestion = new Map();
  for (const record of records) {
    if (!byQuestion.has(record.questionId)) {
      byQuestion.set(record.questionId, {
        questionId: record.questionId,
        prompt: promptMap.get(record.questionId) || shortQuestionId(record.questionId),
        total: 0,
        participants: new Set(),
        counts: new Map(),
      });
    }
    const item = byQuestion.get(record.questionId);
    item.total += 1;
    if (record.telegramUserId) item.participants.add(record.telegramUserId);
    item.counts.set(record.label, (item.counts.get(record.label) || 0) + 1);
  }
  return Array.from(byQuestion.values()).map((item) => {
    const counts = Array.from(item.counts.entries()).sort(([left], [right]) => left.localeCompare(right));
    const maxCount = counts.reduce((max, [, count]) => Math.max(max, count), 0);
    const differenceScore = item.total > 0 ? 1 - (maxCount / item.total) : 0;
    return {
      ...item,
      participants: item.participants.size,
      counts,
      differenceScore,
      hasDifference: counts.length > 1,
    };
  }).sort((left, right) => (
    right.differenceScore - left.differenceScore ||
    right.total - left.total ||
    left.prompt.localeCompare(right.prompt)
  ));
}

function demoDifferenceRows(questions = []) {
  const prompts = questions.length ? questions.map(questionText) : [
    'Arriving 10 minutes early is better than arriving exactly on time.',
    'A supply-chain risk review should block launch when evidence is incomplete.',
    'Participants should explain uncertainty before choosing Agree or Disagree.',
  ];
  return prompts.slice(0, 3).map((prompt, index) => ({
    prompt,
    counts: index === 0
      ? [['Agree', 4], ['Disagree', 4], ['Unsure', 2]]
      : index === 1
      ? [['Agree', 5], ['Disagree', 3], ['Unsure', 2]]
      : [['Agree', 3], ['Disagree', 3], ['Unsure', 4]],
    total: 10,
    demo: true,
  }));
}

function beeswarmRowsFromResultRows(rows = []) {
  return rows.slice(0, 3).map((row, index) => ({
    label: `Q${index + 1}`,
    prompt: row.prompt,
    answers: row.counts.flatMap(([label, count]) => (
      new Array(Math.max(0, Number(count || 0))).fill(label)
    )),
  }));
}

function formatCounts(counts = []) {
  return counts.map(([label, count]) => `${label} ${count}`).join(' | ');
}

function participantAlias(id = '', index = 0) {
  return `P${index + 1}`;
}

function buildParticipantGraph(records = [], questions = []) {
  const questionIds = Array.from(new Set(records.map((record) => record.questionId).filter(Boolean)));
  const questionIndex = new Map(questionIds.map((id, index) => [id, `Q${index + 1}`]));
  const participants = Array.from(new Set(records.map((record) => record.telegramUserId).filter(Boolean)));
  const aliases = new Map(participants.map((id, index) => [id, participantAlias(id, index)]));
  const lines = participants.map((id) => {
    const answered = records
      .filter((record) => record.telegramUserId === id)
      .map((record) => `${questionIndex.get(record.questionId) || 'Q?'}:${record.label}`);
    return `${aliases.get(id)} -> ${answered.join(', ') || 'No answers'}`;
  });
  const promptMap = questionPromptById(questions);
  const legend = questionIds.slice(0, 5).map((id, index) => `${index + 1}. ${promptMap.get(id) || shortQuestionId(id)}`);
  const imageParticipants = participants.slice(0, 8).map((id) => ({
    participant: aliases.get(id),
    answers: records
      .filter((record) => record.telegramUserId === id)
      .map((record) => ({
        question: questionIndex.get(record.questionId) || 'Q?',
        label: record.label,
      })),
  }));
  return { lines, legend, participants: imageParticipants, participantCount: participants.length, questionCount: questionIds.length };
}

async function buildResultsModeButtons({
  env = {},
  sessionSlug = '',
  createdAt = null,
} = {}) {
  return [[
    await makeCallbackButton({
      env,
      label: 'Consensus',
      action: TELEGRAM_BRIDGE_ACTIONS.VIEW_RESULTS,
      lane: TELEGRAM_CHAT_LANES.GROUP_LOBBY,
      serverContextRef: { sessionSlug, resultMode: 'consensus' },
      seed: `results|consensus|${sessionSlug}`,
      createdAt,
    }),
    await makeCallbackButton({
      env,
      label: 'Group',
      action: TELEGRAM_BRIDGE_ACTIONS.VIEW_RESULTS,
      lane: TELEGRAM_CHAT_LANES.GROUP_LOBBY,
      serverContextRef: { sessionSlug, resultMode: 'group' },
      seed: `results|group|${sessionSlug}`,
      createdAt,
    }),
  ]];
}

async function buildResultsOptionsResponse({
  normalized,
  command,
  env,
  sessionSlug = '',
  intro = 'Choose a results view.',
  createdAt = null,
} = {}) {
  const lines = [
    'Results',
    '',
    intro,
    '',
    'Consensus: highlights questions with the most disagreement across responses.',
    'Group: shows participant answer patterns by question using P1, P2, etc.',
    '',
    '/results [ consensus | group ]',
  ];
  return reply({
    chatId: normalized.chat.chatId,
    text: lines.join('\n'),
    replyMarkup: {
      inline_keyboard: await buildResultsModeButtons({ env, sessionSlug, createdAt }),
    },
    screen: 'results_options',
    command,
    normalized,
    extra: { sessionSlug },
  });
}

async function buildResultsResponse({
  normalized,
  command,
  env,
  args = [],
  sessionSlugOverride = '',
  createdAt,
} = {}) {
  const modeArg = lower(args[0] || '');
  const mode = modeArg || '';
  const policy = await loadSessionPolicy(env);
  const sessionSlug = await resolveCommandSessionSlug({
    env,
    normalized,
    policy,
    explicitSessionSlug: sessionSlugOverride,
  });
  const resolved = resolveSessionInvocation(policy, sessionSlug);
  if (!resolved.ok) {
    return errorReply({
      normalized,
      command,
      reason: resolved.reason,
      text: `Session "${sessionSlug}" is not available. Run /sessions to see sessions.`,
    });
  }
  if (!mode) {
    return buildResultsOptionsResponse({
      normalized,
      command,
      env,
      sessionSlug: resolved.session.sessionSlug,
      createdAt,
    });
  }
  if (!['consensus', 'group'].includes(mode)) {
    return buildResultsOptionsResponse({
      normalized,
      command,
      env,
      sessionSlug: resolved.session.sessionSlug,
      intro: `Unknown results view "${modeArg}". Choose one of these options.`,
      createdAt,
    });
  }
  const loadedQuestions = await loadQuestionsForSession(env, resolved.session.sessionSlug);
  const questions = Array.isArray(loadedQuestions.questions) ? loadedQuestions.questions : [];
  const records = await loadSubmittedResultRecords(env, resolved.session.sessionSlug);
  if (mode === 'group') {
    const graph = buildParticipantGraph(records, questions);
    const hasEnoughLiveGraph = records.length >= 4 && graph.participantCount >= 2 && graph.questionCount >= 2;
    const demo = !hasEnoughLiveGraph;
    const lines = demo
      ? [
        'Participants graph (demo data)',
        'Demo mode until enough live submissions are available.',
        'P1 -> Q1:Agree, Q2:Unsure',
        'P2 -> Q1:Disagree, Q2:Agree',
        '',
        ...demoDifferenceRows(questions).map((row, index) => `${index + 1}. ${row.prompt}`),
      ]
      : [
        'Participants graph',
        `Responses: ${records.length}`,
        ...graph.lines,
        ...(graph.legend.length ? ['', ...graph.legend] : []),
      ];
    const image = buildResultsImage({
      mode,
      sessionTitle: resolved.session.sessionName || resolved.session.sessionSlug,
      responseCount: records.length,
      demo,
      lines,
      participants: demo ? [] : graph.participants,
    });
    return reply({
      method: 'sendPhoto',
      chatId: normalized.chat.chatId,
      text: lines.join('\n'),
      photo: image,
      screen: 'results_group',
      command,
      normalized,
      extra: { sessionSlug: resolved.session.sessionSlug, resultMode: mode, responseCount: records.length, demo },
    });
  }
  const summaries = summarizeQuestionResults(records, questions);
  const liveDifference = summaries.filter((summary) => summary.hasDifference && summary.total >= 2).slice(0, 3);
  const demo = liveDifference.length === 0;
  const rows = demo ? demoDifferenceRows(questions) : liveDifference;
  const lines = [
    demo ? 'Beeswarm (demo data)' : 'Beeswarm',
    ...(demo ? ['Demo mode until enough overlapping live responses are available.'] : [`Live responses: ${records.length}`]),
    'Most difference',
    ...rows.map((row, index) => `${index + 1}. ● ${row.prompt}\n   ${formatCounts(row.counts)}`),
  ];
  const image = buildResultsImage({
    mode,
    sessionTitle: resolved.session.sessionName || resolved.session.sessionSlug,
    responseCount: records.length,
    demo,
    lines,
    beeswarmRows: beeswarmRowsFromResultRows(rows),
  });
  return reply({
    method: 'sendPhoto',
    chatId: normalized.chat.chatId,
    text: lines.join('\n'),
    photo: image,
    screen: 'results_consensus',
    command,
    normalized,
    extra: { sessionSlug: resolved.session.sessionSlug, resultMode: mode, responseCount: records.length, demo },
  });
}

async function buildExportAllResponse({
  normalized,
  command,
  env,
  args = [],
  sessionSlugOverride = '',
  createdAt,
} = {}) {
  if (!normalized.chat.isPrivate) {
    return reply({
      chatId: normalized.chat.chatId,
      text: 'Response export is available in private chat only. Open a private chat with the bot and run /export_all.',
      screen: 'response_export_private_required',
      command,
      normalized,
    });
  }
  const policy = await loadSessionPolicy(env);
  const sessionSlug = await resolveResponseExportSessionSlug({
    env,
    normalized,
    policy,
    explicitSessionSlug: sessionSlugOverride || args[0],
    createdAt,
  });
  const resolved = resolveSessionInvocation(policy, sessionSlug);
  if (!resolved.ok) {
    return errorReply({
      normalized,
      command,
      reason: resolved.reason,
      text: `Session "${sessionSlug}" is not available. Run /sessions to see sessions.`,
    });
  }
  const exported = await buildTelegramResponseExportArchive({
    env,
    normalized,
    session: resolved.session,
    createdAt,
  });
  if (!exported.ok) {
    return reply({
      chatId: normalized.chat.chatId,
      text: [
        'Response export is not available for this account.',
        `Reason: ${exported.reason || 'export_failed'}.`,
        exported.accountAddress ? `Account: ${shortAddress(exported.accountAddress)}` : '',
      ].filter(Boolean).join('\n'),
      screen: 'response_export_denied',
      command,
      normalized,
      extra: {
        reason: exported.reason || 'export_failed',
        accountAddress: exported.accountAddress || '',
        sessionSlug: resolved.session.sessionSlug,
      },
    });
  }
  return reply({
    method: 'sendDocument',
    chatId: normalized.chat.chatId,
    text: [
      `Response export for ${resolved.session.sessionSlug}.`,
      `Payloads: ${exported.exportedPayloadCount}. Submit records: ${exported.submitRecordCount}.`,
      exported.readErrorCount ? `Read errors: ${exported.readErrorCount}.` : '',
    ].filter(Boolean).join('\n'),
    document: exported.document,
    screen: 'response_export',
    command,
    normalized,
    extra: {
      sessionSlug: resolved.session.sessionSlug,
      accountAddress: exported.accountAddress,
      exportedPayloadCount: exported.exportedPayloadCount,
      submitRecordCount: exported.submitRecordCount,
      readErrorCount: exported.readErrorCount,
    },
  });
}

function parseExportAddressCommandArgs(args = []) {
  const address = args.find((arg) => ADDRESS_RE.test(safeString(arg))) || '';
  const sessionArg = args.find((arg) => safeString(arg) && safeString(arg) !== address) || '';
  return { address, sessionSlug: sessionArg };
}

function formatExportAddressList(addresses = [], {
  empty = 'None.',
  includeMetadata = false,
} = {}) {
  const entries = Array.isArray(addresses) ? addresses : [];
  if (!entries.length) return empty;
  return entries.map((entry) => {
    const address = typeof entry === 'string' ? entry : entry?.address;
    const addedAt = typeof entry === 'string' ? '' : safeString(entry?.addedAt);
    const suffix = includeMetadata && addedAt ? ` added ${addedAt}` : '';
    return `- ${shortAddress(address)}${suffix}`;
  }).join('\n');
}

async function buildExportAccessResponse({
  normalized,
  command,
  env,
  args = [],
  sessionSlugOverride = '',
  createdAt,
} = {}) {
  if (!normalized.chat.isPrivate) {
    return reply({
      chatId: normalized.chat.chatId,
      text: 'Response export access can be managed in private chat only.',
      screen: 'response_export_access_private_required',
      command,
      normalized,
    });
  }
  const policy = await loadSessionPolicy(env);
  const sessionSlug = await resolveCommandSessionSlug({
    env,
    normalized,
    policy,
    explicitSessionSlug: sessionSlugOverride || args[0],
  });
  const resolved = resolveSessionInvocation(policy, sessionSlug);
  if (!resolved.ok) {
    return errorReply({
      normalized,
      command,
      reason: resolved.reason,
      text: `Session "${sessionSlug}" is not available. Run /sessions to see sessions.`,
    });
  }
  const manager = await canManageResponseExportAllowlist({
    env,
    normalized,
    session: resolved.session,
    createdAt,
  });
  if (!manager.ok) {
    return reply({
      chatId: normalized.chat.chatId,
      text: [
        'Response export access can only be managed by a configured export admin.',
        `Reason: ${manager.reason}.`,
        manager.accountAddress ? `Account: ${shortAddress(manager.accountAddress)}` : '',
      ].filter(Boolean).join('\n'),
      screen: 'response_export_access_denied',
      command,
      normalized,
      extra: {
        reason: manager.reason,
        accountAddress: manager.accountAddress || '',
        sessionSlug: resolved.session.sessionSlug,
      },
    });
  }
  const access = await listResponseExportAccess({ env, session: resolved.session });
  return reply({
    chatId: normalized.chat.chatId,
    text: [
      `Export access for ${resolved.session.sessionSlug}`,
      '',
      'Configured admins:',
      formatExportAddressList(access.configuredAdmins),
      '',
      'Additional exporters:',
      formatExportAddressList(access.additionalExporters, { includeMetadata: true }),
      '',
      `Add: /export_allow 0x... ${resolved.session.sessionSlug}`,
      `Remove: /export_revoke 0x... ${resolved.session.sessionSlug}`,
    ].join('\n'),
    screen: 'response_export_access',
    command,
    normalized,
    extra: {
      sessionSlug: resolved.session.sessionSlug,
      configuredAdminCount: access.configuredAdmins.length,
      additionalExporterCount: access.additionalExporters.length,
    },
  });
}

async function buildExportAllowResponse({
  normalized,
  command,
  env,
  args = [],
  createdAt,
} = {}) {
  if (!normalized.chat.isPrivate) {
    return reply({
      chatId: normalized.chat.chatId,
      text: 'Response export access can be managed in private chat only.',
      screen: 'response_export_access_private_required',
      command,
      normalized,
    });
  }
  const parsed = parseExportAddressCommandArgs(args);
  if (!parsed.address) {
    return reply({
      chatId: normalized.chat.chatId,
      text: 'Usage: /export_allow 0xAddress [session]',
      screen: 'response_export_access_usage',
      command,
      normalized,
    });
  }
  const policy = await loadSessionPolicy(env);
  const sessionSlug = await resolveCommandSessionSlug({
    env,
    normalized,
    policy,
    explicitSessionSlug: parsed.sessionSlug,
  });
  const resolved = resolveSessionInvocation(policy, sessionSlug);
  if (!resolved.ok) {
    return errorReply({
      normalized,
      command,
      reason: resolved.reason,
      text: `Session "${sessionSlug}" is not available. Run /sessions to see sessions.`,
    });
  }
  const result = await addResponseExportAllowedAddress({
    env,
    normalized,
    session: resolved.session,
    address: parsed.address,
    createdAt,
  });
  if (!result.ok) {
    return reply({
      chatId: normalized.chat.chatId,
      text: [
        'Could not add response export access.',
        `Reason: ${result.reason || 'response_export_access_update_failed'}.`,
        result.accountAddress ? `Account: ${shortAddress(result.accountAddress)}` : '',
      ].filter(Boolean).join('\n'),
      screen: 'response_export_access_denied',
      command,
      normalized,
      extra: {
        reason: result.reason || 'response_export_access_update_failed',
        sessionSlug: resolved.session.sessionSlug,
      },
    });
  }
  return reply({
    chatId: normalized.chat.chatId,
    text: [
      result.added ? 'Added response export access.' : 'Response export access already existed.',
      `Session: ${resolved.session.sessionSlug}`,
      `Address: ${shortAddress(result.address)}`,
      `Allowed exporters: ${result.allowedCount}`,
    ].join('\n'),
    screen: 'response_export_access_updated',
    command,
    normalized,
    extra: {
      sessionSlug: resolved.session.sessionSlug,
      address: result.address,
      added: result.added,
      allowedCount: result.allowedCount,
    },
  });
}

async function buildExportRevokeResponse({
  normalized,
  command,
  env,
  args = [],
  createdAt,
} = {}) {
  if (!normalized.chat.isPrivate) {
    return reply({
      chatId: normalized.chat.chatId,
      text: 'Response export access can be managed in private chat only.',
      screen: 'response_export_access_private_required',
      command,
      normalized,
    });
  }
  const parsed = parseExportAddressCommandArgs(args);
  if (!parsed.address) {
    return reply({
      chatId: normalized.chat.chatId,
      text: 'Usage: /export_revoke 0xAddress [session]',
      screen: 'response_export_access_usage',
      command,
      normalized,
    });
  }
  const policy = await loadSessionPolicy(env);
  const sessionSlug = await resolveCommandSessionSlug({
    env,
    normalized,
    policy,
    explicitSessionSlug: parsed.sessionSlug,
  });
  const resolved = resolveSessionInvocation(policy, sessionSlug);
  if (!resolved.ok) {
    return errorReply({
      normalized,
      command,
      reason: resolved.reason,
      text: `Session "${sessionSlug}" is not available. Run /sessions to see sessions.`,
    });
  }
  const result = await removeResponseExportAllowedAddress({
    env,
    normalized,
    session: resolved.session,
    address: parsed.address,
    createdAt,
  });
  if (!result.ok) {
    return reply({
      chatId: normalized.chat.chatId,
      text: [
        'Could not remove response export access.',
        `Reason: ${result.reason || 'response_export_access_update_failed'}.`,
        result.accountAddress ? `Account: ${shortAddress(result.accountAddress)}` : '',
      ].filter(Boolean).join('\n'),
      screen: 'response_export_access_denied',
      command,
      normalized,
      extra: {
        reason: result.reason || 'response_export_access_update_failed',
        sessionSlug: resolved.session.sessionSlug,
      },
    });
  }
  return reply({
    chatId: normalized.chat.chatId,
    text: [
      result.removed ? 'Removed response export access.' : 'Response export access was not present.',
      `Session: ${resolved.session.sessionSlug}`,
      `Address: ${shortAddress(result.address)}`,
      `Allowed exporters: ${result.allowedCount}`,
    ].join('\n'),
    screen: 'response_export_access_updated',
    command,
    normalized,
    extra: {
      sessionSlug: resolved.session.sessionSlug,
      address: result.address,
      removed: result.removed,
      allowedCount: result.allowedCount,
    },
  });
}

async function buildPoseQuestionResponse({
  normalized,
  command,
  env,
  args = [],
  sessionSlugOverride = '',
  questionIdOverride = '',
  method = 'sendMessage',
  messageId = '',
  createdAt,
  waitUntil = null,
} = {}) {
  const policy = await loadSessionPolicy(env);
  const sessionSlug = await resolveCommandSessionSlug({
    env,
    normalized,
    policy,
    explicitSessionSlug: sessionSlugOverride,
  });
  const resolved = resolveSessionInvocation(policy, sessionSlug);
  if (!resolved.ok) {
    return errorReply({
      normalized,
      command,
      reason: resolved.reason,
      text: `Session "${sessionSlug}" is not available. Run /sessions to see sessions.`,
    });
  }

  const selector = safeString(questionIdOverride || args.join(' '));
  if (!selector) {
    return buildQuestionsResponse({
      normalized,
      command,
      env,
      sessionSlugOverride: resolved.session.sessionSlug,
      introText: 'Choose a question to pose to the group.',
      method,
      messageId,
      createdAt,
      waitUntil,
    });
  }
  const loadedQuestions = await loadQuestionsForSession(env, resolved.session.sessionSlug, { waitUntil });
  const questions = loadedQuestions.questions;
  const matched = findQuestion(questions, selector);
  const selected = matched || (allowAdHocQuestions(env)
    ? buildAdHocQuestion(selector, {
        sessionSlug: resolved.session.sessionSlug,
        updateId: normalized.updateId,
      })
    : null);
  if (!selected) {
    return buildQuestionsResponse({
      normalized,
      command,
      env,
      sessionSlugOverride: resolved.session.sessionSlug,
      introText: 'That question was not found.',
      method,
      messageId,
      createdAt,
      waitUntil,
    });
  }

  const state = buildTelegramPoseQuestionState({
    sessionSlug: resolved.session.sessionSlug,
    question: selected,
    source: matched ? 'existing_session_question' : 'telegram_command',
    createdAt,
  });
  const group = state.groupSafeOutput || {};
  const payloadUnavailable = group.payloadUnavailable === true;
  const answerControls = group.locked || payloadUnavailable ? [] : answerControlsFromPoseState(state);
  const answerRows = await buildAnswerButtonRows({
    env,
    sessionSlug: resolved.session.sessionSlug,
    selectedQuestionId: group.questionId,
    controls: answerControls,
    createdAt,
  });
  const text = payloadUnavailable
    ? [
      'Question is unavailable.',
      'The public payload could not be loaded yet. Try /questions again later.',
    ].join('\n')
    : group.locked
    ? 'This question is locked. Open it in the Mini App.'
    : group.questionText;
  const miniAppButton = payloadUnavailable ? null : await makeMiniAppButton({
    env,
    label: 'Open Mini App',
    action: TELEGRAM_BRIDGE_ACTIONS.SUBMIT_RESPONSE,
    serverContextRef: {
      sessionSlug: resolved.session.sessionSlug,
      questionId: group.questionId,
    },
    seed: `pose|mini_app|${resolved.session.sessionSlug}|${questionIdSeedPart(group.questionId)}|${normalized.updateId}`,
    createdAt,
    privateChat: normalized.chat.isPrivate,
    botUsername: env.TELEGRAM_BOT_USERNAME,
  });
  const otherQuestionsButton = await makeCallbackButton({
    env,
    label: 'Other Questions',
    action: TELEGRAM_BRIDGE_ACTIONS.VIEW_QUESTIONS,
    lane: TELEGRAM_CHAT_LANES.GROUP_LOBBY,
    serverContextRef: { sessionSlug: resolved.session.sessionSlug },
    seed: `pose|questions|${resolved.session.sessionSlug}|${questionIdSeedPart(questionId(selected))}|${normalized.updateId}`,
    createdAt,
  });
  const actionRows = [
    ...answerRows,
    [otherQuestionsButton],
    ...(miniAppButton ? [[miniAppButton]] : []),
  ];
  return reply({
    method,
    chatId: normalized.chat.chatId,
    messageId,
    text,
    replyMarkup: {
      inline_keyboard: actionRows,
    },
    screen: state.screen,
    command,
    normalized,
    extra: {
      sessionSlug: resolved.session.sessionSlug,
      questionId: group.questionId,
      posed: group.locked !== true && payloadUnavailable !== true,
      payloadUnavailable,
    },
  });
}

async function buildAnswerDraftResponse({
  normalized,
  command,
  env,
  record = {},
  callbackQueryId = '',
  createdAt,
} = {}) {
  const ref = record.serverContextRef || {};
  const sessionSlug = sanitizeSessionSlug(ref.sessionSlug);
  const selectedQuestionId = safeString(ref.questionId);
  const answerLabel = safeString(ref.answerLabel);
  const answerValue = safeString(ref.answerValue || answerLabel);
  const controlType = safeString(ref.controlType);
  const saved = await persistAnswerDraft({
    env,
    normalized,
    sessionSlug,
    selectedQuestionId,
    answerLabel,
    answerValue,
    controlType,
    createdAt,
  });
  const submitted = saved.ok
    ? await persistTelegramSubmitRequest({
      env,
      normalized,
      draft: {
        ...saved.draft,
        key: saved.key,
      },
      sessionSlug,
      selectedQuestionId,
      createdAt,
    })
    : null;
  const ok = saved.ok === true && submitted?.ok === true;
  return callbackOnly({
    normalized,
    command,
    callbackQueryId,
    callbackAnswerText: ok
      ? 'Submitted.'
      : (saved.ok ? 'Answer saved, but submit failed. Try again.' : 'Answer could not be saved. Try again.'),
    callbackAnswerShowAlert: ok !== true,
    screen: 'submit_response',
    extra: {
      ok,
      reason: ok ? (submitted?.status || 'submit_request_created') : (saved.ok ? submitted?.reason : saved.reason),
      sessionSlug,
      questionId: selectedQuestionId,
      answerDraftSaved: saved.ok === true,
      submitRequestCreated: submitted?.ok === true,
      submitRequest: submitted?.ok ? submitted : null,
      onChainSubmitted: submitted?.status === 'direct_submitted',
      submitLane: TELEGRAM_CHAT_LANES.PRIVATE_ACCOUNT,
    },
  });
}

async function buildSubmitDraftResponse({
  normalized,
  command,
  env,
  record = {},
  callbackQueryId = '',
  createdAt,
} = {}) {
  const ref = record.serverContextRef || {};
  const sessionSlug = sanitizeSessionSlug(ref.sessionSlug);
  const selectedQuestionId = safeString(ref.questionId);
  const draft = await readAnswerDraft({
    env,
    normalized,
    sessionSlug,
    selectedQuestionId,
  });
  if (!draft) {
    return callbackOnly({
      normalized,
      command,
      callbackQueryId,
      callbackAnswerText: 'Tap an answer to submit.',
      callbackAnswerShowAlert: true,
      screen: 'submit_response',
      extra: {
        ok: false,
        reason: 'answer_draft_missing',
        sessionSlug,
        questionId: selectedQuestionId,
        submitRequestCreated: false,
      },
    });
  }
  const submitted = await persistTelegramSubmitRequest({
    env,
    normalized,
    draft,
    sessionSlug,
    selectedQuestionId,
    createdAt,
  });
  return callbackOnly({
    normalized,
    command,
    callbackQueryId,
    callbackAnswerText: submitted.ok
      ? 'Submitted.'
      : 'Submit failed. Try again.',
    callbackAnswerShowAlert: true,
    screen: 'submit_response',
    extra: {
      ok: submitted.ok === true,
      reason: submitted.ok ? (submitted.status || 'submit_request_created') : submitted.reason,
      sessionSlug,
      questionId: selectedQuestionId,
      submitRequestCreated: submitted.ok === true,
      submitRequest: submitted.ok ? submitted : null,
      onChainSubmitted: submitted.status === 'direct_submitted',
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
  const policy = await loadSessionPolicy(env);
  const sessionSlug = await resolveCommandSessionSlug({
    env,
    normalized,
    policy,
    explicitSessionSlug: sessionSlugOverride || args[0],
  });
  const resolved = resolveSessionInvocation(policy, sessionSlug);
  if (!resolved.ok) {
    return errorReply({
      normalized,
      command,
      reason: resolved.reason,
      text: `Session "${sessionSlug}" is not available. Run /sessions to see sessions.`,
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
    : ['No attachments are linked to this session yet.'];
  return reply({
    method,
    chatId: normalized.chat.chatId,
    messageId,
    text: [
      `Attachments for ${resolved.session.sessionSlug}:`,
      ...lines,
      '',
      'Private or gated files open in the Mini App.',
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
  const policy = await loadSessionPolicy(env);
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
  const explorerUrl = addressExplorerUrl(account.accountAddress, env.DEFAULT_CHAIN_ID || '11155420');
  const addressLabel = shortAddress(account.accountAddress);
  const addressDisplay = explorerUrl
    ? `<a href="${escapeTelegramHtml(explorerUrl)}">${escapeTelegramHtml(addressLabel)}</a>`
    : escapeTelegramHtml(addressLabel);
  const questionButton = await makeCallbackButton({
    env,
    label: 'View Questions',
    action: TELEGRAM_BRIDGE_ACTIONS.VIEW_QUESTIONS,
    lane: TELEGRAM_CHAT_LANES.PRIVATE_ACCOUNT,
    serverContextRef: { sessionSlug: policy.defaultSessionSlug || 'general' },
    seed: `me|questions|${normalized.user.telegramUserId}|${normalized.updateId}`,
    createdAt,
  });
  const exportButton = await makeResponseExportButton({
    env,
    normalized,
    policy,
    seed: `me|export_all|${normalized.user.telegramUserId}|${normalized.updateId}`,
    createdAt,
  });
  const exportAccessButton = await makeResponseExportAccessButton({
    env,
    normalized,
    policy,
    seed: `me|export_access|${normalized.user.telegramUserId}|${normalized.updateId}`,
    createdAt,
  });
  const rows = [[questionButton]];
  if (exportButton) rows.push([exportButton]);
  if (exportAccessButton) rows.push([exportAccessButton]);
  return reply({
    method,
    chatId: normalized.chat.chatId,
    messageId,
    text: [
      'Account',
      `Address: ${addressDisplay}`,
      `Chain: ${chainDisplayName(env.DEFAULT_CHAIN_ID || '11155420')}`,
      `Joined sessions: ${joinedSessions.map((session) => session.sessionSlug).join(', ') || 'none'}`,
      '',
      'Use /questions or /attachments.',
    ].join('\n'),
    replyMarkup: {
      inline_keyboard: rows,
    },
    parseMode: explorerUrl ? 'HTML' : '',
    screen: state.screen,
    command,
    normalized,
    extra: { accountMode: state.accountMode },
  });
}

async function buildCreateAgentResponse({
  normalized,
  command,
  env,
  method = 'sendMessage',
  messageId = '',
  sessionSlugOverride = '',
  createdAt,
} = {}) {
  const policy = await loadSessionPolicy(env);
  const sessionSlug = await resolveCommandSessionSlug({
    env,
    normalized,
    policy,
    explicitSessionSlug: sessionSlugOverride,
  });
  if (!normalized.chat.isPrivate) {
    return reply({
      method,
      chatId: normalized.chat.chatId,
      messageId,
      text: [
        'Account setup opens in private chat.',
        '',
        'No account state is shown in group chat.',
      ].join('\n'),
      replyMarkup: {
        inline_keyboard: [[
          await makePrivateStartActionButton({
            env,
            botUsername: env.TELEGRAM_BOT_USERNAME,
            label: 'Open Private Chat',
            action: TELEGRAM_BRIDGE_ACTIONS.CREATE_AGENT_ACCOUNT,
            serverContextRef: { sessionSlug, groupChatId: normalized.chat.chatId },
            seed: `create_agent|group_redirect|${sessionSlug}|${normalized.chat.chatId}|${normalized.updateId}`,
            createdAt,
          }),
        ]],
      },
      screen: 'agent_account_create',
      command,
      normalized,
      extra: {
        sessionSlug,
        privateChatRequired: true,
      },
    });
  }
  const account = await deriveManagedDemoAccount({
    principal: normalizeTelegramPrincipal(normalized),
    deploymentId: env.AGENT_BRIDGE_DEPLOYMENT_ID || 'agent-bridge-live-demo',
    rootSecret: env.DEMO_SIGNER_ROOT_SECRET || '',
    lifecycle: AGENT_BRIDGE_EVENT_TYPES.ACCOUNT_CREATED,
    createdAt,
  });
  const requestId = buildOpaqueActionId(`agent_account_create|${normalized.user.telegramUserId}|${sessionSlug}|${env.AGENT_BRIDGE_DEPLOYMENT_ID || 'agent-bridge-live-demo'}`);
  const state = buildTelegramAgentAccountCreateState({
    account,
    sessionSlug,
    requestId,
    idempotencyKey: requestId,
    createdAt,
  });
  await persistAgentRequestRecord({
    env,
    requestId,
    record: {
      version: 1,
      requestId,
      action: TELEGRAM_BRIDGE_ACTIONS.CREATE_AGENT_ACCOUNT,
      status: 'agent_account_create_request_created',
      lane: TELEGRAM_CHAT_LANES.PRIVATE_ACCOUNT,
      sessionSlug,
      accountMode: state.accountMode,
      managedAddress: state.managedAddress,
      canonicalApiRequest: state.canonicalApiRequest,
      createdAt,
    },
  });
  return reply({
    method,
    chatId: normalized.chat.chatId,
    messageId,
    text: [
      'Agent account',
      `Address: ${shortAddress(account.accountAddress)}`,
      `Mode: ${state.accountMode}`,
      '',
      `Canonical: ${state.canonicalApiRequest.method} ${state.canonicalApiRequest.path}`,
    ].join('\n'),
    replyMarkup: {
      inline_keyboard: [[
        await makeCallbackButton({
          env,
          label: 'Settings',
          action: TELEGRAM_BRIDGE_ACTIONS.VIEW_AGENT_SETTINGS,
          lane: TELEGRAM_CHAT_LANES.PRIVATE_ACCOUNT,
          serverContextRef: { sessionSlug },
          seed: `create_agent|settings|${sessionSlug}|${normalized.user.telegramUserId}|${normalized.updateId}`,
          createdAt,
        }),
        await makeCallbackButton({
          env,
          label: 'Actions',
          action: TELEGRAM_BRIDGE_ACTIONS.AGENT_ACTION_MENU,
          lane: TELEGRAM_CHAT_LANES.PRIVATE_ACCOUNT,
          serverContextRef: { sessionSlug },
          seed: `create_agent|actions|${sessionSlug}|${normalized.user.telegramUserId}|${normalized.updateId}`,
          createdAt,
        }),
      ]],
    },
    screen: state.screen,
    command,
    normalized,
    extra: {
      sessionSlug,
      requestId,
      canonicalApiRequest: state.canonicalApiRequest,
      accountMode: state.accountMode,
    },
  });
}

async function buildSettingsResponse({
  normalized,
  command,
  env,
  method = 'sendMessage',
  messageId = '',
  sessionSlugOverride = '',
  createdAt,
} = {}) {
  const policy = await loadSessionPolicy(env);
  const sessionSlug = await resolveCommandSessionSlug({
    env,
    normalized,
    policy,
    explicitSessionSlug: sessionSlugOverride,
  });
  if (!normalized.chat.isPrivate) {
    return reply({
      method,
      chatId: normalized.chat.chatId,
      messageId,
      text: [
        'Agent settings open in private chat or Mini App.',
        '',
        'Group chat does not show account settings.',
      ].join('\n'),
      replyMarkup: {
        inline_keyboard: [[
          await makePrivateStartActionButton({
            env,
            botUsername: env.TELEGRAM_BOT_USERNAME,
            label: 'Settings',
            action: TELEGRAM_BRIDGE_ACTIONS.VIEW_AGENT_SETTINGS,
            serverContextRef: { sessionSlug, groupChatId: normalized.chat.chatId },
            seed: `settings|group_redirect|${sessionSlug}|${normalized.chat.chatId}|${normalized.updateId}`,
            createdAt,
          }),
        ]],
      },
      screen: 'agent_settings_overview',
      command,
      normalized,
      extra: {
        sessionSlug,
        privateChatRequired: true,
      },
    });
  }
  const state = buildTelegramAgentSettingsOverviewState({
    settings: loadAgentSettings(env),
    sessionSlug,
    createdAt,
  });
  const editMiniAppButton = await makeMiniAppButton({
    env,
    label: 'Edit Settings',
    action: TELEGRAM_BRIDGE_ACTIONS.EDIT_AGENT_SETTINGS,
    serverContextRef: { sessionSlug },
    seed: `settings|mini_app_edit|${sessionSlug}|${normalized.user.telegramUserId}|${normalized.updateId}`,
    createdAt,
    privateChat: true,
    botUsername: env.TELEGRAM_BOT_USERNAME,
  });
  const editButton = editMiniAppButton || await makeCallbackButton({
    env,
    label: 'Edit Settings',
    action: TELEGRAM_BRIDGE_ACTIONS.EDIT_AGENT_SETTINGS,
    lane: TELEGRAM_CHAT_LANES.PRIVATE_ACCOUNT,
    serverContextRef: { sessionSlug },
    seed: `settings|edit|${sessionSlug}|${normalized.user.telegramUserId}|${normalized.updateId}`,
    createdAt,
  });
  return reply({
    method,
    chatId: normalized.chat.chatId,
    messageId,
    text: [
      'Agent settings',
      `Draft style: ${state.settings.draftStyle}`,
      `Telegram reminders: ${state.settings.telegramReminders ? 'on' : 'off'}`,
      '',
      `Canonical: ${state.canonicalApiRequest.method} ${state.canonicalApiRequest.path}`,
    ].join('\n'),
    replyMarkup: {
      inline_keyboard: [[editButton], [
        await makeCallbackButton({
          env,
          label: 'Actions',
          action: TELEGRAM_BRIDGE_ACTIONS.AGENT_ACTION_MENU,
          lane: TELEGRAM_CHAT_LANES.PRIVATE_ACCOUNT,
          serverContextRef: { sessionSlug },
          seed: `settings|actions|${sessionSlug}|${normalized.user.telegramUserId}|${normalized.updateId}`,
          createdAt,
        }),
      ]],
    },
    screen: state.screen,
    command,
    normalized,
    extra: {
      sessionSlug,
      settings: state.settings,
      canonicalApiRequest: state.canonicalApiRequest,
    },
  });
}

async function buildSettingsEditResponse({
  normalized,
  command,
  env,
  method = 'sendMessage',
  messageId = '',
  sessionSlugOverride = '',
  createdAt,
} = {}) {
  const policy = await loadSessionPolicy(env);
  const sessionSlug = await resolveCommandSessionSlug({
    env,
    normalized,
    policy,
    explicitSessionSlug: sessionSlugOverride,
  });
  const state = buildTelegramAgentSettingsEditState({
    settings: loadAgentSettings(env),
    sessionSlug,
    createdAt,
  });
  const miniAppButton = await makeMiniAppButton({
    env,
    label: 'Open Mini App',
    action: TELEGRAM_BRIDGE_ACTIONS.EDIT_AGENT_SETTINGS,
    serverContextRef: { sessionSlug },
    seed: `settings_edit|mini_app|${sessionSlug}|${normalized.user.telegramUserId}|${normalized.updateId}`,
    createdAt,
    privateChat: normalized.chat.isPrivate,
    botUsername: env.TELEGRAM_BOT_USERNAME,
  });
  return reply({
    method,
    chatId: normalized.chat.chatId,
    messageId,
    text: [
      'Edit settings',
      `Draft style: ${state.fields.find((field) => field.field === 'draftStyle')?.value || 'balanced'}`,
      `Telegram reminders: ${state.fields.find((field) => field.field === 'telegramReminders')?.value ? 'on' : 'off'}`,
      '',
      miniAppButton
        ? 'Use the Mini App to save settings.'
        : 'Mini App is not configured for settings input.',
    ].join('\n'),
    replyMarkup: miniAppButton ? { inline_keyboard: [[miniAppButton]] } : null,
    screen: state.screen,
    command,
    normalized,
    extra: {
      sessionSlug,
      canonicalApiRequest: state.canonicalApiRequest,
      miniAppConfigured: Boolean(miniAppButton),
    },
  });
}

function isMiniAppLaunchRecord(record = {}) {
  return record?.miniAppLaunch === true &&
    record?.lane === TELEGRAM_CHAT_LANES.MINI_APP &&
    [
      TELEGRAM_BRIDGE_ACTIONS.AGENT_ACTION_MENU,
      TELEGRAM_BRIDGE_ACTIONS.CREATE_AGENT_ACCOUNT,
      TELEGRAM_BRIDGE_ACTIONS.VIEW_AGENT_SETTINGS,
      TELEGRAM_BRIDGE_ACTIONS.EDIT_AGENT_SETTINGS,
      TELEGRAM_BRIDGE_ACTIONS.VIEW_QUESTIONS,
      TELEGRAM_BRIDGE_ACTIONS.SUBMIT_RESPONSE,
    ].includes(record.action);
}

function buildMiniAppStartResponse({
  normalized,
  command,
  env,
  record = {},
  launch = '',
} = {}) {
  const sessionSlug = sanitizeSessionSlug(record.serverContextRef?.sessionSlug) || 'general';
  const url = miniAppUrlForLaunch(env, launch);
  if (!normalized.chat.isPrivate) {
    return reply({
      chatId: normalized.chat.chatId,
      text: [
        'Open the Mini App from a private chat with the bot.',
        '',
        'Use /sessions in private chat to continue.',
      ].join('\n'),
      screen: 'private_start',
      command,
      normalized,
      extra: { sessionSlug, miniAppLaunch: true, privateChatRequired: true },
    });
  }
  if (!url) {
    return reply({
      chatId: normalized.chat.chatId,
      text: [
        'The Mini App URL is not configured for this worker.',
        '',
        'Use /questions to answer from Telegram for now.',
      ].join('\n'),
      screen: 'private_start',
      command,
      normalized,
      extra: { sessionSlug, miniAppLaunch: true, miniAppUrlConfigured: false },
    });
  }
  return reply({
    chatId: normalized.chat.chatId,
    text: [
      `Open the Mini App for ${sessionSlug}.`,
      '',
      'Use this private button for agent actions, settings, answers, and queued submissions.',
    ].join('\n'),
    replyMarkup: {
      inline_keyboard: [[{
        text: 'Open Mini App',
        web_app: { url },
      }]],
    },
    screen: 'private_start',
    command,
    normalized,
    extra: { sessionSlug, miniAppLaunch: true },
  });
}

async function buildStartPayloadResponse({
  normalized,
  command,
  env,
  payload = '',
  createdAt,
  waitUntil = null,
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
        'Run /sessions to continue.',
      ].join('\n'),
      screen: 'private_start',
      command,
      normalized,
      extra: { startPayload: parsed.actionId, active: false },
    });
  }
  if (isMiniAppLaunchRecord(record)) {
    return buildMiniAppStartResponse({
      normalized,
      command,
      env,
      record,
      launch: parsed.actionId,
      createdAt,
    });
  }
  if (record.action === TELEGRAM_BRIDGE_ACTIONS.AGENT_ACTION_MENU) {
    return buildAgentActionsResponse({
      normalized,
      command,
      env,
      sessionSlugOverride: record.serverContextRef?.sessionSlug || '',
      createdAt,
    });
  }
  if (record.action === TELEGRAM_BRIDGE_ACTIONS.CREATE_AGENT_ACCOUNT) {
    return buildCreateAgentResponse({
      normalized,
      command,
      env,
      sessionSlugOverride: record.serverContextRef?.sessionSlug || '',
      createdAt,
    });
  }
  if (record.action === TELEGRAM_BRIDGE_ACTIONS.VIEW_AGENT_SETTINGS) {
    return buildSettingsResponse({
      normalized,
      command,
      env,
      sessionSlugOverride: record.serverContextRef?.sessionSlug || '',
      createdAt,
    });
  }
  return buildJoinResponse({
    normalized,
    command,
    env,
    sessionSlugOverride: record.serverContextRef?.sessionSlug || '',
    createdAt,
    waitUntil,
  });
}

async function buildCallbackResponse({
  normalized,
  env,
  createdAt,
  waitUntil = null,
}) {
  const callbackData = safeString(normalized.callbackData);
  const parsed = parseOpaqueActionId(callbackData);
  const callback = normalized.raw?.callback_query || {};
  const callbackQueryId = safeString(callback.id);
  const message = callback.message || {};
  const method = message.chat?.id && message.message_id ? 'editMessageText' : 'sendMessage';
  const messageId = safeString(message.message_id);
  if (!parsed.ok) {
    return attachCallbackQueryId(errorReply({
      normalized,
      command: 'callback',
      reason: 'invalid_callback_data',
      text: 'This action is not available. Callback data must be an opaque Context Engine action id.',
      method,
      messageId,
    }), callbackQueryId);
  }
  const record = await readActionRecord(env, parsed.actionId);
  if (!record) {
    return attachCallbackQueryId(errorReply({
      normalized,
      command: 'callback',
      reason: 'action_not_found',
      text: 'This action expired. Run /sessions or /start to refresh the buttons.',
      method,
      messageId,
    }), callbackQueryId);
  }
  const sessionSlug = record.serverContextRef?.sessionSlug || '';
  if (record.action === TELEGRAM_BRIDGE_ACTIONS.AGENT_ACTION_MENU) {
    return attachCallbackQueryId(await buildAgentActionsResponse({
      normalized,
      command: 'callback:agent_action_menu',
      env,
      sessionSlugOverride: sessionSlug,
      method,
      messageId,
      createdAt,
    }), callbackQueryId);
  }
  if (record.action === TELEGRAM_BRIDGE_ACTIONS.CREATE_AGENT_ACCOUNT) {
    return attachCallbackQueryId(await buildCreateAgentResponse({
      normalized,
      command: 'callback:create_agent_account',
      env,
      sessionSlugOverride: sessionSlug,
      method,
      messageId,
      createdAt,
    }), callbackQueryId);
  }
  if (record.action === TELEGRAM_BRIDGE_ACTIONS.VIEW_AGENT_SETTINGS) {
    return attachCallbackQueryId(await buildSettingsResponse({
      normalized,
      command: 'callback:view_agent_settings',
      env,
      sessionSlugOverride: sessionSlug,
      method,
      messageId,
      createdAt,
    }), callbackQueryId);
  }
  if (record.action === TELEGRAM_BRIDGE_ACTIONS.EDIT_AGENT_SETTINGS) {
    return attachCallbackQueryId(await buildSettingsEditResponse({
      normalized,
      command: 'callback:edit_agent_settings',
      env,
      sessionSlugOverride: sessionSlug,
      method,
      messageId,
      createdAt,
    }), callbackQueryId);
  }
  if (record.action === TELEGRAM_BRIDGE_ACTIONS.LIST_SESSIONS) {
    return attachCallbackQueryId(await buildSessionsResponse({
      normalized,
      command: 'callback:list_sessions',
      env,
      method,
      messageId,
      pageOffset: record.serverContextRef?.pageOffset || 0,
      createdAt,
    }), callbackQueryId);
  }
  if (record.action === TELEGRAM_BRIDGE_ACTIONS.VIEW_QUESTIONS) {
    return attachCallbackQueryId(await buildQuestionsResponse({
      normalized,
      command: 'callback:view_questions',
      env,
      sessionSlugOverride: sessionSlug,
      method,
      messageId,
      createdAt,
      pageOffset: record.serverContextRef?.pageOffset || 0,
      waitUntil,
    }), callbackQueryId);
  }
  if (record.action === TELEGRAM_BRIDGE_ACTIONS.VIEW_RESULTS) {
    return attachCallbackQueryId(await buildResultsResponse({
      normalized,
      command: 'callback:view_results',
      env,
      args: [record.serverContextRef?.resultMode || ''],
      sessionSlugOverride: sessionSlug,
      method,
      messageId,
      createdAt,
    }), callbackQueryId);
  }
  if (record.action === TELEGRAM_BRIDGE_ACTIONS.EXPORT_ALL_RESPONSES) {
    return attachCallbackQueryId(await buildExportAllResponse({
      normalized,
      command: 'callback:export_all',
      env,
      sessionSlugOverride: sessionSlug,
      createdAt,
    }), callbackQueryId);
  }
  if (record.action === TELEGRAM_BRIDGE_ACTIONS.MANAGE_RESPONSE_EXPORT_ACCESS) {
    return attachCallbackQueryId(await buildExportAccessResponse({
      normalized,
      command: 'callback:export_access',
      env,
      sessionSlugOverride: sessionSlug,
      createdAt,
    }), callbackQueryId);
  }
  if (record.action === TELEGRAM_BRIDGE_ACTIONS.LIST_DOCS) {
    return attachCallbackQueryId(await buildDocsResponse({
      normalized,
      command: 'callback:list_docs',
      env,
      sessionSlugOverride: sessionSlug,
      method,
      messageId,
      createdAt,
      waitUntil,
    }), callbackQueryId);
  }
  if (record.action === TELEGRAM_BRIDGE_ACTIONS.POSE_QUESTION) {
    return attachCallbackQueryId(await buildPoseQuestionResponse({
      normalized,
      command: 'callback:pose_question',
      env,
      sessionSlugOverride: sessionSlug,
      questionIdOverride: record.serverContextRef?.questionId || '',
      method,
      messageId,
      createdAt,
      waitUntil,
    }), callbackQueryId);
  }
  if (record.action === TELEGRAM_BRIDGE_ACTIONS.DRAFT_RESPONSE) {
    return buildAnswerDraftResponse({
      normalized,
      command: 'callback:draft_response',
      env,
      record,
      callbackQueryId,
      createdAt,
    });
  }
  if (record.action === TELEGRAM_BRIDGE_ACTIONS.SUBMIT_RESPONSE) {
    return buildSubmitDraftResponse({
      normalized,
      command: 'callback:submit_response',
      env,
      record,
      callbackQueryId,
      createdAt,
    });
  }
  if (record.action === TELEGRAM_BRIDGE_ACTIONS.MY_ACCOUNT) {
    return attachCallbackQueryId(await buildMeResponse({
      normalized,
      command: 'callback:my_account',
      env,
      createdAt,
      method,
      messageId,
    }), callbackQueryId);
  }
  if ([TELEGRAM_BRIDGE_ACTIONS.JOIN_SESSION, TELEGRAM_BRIDGE_ACTIONS.START_PRIVATE].includes(record.action)) {
    return attachCallbackQueryId(await buildJoinResponse({
      normalized,
      command: 'callback:join_session',
      env,
      sessionSlugOverride: sessionSlug,
      createdAt,
      waitUntil,
    }), callbackQueryId);
  }
  return attachCallbackQueryId(errorReply({
    normalized,
    command: 'callback',
    reason: 'unsupported_callback_action',
    text: 'This action is not available yet.',
    method,
    messageId,
  }), callbackQueryId);
}

export async function buildTelegramCommandResponse({
  update = {},
  env = {},
  now = null,
  waitUntil = null,
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
    return buildCallbackResponse({ normalized, env, createdAt, waitUntil });
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
        waitUntil,
      })
      : buildHelpResponse({ normalized, command: parsed.command, env, createdAt });
  }
  if ([COMMANDS.ACTIONS, COMMANDS.AGENT].includes(parsed.command)) {
    return buildAgentActionsResponse({
      normalized,
      command: parsed.command,
      env,
      createdAt,
    });
  }
  if (parsed.command === COMMANDS.CREATE_AGENT) {
    return buildCreateAgentResponse({
      normalized,
      command: parsed.command,
      env,
      createdAt,
    });
  }
  if (parsed.command === COMMANDS.SETTINGS) {
    return buildSettingsResponse({
      normalized,
      command: parsed.command,
      env,
      createdAt,
    });
  }
  if (parsed.command === COMMANDS.JOIN) {
    return buildJoinResponse({
      normalized,
      command: parsed.command,
      env,
      args: parsed.args,
      createdAt,
      waitUntil,
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
      waitUntil,
    });
  }
  if ([COMMANDS.POSE_QUESTION, COMMANDS.POSE_QUESTION_SHORT].includes(parsed.command)) {
    return buildPoseQuestionResponse({
      normalized,
      command: parsed.command,
      env,
      args: parsed.args,
      createdAt,
      waitUntil,
    });
  }
  if (parsed.command === COMMANDS.RESULTS) {
    return buildResultsResponse({
      normalized,
      command: parsed.command,
      env,
      args: parsed.args,
      createdAt,
    });
  }
  if (parsed.command === COMMANDS.EXPORT_ALL) {
    return buildExportAllResponse({
      normalized,
      command: parsed.command,
      env,
      args: parsed.args,
      createdAt,
    });
  }
  if (parsed.command === COMMANDS.EXPORT_ACCESS) {
    return buildExportAccessResponse({
      normalized,
      command: parsed.command,
      env,
      args: parsed.args,
      createdAt,
    });
  }
  if (parsed.command === COMMANDS.EXPORT_ALLOW) {
    return buildExportAllowResponse({
      normalized,
      command: parsed.command,
      env,
      args: parsed.args,
      createdAt,
    });
  }
  if (parsed.command === COMMANDS.EXPORT_REVOKE) {
    return buildExportRevokeResponse({
      normalized,
      command: parsed.command,
      env,
      args: parsed.args,
      createdAt,
    });
  }
  if ([COMMANDS.ATTACHMENTS, COMMANDS.DOCS].includes(parsed.command)) {
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

function callbackQueryIdFromCommandResponse(commandResponse = {}) {
  return safeString(
    commandResponse.callbackQueryId ||
    commandResponse.normalized?.raw?.callback_query?.id ||
    commandResponse.normalized?.callbackQueryId
  );
}

export async function dispatchTelegramCommandResponse({
  commandResponse = {},
  env = {},
  fetchImpl = globalThis.fetch,
} = {}) {
  if (commandResponse.ignored === true) {
    return { ...commandResponse, telegram: { ok: true, skipped: true } };
  }
  const response = commandResponse.response;
  const botToken = env.TELEGRAM_BOT_TOKEN || '';
  const callbackQueryId = callbackQueryIdFromCommandResponse(commandResponse);
  const callbackAnswer = callbackQueryId
    ? await answerTelegramCallbackQuery({
      botToken,
      callbackQueryId,
      text: commandResponse.callbackAnswerText || '',
      showAlert: commandResponse.callbackAnswerShowAlert === true,
      fetchImpl,
    })
    : null;
  if (!response) {
    return {
      ...commandResponse,
      telegram: {
        ok: true,
        skipped: true,
        callbackAnswer: callbackAnswer ? summarizeTelegramSendResult(callbackAnswer) : null,
      },
    };
  }
  let sendResult;
  if (response.method === 'editMessageText') {
    sendResult = await editTelegramMessageText({
      botToken,
      chatId: response.chatId,
      messageId: response.messageId,
      text: response.text,
      replyMarkup: response.replyMarkup,
      parseMode: response.parseMode,
      fetchImpl,
    });
  } else if (response.method === 'sendPhoto' && response.photo) {
    sendResult = await sendTelegramPhoto({
      botToken,
      chatId: response.chatId,
      photo: response.photo,
      caption: response.text,
      replyMarkup: response.replyMarkup,
      parseMode: response.parseMode,
      fetchImpl,
    });
    if (!sendResult?.ok) {
      sendResult = await sendTelegramMessage({
        botToken,
        chatId: response.chatId,
        text: response.text,
        replyMarkup: response.replyMarkup,
        parseMode: response.parseMode,
        fetchImpl,
      });
    }
  } else if (response.method === 'sendDocument' && response.document) {
    sendResult = await sendTelegramDocument({
      botToken,
      chatId: response.chatId,
      document: response.document,
      caption: response.text,
      replyMarkup: response.replyMarkup,
      parseMode: response.parseMode,
      fetchImpl,
    });
    if (!sendResult?.ok) {
      sendResult = await sendTelegramMessage({
        botToken,
        chatId: response.chatId,
        text: response.text,
        replyMarkup: response.replyMarkup,
        parseMode: response.parseMode,
        fetchImpl,
      });
    }
  } else {
    sendResult = await sendTelegramMessage({
      botToken,
      chatId: response.chatId,
      text: response.text,
      replyMarkup: response.replyMarkup,
      parseMode: response.parseMode,
      fetchImpl,
    });
  }
  return {
    ...commandResponse,
    telegram: {
      ...summarizeTelegramSendResult(sendResult),
      callbackAnswer: callbackAnswer ? summarizeTelegramSendResult(callbackAnswer) : null,
    },
  };
}

export async function handleTelegramWebhookUpdate({
  update = {},
  env = {},
  fetchImpl = globalThis.fetch,
  now = null,
  waitUntil = null,
} = {}) {
  const commandResponse = await buildTelegramCommandResponse({ update, env, now, waitUntil });
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
  AGENT_REQUEST_KV_PREFIX,
  ANSWER_DRAFT_KV_PREFIX,
  COMMANDS,
  deleteAnswerDraft,
  loadSessionPolicy,
  loadQuestionsForSession,
  parseTelegramCommandText,
  persistActionRecord,
  persistAnswerDraft,
  questionId,
  readActionRecord,
  readAnswerDraft,
  shortQuestionId,
  SUBMIT_REQUEST_KV_PREFIX,
};
