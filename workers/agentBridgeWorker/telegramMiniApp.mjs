import {
  TELEGRAM_BRIDGE_ACTIONS,
  TELEGRAM_CHAT_LANES,
} from './constants.mjs';
import { buildOpaqueActionId, createTelegramCallbackAction, parseOpaqueActionId } from './opaqueActions.mjs';
import { buildTelegramPoseQuestionState } from './questionUi.mjs';
import {
  loadQuestionsForSession,
  persistActionRecord,
  persistAnswerDraft,
  questionId as readQuestionId,
  readActionRecord,
  shortQuestionId,
} from './telegramCommands.mjs';

const DEFAULT_MINI_APP_AUTH_MAX_AGE_SECONDS = 24 * 60 * 60;
const DEFAULT_MINI_APP_PAGE_SIZE = 5;
const QUESTION_ACTION_TTL_SECONDS = 30 * 60;
const SUBMIT_REQUEST_KV_PREFIX = 'telegram:submit-request:';
const SUBMIT_REQUEST_TTL_SECONDS = 30 * 24 * 60 * 60;
const BYTES32_RE = /^0x[0-9a-fA-F]{64}$/;

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
    idShort: shortQuestionId(qid),
    activeFromLaunch: Boolean(launchQuestionId && qid && lower(qid) === lower(launchQuestionId)),
    questionType: safeString(card.questionType || group.questionType || 'freeform'),
    selectionMode: safeString(card.selectionMode || ''),
    ratingScale: card.ratingScale || null,
    title: payloadUnavailable
      ? 'Question unavailable'
      : locked
      ? 'Locked question'
      : safeString(card.questionText || group.questionText || 'Untitled question'),
    prompt: locked || payloadUnavailable ? '' : safeString(card.questionText || group.questionText || 'Untitled question'),
    options: locked || payloadUnavailable ? [] : (Array.isArray(card.answerLabels) ? card.answerLabels : []),
    locked,
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
  };
}

function normalizeText(value = '', maxLength = 4000) {
  return safeString(value).slice(0, maxLength);
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
    const labels = { agree: 'Agree', unsure: 'Unsure', disagree: 'Disagree' };
    if (!labels[value]) return { ok: false, reason: 'binary_answer_invalid' };
    return {
      ok: true,
      label: labels[value],
      value,
      answer: { questionType: type, value, label: labels[value], comments },
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
      replayed: true,
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
    return json({ ok: false, error: submitRequest.reason || 'submit_request_failed' }, { status: 503 });
  }

  return json({
    ok: true,
    status: submitRequest?.ok ? 'submit_request_created' : 'draft_saved',
    draft: {
      status: 'draft_saved',
      questionIdShort: shortQuestionId(questionRef.questionId),
      answerLabel: normalizedAnswer.label,
      submitLane: TELEGRAM_CHAT_LANES.MINI_APP,
    },
    submitRequest,
  });
}

function telegramMiniAppHtml() {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>CE Mini App</title>
  <script src="https://telegram.org/js/telegram-web-app.js?62"></script>
  <style>
    :root {
      color-scheme: light dark;
      --bg: var(--tg-theme-bg-color, #f4f7fb);
      --surface: var(--tg-theme-secondary-bg-color, #ffffff);
      --text: var(--tg-theme-text-color, #17202a);
      --muted: var(--tg-theme-hint-color, #596579);
      --line: rgba(77, 96, 122, 0.24);
      --accent: var(--tg-theme-button-color, #1769e0);
      --accent-text: var(--tg-theme-button-text-color, #ffffff);
      --danger: #b42318;
      --ok: #137a4b;
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
      padding: max(14px, env(safe-area-inset-top)) 14px max(14px, env(safe-area-inset-bottom));
      gap: 12px;
    }
    header { display: grid; gap: 8px; }
    h1 { margin: 0; font-size: 22px; line-height: 1.15; letter-spacing: 0; }
    .meta { color: var(--muted); font-size: 13px; display: flex; flex-wrap: wrap; gap: 8px; }
    .status { min-height: 20px; color: var(--muted); font-size: 13px; }
    .layout { display: grid; grid-template-columns: minmax(0, 0.92fr) minmax(0, 1.35fr); gap: 12px; min-height: 0; }
    .queue, .active { min-height: 0; }
    .queueList { display: grid; gap: 8px; }
    .queueButton {
      width: 100%;
      min-height: 54px;
      text-align: left;
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 9px 10px;
      background: var(--surface);
      color: var(--text);
    }
    .queueButton[aria-current="true"] { border-color: var(--accent); box-shadow: inset 3px 0 0 var(--accent); }
    .queueButton:disabled { color: var(--muted); cursor: default; }
    .qid { color: var(--muted); font-size: 12px; margin-bottom: 3px; }
    .qtitle { overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
    .pager { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: 10px; }
    .pager button, .secondary {
      min-height: 36px;
      border: 1px solid var(--line);
      border-radius: 7px;
      background: var(--surface);
      color: var(--text);
      padding: 7px 10px;
    }
    .card {
      min-height: 100%;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: var(--surface);
      display: grid;
      grid-template-rows: auto minmax(0, 1fr);
    }
    .cardHead { padding: 14px; border-bottom: 1px solid var(--line); }
    .prompt { margin: 0; font-size: 19px; line-height: 1.28; letter-spacing: 0; }
    .cardBody { padding: 14px; display: grid; align-content: start; gap: 14px; overflow: auto; }
    .segmented, .choices, .ratingTicks { display: grid; gap: 8px; }
    .segmented { grid-template-columns: repeat(3, minmax(0, 1fr)); }
    .choices { grid-template-columns: repeat(auto-fit, minmax(132px, 1fr)); }
    .choice, .segment {
      min-height: 42px;
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 9px 10px;
      background: transparent;
      color: var(--text);
      text-align: center;
    }
    .choice.selected, .segment.selected {
      background: var(--accent);
      border-color: var(--accent);
      color: var(--accent-text);
    }
    .ratingValue { font-size: 32px; font-weight: 700; letter-spacing: 0; }
    input[type="range"] { width: 100%; accent-color: var(--accent); }
    textarea {
      width: 100%;
      min-height: 104px;
      resize: vertical;
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 10px;
      background: var(--surface);
      color: var(--text);
    }
    .locked { color: var(--muted); border: 1px dashed var(--line); border-radius: 8px; padding: 12px; }
    footer {
      position: sticky;
      bottom: 0;
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
      gap: 10px;
      padding-top: 4px;
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
    }
    .primary:disabled, .secondary:disabled { opacity: 0.58; cursor: default; }
    .ok { color: var(--ok); }
    .error { color: var(--danger); white-space: pre-wrap; }
    @media (max-width: 760px) {
      .layout { grid-template-columns: 1fr; }
      .card { min-height: 390px; }
      footer { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <main class="app">
    <header>
      <h1>Questions</h1>
      <div class="meta" id="meta"></div>
      <div class="status" id="status">Loading...</div>
    </header>
    <section class="layout">
      <aside class="queue">
        <div class="queueList" id="queue"></div>
        <div class="pager">
          <button id="prev" type="button">Previous</button>
          <span id="page"></span>
          <button id="next" type="button">Next</button>
        </div>
      </aside>
      <section class="active">
        <article class="card">
          <div class="cardHead">
            <div class="qid" id="activeId"></div>
            <p class="prompt" id="prompt"></p>
          </div>
          <div class="cardBody" id="answer"></div>
        </article>
      </section>
    </section>
    <footer>
      <button class="secondary" id="save" type="button">Save Draft</button>
      <button class="primary" id="submit" type="button">Queue Submit</button>
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
    const state = { data: null, activeKey: '', page: 0, drafts: {} };
    const el = {
      meta: document.getElementById('meta'),
      status: document.getElementById('status'),
      queue: document.getElementById('queue'),
      page: document.getElementById('page'),
      prev: document.getElementById('prev'),
      next: document.getElementById('next'),
      activeId: document.getElementById('activeId'),
      prompt: document.getElementById('prompt'),
      answer: document.getElementById('answer'),
      save: document.getElementById('save'),
      submit: document.getElementById('submit'),
    };
    const headers = () => {
      const out = { 'content-type': 'application/json' };
      if (tg && tg.initData) out['x-telegram-init-data'] = tg.initData;
      return out;
    };
    const activeQuestion = () => (state.data?.questions || []).find((question) => question.questionKey === state.activeKey) || null;
    const activeDraft = () => {
      const question = activeQuestion();
      if (!question) return {};
      state.drafts[question.questionKey] = state.drafts[question.questionKey] || {};
      return state.drafts[question.questionKey];
    };
    const setStatus = (message, kind = '') => {
      el.status.className = 'status ' + kind;
      el.status.textContent = message || '';
    };
    function renderQueue() {
      const questions = state.data?.questions || [];
      const pageSize = state.data?.pageSize || 5;
      const pageCount = Math.max(1, Math.ceil(questions.length / pageSize));
      state.page = Math.min(state.page, pageCount - 1);
      const visible = questions.slice(state.page * pageSize, state.page * pageSize + pageSize);
      el.queue.innerHTML = '';
      visible.forEach((question) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'queueButton';
        button.disabled = !question.questionKey;
        button.setAttribute('aria-current', question.questionKey === state.activeKey ? 'true' : 'false');
        const qid = document.createElement('div');
        qid.className = 'qid';
        qid.textContent = question.displayIndex + '. ' + (question.idShort || '');
        const title = document.createElement('div');
        title.className = 'qtitle';
        title.textContent = question.title || '';
        button.append(qid, title);
        button.onclick = () => { state.activeKey = question.questionKey; render(); };
        el.queue.appendChild(button);
      });
      el.page.textContent = questions.length ? (state.page + 1) + ' / ' + pageCount : '0 / 0';
      el.prev.disabled = state.page <= 0;
      el.next.disabled = state.page >= pageCount - 1;
    }
    function escapeHtml(value) {
      return String(value || '').replace(/[&<>"']/g, (char) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      }[char]));
    }
    function selectValue(value) {
      const draft = activeDraft();
      draft.value = value;
      renderAnswer();
    }
    function toggleChoice(option, single) {
      const draft = activeDraft();
      const values = Array.isArray(draft.values) ? draft.values.slice() : [];
      const next = single
        ? (values.includes(option) ? [] : [option])
        : (values.includes(option) ? values.filter((value) => value !== option) : values.concat(option));
      draft.values = next;
      renderAnswer();
    }
    function renderAnswer() {
      const question = activeQuestion();
      el.answer.innerHTML = '';
      if (!question) {
        el.activeId.textContent = '';
        el.prompt.textContent = 'No answerable question is selected.';
        el.save.disabled = true;
        el.submit.disabled = true;
        return;
      }
      el.activeId.textContent = question.idShort + ' | ' + question.questionType;
      el.prompt.textContent = question.prompt || question.title;
      el.save.disabled = !question.canAnswer;
      el.submit.disabled = !question.canAnswer;
      if (question.locked || !question.canAnswer) {
        const locked = document.createElement('div');
        locked.className = 'locked';
        locked.textContent = 'This question is locked or unavailable in Telegram.';
        el.answer.appendChild(locked);
        return;
      }
      const draft = activeDraft();
      if (question.questionType === 'agree_unsure_disagree') {
        const row = document.createElement('div');
        row.className = 'segmented';
        [['agree', 'Agree'], ['unsure', 'Unsure'], ['disagree', 'Disagree']].forEach(([value, label]) => {
          const button = document.createElement('button');
          button.type = 'button';
          button.className = 'segment' + (draft.value === value ? ' selected' : '');
          button.textContent = label;
          button.onclick = () => selectValue(value);
          row.appendChild(button);
        });
        el.answer.appendChild(row);
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
        input.oninput = () => { draft.value = Number(input.value); label.textContent = input.value; };
        el.answer.append(label, input);
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
          button.onclick = () => toggleChoice(option, single);
          wrap.appendChild(button);
        });
        el.answer.appendChild(wrap);
      } else {
        const input = document.createElement('textarea');
        input.placeholder = 'Type your response';
        input.value = draft.text || '';
        input.oninput = () => { draft.text = input.value; };
        el.answer.appendChild(input);
      }
      const comments = document.createElement('textarea');
      comments.placeholder = 'Additional comments';
      comments.value = draft.comments || '';
      comments.oninput = () => { draft.comments = comments.value; };
      el.answer.appendChild(comments);
    }
    function render() {
      const data = state.data;
      el.meta.textContent = data ? [data.session.title, data.questionCount + ' questions'].join(' | ') : '';
      renderQueue();
      renderAnswer();
    }
    function answerPayload(question) {
      const draft = activeDraft();
      if (question.questionType === 'multichoice') return { values: draft.values || [], comments: draft.comments || '' };
      if (question.questionType === 'freeform') return { text: draft.text || '', comments: draft.comments || '' };
      return { value: draft.value, comments: draft.comments || '' };
    }
    async function sendAnswer(submit) {
      const question = activeQuestion();
      if (!question) return;
      setStatus(submit ? 'Creating submit request...' : 'Saving draft...');
      const response = await fetch('/telegram/mini-app/api/draft', {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({
          launch,
          questionKey: question.questionKey,
          answer: answerPayload(question),
          submit,
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || !body.ok) {
        setStatus(body.error || 'Could not save answer.', 'error');
        return;
      }
      setStatus(body.status === 'submit_request_created' ? 'Submit request queued.' : 'Draft saved.', 'ok');
      if (tg?.HapticFeedback?.notificationOccurred) tg.HapticFeedback.notificationOccurred('success');
    }
    async function load() {
      const response = await fetch('/telegram/mini-app/api/state?launch=' + encodeURIComponent(launch), {
        headers: headers(),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || !body.ok) {
        setStatus(body.error || 'Could not load Mini App.', 'error');
        return;
      }
      state.data = body;
      state.activeKey = body.activeQuestionKey || '';
      setStatus(body.sourceOk ? '' : body.sourceError, body.sourceOk ? '' : 'error');
      render();
    }
    el.prev.onclick = () => { state.page -= 1; renderQueue(); };
    el.next.onclick = () => { state.page += 1; renderQueue(); };
    el.save.onclick = () => sendAnswer(false);
    el.submit.onclick = () => sendAnswer(true);
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
  return json({ ok: false, error: 'not_found' }, { status: 404 });
}

export const __test__telegramMiniApp = {
  SUBMIT_REQUEST_KV_PREFIX,
  buildMiniAppState,
  normalizeMiniAnswer,
  validateTelegramMiniAppInitData,
};
