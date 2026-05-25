import {
  RISK_CEILINGS,
  TELEGRAM_BRIDGE_ACTIONS,
  TELEGRAM_CHAT_LANES,
} from './constants.mjs';
import {
  buildCanonicalAgentRequest,
  listAgentApiCapabilities,
} from './agentApiCatalog.mjs';
import { deriveManagedDemoAccount } from './managedAccounts.mjs';
import {
  authenticateSessionWorker,
  resolveSessionWorkerUrl,
  submitTelegramResponseOnChain,
} from './onChainResponses.mjs';
import { buildOpaqueActionId, createTelegramCallbackAction, parseOpaqueActionId } from './opaqueActions.mjs';
import {
  buildTelegramAgentSettingsEditState,
  buildTelegramAgentSettingsOverviewState,
  buildTelegramPoseQuestionState,
} from './questionUi.mjs';
import { assertNoSecretShape } from './redaction.mjs';
import {
  evaluateSponsoredResourceEligibility,
  resolveSessionInvocation,
} from './sessionPolicy.mjs';
import {
  buildQueuedSubmitRecord,
  queueTelegramSubmitRecord,
  SUBMITTED_RESULT_STATUSES,
  telegramSubmitQueueEnabled,
} from './telegramSubmitQueue.mjs';
import { buildResultsImage } from './resultImage.mjs';
import {
  loadTelegramLightweightGroups,
  saveTelegramLightweightGroupMembership,
} from './telegramGroups.mjs';
import {
  analyzeParticipantResultGroup,
  buildParticipantGraph,
  consensusQuestionsForResults,
  loadQuestionsForSession,
  loadSessionPolicy,
  deleteAnswerDraft,
  formatCounts,
  loadSubmittedResultRecords,
  persistActionRecord,
  persistAnswerDraft,
  questionId as readQuestionId,
  readActionRecord,
  readAnswerDraft,
  shortQuestionId,
  summarizeQuestionResults,
} from './telegramCommands.mjs';
import { normalizeTelegramPrincipal } from './telegramUpdates.mjs';

const DEFAULT_MINI_APP_AUTH_MAX_AGE_SECONDS = 24 * 60 * 60;
const DEFAULT_MINI_APP_PAGE_SIZE = 5;
const QUESTION_ACTION_TTL_SECONDS = 30 * 60;
const SUBMIT_REQUEST_KV_PREFIX = 'telegram:submit-request:';
const AGENT_REQUEST_KV_PREFIX = 'telegram:agent-request:';
const SUBMIT_REQUEST_TTL_SECONDS = 30 * 24 * 60 * 60;
const BYTES32_RE = /^0x[0-9a-fA-F]{64}$/;
const AGREE_UNSURE_DISAGREE_LABELS = Object.freeze({
  agree: 'Agree',
  unsure: 'Unsure',
  disagree: 'Disagree',
});
const RESULT_VIEW_LEVELS = Object.freeze([
  {
    level: 1,
    key: 'metrics',
    label: 'Metrics',
    description: 'Question, response, and participant counts.',
  },
  {
    level: 2,
    key: 'published_questions',
    label: 'Published questions',
    description: 'Admin-approved question text for public display.',
  },
  {
    level: 3,
    key: 'aggregate_results',
    label: 'Aggregate results',
    description: 'Consensus and divisive question summaries.',
  },
  {
    level: 4,
    key: 'anonymized_groups',
    label: 'Anonymized groups',
    description: 'Group clusters and AI summaries without user identifiers.',
  },
]);

function safeString(value) {
  return String(value || '').trim();
}

function safeAnswerString(value) {
  if (value === undefined || value === null) return '';
  return String(value).trim();
}

function firstAnswerValue(...values) {
  return values.find((value) => safeAnswerString(value) !== '');
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

function lower(value) {
  return safeString(value).toLowerCase();
}

function normalizePositiveInteger(value, fallback) {
  const raw = Number(value);
  if (!Number.isFinite(raw) || raw <= 0) return fallback;
  return Math.floor(raw);
}

function miniResultsExposurePolicy(session = {}) {
  const exposure = session.resultsExposure && typeof session.resultsExposure === 'object' && !Array.isArray(session.resultsExposure)
    ? session.resultsExposure
    : {};
  return {
    metricsEnabled: exposure.metricsEnabled !== false,
    publishedQuestionsEnabled: exposure.publishedQuestionsEnabled === true,
    aggregateResultsEnabled: exposure.aggregateResultsEnabled !== false,
    anonymizedGroupsEnabled: exposure.anonymizedGroupsEnabled === true,
    minGroupSize: normalizePositiveInteger(exposure.minGroupSize, 2),
  };
}

function miniResultsLevelState(exposure = {}) {
  const enabled = {
    metrics: exposure.metricsEnabled !== false,
    published_questions: exposure.publishedQuestionsEnabled === true,
    aggregate_results: exposure.aggregateResultsEnabled !== false,
    anonymized_groups: exposure.anonymizedGroupsEnabled === true,
  };
  return RESULT_VIEW_LEVELS.map((definition) => ({
    ...definition,
    enabled: enabled[definition.key] === true,
    participantVisible: enabled[definition.key] === true,
    status: enabled[definition.key] === true
      ? 'available'
      : (definition.key === 'anonymized_groups' ? 'admin_can_enable' : 'admin_disabled'),
  }));
}

function sanitizeSessionSlug(value = '') {
  return lower(value).replace(/[^a-z0-9_-]/g, '').slice(0, 128);
}

function questionIdSeedPart(value = '') {
  const text = safeString(value);
  return BYTES32_RE.test(text) ? `${text.slice(2, 10)}${text.slice(-6)}` : text;
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

function json(data, init = {}) {
  return new Response(JSON.stringify(data, null, 2), {
    ...init,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      ...(init.headers || {}),
    },
  });
}

function html(text, init = {}) {
  return new Response(text, {
    ...init,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
      ...(init.headers || {}),
    },
  });
}

function bytesToHex(bytes) {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function timingSafeEqualString(left = '', right = '') {
  const a = safeString(left);
  const b = safeString(right);
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let index = 0; index < a.length; index += 1) {
    diff |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }
  return diff === 0;
}

async function hmacSha256Bytes(keyBytes, data = '') {
  if (!globalThis.crypto?.subtle) throw new Error('webcrypto_unavailable');
  const key = await globalThis.crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  return new Uint8Array(await globalThis.crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(String(data))
  ));
}

function dataCheckStringFromInitParams(params, { excludeSignature = false } = {}) {
  const entries = [];
  params.forEach((value, key) => {
    if (key === 'hash') return;
    if (excludeSignature && key === 'signature') return;
    entries.push([key, value]);
  });
  entries.sort(([leftKey, leftValue], [rightKey, rightValue]) => (
    leftKey === rightKey ? leftValue.localeCompare(rightValue) : leftKey.localeCompare(rightKey)
  ));
  return entries.map(([key, value]) => `${key}=${value}`).join('\n');
}

function parseInitUser(params) {
  const rawUser = safeString(params.get('user'));
  if (!rawUser) return null;
  try {
    const user = JSON.parse(rawUser);
    const telegramUserId = safeString(user?.id);
    if (!telegramUserId) return null;
    return {
      telegramUserId,
      username: safeString(user?.username),
      firstName: safeString(user?.first_name),
      lastName: safeString(user?.last_name),
      languageCode: safeString(user?.language_code),
    };
  } catch {
    return null;
  }
}

function miniAppInitDataRequired(env = {}) {
  return Boolean(safeString(env.TELEGRAM_BOT_TOKEN));
}

export async function validateTelegramMiniAppInitData(initData = '', env = {}, {
  nowMs = Date.now(),
} = {}) {
  const botToken = safeString(env.TELEGRAM_BOT_TOKEN);
  const requireInitData = miniAppInitDataRequired(env);
  const raw = safeString(initData);
  if (!botToken && !requireInitData) {
    return {
      ok: true,
      reason: 'preview_auth_without_bot_token',
      authMode: 'preview',
      user: { telegramUserId: 'preview-user', username: 'preview' },
    };
  }
  if (!raw) {
    return {
      ok: !requireInitData,
      reason: requireInitData ? 'telegram_init_data_missing' : 'preview_auth_missing_init_data',
      authMode: requireInitData ? 'telegram' : 'preview',
      user: requireInitData ? null : { telegramUserId: 'preview-user', username: 'preview' },
    };
  }
  if (!botToken) {
    return { ok: false, reason: 'telegram_bot_token_missing', authMode: 'telegram', user: null };
  }

  const params = new URLSearchParams(raw);
  const suppliedHash = lower(params.get('hash'));
  if (!/^[0-9a-f]{64}$/.test(suppliedHash)) {
    return { ok: false, reason: 'telegram_init_hash_missing', authMode: 'telegram', user: null };
  }

  let expectedHashes;
  try {
    const secretKey = await hmacSha256Bytes(new TextEncoder().encode('WebAppData'), botToken);
    const candidates = [dataCheckStringFromInitParams(params)];
    if (params.has('signature')) {
      candidates.push(dataCheckStringFromInitParams(params, { excludeSignature: true }));
    }
    expectedHashes = await Promise.all(candidates.map(async (candidate) => (
      bytesToHex(await hmacSha256Bytes(secretKey, candidate))
    )));
  } catch (error) {
    return {
      ok: false,
      reason: safeString(error?.message || error) || 'telegram_init_validation_failed',
      authMode: 'telegram',
      user: null,
    };
  }

  if (!expectedHashes.some((expectedHash) => timingSafeEqualString(expectedHash, suppliedHash))) {
    return { ok: false, reason: 'telegram_init_hash_invalid', authMode: 'telegram', user: null };
  }

  const authDate = Number(params.get('auth_date'));
  const maxAgeSeconds = normalizePositiveInteger(
    env.AGENT_BRIDGE_MINI_APP_AUTH_MAX_AGE_SECONDS,
    DEFAULT_MINI_APP_AUTH_MAX_AGE_SECONDS
  );
  const nowSeconds = Math.floor(Number(nowMs || Date.now()) / 1000);
  if (!Number.isFinite(authDate) || authDate <= 0) {
    return { ok: false, reason: 'telegram_init_auth_date_missing', authMode: 'telegram', user: null };
  }
  if (authDate > nowSeconds + 60) {
    return { ok: false, reason: 'telegram_init_auth_date_in_future', authMode: 'telegram', user: null };
  }
  if (maxAgeSeconds > 0 && nowSeconds - authDate > maxAgeSeconds) {
    return { ok: false, reason: 'telegram_init_data_expired', authMode: 'telegram', user: null };
  }

  return {
    ok: true,
    reason: 'telegram_init_data_valid',
    authMode: 'telegram',
    authDate,
    user: parseInitUser(params),
    queryId: safeString(params.get('query_id')) || null,
    chatType: safeString(params.get('chat_type')) || null,
    chatInstance: safeString(params.get('chat_instance')) || null,
  };
}

function telegramInitDataFromRequest(request) {
  return safeString(
    request.headers.get('X-Telegram-Init-Data') ||
    request.headers.get('Telegram-Web-App-Init-Data') ||
    request.headers.get('X-Ce-Telegram-Init-Data')
  );
}

async function authorizeMiniAppRequest(request, env = {}) {
  return validateTelegramMiniAppInitData(telegramInitDataFromRequest(request), env);
}

async function resolveLaunchRecord(env = {}, launch = '') {
  const parsed = parseOpaqueActionId(launch);
  if (!parsed.ok) return null;
  return readActionRecord(env, parsed.actionId);
}

function miniAppLaunchMatchesQuestion(launchRecord = {}, questionRef = {}) {
  const launchRef = launchRecord?.serverContextRef || {};
  const launchSessionSlug = sanitizeSessionSlug(launchRef.sessionSlug);
  const questionSessionSlug = sanitizeSessionSlug(questionRef.sessionSlug);
  const launchQuestionId = safeString(launchRef.questionId);
  const questionId = safeString(questionRef.questionId);
  if (launchRecord?.miniAppLaunch !== true || launchRecord?.lane !== TELEGRAM_CHAT_LANES.MINI_APP) return false;
  if (![TELEGRAM_BRIDGE_ACTIONS.VIEW_QUESTIONS, TELEGRAM_BRIDGE_ACTIONS.SUBMIT_RESPONSE].includes(launchRecord.action)) {
    return false;
  }
  if (launchRef.sessionPicker !== true && (!launchSessionSlug || !questionSessionSlug || launchSessionSlug !== questionSessionSlug)) return false;
  if (launchRef.sessionPicker === true && !questionSessionSlug) return false;
  if (launchQuestionId && questionId && lower(launchQuestionId) !== lower(questionId)) return false;
  return true;
}

function isValidMiniAppLaunchRecord(record = {}) {
  return record?.miniAppLaunch === true && record?.lane === TELEGRAM_CHAT_LANES.MINI_APP;
}

function miniAppLaunchAllowsAgentWrite(record = {}) {
  return isValidMiniAppLaunchRecord(record) && [
    TELEGRAM_BRIDGE_ACTIONS.AGENT_ACTION_MENU,
    TELEGRAM_BRIDGE_ACTIONS.CREATE_AGENT_ACCOUNT,
    TELEGRAM_BRIDGE_ACTIONS.VIEW_AGENT_SETTINGS,
    TELEGRAM_BRIDGE_ACTIONS.EDIT_AGENT_SETTINGS,
    TELEGRAM_BRIDGE_ACTIONS.UPDATE_AGENT_SETTINGS,
    TELEGRAM_BRIDGE_ACTIONS.VIEW_QUESTIONS,
    TELEGRAM_BRIDGE_ACTIONS.SUBMIT_RESPONSE,
  ].includes(record.action);
}

function miniAppLaunchAllowsSession(record = {}, sessionSlug = '') {
  if (!isValidMiniAppLaunchRecord(record)) return false;
  if (sessionPickerEnabled(record)) return Boolean(sanitizeSessionSlug(sessionSlug));
  const launchSlug = sanitizeSessionSlug(record?.serverContextRef?.sessionSlug);
  const requestedSlug = sanitizeSessionSlug(sessionSlug);
  return Boolean(launchSlug && requestedSlug && launchSlug === requestedSlug);
}

function normalizeAgentSettingsInput(settings = {}) {
  const input = settings && typeof settings === 'object' && !Array.isArray(settings) ? settings : {};
  assertNoSecretShape(input, 'Telegram Mini App settings payloads must not serialize secrets.');
  const patch = {};
  if (Object.hasOwn(input, 'draftStyle')) {
    const draftStyle = lower(input.draftStyle);
    if (!['concise', 'balanced', 'detailed'].includes(draftStyle)) {
      return { ok: false, reason: 'draft_style_invalid' };
    }
    patch.draftStyle = draftStyle;
  }
  if (Object.hasOwn(input, 'telegramReminders')) {
    if (input.telegramReminders === true || input.telegramReminders === false) {
      patch.telegramReminders = input.telegramReminders;
    } else {
      const normalized = lower(input.telegramReminders);
      if (!['true', 'false', '1', '0', 'yes', 'no', 'on', 'off'].includes(normalized)) {
        return { ok: false, reason: 'telegram_reminders_invalid' };
      }
      patch.telegramReminders = ['true', '1', 'yes', 'on'].includes(normalized);
    }
  }
  if (Object.hasOwn(input, 'showUnansweredFirst')) {
    if (input.showUnansweredFirst === true || input.showUnansweredFirst === false) {
      patch.showUnansweredFirst = input.showUnansweredFirst;
    } else {
      const normalized = lower(input.showUnansweredFirst);
      if (!['true', 'false', '1', '0', 'yes', 'no', 'on', 'off'].includes(normalized)) {
        return { ok: false, reason: 'show_unanswered_first_invalid' };
      }
      patch.showUnansweredFirst = ['true', '1', 'yes', 'on'].includes(normalized);
    }
  }
  if (!Object.keys(patch).length) {
    return { ok: false, reason: 'settings_patch_required' };
  }
  return {
    ok: true,
    patch,
    publicSummary: {
      ...(Object.hasOwn(patch, 'draftStyle') ? { draftStyle: patch.draftStyle } : {}),
      ...(Object.hasOwn(patch, 'telegramReminders') ? { telegramReminders: patch.telegramReminders } : {}),
      ...(Object.hasOwn(patch, 'showUnansweredFirst') ? { showUnansweredFirst: patch.showUnansweredFirst } : {}),
    },
  };
}

function defaultAgentSettingsState({
  sessionSlug = '',
  createdAt = null,
} = {}) {
  const overview = buildTelegramAgentSettingsOverviewState({
    settings: {
      draftStyle: 'balanced',
      telegramReminders: false,
      showUnansweredFirst: true,
    },
    sessionSlug,
    createdAt,
  });
  const edit = buildTelegramAgentSettingsEditState({
    settings: overview.settings,
    sessionSlug,
    createdAt,
  });
  return {
    overview,
    edit,
    values: overview.settings,
    editableFields: edit.fields,
  };
}

async function persistMiniQuestionAction({
  env = {},
  sessionSlug = '',
  question = {},
  card = {},
  createdAt = null,
} = {}) {
  const qid = readQuestionId(question);
  if (!qid || !env?.AGENT_ACTION_KV || typeof env.AGENT_ACTION_KV.put !== 'function') return '';
  const callback = createTelegramCallbackAction({
    seed: `mini_question|${sessionSlug}|${questionIdSeedPart(qid)}|${safeString(card.questionType)}`,
    action: TELEGRAM_BRIDGE_ACTIONS.DRAFT_RESPONSE,
    lane: TELEGRAM_CHAT_LANES.MINI_APP,
    serverContextRef: {
      sessionSlug: sanitizeSessionSlug(sessionSlug),
      questionId: qid,
      questionType: safeString(card.questionType),
      selectionMode: safeString(card.selectionMode),
      options: Array.isArray(card.answerLabels) ? card.answerLabels : [],
    },
    createdAt,
  });
  const stored = await persistActionRecord(env, callback.callbackData, {
    ...callback.record,
    callbackData: callback.callbackData,
    miniAppQuestionAction: true,
  }, { ttlSeconds: QUESTION_ACTION_TTL_SECONDS });
  return stored.ok ? callback.callbackData : '';
}

function formatRequiredSbtSummary(addresses = []) {
  const list = (Array.isArray(addresses) ? addresses : [])
    .map(safeString)
    .filter(Boolean)
    .slice(0, 4);
  if (!list.length) return '';
  const short = list.map((address) => (
    address.length > 14 ? `${address.slice(0, 6)}...${address.slice(-4)}` : address
  ));
  return `Required SBT${list.length === 1 ? '' : 's'}: ${short.join(', ')}`;
}

async function miniQuestionFromRecord({
  env = {},
  sessionSlug = '',
  question = {},
  index = 0,
  launchQuestionId = '',
  createdAt = null,
} = {}) {
  const state = buildTelegramPoseQuestionState({
    sessionSlug,
    question,
    source: safeString(question.source || 'existing_session_question'),
    createdAt,
  });
  const group = state.groupSafeOutput || {};
  const card = state.card || {};
  const qid = safeString(group.questionId || readQuestionId(question));
  const locked = group.locked === true;
  const payloadUnavailable = group.payloadUnavailable === true;
  const encrypted = group.encrypted === true;
  const requiredSbtAddresses = Array.isArray(group.requiredSbtAddresses) ? group.requiredSbtAddresses : [];
  const requiredSbtSummary = formatRequiredSbtSummary(requiredSbtAddresses);
  const lockMessage = payloadUnavailable
    ? 'Question payload is not available yet. The app will keep retrying.'
    : encrypted
      ? ['This question is encrypted.', requiredSbtSummary].filter(Boolean).join(' ')
      : 'This question is locked in Telegram.';
  const questionKey = locked || payloadUnavailable ? '' : await persistMiniQuestionAction({
    env,
    sessionSlug,
    question,
    card,
    createdAt,
  });
  const output = {
    index,
    displayIndex: index + 1,
    sessionSlug: sanitizeSessionSlug(sessionSlug),
    questionKey,
    activeFromLaunch: Boolean(launchQuestionId && qid && lower(qid) === lower(launchQuestionId)),
    questionType: safeString(card.questionType || group.questionType || 'freeform'),
    selectionMode: safeString(card.selectionMode || ''),
    ratingScale: card.ratingScale || null,
    title: payloadUnavailable
      ? 'Question unavailable'
      : locked
      ? encrypted ? 'Encrypted question' : 'Locked question'
      : safeString(card.questionText || group.questionText || 'Untitled question'),
    prompt: locked || payloadUnavailable ? '' : safeString(card.questionText || group.questionText || 'Untitled question'),
    options: locked || payloadUnavailable ? [] : (Array.isArray(card.answerLabels) ? card.answerLabels : []),
    locked,
    encrypted,
    requiredSbtAddresses,
    requiredSbtSummary,
    lockMessage,
    payloadUnavailable,
    canAnswer: !locked && !payloadUnavailable && Boolean(questionKey),
    status: payloadUnavailable
      ? 'payload_unavailable'
      : locked ? safeString(group.status || 'locked_unavailable') : 'answerable',
  };
  Object.defineProperty(output, 'questionId', {
    value: qid,
    enumerable: false,
  });
  return output;
}

function launchSessionSlug(record = {}, env = {}) {
  return sanitizeSessionSlug(
    record?.serverContextRef?.sessionSlug ||
    env.AGENT_BRIDGE_DEFAULT_SESSION_SLUG ||
    env.DEFAULT_SESSION_SLUG ||
    'general'
  ) || 'general';
}

function normalizeSessionSlugList(value = '') {
  const seen = new Set();
  const slugs = safeString(value)
    .split(',')
    .map(sanitizeSessionSlug)
    .filter(Boolean)
    .filter((slug) => {
      if (seen.has(slug)) return false;
      seen.add(slug);
      return true;
    });
  return slugs;
}

function sessionPickerEnabled(record = {}) {
  return record?.serverContextRef?.sessionPicker === true;
}

function linkedPolicySessions(policy = {}) {
  return (Array.isArray(policy.linkedSessions) ? policy.linkedSessions : [])
    .map((session) => ({
      sessionSlug: sanitizeSessionSlug(session.sessionSlug),
      sessionName: safeString(session.sessionName || session.sessionSlug),
      default: session.default === true,
      telegramBridgeEnabled: session.telegramBridgeEnabled !== false,
      telegramOnly: session.telegramOnly === true,
    }))
    .filter((session) => {
      if (!session.sessionSlug || !session.telegramBridgeEnabled || !session.telegramOnly) return false;
      const label = `${session.sessionSlug} ${session.sessionName}`;
      // Temporary smoke-test hygiene: hide old E2E registry spam until session
      // metadata has a durable production flag for Telegram visibility.
      return !(/\be2e\b|e2e/i.test(label));
    });
}

function buildMiniAppSessionPicker(policy = {}, selectedSessionSlugs = []) {
  const selected = new Set(selectedSessionSlugs.map(sanitizeSessionSlug).filter(Boolean));
  return {
    enabled: true,
    required: selected.size === 0,
    multiSelect: true,
    initiallyCollapsed: selected.size > 0,
    selectedSessionSlugs: [...selected],
    sessions: linkedPolicySessions(policy).map((session) => ({
      ...session,
      selected: selected.has(session.sessionSlug),
    })),
  };
}

function emptyMiniAppGroupState(sessionSlug = '') {
  return {
    enabled: false,
    sessionSlug: sanitizeSessionSlug(sessionSlug),
    categories: [],
    selections: {},
    proposals: [],
    updatedAt: null,
  };
}

async function listKvRecordsByPrefix(env = {}, prefix = '', {
  limit = 500,
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

async function loadSubmittedMiniAppAnswers({
  env = {},
  auth = {},
  questions = [],
} = {}) {
  const telegramUserId = safeString(auth.user?.telegramUserId);
  if (!telegramUserId) return { submittedAnswerKeys: [], submittedAnswers: [] };
  const questionByRef = new Map();
  (Array.isArray(questions) ? questions : []).forEach((question) => {
    const ref = `${sanitizeSessionSlug(question.sessionSlug)}:${safeString(question.questionId)}`;
    if (question.questionKey && question.questionId) questionByRef.set(ref, question);
  });
  if (!questionByRef.size) return { submittedAnswerKeys: [], submittedAnswers: [] };
  const submittedStatuses = new Set(SUBMITTED_RESULT_STATUSES);
  const records = await listKvRecordsByPrefix(env, SUBMIT_REQUEST_KV_PREFIX, { limit: 1000 });
  const byQuestionKey = new Map();
  records.forEach((record) => {
    if (safeString(record.telegramUserId) !== telegramUserId) return;
    if (!submittedStatuses.has(safeString(record.status))) return;
    const ref = `${sanitizeSessionSlug(record.sessionSlug)}:${safeString(record.questionId)}`;
    const question = questionByRef.get(ref);
    if (!question) return;
    const existing = byQuestionKey.get(question.questionKey);
    if (existing && safeString(existing.createdAt).localeCompare(safeString(record.createdAt)) >= 0) return;
    byQuestionKey.set(question.questionKey, {
      questionKey: question.questionKey,
      displayIndex: question.displayIndex,
      sessionSlug: question.sessionSlug,
      prompt: question.prompt || question.title || '',
      answerLabel: safeAnswerString(firstAnswerValue(
        record.answer?.label,
        record.answer?.value,
        record.answer?.text,
        record.answerLabel,
        record.answerValue,
      )),
      answer: miniAnswerFromSubmittedRecord(record, question),
      status: safeString(record.status),
      submittedAt: safeString(record.createdAt),
      requestId: safeString(record.requestId),
    });
  });
  const submittedAnswers = Array.from(byQuestionKey.values());
  return {
    submittedAnswerKeys: submittedAnswers.map((entry) => entry.questionKey),
    submittedAnswers,
  };
}

function miniAnswerFromSubmittedRecord(record = {}, question = {}) {
  const source = record.answer && typeof record.answer === 'object' && !Array.isArray(record.answer)
    ? record.answer
    : {};
  const type = safeString(question.questionType || source.questionType || record.controlType);
  const rawValue = firstAnswerValue(source.value, source.answer, source.text, record.answerValue, record.answerLabel);
  const comments = safeAnswerString(firstAnswerValue(source.comments, source.additionalComments, record.comments));
  if (type === 'multichoice') {
    const values = Array.isArray(source.values)
      ? source.values.map(safeAnswerString).filter(Boolean)
      : [rawValue].map(safeAnswerString).filter(Boolean);
    return { values, comments };
  }
  if (type === 'freeform') {
    return { text: safeAnswerString(firstAnswerValue(source.text, source.value, source.answer, record.answerValue, record.answerLabel)), comments };
  }
  if (type === 'rating') {
    const value = Number(firstAnswerValue(source.value, source.rating, source.answer, record.answerValue, record.answerLabel));
    return { value: Number.isFinite(value) ? value : safeAnswerString(rawValue), comments };
  }
  return { value: lower(rawValue), comments };
}

function miniAnswerFromSavedDraft(draft = {}, question = {}) {
  const rawValue = safeString(draft.answerValue || draft.answerLabel);
  const parsed = safeJsonParse(rawValue, null);
  const source = parsed && typeof parsed === 'object' && !Array.isArray(parsed)
    ? parsed
    : {
      questionType: draft.controlType || question.questionType,
      value: rawValue,
      text: rawValue,
      label: draft.answerLabel,
    };
  const comments = safeString(source.comments || source.additionalComments);
  if (question.questionType === 'multichoice' || source.questionType === 'multichoice') {
    const values = Array.isArray(source.values)
      ? source.values.map(safeString).filter(Boolean)
      : [source.value || rawValue].map(safeString).filter(Boolean);
    return { values, comments };
  }
  if (question.questionType === 'freeform' || source.questionType === 'freeform') {
    return { text: safeString(source.text || source.value || rawValue), comments };
  }
  if (question.questionType === 'rating' || source.questionType === 'rating') {
    const value = Number(source.value ?? rawValue);
    return { value: Number.isFinite(value) ? value : rawValue, comments };
  }
  return { value: lower(source.value || rawValue), comments };
}

async function loadSavedMiniAppDrafts({
  env = {},
  auth = {},
  sessionSlug = '',
  questions = [],
  submittedAnswerKeys = [],
} = {}) {
  const telegramUserId = safeString(auth.user?.telegramUserId);
  if (!telegramUserId) return { savedDrafts: [], draftAnswersByQuestionKey: {} };
  const submitted = new Set((Array.isArray(submittedAnswerKeys) ? submittedAnswerKeys : [])
    .map(safeString)
    .filter(Boolean));
  const normalized = {
    user: { telegramUserId },
    chat: { chatId: safeString(auth.chatInstance || auth.queryId || telegramUserId) },
  };
  const entries = await Promise.all(questions.map(async (question) => {
    if (submitted.has(question.questionKey)) return null;
    const questionSessionSlug = sanitizeSessionSlug(question.sessionSlug || sessionSlug);
    const draft = await readAnswerDraft({
      env,
      normalized,
      sessionSlug: questionSessionSlug,
      selectedQuestionId: question.questionId,
    });
    if (!draft || safeString(draft.status) !== 'draft_saved') return null;
    return {
      question,
      draft,
      answer: miniAnswerFromSavedDraft(draft, question),
    };
  }));
  const saved = entries.filter(Boolean);
  const draftAnswersByQuestionKey = {};
  for (const entry of saved) {
    draftAnswersByQuestionKey[entry.question.questionKey] = entry.answer;
  }
  return {
    draftAnswersByQuestionKey,
    savedDrafts: saved.map((entry) => ({
      questionKey: entry.question.questionKey,
      displayIndex: entry.question.displayIndex,
      sessionSlug: entry.question.sessionSlug || sessionSlug,
      prompt: entry.question.prompt || entry.question.title || '',
      answerLabel: safeString(entry.draft.answerLabel),
      selectedAt: safeString(entry.draft.selectedAt),
    })),
  };
}

async function buildMiniAppState({
  request,
  env = {},
  waitUntil = null,
  createdAt = new Date().toISOString(),
} = {}) {
  const url = new URL(request.url);
  const launch = safeString(url.searchParams.get('launch') || url.searchParams.get('tgWebAppStartParam'));
  const auth = await authorizeMiniAppRequest(request, env);
  const authSummary = {
    ok: auth.ok === true,
    mode: auth.authMode || 'telegram',
    reason: auth.reason || '',
    user: auth.user ? {
      telegramUserId: safeString(auth.user.telegramUserId),
      username: safeString(auth.user.username),
      firstName: safeString(auth.user.firstName),
    } : null,
  };
  if (!auth.ok) {
    return {
      ok: false,
      httpStatus: 401,
      error: auth.reason || 'telegram_init_data_invalid',
      app: 'ce-telegram-mini-app',
      auth: authSummary,
      launch: {
        ok: false,
        launch,
        reason: 'auth_required_before_launch',
      },
      session: {
        sessionSlug: '',
        title: '',
      },
      questions: [],
      activeQuestionKey: '',
      questionCount: 0,
      pageSize: DEFAULT_MINI_APP_PAGE_SIZE,
      questionSource: '',
      questionSourceReason: '',
      sourceOk: false,
      sourceError: auth.reason || 'telegram_init_data_invalid',
      agent: {
        actions: [],
        settings: null,
      },
    };
  }
  const launchRecord = await resolveLaunchRecord(env, launch);
  if (!launchRecord && auth.authMode === 'telegram') {
    return {
      ok: false,
      httpStatus: 404,
      error: 'mini_app_launch_invalid',
      app: 'ce-telegram-mini-app',
      auth: authSummary,
      launch: {
        ok: false,
        launch,
        reason: 'launch_action_missing_or_expired',
      },
      session: {
        sessionSlug: '',
        title: '',
      },
      questions: [],
      activeQuestionKey: '',
      questionCount: 0,
      pageSize: DEFAULT_MINI_APP_PAGE_SIZE,
      questionSource: '',
      questionSourceReason: '',
      sourceOk: false,
      sourceError: 'mini_app_launch_invalid',
      agent: {
        actions: [],
        settings: null,
      },
    };
  }
  const policy = await loadSessionPolicy(env);
  const linkedSessions = linkedPolicySessions(policy);
  const linkedSessionLookup = new Set(linkedSessions.map((session) => session.sessionSlug));
  const launchRequestsPicker = sessionPickerEnabled(launchRecord);
  const pickerSelection = normalizeSessionSlugList(url.searchParams.get('sessions') || url.searchParams.get('sessionSlugs'));
  const launchSlug = launchSessionSlug(launchRecord, env);
  const selectedSessionSlugs = (
    pickerSelection.length
      ? pickerSelection
      : (launchRequestsPicker ? [] : [launchSlug])
  ).filter((slug) => linkedSessionLookup.has(slug));
  const launchSlugUnavailable = !launchRequestsPicker && launchSlug && !linkedSessionLookup.has(launchSlug);
  const effectivePickerEnabled = linkedSessions.length > 0 || launchRequestsPicker || launchSlugUnavailable;
  const effectiveSelectedSessionSlugs = launchSlugUnavailable ? [] : selectedSessionSlugs;
  const sessionPicker = effectivePickerEnabled
    ? buildMiniAppSessionPicker(policy, effectiveSelectedSessionSlugs)
    : { enabled: false, required: false, multiSelect: false, selectedSessionSlugs: [], sessions: [] };
  if (effectivePickerEnabled && effectiveSelectedSessionSlugs.length === 0) {
    const agentSettings = defaultAgentSettingsState({ sessionSlug: '', createdAt });
    return {
      ok: true,
      app: 'ce-telegram-mini-app',
      auth: authSummary,
      launch: {
        ok: Boolean(launchRecord),
        launch,
        reason: launchRecord ? 'launch_action_loaded' : 'launch_action_missing_or_expired',
      },
      session: {
        sessionSlug: '',
        title: 'Select sessions',
      },
      sessionPicker,
      selectedSessionSlugs: [],
      groups: emptyMiniAppGroupState(),
      questions: [],
      savedDrafts: [],
      submittedAnswers: [],
      submittedAnswerKeys: [],
      draftAnswersByQuestionKey: {},
      activeQuestionKey: '',
      questionCount: 0,
      availableQuestionCount: 0,
      unavailableQuestionCount: 0,
      lockedQuestionCount: 0,
      discoveredQuestionCount: 0,
      skippedQuestionCount: 0,
      questionIndexComplete: true,
      pageSize: DEFAULT_MINI_APP_PAGE_SIZE,
      questionSource: 'session_picker',
      questionSourceReason: 'session_selection_required',
      sourceOk: true,
      sourceError: '',
      agent: {
        actions: listAgentApiCapabilities({ lane: TELEGRAM_CHAT_LANES.MINI_APP, includeGroupUnsafe: true })
          .map((capability) => ({
            id: capability.id,
            label: capability.label,
            category: capability.category,
            method: capability.method,
            path: capability.path,
            handoffStatus: capability.handoffStatus,
            requiredFields: capability.requiredFields,
            miniAppRoutes: capability.miniAppRoutes,
          })),
        account: {
          mode: 'managed_telegram_demo',
          createAction: 'agent.account.create',
          canonicalApiRequest: buildCanonicalAgentRequest({
            capabilityId: 'agent.account.create',
            body: {
              telegramPrincipalRef: 'telegram_principal_ref',
              accountMode: 'managed_telegram_demo',
              session: '',
              idempotencyKey: 'provided_on_submit',
            },
          }),
        },
        settings: agentSettings,
      },
    };
  }
  const sessionSlug = effectiveSelectedSessionSlugs[0] || launchSessionSlug(launchRecord, env);
  const launchQuestionId = safeString(launchRecord?.serverContextRef?.questionId);
  const loadedEntries = await Promise.all(effectiveSelectedSessionSlugs.map(async (slug) => ({
    sessionSlug: slug,
    loaded: await loadQuestionsForSession(env, slug, { waitUntil }),
  })));
  let questionIndex = 0;
  const questionGroups = await Promise.all(loadedEntries.map(async ({ sessionSlug: slug, loaded }) => {
    const sourceQuestions = Array.isArray(loaded.questions) ? loaded.questions : [];
    return Promise.all(sourceQuestions.map((question) => miniQuestionFromRecord({
      env,
      sessionSlug: slug,
      question,
      index: questionIndex++,
      launchQuestionId,
      createdAt,
    })));
  }));
  const questions = questionGroups.flat();
  const availableQuestionCount = questions.filter((question) => question?.canAnswer).length;
  const unavailableQuestionCount = questions.filter((question) => question?.payloadUnavailable === true).length;
  const lockedQuestionCount = questions.filter((question) => question?.locked === true).length;
  const discoveredQuestionCount = loadedEntries.reduce((sum, entry) => (
    sum + (Number(entry.loaded.discoveredCount || entry.loaded.indexedQuestionCount || entry.loaded.questions?.length || 0) || 0)
  ), 0) || questions.length;
  const activeQuestionKey = questions.find((question) => question.activeFromLaunch)?.questionKey ||
    questions.find((question) => question.canAnswer)?.questionKey ||
    questions[0]?.questionKey ||
    '';
  const submittedAnswerState = await loadSubmittedMiniAppAnswers({
    env,
    auth,
    questions,
  });
  const savedDraftState = await loadSavedMiniAppDrafts({
    env,
    auth,
    sessionSlug,
    questions,
    submittedAnswerKeys: submittedAnswerState.submittedAnswerKeys,
  });
  const agentSettings = defaultAgentSettingsState({ sessionSlug, createdAt });
  const primaryResolved = resolveSessionInvocation(policy, sessionSlug);
  const groups = primaryResolved.ok
    ? await loadTelegramLightweightGroups({
      env,
      session: primaryResolved.session,
      telegramUserId: auth.user?.telegramUserId,
    })
    : emptyMiniAppGroupState(sessionSlug);
  const selectedSessionTitles = effectiveSelectedSessionSlugs.map((slug) => (
    linkedSessions.find((session) => session.sessionSlug === slug)?.sessionName || slug
  ));
  const sourceOk = loadedEntries.every((entry) => entry.loaded.ok !== false);
  const sourceReasons = [...new Set(loadedEntries.map((entry) => safeString(entry.loaded.reason)).filter(Boolean))];
  const sourceNames = [...new Set(loadedEntries.map((entry) => safeString(entry.loaded.source)).filter(Boolean))];
  return {
    ok: true,
    app: 'ce-telegram-mini-app',
    auth: authSummary,
    launch: {
      ok: Boolean(launchRecord),
      launch,
      reason: launchRecord ? 'launch_action_loaded' : 'launch_action_missing_or_expired',
    },
    session: {
      sessionSlug,
      title: selectedSessionTitles.length > 1 ? `${selectedSessionTitles.length} sessions` : (selectedSessionTitles[0] || sessionSlug),
    },
    sessionPicker,
    selectedSessionSlugs: effectiveSelectedSessionSlugs,
    groups,
    questions,
    savedDrafts: savedDraftState.savedDrafts,
    submittedAnswers: submittedAnswerState.submittedAnswers,
    submittedAnswerKeys: submittedAnswerState.submittedAnswerKeys,
    draftAnswersByQuestionKey: savedDraftState.draftAnswersByQuestionKey,
    activeQuestionKey,
    questionCount: questions.length,
    availableQuestionCount,
    unavailableQuestionCount,
    lockedQuestionCount,
    discoveredQuestionCount,
    skippedQuestionCount: loadedEntries.reduce((sum, entry) => (
      sum + (Number(entry.loaded.skippedSessionMismatchCount || entry.loaded.scopedOutQuestionCount || 0) || 0)
    ), 0),
    questionIndexComplete: loadedEntries.every((entry) => entry.loaded.complete !== false),
    pageSize: DEFAULT_MINI_APP_PAGE_SIZE,
    questionSource: sourceNames.length === 1 ? sourceNames[0] : 'multi_session_question_cache',
    questionSourceReason: sourceReasons.join(', '),
    sourceOk,
    sourceError: sourceOk ? '' : (sourceReasons.join(', ') || 'question_source_unavailable'),
    agent: {
      actions: listAgentApiCapabilities({ lane: TELEGRAM_CHAT_LANES.MINI_APP, includeGroupUnsafe: true })
        .map((capability) => ({
          id: capability.id,
          label: capability.label,
          category: capability.category,
          method: capability.method,
          path: capability.path,
          handoffStatus: capability.handoffStatus,
          requiredFields: capability.requiredFields,
          miniAppRoutes: capability.miniAppRoutes,
        })),
      account: {
        mode: 'managed_telegram_demo',
        createAction: 'agent.account.create',
        canonicalApiRequest: buildCanonicalAgentRequest({
          capabilityId: 'agent.account.create',
          body: {
            telegramPrincipalId: 'telegram_principal_id',
            accountMode: 'managed_telegram_demo',
            session: sessionSlug,
            idempotencyKey: 'provided_on_submit',
          },
        }),
      },
      settings: agentSettings,
    },
  };
}

function normalizeText(value = '', maxLength = 4000) {
  return safeString(value).slice(0, maxLength);
}

function submitFailureMessage(result = {}) {
  const reason = safeString(result.reason || result.status || 'submit_request_failed');
  const detail = safeString(result.error || result.onChain?.error || result.onChain?.reason || '');
  let message = 'Could not submit this answer.';
  if (reason === 'worker_auth_failed') {
    message = 'Could not authenticate the managed Telegram account with the session worker.';
  } else if (reason === 'direct_submit_failed') {
    message = 'Could not broadcast the response transaction.';
  } else if (reason === 'submit_request_incomplete') {
    message = 'Submit request is missing the session, user, or question reference.';
  } else if (reason === 'action_kv_unavailable') {
    message = 'Submit request storage is unavailable.';
  }
  return {
    reason,
    detail,
    message: detail ? `${message} Detail: ${detail}` : message,
  };
}

function audioFileExtension(file = {}) {
  const name = safeString(file?.name).toLowerCase();
  const ext = name.match(/\.([a-z0-9]{2,6})$/)?.[1];
  if (ext) return ext;
  const mime = safeString(file?.type).toLowerCase();
  if (mime.includes('webm')) return 'webm';
  if (mime.includes('ogg')) return 'ogg';
  if (mime.includes('mpeg') || mime.includes('mp3')) return 'mp3';
  if (mime.includes('mp4')) return 'mp4';
  if (mime.includes('wav')) return 'wav';
  return 'webm';
}

function normalizeChoiceValues(answer = {}) {
  const raw = Array.isArray(answer.values)
    ? answer.values
    : (Array.isArray(answer.selectedValues) ? answer.selectedValues : [answer.value ?? answer.answer]);
  return raw.map(safeString).filter(Boolean);
}

function normalizeMiniAnswer(answer = {}, questionRef = {}) {
  const type = safeString(questionRef.questionType || 'freeform');
  const comments = normalizeText(answer.comments || answer.additionalComments, 1000);
  if (type === 'agree_unsure_disagree') {
    const value = lower(answer.value || answer.answer);
    if (!AGREE_UNSURE_DISAGREE_LABELS[value]) return { ok: false, reason: 'binary_answer_invalid' };
    return {
      ok: true,
      label: AGREE_UNSURE_DISAGREE_LABELS[value],
      value,
      answer: { questionType: type, value, label: AGREE_UNSURE_DISAGREE_LABELS[value], comments },
    };
  }
  if (type === 'rating') {
    const value = Number(answer.value ?? answer.rating ?? answer.answer);
    if (!Number.isInteger(value) || value < 0 || value > 10) {
      return { ok: false, reason: 'rating_answer_invalid' };
    }
    return {
      ok: true,
      label: String(value),
      value: String(value),
      answer: { questionType: type, value, comments },
    };
  }
  if (type === 'multichoice') {
    const options = Array.isArray(questionRef.options) ? questionRef.options.map(safeString) : [];
    const selected = normalizeChoiceValues(answer).filter((value) => options.includes(value));
    if (!selected.length) return { ok: false, reason: 'choice_answer_required' };
    const values = questionRef.selectionMode === 'single' ? selected.slice(0, 1) : selected;
    return {
      ok: true,
      label: values.join(', '),
      value: JSON.stringify(values),
      answer: { questionType: type, values, selectionMode: questionRef.selectionMode || 'multi', comments },
    };
  }
  const text = normalizeText(answer.text || answer.value || answer.answer);
  if (!text) return { ok: false, reason: 'text_answer_required' };
  return {
    ok: true,
    label: text.length > 42 ? `${text.slice(0, 39)}...` : text,
    value: text,
    answer: { questionType: 'freeform', text, comments },
  };
}

async function persistSubmitRequest({
  env = {},
  auth = {},
  questionRef = {},
  answer = {},
  draftKey = '',
  createdAt = null,
} = {}) {
  if (!env?.AGENT_ACTION_KV || typeof env.AGENT_ACTION_KV.put !== 'function') {
    return { ok: false, reason: 'action_kv_unavailable' };
  }
  const telegramUserId = safeString(auth.user?.telegramUserId);
  const sessionSlug = sanitizeSessionSlug(questionRef.sessionSlug);
  const qid = safeString(questionRef.questionId);
  if (!telegramUserId || !sessionSlug || !qid) {
    return { ok: false, reason: 'submit_request_incomplete' };
  }
  const answerFingerprint = stableFingerprint(answer);
  const idempotencyKey = `telegram_mini_submit:${telegramUserId}:${sessionSlug}:${questionIdSeedPart(qid)}:${answerFingerprint}`;
  const requestId = buildOpaqueActionId(idempotencyKey);
  const kvKey = `${SUBMIT_REQUEST_KV_PREFIX}${requestId}`;
  const existing = env.AGENT_ACTION_KV && typeof env.AGENT_ACTION_KV.get === 'function'
    ? safeJsonParse(await env.AGENT_ACTION_KV.get(kvKey).catch(() => null), null)
    : null;
  const retryExistingDirectFailure = existing &&
    typeof existing === 'object' &&
    !Array.isArray(existing) &&
    existing.status === 'direct_submit_failed';
  if (existing && typeof existing === 'object' && !Array.isArray(existing) && !retryExistingDirectFailure) {
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
  const resolved = resolveSessionInvocation(policy, sessionSlug);
  const session = resolved.ok ? resolved.session : { sessionSlug };
  if (telegramSubmitQueueEnabled(env)) {
    const record = buildQueuedSubmitRecord({
      session,
      canonicalBody: {
        session: sessionSlug,
        questionId: qid,
        questionRef: 'telegram_server_question_ref',
        answerRef: 'telegram_private_answer_ref',
        idempotencyKey,
      },
      baseRecord: {
        version: 1,
        requestId,
        idempotencyKey,
        answerFingerprint,
        lane: TELEGRAM_CHAT_LANES.MINI_APP,
        telegramUserId,
        username: safeString(auth.user?.username),
        languageCode: safeString(auth.user?.languageCode),
        sessionSlug,
        questionId: qid,
        questionIdShort: shortQuestionId(qid),
        answer,
        onChainAnswer: answer,
        answerRef: draftKey ? { kind: 'telegram_answer_draft', key: draftKey } : null,
        createdAt,
      },
    });
    const queued = await queueTelegramSubmitRecord({ env, kvKey, record }).catch((error) => ({
      ok: false,
      reason: 'telegram_submit_queue_failed',
      error: safeString(error?.message || error),
    }));
    if (queued.ok === true) {
      return {
        ok: true,
        requestId,
        status: record.status,
        canonicalApiRequest: record.canonicalApiRequest,
        idempotencyKey,
        queued: true,
        replayed: false,
      };
    }
  }
  const principal = normalizeTelegramPrincipal(auth.user || {});
  const account = await deriveManagedDemoAccount({
    principal,
    deploymentId: env.AGENT_BRIDGE_DEPLOYMENT_ID || 'agent-bridge-live-demo',
    rootSecret: env.DEMO_SIGNER_ROOT_SECRET || '',
    lifecycle: 'account_created',
    createdAt,
  });
  const directSubmit = await submitTelegramResponseOnChain({
    env,
    session,
    account,
    principal,
    questionRef,
    answer,
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
      lane: TELEGRAM_CHAT_LANES.MINI_APP,
      telegramUserId,
      sessionSlug,
      questionId: qid,
      questionIdShort: shortQuestionId(qid),
      answer,
      answerRef: draftKey ? { kind: 'telegram_answer_draft', key: draftKey } : null,
      canonicalApiRequest: {
        method: 'POST',
        path: '/api/agent/responses/submit-request',
        status: directSubmit.ok === true ? 'executed_direct_onchain' : 'direct_submit_failed',
        body: {
          session: sessionSlug,
          questionId: qid,
          questionRef: 'telegram_server_question_ref',
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
    lane: TELEGRAM_CHAT_LANES.MINI_APP,
    telegramUserId,
    sessionSlug,
    questionId: qid,
    questionIdShort: shortQuestionId(qid),
    answer,
    answerRef: draftKey ? { kind: 'telegram_answer_draft', key: draftKey } : null,
    canonicalApiRequest: {
      method: 'POST',
      path: '/api/agent/responses/submit-request',
      status: 'pending_canonical_handoff',
      body: {
        session: sessionSlug,
        questionId: qid,
        questionRef: 'telegram_server_question_ref',
        answerRef: 'telegram_private_answer_ref',
        idempotencyKey,
      },
    },
    directSubmitAttempt: directSubmit,
    createdAt,
  };
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

async function persistSettingsUpdateRequest({
  env = {},
  auth = {},
  sessionSlug = '',
  patch = {},
  createdAt = null,
} = {}) {
  if (!env?.AGENT_ACTION_KV || typeof env.AGENT_ACTION_KV.put !== 'function') {
    return { ok: false, reason: 'action_kv_unavailable' };
  }
  const telegramUserId = safeString(auth.user?.telegramUserId);
  const slug = sanitizeSessionSlug(sessionSlug);
  if (!telegramUserId || !slug || !patch || typeof patch !== 'object' || Array.isArray(patch)) {
    return { ok: false, reason: 'settings_update_incomplete' };
  }
  assertNoSecretShape(patch, 'Telegram Mini App settings patch must not serialize secrets.');
  const patchFingerprint = stableFingerprint(patch);
  const idempotencyKey = buildOpaqueActionId(`telegram_mini_settings:${telegramUserId}:${slug}:${patchFingerprint}`);
  const requestId = idempotencyKey;
  const kvKey = `${AGENT_REQUEST_KV_PREFIX}${requestId}`;
  const existing = env.AGENT_ACTION_KV && typeof env.AGENT_ACTION_KV.get === 'function'
    ? safeJsonParse(await env.AGENT_ACTION_KV.get(kvKey).catch(() => null), null)
    : null;
  if (existing && typeof existing === 'object' && !Array.isArray(existing)) {
    assertNoSecretShape(existing, 'Telegram agent settings requests must not serialize secrets.');
    return {
      ok: true,
      requestId,
      status: existing.status || 'settings_update_request_created',
      canonicalApiRequest: existing.canonicalApiRequest || null,
      idempotencyKey,
      replayed: true,
    };
  }
  const record = {
    version: 1,
    requestId,
    idempotencyKey,
    patchFingerprint,
    action: TELEGRAM_BRIDGE_ACTIONS.UPDATE_AGENT_SETTINGS,
    status: 'settings_update_request_created',
    lane: TELEGRAM_CHAT_LANES.MINI_APP,
    telegramUserId,
    sessionSlug: slug,
    settingsPatchSummary: patch,
    settingsPatchRef: {
      kind: 'telegram_agent_settings_patch',
      requestId,
    },
    canonicalApiRequest: buildCanonicalAgentRequest({
      capabilityId: 'agent.settings.update',
      body: {
        agentAccountRef: 'telegram_managed_agent_ref',
        settingsPatchRef: 'telegram_settings_patch_ref',
        settingsPatchSummary: patch,
        session: slug,
        idempotencyKey,
      },
    }),
    createdAt,
  };
  assertNoSecretShape(record, 'Telegram agent settings requests must not serialize secrets.');
  await env.AGENT_ACTION_KV.put(kvKey, JSON.stringify(record), {
    expirationTtl: SUBMIT_REQUEST_TTL_SECONDS,
  });
  return {
    ok: true,
    requestId,
    status: record.status,
    canonicalApiRequest: record.canonicalApiRequest,
    idempotencyKey,
    replayed: false,
  };
}

async function handleDraftRequest({
  request,
  env = {},
  createdAt = new Date().toISOString(),
} = {}) {
  const auth = await authorizeMiniAppRequest(request, env);
  if (!auth.ok) {
    return json({ ok: false, error: auth.reason || 'telegram_init_data_invalid' }, { status: 401 });
  }
  if (!safeString(auth.user?.telegramUserId)) {
    return json({ ok: false, error: 'telegram_user_missing' }, { status: 401 });
  }
  const body = await request.json().catch(() => ({}));
  const url = new URL(request.url);
  const launch = safeString(body.launch || url.searchParams.get('launch') || url.searchParams.get('tgWebAppStartParam'));
  const questionKey = safeString(body.questionKey);
  const parsed = parseOpaqueActionId(questionKey);
  if (!parsed.ok) {
    return json({ ok: false, error: 'question_action_invalid' }, { status: 400 });
  }
  const record = await readActionRecord(env, parsed.actionId);
  const questionRef = record?.serverContextRef || {};
  if (
    !record ||
    record.action !== TELEGRAM_BRIDGE_ACTIONS.DRAFT_RESPONSE ||
    record.lane !== TELEGRAM_CHAT_LANES.MINI_APP ||
    record.miniAppQuestionAction !== true
  ) {
    return json({ ok: false, error: 'question_action_expired' }, { status: 404 });
  }
  if (auth.authMode === 'telegram') {
    const launchRecord = await resolveLaunchRecord(env, launch);
    if (!launchRecord) {
      return json({ ok: false, error: 'mini_app_launch_invalid' }, { status: 404 });
    }
    if (!miniAppLaunchMatchesQuestion(launchRecord, questionRef)) {
      return json({ ok: false, error: 'mini_app_launch_mismatch' }, { status: 403 });
    }
  }
  const normalizedAnswer = normalizeMiniAnswer(body.answer || {}, questionRef);
  if (!normalizedAnswer.ok) {
    return json({ ok: false, error: normalizedAnswer.reason || 'answer_invalid' }, { status: 400 });
  }
  const normalized = {
    user: { telegramUserId: safeString(auth.user.telegramUserId) },
    chat: { chatId: safeString(auth.chatInstance || auth.queryId || auth.user.telegramUserId) },
  };
  const saved = await persistAnswerDraft({
    env,
    normalized,
    sessionSlug: questionRef.sessionSlug,
    selectedQuestionId: questionRef.questionId,
    answerLabel: normalizedAnswer.label,
    answerValue: JSON.stringify(normalizedAnswer.answer),
    controlType: safeString(questionRef.questionType),
    submitLane: TELEGRAM_CHAT_LANES.MINI_APP,
    createdAt,
  });
  if (!saved.ok) {
    return json({ ok: false, error: saved.reason || 'answer_draft_save_failed' }, { status: 503 });
  }

  const submitRequest = body.submit === true
    ? await persistSubmitRequest({
      env,
      auth,
      questionRef,
      answer: normalizedAnswer.answer,
      draftKey: saved.key,
      createdAt,
    })
    : null;
  if (submitRequest && !submitRequest.ok) {
    const failure = submitFailureMessage(submitRequest);
    return json({
      ok: false,
      error: failure.reason,
      reason: failure.reason,
      message: failure.message,
      detail: failure.detail,
      status: submitRequest.status || '',
    }, { status: 503 });
  }

  return json({
    ok: true,
    status: submitRequest?.ok ? (submitRequest.status || 'submit_request_created') : 'draft_saved',
    draft: {
      status: 'draft_saved',
      questionIdShort: shortQuestionId(questionRef.questionId),
      answerLabel: normalizedAnswer.label,
      submitLane: TELEGRAM_CHAT_LANES.MINI_APP,
    },
    submitRequest,
  });
}

async function handleClearDraftsRequest({
  request,
  env = {},
} = {}) {
  const auth = await authorizeMiniAppRequest(request, env);
  if (!auth.ok) {
    return json({ ok: false, error: auth.reason || 'telegram_init_data_invalid' }, { status: 401 });
  }
  if (!safeString(auth.user?.telegramUserId)) {
    return json({ ok: false, error: 'telegram_user_missing' }, { status: 401 });
  }
  const body = await request.json().catch(() => ({}));
  const url = new URL(request.url);
  const launch = safeString(body.launch || url.searchParams.get('launch') || url.searchParams.get('tgWebAppStartParam'));
  const questionKeys = Array.isArray(body.questionKeys)
    ? body.questionKeys.map(safeString).filter(Boolean)
    : [];
  if (!questionKeys.length) {
    return json({ ok: false, error: 'question_keys_required' }, { status: 400 });
  }

  let launchRecord = null;
  if (auth.authMode === 'telegram') {
    launchRecord = await resolveLaunchRecord(env, launch);
    if (!launchRecord) {
      return json({ ok: false, error: 'mini_app_launch_invalid' }, { status: 404 });
    }
  }

  const normalized = {
    user: { telegramUserId: safeString(auth.user.telegramUserId) },
    chat: { chatId: safeString(auth.chatInstance || auth.queryId || auth.user.telegramUserId) },
  };
  let clearedCount = 0;
  const clearedQuestionKeys = [];
  for (const questionKey of questionKeys) {
    const parsed = parseOpaqueActionId(questionKey);
    if (!parsed.ok) continue;
    const record = await readActionRecord(env, parsed.actionId);
    const questionRef = record?.serverContextRef || {};
    if (
      !record ||
      record.action !== TELEGRAM_BRIDGE_ACTIONS.DRAFT_RESPONSE ||
      record.lane !== TELEGRAM_CHAT_LANES.MINI_APP ||
      record.miniAppQuestionAction !== true
    ) {
      continue;
    }
    if (auth.authMode === 'telegram' && !miniAppLaunchMatchesQuestion(launchRecord, questionRef)) {
      continue;
    }
    const deleted = await deleteAnswerDraft({
      env,
      normalized,
      sessionSlug: questionRef.sessionSlug,
      selectedQuestionId: questionRef.questionId,
    });
    if (deleted.ok) {
      clearedCount += 1;
      clearedQuestionKeys.push(questionKey);
    }
  }

  return json({
    ok: true,
    status: 'drafts_cleared',
    clearedCount,
    clearedQuestionKeys,
  });
}

async function handleTranscribeRequest({
  request,
  env = {},
  createdAt = new Date().toISOString(),
} = {}) {
  const auth = await authorizeMiniAppRequest(request, env);
  if (!auth.ok) {
    return json({ ok: false, error: auth.reason || 'telegram_init_data_invalid' }, { status: 401 });
  }
  if (!safeString(auth.user?.telegramUserId)) {
    return json({ ok: false, error: 'telegram_user_missing' }, { status: 401 });
  }
  const form = await request.formData().catch(() => null);
  if (!form || typeof form.get !== 'function') {
    return json({ ok: false, error: 'Expected multipart/form-data.' }, { status: 400 });
  }
  const audio = form.get('audio') || form.get('file');
  if (!audio || typeof audio === 'string' || typeof audio.arrayBuffer !== 'function') {
    return json({ ok: false, error: 'audio_file_required' }, { status: 400 });
  }

  const url = new URL(request.url);
  const launch = safeString(form.get('launch') || url.searchParams.get('launch') || url.searchParams.get('tgWebAppStartParam'));
  const questionKey = safeString(form.get('questionKey'));
  let questionRef = null;
  let sessionSlugHint = sanitizeSessionSlug(form.get('sessionSlug') || '');
  if (questionKey) {
    const parsed = parseOpaqueActionId(questionKey);
    if (!parsed.ok) {
      return json({ ok: false, error: 'question_action_invalid' }, { status: 400 });
    }
    const record = await readActionRecord(env, parsed.actionId);
    questionRef = record?.serverContextRef || {};
    if (
      !record ||
      record.action !== TELEGRAM_BRIDGE_ACTIONS.DRAFT_RESPONSE ||
      record.lane !== TELEGRAM_CHAT_LANES.MINI_APP ||
      record.miniAppQuestionAction !== true
    ) {
      return json({ ok: false, error: 'question_action_expired' }, { status: 404 });
    }
    sessionSlugHint = sanitizeSessionSlug(questionRef.sessionSlug || sessionSlugHint);
  }

  let launchRecord = null;
  if (auth.authMode === 'telegram') {
    launchRecord = await resolveLaunchRecord(env, launch);
    if (!launchRecord) {
      return json({ ok: false, error: 'mini_app_launch_invalid' }, { status: 404 });
    }
    if (questionRef && !miniAppLaunchMatchesQuestion(launchRecord, questionRef)) {
      return json({ ok: false, error: 'mini_app_launch_mismatch' }, { status: 403 });
    }
    if (!questionRef) {
      const launchRef = launchRecord.serverContextRef || {};
      const launchSessionSlug = sanitizeSessionSlug(launchRef.sessionSlug || '');
      if (!sessionSlugHint) sessionSlugHint = launchSessionSlug;
      if (
        launchRef.sessionPicker !== true &&
        launchSessionSlug &&
        sessionSlugHint &&
        launchSessionSlug !== sessionSlugHint
      ) {
        return json({ ok: false, error: 'mini_app_launch_mismatch' }, { status: 403 });
      }
    }
  }

  const policy = await loadSessionPolicy(env);
  const resolved = resolveSessionInvocation(policy, sessionSlugHint);
  if (!resolved.ok) {
    return json({ ok: false, error: resolved.reason || 'session_not_available' }, { status: 403 });
  }
  const eligibility = evaluateSponsoredResourceEligibility(resolved.session, {
    resource: 'ai',
    requestedRisk: 'submit',
    riskCeiling: policy.riskCeiling,
  });
  if (!eligibility.ok) {
    return json({ ok: false, error: eligibility.reason || 'session_ai_not_allowed' }, { status: 403 });
  }

  const workerUrl = resolveSessionWorkerUrl(env, resolved.session);
  if (!workerUrl) {
    return json({ ok: false, error: 'session_worker_url_missing' }, { status: 503 });
  }

  const principal = normalizeTelegramPrincipal(auth.user || {});
  const account = await deriveManagedDemoAccount({
    principal,
    deploymentId: env.AGENT_BRIDGE_DEPLOYMENT_ID || 'agent-bridge-live-demo',
    rootSecret: env.DEMO_SIGNER_ROOT_SECRET || '',
    lifecycle: 'account_created',
    createdAt,
  });
  const fetchImpl = env.AGENT_BRIDGE_FETCH || globalThis.fetch;
  const sessionAuth = await authenticateSessionWorker({
    env,
    session: resolved.session,
    account,
    principal,
    workerUrl,
    fetchImpl,
    now: createdAt ? new Date(createdAt) : new Date(),
  }).catch((error) => ({ ok: false, reason: safeString(error?.message || error) || 'worker_auth_failed' }));
  if (!sessionAuth.ok || !sessionAuth.token) {
    return json({ ok: false, error: sessionAuth.reason || 'worker_auth_failed' }, { status: 503 });
  }

  const upstream = new FormData();
  const model = safeString(form.get('model') || env.AGENT_BRIDGE_TRANSCRIBE_MODEL || 'whisper-1') || 'whisper-1';
  upstream.append('file', audio, audio.name || `telegram-comment.${audioFileExtension(audio)}`);
  upstream.append('model', model);
  const response = await fetchImpl(`${sessionAuth.workerUrl}/transcribe`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${sessionAuth.token}`,
    },
    body: upstream,
  });
  const body = await response.json().catch(() => ({}));
  if (!response?.ok) {
    return json({
      ok: false,
      error: safeString(body?.error || body?.message || response?.status) || 'transcription_failed',
    }, { status: response?.status || 502 });
  }
  return json({
    ok: true,
    text: safeString(body?.text),
  });
}

const QUESTION_SEARCH_SYNONYMS = Object.freeze({
  food: ['pizza', 'meal', 'meals', 'restaurant', 'lunch', 'dinner', 'snack', 'drink', 'coffee'],
  foods: ['pizza', 'meal', 'meals', 'restaurant', 'lunch', 'dinner', 'snack', 'drink', 'coffee'],
  eat: ['pizza', 'meal', 'restaurant', 'lunch', 'dinner', 'snack'],
  eating: ['pizza', 'meal', 'restaurant', 'lunch', 'dinner', 'snack'],
  preference: ['prefer', 'favorite', 'favourite', 'like', 'choice', 'choose'],
  preferences: ['prefer', 'favorite', 'favourite', 'like', 'choice', 'choose'],
  pets: ['pet', 'cat', 'dog', 'animal'],
  animal: ['pet', 'pets', 'cat', 'dog'],
  animals: ['pet', 'pets', 'cat', 'dog'],
  office: ['work', 'workplace', 'company'],
  work: ['office', 'workplace', 'job'],
  risk: ['concern', 'concerns', 'danger', 'safe', 'safety', 'uncertain', 'uncertainty'],
});

function searchTokens(query = '') {
  const baseTokens = safeString(query)
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .map(safeString)
    .filter((token) => token.length > 1);
  const out = new Set();
  baseTokens.forEach((token) => {
    out.add(token);
    (QUESTION_SEARCH_SYNONYMS[token] || []).forEach((synonym) => out.add(synonym));
    if (token.endsWith('s') && token.length > 3) out.add(token.slice(0, -1));
  });
  return [...out];
}

function questionSearchText(question = {}) {
  return [
    question.prompt,
    question.title,
    question.questionType,
    question.sessionName,
    Array.isArray(question.options) ? question.options.join(' ') : '',
  ].map((value) => safeString(value).toLowerCase()).join(' ');
}

function semanticQuestionSearchScore(question = {}, query = '') {
  const tokens = searchTokens(query);
  if (!tokens.length) return 0;
  const text = questionSearchText(question);
  let score = 0;
  tokens.forEach((token) => {
    if (text.includes(token)) score += token.length + 4;
    else if (token.length > 4 && text.includes(token.slice(0, -1))) score += 3;
  });
  return score;
}

function fallbackQuestionSearchResults({
  query = '',
  questions = [],
} = {}) {
  return (Array.isArray(questions) ? questions : [])
    .map((question, index) => ({
      key: safeString(question.questionKey || question.key),
      score: semanticQuestionSearchScore(question, query),
      rank: index + 1,
      reason: 'semantic_keyword_match',
    }))
    .filter((entry) => entry.key && entry.score > 0)
    .sort((left, right) => right.score - left.score || left.rank - right.rank)
    .map((entry, index) => ({ ...entry, rank: index + 1 }));
}

function compactSearchQuestion(question = {}, index = 0) {
  return {
    key: safeString(question.questionKey || question.key),
    index,
    type: safeString(question.questionType),
    prompt: normalizeText(question.prompt || question.title, 600),
    options: Array.isArray(question.options)
      ? question.options.map((option) => normalizeText(option, 80)).filter(Boolean).slice(0, 12)
      : [],
  };
}

function extractJsonObject(text = '') {
  const raw = safeString(text);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {}
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(raw.slice(start, end + 1));
  } catch {
    return null;
  }
}

function normalizeAiSearchResults(parsed = {}, fallback = [], allowedKeys = null) {
  const matches = Array.isArray(parsed?.matches) ? parsed.matches : [];
  const byKey = new Map(fallback.map((entry) => [entry.key, entry]));
  const allowed = allowedKeys instanceof Set ? allowedKeys : null;
  const out = [];
  matches.forEach((match, index) => {
    const key = safeString(match?.key);
    if (!key) return;
    if (allowed && !allowed.has(key)) return;
    const score = Number(match?.score);
    out.push({
      key,
      score: Number.isFinite(score) ? Math.max(1, Math.min(100, Math.round(score))) : (byKey.get(key)?.score || 1),
      rank: index + 1,
      reason: safeString(match?.reason).slice(0, 120) || 'ai_semantic_match',
    });
  });
  return out.length ? out : fallback;
}

function resultCountObject(counts = []) {
  return Object.fromEntries(counts.map(([label, count]) => [label, count]));
}

function miniResultQuestionRow(row = {}) {
  const total = Number(row.total || 0) || 0;
  const differenceScore = Number(row.differenceScore || 0) || 0;
  const consensusScore = total > 0 ? Number(((1 - differenceScore) * 100).toFixed(1)) : 0;
  return {
    questionId: safeString(row.questionId),
    prompt: safeString(row.prompt),
    total,
    participants: Number(row.participants || 0) || 0,
    counts: resultCountObject(Array.isArray(row.counts) ? row.counts : []),
    countsText: formatCounts(Array.isArray(row.counts) ? row.counts : []),
    differenceScore: Number(differenceScore.toFixed(3)),
    differencePercent: Number((differenceScore * 100).toFixed(1)),
    consensusPercent: consensusScore,
    hasDifference: row.hasDifference === true,
  };
}

function miniResultGroup(group = {}) {
  return {
    groupId: safeString(group.groupId),
    label: safeString(group.label),
    theme: safeString(group.theme),
    size: Number(group.size || 0) || 0,
    aliases: Array.isArray(group.aliases) ? group.aliases.map(safeString).filter(Boolean) : [],
    averageScore: Number(group.averageScore || 0) || 0,
    topStatements: (Array.isArray(group.topStatements) ? group.topStatements : []).slice(0, 3).map((statement) => ({
      label: safeString(statement.label),
      prompt: safeString(statement.prompt),
      differenceScore: Number(statement.differenceScore || 0) || 0,
      cluster: statement.cluster || {},
      overall: statement.overall || {},
    })),
  };
}

function miniDemoQuestionsForResults(questions = []) {
  const fallback = [
    'Arriving 10 minutes early is better than arriving exactly on time.',
    'Showering at night beats showering in the morning.',
    'Leftover pizza tastes better cold than reheated.',
    'Participants should explain uncertainty before choosing Agree or Disagree.',
    'Results should be shared publicly once enough people respond.',
  ];
  const source = (Array.isArray(questions) ? questions : [])
    .filter((question) => safeString(question.prompt || question.questionText || question.title))
    .slice(0, 5);
  const rows = source.length ? source : fallback.map((prompt, index) => ({
    questionId: `demo-q-${index + 1}`,
    questionType: 'agree_unsure_disagree',
    prompt,
  }));
  return rows.map((question, index) => ({
    ...question,
    questionId: safeString(question.questionId || question.id || `demo-q-${index + 1}`),
    questionType: 'agree_unsure_disagree',
    prompt: safeString(question.prompt || question.questionText || question.title || fallback[index] || `Demo question ${index + 1}`),
    questionText: safeString(question.prompt || question.questionText || question.title || fallback[index] || `Demo question ${index + 1}`),
  }));
}

function miniDemoResultRecords(questions = []) {
  const labelsByQuestion = [
    ['Agree', 'Agree', 'Agree', 'Unsure', 'Disagree'],
    ['Agree', 'Agree', 'Unsure', 'Disagree', 'Disagree'],
    ['Agree', 'Unsure', 'Disagree', 'Disagree', 'Disagree'],
    ['Agree', 'Agree', 'Agree', 'Disagree', 'Unsure'],
    ['Agree', 'Unsure', 'Unsure', 'Disagree', 'Agree'],
  ];
  return miniDemoQuestionsForResults(questions).flatMap((question, questionIndex) => (
    (labelsByQuestion[questionIndex] || labelsByQuestion[0]).map((label, participantIndex) => ({
      key: `demo:${question.questionId}:${participantIndex + 1}`,
      createdAt: `demo-${questionIndex + 1}-${participantIndex + 1}`,
      telegramUserId: `demo-user-${participantIndex + 1}`,
      questionId: question.questionId,
      label,
      value: lower(label),
      questionType: 'agree_unsure_disagree',
      text: '',
      comments: participantIndex % 2 === 0 ? 'Demo rationale for the selected stance.' : '',
    }))
  ));
}

function resultRowsToBeeswarmRows(rows = []) {
  return rows.slice(0, 3).map((row, index) => ({
    label: `Q${index + 1}`,
    prompt: safeString(row.prompt),
    answers: Object.entries(row.counts || {}).flatMap(([label, count]) => (
      new Array(Math.max(0, Number(count || 0))).fill(label)
    )),
  }));
}

async function resolveMiniAppResultsContext({
  request,
  env = {},
  body = {},
} = {}) {
  const auth = await authorizeMiniAppRequest(request, env);
  if (!auth.ok) {
    return { ok: false, status: 401, error: auth.reason || 'telegram_init_data_invalid' };
  }
  const url = new URL(request.url);
  const launch = safeString(body.launch || url.searchParams.get('launch') || url.searchParams.get('tgWebAppStartParam'));
  const policy = await loadSessionPolicy(env);
  const linkedSessions = linkedPolicySessions(policy);
  const linkedSessionLookup = new Set(linkedSessions.map((session) => session.sessionSlug));
  const requestedSessionSlugs = normalizeSessionSlugList(
    body.sessionSlug ||
    body.sessions ||
    url.searchParams.get('sessionSlug') ||
    url.searchParams.get('sessions') ||
    url.searchParams.get('sessionSlugs')
  );
  let sessionSlug = requestedSessionSlugs[0] || '';
  let launchRecord = null;
  if (auth.authMode === 'telegram') {
    launchRecord = await resolveLaunchRecord(env, launch);
    if (!launchRecord) {
      return { ok: false, status: 404, error: 'mini_app_launch_invalid' };
    }
    if (!isValidMiniAppLaunchRecord(launchRecord)) {
      return { ok: false, status: 403, error: 'mini_app_launch_mismatch' };
    }
    if (!sessionSlug) sessionSlug = launchSessionSlug(launchRecord, env);
    if (!miniAppLaunchAllowsSession(launchRecord, sessionSlug)) {
      return { ok: false, status: 403, error: 'mini_app_launch_mismatch' };
    }
  }
  if (!sessionSlug) {
    sessionSlug = linkedSessions.find((session) => session.default)?.sessionSlug ||
      linkedSessions[0]?.sessionSlug ||
      sanitizeSessionSlug(env.AGENT_BRIDGE_DEFAULT_SESSION_SLUG || env.DEFAULT_SESSION_SLUG);
  }
  if (!sessionSlug || (linkedSessionLookup.size > 0 && !linkedSessionLookup.has(sessionSlug))) {
    return { ok: false, status: 403, error: 'session_not_selectable' };
  }
  const resolved = resolveSessionInvocation(policy, sessionSlug);
  if (!resolved.ok) {
    return { ok: false, status: 404, error: resolved.reason || 'session_not_available' };
  }
  return {
    ok: true,
    auth,
    launch,
    policy,
    session: resolved.session,
  };
}

async function buildMiniAppResultsSummary({
  env = {},
  session = {},
  demo = false,
} = {}) {
  const sessionSlug = sanitizeSessionSlug(session.sessionSlug);
  const demoData = demo === true;
  const exposure = miniResultsExposurePolicy(session);
  const viewLevels = miniResultsLevelState(exposure);
  const loadedQuestions = await loadQuestionsForSession(env, sessionSlug);
  const loadedQuestionList = Array.isArray(loadedQuestions.questions) ? loadedQuestions.questions : [];
  const liveRecords = await loadSubmittedResultRecords(env, sessionSlug);
  const liveConsensusQuestions = consensusQuestionsForResults(loadedQuestionList);
  const questions = demoData
    ? miniDemoQuestionsForResults(liveConsensusQuestions.length ? liveConsensusQuestions : loadedQuestionList)
    : loadedQuestionList;
  const records = demoData ? miniDemoResultRecords(questions) : liveRecords;
  const consensusQuestions = consensusQuestionsForResults(questions);
  const consensusQuestionIds = new Set(consensusQuestions.map(readQuestionId).filter(Boolean));
  const consensusRecords = records.filter((record) => consensusQuestionIds.has(record.questionId));
  const summaries = exposure.aggregateResultsEnabled
    ? summarizeQuestionResults(consensusRecords, consensusQuestions)
      .filter((summary) => Number(summary.total || 0) > 0)
    : [];
  const divisive = exposure.aggregateResultsEnabled
    ? summaries.slice()
      .sort((left, right) => (
        right.differenceScore - left.differenceScore ||
        right.total - left.total ||
        left.prompt.localeCompare(right.prompt)
      ))
      .slice(0, 5)
      .map(miniResultQuestionRow)
    : [];
  const consensus = exposure.aggregateResultsEnabled
    ? summaries.slice()
      .sort((left, right) => (
        left.differenceScore - right.differenceScore ||
        right.total - left.total ||
        left.prompt.localeCompare(right.prompt)
      ))
      .slice(0, 5)
      .map(miniResultQuestionRow)
    : [];
  const graph = buildParticipantGraph(records, questions);
  const rawGroups = Array.isArray(graph.groups) ? graph.groups : [];
  const groupViewEnabled = exposure.anonymizedGroupsEnabled || demoData;
  const exposedGroups = groupViewEnabled
    ? rawGroups
      .filter((group) => Number(group.size || 0) >= exposure.minGroupSize)
      .map((group) => miniResultGroup(demoData ? { ...group, demo: true } : group))
    : [];
  const counts = {
    questionsSubmitted: questions.length,
    answerableQuestions: questions.filter((question) => !question.payloadUnavailable && !question.locked).length,
    responsesGiven: records.length,
    uniqueParticipants: Number(graph.participantCount || 0) || 0,
    binaryQuestions: consensusQuestions.length,
    aggregateRows: summaries.length,
  };
  const publicSnapshot = {
    type: 'ce_public_results_snapshot',
    version: 1,
    audience: 'telegram_participant',
    demo: demoData,
    session: {
      sessionSlug,
      sessionName: safeString(session.sessionName || session.name || sessionSlug),
      mode: session.telegramOnly === true ? 'telegram_only' : safeString(session.sessionMode || 'telegram_enabled'),
    },
    exposure: {
      participantLevel: groupViewEnabled ? 4 : (exposure.aggregateResultsEnabled ? 3 : 1),
      levels: viewLevels,
      redactions: [
        'telegram_user_ids',
        'wallet_addresses',
        'raw_response_records',
      ],
      minGroupSize: exposure.minGroupSize,
    },
    counts,
    aggregateResults: {
      enabled: exposure.aggregateResultsEnabled,
      consensus,
      divisive,
    },
    anonymizedGroups: {
      enabled: groupViewEnabled,
      groups: exposedGroups,
    },
  };
  return {
    ok: true,
    sessionSlug,
    sessionName: safeString(session.sessionName || session.name || sessionSlug),
    responseCount: counts.responsesGiven,
    demo: demoData,
    participantCount: counts.uniqueParticipants,
    questionCount: counts.questionsSubmitted,
    binaryQuestionCount: counts.binaryQuestions,
    consensusQuestionCount: counts.aggregateRows,
    source: loadedQuestions.source || 'telegram_worker_question_cache',
    sourceReason: loadedQuestions.reason || '',
    exposure: publicSnapshot.exposure,
    viewLevels,
    counts,
    questions: {
      consensus,
      divisive,
    },
    groupView: {
      enabled: groupViewEnabled,
      status: demoData ? 'demo_preview' : (exposure.anonymizedGroupsEnabled ? 'available' : 'admin_can_enable'),
      reason: groupViewEnabled ? '' : 'level_4_anonymized_groups_admin_disabled',
      minGroupSize: exposure.minGroupSize,
      hiddenGroupCount: groupViewEnabled
        ? Math.max(0, rawGroups.length - exposedGroups.length)
        : null,
    },
    groups: exposedGroups,
    publicSnapshot,
  };
}

async function handleResultsRequest({
  request,
  env = {},
  createdAt = new Date().toISOString(),
} = {}) {
  const body = request.method === 'POST' ? await request.json().catch(() => ({})) : {};
  const url = new URL(request.url);
  const demo = body.demo === true || ['1', 'true', 'yes', 'on'].includes(lower(url.searchParams.get('demo')));
  const context = await resolveMiniAppResultsContext({ request, env, body });
  if (!context.ok) {
    return json({ ok: false, error: context.error || 'results_unavailable' }, { status: context.status || 400 });
  }
  const summary = await buildMiniAppResultsSummary({ env, session: context.session, demo });
  if (request.method !== 'POST' || safeString(body.action || body.mode) !== 'analyze_group') {
    return json(summary);
  }
  const groupId = safeString(body.groupId);
  const loadedQuestions = (await loadQuestionsForSession(env, context.session.sessionSlug)).questions || [];
  const graphQuestions = demo
    ? miniDemoQuestionsForResults(consensusQuestionsForResults(loadedQuestions).length ? consensusQuestionsForResults(loadedQuestions) : loadedQuestions)
    : loadedQuestions;
  const graphRecords = demo ? miniDemoResultRecords(graphQuestions) : await loadSubmittedResultRecords(env, context.session.sessionSlug);
  const liveGraph = buildParticipantGraph(graphRecords, graphQuestions);
  const exposure = miniResultsExposurePolicy(context.session);
  if (exposure.anonymizedGroupsEnabled !== true && !demo) {
    return json({
      ok: false,
      error: 'level_4_anonymized_groups_admin_disabled',
      summary,
    }, { status: 403 });
  }
  const group = (Array.isArray(liveGraph.groups) ? liveGraph.groups : [])
    .filter((item) => Number(item.size || 0) >= exposure.minGroupSize)
    .find((item) => item.groupId === groupId);
  if (!group) {
    return json({ ok: false, error: 'group_not_found', summary }, { status: 404 });
  }
  const ai = await analyzeParticipantResultGroup({
    env,
    normalized: context.auth.user || {},
    policy: context.policy,
    session: context.session,
    group,
    groups: liveGraph.groups,
    createdAt,
  });
  return json({
    ok: true,
    sessionSlug: context.session.sessionSlug,
    group: miniResultGroup(group),
    aiOk: ai.ok === true,
    reason: ai.reason || '',
    analysis: ai.analysis,
    summary,
  });
}

async function handleResultsImageRequest({
  request,
  env = {},
} = {}) {
  const url = new URL(request.url);
  const mode = lower(url.searchParams.get('mode')) === 'group' ? 'group' : 'consensus';
  const demo = ['1', 'true', 'yes', 'on'].includes(lower(url.searchParams.get('demo')));
  const context = await resolveMiniAppResultsContext({ request, env });
  if (!context.ok) {
    return json({ ok: false, error: context.error || 'results_unavailable' }, { status: context.status || 400 });
  }
  const loadedQuestions = await loadQuestionsForSession(env, context.session.sessionSlug);
  const liveQuestions = Array.isArray(loadedQuestions.questions) ? loadedQuestions.questions : [];
  const liveRecords = await loadSubmittedResultRecords(env, context.session.sessionSlug);
  const consensusQuestions = consensusQuestionsForResults(liveQuestions);
  const imageQuestions = demo
    ? miniDemoQuestionsForResults(consensusQuestions.length ? consensusQuestions : liveQuestions)
    : liveQuestions;
  const imageRecords = demo ? miniDemoResultRecords(imageQuestions) : liveRecords;
  const exposure = miniResultsExposurePolicy(context.session);
  if (mode === 'consensus' && exposure.aggregateResultsEnabled !== true && !demo) {
    return json({ ok: false, error: 'level_3_aggregate_results_admin_disabled' }, { status: 403 });
  }
  if (mode === 'group' && exposure.anonymizedGroupsEnabled !== true && !demo) {
    return json({ ok: false, error: 'level_4_anonymized_groups_admin_disabled' }, { status: 403 });
  }
  let image;
  if (mode === 'group') {
    const graph = buildParticipantGraph(imageRecords, imageQuestions);
    image = buildResultsImage({
      mode,
      sessionTitle: context.session.sessionName || context.session.sessionSlug,
      responseCount: imageRecords.length,
      demo,
      participants: graph.participants,
      groups: graph.groups,
    });
  } else {
    const binaryQuestions = consensusQuestionsForResults(imageQuestions);
    const binaryIds = new Set(binaryQuestions.map(readQuestionId).filter(Boolean));
    const rows = summarizeQuestionResults(
      imageRecords.filter((record) => binaryIds.has(record.questionId)),
      binaryQuestions
    )
      .filter((summary) => Number(summary.total || 0) > 0)
      .sort((left, right) => (
        right.differenceScore - left.differenceScore ||
        right.total - left.total ||
        left.prompt.localeCompare(right.prompt)
      ))
      .slice(0, 3)
      .map(miniResultQuestionRow);
    image = buildResultsImage({
      mode: 'consensus',
      sessionTitle: context.session.sessionName || context.session.sessionSlug,
      responseCount: imageRecords.length,
      demo,
      beeswarmRows: resultRowsToBeeswarmRows(rows),
    });
  }
  return new Response(image.bytes, {
    status: 200,
    headers: {
      'content-type': image.contentType,
      'cache-control': 'no-store',
      'content-disposition': `inline; filename="${image.filename.replace(/[^A-Za-z0-9_.-]/g, '_')}"`,
    },
  });
}

async function handleGroupsRequest({
  request,
  env = {},
  createdAt = new Date().toISOString(),
} = {}) {
  const body = request.method === 'POST' ? await request.json().catch(() => ({})) : {};
  const context = await resolveMiniAppResultsContext({ request, env, body });
  if (!context.ok) {
    return json({ ok: false, error: context.error || 'groups_unavailable' }, { status: context.status || 400 });
  }
  if (context.session?.telegramOnly !== true) {
    return json({ ok: false, error: 'telegram_only_session_required' }, { status: 403 });
  }
  if (request.method === 'POST') {
    const saved = await saveTelegramLightweightGroupMembership({
      env,
      session: context.session,
      telegramUserId: context.auth.user?.telegramUserId,
      selections: body.selections || {},
      createdAt,
    });
    if (!saved.ok) return json({ ok: false, error: saved.reason || 'groups_save_failed' }, { status: 503 });
    return json({ ok: true, groups: saved.groups });
  }
  const groups = await loadTelegramLightweightGroups({
    env,
    session: context.session,
    telegramUserId: context.auth.user?.telegramUserId,
  });
  return json({ ok: true, groups });
}

async function handleSearchRequest({
  request,
  env = {},
  createdAt = new Date().toISOString(),
} = {}) {
  const auth = await authorizeMiniAppRequest(request, env);
  if (!auth.ok) {
    return json({ ok: false, error: auth.reason || 'telegram_init_data_invalid' }, { status: 401 });
  }
  const body = await request.json().catch(() => ({}));
  const url = new URL(request.url);
  const launch = safeString(body.launch || url.searchParams.get('launch') || url.searchParams.get('tgWebAppStartParam'));
  const query = normalizeText(body.query, 300);
  const questions = (Array.isArray(body.questions) ? body.questions : [])
    .map(compactSearchQuestion)
    .filter((question) => question.key && question.prompt)
    .slice(0, 80);
  if (!query || !questions.length) {
    return json({ ok: true, source: 'empty', results: [] });
  }

  let sessionSlugHint = sanitizeSessionSlug(body.sessionSlug || '');
  if (auth.authMode === 'telegram') {
    const launchRecord = await resolveLaunchRecord(env, launch);
    if (!launchRecord) {
      return json({ ok: false, error: 'mini_app_launch_invalid' }, { status: 404 });
    }
    const launchRef = launchRecord.serverContextRef || {};
    const launchSessionSlug = sanitizeSessionSlug(launchRef.sessionSlug || '');
    if (!sessionSlugHint) sessionSlugHint = launchSessionSlug;
    if (
      launchRef.sessionPicker !== true &&
      launchSessionSlug &&
      sessionSlugHint &&
      launchSessionSlug !== sessionSlugHint
    ) {
      return json({ ok: false, error: 'mini_app_launch_mismatch' }, { status: 403 });
    }
  }

  const fallback = fallbackQuestionSearchResults({ query, questions });
  const policy = await loadSessionPolicy(env);
  const resolved = resolveSessionInvocation(policy, sessionSlugHint);
  if (!resolved.ok) {
    return json({ ok: true, source: 'semantic_fallback', fallbackReason: resolved.reason || 'session_not_available', results: fallback });
  }
  const eligibility = evaluateSponsoredResourceEligibility(resolved.session, {
    resource: 'ai',
    requestedRisk: RISK_CEILINGS.SUBMIT,
    riskCeiling: policy.riskCeiling,
  });
  const workerUrl = resolveSessionWorkerUrl(env, resolved.session);
  if (!eligibility.ok || !workerUrl) {
    return json({
      ok: true,
      source: 'semantic_fallback',
      fallbackReason: eligibility.reason || 'session_worker_url_missing',
      results: fallback,
    });
  }

  const principal = normalizeTelegramPrincipal(auth.user || {});
  const account = await deriveManagedDemoAccount({
    principal,
    deploymentId: env.AGENT_BRIDGE_DEPLOYMENT_ID || 'agent-bridge-live-demo',
    rootSecret: env.DEMO_SIGNER_ROOT_SECRET || '',
    lifecycle: 'account_created',
    createdAt,
  });
  const fetchImpl = env.AGENT_BRIDGE_FETCH || globalThis.fetch;
  try {
    const sessionAuth = await authenticateSessionWorker({
      env,
      session: resolved.session,
      account,
      principal,
      workerUrl,
      fetchImpl,
      now: createdAt ? new Date(createdAt) : new Date(),
    });
    if (!sessionAuth.ok || !sessionAuth.token) {
      return json({
        ok: true,
        source: 'semantic_fallback',
        fallbackReason: sessionAuth.reason || 'worker_auth_failed',
        results: fallback,
      });
    }
    const response = await fetchImpl(`${sessionAuth.workerUrl}/ai`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        Authorization: `Bearer ${sessionAuth.token}`,
      },
      body: JSON.stringify({
        provider: 'openai',
        model: safeString(env.AGENT_BRIDGE_AI_SEARCH_MODEL || 'gpt-5'),
        messages: [
          {
            role: 'system',
            content: 'Rank the provided survey questions by semantic relevance to the user query. Return only JSON: {"matches":[{"key":"question key","score":1-100,"reason":"short phrase"}]}. Include only genuinely relevant questions.',
          },
          {
            role: 'user',
            content: JSON.stringify({ query, questions }),
          },
        ],
        max_output_tokens: 700,
        response_format: { type: 'json_object' },
        temperature: 0,
      }),
    });
    const aiBody = await response.json().catch(() => ({}));
    if (!response?.ok) {
      return json({
        ok: true,
        source: 'semantic_fallback',
        fallbackReason: safeString(aiBody?.error || response?.status) || 'ai_search_failed',
        results: fallback,
      });
    }
    const parsed = extractJsonObject(aiBody?.completion || aiBody?.output_text || '');
    return json({
      ok: true,
      source: parsed ? 'ai' : 'semantic_fallback',
      results: normalizeAiSearchResults(parsed, fallback, new Set(questions.map((question) => question.key))),
    });
  } catch (error) {
    return json({
      ok: true,
      source: 'semantic_fallback',
      fallbackReason: safeString(error?.message || error) || 'ai_search_failed',
      results: fallback,
    });
  }
}

async function handleSettingsRequest({
  request,
  env = {},
  createdAt = new Date().toISOString(),
} = {}) {
  const auth = await authorizeMiniAppRequest(request, env);
  if (!auth.ok) {
    return json({ ok: false, error: auth.reason || 'telegram_init_data_invalid' }, { status: 401 });
  }
  if (!safeString(auth.user?.telegramUserId)) {
    return json({ ok: false, error: 'telegram_user_missing' }, { status: 401 });
  }
  const body = await request.json().catch(() => ({}));
  const url = new URL(request.url);
  const launch = safeString(body.launch || url.searchParams.get('launch') || url.searchParams.get('tgWebAppStartParam'));
  const launchRecord = await resolveLaunchRecord(env, launch);
  if (auth.authMode === 'telegram') {
    if (!launchRecord) {
      return json({ ok: false, error: 'mini_app_launch_invalid' }, { status: 404 });
    }
    if (!miniAppLaunchAllowsAgentWrite(launchRecord)) {
      return json({ ok: false, error: 'mini_app_launch_mismatch' }, { status: 403 });
    }
  } else if (launchRecord && !miniAppLaunchAllowsAgentWrite(launchRecord)) {
    return json({ ok: false, error: 'mini_app_launch_mismatch' }, { status: 403 });
  }
  let normalizedPatch;
  try {
    normalizedPatch = normalizeAgentSettingsInput(body.settings || body.patch || {});
  } catch (error) {
    return json({ ok: false, error: safeString(error?.message || error) || 'settings_patch_invalid' }, { status: 400 });
  }
  if (!normalizedPatch.ok) {
    return json({ ok: false, error: normalizedPatch.reason || 'settings_patch_invalid' }, { status: 400 });
  }
  const sessionSlug = launchSessionSlug(launchRecord, env);
  const requestRecord = await persistSettingsUpdateRequest({
    env,
    auth,
    sessionSlug,
    patch: normalizedPatch.publicSummary,
    createdAt,
  });
  if (!requestRecord.ok) {
    return json({ ok: false, error: requestRecord.reason || 'settings_update_request_failed' }, { status: 503 });
  }
  return json({
    ok: true,
    status: requestRecord.status,
    settings: normalizedPatch.publicSummary,
    request: requestRecord,
  });
}

function telegramMiniAppHtml() {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>Context Engine</title>
  <script src="https://telegram.org/js/telegram-web-app.js?62"></script>
  <style>
    :root {
      color-scheme: light dark;
      --bg: #171936;
      --surface: #202458;
      --surface-soft: #262b66;
      --text: #f6f8ff;
      --muted: #b8c0d8;
      --line: rgba(255, 255, 255, 0.16);
      --accent: #62ffbf;
      --accent-2: #2cc3ff;
      --results-accent: #62ffbf;
      --groups-accent: #b8a2ff;
      --filter-accent: #2cc3ff;
      --settings-accent: #ffd166;
      --accent-text: #11142f;
      --danger: #ff8a7a;
      --ok: #62ffbf;
      --shadow-dark: #10122c;
      --shadow-light: #2d3274;
    }
    * { box-sizing: border-box; }
    html {
      min-height: 100%;
      overflow-y: auto;
      overscroll-behavior-y: auto;
    }
    body {
      margin: 0;
      min-height: 100%;
      font: 15px/1.45 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      color: var(--text);
      background: var(--bg);
      overflow-y: auto;
      -webkit-overflow-scrolling: touch;
      overscroll-behavior-y: auto;
    }
    button, input, textarea { font: inherit; }
    button { cursor: pointer; }
    .app {
      min-height: var(--tg-viewport-height, 100dvh);
      display: grid;
      grid-template-rows: auto auto;
      align-content: start;
      padding: max(16px, env(safe-area-inset-top)) 14px max(14px, env(safe-area-inset-bottom));
      gap: 14px;
      overflow-x: hidden;
      overflow-y: visible;
      overscroll-behavior-y: auto;
    }
    header { display: grid; gap: 8px; }
    .headerBar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }
    .headerActions {
      display: flex;
      align-items: center;
      gap: 8px;
      flex: 0 0 auto;
    }
    h1 { margin: 0; font-size: 20px; line-height: 1.15; letter-spacing: 0; }
    .iconButton {
      width: 40px;
      height: 40px;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: rgba(255, 255, 255, 0.06);
      color: var(--text);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0;
    }
    .iconButton.active {
      color: var(--accent-text);
      box-shadow: 0 0 14px rgba(255, 255, 255, 0.16);
    }
    .filterButton {
      border-color: rgba(44, 195, 255, 0.45);
      color: var(--filter-accent);
    }
    .filterButton.active {
      background: var(--filter-accent);
      border-color: var(--filter-accent);
    }
    .resultsButton {
      border-color: rgba(98, 255, 191, 0.45);
      color: var(--results-accent);
    }
    .resultsButton.active {
      background: var(--results-accent);
      border-color: var(--results-accent);
    }
    .groupsButton {
      border-color: rgba(184, 162, 255, 0.45);
      color: var(--groups-accent);
    }
    .groupsButton.active {
      background: var(--groups-accent);
      border-color: var(--groups-accent);
    }
    .settingsButton {
      border-color: rgba(255, 209, 102, 0.45);
      color: var(--settings-accent);
    }
    .settingsButton.active {
      background: var(--settings-accent);
      border-color: var(--settings-accent);
    }
    .iconButton svg {
      width: 17px;
      height: 17px;
      fill: currentColor;
      display: block;
    }
    .iconButton svg.filterIcon {
      fill: none;
      stroke: currentColor;
      stroke-width: 2;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
    .resultsButton svg {
      fill: none;
      stroke: currentColor;
      stroke-width: 2;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
    .meta { color: var(--muted); font-size: 13px; display: flex; flex-wrap: wrap; gap: 8px; }
    .status { min-height: 20px; color: var(--muted); font-size: 13px; }
    .settingsPanel select {
      min-height: 38px;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: var(--surface-soft);
      color: var(--text);
      padding: 8px 10px;
    }
    .settingsPanel,
    .groupsPanel,
    .filterPanel,
    .resultsPanel {
      display: none;
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 12px;
      gap: 10px;
      align-items: end;
    }
    .settingsPanel {
      grid-template-columns: minmax(0, 1fr) auto auto;
      border-color: rgba(255, 209, 102, 0.52);
      background: rgba(92, 71, 31, 0.36);
    }
    .filterPanel {
      grid-template-columns: minmax(0, 1fr);
      align-items: center;
      border-color: rgba(44, 195, 255, 0.52);
      background: rgba(20, 70, 104, 0.36);
    }
    .groupsPanel {
      grid-template-columns: minmax(0, 1fr);
      align-items: stretch;
      border-color: rgba(184, 162, 255, 0.52);
      background: rgba(73, 55, 132, 0.34);
    }
    .resultsPanel {
      grid-template-columns: minmax(0, 1fr);
      align-items: stretch;
      border-color: rgba(98, 255, 191, 0.52);
      background: rgba(24, 92, 71, 0.28);
    }
    .settingsPanel.open, .groupsPanel.open, .filterPanel.open, .resultsPanel.open { display: grid; }
    .resultsHeader {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
    }
    .resultsSessionOptions, .resultGroups, .resultViewLevels {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .resultImageActions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
    }
    .resultImagePreview {
      display: none;
      width: 100%;
      max-height: 58vh;
      object-fit: contain;
      background: #ffffff;
      border: 1px solid var(--line);
      border-radius: 8px;
    }
    .resultImagePreview.open { display: block; }
    .groupsSessionOptions, .groupCategories, .groupProposals {
      display: grid;
      gap: 10px;
    }
    .groupsSessionOptions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .groupCategory {
      display: grid;
      gap: 8px;
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 10px;
      background: rgba(255, 255, 255, 0.06);
    }
    .groupCategoryHeader {
      display: grid;
      gap: 2px;
    }
    .groupCategoryHeader strong { color: var(--text); }
    .groupCategoryHeader span, .groupProposal { color: var(--muted); font-size: 12px; }
    .groupOptions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .groupOption {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      min-height: 34px;
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 6px 8px;
      background: rgba(255, 255, 255, 0.06);
    }
    .groupActions {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
    }
    .resultLevel {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      border: 1px solid var(--line);
      border-radius: 999px;
      padding: 6px 9px;
      color: var(--muted);
      background: rgba(255, 255, 255, 0.06);
      font-size: 12px;
    }
    .resultLevel.available {
      border-color: rgba(98, 255, 191, 0.44);
      color: var(--text);
      background: rgba(98, 255, 191, 0.12);
    }
    .resultLevel.admin {
      border-color: rgba(255, 209, 102, 0.42);
      color: var(--settings-accent);
      background: rgba(255, 209, 102, 0.1);
    }
    .resultColumns {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 12px;
    }
    .resultSection, .groupAnalysis {
      display: grid;
      gap: 8px;
      min-width: 0;
    }
    .resultList {
      display: grid;
      gap: 8px;
    }
    .resultRow {
      display: grid;
      gap: 3px;
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 9px 10px;
      background: rgba(255, 255, 255, 0.06);
      overflow-wrap: anywhere;
    }
    .resultRow strong { color: var(--text); font-size: 13px; }
    .resultRow span { color: var(--muted); font-size: 12px; }
    .resultGroup {
      display: grid;
      gap: 6px;
      min-width: min(100%, 180px);
      flex: 1 1 180px;
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 10px;
      background: rgba(255, 255, 255, 0.06);
    }
    .resultGroup strong { color: var(--text); }
    .resultGroup span { color: var(--muted); font-size: 12px; }
    .savedDrafts {
      grid-column: 1 / -1;
      display: grid;
      gap: 6px;
      color: var(--muted);
      font-size: 12px;
      border-top: 1px solid var(--line);
      padding-top: 10px;
      max-height: 24vh;
      overflow-y: auto;
      -webkit-overflow-scrolling: touch;
    }
    .savedDrafts strong { color: var(--text); font-size: 13px; }
    .savedDrafts div { overflow-wrap: anywhere; }
    .savedDraftsSection {
      display: grid;
      gap: 5px;
      padding-bottom: 4px;
    }
    .savedDraftsSection + .savedDraftsSection {
      border-top: 1px solid var(--line);
      padding-top: 8px;
    }
    .savedDraftsHeader {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
    }
    .savedDraftsHeader strong { min-width: 0; }
    .field { display: grid; gap: 5px; }
    .field label { color: var(--muted); font-size: 12px; }
    .toggle { display: flex; align-items: center; gap: 8px; min-height: 38px; color: var(--text); }
    .filterControls { display: grid; gap: 10px; }
    .filterSearchRow { display: grid; grid-template-columns: minmax(0, 1fr) 44px auto; gap: 8px; }
    .filterSearchRow input {
      min-height: 38px;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: var(--surface-soft);
      color: var(--text);
      padding: 8px 10px;
    }
    .typeFilters { display: flex; flex-wrap: wrap; gap: 8px; }
    .typeFilter {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      min-height: 34px;
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 6px 8px;
      background: rgba(255, 255, 255, 0.06);
    }
    .filterSummary { color: var(--muted); font-size: 12px; min-height: 18px; }
    .sectionTitle { color: var(--text); font-size: 13px; font-weight: 700; }
    .layout {
      display: grid;
      gap: 12px;
      min-height: 0;
      overflow-y: visible;
      overflow-x: hidden;
      touch-action: auto;
    }
    .sessionPicker {
      display: none;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: var(--surface);
      padding: 14px;
      gap: 10px;
    }
    .sessionPicker.open { display: grid; }
    .sessionPickerHeader {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
    }
    .sessionSummary {
      margin-top: 3px;
      color: var(--muted);
      font-size: 12px;
      overflow-wrap: anywhere;
    }
    .sessionPickerBody { display: grid; gap: 10px; }
    .sessionPicker.collapsed .sessionPickerBody { display: none; }
    .sessionOptions { display: grid; gap: 8px; }
    .sessionOption {
      display: flex;
      align-items: center;
      gap: 10px;
      min-height: 44px;
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 9px 10px;
      background: rgba(255, 255, 255, 0.06);
    }
    .sessionOption input { width: 18px; height: 18px; accent-color: var(--accent); }
    .sessionActions { display: flex; justify-content: flex-end; }
    .questionStack { display: grid; gap: 12px; min-height: 0; }
    .questionMeta { color: var(--muted); font-size: 12px; margin-bottom: 6px; }
    .answerBadge {
      margin-top: 10px;
      display: inline-flex;
      max-width: 100%;
      border: 1px solid rgba(98, 255, 191, 0.42);
      border-radius: 8px;
      padding: 5px 8px;
      background: rgba(98, 255, 191, 0.1);
      color: var(--accent);
      font-size: 12px;
      overflow-wrap: anywhere;
    }
    .secondary {
      min-height: 36px;
      border: 1px solid var(--line);
      border-radius: 7px;
      background: rgba(255, 255, 255, 0.06);
      color: var(--text);
      padding: 7px 10px;
    }
    .secondary.active {
      border-color: var(--accent);
      color: var(--accent);
      box-shadow: 0 0 10px rgba(98, 255, 191, 0.18);
    }
    .card {
      border: 1px solid var(--line);
      border-radius: 8px;
      background: var(--surface);
      display: grid;
      grid-template-rows: auto auto;
      box-shadow: 7px 7px 14px var(--shadow-dark), -7px -7px 14px var(--shadow-light);
    }
    .card[data-active="true"] {
      border-color: rgba(98, 255, 191, 0.75);
      box-shadow: inset 4px 0 0 var(--accent), 7px 7px 14px var(--shadow-dark), -7px -7px 14px var(--shadow-light);
    }
    .card[data-highlight="true"] {
      border-color: rgba(255, 209, 102, 0.85);
      box-shadow: inset 4px 0 0 var(--settings-accent), 7px 7px 14px var(--shadow-dark), -7px -7px 14px var(--shadow-light);
    }
    .card.collapsed { grid-template-rows: auto; }
    .cardHead {
      padding: 16px;
      border-bottom: 1px solid var(--line);
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 10px;
      align-items: start;
    }
    .card.collapsed .cardHead { border-bottom: 0; }
    .cardHeadText { min-width: 0; }
    .cardToggle {
      min-width: 36px;
      min-height: 36px;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: rgba(255, 255, 255, 0.06);
      color: var(--text);
      padding: 0;
      font-size: 18px;
      line-height: 1;
    }
    .prompt { margin: 0; font-size: 19px; line-height: 1.28; letter-spacing: 0; }
    .cardBody { padding: 16px; display: grid; align-content: start; gap: 14px; }
    .card.collapsed .cardBody { display: none; }
    .cardActions { display: grid; grid-template-columns: minmax(96px, 3fr) minmax(0, 7fr); gap: 8px; }
    .segmented, .choices, .ratingTicks { display: grid; gap: 8px; }
    .segmented { grid-template-columns: repeat(3, minmax(0, 1fr)); }
    .choices { grid-template-columns: repeat(auto-fit, minmax(132px, 1fr)); }
    .choice, .segment {
      min-height: 42px;
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 9px 10px;
      background: rgba(255, 255, 255, 0.06);
      color: var(--text);
      text-align: center;
    }
    .choice.selected {
      background: var(--accent);
      border-color: var(--accent);
      color: var(--accent-text);
      box-shadow: 0 0 14px rgba(98, 255, 191, 0.28);
    }
    .segment.agree {
      background: rgba(76, 175, 80, 0.3);
      border-color: #4caf50;
      color: #81c784;
    }
    .segment.unsure {
      background: rgba(255, 235, 59, 0.2);
      border-color: #fdd835;
      color: #fff176;
    }
    .segment.disagree {
      background: rgba(244, 67, 54, 0.3);
      border-color: #f44336;
      color: #e57373;
    }
    .segment.selected {
      font-weight: 800;
      box-shadow: 0 0 14px rgba(255, 255, 255, 0.18);
    }
    .segment.agree.selected {
      background: #4caf50;
      border-color: #4caf50;
      color: #ffffff;
    }
    .segment.unsure.selected {
      background: #ffeb3b;
      border-color: #fdd835;
      color: #202458;
    }
    .segment.disagree.selected {
      background: #f44336;
      border-color: #f44336;
      color: #ffffff;
    }
    .ratingValue { font-size: 34px; font-weight: 700; letter-spacing: 0; color: var(--accent); }
    input[type="range"] { width: 100%; accent-color: var(--accent); }
    textarea {
      width: 100%;
      min-height: 104px;
      resize: vertical;
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 10px;
      background: rgba(255, 255, 255, 0.06);
      color: var(--text);
    }
    .commentBox {
      display: grid;
      grid-template-columns: minmax(0, 3fr) minmax(56px, 1fr);
      gap: 8px;
      align-items: stretch;
    }
    .commentActions { display: grid; align-items: stretch; }
    .micButton {
      width: 100%;
      min-width: 44px;
      min-height: 44px;
      padding: 0;
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }
    .micButton svg {
      width: 18px;
      height: 18px;
      fill: currentColor;
      display: block;
    }
    .commentActions .micButton {
      height: 100%;
      min-height: 104px;
    }
    .commentActions .micButton svg {
      width: 30px;
      height: 30px;
    }
    textarea.micFeedback,
    .filterSearchRow input.micFeedback {
      border-color: var(--accent-2);
      color: var(--muted);
    }
    .micButton[aria-pressed="true"] {
      border-color: var(--accent-2);
      color: var(--accent-2);
      box-shadow: 0 0 12px rgba(44, 195, 255, 0.24);
    }
    .locked { color: var(--muted); border: 1px dashed var(--line); border-radius: 8px; padding: 12px; background: rgba(255, 255, 255, 0.04); }
    .primary {
      min-height: 44px;
      border: 1px solid var(--accent);
      border-radius: 8px;
      background: var(--accent);
      color: var(--accent-text);
      padding: 10px;
      text-align: center;
      font-weight: 700;
    }
    .submitButton {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
    }
    .submitButton svg {
      width: 24px;
      height: 24px;
      fill: none;
      stroke: currentColor;
      stroke-width: 3;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
    .submitButton.submittedCheck {
      background: var(--ok);
      border-color: var(--ok);
      color: var(--accent-text);
    }
    .submitButton.submittedCheck:disabled {
      opacity: 1;
      cursor: default;
    }
    .primary:disabled, .secondary:disabled { opacity: 0.58; cursor: default; }
    .submitButton.submittedCheck:disabled { opacity: 1; }
    .ok { color: var(--ok); }
    .error { color: var(--danger); white-space: pre-wrap; }
    @media (max-width: 760px) {
      .settingsPanel, .groupsPanel, .filterPanel { grid-template-columns: 1fr; }
      .resultColumns { grid-template-columns: 1fr; }
      .filterSearchRow { grid-template-columns: minmax(0, 1fr) 44px auto; }
    }
  </style>
</head>
<body>
  <main class="app">
    <header>
      <div class="headerBar">
        <h1>Context Engine</h1>
        <div class="headerActions">
          <button class="iconButton resultsButton" id="showResults" type="button" aria-label="Results" aria-expanded="false" title="Results">
            <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24">
              <path d="M4 19V9"></path><path d="M10 19V5"></path><path d="M16 19v-8"></path><path d="M22 19H2"></path>
            </svg>
          </button>
          <button class="iconButton groupsButton" id="showGroups" type="button" aria-label="Groups" aria-expanded="false" title="Groups">
            <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24">
              <path d="M7.5 12a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z"></path><path d="M16.5 12a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z"></path><path d="M3 20a4.5 4.5 0 0 1 9 0"></path><path d="M12 20a4.5 4.5 0 0 1 9 0"></path>
            </svg>
          </button>
          <button class="iconButton filterButton" id="showFilter" type="button" aria-label="Filter" aria-expanded="false" title="Filter">
            <svg class="filterIcon" aria-hidden="true" focusable="false" viewBox="0 0 24 24">
              <path d="M3 5h18l-7 8v5l-4 2v-7L3 5z"></path>
            </svg>
          </button>
          <button class="iconButton settingsButton" id="showSettings" type="button" aria-label="Settings" aria-expanded="false" title="Settings">
            <svg aria-hidden="true" focusable="false" viewBox="0 0 512 512">
              <path d="M487.4 315.7l-42.6-24.6c4.3-23.2 4.3-47 0-70.2l42.6-24.6c4.9-2.8 7.1-8.6 5.5-14-11.1-35.6-30-67.8-54.7-94.6-3.8-4.1-10-5.1-14.8-2.3L380.8 110c-17.9-15.4-38.5-27.3-60.8-35.1V25.8c0-5.6-3.9-10.5-9.4-11.7-36.7-8.2-74.3-7.8-109.2 0-5.5 1.2-9.4 6.1-9.4 11.7V75c-22.2 7.9-42.8 19.8-60.8 35.1L88.7 85.5c-4.9-2.8-11-1.9-14.8 2.3-24.7 26.7-43.6 58.9-54.7 94.6-1.7 5.4.6 11.2 5.5 14L67.3 221c-4.3 23.2-4.3 47 0 70.2l-42.6 24.6c-4.9 2.8-7.1 8.6-5.5 14 11.1 35.6 30 67.8 54.7 94.6 3.8 4.1 10 5.1 14.8 2.3l42.6-24.6c17.9 15.4 38.5 27.3 60.8 35.1v49.2c0 5.6 3.9 10.5 9.4 11.7 36.7 8.2 74.3 7.8 109.2 0 5.5-1.2 9.4-6.1 9.4-11.7v-49.2c22.2-7.9 42.8-19.8 60.8-35.1l42.6 24.6c4.9 2.8 11 1.9 14.8-2.3 24.7-26.7 43.6-58.9 54.7-94.6 1.5-5.5-.7-11.3-5.6-14.1zM256 336c-44.1 0-80-35.9-80-80s35.9-80 80-80 80 35.9 80 80-35.9 80-80 80z"></path>
            </svg>
          </button>
        </div>
      </div>
      <section class="sessionPicker" id="sessionPicker" aria-label="Sessions">
        <div class="sessionPickerHeader">
          <div>
            <div class="sectionTitle">Sessions</div>
            <div class="sessionSummary" id="sessionSummary"></div>
          </div>
          <button class="secondary" id="toggleSessions" type="button">Change</button>
        </div>
        <div class="sessionPickerBody" id="sessionPickerBody">
          <div class="sessionOptions" id="sessionOptions"></div>
          <div class="sessionActions">
            <button class="primary" id="continueSessions" type="button">Continue</button>
          </div>
        </div>
      </section>
      <div class="meta" id="meta"></div>
      <div class="status" id="status">Loading...</div>
      <section class="resultsPanel" id="resultsPanel" aria-label="Results">
        <div class="resultsHeader">
          <div class="sectionTitle">Results</div>
          <button class="secondary" id="refreshResults" type="button">Refresh</button>
        </div>
        <div class="resultsSessionOptions" id="resultsSessionOptions"></div>
        <div class="resultViewLevels" id="resultViewLevels" aria-label="Results exposure levels"></div>
        <div class="filterSummary" id="resultsSummary"></div>
        <div class="resultImageActions">
          <button class="secondary" id="renderConsensusImage" type="button">Consensus image</button>
          <button class="secondary" id="renderGroupImage" type="button">Groups image</button>
        </div>
        <img class="resultImagePreview" id="resultImagePreview" alt="Rendered results preview">
        <div class="resultColumns">
          <section class="resultSection" aria-label="Most consensus questions">
            <div class="sectionTitle">Most consensus</div>
            <div class="resultList" id="consensusResults"></div>
          </section>
          <section class="resultSection" aria-label="Most divisive questions">
            <div class="sectionTitle">Most divisive</div>
            <div class="resultList" id="divisiveResults"></div>
          </section>
        </div>
        <section class="resultSection" aria-label="Groups">
          <div class="sectionTitle">Groups</div>
          <div class="resultGroups" id="resultGroups"></div>
        </section>
        <section class="groupAnalysis" id="groupAnalysis" aria-label="Group analysis"></section>
      </section>
      <section class="groupsPanel" id="groupsPanel" aria-label="Groups">
        <div class="resultsHeader">
          <div class="sectionTitle">Groups</div>
          <button class="secondary" id="refreshGroups" type="button">Refresh</button>
        </div>
        <div class="groupsSessionOptions" id="groupsSessionOptions"></div>
        <div class="filterSummary" id="groupsSummary"></div>
        <div class="groupProposals" id="groupProposals"></div>
        <div class="groupCategories" id="groupCategories"></div>
        <div class="groupActions">
          <button class="primary" id="saveGroups" type="button">Save groups</button>
        </div>
      </section>
      <section class="filterPanel" id="filterPanel" aria-label="Question filters">
        <div class="filterControls">
          <label class="toggle">
            <input id="filterUnansweredFirst" type="checkbox" checked>
            <span>Show un-answered questions first</span>
          </label>
          <div class="field">
            <label>Question type</label>
            <div class="typeFilters" id="questionTypeFilters"></div>
          </div>
          <div class="field">
            <label for="filterAiSearch">AI search</label>
            <div class="filterSearchRow">
              <input id="filterAiSearch" type="search" placeholder="Describe questions to find">
              <button class="secondary micButton" id="filterAiSearchMic" type="button" aria-label="Dictate AI search" aria-pressed="false"></button>
              <button class="secondary" id="clearAiSearch" type="button" hidden>Clear</button>
            </div>
          </div>
          <div class="filterSummary" id="filterSummary"></div>
        </div>
      </section>
      <section class="settingsPanel" id="settingsPanel" aria-label="Agent settings">
        <div class="field">
          <label for="draftStyle">Draft style</label>
          <select id="draftStyle"></select>
        </div>
        <label class="toggle">
          <input id="telegramReminders" type="checkbox">
          <span>Reminders</span>
        </label>
        <label class="toggle">
          <input id="demoDataResults" type="checkbox">
          <span>Demo data</span>
        </label>
        <button class="primary" id="saveSettings" type="button">Save</button>
        <div class="savedDrafts" id="savedDrafts"></div>
        <button class="secondary" id="clearDrafts" type="button">Clear drafts</button>
      </section>
    </header>
    <section class="layout">
      <section class="questionStack" id="questionStack" aria-label="Questions"></section>
    </section>
  </main>
  <script>
    const tg = window.Telegram && window.Telegram.WebApp ? window.Telegram.WebApp : null;
    if (tg) {
      tg.ready();
      if (typeof tg.expand === 'function') tg.expand();
    }
    function syncTelegramViewportHeight() {
      const height = tg && Number(tg.viewportStableHeight || tg.viewportHeight);
      if (Number.isFinite(height) && height > 0) {
        document.documentElement.style.setProperty('--tg-viewport-height', height + 'px');
      }
    }
    syncTelegramViewportHeight();
    if (tg && typeof tg.onEvent === 'function') tg.onEvent('viewportChanged', syncTelegramViewportHeight);
    const params = new URLSearchParams(location.search);
    const launch = params.get('launch') || params.get('tgWebAppStartParam') || (tg && tg.initDataUnsafe && tg.initDataUnsafe.start_param) || '';
    const QUESTION_RETRY_DELAY_MS = 4000;
    const SHOW_UNANSWERED_STORAGE_KEY = 'ce:telegram-mini-app:show-unanswered-first';
    const DEMO_RESULTS_STORAGE_KEY = 'ce:telegram-mini-app:demo-results';
    const readShowUnansweredFirst = () => {
      try { return window.localStorage.getItem(SHOW_UNANSWERED_STORAGE_KEY) !== 'false'; } catch { return true; }
    };
    const writeShowUnansweredFirst = (value) => {
      try { window.localStorage.setItem(SHOW_UNANSWERED_STORAGE_KEY, value ? 'true' : 'false'); } catch {}
    };
    const readDemoResults = () => {
      try { return window.localStorage.getItem(DEMO_RESULTS_STORAGE_KEY) === 'true'; } catch { return false; }
    };
    const writeDemoResults = (value) => {
      try { window.localStorage.setItem(DEMO_RESULTS_STORAGE_KEY, value ? 'true' : 'false'); } catch {}
    };
    const state = {
      data: null,
      activeKey: '',
      drafts: {},
      retryTimer: null,
      aiSearchTimer: null,
      aiSearchResultQuery: '',
      aiSearchResultScores: new Map(),
      aiSearchSource: '',
      submitting: false,
      selectedSessionSlugs: new Set(),
      savedDraftKeys: new Set(),
      submittedAnswerKeys: new Set(),
      submittedAnswersByQuestionKey: new Map(),
      showUnansweredFirst: readShowUnansweredFirst(),
      selectedQuestionTypes: new Set(),
      aiDraftQuery: '',
      aiSearchQuery: '',
      resultsData: null,
      resultsLoading: false,
      resultsSessionSlug: '',
      resultsDemoData: readDemoResults(),
      resultImageUrl: '',
      groupAnalysisById: {},
      groupsData: null,
      groupsLoading: false,
      groupsSaving: false,
      groupsSessionSlug: '',
      groupSelections: {},
      expandedQuestionKeys: new Set(),
      highlightedQuestionKey: '',
      highlightScrollDone: false,
      sessionPickerCollapsed: false,
      sessionPickerInitialized: false,
      loadedOnce: false,
    };
    const el = {
      meta: document.getElementById('meta'),
      status: document.getElementById('status'),
      sessionPicker: document.getElementById('sessionPicker'),
      sessionSummary: document.getElementById('sessionSummary'),
      toggleSessions: document.getElementById('toggleSessions'),
      sessionPickerBody: document.getElementById('sessionPickerBody'),
      sessionOptions: document.getElementById('sessionOptions'),
      continueSessions: document.getElementById('continueSessions'),
      questionStack: document.getElementById('questionStack'),
      showResults: document.getElementById('showResults'),
      resultsPanel: document.getElementById('resultsPanel'),
      refreshResults: document.getElementById('refreshResults'),
      renderConsensusImage: document.getElementById('renderConsensusImage'),
      renderGroupImage: document.getElementById('renderGroupImage'),
      resultImagePreview: document.getElementById('resultImagePreview'),
      resultsSessionOptions: document.getElementById('resultsSessionOptions'),
      resultViewLevels: document.getElementById('resultViewLevels'),
      resultsSummary: document.getElementById('resultsSummary'),
      consensusResults: document.getElementById('consensusResults'),
      divisiveResults: document.getElementById('divisiveResults'),
      resultGroups: document.getElementById('resultGroups'),
      groupAnalysis: document.getElementById('groupAnalysis'),
      showGroups: document.getElementById('showGroups'),
      groupsPanel: document.getElementById('groupsPanel'),
      refreshGroups: document.getElementById('refreshGroups'),
      groupsSessionOptions: document.getElementById('groupsSessionOptions'),
      groupsSummary: document.getElementById('groupsSummary'),
      groupProposals: document.getElementById('groupProposals'),
      groupCategories: document.getElementById('groupCategories'),
      saveGroups: document.getElementById('saveGroups'),
      showFilter: document.getElementById('showFilter'),
      filterPanel: document.getElementById('filterPanel'),
      filterUnansweredFirst: document.getElementById('filterUnansweredFirst'),
      questionTypeFilters: document.getElementById('questionTypeFilters'),
      filterAiSearch: document.getElementById('filterAiSearch'),
      filterAiSearchMic: document.getElementById('filterAiSearchMic'),
      clearAiSearch: document.getElementById('clearAiSearch'),
      filterSummary: document.getElementById('filterSummary'),
      showSettings: document.getElementById('showSettings'),
      settingsPanel: document.getElementById('settingsPanel'),
      draftStyle: document.getElementById('draftStyle'),
      telegramReminders: document.getElementById('telegramReminders'),
      demoDataResults: document.getElementById('demoDataResults'),
      saveSettings: document.getElementById('saveSettings'),
      savedDrafts: document.getElementById('savedDrafts'),
      clearDrafts: document.getElementById('clearDrafts'),
    };
    const MIC_ICON = '<svg aria-hidden="true" focusable="false" viewBox="0 0 24 24"><path d="M12 14a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v5a3 3 0 0 0 3 3z"></path><path d="M17 11a1 1 0 1 1 2 0 7 7 0 0 1-6 6.93V21a1 1 0 1 1-2 0v-3.07A7 7 0 0 1 5 11a1 1 0 1 1 2 0 5 5 0 0 0 10 0z"></path></svg>';
    const STOP_ICON = '<svg aria-hidden="true" focusable="false" viewBox="0 0 24 24"><path d="M7 7h10v10H7z"></path></svg>';
    const CHECK_ICON = '<svg aria-hidden="true" focusable="false" viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"></path></svg>';
    el.filterAiSearchMic.dataset.idleLabel = 'Dictate AI search';
    el.filterAiSearchMic.dataset.stopLabel = 'Stop recording AI search';
    el.filterAiSearchMic.innerHTML = MIC_ICON;
    const headers = ({ json = true } = {}) => {
      const out = json ? { 'content-type': 'application/json' } : {};
      if (tg && tg.initData) out['x-telegram-init-data'] = tg.initData;
      return out;
    };
    const selectedSessionQuery = () => Array.from(state.selectedSessionSlugs).filter(Boolean).join(',');
    const selectedResultsSessions = () => {
      const pickerSessions = Array.isArray(state.data?.sessionPicker?.sessions) ? state.data.sessionPicker.sessions : [];
      const selected = Array.from(state.selectedSessionSlugs).filter(Boolean);
      return selected.map((slug) => {
        const session = pickerSessions.find((item) => item.sessionSlug === slug) || {};
        return { sessionSlug: slug, sessionName: session.sessionName || slug };
      });
    };
    const resetResultsForSelection = () => {
      state.resultsData = null;
      state.resultsSessionSlug = '';
      state.groupAnalysisById = {};
      state.resultImageUrl = '';
      if (el.resultImagePreview) {
        el.resultImagePreview.removeAttribute('src');
        el.resultImagePreview.classList.remove('open');
      }
    };
    const resetGroupsForSelection = () => {
      state.groupsData = null;
      state.groupsSessionSlug = '';
      state.groupSelections = {};
    };
    const activeQuestion = () => (state.data?.questions || []).find((question) => question.questionKey === state.activeKey) || null;
    const draftFor = (question) => {
      if (!question) return {};
      state.drafts[question.questionKey] = state.drafts[question.questionKey] || {};
      return state.drafts[question.questionKey];
    };
    const answerHasContent = (answer) => {
      if (!answer || typeof answer !== 'object') return false;
      if (Array.isArray(answer.values) && answer.values.length > 0) return true;
      return ['value', 'text', 'comments'].some((key) => {
        const value = answer[key];
        return value !== undefined && value !== null && String(value).trim() !== '';
      });
    };
    const submittedAnswerFor = (question) => state.submittedAnswersByQuestionKey.get(question?.questionKey) || null;
    const answerLabelForQuestion = (question, answer = {}) => {
      if (question?.questionType === 'agree_unsure_disagree') {
        return ({ agree: 'Agree', unsure: 'Unsure', disagree: 'Disagree' })[String(answer.value || '')] || String(answer.value || '');
      }
      if (question?.questionType === 'rating') {
        return answer.value === undefined || answer.value === null ? '' : String(answer.value);
      }
      if (question?.questionType === 'multichoice') {
        return Array.isArray(answer.values) ? answer.values.join(', ') : '';
      }
      return String(answer.text || answer.value || '').trim();
    };
    const normalizeAnswerForCompare = (answer = {}) => JSON.stringify({
      value: answer.value === undefined || answer.value === null ? '' : String(answer.value).trim(),
      text: String(answer.text || '').trim(),
      comments: String(answer.comments || '').trim(),
      values: Array.isArray(answer.values) ? answer.values.map((value) => String(value).trim()).filter(Boolean).sort() : [],
    });
    const currentAnswerMatchesSubmitted = (question) => {
      const submittedAnswer = submittedAnswerFor(question);
      if (!submittedAnswer?.answer) return false;
      return normalizeAnswerForCompare(answerPayload(question)) === normalizeAnswerForCompare(submittedAnswer.answer);
    };
    const applySubmitButtonState = (button, question, { busy = false } = {}) => {
      if (!button) return;
      const submittedCurrentAnswer = !busy && currentAnswerMatchesSubmitted(question);
      button.classList.toggle('submittedCheck', submittedCurrentAnswer);
      button.disabled = busy || !question?.canAnswer || submittedCurrentAnswer;
      button.setAttribute('aria-busy', busy ? 'true' : 'false');
      if (submittedCurrentAnswer) {
        button.innerHTML = CHECK_ICON;
        button.setAttribute('aria-label', 'Submitted');
        button.title = 'Submitted';
        return;
      }
      button.textContent = busy ? 'Submitting...' : 'Submit';
      button.setAttribute('aria-label', busy ? 'Submitting answer' : 'Submit answer');
      button.title = busy ? 'Submitting answer' : 'Submit answer';
    };
    const refreshQuestionSubmitButton = (question, sourceElement) => {
      const card = sourceElement?.closest?.('.card');
      const button = card?.querySelector?.('.submitButton');
      applySubmitButtonState(button, question);
    };
    const questionAnswered = (question) => {
      if (state.submittedAnswerKeys.has(question?.questionKey)) return true;
      if (state.savedDraftKeys.has(question?.questionKey)) return true;
      return false;
    };
    const questionTypeLabel = (type) => ({
      agree_unsure_disagree: 'Agree / Unsure / Disagree',
      freeform: 'Freeform input',
      rating: 'Rating',
      multichoice: 'Multiple choice',
    })[String(type || '')] || String(type || 'Question');
    const questionTypeFilterValue = (question) => {
      const type = String(question?.questionType || '').trim();
      if (type) return type;
      if (Array.isArray(question?.options) && question.options.length) return 'multichoice';
      return 'freeform';
    };
    const questionSearchText = (question) => [
      question.prompt,
      question.title,
      question.questionType,
      question.sessionName,
      Array.isArray(question.options) ? question.options.join(' ') : '',
    ].map((value) => String(value || '').toLowerCase()).join(' ');
    const QUESTION_SEARCH_SYNONYMS = {
      food: ['pizza', 'meal', 'meals', 'restaurant', 'lunch', 'dinner', 'snack', 'drink', 'coffee'],
      foods: ['pizza', 'meal', 'meals', 'restaurant', 'lunch', 'dinner', 'snack', 'drink', 'coffee'],
      eat: ['pizza', 'meal', 'restaurant', 'lunch', 'dinner', 'snack'],
      eating: ['pizza', 'meal', 'restaurant', 'lunch', 'dinner', 'snack'],
      preference: ['prefer', 'favorite', 'favourite', 'like', 'choice', 'choose'],
      preferences: ['prefer', 'favorite', 'favourite', 'like', 'choice', 'choose'],
      pets: ['pet', 'cat', 'dog', 'animal'],
      animal: ['pet', 'pets', 'cat', 'dog'],
      animals: ['pet', 'pets', 'cat', 'dog'],
      office: ['work', 'workplace', 'company'],
      work: ['office', 'workplace', 'job'],
      risk: ['concern', 'concerns', 'danger', 'safe', 'safety', 'uncertain', 'uncertainty'],
    };
    const searchTokens = (query) => String(query || '')
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .map((token) => token.trim())
      .filter((token) => token.length > 1)
      .flatMap((token) => [
        token,
        ...(QUESTION_SEARCH_SYNONYMS[token] || []),
        ...(token.endsWith('s') && token.length > 3 ? [token.slice(0, -1)] : []),
      ])
      .filter((token, index, values) => values.indexOf(token) === index);
    const aiSearchScore = (question, query) => {
      const normalizedQuery = String(query || '').trim();
      if (
        normalizedQuery &&
        state.aiSearchResultQuery === normalizedQuery &&
        state.aiSearchResultScores instanceof Map
      ) {
        if (state.aiSearchResultScores.has(question.questionKey)) {
          return Number(state.aiSearchResultScores.get(question.questionKey) || 0);
        }
        if (state.aiSearchSource === 'ai') return 0;
      }
      const tokens = searchTokens(query);
      if (!tokens.length) return 0;
      const text = questionSearchText(question);
      let score = 0;
      tokens.forEach((token) => {
        if (text.includes(token)) score += token.length + 2;
        else if (token.length > 4 && text.includes(token.slice(0, -1))) score += 2;
      });
      return score;
    };
    const questionMatchesFilters = (question) => {
      if (state.selectedQuestionTypes.size && !state.selectedQuestionTypes.has(questionTypeFilterValue(question))) return false;
      if (state.aiSearchQuery && aiSearchScore(question, state.aiSearchQuery) <= 0) return false;
      return true;
    };
    const filteredQuestionEntries = () => (state.data?.questions || [])
      .map((question, index) => ({ question, index, score: aiSearchScore(question, state.aiSearchQuery) }))
      .filter(({ question }) => questionMatchesFilters(question));
    const orderedQuestions = () => {
      const questions = filteredQuestionEntries();
      if (state.aiSearchQuery) {
        questions.sort((left, right) => (
          right.score - left.score ||
          Number(questionAnswered(left.question)) - Number(questionAnswered(right.question)) ||
          left.index - right.index
        ));
        return questions.map((entry) => entry.question);
      }
      if (state.showUnansweredFirst) {
        questions.sort((left, right) => (
          Number(questionAnswered(left.question)) - Number(questionAnswered(right.question)) ||
          left.index - right.index
        ));
      }
      return questions.map((entry) => entry.question);
    };
    const firstPreferredQuestionKey = () => {
      const questions = orderedQuestions();
      return questions.find((question) => question.canAnswer && !questionAnswered(question))?.questionKey ||
        questions.find((question) => question.canAnswer)?.questionKey ||
        questions[0]?.questionKey ||
        '';
    };
    const activate = (question) => {
      if (question?.questionKey) state.activeKey = question.questionKey;
    };
    const expandQuestion = (question) => {
      if (question?.questionKey) state.expandedQuestionKeys.add(question.questionKey);
    };
    const toggleQuestionExpanded = (question) => {
      if (!question?.questionKey) return;
      activate(question);
      if (state.expandedQuestionKeys.has(question.questionKey)) state.expandedQuestionKeys.delete(question.questionKey);
      else state.expandedQuestionKeys.add(question.questionKey);
      renderQuestionStack();
    };
    const setStatus = (message, kind = '') => {
      el.status.className = 'status ' + kind;
      el.status.textContent = message || '';
    };
    function shouldRetryQuestions(data) {
      if (data?.sessionPicker?.required === true) return false;
      const questions = Array.isArray(data?.questions) ? data.questions : [];
      const answerableCount = questions.filter((question) => question?.canAnswer).length;
      const unavailableCount = questions.filter((question) => question?.payloadUnavailable === true).length;
      return answerableCount === 0 && (
        data?.sourceOk === false ||
        Number(data?.questionCount || 0) === 0 ||
        unavailableCount > 0
      );
    }
    function clearQuestionRetry() {
      if (state.retryTimer) window.clearTimeout(state.retryTimer);
      state.retryTimer = null;
    }
    function scheduleQuestionRetry() {
      clearQuestionRetry();
      state.retryTimer = window.setTimeout(() => {
        state.retryTimer = null;
        load({ retry: true });
      }, QUESTION_RETRY_DELAY_MS);
    }
    function setSubmitBusy(isBusy, triggerButton = null, question = activeQuestion()) {
      state.submitting = isBusy;
      [triggerButton].filter(Boolean).forEach((button) => {
        applySubmitButtonState(button, question, { busy: isBusy });
      });
      if (!isBusy) updateFooterControls();
    }
    function renderSessionPicker() {
      const picker = state.data?.sessionPicker || {};
      const open = picker.enabled === true && (picker.sessions || []).length > 0;
      el.sessionPicker.classList.toggle('open', open);
      el.sessionPicker.classList.toggle('collapsed', open && state.sessionPickerCollapsed);
      el.sessionOptions.innerHTML = '';
      if (!open) return;
      if (!state.sessionPickerInitialized) {
        state.sessionPickerCollapsed = picker.required === true ? false : picker.initiallyCollapsed === true;
        state.sessionPickerInitialized = true;
        el.sessionPicker.classList.toggle('collapsed', state.sessionPickerCollapsed);
      }
      if (picker.required === true) {
        state.sessionPickerCollapsed = false;
        el.sessionPicker.classList.remove('collapsed');
      }
      const selectedSessions = (picker.sessions || []).filter((session) => (
        state.selectedSessionSlugs.has(session.sessionSlug) || session.selected === true
      ));
      const selectedNames = selectedSessions.map((session) => session.sessionName || session.sessionSlug);
      el.sessionSummary.textContent = selectedNames.length
        ? selectedNames.slice(0, 2).join(', ') + (selectedNames.length > 2 ? ' +' + (selectedNames.length - 2) : '')
        : 'No sessions selected';
      el.toggleSessions.textContent = state.sessionPickerCollapsed ? 'Change' : 'Collapse';
      el.toggleSessions.disabled = picker.required === true && state.selectedSessionSlugs.size === 0;
      (picker.sessions || []).forEach((session) => {
        const label = document.createElement('label');
        label.className = 'sessionOption';
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.value = session.sessionSlug;
        input.checked = state.selectedSessionSlugs.has(session.sessionSlug) || session.selected === true;
        input.onchange = () => {
          if (input.checked) state.selectedSessionSlugs.add(session.sessionSlug);
          else state.selectedSessionSlugs.delete(session.sessionSlug);
          resetResultsForSelection();
          resetGroupsForSelection();
          el.continueSessions.disabled = state.selectedSessionSlugs.size === 0;
          renderSessionPicker();
          renderResults();
          renderGroups();
        };
        const name = document.createElement('span');
        name.textContent = session.sessionName || session.sessionSlug;
        label.append(input, name);
        el.sessionOptions.appendChild(label);
      });
      el.continueSessions.disabled = state.selectedSessionSlugs.size === 0;
    }
    function scrollHighlightedQuestionIntoView() {
      if (!state.highlightedQuestionKey || state.highlightScrollDone) return;
      const target = Array.from(el.questionStack.querySelectorAll('.card'))
        .find((card) => card.dataset.questionKey === state.highlightedQuestionKey);
      if (!target) return;
      state.highlightScrollDone = true;
      window.requestAnimationFrame(() => {
        target.scrollIntoView({ block: 'start', behavior: 'smooth' });
      });
    }
    function renderQuestionStack() {
      const questions = orderedQuestions();
      el.questionStack.innerHTML = '';
      if (!questions.length) {
        const empty = document.createElement('div');
        empty.className = 'locked';
        empty.textContent = 'No questions match the current filters.';
        el.questionStack.appendChild(empty);
        updateFooterControls();
        return;
      }
      questions.forEach((question) => {
        const expanded = state.expandedQuestionKeys.has(question.questionKey);
        const card = document.createElement('article');
        card.className = 'card' + (expanded ? '' : ' collapsed');
        card.dataset.active = question.questionKey === state.activeKey ? 'true' : 'false';
        card.dataset.questionKey = question.questionKey || '';
        card.dataset.expanded = expanded ? 'true' : 'false';
        card.dataset.highlight = question.questionKey && question.questionKey === state.highlightedQuestionKey ? 'true' : 'false';
        const head = document.createElement('div');
        head.className = 'cardHead';
        head.onclick = () => toggleQuestionExpanded(question);
        const headText = document.createElement('div');
        headText.className = 'cardHeadText';
        const meta = document.createElement('div');
        meta.className = 'questionMeta';
        meta.textContent = 'Question ' + question.displayIndex;
        const prompt = document.createElement('p');
        prompt.className = 'prompt';
        prompt.textContent = question.prompt || question.title || '';
        headText.append(meta, prompt);
        const submittedAnswer = submittedAnswerFor(question);
        if (submittedAnswer) {
          const badge = document.createElement('div');
          badge.className = 'answerBadge';
          badge.textContent = 'Submitted answer: ' + (submittedAnswer.answerLabel || answerLabelForQuestion(question, submittedAnswer.answer || {}) || 'Saved');
          headText.appendChild(badge);
        }
        const toggle = document.createElement('button');
        toggle.type = 'button';
        toggle.className = 'cardToggle';
        toggle.setAttribute('aria-label', expanded ? 'Collapse question' : 'Expand question');
        toggle.setAttribute('aria-expanded', expanded ? 'true' : 'false');
        toggle.textContent = expanded ? '−' : '+';
        toggle.onclick = (event) => {
          event.stopPropagation();
          toggleQuestionExpanded(question);
        };
        head.append(headText, toggle);
        const body = document.createElement('div');
        body.className = 'cardBody';
        if (expanded) renderAnswerControls(question, body);
        card.append(head, body);
        el.questionStack.appendChild(card);
      });
      updateFooterControls();
      scrollHighlightedQuestionIntoView();
    }
    function selectValue(question, value) {
      activate(question);
      const draft = draftFor(question);
      draft.value = value;
      renderQuestionStack();
    }
    function toggleChoice(question, option, single) {
      activate(question);
      const draft = draftFor(question);
      const values = Array.isArray(draft.values) ? draft.values.slice() : [];
      const next = single
        ? (values.includes(option) ? [] : [option])
        : (values.includes(option) ? values.filter((value) => value !== option) : values.concat(option));
      draft.values = next;
      renderQuestionStack();
    }
    function renderAnswerControls(question, mount) {
      if (question.locked || !question.canAnswer) {
        const locked = document.createElement('div');
        locked.className = 'locked';
        locked.textContent = question.lockMessage || (
          question.payloadUnavailable
            ? 'Question payload is not available yet. Retrying...'
            : question.encrypted
              ? 'This question is encrypted.'
              : 'This question is locked in Telegram.'
        );
        mount.appendChild(locked);
        return;
      }
      const draft = draftFor(question);
      if (question.questionType === 'agree_unsure_disagree') {
        const row = document.createElement('div');
        row.className = 'segmented';
        [['agree', 'Agree'], ['unsure', 'Unsure'], ['disagree', 'Disagree']].forEach(([value, label]) => {
          const button = document.createElement('button');
          button.type = 'button';
          button.className = 'segment ' + value + (draft.value === value ? ' selected' : '');
          button.setAttribute('aria-pressed', draft.value === value ? 'true' : 'false');
          button.textContent = label;
          button.onclick = () => selectValue(question, value);
          row.appendChild(button);
        });
        mount.appendChild(row);
      } else if (question.questionType === 'rating') {
        const label = document.createElement('div');
        label.className = 'ratingValue';
        label.textContent = draft.value ?? 5;
        const input = document.createElement('input');
        input.type = 'range';
        input.min = '0';
        input.max = '10';
        input.step = '1';
        input.value = draft.value ?? 5;
        input.oninput = () => {
          activate(question);
          draft.value = Number(input.value);
          label.textContent = input.value;
          refreshQuestionSubmitButton(question, input);
          updateFooterControls();
        };
        mount.append(label, input);
      } else if (question.questionType === 'multichoice') {
        const wrap = document.createElement('div');
        wrap.className = 'choices';
        const single = question.selectionMode === 'single';
        const values = Array.isArray(draft.values) ? draft.values : [];
        question.options.forEach((option) => {
          const button = document.createElement('button');
          button.type = 'button';
          button.className = 'choice' + (values.includes(option) ? ' selected' : '');
          button.textContent = option;
          button.onclick = () => toggleChoice(question, option, single);
          wrap.appendChild(button);
        });
        mount.appendChild(wrap);
      } else {
        const answerBox = document.createElement('div');
        answerBox.className = 'commentBox freeformAnswerBox';
        const input = document.createElement('textarea');
        input.placeholder = 'Type your response';
        input.value = draft.text || '';
        input.oninput = () => {
          if (input.dataset.micFeedbackActive === 'true') {
            input.classList.remove('micFeedback');
            delete input.dataset.micFeedbackActive;
            input.placeholder = input.dataset.originalPlaceholder || 'Type your response';
          }
          activate(question);
          draft.text = input.value;
          refreshQuestionSubmitButton(question, input);
          updateFooterControls();
        };
        const answerActions = document.createElement('div');
        answerActions.className = 'commentActions';
        const answerMic = document.createElement('button');
        answerMic.type = 'button';
        answerMic.className = 'secondary micButton';
        answerMic.innerHTML = MIC_ICON;
        answerMic.dataset.idleLabel = 'Dictate answer';
        answerMic.dataset.stopLabel = 'Stop recording answer';
        answerMic.setAttribute('aria-label', 'Dictate answer');
        answerMic.setAttribute('aria-pressed', 'false');
        answerMic.onclick = (event) => {
          event.stopPropagation();
          startAnswerDictation(question, input, answerMic);
        };
        answerActions.appendChild(answerMic);
        answerBox.append(input, answerActions);
        mount.appendChild(answerBox);
      }
      const commentBox = document.createElement('div');
      commentBox.className = 'commentBox';
      const comments = document.createElement('textarea');
      comments.placeholder = 'Additional comments';
      comments.value = draft.comments || '';
      comments.oninput = () => {
        if (comments.dataset.micFeedbackActive === 'true') {
          comments.classList.remove('micFeedback');
          delete comments.dataset.micFeedbackActive;
          comments.placeholder = comments.dataset.originalPlaceholder || 'Additional comments';
        }
        activate(question);
        draft.comments = comments.value;
        refreshQuestionSubmitButton(question, comments);
        updateFooterControls();
      };
      const commentActions = document.createElement('div');
      commentActions.className = 'commentActions';
      const mic = document.createElement('button');
      mic.type = 'button';
      mic.className = 'secondary micButton';
      mic.innerHTML = MIC_ICON;
      mic.dataset.idleLabel = 'Dictate additional comments';
      mic.dataset.stopLabel = 'Stop recording additional comments';
      mic.setAttribute('aria-label', 'Dictate additional comments');
      mic.setAttribute('aria-pressed', 'false');
      mic.onclick = (event) => {
        event.stopPropagation();
        startCommentDictation(question, comments, mic);
      };
      commentActions.appendChild(mic);
      commentBox.append(comments, commentActions);
      mount.appendChild(commentBox);
      const actions = document.createElement('div');
      actions.className = 'cardActions';
      const save = document.createElement('button');
      save.type = 'button';
      save.className = 'secondary';
      save.textContent = 'Save Draft';
      save.onclick = (event) => {
        event.stopPropagation();
        sendAnswer(false, question);
      };
      const submit = document.createElement('button');
      submit.type = 'button';
      submit.className = 'primary submitButton';
      applySubmitButtonState(submit, question);
      submit.onclick = (event) => {
        event.stopPropagation();
        if (currentAnswerMatchesSubmitted(question)) return;
        sendAnswer(true, question, submit);
      };
      actions.append(save, submit);
      mount.appendChild(actions);
    }
    let activeDictation = null;
    function setAnswerMicFeedback(question, textarea, message) {
      const draft = draftFor(question);
      if (!textarea.dataset.originalPlaceholder) {
        textarea.dataset.originalPlaceholder = textarea.placeholder || 'Type your response';
      }
      textarea.placeholder = message;
      if (!String(draft.text || textarea.value || '').trim() || textarea.dataset.micFeedbackActive === 'true') {
        textarea.dataset.micFeedbackActive = 'true';
        textarea.classList.add('micFeedback');
        textarea.value = message;
      }
    }
    function clearAnswerMicFeedback(question, textarea) {
      if (textarea.dataset.micFeedbackActive === 'true') {
        textarea.value = draftFor(question).text || '';
      }
      textarea.classList.remove('micFeedback');
      delete textarea.dataset.micFeedbackActive;
      textarea.placeholder = textarea.dataset.originalPlaceholder || 'Type your response';
    }
    function appendAnswerTranscript(question, textarea, transcript) {
      const text = String(transcript || '').trim();
      if (!text) return;
      const draft = draftFor(question);
      const base = textarea.dataset.micFeedbackActive === 'true' ? (draft.text || '') : textarea.value;
      clearAnswerMicFeedback(question, textarea);
      const prefix = base && !base.endsWith(' ') ? ' ' : '';
      textarea.value = base + prefix + text;
      draft.text = textarea.value;
      activate(question);
      refreshQuestionSubmitButton(question, textarea);
      updateFooterControls();
    }
    function showAnswerMicError(question, textarea, error) {
      const message = 'Could not transcribe: ' + String(error || 'transcription_failed');
      setAnswerMicFeedback(question, textarea, message);
    }
    function setCommentMicFeedback(question, textarea, message) {
      const draft = draftFor(question);
      if (!textarea.dataset.originalPlaceholder) {
        textarea.dataset.originalPlaceholder = textarea.placeholder || 'Additional comments';
      }
      textarea.placeholder = message;
      if (!String(draft.comments || textarea.value || '').trim() || textarea.dataset.micFeedbackActive === 'true') {
        textarea.dataset.micFeedbackActive = 'true';
        textarea.classList.add('micFeedback');
        textarea.value = message;
      }
    }
    function clearCommentMicFeedback(question, textarea) {
      if (textarea.dataset.micFeedbackActive === 'true') {
        textarea.value = draftFor(question).comments || '';
      }
      textarea.classList.remove('micFeedback');
      delete textarea.dataset.micFeedbackActive;
      textarea.placeholder = textarea.dataset.originalPlaceholder || 'Additional comments';
    }
    function appendCommentTranscript(question, textarea, transcript) {
      const text = String(transcript || '').trim();
      if (!text) return;
      const draft = draftFor(question);
      const base = textarea.dataset.micFeedbackActive === 'true' ? (draft.comments || '') : textarea.value;
      clearCommentMicFeedback(question, textarea);
      const prefix = base && !base.endsWith(' ') ? ' ' : '';
      textarea.value = base + prefix + text;
      draft.comments = textarea.value;
      activate(question);
      refreshQuestionSubmitButton(question, textarea);
      updateFooterControls();
    }
    function showCommentMicError(question, textarea, error) {
      const message = 'Could not transcribe: ' + String(error || 'transcription_failed');
      setCommentMicFeedback(question, textarea, message);
    }
    function setMicIcon(button, recording = false) {
      if (!button) return;
      button.innerHTML = recording ? STOP_ICON : MIC_ICON;
      button.setAttribute('aria-label', recording
        ? (button.dataset.stopLabel || 'Stop recording')
        : (button.dataset.idleLabel || 'Dictate'));
    }
    function resetMicButton(button) {
      if (!button) return;
      button.disabled = false;
      setMicIcon(button, false);
      button.setAttribute('aria-pressed', 'false');
    }
    function supportedAudioMimeType() {
      const recorder = window.MediaRecorder;
      if (!recorder || typeof recorder.isTypeSupported !== 'function') return '';
      return [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/ogg;codecs=opus',
        'audio/mp4',
      ].find((type) => recorder.isTypeSupported(type)) || '';
    }
    function selectedTranscribeSessionSlug() {
      return Array.from(state.selectedSessionSlugs).find(Boolean) ||
        (Array.isArray(state.data?.selectedSessionSlugs) ? state.data.selectedSessionSlugs.find(Boolean) : '') ||
        state.data?.session?.sessionSlug ||
        '';
    }
    async function transcribeAudio({ questionKey = '', sessionSlug = '', blob } = {}) {
      const form = new FormData();
      form.append('launch', launch);
      if (questionKey) form.append('questionKey', questionKey);
      if (sessionSlug) form.append('sessionSlug', sessionSlug);
      form.append('audio', blob, blob.type && blob.type.includes('ogg') ? 'comment.ogg' : 'comment.webm');
      const response = await fetch('/telegram/mini-app/api/transcribe', {
        method: 'POST',
        headers: headers({ json: false }),
        body: form,
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || !body.ok) {
        throw new Error(body.error || 'transcription_failed');
      }
      if (!String(body.text || '').trim()) {
        throw new Error('empty_transcript');
      }
      return String(body.text || '').trim();
    }
    async function transcribeCommentAudio(question, textarea, blob) {
      const text = await transcribeAudio({
        questionKey: question.questionKey,
        sessionSlug: question.sessionSlug || selectedTranscribeSessionSlug(),
        blob,
      });
      appendCommentTranscript(question, textarea, text);
    }
    async function transcribeAnswerAudio(question, textarea, blob) {
      const text = await transcribeAudio({
        questionKey: question.questionKey,
        sessionSlug: question.sessionSlug || selectedTranscribeSessionSlug(),
        blob,
      });
      appendAnswerTranscript(question, textarea, text);
    }
    function setSearchMicFeedback(message) {
      if (!el.filterAiSearch.dataset.originalPlaceholder) {
        el.filterAiSearch.dataset.originalPlaceholder = el.filterAiSearch.placeholder || 'Describe questions to find';
      }
      el.filterAiSearch.placeholder = message;
      if (!String(state.aiDraftQuery || el.filterAiSearch.value || '').trim() || el.filterAiSearch.dataset.micFeedbackActive === 'true') {
        el.filterAiSearch.dataset.micFeedbackActive = 'true';
        el.filterAiSearch.classList.add('micFeedback');
        el.filterAiSearch.value = message;
        state.aiDraftQuery = message;
      }
    }
    function clearSearchMicFeedback() {
      if (el.filterAiSearch.dataset.micFeedbackActive === 'true') {
        el.filterAiSearch.value = '';
        state.aiDraftQuery = '';
      }
      el.filterAiSearch.classList.remove('micFeedback');
      delete el.filterAiSearch.dataset.micFeedbackActive;
      el.filterAiSearch.placeholder = el.filterAiSearch.dataset.originalPlaceholder || 'Describe questions to find';
    }
    function applySearchTranscript(transcript) {
      const text = String(transcript || '').trim();
      if (!text) return;
      clearSearchMicFeedback();
      el.filterAiSearch.value = text;
      state.aiDraftQuery = text;
      state.aiSearchQuery = text;
      scheduleAiSearch(0);
      render();
    }
    function showSearchMicError(error) {
      setSearchMicFeedback('Could not transcribe: ' + String(error || 'transcription_failed'));
    }
    async function transcribeSearchAudio(blob) {
      const text = await transcribeAudio({
        sessionSlug: selectedTranscribeSessionSlug(),
        blob,
      });
      applySearchTranscript(text);
    }
    function compactSearchQuestions() {
      return (state.data?.questions || []).map((question) => ({
        questionKey: question.questionKey,
        prompt: question.prompt,
        title: question.title,
        questionType: question.questionType,
        sessionName: question.sessionName,
        options: question.options || [],
      }));
    }
    function clearAiSearchResults() {
      if (state.aiSearchTimer) window.clearTimeout(state.aiSearchTimer);
      state.aiSearchTimer = null;
      state.aiSearchResultQuery = '';
      state.aiSearchResultScores = new Map();
      state.aiSearchSource = '';
    }
    function applyAiSearchResults(query, body) {
      if (String(state.aiSearchQuery || '').trim() !== query) return;
      const scores = new Map();
      (Array.isArray(body?.results) ? body.results : []).forEach((result) => {
        if (result?.key) scores.set(result.key, Number(result.score || 1));
      });
      state.aiSearchResultQuery = query;
      state.aiSearchResultScores = scores;
      state.aiSearchSource = body?.source || 'local';
      render();
    }
    async function runAiSearch(query) {
      if (!query) return;
      let response;
      let body;
      try {
        response = await fetch('/telegram/mini-app/api/search', {
          method: 'POST',
          headers: headers(),
          body: JSON.stringify({
            launch,
            sessionSlug: selectedTranscribeSessionSlug(),
            query,
            questions: compactSearchQuestions(),
          }),
        });
        body = await response.json().catch(() => ({}));
      } catch {
        if (String(state.aiSearchQuery || '').trim() === query) {
          state.aiSearchSource = 'local';
          render();
        }
        return;
      }
      if (!response.ok || !body.ok) {
        if (String(state.aiSearchQuery || '').trim() === query) {
          state.aiSearchSource = 'local';
          render();
        }
        return;
      }
      applyAiSearchResults(query, body);
    }
    function scheduleAiSearch(delay = 260) {
      if (state.aiSearchTimer) window.clearTimeout(state.aiSearchTimer);
      state.aiSearchTimer = null;
      const query = String(state.aiSearchQuery || '').trim();
      if (!query) {
        clearAiSearchResults();
        return;
      }
      state.aiSearchSource = 'loading';
      state.aiSearchTimer = window.setTimeout(() => {
        state.aiSearchTimer = null;
        runAiSearch(query);
      }, delay);
    }
    function startSpeechRecognitionFallback(question, textarea, button) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRecognition) {
        showCommentMicError(question, textarea, 'Microphone dictation is not available in this Telegram webview.');
        return false;
      }
      const recognition = new SpeechRecognition();
      recognition.lang = 'en-US';
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;
      button.disabled = true;
      setMicIcon(button, true);
      button.setAttribute('aria-pressed', 'true');
      setCommentMicFeedback(question, textarea, 'Listening...');
      recognition.onresult = (event) => {
        const transcript = Array.from(event.results || [])
          .map((result) => result?.[0]?.transcript || '')
          .join(' ')
          .trim();
        appendCommentTranscript(question, textarea, transcript);
      };
      recognition.onerror = () => {
        showCommentMicError(question, textarea, 'Could not capture microphone input.');
      };
      recognition.onend = () => resetMicButton(button);
      try {
        recognition.start();
        return true;
      } catch {
        resetMicButton(button);
        return false;
      }
    }
    function startAnswerSpeechRecognitionFallback(question, textarea, button) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRecognition) {
        showAnswerMicError(question, textarea, 'Microphone dictation is not available in this Telegram webview.');
        return false;
      }
      const recognition = new SpeechRecognition();
      recognition.lang = 'en-US';
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;
      button.disabled = true;
      setMicIcon(button, true);
      button.setAttribute('aria-pressed', 'true');
      setAnswerMicFeedback(question, textarea, 'Listening...');
      recognition.onresult = (event) => {
        const transcript = Array.from(event.results || [])
          .map((result) => result?.[0]?.transcript || '')
          .join(' ')
          .trim();
        appendAnswerTranscript(question, textarea, transcript);
      };
      recognition.onerror = () => {
        showAnswerMicError(question, textarea, 'Could not capture microphone input.');
      };
      recognition.onend = () => resetMicButton(button);
      try {
        recognition.start();
        return true;
      } catch {
        resetMicButton(button);
        return false;
      }
    }
    async function startAnswerDictation(question, textarea, button) {
      if (activeDictation) {
        const current = activeDictation;
        activeDictation = null;
        current.recorder?.state === 'recording' && current.recorder.stop();
        resetMicButton(current.button);
        if (typeof current.setTranscribing === 'function') current.setTranscribing();
        else setAnswerMicFeedback(current.question || question, current.textarea || textarea, 'Transcribing microphone audio...');
        return;
      }
      if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
        startAnswerSpeechRecognitionFallback(question, textarea, button);
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const chunks = [];
        const mimeType = supportedAudioMimeType();
        const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
        activeDictation = {
          recorder,
          stream,
          button,
          question,
          textarea,
          questionKey: question.questionKey,
          setTranscribing: () => setAnswerMicFeedback(question, textarea, 'Transcribing microphone audio...'),
        };
        recorder.ondataavailable = (event) => {
          if (event.data && event.data.size > 0) chunks.push(event.data);
        };
        recorder.onerror = () => {
          showAnswerMicError(question, textarea, 'Could not capture microphone input.');
          stream.getTracks().forEach((track) => track.stop());
          activeDictation = null;
          resetMicButton(button);
        };
        recorder.onstop = async () => {
          activeDictation = null;
          stream.getTracks().forEach((track) => track.stop());
          const blob = new Blob(chunks, { type: recorder.mimeType || mimeType || 'audio/webm' });
          resetMicButton(button);
          if (!blob.size) {
            showAnswerMicError(question, textarea, 'No microphone audio captured.');
            return;
          }
          try {
            setAnswerMicFeedback(question, textarea, 'Transcribing microphone audio...');
            await transcribeAnswerAudio(question, textarea, blob);
          } catch (error) {
            showAnswerMicError(question, textarea, error.message || error);
          }
        };
        button.disabled = false;
        setMicIcon(button, true);
        button.setAttribute('aria-pressed', 'true');
        recorder.start();
        setAnswerMicFeedback(question, textarea, 'Recording answer. Tap stop when finished.');
      } catch (error) {
        resetMicButton(button);
        showAnswerMicError(question, textarea, error.message || error);
      }
    }
    async function startCommentDictation(question, textarea, button) {
      if (activeDictation) {
        const current = activeDictation;
        activeDictation = null;
        current.recorder?.state === 'recording' && current.recorder.stop();
        resetMicButton(current.button);
        if (typeof current.setTranscribing === 'function') current.setTranscribing();
        else setCommentMicFeedback(current.question || question, current.textarea || textarea, 'Transcribing microphone audio...');
        return;
      }
      if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
        startSpeechRecognitionFallback(question, textarea, button);
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const chunks = [];
        const mimeType = supportedAudioMimeType();
        const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
        activeDictation = {
          recorder,
          stream,
          button,
          question,
          textarea,
          questionKey: question.questionKey,
          setTranscribing: () => setCommentMicFeedback(question, textarea, 'Transcribing microphone audio...'),
        };
        recorder.ondataavailable = (event) => {
          if (event.data && event.data.size > 0) chunks.push(event.data);
        };
        recorder.onerror = () => {
          showCommentMicError(question, textarea, 'Could not capture microphone input.');
          stream.getTracks().forEach((track) => track.stop());
          activeDictation = null;
          resetMicButton(button);
        };
        recorder.onstop = async () => {
          activeDictation = null;
          stream.getTracks().forEach((track) => track.stop());
          const blob = new Blob(chunks, { type: recorder.mimeType || mimeType || 'audio/webm' });
          resetMicButton(button);
          if (!blob.size) {
            showCommentMicError(question, textarea, 'No microphone audio captured.');
            return;
          }
          try {
            setCommentMicFeedback(question, textarea, 'Transcribing microphone audio...');
            await transcribeCommentAudio(question, textarea, blob);
          } catch (error) {
            showCommentMicError(question, textarea, error.message || error);
          }
        };
        button.disabled = false;
        setMicIcon(button, true);
        button.setAttribute('aria-pressed', 'true');
        recorder.start();
        setCommentMicFeedback(question, textarea, 'Recording comment. Tap stop when finished.');
      } catch (error) {
        resetMicButton(button);
        showCommentMicError(question, textarea, error.message || error);
      }
    }
    function startSearchSpeechRecognitionFallback(button) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRecognition) {
        showSearchMicError('Microphone dictation is not available in this Telegram webview.');
        return false;
      }
      const recognition = new SpeechRecognition();
      recognition.lang = 'en-US';
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;
      button.disabled = true;
      setMicIcon(button, true);
      button.setAttribute('aria-pressed', 'true');
      setSearchMicFeedback('Listening...');
      recognition.onresult = (event) => {
        const transcript = Array.from(event.results || [])
          .map((result) => result?.[0]?.transcript || '')
          .join(' ')
          .trim();
        applySearchTranscript(transcript);
      };
      recognition.onerror = () => {
        showSearchMicError('Could not capture microphone input.');
      };
      recognition.onend = () => resetMicButton(button);
      try {
        recognition.start();
        return true;
      } catch {
        resetMicButton(button);
        return false;
      }
    }
    async function startSearchDictation(button) {
      if (activeDictation) {
        const current = activeDictation;
        activeDictation = null;
        current.recorder?.state === 'recording' && current.recorder.stop();
        resetMicButton(current.button);
        if (typeof current.setTranscribing === 'function') current.setTranscribing();
        return;
      }
      if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
        startSearchSpeechRecognitionFallback(button);
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const chunks = [];
        const mimeType = supportedAudioMimeType();
        const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
        activeDictation = {
          recorder,
          stream,
          button,
          setTranscribing: () => setSearchMicFeedback('Transcribing search audio...'),
        };
        recorder.ondataavailable = (event) => {
          if (event.data && event.data.size > 0) chunks.push(event.data);
        };
        recorder.onerror = () => {
          showSearchMicError('Could not capture microphone input.');
          stream.getTracks().forEach((track) => track.stop());
          activeDictation = null;
          resetMicButton(button);
        };
        recorder.onstop = async () => {
          activeDictation = null;
          stream.getTracks().forEach((track) => track.stop());
          const blob = new Blob(chunks, { type: recorder.mimeType || mimeType || 'audio/webm' });
          resetMicButton(button);
          if (!blob.size) {
            showSearchMicError('No microphone audio captured.');
            return;
          }
          try {
            setSearchMicFeedback('Transcribing search audio...');
            await transcribeSearchAudio(blob);
          } catch (error) {
            showSearchMicError(error.message || error);
          }
        };
        button.disabled = false;
        setMicIcon(button, true);
        button.setAttribute('aria-pressed', 'true');
        recorder.start();
        setSearchMicFeedback('Recording search. Tap stop when finished.');
      } catch (error) {
        resetMicButton(button);
        showSearchMicError(error.message || error);
      }
    }
    function updateFooterControls() {
      return null;
    }
    function questionCountText(data) {
      if (data?.sessionPicker?.required === true) return 'Select sessions';
      const loaded = Number(data?.questionCount || 0);
      const available = Number(data?.availableQuestionCount ?? loaded);
      return available + ' questions';
    }
    function render() {
      const data = state.data;
      el.meta.textContent = data ? questionCountText(data) : '';
      renderSessionPicker();
      renderResults();
      renderGroups();
      renderFilters();
      renderAgentSettings();
      renderQuestionStack();
    }
    function appendEmptyResult(mount, message) {
      const empty = document.createElement('div');
      empty.className = 'resultRow';
      const text = document.createElement('span');
      text.textContent = message;
      empty.appendChild(text);
      mount.appendChild(empty);
    }
    function renderResultRows(mount, rows, emptyText, scoreKind) {
      mount.innerHTML = '';
      if (!rows.length) {
        appendEmptyResult(mount, emptyText);
        return;
      }
      rows.forEach((row, index) => {
        const item = document.createElement('div');
        item.className = 'resultRow';
        const prompt = document.createElement('strong');
        prompt.textContent = (index + 1) + '. ' + (row.prompt || 'Untitled question');
        const counts = document.createElement('span');
        counts.textContent = row.countsText || 'No counts yet';
        const score = document.createElement('span');
        score.textContent = scoreKind === 'consensus'
          ? 'Consensus ' + row.consensusPercent + '% | responses ' + row.total
          : 'Difference ' + row.differencePercent + '% | responses ' + row.total;
        item.append(prompt, counts, score);
        mount.appendChild(item);
      });
    }
    function renderResultViewLevels() {
      el.resultViewLevels.innerHTML = '';
      const levels = Array.isArray(state.resultsData?.viewLevels)
        ? state.resultsData.viewLevels
        : [];
      if (!levels.length) return;
      levels.forEach((level) => {
        const chip = document.createElement('span');
        chip.className = 'resultLevel ' + (level.enabled ? 'available' : 'admin');
        chip.textContent = level.level + '. ' + level.label + (level.enabled ? '' : ' - admin');
        chip.title = level.description || '';
        el.resultViewLevels.appendChild(chip);
      });
    }
    function renderResultGroups(groups) {
      el.resultGroups.innerHTML = '';
      el.groupAnalysis.innerHTML = '';
      if (state.resultsData?.groupView?.enabled === false) {
        appendEmptyResult(el.resultGroups, 'Anonymized group view is level 4 and needs admin enablement.');
        return;
      }
      if (!groups.length) {
        appendEmptyResult(el.resultGroups, 'Not enough participant response data for groups yet.');
        return;
      }
      groups.forEach((group) => {
        const item = document.createElement('div');
        item.className = 'resultGroup';
        const title = document.createElement('strong');
        title.textContent = group.label + ' (' + group.size + ')';
        const theme = document.createElement('span');
        theme.textContent = group.theme || 'Distinct answer pattern';
        const aliases = document.createElement('span');
        aliases.textContent = group.aliases?.length ? group.aliases.join(', ') : 'Participants hidden';
        const analyze = document.createElement('button');
        analyze.type = 'button';
        analyze.className = 'secondary';
        const analysisState = state.groupAnalysisById[group.groupId] || {};
        analyze.textContent = analysisState.loading ? 'Analyzing...' : 'Analyze with AI';
        analyze.disabled = analysisState.loading === true;
        analyze.onclick = () => analyzeResultGroup(group.groupId);
        item.append(title, theme, aliases, analyze);
        el.resultGroups.appendChild(item);
        if (analysisState.analysis || analysisState.error) {
          const detail = document.createElement('div');
          detail.className = 'resultRow';
          const heading = document.createElement('strong');
          heading.textContent = analysisState.analysis?.name || group.label;
          const short = document.createElement('span');
          short.textContent = analysisState.error || analysisState.analysis?.short || '';
          const long = document.createElement('span');
          long.textContent = analysisState.analysis?.long || '';
          detail.append(heading, short, long);
          el.groupAnalysis.appendChild(detail);
        }
      });
    }
    function renderResults() {
      const sessions = selectedResultsSessions();
      if (!state.resultsSessionSlug || !sessions.some((session) => session.sessionSlug === state.resultsSessionSlug)) {
        state.resultsSessionSlug = sessions[0]?.sessionSlug || state.data?.session?.sessionSlug || '';
      }
      el.resultsSessionOptions.innerHTML = '';
      sessions.forEach((session) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'secondary' + (session.sessionSlug === state.resultsSessionSlug ? ' active' : '');
        button.textContent = session.sessionName || session.sessionSlug;
        button.onclick = () => {
          state.resultsSessionSlug = session.sessionSlug;
          state.resultsData = null;
          state.groupAnalysisById = {};
          state.resultImageUrl = '';
          loadResults({ force: true });
        };
        el.resultsSessionOptions.appendChild(button);
      });
      el.refreshResults.disabled = state.resultsLoading || !state.resultsSessionSlug;
      if (state.resultsLoading) {
        el.resultsSummary.textContent = 'Loading results...';
      } else if (!state.resultsSessionSlug) {
        el.resultsSummary.textContent = 'Select a session to view results.';
      } else if (state.resultsData?.ok === false) {
        el.resultsSummary.textContent = 'Could not load results: ' + (state.resultsData.error || 'results_unavailable');
      } else if (state.resultsData) {
        el.resultsSummary.textContent = state.resultsData.sessionName + ' | ' +
          state.resultsData.responseCount + ' responses | ' +
          state.resultsData.participantCount + ' participants | ' +
          state.resultsData.binaryQuestionCount + ' binary questions';
      } else {
        el.resultsSummary.textContent = 'Open or refresh results for the selected session.';
      }
      const consensusRows = state.resultsData?.questions?.consensus || [];
      const divisiveRows = state.resultsData?.questions?.divisive || [];
      el.renderConsensusImage.disabled = !state.resultsSessionSlug;
      el.renderGroupImage.disabled = !state.resultsSessionSlug || (state.resultsData?.groupView?.enabled === false && !state.resultsDemoData);
      if (state.resultImageUrl) {
        el.resultImagePreview.src = state.resultImageUrl;
        el.resultImagePreview.classList.add('open');
      } else {
        el.resultImagePreview.removeAttribute('src');
        el.resultImagePreview.classList.remove('open');
      }
      renderResultViewLevels();
      renderResultRows(el.consensusResults, consensusRows, 'No binary question responses yet.', 'consensus');
      renderResultRows(el.divisiveResults, divisiveRows, 'No divisive binary question responses yet.', 'divisive');
      renderResultGroups(state.resultsData?.groups || []);
    }
    function renderGroups() {
      const sessions = selectedResultsSessions();
      if (!state.groupsSessionSlug || !sessions.some((session) => session.sessionSlug === state.groupsSessionSlug)) {
        state.groupsSessionSlug = sessions[0]?.sessionSlug || state.data?.session?.sessionSlug || '';
      }
      el.groupsSessionOptions.innerHTML = '';
      sessions.forEach((session) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'secondary' + (session.sessionSlug === state.groupsSessionSlug ? ' active' : '');
        button.textContent = session.sessionName || session.sessionSlug;
        button.onclick = () => {
          state.groupsSessionSlug = session.sessionSlug;
          state.groupsData = null;
          state.groupSelections = {};
          loadGroups({ force: true });
        };
        el.groupsSessionOptions.appendChild(button);
      });
      const groups = state.groupsData?.groups || state.data?.groups || null;
      const categories = Array.isArray(groups?.categories) ? groups.categories : [];
      const selections = Object.keys(state.groupSelections || {}).length
        ? state.groupSelections
        : (groups?.selections || {});
      el.refreshGroups.disabled = state.groupsLoading || !state.groupsSessionSlug;
      el.saveGroups.disabled = state.groupsSaving || state.groupsLoading || !state.groupsSessionSlug || !categories.length;
      if (state.groupsLoading) {
        el.groupsSummary.textContent = 'Loading groups...';
      } else if (!state.groupsSessionSlug) {
        el.groupsSummary.textContent = 'Select a session to manage groups.';
      } else if (state.groupsData?.ok === false) {
        el.groupsSummary.textContent = 'Could not load groups: ' + (state.groupsData.error || 'groups_unavailable');
      } else {
        const joined = Object.values(selections).reduce((sum, values) => sum + (Array.isArray(values) ? values.length : 0), 0);
        el.groupsSummary.textContent = categories.length
          ? categories.length + ' categories | ' + joined + ' selected'
          : 'No groups are configured for this session.';
      }
      el.groupProposals.innerHTML = '';
      const proposals = Array.isArray(groups?.proposals) ? groups.proposals : [];
      proposals.forEach((proposal) => {
        const item = document.createElement('div');
        item.className = 'groupProposal';
        item.textContent = proposal.message || 'An agent suggested a group choice for your review.';
        el.groupProposals.appendChild(item);
      });
      el.groupCategories.innerHTML = '';
      categories.forEach((category) => {
        const section = document.createElement('section');
        section.className = 'groupCategory';
        const header = document.createElement('div');
        header.className = 'groupCategoryHeader';
        const title = document.createElement('strong');
        title.textContent = category.label;
        const description = document.createElement('span');
        description.textContent = category.description || (category.selectionMode === 'multi' ? 'Choose any that apply.' : 'Choose one.');
        header.append(title, description);
        const options = document.createElement('div');
        options.className = 'groupOptions';
        const selected = new Set(Array.isArray(selections[category.categoryId]) ? selections[category.categoryId] : []);
        (category.options || []).forEach((option) => {
          const label = document.createElement('label');
          label.className = 'groupOption';
          const input = document.createElement('input');
          input.type = category.selectionMode === 'multi' ? 'checkbox' : 'radio';
          input.name = 'group-' + category.categoryId;
          input.value = option.optionId;
          input.checked = selected.has(option.optionId);
          input.onchange = () => {
            const next = new Set(Array.isArray(state.groupSelections[category.categoryId])
              ? state.groupSelections[category.categoryId]
              : Array.from(selected));
            if (category.selectionMode === 'single') {
              state.groupSelections[category.categoryId] = input.checked ? [option.optionId] : [];
            } else {
              if (input.checked) next.add(option.optionId);
              else next.delete(option.optionId);
              state.groupSelections[category.categoryId] = Array.from(next);
            }
            renderGroups();
          };
          const text = document.createElement('span');
          text.textContent = option.label;
          label.append(input, text);
          options.appendChild(label);
        });
        section.append(header, options);
        el.groupCategories.appendChild(section);
      });
    }
    function renderFilters() {
      el.filterUnansweredFirst.checked = state.showUnansweredFirst;
      el.filterAiSearch.value = state.aiDraftQuery;
      el.clearAiSearch.hidden = !String(state.aiDraftQuery || state.aiSearchQuery || '').trim();
      const questions = Array.isArray(state.data?.questions) ? state.data.questions : [];
      const typeEntries = [...new Set(questions.map(questionTypeFilterValue).filter(Boolean))]
        .sort((left, right) => questionTypeLabel(left).localeCompare(questionTypeLabel(right)));
      el.questionTypeFilters.innerHTML = '';
      if (!typeEntries.length) {
        const empty = document.createElement('span');
        empty.className = 'filterSummary';
        empty.textContent = 'No question types loaded.';
        el.questionTypeFilters.appendChild(empty);
      } else {
        typeEntries.forEach((type) => {
          const label = document.createElement('label');
          label.className = 'typeFilter';
          const input = document.createElement('input');
          input.type = 'checkbox';
          input.value = type;
          input.checked = state.selectedQuestionTypes.has(type);
          input.onchange = () => {
            if (input.checked) state.selectedQuestionTypes.add(type);
            else state.selectedQuestionTypes.delete(type);
            render();
          };
          const text = document.createElement('span');
          text.textContent = questionTypeLabel(type);
          label.append(input, text);
          el.questionTypeFilters.appendChild(label);
        });
      }
      const total = questions.length;
      const shown = filteredQuestionEntries().length;
      const active = [];
      if (state.selectedQuestionTypes.size) active.push(Array.from(state.selectedQuestionTypes).map(questionTypeLabel).join(', '));
      if (state.aiSearchQuery) active.push('AI "' + state.aiSearchQuery + '"' + (state.aiSearchSource ? ' via ' + state.aiSearchSource : ''));
      el.filterSummary.textContent = active.length
        ? shown + ' of ' + total + ' questions match: ' + active.join(' | ')
        : total + ' questions loaded.';
    }
    function renderAgentSettings() {
      const settings = state.data?.agent?.settings || {};
      const values = settings.values || {};
      const draftField = (settings.editableFields || []).find((field) => field.field === 'draftStyle') || {};
      const options = Array.isArray(draftField.options) && draftField.options.length
        ? draftField.options
        : ['concise', 'balanced', 'detailed'];
      el.draftStyle.innerHTML = '';
      options.forEach((option) => {
        const opt = document.createElement('option');
        opt.value = option;
        opt.textContent = option;
        if ((values.draftStyle || 'balanced') === option) opt.selected = true;
        el.draftStyle.appendChild(opt);
      });
      el.telegramReminders.checked = values.telegramReminders === true;
      el.demoDataResults.checked = state.resultsDemoData === true;
      const submittedAnswers = Array.isArray(state.data?.submittedAnswers) ? state.data.submittedAnswers : [];
      const savedDrafts = Array.isArray(state.data?.savedDrafts) ? state.data.savedDrafts : [];
      el.savedDrafts.innerHTML = '';
      const appendResponseSection = (titleText, rows, emptyText) => {
        const section = document.createElement('div');
        section.className = 'savedDraftsSection';
        const header = document.createElement('div');
        header.className = 'savedDraftsHeader';
        const title = document.createElement('strong');
        title.textContent = titleText;
        header.appendChild(title);
        section.appendChild(header);
        if (!rows.length) {
          const empty = document.createElement('div');
          empty.textContent = emptyText;
          section.appendChild(empty);
        } else {
          rows.forEach((answer) => {
            const row = document.createElement('div');
            row.textContent = 'Q' + answer.displayIndex + ': ' + answer.answerLabel;
            section.appendChild(row);
          });
        }
        el.savedDrafts.appendChild(section);
      };
      appendResponseSection('Submitted responses', submittedAnswers, 'No submitted responses yet.');
      appendResponseSection('Saved draft responses', savedDrafts, 'No saved drafts yet.');
      el.clearDrafts.disabled = savedDrafts.length === 0;
    }
    function answerPayload(question) {
      const draft = draftFor(question);
      if (question.questionType === 'multichoice') return { values: draft.values || [], comments: draft.comments || '' };
      if (question.questionType === 'freeform') return { text: draft.text || '', comments: draft.comments || '' };
      return { value: draft.value, comments: draft.comments || '' };
    }
    async function sendAnswer(submit, question = activeQuestion(), triggerButton = null) {
      if (!question) return;
      activate(question);
      updateFooterControls();
      if (submit) {
        setStatus('');
        setSubmitBusy(true, triggerButton, question);
      } else {
        setStatus('Saving draft...');
      }
      const payload = answerPayload(question);
      let response;
      let body;
      try {
        response = await fetch('/telegram/mini-app/api/draft', {
          method: 'POST',
          headers: headers(),
          body: JSON.stringify({
            launch,
            questionKey: question.questionKey,
            answer: payload,
            submit,
          }),
        });
        body = await response.json().catch(() => ({}));
      } catch (error) {
        if (submit) setSubmitBusy(false, triggerButton, question);
        setStatus('Could not save answer.', 'error');
        return;
      }
      if (submit) setSubmitBusy(false, triggerButton, question);
      if (!response.ok || !body.ok) {
        setStatus(body.message || body.error || 'Could not save answer.', 'error');
        return;
      }
      if (['submit_request_created', 'direct_submitted'].includes(body.status)) {
        setStatus('Submitted.', 'ok');
        state.submittedAnswerKeys.add(question.questionKey);
        state.savedDraftKeys.delete(question.questionKey);
        const submittedAnswer = {
          questionKey: question.questionKey,
          displayIndex: question.displayIndex,
          sessionSlug: question.sessionSlug,
          prompt: question.prompt || question.title || '',
          answerLabel: answerLabelForQuestion(question, payload),
          answer: { ...payload },
        };
        state.submittedAnswersByQuestionKey.set(question.questionKey, submittedAnswer);
        if (state.data) {
          const answers = Array.isArray(state.data.submittedAnswers) ? state.data.submittedAnswers : [];
          state.data.submittedAnswers = answers
            .filter((answer) => answer.questionKey !== question.questionKey)
            .concat(submittedAnswer);
        }
        if (Array.isArray(state.data?.savedDrafts)) {
          state.data.savedDrafts = state.data.savedDrafts.filter((draft) => draft.questionKey !== question.questionKey);
        }
        if (state.data?.draftAnswersByQuestionKey) delete state.data.draftAnswersByQuestionKey[question.questionKey];
      } else {
        setStatus('Draft saved.', 'ok');
        state.savedDraftKeys.add(question.questionKey);
      }
      render();
      if (tg?.HapticFeedback?.notificationOccurred) tg.HapticFeedback.notificationOccurred('success');
    }
    async function sendSettings() {
      setStatus('Saving settings...');
      const response = await fetch('/telegram/mini-app/api/settings', {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({
          launch,
          settings: {
            draftStyle: el.draftStyle.value,
            telegramReminders: el.telegramReminders.checked,
          },
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || !body.ok) {
        setStatus(body.error || 'Could not save settings.', 'error');
        return;
      }
      state.data.agent.settings.values = {
        ...state.data.agent.settings.values,
        ...body.settings,
      };
      setStatus('Settings saved.', 'ok');
      if (tg?.HapticFeedback?.notificationOccurred) tg.HapticFeedback.notificationOccurred('success');
    }
    async function clearSavedDrafts() {
      const savedDrafts = Array.isArray(state.data?.savedDrafts) ? state.data.savedDrafts : [];
      const questionKeys = savedDrafts.map((draft) => draft.questionKey).filter(Boolean);
      if (!questionKeys.length) return;
      el.clearDrafts.disabled = true;
      setStatus('Clearing drafts...');
      let response;
      let body;
      try {
        response = await fetch('/telegram/mini-app/api/clear-drafts', {
          method: 'POST',
          headers: headers(),
          body: JSON.stringify({ launch, questionKeys }),
        });
        body = await response.json().catch(() => ({}));
      } catch (error) {
        setStatus('Could not clear drafts.', 'error');
        el.clearDrafts.disabled = false;
        return;
      }
      if (!response.ok || !body.ok) {
        setStatus(body.error || 'Could not clear drafts.', 'error');
        el.clearDrafts.disabled = false;
        return;
      }
      (body.clearedQuestionKeys || questionKeys).forEach((questionKey) => {
        state.savedDraftKeys.delete(questionKey);
        delete state.drafts[questionKey];
      });
      if (Array.isArray(state.data?.savedDrafts)) {
        const cleared = new Set(body.clearedQuestionKeys || questionKeys);
        state.data.savedDrafts = state.data.savedDrafts.filter((draft) => !cleared.has(draft.questionKey));
      }
      if (state.data?.draftAnswersByQuestionKey) state.data.draftAnswersByQuestionKey = {};
      state.activeKey = firstPreferredQuestionKey();
      setStatus('Drafts cleared.', 'ok');
      render();
      if (tg?.HapticFeedback?.notificationOccurred) tg.HapticFeedback.notificationOccurred('success');
    }
    async function loadResults({ force = false } = {}) {
      if (!state.resultsSessionSlug || (state.resultsLoading && !force)) return;
      state.resultsLoading = true;
      state.resultImageUrl = '';
      renderResults();
      let response;
      let body;
      try {
        const resultsUrl = new URL('/telegram/mini-app/api/results', location.origin);
        resultsUrl.searchParams.set('launch', launch);
        resultsUrl.searchParams.set('sessionSlug', state.resultsSessionSlug);
        if (state.resultsDemoData) resultsUrl.searchParams.set('demo', '1');
        response = await fetch(resultsUrl.pathname + resultsUrl.search, { headers: headers() });
        body = await response.json().catch(() => ({}));
      } catch (error) {
        state.resultsData = { ok: false, error: 'results_load_failed' };
        state.resultsLoading = false;
        renderResults();
        return;
      }
      state.resultsData = response.ok && body.ok !== false
        ? body
        : { ok: false, error: body.error || 'results_load_failed' };
      state.resultsLoading = false;
      renderResults();
    }
    function renderResultImage(mode) {
      if (!state.resultsSessionSlug) return;
      const imageUrl = new URL('/telegram/mini-app/api/results-image', location.origin);
      imageUrl.searchParams.set('launch', launch);
      imageUrl.searchParams.set('sessionSlug', state.resultsSessionSlug);
      imageUrl.searchParams.set('mode', mode);
      if (state.resultsDemoData) imageUrl.searchParams.set('demo', '1');
      imageUrl.searchParams.set('v', String(Date.now()));
      state.resultImageUrl = imageUrl.pathname + imageUrl.search;
      renderResults();
    }
    async function loadGroups({ force = false } = {}) {
      if (!state.groupsSessionSlug || (state.groupsLoading && !force)) return;
      state.groupsLoading = true;
      renderGroups();
      let response;
      let body;
      try {
        const groupsUrl = new URL('/telegram/mini-app/api/groups', location.origin);
        groupsUrl.searchParams.set('launch', launch);
        groupsUrl.searchParams.set('sessionSlug', state.groupsSessionSlug);
        response = await fetch(groupsUrl.pathname + groupsUrl.search, { headers: headers() });
        body = await response.json().catch(() => ({}));
      } catch {
        state.groupsData = { ok: false, error: 'groups_load_failed' };
        state.groupsLoading = false;
        renderGroups();
        return;
      }
      state.groupsData = response.ok && body.ok !== false
        ? body
        : { ok: false, error: body.error || 'groups_load_failed' };
      state.groupSelections = { ...((state.groupsData.groups && state.groupsData.groups.selections) || {}) };
      state.groupsLoading = false;
      renderGroups();
    }
    async function saveGroups() {
      if (!state.groupsSessionSlug) return;
      state.groupsSaving = true;
      renderGroups();
      let response;
      let body;
      try {
        response = await fetch('/telegram/mini-app/api/groups', {
          method: 'POST',
          headers: headers(),
          body: JSON.stringify({
            launch,
            sessionSlug: state.groupsSessionSlug,
            selections: state.groupSelections || {},
          }),
        });
        body = await response.json().catch(() => ({}));
      } catch {
        setStatus('Could not save groups.', 'error');
        state.groupsSaving = false;
        renderGroups();
        return;
      }
      state.groupsSaving = false;
      if (!response.ok || !body.ok) {
        setStatus(body.error || 'Could not save groups.', 'error');
        renderGroups();
        return;
      }
      state.groupsData = body;
      state.groupSelections = { ...((body.groups && body.groups.selections) || {}) };
      setStatus('Groups saved.', 'ok');
      renderGroups();
      if (tg?.HapticFeedback?.notificationOccurred) tg.HapticFeedback.notificationOccurred('success');
    }
    async function analyzeResultGroup(groupId) {
      if (!state.resultsSessionSlug || !groupId) return;
      state.groupAnalysisById[groupId] = { loading: true };
      renderResults();
      let response;
      let body;
      try {
        response = await fetch('/telegram/mini-app/api/results', {
          method: 'POST',
          headers: headers(),
          body: JSON.stringify({
            launch,
            action: 'analyze_group',
            sessionSlug: state.resultsSessionSlug,
            groupId,
            demo: state.resultsDemoData,
          }),
        });
        body = await response.json().catch(() => ({}));
      } catch (error) {
        state.groupAnalysisById[groupId] = { loading: false, error: 'Could not analyze group.' };
        renderResults();
        return;
      }
      if (!response.ok || !body.ok) {
        state.groupAnalysisById[groupId] = { loading: false, error: body.error || 'Could not analyze group.' };
      } else {
        state.groupAnalysisById[groupId] = {
          loading: false,
          analysis: body.analysis,
          aiOk: body.aiOk === true,
          reason: body.reason || '',
        };
        if (body.summary) state.resultsData = body.summary;
      }
      renderResults();
    }
    async function load({ retry = false } = {}) {
      let response;
      let body;
      try {
        const stateUrl = new URL('/telegram/mini-app/api/state', location.origin);
        stateUrl.searchParams.set('launch', launch);
        const sessions = selectedSessionQuery();
        if (sessions) stateUrl.searchParams.set('sessions', sessions);
        response = await fetch(stateUrl.pathname + stateUrl.search, {
          headers: headers(),
        });
        body = await response.json().catch(() => ({}));
      } catch (error) {
        setStatus('Could not load Mini App. Retrying...', 'error');
        scheduleQuestionRetry();
        return;
      }
      if (!response.ok || !body.ok) {
        setStatus(body.error || 'Could not load Mini App.', 'error');
        clearQuestionRetry();
        return;
      }
      state.data = body;
      if (body.sessionPicker?.enabled === true && !state.selectedSessionSlugs.size) {
        (body.sessionPicker.selectedSessionSlugs || []).forEach((slug) => state.selectedSessionSlugs.add(slug));
      }
      state.submittedAnswerKeys = new Set((body.submittedAnswerKeys || []).filter(Boolean));
      state.submittedAnswersByQuestionKey = new Map();
      const serverSubmittedAnswers = Array.isArray(body.submittedAnswers) ? body.submittedAnswers : [];
      serverSubmittedAnswers.forEach((entry) => {
        const questionKey = String(entry?.questionKey || '').trim();
        if (!questionKey) return;
        state.submittedAnswersByQuestionKey.set(questionKey, entry);
        if (entry.answer && !answerHasContent(state.drafts[questionKey])) {
          state.drafts[questionKey] = { ...entry.answer };
        }
      });
      state.savedDraftKeys = new Set();
      const serverDrafts = body.draftAnswersByQuestionKey || {};
      Object.entries(serverDrafts).forEach(([questionKey, draft]) => {
        state.savedDraftKeys.add(questionKey);
        if (!state.drafts[questionKey] || Object.keys(state.drafts[questionKey]).length === 0) {
          state.drafts[questionKey] = { ...(draft || {}) };
        }
      });
      const questions = Array.isArray(body.questions) ? body.questions : [];
      const launchQuestion = questions.find((question) => question.activeFromLaunch === true && question.questionKey);
      if (launchQuestion && !state.loadedOnce) {
        state.highlightedQuestionKey = launchQuestion.questionKey;
        state.highlightScrollDone = false;
        expandQuestion(launchQuestion);
        state.activeKey = launchQuestion.questionKey;
      }
      if (!questions.some((question) => question.questionKey === state.activeKey)) {
        state.activeKey = firstPreferredQuestionKey() || body.activeQuestionKey || '';
      } else if (!state.loadedOnce && state.showUnansweredFirst) {
        state.activeKey = state.highlightedQuestionKey || firstPreferredQuestionKey() || body.activeQuestionKey || state.activeKey;
      }
      if (shouldRetryQuestions(body)) {
        setStatus(body.sourceError || (retry ? 'Questions are still loading. Retrying...' : 'Questions are loading. Retrying...'), body.sourceOk ? '' : 'error');
        scheduleQuestionRetry();
      } else {
        clearQuestionRetry();
        setStatus('');
      }
      render();
      state.loadedOnce = true;
      if (state.aiSearchQuery) scheduleAiSearch(0);
    }
    el.continueSessions.onclick = () => {
      if (!state.selectedSessionSlugs.size) return;
      state.activeKey = '';
      state.loadedOnce = false;
      resetResultsForSelection();
      resetGroupsForSelection();
      state.expandedQuestionKeys = new Set();
      state.highlightedQuestionKey = '';
      state.highlightScrollDone = false;
      state.sessionPickerCollapsed = true;
      state.sessionPickerInitialized = true;
      load();
    };
    el.toggleSessions.onclick = () => {
      const picker = state.data?.sessionPicker || {};
      if (picker.required === true && !state.selectedSessionSlugs.size) return;
      state.sessionPickerCollapsed = !state.sessionPickerCollapsed;
      renderSessionPicker();
    };
    function setPanelOpen(panel, button, open) {
      panel.classList.toggle('open', open);
      button.classList.toggle('active', open);
      button.setAttribute('aria-expanded', open ? 'true' : 'false');
    }
    el.showFilter.onclick = () => setPanelOpen(el.filterPanel, el.showFilter, !el.filterPanel.classList.contains('open'));
    el.showSettings.onclick = () => setPanelOpen(el.settingsPanel, el.showSettings, !el.settingsPanel.classList.contains('open'));
    el.showGroups.onclick = () => {
      const open = !el.groupsPanel.classList.contains('open');
      setPanelOpen(el.groupsPanel, el.showGroups, open);
      if (open && !state.groupsData && state.groupsSessionSlug) loadGroups();
    };
    el.showResults.onclick = () => {
      const open = !el.resultsPanel.classList.contains('open');
      setPanelOpen(el.resultsPanel, el.showResults, open);
      if (open && !state.resultsData && state.resultsSessionSlug) loadResults();
    };
    el.refreshResults.onclick = () => loadResults({ force: true });
    el.renderConsensusImage.onclick = () => renderResultImage('consensus');
    el.renderGroupImage.onclick = () => renderResultImage('group');
    el.refreshGroups.onclick = () => loadGroups({ force: true });
    el.saveGroups.onclick = () => saveGroups();
    el.filterUnansweredFirst.onchange = () => {
      state.showUnansweredFirst = el.filterUnansweredFirst.checked;
      writeShowUnansweredFirst(state.showUnansweredFirst);
      render();
    };
    el.filterAiSearch.oninput = () => {
      if (el.filterAiSearch.dataset.micFeedbackActive === 'true') {
        el.filterAiSearch.classList.remove('micFeedback');
        delete el.filterAiSearch.dataset.micFeedbackActive;
        el.filterAiSearch.placeholder = el.filterAiSearch.dataset.originalPlaceholder || 'Describe questions to find';
      }
      state.aiDraftQuery = el.filterAiSearch.value;
      state.aiSearchQuery = state.aiDraftQuery.trim();
      clearAiSearchResults();
      scheduleAiSearch();
      render();
    };
    el.filterAiSearch.onkeydown = (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
      }
    };
    el.clearAiSearch.onclick = () => {
      state.aiDraftQuery = '';
      state.aiSearchQuery = '';
      clearSearchMicFeedback();
      clearAiSearchResults();
      render();
    };
    el.filterAiSearchMic.onclick = () => startSearchDictation(el.filterAiSearchMic);
    el.demoDataResults.onchange = () => {
      state.resultsDemoData = el.demoDataResults.checked;
      writeDemoResults(state.resultsDemoData);
      resetResultsForSelection();
      if (el.resultsPanel.classList.contains('open')) loadResults({ force: true });
    };
    el.saveSettings.onclick = () => sendSettings();
    el.clearDrafts.onclick = () => clearSavedDrafts();
    load();
  </script>
</body>
</html>`;
}

export async function handleTelegramMiniAppRequest({
  request,
  env = {},
  waitUntil = null,
} = {}) {
  const url = new URL(request.url);
  if (url.pathname === '/telegram/mini-app' && request.method === 'GET') {
    return html(telegramMiniAppHtml());
  }
  if (url.pathname === '/telegram/mini-app/api/state' && request.method === 'GET') {
    const state = await buildMiniAppState({
      request,
      env,
      waitUntil,
    });
    return json(state, { status: Number(state.httpStatus || (state.ok === false ? 401 : 200)) });
  }
  if (url.pathname === '/telegram/mini-app/api/draft' && request.method === 'POST') {
    return handleDraftRequest({ request, env });
  }
  if (url.pathname === '/telegram/mini-app/api/clear-drafts' && request.method === 'POST') {
    return handleClearDraftsRequest({ request, env });
  }
  if (url.pathname === '/telegram/mini-app/api/transcribe' && request.method === 'POST') {
    return handleTranscribeRequest({ request, env });
  }
  if (url.pathname === '/telegram/mini-app/api/search' && request.method === 'POST') {
    return handleSearchRequest({ request, env });
  }
  if (url.pathname === '/telegram/mini-app/api/results' && ['GET', 'POST'].includes(request.method)) {
    return handleResultsRequest({ request, env });
  }
  if (url.pathname === '/telegram/mini-app/api/results-image' && request.method === 'GET') {
    return handleResultsImageRequest({ request, env });
  }
  if (url.pathname === '/telegram/mini-app/api/groups' && ['GET', 'POST'].includes(request.method)) {
    return handleGroupsRequest({ request, env });
  }
  if (url.pathname === '/telegram/mini-app/api/settings' && request.method === 'POST') {
    return handleSettingsRequest({ request, env });
  }
  return json({ ok: false, error: 'not_found' }, { status: 404 });
}

export const __test__telegramMiniApp = {
  AGENT_REQUEST_KV_PREFIX,
  SUBMIT_REQUEST_KV_PREFIX,
  buildMiniAppState,
  miniQuestionFromRecord,
  miniDemoQuestionsForResults,
  miniDemoResultRecords,
  normalizeAgentSettingsInput,
  normalizeMiniAnswer,
  telegramMiniAppHtml,
  validateTelegramMiniAppInitData,
};
