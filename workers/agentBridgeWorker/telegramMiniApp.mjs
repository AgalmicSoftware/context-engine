import {
  TELEGRAM_BRIDGE_ACTIONS,
  TELEGRAM_CHAT_LANES,
} from './constants.mjs';
import {
  buildCanonicalAgentRequest,
  listAgentApiCapabilities,
} from './agentApiCatalog.mjs';
import { deriveManagedDemoAccount } from './managedAccounts.mjs';
import { submitTelegramResponseOnChain } from './onChainResponses.mjs';
import { buildOpaqueActionId, createTelegramCallbackAction, parseOpaqueActionId } from './opaqueActions.mjs';
import {
  buildTelegramAgentSettingsEditState,
  buildTelegramAgentSettingsOverviewState,
  buildTelegramPoseQuestionState,
} from './questionUi.mjs';
import { assertNoSecretShape } from './redaction.mjs';
import { resolveSessionInvocation } from './sessionPolicy.mjs';
import {
  loadQuestionsForSession,
  loadSessionPolicy,
  persistActionRecord,
  persistAnswerDraft,
  questionId as readQuestionId,
  readActionRecord,
  shortQuestionId,
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

function safeString(value) {
  return String(value || '').trim();
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
  if (!launchSessionSlug || !questionSessionSlug || launchSessionSlug !== questionSessionSlug) return false;
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
  if (!Object.keys(patch).length) {
    return { ok: false, reason: 'settings_patch_required' };
  }
  return {
    ok: true,
    patch,
    publicSummary: {
      ...(Object.hasOwn(patch, 'draftStyle') ? { draftStyle: patch.draftStyle } : {}),
      ...(Object.hasOwn(patch, 'telegramReminders') ? { telegramReminders: patch.telegramReminders } : {}),
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
  return {
    index,
    displayIndex: index + 1,
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
}

function launchSessionSlug(record = {}, env = {}) {
  return sanitizeSessionSlug(
    record?.serverContextRef?.sessionSlug ||
    env.AGENT_BRIDGE_DEFAULT_SESSION_SLUG ||
    env.DEFAULT_SESSION_SLUG ||
    'general'
  ) || 'general';
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
  const sessionSlug = launchSessionSlug(launchRecord, env);
  const launchQuestionId = safeString(launchRecord?.serverContextRef?.questionId);
  const loaded = await loadQuestionsForSession(env, sessionSlug, { waitUntil });
  const sourceQuestions = Array.isArray(loaded.questions) ? loaded.questions : [];
  const questions = await Promise.all(sourceQuestions.map((question, index) => miniQuestionFromRecord({
    env,
    sessionSlug,
    question,
    index,
    launchQuestionId,
    createdAt,
  })));
  const activeQuestionKey = questions.find((question) => question.activeFromLaunch)?.questionKey ||
    questions.find((question) => question.canAnswer)?.questionKey ||
    questions[0]?.questionKey ||
    '';
  const agentSettings = defaultAgentSettingsState({ sessionSlug, createdAt });
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
      title: sessionSlug,
    },
    questions,
    activeQuestionKey,
    questionCount: questions.length,
    pageSize: DEFAULT_MINI_APP_PAGE_SIZE,
    questionSource: loaded.source || 'telegram_worker_question_cache',
    questionSourceReason: loaded.reason || '',
    sourceOk: loaded.ok !== false,
    sourceError: loaded.ok === false ? (loaded.reason || 'question_source_unavailable') : '',
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
  if (existing && typeof existing === 'object' && !Array.isArray(existing)) {
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
      --accent-text: #11142f;
      --danger: #ff8a7a;
      --ok: #62ffbf;
      --shadow-dark: #10122c;
      --shadow-light: #2d3274;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      font: 15px/1.45 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      color: var(--text);
      background: var(--bg);
    }
    button, input, textarea { font: inherit; }
    button { cursor: pointer; }
    .app {
      min-height: 100vh;
      display: grid;
      grid-template-rows: auto minmax(0, 1fr) auto;
      padding: max(16px, env(safe-area-inset-top)) 14px max(14px, env(safe-area-inset-bottom));
      gap: 14px;
    }
    header { display: grid; gap: 8px; }
    .headerBar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
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
    .iconButton svg {
      width: 17px;
      height: 17px;
      fill: currentColor;
      display: block;
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
    .settingsPanel {
      display: none;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: var(--surface);
      padding: 12px;
      gap: 10px;
      grid-template-columns: minmax(0, 1fr) auto auto;
      align-items: end;
    }
    .settingsPanel.open { display: grid; }
    .field { display: grid; gap: 5px; }
    .field label { color: var(--muted); font-size: 12px; }
    .toggle { display: flex; align-items: center; gap: 8px; min-height: 38px; color: var(--text); }
    .layout {
      display: grid;
      gap: 12px;
      min-height: 0;
    }
    .questionStack { display: grid; gap: 12px; min-height: 0; }
    .questionMeta { color: var(--muted); font-size: 12px; margin-bottom: 6px; }
    .pager { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: 10px; }
    .pager button, .secondary {
      min-height: 36px;
      border: 1px solid var(--line);
      border-radius: 7px;
      background: rgba(255, 255, 255, 0.06);
      color: var(--text);
      padding: 7px 10px;
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
    .cardHead { padding: 16px; border-bottom: 1px solid var(--line); }
    .prompt { margin: 0; font-size: 19px; line-height: 1.28; letter-spacing: 0; }
    .cardBody { padding: 16px; display: grid; align-content: start; gap: 14px; }
    .cardActions { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 8px; }
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
    .locked { color: var(--muted); border: 1px dashed var(--line); border-radius: 8px; padding: 12px; background: rgba(255, 255, 255, 0.04); }
    footer {
      position: sticky;
      bottom: 0;
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
      gap: 10px;
      padding-top: 6px;
      background: var(--bg);
    }
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
    .primary:disabled, .secondary:disabled { opacity: 0.58; cursor: default; }
    .ok { color: var(--ok); }
    .error { color: var(--danger); white-space: pre-wrap; }
    @media (max-width: 760px) {
      footer { grid-template-columns: 1fr; }
      .settingsPanel { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <main class="app">
    <header>
      <div class="headerBar">
        <h1>Context Engine</h1>
        <button class="iconButton" id="showSettings" type="button" aria-label="Settings" title="Settings">
          <svg aria-hidden="true" focusable="false" viewBox="0 0 512 512">
            <path d="M487.4 315.7l-42.6-24.6c4.3-23.2 4.3-47 0-70.2l42.6-24.6c4.9-2.8 7.1-8.6 5.5-14-11.1-35.6-30-67.8-54.7-94.6-3.8-4.1-10-5.1-14.8-2.3L380.8 110c-17.9-15.4-38.5-27.3-60.8-35.1V25.8c0-5.6-3.9-10.5-9.4-11.7-36.7-8.2-74.3-7.8-109.2 0-5.5 1.2-9.4 6.1-9.4 11.7V75c-22.2 7.9-42.8 19.8-60.8 35.1L88.7 85.5c-4.9-2.8-11-1.9-14.8 2.3-24.7 26.7-43.6 58.9-54.7 94.6-1.7 5.4.6 11.2 5.5 14L67.3 221c-4.3 23.2-4.3 47 0 70.2l-42.6 24.6c-4.9 2.8-7.1 8.6-5.5 14 11.1 35.6 30 67.8 54.7 94.6 3.8 4.1 10 5.1 14.8 2.3l42.6-24.6c17.9 15.4 38.5 27.3 60.8 35.1v49.2c0 5.6 3.9 10.5 9.4 11.7 36.7 8.2 74.3 7.8 109.2 0 5.5-1.2 9.4-6.1 9.4-11.7v-49.2c22.2-7.9 42.8-19.8 60.8-35.1l42.6 24.6c4.9 2.8 11 1.9 14.8-2.3 24.7-26.7 43.6-58.9 54.7-94.6 1.5-5.5-.7-11.3-5.6-14.1zM256 336c-44.1 0-80-35.9-80-80s35.9-80 80-80 80 35.9 80 80-35.9 80-80 80z"></path>
          </svg>
        </button>
      </div>
      <div class="meta" id="meta"></div>
      <div class="status" id="status">Loading...</div>
      <section class="settingsPanel" id="settingsPanel" aria-label="Agent settings">
        <div class="field">
          <label for="draftStyle">Draft style</label>
          <select id="draftStyle"></select>
        </div>
        <label class="toggle">
          <input id="telegramReminders" type="checkbox">
          <span>Reminders</span>
        </label>
        <button class="primary" id="saveSettings" type="button">Save</button>
      </section>
    </header>
    <section class="layout">
      <section class="questionStack" id="questionStack" aria-label="Questions"></section>
      <section class="pager" aria-label="Question pages">
        <button id="prev" type="button">Previous</button>
        <span id="page"></span>
        <button id="next" type="button">Next</button>
      </section>
    </section>
    <footer>
      <button class="secondary" id="save" type="button">Save Draft</button>
      <button class="primary" id="submit" type="button">Submit</button>
    </footer>
  </main>
  <script>
    const tg = window.Telegram && window.Telegram.WebApp ? window.Telegram.WebApp : null;
    if (tg) {
      tg.ready();
      if (typeof tg.expand === 'function') tg.expand();
    }
    const params = new URLSearchParams(location.search);
    const launch = params.get('launch') || params.get('tgWebAppStartParam') || (tg && tg.initDataUnsafe && tg.initDataUnsafe.start_param) || '';
    const QUESTION_RETRY_DELAY_MS = 4000;
    const state = { data: null, activeKey: '', page: 0, drafts: {}, retryTimer: null, submitting: false };
    const el = {
      meta: document.getElementById('meta'),
      status: document.getElementById('status'),
      questionStack: document.getElementById('questionStack'),
      page: document.getElementById('page'),
      prev: document.getElementById('prev'),
      next: document.getElementById('next'),
      save: document.getElementById('save'),
      submit: document.getElementById('submit'),
      showSettings: document.getElementById('showSettings'),
      settingsPanel: document.getElementById('settingsPanel'),
      draftStyle: document.getElementById('draftStyle'),
      telegramReminders: document.getElementById('telegramReminders'),
      saveSettings: document.getElementById('saveSettings'),
    };
    const headers = () => {
      const out = { 'content-type': 'application/json' };
      if (tg && tg.initData) out['x-telegram-init-data'] = tg.initData;
      return out;
    };
    const activeQuestion = () => (state.data?.questions || []).find((question) => question.questionKey === state.activeKey) || null;
    const draftFor = (question) => {
      if (!question) return {};
      state.drafts[question.questionKey] = state.drafts[question.questionKey] || {};
      return state.drafts[question.questionKey];
    };
    const activate = (question) => {
      if (question?.questionKey) state.activeKey = question.questionKey;
    };
    const setStatus = (message, kind = '') => {
      el.status.className = 'status ' + kind;
      el.status.textContent = message || '';
    };
    function shouldRetryQuestions(data) {
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
    function setSubmitBusy(isBusy, triggerButton = null) {
      state.submitting = isBusy;
      [el.submit, triggerButton].filter(Boolean).forEach((button) => {
        button.disabled = isBusy || !activeQuestion()?.canAnswer;
        button.textContent = isBusy ? 'Submitting...' : 'Submit';
        button.setAttribute('aria-busy', isBusy ? 'true' : 'false');
      });
      if (!isBusy) updateFooterControls();
    }
    function renderQuestionStack() {
      const questions = state.data?.questions || [];
      const pageSize = state.data?.pageSize || 5;
      const pageCount = Math.max(1, Math.ceil(questions.length / pageSize));
      state.page = Math.min(state.page, pageCount - 1);
      const visible = questions.slice(state.page * pageSize, state.page * pageSize + pageSize);
      el.questionStack.innerHTML = '';
      visible.forEach((question) => {
        const card = document.createElement('article');
        card.className = 'card';
        card.dataset.active = question.questionKey === state.activeKey ? 'true' : 'false';
        card.onclick = () => { activate(question); updateFooterControls(); };
        const head = document.createElement('div');
        head.className = 'cardHead';
        const meta = document.createElement('div');
        meta.className = 'questionMeta';
        meta.textContent = 'Question ' + question.displayIndex;
        const prompt = document.createElement('p');
        prompt.className = 'prompt';
        prompt.textContent = question.prompt || question.title || '';
        head.append(meta, prompt);
        const body = document.createElement('div');
        body.className = 'cardBody';
        renderAnswerControls(question, body);
        card.append(head, body);
        el.questionStack.appendChild(card);
      });
      el.page.textContent = questions.length ? (state.page + 1) + ' / ' + pageCount : '0 / 0';
      el.prev.disabled = state.page <= 0;
      el.next.disabled = state.page >= pageCount - 1;
      updateFooterControls();
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
        const input = document.createElement('textarea');
        input.placeholder = 'Type your response';
        input.value = draft.text || '';
        input.oninput = () => {
          activate(question);
          draft.text = input.value;
          updateFooterControls();
        };
        mount.appendChild(input);
      }
      const comments = document.createElement('textarea');
      comments.placeholder = 'Additional comments';
      comments.value = draft.comments || '';
      comments.oninput = () => {
        activate(question);
        draft.comments = comments.value;
        updateFooterControls();
      };
      mount.appendChild(comments);
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
      submit.className = 'primary';
      submit.textContent = 'Submit';
      submit.onclick = (event) => {
        event.stopPropagation();
        sendAnswer(true, question, submit);
      };
      actions.append(save, submit);
      mount.appendChild(actions);
    }
    function updateFooterControls() {
      const question = activeQuestion();
      const disabled = !question?.canAnswer;
      el.save.disabled = disabled;
      el.submit.disabled = disabled || state.submitting;
    }
    function render() {
      const data = state.data;
      el.meta.textContent = data ? [data.session.title, data.questionCount + ' questions'].join(' | ') : '';
      renderAgentSettings();
      renderQuestionStack();
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
        setSubmitBusy(true, triggerButton);
      } else {
        setStatus('Saving draft...');
      }
      let response;
      let body;
      try {
        response = await fetch('/telegram/mini-app/api/draft', {
          method: 'POST',
          headers: headers(),
          body: JSON.stringify({
            launch,
            questionKey: question.questionKey,
            answer: answerPayload(question),
            submit,
          }),
        });
        body = await response.json().catch(() => ({}));
      } catch (error) {
        if (submit) setSubmitBusy(false, triggerButton);
        setStatus('Could not save answer.', 'error');
        return;
      }
      if (submit) setSubmitBusy(false, triggerButton);
      if (!response.ok || !body.ok) {
        setStatus(body.message || body.error || 'Could not save answer.', 'error');
        return;
      }
      setStatus(['submit_request_created', 'direct_submitted'].includes(body.status) ? 'Submitted.' : 'Draft saved.', 'ok');
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
    async function load({ retry = false } = {}) {
      let response;
      let body;
      try {
        response = await fetch('/telegram/mini-app/api/state?launch=' + encodeURIComponent(launch), {
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
      const questions = Array.isArray(body.questions) ? body.questions : [];
      if (!questions.some((question) => question.questionKey === state.activeKey)) {
        state.activeKey = body.activeQuestionKey || '';
      }
      if (shouldRetryQuestions(body)) {
        setStatus(body.sourceError || (retry ? 'Questions are still loading. Retrying...' : 'Questions are loading. Retrying...'), body.sourceOk ? '' : 'error');
        scheduleQuestionRetry();
      } else {
        clearQuestionRetry();
        setStatus('');
      }
      render();
    }
    el.prev.onclick = () => { state.page -= 1; render(); };
    el.next.onclick = () => { state.page += 1; render(); };
    el.save.onclick = () => sendAnswer(false);
    el.submit.onclick = () => sendAnswer(true, activeQuestion(), el.submit);
    el.showSettings.onclick = () => { el.settingsPanel.classList.toggle('open'); };
    el.saveSettings.onclick = () => sendSettings();
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
  normalizeAgentSettingsInput,
  normalizeMiniAnswer,
  telegramMiniAppHtml,
  validateTelegramMiniAppInitData,
};
