import { safeString, lower, stableFingerprint, envFlagEnabled, nowIso, safeEnvJsonParse as safeJsonParse, sanitizeSessionSlug } from './runtimePrimitives.mjs';

import { listKvRecordsByPrefix } from './kvReadHelpers.mjs';

import { AGENT_BRIDGE_EVENT_TYPES, RISK_CEILINGS, AGENT_ACTIONS, LEGACY_TRANSPORT_LANES } from './constants.mjs';

import { deriveManagedDemoAccount } from './managedAccounts.mjs';

import { authenticateSessionWorker, resolveSessionWorkerUrl, submitAgentResponseOnChain } from './onChainResponses.mjs';

import { buildOpaqueActionId, buildSubmitIdempotencyKey } from './opaqueActions.mjs';

import { normalizeAgentRatingScale } from './ratingScale.mjs';

import { assertNoSecretShape } from './redaction.mjs';

import { listCachedSessionQuestionsForBridge } from './sessionQuestions.mjs';

import { evaluateSponsoredResourceEligibility, resolveSessionInvocation } from './sessionPolicy.mjs';

import { clearAdminDefaultSessionOverride, loadSessionPolicy, readAdminDefaultSessionOverride, writeAdminDefaultSessionOverride, writeResultsExposureOverride } from './sessionPolicyLoader.mjs';

import { answerFromStoredDraft } from './agentDraftEditMetrics.mjs';

import { listAgentProposedQuestionsForSessionWithSummary, mergeAgentProposedQuestions } from './agentQuestionProposals.mjs';

import { buildAgentActivityMetadata } from './agentActivity.mjs';

import { buildQueuedSubmitRecord, canonicalAnswerSessionKvPrefix, enqueueAgentSubmitRecord, persistAgentSubmitRecord, queueAgentSubmitRecord, SUBMIT_REQUEST_KV_PREFIX, SUBMITTED_RESULT_STATUSES, submitRequestKvKey, submitRequestSessionKvPrefix, agentSubmitQueueEnabled } from './agentSubmitQueue.mjs';

import { normalizeLegacyManagedPrincipal } from './legacyCompatibility.mjs';

const ACTION_KV_PREFIX = 'telegram:action:';

const GROUP_SESSION_KV_PREFIX = 'telegram:group-session:';

const PRIVATE_SESSION_KV_PREFIX = 'telegram:private-session:';

const ANSWER_DRAFT_KV_PREFIX = 'telegram:answer-draft:';

const ANSWER_DRAFT_VIEW_KV_PREFIX = 'telegram:answer-draft-view:';

const AGENT_SKILL_UPDATE_KV_KEY = 'telegram:agent-skill-update:v1';

const AGENT_REQUEST_KV_PREFIX = 'telegram:agent-request:';

const DEFAULT_ACTION_TTL_SECONDS = 30 * 60;

const DEFAULT_GROUP_SESSION_TTL_SECONDS = 30 * 24 * 60 * 60;

const DEFAULT_LIVE_QUESTION_FALLBACK_TIMEOUT_MS = 2500;

const DEFAULT_WORKER_STORAGE_TIMEOUT_MS = 5000;

// Every listed row costs a payload read (a subrequest), so a load lists at
// most 10 pages (1,000 rows) and reports itself incomplete beyond that.
const MAX_WORKER_QUESTION_LIST_PAGES = 10;

const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

const DEFAULT_QUESTION = Object.freeze({
  questionId: 'question-demo-1',
  questionType: 'rating',
  prompt: 'How ready is this group to try agent participation?',
  aggregateCount: 0,
  options: [],
});

function safeAnswerString(value) {
  if (value === undefined || value === null) return '';
  return String(value).trim();
}

function firstAnswerValue(...values) {
  return values.find((value) => safeAnswerString(value) !== '');
}

function bridgeOpenAiApiKey(env = {}) {
  return safeString(
    env.AGENT_BRIDGE_OPENAI_API_KEY || env.AGENT_BRIDGE_OPENAI_KEY || env.OPENAI_API_KEY || env.E2E_OPENAI_KEY,
  );
}

function withBridgeOpenAiApiKey(payload = {}, env = {}) {
  const apiKey = bridgeOpenAiApiKey(env);
  return apiKey ? { ...payload, apiKey } : payload;
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

function shortAddress(value = '') {
  const text = safeString(value);
  return ADDRESS_RE.test(text) ? `${text.slice(0, 6)}...${text.slice(-4)}` : text;
}

function onChainAnswerFromDraft(draft = {}) {
  // Agent preferences store the normalized typed answer as JSON, including
  // comments. Ordinary chat drafts still store the button's plain value.
  if (draft.source === 'agent_handoff') return answerFromStoredDraft(draft);
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

async function readAgentSkillUpdateFlag(env = {}) {
  const kv = env?.AGENT_ACTION_KV;
  if (!kv || typeof kv.get !== 'function') return {};
  const parsed = safeJsonParse(await kv.get(AGENT_SKILL_UPDATE_KV_KEY).catch(() => null), null);
  if (!parsed || typeof parsed !== 'object' || parsed.updateAvailable !== true) return {};
  return {
    updateAvailable: true,
    latestVersion: safeString(parsed.latestVersion).slice(0, 40),
    note: safeString(parsed.note).slice(0, 200),
    updatedAt: safeString(parsed.updatedAt).slice(0, 64),
    updatedBy: safeString(parsed.updatedBy).slice(0, 64),
  };
}

async function writeAgentSkillUpdateFlag({
  env = {},
  latestVersion = '',
  note = '',
  accountAddress = '',
  createdAt = null,
} = {}) {
  const kv = env?.AGENT_ACTION_KV;
  if (!kv || typeof kv.put !== 'function') return { ok: false, reason: 'action_kv_unavailable' };
  const record = {
    version: 1,
    updateAvailable: true,
    latestVersion: safeString(latestVersion).slice(0, 40),
    note: safeString(note).slice(0, 200),
    updatedBy: accountAddress ? shortAddress(accountAddress) : '',
    updatedAt: createdAt || nowIso(),
  };
  assertNoSecretShape(record, "Agent skill-update flag must not serialize secrets.");
  await kv.put(AGENT_SKILL_UPDATE_KV_KEY, JSON.stringify(record));
  return { ok: true, latestVersion: record.latestVersion };
}

async function clearAgentSkillUpdateFlag(env = {}) {
  const kv = env?.AGENT_ACTION_KV;
  if (!kv || typeof kv.delete !== 'function') return { ok: false, reason: 'action_kv_unavailable' };
  await kv.delete(AGENT_SKILL_UPDATE_KV_KEY);
  return { ok: true };
}

function loadDemoQuestions(env = {}) {
  const parsed = safeJsonParse(env.AGENT_BRIDGE_DEMO_QUESTIONS_JSON, null);
  const questions = Array.isArray(parsed) ? parsed : [DEFAULT_QUESTION];
  const normalized = normalizePreloadedQuestionRecords(questions, {
    fallbackSessionSlug: sanitizeSessionSlug(env.AGENT_BRIDGE_DEFAULT_SESSION_SLUG || env.DEFAULT_SESSION_SLUG),
    source: 'demo_fixture',
  });
  assertNoSecretShape(normalized, "Agent demo questions must not serialize secrets.");
  return normalized.length ? normalized : [DEFAULT_QUESTION];
}

function questionPayloadRoot(payload = {}) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
  for (const candidate of [
    payload,
    payload.question,
    payload.questionData,
    payload.metadata,
    payload.data,
  ]) {
    if (candidate && typeof candidate === 'object' && !Array.isArray(candidate)) {
      const hasQuestionShape = candidate.id ||
        candidate.questionId ||
        candidate.prompt ||
        candidate.questionText ||
        candidate.title ||
        candidate.type ||
        candidate.questionType;
      if (hasQuestionShape) return candidate;
    }
  }
  return payload;
}

function normalizePreloadedQuestionRecord(entry = {}, {
  index = 0,
  fallbackSessionSlug = '',
  source = 'telegram_only_preloaded_questions',
} = {}) {
  const root = questionPayloadRoot(entry);
  if (!root) return null;
  const sessionSlug = sanitizeSessionSlug(root.sessionSlug || root.session || entry.sessionSlug || entry.session || fallbackSessionSlug);
  const storageRef = root.storageRef && typeof root.storageRef === 'object' && !Array.isArray(root.storageRef)
    ? root.storageRef
    : (entry.storageRef && typeof entry.storageRef === 'object' && !Array.isArray(entry.storageRef) ? entry.storageRef : null);
  const id = safeString(
    root.questionId ||
    root.id ||
    entry.questionId ||
    entry.id ||
    storageRef?.id ||
      `telegram-only-${sessionSlug || 'session'}-${index + 1}`,
  );
  if (!id) return null;
  const visibility = lower(root.visibility || root.accessMode || entry.visibility || 'public') || 'public';
  const locked = root.locked === true || entry.locked === true || ['private', 'sbt_gated', 'lit_encrypted'].includes(visibility);
  const prompt = locked
    ? ''
    : safeString(root.questionText || root.prompt || root.title || entry.questionText || entry.prompt || entry.title);
  const payloadUnavailable = !locked && !prompt;
  const normalized = {
    ...entry,
    ...root,
    questionId: id,
    questionType: safeString(root.questionType || root.type || entry.questionType || entry.type || 'freeform'),
    type: safeString(root.questionType || root.type || entry.questionType || entry.type || 'freeform'),
    prompt: payloadUnavailable ? '' : prompt,
    questionText: payloadUnavailable ? '' : prompt,
    title: payloadUnavailable
      ? 'Question unavailable'
      : (prompt || (locked ? 'Locked question' : 'Untitled question')),
    options: Array.isArray(root.options)
      ? root.options.slice()
      : (Array.isArray(entry.options) ? entry.options.slice() : []),
    visibility: payloadUnavailable ? 'payload_unavailable' : visibility,
    locked,
    source,
    sessionSlug,
    ...(storageRef ? { storageRef } : {}),
  };
  if (payloadUnavailable) {
    normalized.payloadUnavailable = true;
    normalized.payloadUnavailableReason = 'telegram_only_question_payload_missing_prompt';
  }
  return normalized;
}

function normalizePreloadedQuestionRecords(questions = [], {
  fallbackSessionSlug = '',
  source = 'telegram_only_preloaded_questions',
} = {}) {
  return (Array.isArray(questions) ? questions : [])
    .filter((entry) => entry && typeof entry === 'object')
    .map((entry, index) => normalizePreloadedQuestionRecord(entry, { index, fallbackSessionSlug, source }))
    .filter(Boolean);
}

function workerStorageTimeoutMs(env = {}) {
  const value = Number(env.AGENT_BRIDGE_TELEGRAM_ONLY_STORAGE_TIMEOUT_MS);
  if (Number.isFinite(value) && value >= 1) return Math.floor(value);
  return DEFAULT_WORKER_STORAGE_TIMEOUT_MS;
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

function normalizeQuestionLoadLimit(value = 0) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return 0;
  return Math.floor(parsed);
}

function questionIdLookupSet(values = []) {
  return new Set((Array.isArray(values) ? values : [])
    .map((value) => lower(value))
    .filter(Boolean));
}

function cloudflareQuestionItemIds(item = {}) {
  const storageRef = item?.storageRef && typeof item.storageRef === 'object' && !Array.isArray(item.storageRef)
    ? item.storageRef
    : {};
  return [
    storageRef.id,
    storageRef.questionId,
    item?.metadata?.resourceId,
    item?.id,
    item?.questionId,
    item?.key,
    item?.name,
  ].map(lower).filter(Boolean);
}

function selectWorkerCloudflareQuestionItems(items = [], {
  questionLimit = 0,
  preferredQuestionIds = [],
} = {}) {
  const source = Array.isArray(items) ? items : [];
  const limit = normalizeQuestionLoadLimit(questionLimit);
  if (!limit) return source;
  const preferred = questionIdLookupSet(preferredQuestionIds);
  if (!preferred.size) return source.slice(0, limit);
  const selected = [];
  const selectedIndexes = new Set();
  source.forEach((item, index) => {
    if (cloudflareQuestionItemIds(item).some((id) => preferred.has(id))) {
      selected.push(item);
      selectedIndexes.add(index);
    }
  });
  const targetCount = Math.max(limit, selected.length || 0);
  for (let index = 0; index < source.length && selected.length < targetCount; index += 1) {
    if (selectedIndexes.has(index)) continue;
    selected.push(source[index]);
  }
  return selected;
}

function questionIsPayloadUnavailable(question = {}) {
  return question?.payloadUnavailable === true || lower(question?.visibility) === 'payload_unavailable';
}

function questionIsLocked(question = {}) {
  const visibility = lower(question?.visibility);
  return question?.locked === true || ['private', 'sbt_gated', 'lit_encrypted'].includes(visibility);
}

function questionIsAnswerable(question = {}) {
  return !questionIsPayloadUnavailable(question) && !questionIsLocked(question);
}

function questionTextValueIsString(value) {
  if (value === undefined || value === null) return true;
  return typeof value === 'string';
}

function questionTagsShapeIsValid(value) {
  if (value === undefined) return true;
  if (value === null) return false;
  return Array.isArray(value) || typeof value === 'string';
}

function firstQuestionTextValue(question = {}) {
  if (question.questionText !== undefined && question.questionText !== null) return question.questionText;
  if (question.prompt !== undefined && question.prompt !== null) return question.prompt;
  if (question.title !== undefined && question.title !== null) return question.title;
  return '';
}

function cloudflareQuestionItemHasInlinePayload(item = {}) {
  const root = questionPayloadRoot(item);
  if (!root) return false;
  for (const value of [root.questionText, root.prompt, item?.questionText, item?.prompt]) {
    if (value === undefined || value === null || typeof value !== 'string') continue;
    if (safeString(value)) return true;
  }
  return false;
}

function questionRecordMalformedReason(question = {}) {
  if (!question || typeof question !== 'object' || Array.isArray(question)) return 'record_not_object';
  let qid = '';
  try {
    qid = safeString(question.questionId || question.id);
  } catch {
    return 'question_id_invalid';
  }
  if (!qid) return 'question_id_missing';
  if (!questionTagsShapeIsValid(question.tags)) return 'question_tags_invalid';
  const textValue = firstQuestionTextValue(question);
  if (!questionTextValueIsString(textValue)) return 'question_prompt_invalid';
  let locked = false;
  let unavailable = false;
  try {
    locked = questionIsLocked(question);
    unavailable = questionIsPayloadUnavailable(question);
  } catch {
    return 'question_visibility_invalid';
  }
  if (!locked && !unavailable) {
    let prompt = '';
    try {
      prompt = safeString(textValue);
    } catch {
      return 'question_prompt_invalid';
    }
    if (!prompt) return 'question_prompt_missing';
  }
  return '';
}

function orderQuestionsForPresentationWithSummary(questions = []) {
  const rows = [];
  let skippedMalformed = 0;
  (Array.isArray(questions) ? questions : []).forEach((question, index) => {
    try {
      if (questionRecordMalformedReason(question)) {
        skippedMalformed += 1;
        return;
      }
      rows.push({ question, index });
    } catch {
      skippedMalformed += 1;
    }
  });
  rows.sort((left, right) => {
    let leftRank = 2;
    let rightRank = 2;
    try {
      leftRank = questionPresentationRank(left.question);
    } catch {
      leftRank = 2;
    }
    try {
      rightRank = questionPresentationRank(right.question);
    } catch {
      rightRank = 2;
    }
    return leftRank - rightRank || left.index - right.index;
  });
  return {
    questions: rows.map(({ question }) => question),
    skippedMalformed,
  };
}

function questionAvailabilitySummary(questions = []) {
  const entries = Array.isArray(questions) ? questions : [];
  let skippedMalformed = 0;
  let answerable = false;
  let unavailableCount = 0;
  entries.forEach((question) => {
    try {
      if (questionRecordMalformedReason(question)) {
        skippedMalformed += 1;
        return;
      }
      if (questionIsAnswerable(question)) answerable = true;
      if (questionIsPayloadUnavailable(question)) unavailableCount += 1;
    } catch {
      skippedMalformed += 1;
    }
  });
  const validCount = Math.max(0, entries.length - skippedMalformed);
  return {
    hasAnswerableQuestions: answerable,
    allPayloadUnavailable: validCount > 0 && unavailableCount === validCount,
    skippedMalformed,
  };
}

function withSkippedMalformed(result = {}, skippedMalformed = 0) {
  const count = Number(skippedMalformed || 0) || 0;
  if (count <= 0) return result;
  return {
    ...result,
    skippedMalformed: (Number(result.skippedMalformed || 0) || 0) + count,
  };
}

function questionPresentationRank(question = {}) {
  if (questionIsPayloadUnavailable(question)) return 2;
  if (questionIsLocked(question)) return 1;
  return 0;
}

function orderQuestionsForPresentation(questions = []) {
  return orderQuestionsForPresentationWithSummary(questions).questions;
}

async function withAgentProposedQuestions(env = {}, sessionSlug = '', result = {}) {
  const proposedSummary = await listAgentProposedQuestionsForSessionWithSummary(env, sessionSlug)
    .catch(() => ({ questions: [], skippedMalformed: 1 }));
  const proposed = Array.isArray(proposedSummary.questions) ? proposedSummary.questions : [];
  const baseSummary = orderQuestionsForPresentationWithSummary(result.questions || []);
  const skippedMalformed = (Number(proposedSummary.skippedMalformed || 0) || 0) + baseSummary.skippedMalformed;
  if (!proposed.length) {
    if (skippedMalformed <= 0) return result;
    return withSkippedMalformed({
      ...result,
      questions: baseSummary.questions,
      questionCount: baseSummary.questions.length,
    }, skippedMalformed);
  }
  const mergedSummary = orderQuestionsForPresentationWithSummary(mergeAgentProposedQuestions(baseSummary.questions, proposed));
  const questions = mergedSummary.questions;
  return {
    ...withSkippedMalformed(result, skippedMalformed + mergedSummary.skippedMalformed),
    ok: result.ok !== false || questions.length > 0,
    reason: result.ok === false && questions.length > 0
      ? 'proposed_questions_loaded_with_source_warning'
      : result.reason,
    questions,
    questionCount: questions.length,
    proposedQuestionCount: proposed.length,
  };
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

function liveQuestionFallbackTimeoutMs(env = {}) {
  const value = Number(env.AGENT_BRIDGE_QUESTION_LIVE_FALLBACK_TIMEOUT_MS);
  if (Number.isFinite(value) && value >= 1) return Math.floor(value);
  return DEFAULT_LIVE_QUESTION_FALLBACK_TIMEOUT_MS;
}

function sessionStorageProfile(session = {}) {
  return session?.storageProfile && typeof session.storageProfile === 'object' && !Array.isArray(session.storageProfile)
    ? session.storageProfile
    : {};
}

function sessionStorageConfig(session = {}) {
  return session?.storage && typeof session.storage === 'object' && !Array.isArray(session.storage)
    ? session.storage
    : {};
}

function sessionUsesCloudflareQuestionStorage(session = {}) {
  const storageProfile = sessionStorageProfile(session);
  const storage = sessionStorageConfig(session);
  const profiles = storage.profiles && typeof storage.profiles === 'object' && !Array.isArray(storage.profiles)
    ? storage.profiles
    : {};
  const cloudflareProfile = profiles.cloudflare && typeof profiles.cloudflare === 'object' && !Array.isArray(profiles.cloudflare)
    ? profiles.cloudflare
    : {};
  const backend = lower(
    storageProfile.backend ||
    storageProfile.defaultBackend ||
    storage.defaultBackend ||
    session.questionStorageBackend ||
      session.storageBackend,
  );
  const source = lower(session.questionSource || session.telegramQuestionSource);
  const artifactTypes = Array.isArray(cloudflareProfile.artifactTypes)
    ? cloudflareProfile.artifactTypes.map(lower)
    : [];
  return backend === 'cloudflare' ||
    source === 'cloudflare_storage' ||
    source === 'cloudflare' ||
    (cloudflareProfile.enabled === true && (
      lower(storage.defaultBackend) === 'cloudflare' ||
      artifactTypes.includes('questions')
    ));
}

function sessionUsesExplicitOnchainQuestionMode(session = {}) {
  const values = [
    session.sessionMode,
    session.questionSource,
    session.telegramQuestionSource,
    session.questionRuntime,
    session.backendMode,
    session.backend,
  ].map(lower).filter(Boolean);
  return values.some((value) => [
    'onchain',
    'on_chain',
    'chain',
    'web3',
    'registry',
    'session_registry',
    'contract',
    'contracts',
  ].includes(value));
}

function sessionUsesWorkerBackedQuestions(session = {}) {
  if (!session || typeof session !== 'object') return false;
  // Explicit authority selects the question store even when legacy transport flags disagree.
  const authorityMode = lower(session.sessionModeProfile?.authority?.mode);
  if (authorityMode === 'worker_canonical') return true;
  if (authorityMode === 'registry_canonical') return false;
  const mode = lower(session.sessionMode || session.backendMode || session.backend);
  if (session.telegramOnly === true || mode === 'telegram_only' || mode === 'telegram-only' || mode === 'telegram') {
    return true;
  }
  if (sessionUsesExplicitOnchainQuestionMode(session)) return false;
  return sessionUsesCloudflareQuestionStorage(session);
}

async function buildWorkerStorageAuth({
  env = {},
  session = {},
  fetchImpl = env.QUESTION_FETCH || env.REGISTRY_FETCH || globalThis.fetch,
} = {}) {
  const sessionSlug = sanitizeSessionSlug(session.sessionSlug || session.slug || env.AGENT_BRIDGE_DEFAULT_SESSION_SLUG || env.DEFAULT_SESSION_SLUG);
  const workerUrl = resolveSessionWorkerUrl(env, session);
  if (!workerUrl || !sessionSlug) return { ok: false, reason: 'session_worker_url_missing' };
  const principal = {
    telegramUserId: `telegram-only-question-reader:${sessionSlug}`,
    username: 'telegram-only-question-reader',
  };
  const account = await deriveManagedDemoAccount({
    principal,
    deploymentId: env.AGENT_BRIDGE_DEPLOYMENT_ID || 'agent-bridge-live-demo',
    rootSecret: env.DEMO_SIGNER_ROOT_SECRET || '',
  });
  return authenticateSessionWorker({
    env,
    session: { ...session, sessionSlug },
    account,
    principal,
    workerUrl,
    fetchImpl,
  });
}

async function fetchWorkerCloudflareJson({
  auth = {},
  path = '',
  env = {},
  fetchImpl = env.QUESTION_FETCH || env.REGISTRY_FETCH || globalThis.fetch,
} = {}) {
  if (!auth?.ok || !auth.workerUrl || !auth.token || !path || typeof fetchImpl !== 'function') {
    return { ok: false, reason: 'telegram_only_cloudflare_auth_unavailable' };
  }
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(new Error('Worker-authoritative question storage timed out')),
    workerStorageTimeoutMs(env),
  );
  try {
    const response = await fetchImpl(`${auth.workerUrl}${path}`, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        accept: 'application/json',
        Origin: publicBridgeBaseUrl(env) || 'http://localhost:7391',
        Authorization: `Bearer ${auth.token}`,
      },
    });
    const body = await response.json().catch(() => null);
    if (!response?.ok) {
      return {
        ok: false,
        reason: 'telegram_only_cloudflare_request_failed',
        status: response?.status || 0,
        error: safeString(body?.error || body?.reason || ''),
      };
    }
    return { ok: true, body };
  } catch (error) {
    return {
      ok: false,
      reason: 'telegram_only_cloudflare_request_failed',
      error: safeString(error?.message || error),
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function loadWorkerCloudflareQuestions({
  env = {},
  session = {},
  questionLimit = 0,
  preferredQuestionIds = [],
  fetchImpl = env.QUESTION_FETCH || env.REGISTRY_FETCH || globalThis.fetch,
} = {}) {
  const sessionSlug = sanitizeSessionSlug(session.sessionSlug || session.slug);
  let auth = null;
  try {
    auth = await buildWorkerStorageAuth({ env, session, fetchImpl });
  } catch (error) {
    return {
      ok: false,
      reason: 'telegram_only_cloudflare_questions_list_failed',
      authReason: 'session_worker_auth_failed',
      error: safeString(error?.message || error),
      questions: [],
    };
  }
  if (!auth?.ok) {
    return {
      ok: false,
      reason: 'telegram_only_cloudflare_questions_list_failed',
      authReason: safeString(auth?.reason),
      questions: [],
    };
  }
  const items = [];
  const seenCursors = new Set();
  let cursor = '';
  let listComplete = false;
  for (let page = 0; page < MAX_WORKER_QUESTION_LIST_PAGES && !listComplete; page += 1) {
    const query = new URLSearchParams({ resource: 'questions', limit: '100', ...(cursor ? { cursor } : {}) });
    const listed = await fetchWorkerCloudflareJson({
      auth,
      path: `/storage/list?${query}`,
      env,
      fetchImpl,
    });
    if (!listed.ok) {
      return {
        ok: false,
        reason: 'telegram_only_cloudflare_questions_list_failed',
        error: listed.error,
        status: listed.status || 0,
        questions: [],
      };
    }
    if (Array.isArray(listed.body?.items)) items.push(...listed.body.items);
    cursor = safeString(listed.body?.cursor);
    // A filtered page can be empty and still continue. Workers that predate
    // pagination send neither field and list everything at once.
    listComplete = listed.body?.listComplete === true || (listed.body?.listComplete === undefined && !cursor);
    if (!listComplete && (!cursor || seenCursors.has(cursor))) {
      return {
        ok: false,
        reason: 'telegram_only_cloudflare_questions_list_failed',
        error: 'Worker question list cursor is missing or repeated.',
        questions: [],
      };
    }
    seenCursors.add(cursor);
  }
  const selectedItems = selectWorkerCloudflareQuestionItems(items, {
    questionLimit,
    preferredQuestionIds,
  });
  const questions = [];
  const readErrors = [];
  const readResults = await Promise.all(selectedItems.map(async (item, index) => {
    const storageRef = item?.storageRef && typeof item.storageRef === 'object' && !Array.isArray(item.storageRef)
      ? item.storageRef
      : {};
    const id = safeString(storageRef.id || item?.id);
    if (!id) return null;
    if (cloudflareQuestionItemHasInlinePayload(item)) {
      const normalized = normalizePreloadedQuestionRecord(
        {
          ...(item && typeof item === 'object' && !Array.isArray(item) ? item : {}),
          storageRef,
        },
        {
          index,
          fallbackSessionSlug: sessionSlug,
          source: 'telegram_only_cloudflare_questions',
          },
      );
      if (normalized && !questionIsPayloadUnavailable(normalized) && !questionRecordMalformedReason(normalized)) {
        return { question: normalized };
      }
    }
    const read = await fetchWorkerCloudflareJson({
      auth,
      path: `/storage/read?id=${encodeURIComponent(id)}`,
      env,
      fetchImpl,
    });
    if (!read.ok) {
      return { error: { id, reason: read.reason, status: read.status || 0, error: read.error || '' } };
    }
    const normalized = normalizePreloadedQuestionRecord(
      {
        ...(read.body && typeof read.body === 'object' && !Array.isArray(read.body) ? read.body : {}),
        storageRef,
      },
      {
        index,
        fallbackSessionSlug: sessionSlug,
        source: 'telegram_only_cloudflare_questions',
        },
    );
    return normalized ? { question: normalized } : null;
  }));
  readResults.forEach((result) => {
    if (result?.question) questions.push(result.question);
    if (result?.error) readErrors.push(result.error);
  });
  return {
    ok: readErrors.length === 0 || questions.length > 0,
    reason: readErrors.length && questions.length === 0
      ? 'telegram_only_cloudflare_questions_read_failed'
      : (questions.length ? 'telegram_only_cloudflare_questions_loaded' : 'telegram_only_cloudflare_questions_empty'),
    source: 'telegram_only_cloudflare_storage',
    questions,
    questionCount: questions.length,
    complete: listComplete && selectedItems.length >= items.length && readErrors.length === 0,
    loadedCount: questions.length,
    discoveredCount: items.length,
    payloadFailureCount: readErrors.length,
    readErrors,
  };
}

async function loadWorkerQuestionsForSession(env = {}, sessionSlug = '', {
  questionLimit = 0,
  preferredQuestionIds = [],
} = {}) {
  const policy = await loadSessionPolicy(env);
  const resolved = resolveSessionInvocation(policy, sessionSlug);
  if (!resolved.ok || !sessionUsesWorkerBackedQuestions(resolved.session)) return null;
  const session = resolved.session;
  const inlineQuestions = normalizePreloadedQuestionRecords(session.questions, {
    fallbackSessionSlug: session.sessionSlug,
    source: 'telegram_only_policy_questions',
  });
  if (inlineQuestions.length) {
    return {
      ok: true,
      reason: 'telegram_only_policy_questions_loaded',
      source: 'telegram_only_policy',
      questions: orderQuestionsForPresentation(inlineQuestions),
      questionCount: inlineQuestions.length,
      discoveredCount: inlineQuestions.length,
    };
  }
  if (!sessionUsesCloudflareQuestionStorage(session)) {
    return {
      ok: true,
      reason: 'telegram_only_questions_empty',
      source: 'telegram_only_policy',
      questions: [],
      questionCount: 0,
      discoveredCount: 0,
    };
  }
  const cloudflare = await loadWorkerCloudflareQuestions({
    env,
    session,
    questionLimit,
    preferredQuestionIds,
  });
  return {
    ...cloudflare,
    questions: orderQuestionsForPresentation(cloudflare.questions || []),
  };
}

async function loadQuestionsForSession(env = {}, sessionSlug = '', {
  waitUntil = null,
  questionLimit = 0,
  preferredQuestionIds = [],
} = {}) {
  const mode = questionSourceMode(env);
  if (mode === 'fixture') {
    return withAgentProposedQuestions(env, sessionSlug, {
      ok: true,
      reason: 'fixture_questions_loaded',
      source: 'demo_fixture',
      questions: orderQuestionsForPresentation(filterQuestionsForSession(loadDemoQuestions(env), sessionSlug)),
    });
  }
  const telegramOnly = await loadWorkerQuestionsForSession(env, sessionSlug, {
    questionLimit,
    preferredQuestionIds,
  });
  if (telegramOnly) return withAgentProposedQuestions(env, sessionSlug, telegramOnly);
  const livePromise = listCachedSessionQuestionsForBridge({
    env,
    sessionSlug,
    waitUntil,
    questionLimit,
  }).catch((error) => ({
    ok: false,
    reason: 'live_question_cache_failed',
    error: safeString(error?.message || error),
    questions: [],
  }));
  const fallbackAllowed = allowDemoQuestionFallback(env);
  let live = null;
  if (fallbackAllowed) {
    let timeout = null;
    live = await Promise.race([
      livePromise,
      new Promise((resolve) => {
        timeout = setTimeout(() => resolve({
          ok: false,
          reason: 'live_question_cache_timeout',
          timedOut: true,
          questions: [],
        }), liveQuestionFallbackTimeoutMs(env));
      }),
    ]).finally(() => clearTimeout(timeout));
    if (live?.timedOut && typeof waitUntil === 'function') {
      waitUntil(livePromise.catch(() => null));
    }
  } else {
    live = await livePromise;
  }
  const liveQuestionSummary = orderQuestionsForPresentationWithSummary(Array.isArray(live.questions) ? live.questions : []);
  const liveQuestions = liveQuestionSummary.questions;
  const availability = questionAvailabilitySummary(liveQuestions);
  const liveHasAnswerableQuestions = availability.hasAnswerableQuestions;
  const liveOnlyUnavailablePayloads = availability.allPayloadUnavailable;
  const liveMalformedCount = liveQuestionSummary.skippedMalformed + availability.skippedMalformed;
  if (live?.timedOut || liveOnlyUnavailablePayloads) {
    return withAgentProposedQuestions(env, sessionSlug, {
      ...live,
      source: live.source || 'telegram_worker_question_cache',
      questions: liveQuestions,
    }).then((result) => withSkippedMalformed(result, liveMalformedCount));
  }
  if (
    (live.ok && liveQuestions.length && (liveHasAnswerableQuestions || !fallbackAllowed || !liveOnlyUnavailablePayloads)) ||
    !fallbackAllowed
  ) {
    return withAgentProposedQuestions(env, sessionSlug, {
      ...live,
      source: live.source || 'telegram_worker_question_cache',
      questions: liveQuestions,
    }).then((result) => withSkippedMalformed(result, liveMalformedCount));
  }
  return withAgentProposedQuestions(env, sessionSlug, {
    ok: true,
    reason: 'fixture_questions_fallback',
    source: 'demo_fixture',
    fallbackFrom: live.reason || (liveOnlyUnavailablePayloads ? 'live_questions_payload_unavailable' : 'live_question_cache_unavailable'),
    questions: orderQuestionsForPresentation(filterQuestionsForSession(loadDemoQuestions(env), sessionSlug)),
  }).then((result) => withSkippedMalformed(result, liveMalformedCount));
}

async function persistActionRecord(env = {}, actionId = '', record = {}, {
  ttlSeconds = DEFAULT_ACTION_TTL_SECONDS,
} = {}) {
  const id = safeString(actionId);
  if (!id || !env?.AGENT_ACTION_KV || typeof env.AGENT_ACTION_KV.put !== 'function') {
    return { ok: false, reason: 'action_kv_unavailable' };
  }
  assertNoSecretShape(record, "Agent action records must not serialize secrets.");
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
  assertNoSecretShape(parsed, "Agent action records must not serialize secrets.");
  return parsed;
}

function groupSessionBindingKey(normalized = {}) {
  const chatId = safeString(normalized.chat?.chatId);
  return chatId ? `${GROUP_SESSION_KV_PREFIX}${chatId}` : '';
}

async function readGroupSessionBinding(env = {}, normalized = {}) {
  if (normalized.chat?.isPrivate) return null;
  const key = groupSessionBindingKey(normalized);
  if (!key || !env?.AGENT_ACTION_KV || typeof env.AGENT_ACTION_KV.get !== 'function') return null;
  const parsed = safeJsonParse(await env.AGENT_ACTION_KV.get(key).catch(() => null), null);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
  assertNoSecretShape(parsed, "Agent group session bindings must not serialize secrets.");
  const sessionSlug = sanitizeSessionSlug(parsed.sessionSlug);
  return sessionSlug ? { ...parsed, sessionSlug } : null;
}

function privateSessionBindingKey(normalized = {}) {
  const telegramUserId = safeString(normalized.user?.telegramUserId);
  return telegramUserId ? `${PRIVATE_SESSION_KV_PREFIX}${telegramUserId}` : '';
}

async function readPrivateSessionBinding(env = {}, normalized = {}) {
  if (!normalized.chat?.isPrivate) return null;
  const key = privateSessionBindingKey(normalized);
  if (!key || !env?.AGENT_ACTION_KV || typeof env.AGENT_ACTION_KV.get !== 'function') return null;
  const parsed = safeJsonParse(await env.AGENT_ACTION_KV.get(key).catch(() => null), null);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
  assertNoSecretShape(parsed, "Agent private session bindings must not serialize secrets.");
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

function answerDraftViewKey({
  normalized = {},
  sessionSlug = '',
  questionId: selectedQuestionId = '',
} = {}) {
  const telegramUserId = safeString(normalized.user?.telegramUserId);
  const slug = sanitizeSessionSlug(sessionSlug);
  const qid = questionIdSeedPart(selectedQuestionId || 'question');
  return telegramUserId && slug && qid
    ? `${ANSWER_DRAFT_VIEW_KV_PREFIX}${telegramUserId}:${slug}:${qid}`
    : '';
}

function answerDraftFingerprint(record = {}) {
  return stableFingerprint({
    answerLabel: safeString(record.answerLabel),
    answerValue: safeString(record.answerValue),
    controlType: safeString(record.controlType),
  });
}

function answerDraftOrigin(record = null) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) return null;
  const origin = record.origin && typeof record.origin === 'object' && !Array.isArray(record.origin)
    ? record.origin
    : null;
  if (origin) {
    return {
      source: safeString(origin.source) || null,
      agentMetadata: origin.agentMetadata && typeof origin.agentMetadata === 'object' && !Array.isArray(origin.agentMetadata)
        ? origin.agentMetadata
        : null,
      answerLabel: safeString(origin.answerLabel),
      answerValue: safeString(origin.answerValue),
      controlType: safeString(origin.controlType),
      fingerprint: safeString(origin.fingerprint) || answerDraftFingerprint(origin),
      savedAt: safeString(origin.savedAt) || null,
    };
  }
  return {
    source: safeString(record.source) || null,
    agentMetadata: record.agentMetadata && typeof record.agentMetadata === 'object' && !Array.isArray(record.agentMetadata)
      ? record.agentMetadata
      : null,
    answerLabel: safeString(record.answerLabel),
    answerValue: safeString(record.answerValue),
    controlType: safeString(record.controlType),
    fingerprint: safeString(record.fingerprint) || answerDraftFingerprint(record),
    savedAt: safeString(record.selectedAt) || null,
  };
}

async function analyticsPrincipalFingerprint(env = {}, telegramUserId = '') {
  const salt = safeString(env?.AGENT_BRIDGE_ANALYTICS_SALT);
  const id = safeString(telegramUserId);
  const subtle = globalThis.crypto?.subtle;
  if (!salt || !id || !subtle) return '';
  const encoder = new TextEncoder();
  const key = await subtle.importKey(
    'raw',
    encoder.encode(salt),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await subtle.sign('HMAC', key, encoder.encode(id));
  return Array.from(new Uint8Array(signature)).slice(0, 12)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

async function writeDraftLifecycleEvent(env = {}, {
  event = '',
  sessionSlug = '',
  questionId = '',
  source = '',
  originSource = '',
  controlType = '',
  editCount = 0,
  draftToSubmitMs = null,
  telegramUserId = '',
} = {}) {
  try {
    const dataset = env?.AGENT_BRIDGE_ANALYTICS;
    if (!dataset || typeof dataset.writeDataPoint !== 'function') return false;
    const slug = sanitizeSessionSlug(sessionSlug);
    const principalFingerprint = await analyticsPrincipalFingerprint(env, telegramUserId);
    dataset.writeDataPoint({
      blobs: [
        safeString(event).slice(0, 64),
        slug.slice(0, 256),
        safeString(questionId).slice(0, 256),
        safeString(source).slice(0, 64),
        safeString(originSource).slice(0, 64),
        safeString(controlType).slice(0, 64),
        principalFingerprint,
      ],
      doubles: [
        Number(editCount) || 0,
        Number.isFinite(Number(draftToSubmitMs)) && draftToSubmitMs !== null ? Number(draftToSubmitMs) : -1,
      ],
      indexes: [slug.slice(0, 96)],
    });
    return true;
  } catch {
    return false;
  }
}

const CANONICAL_ANSWER_KINDS = Object.freeze({
  quadratic: 'quadratic',
  quadratic_allocation: 'quadratic',
  binary: 'binary',
  agree_unsure_disagree: 'binary',
  rating: 'rating',
  rating_button: 'rating',
  multichoice: 'multichoice',
  multi_select_toggle: 'multichoice',
  single_select: 'multichoice',
  freeform: 'freeform',
  freeform_text: 'freeform',
});

function canonicalDraftAnswerForm(record = {}) {
  const raw = safeString(record.answerValue);
  const parsed = safeJsonParse(raw, null);
  const source = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  const type = CANONICAL_ANSWER_KINDS[lower(safeString(source?.questionType))] ||
    CANONICAL_ANSWER_KINDS[lower(safeString(record.controlType))] ||
    'unknown';
  const text = safeString(source ? (source.text ?? source.value ?? '') : raw);
  const comments = safeString(source?.comments);
  if (type === 'binary') {
    return { type, value: lower(safeString(source?.value) || text), comments };
  }
  if (type === 'rating') {
    const candidate = source?.value ?? (text === '' ? null : text);
    const value = candidate === null || candidate === undefined || candidate === ''
      ? NaN
      : Number(candidate);
    return { type, value: Number.isFinite(value) ? value : null, comments };
  }
  if (type === 'quadratic') {
    return { type, value: Array.isArray(source?.value) ? source.value : null, comments };
  }
  if (type === 'multichoice') {
    const values = Array.isArray(source?.values)
      ? source.values.map(safeString).filter(Boolean)
      : (text ? [text] : []);
    return { type, values: [...new Set(values)].sort(), comments };
  }
  return { type, text, comments };
}

function answerDraftSemanticFingerprint(record = {}) {
  return stableFingerprint(canonicalDraftAnswerForm(record));
}

function buildDraftDelta(origin = null, finalAnswer = null) {
  if (!origin || !finalAnswer) return null;
  const before = canonicalDraftAnswerForm(origin);
  const after = canonicalDraftAnswerForm(finalAnswer);
  const changed = stableFingerprint(before) !== stableFingerprint(after);
  const kind = after.type !== 'unknown' ? after.type : before.type;
  const delta = { kind, changed };
  if (kind === 'binary') {
    delta.stanceBefore = safeString(before.value);
    delta.stanceAfter = safeString(after.value);
    delta.stanceChanged = delta.stanceBefore !== delta.stanceAfter;
  } else if (kind === 'rating') {
    delta.ratingBefore = Number.isFinite(before.value) ? before.value : null;
    delta.ratingAfter = Number.isFinite(after.value) ? after.value : null;
    delta.ratingShift = delta.ratingBefore !== null && delta.ratingAfter !== null
      ? delta.ratingAfter - delta.ratingBefore
      : null;
  } else if (kind === 'quadratic') {
    const valuesBefore = Array.isArray(before.value) ? before.value : [];
    const valuesAfter = Array.isArray(after.value) ? after.value : [];
    delta.changedOptionCount = Array.from({ length: Math.max(valuesBefore.length, valuesAfter.length) },
      (_, index) => valuesBefore[index] !== valuesAfter[index]).filter(Boolean).length;
  } else if (kind === 'multichoice') {
    const valuesBefore = Array.isArray(before.values) ? before.values : [];
    const valuesAfter = Array.isArray(after.values) ? after.values : [];
    delta.addedValues = valuesAfter.filter((value) => !valuesBefore.includes(value));
    delta.removedValues = valuesBefore.filter((value) => !valuesAfter.includes(value));
  } else {
    const textBefore = safeString(before.text);
    const textAfter = safeString(after.text);
    delta.lengthBefore = textBefore.length;
    delta.lengthAfter = textAfter.length;
    delta.lengthDelta = textAfter.length - textBefore.length;
    delta.textChanged = textBefore !== textAfter;
  }
  const commentsBefore = safeString(before.comments);
  const commentsAfter = safeString(after.comments);
  if (commentsBefore || commentsAfter) delta.commentsChanged = commentsBefore !== commentsAfter;
  return delta;
}

function buildDraftProvenance({
  draft = null,
  submittedAt = '',
  firstViewedAt = '',
} = {}) {
  if (!draft || typeof draft !== 'object' || Array.isArray(draft)) return null;
  const origin = draft.origin && typeof draft.origin === 'object' && !Array.isArray(draft.origin)
    ? answerDraftOrigin(draft)
    : null;
  const finalAnswer = {
    answerLabel: safeString(draft.answerLabel),
    answerValue: safeString(draft.answerValue),
    controlType: safeString(draft.controlType),
  };
  const finalFingerprint = safeString(draft.fingerprint) || answerDraftFingerprint(draft);
  const finalSemanticFingerprint = safeString(draft.semanticFingerprint) ||
    answerDraftSemanticFingerprint(draft);
  const originSemanticFingerprint = origin ? answerDraftSemanticFingerprint(origin) : '';
  const agentDrafted = safeString(origin?.source) === 'agent_handoff';
  const editedFromOrigin = origin ? originSemanticFingerprint !== finalSemanticFingerprint : null;
  const storedAgentRevision = draft.agentRevision &&
    typeof draft.agentRevision === 'object' && !Array.isArray(draft.agentRevision)
    ? draft.agentRevision
    : null;
  const agentRevision = storedAgentRevision ||
    (agentDrafted ? { semanticFingerprint: originSemanticFingerprint, savedAt: origin?.savedAt || null } : null);
  const submitted = safeString(submittedAt);
  const originSavedAtMs = origin?.savedAt ? Date.parse(origin.savedAt) : NaN;
  const submittedAtMs = submitted ? Date.parse(submitted) : NaN;
  const viewed = safeString(firstViewedAt);
  const viewedAtMs = viewed ? Date.parse(viewed) : NaN;
  const validFirstViewedAt = viewed && (
    !Number.isFinite(originSavedAtMs) ||
    (Number.isFinite(viewedAtMs) && viewedAtMs >= originSavedAtMs)
  ) ? viewed : '';
  return {
    version: 1,
    source: safeString(draft.source) || null,
    origin,
    finalAnswer,
    finalFingerprint,
    finalSemanticFingerprint,
    originSemanticFingerprint: originSemanticFingerprint || null,
    editCount: Number(draft.editCount || 0),
    humanEditCount: Number(draft.humanEditCount || 0),
    lastEditSource: safeString(draft.lastEditSource) || null,
    draftSavedAt: safeString(draft.selectedAt) || null,
    lastEditedAt: safeString(draft.lastEditedAt) || null,
    firstViewedAt: validFirstViewedAt || null,
    submittedAt: submitted || null,
    agentDrafted,
    agentRevisionSavedAt: safeString(agentRevision?.savedAt) || null,
    editedFromOrigin,
    editedFromAgentDraft: agentRevision
      ? safeString(agentRevision.semanticFingerprint) !== finalSemanticFingerprint
      : false,
    draftToSubmitMs: Number.isFinite(originSavedAtMs) && Number.isFinite(submittedAtMs) && submittedAtMs >= originSavedAtMs
      ? submittedAtMs - originSavedAtMs
      : null,
    delta: buildDraftDelta(origin, finalAnswer),
  };
}

async function markAnswerDraftViewed({
  env = {},
  normalized = {},
  sessionSlug = '',
  selectedQuestionId = '',
  viewedAt = null,
} = {}) {
  const key = answerDraftViewKey({ normalized, sessionSlug, questionId: selectedQuestionId });
  const kv = env?.AGENT_ACTION_KV;
  if (!key || !kv || typeof kv.get !== 'function' || typeof kv.put !== 'function') {
    return { ok: false, reason: 'action_kv_unavailable' };
  }
  const existing = safeJsonParse(await kv.get(key).catch(() => null), null);
  const existingViewedAt = existing && typeof existing === 'object' && !Array.isArray(existing)
    ? safeString(existing.firstViewedAt)
    : '';
  if (existingViewedAt) {
    return { ok: true, key, firstViewedAt: existingViewedAt, alreadyViewed: true };
  }
  const record = { version: 1, firstViewedAt: safeString(viewedAt) || nowIso() };
  await kv.put(key, JSON.stringify(record), {
    expirationTtl: DEFAULT_GROUP_SESSION_TTL_SECONDS,
  });
  return { ok: true, key, firstViewedAt: record.firstViewedAt, alreadyViewed: false };
}

async function readAnswerDraftFirstViewedAt({
  env = {},
  normalized = {},
  sessionSlug = '',
  selectedQuestionId = '',
} = {}) {
  const key = answerDraftViewKey({ normalized, sessionSlug, questionId: selectedQuestionId });
  const kv = env?.AGENT_ACTION_KV;
  if (!key || !kv || typeof kv.get !== 'function') return '';
  const parsed = safeJsonParse(await kv.get(key).catch(() => null), null);
  return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
    ? safeString(parsed.firstViewedAt)
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
  assertNoSecretShape(parsed, "Agent answer drafts must not serialize secrets.");
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
  const viewKey = answerDraftViewKey({ normalized, sessionSlug, questionId: selectedQuestionId });
  const existing = typeof env.AGENT_ACTION_KV.get === 'function'
    ? safeJsonParse(await env.AGENT_ACTION_KV.get(key).catch(() => null), null)
    : null;
  await env.AGENT_ACTION_KV.delete(key);
  if (viewKey) await env.AGENT_ACTION_KV.delete(viewKey).catch(() => null);
  if (existing && typeof existing === 'object' && !Array.isArray(existing)) {
    await writeDraftLifecycleEvent(env, {
      event: 'draft_discarded',
      sessionSlug: safeString(existing.sessionSlug) || sanitizeSessionSlug(sessionSlug),
      questionId: safeString(existing.questionId) || safeString(selectedQuestionId),
      source: safeString(existing.source),
      originSource: safeString(existing.origin?.source),
      controlType: safeString(existing.controlType),
      editCount: Number(existing.editCount || 0),
      telegramUserId: safeString(existing.telegramUserId),
    });
  }
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
  ratingScale = null,
  submitLane = LEGACY_TRANSPORT_LANES.PRIVATE_ACCOUNT,
  metadata = null,
  agentMetadata = null,
  createdAt = null,
} = {}) {
  const key = answerDraftKey({ normalized, sessionSlug, questionId: selectedQuestionId });
  if (!key || !env?.AGENT_ACTION_KV || typeof env.AGENT_ACTION_KV.put !== 'function') {
    return { ok: false, reason: 'action_kv_unavailable' };
  }
  const existing = typeof env.AGENT_ACTION_KV.get === 'function'
    ? safeJsonParse(await env.AGENT_ACTION_KV.get(key).catch(() => null), null)
    : null;
  const previous = existing && typeof existing === 'object' && !Array.isArray(existing) ? existing : null;
  const savedAt = createdAt || nowIso();
  const record = {
    version: 2,
    telegramUserId: safeString(normalized.user?.telegramUserId),
    chatId: safeString(normalized.chat?.chatId),
    sessionSlug: sanitizeSessionSlug(sessionSlug),
    questionId: safeString(selectedQuestionId),
    answerLabel: safeString(answerLabel),
    answerValue: safeString(answerValue || answerLabel),
    controlType: safeString(controlType),
    ...(ratingScale ? { ratingScale } : {}),
    status: 'draft_saved',
    submitLane: safeString(submitLane) || LEGACY_TRANSPORT_LANES.PRIVATE_ACCOUNT,
    selectedAt: savedAt,
  };
  if (metadata && typeof metadata === 'object' && !Array.isArray(metadata)) {
    record.source = safeString(metadata.source) || null;
    record.actionMetadata = { ...metadata };
  }
  if (agentMetadata && typeof agentMetadata === 'object' && !Array.isArray(agentMetadata)) {
    record.agentMetadata = { ...agentMetadata };
  }
  if (!record.telegramUserId || !record.sessionSlug || !record.questionId || !record.answerLabel) {
    return { ok: false, reason: 'answer_draft_incomplete' };
  }
  record.fingerprint = answerDraftFingerprint(record);
  record.semanticFingerprint = answerDraftSemanticFingerprint(record);
  record.origin = answerDraftOrigin(previous) || {
    source: record.source || null,
    agentMetadata: record.agentMetadata || null,
    answerLabel: record.answerLabel,
    answerValue: record.answerValue,
    controlType: record.controlType,
    fingerprint: record.fingerprint,
    savedAt,
  };
  const previousSemanticFingerprint = previous
    ? (safeString(previous.semanticFingerprint) || answerDraftSemanticFingerprint(previous))
    : '';
  const contentChanged = Boolean(previous) && previousSemanticFingerprint !== record.semanticFingerprint;
  const isAgentWrite = record.source === 'agent_handoff';
  record.editCount = Number(previous?.editCount || 0) + (contentChanged ? 1 : 0);
  record.lastEditedAt = contentChanged ? savedAt : (safeString(previous?.lastEditedAt) || null);
  record.humanEditCount = Number(previous?.humanEditCount || 0) +
    (contentChanged && !isAgentWrite ? 1 : 0);
  record.lastEditSource = contentChanged
    ? (record.source || null)
    : (safeString(previous?.lastEditSource) || null);
  const previousAgentRevision = previous?.agentRevision &&
    typeof previous.agentRevision === 'object' && !Array.isArray(previous.agentRevision)
    ? previous.agentRevision
    : null;
  record.agentRevision = isAgentWrite
    ? { semanticFingerprint: record.semanticFingerprint, savedAt }
    : previousAgentRevision;
  assertNoSecretShape(record, "Agent answer drafts must not serialize secrets.");
  const activityMetadata = buildAgentActivityMetadata({
    type: 'answer_draft',
    status: record.status,
    createdAt: record.selectedAt,
    pendingAction: 'review_draft',
    sessionSlug: record.sessionSlug,
    questionId: record.questionId,
    telegramUserId: record.telegramUserId,
    editCount: record.editCount,
    originSource: record.origin?.source || '',
  });
  await env.AGENT_ACTION_KV.put(key, JSON.stringify(record), {
    expirationTtl: DEFAULT_GROUP_SESSION_TTL_SECONDS,
    metadata: activityMetadata,
  });
  if (!previous || contentChanged) {
    await writeDraftLifecycleEvent(env, {
      event: previous ? 'draft_edited' : 'draft_created',
      sessionSlug: record.sessionSlug,
      questionId: record.questionId,
      source: safeString(record.source),
      originSource: safeString(record.origin?.source),
      controlType: record.controlType,
      editCount: record.editCount,
      telegramUserId: record.telegramUserId,
    });
  }
  return { ok: true, key, draft: record };
}

async function persistAgentSubmitRequest({
  env = {},
  normalized = {},
  draft = {},
  sessionSlug = '',
  selectedQuestionId = '',
  createdAt = null,
} = {}) {
  if (!env?.AGENT_ACTION_KV || typeof env.AGENT_ACTION_KV.put !== 'function' || typeof env.AGENT_ACTION_KV.get !== 'function') {
    return { ok: false, reason: 'action_kv_unavailable' };
  }
  const telegramUserId = safeString(normalized.user?.telegramUserId);
  const slug = sanitizeSessionSlug(sessionSlug || draft.sessionSlug);
  const qid = safeString(selectedQuestionId || draft.questionId);
  if (!telegramUserId || !slug || !qid || draft.status !== 'draft_saved') {
    return { ok: false, reason: 'submit_request_incomplete' };
  }
  let ratingScale = null;
  if (['rating', 'rating_button'].includes(draft.controlType)) {
    if (Number.isFinite(draft.ratingScale?.min) && Number.isFinite(draft.ratingScale?.max)) {
      ratingScale = normalizeAgentRatingScale({ ratingScale: draft.ratingScale });
    } else {
      const loaded = await loadQuestionsForSession(env, slug, { preferredQuestionIds: [qid] });
      const question = (loaded.questions || []).find((entry) => questionId(entry) === qid);
      // A cache miss is not evidence that this question uses the default scale.
      if (!question) return { ok: false, reason: 'rating_scale_unavailable', retryable: true };
      ratingScale = normalizeAgentRatingScale(question);
    }
  }
  const answerFingerprint = answerDraftFingerprint(draft);
  const idempotencyKey = buildSubmitIdempotencyKey({
    transport: 'telegram_bot_submit', principal: telegramUserId, sessionSlug: slug, questionId: qid,
    answer: { answerLabel: safeString(draft.answerLabel), answerValue: safeString(draft.answerValue), controlType: safeString(draft.controlType) },
  });
  const requestId = buildOpaqueActionId(idempotencyKey);
  const kvKey = submitRequestKvKey(requestId);
  let existing;
  try {
    const raw = await env.AGENT_ACTION_KV.get(kvKey);
    existing = raw == null ? null : safeJsonParse(raw, null);
    if (raw != null && (!existing || typeof existing !== 'object' || Array.isArray(existing))) {
      return { ok: false, reason: 'submit_request_record_invalid', requestId };
    }
  } catch (error) {
    return { ok: false, reason: 'submit_request_read_failed', requestId, retryable: true, error: safeString(error?.message || error) };
  }
  const retrySafeFailure = existing?.status === 'direct_submit_failed' && existing?.onChain?.safeToRetry === true;
  if (existing && typeof existing === 'object' && !Array.isArray(existing) && !retrySafeFailure) {
    assertNoSecretShape(existing, "Agent submit requests must not serialize secrets.");
    let queued = false;
    if (existing.status === 'submit_queued' && existing.onChain?.reconciliationRequired !== true) {
      // Publication can fail before or after the queue accepts a message. Resend
      // the saved generation without rewriting KV: a consumer may already have
      // recorded an intent or outcome, which its replay checks must preserve.
      const retry = await enqueueAgentSubmitRecord({ env, record: existing }).catch(() => ({
        ok: false, reason: 'telegram_submit_queue_failed',
      }));
      if (!retry.ok) return { ...retry, requestId, idempotencyKey, retryable: true };
      queued = true;
    }
    return {
      ok: true,
      requestId,
      ...(queued ? { queued: true } : {}),
      status: existing.status || 'submit_request_created',
      canonicalApiRequest: existing.canonicalApiRequest || null,
      idempotencyKey,
      onChain: existing.onChain || null,
      replayed: true,
    };
  }
  if (retrySafeFailure) createdAt = existing.createdAt || createdAt;
  const policy = await loadSessionPolicy(env);
  const resolved = resolveSessionInvocation(policy, slug);
  const session = resolved.ok ? resolved.session : { sessionSlug: slug };
  const submittedAt = safeString(createdAt) || nowIso();
  const firstViewedAt = await readAnswerDraftFirstViewedAt({
    env,
    normalized,
    sessionSlug: slug,
    selectedQuestionId: qid,
  });
  const draftProvenance = buildDraftProvenance({ draft, submittedAt, firstViewedAt });
  const emitSubmittedEvent = () => writeDraftLifecycleEvent(env, {
    event: 'draft_submitted',
    sessionSlug: slug,
    questionId: qid,
    source: safeString(draft.source),
    originSource: safeString(draft.origin?.source),
    controlType: safeString(draft.controlType),
    editCount: Number(draft.editCount || 0),
    draftToSubmitMs: draftProvenance?.draftToSubmitMs ?? null,
    telegramUserId,
  });
  if (agentSubmitQueueEnabled(env)) {
    const record = buildQueuedSubmitRecord({
      session,
      canonicalBody: {
        session: slug,
        questionId: qid,
        answerRef: 'telegram_private_answer_ref',
        idempotencyKey,
      },
      baseRecord: {
        version: 1,
        requestId,
        idempotencyKey,
        answerFingerprint,
        lane: LEGACY_TRANSPORT_LANES.PRIVATE_ACCOUNT,
        telegramUserId,
        username: safeString(normalized.user?.username),
        languageCode: safeString(normalized.user?.languageCode),
        chatId: safeString(normalized.chat?.chatId),
        sessionSlug: slug,
        questionId: qid,
        questionIdShort: shortQuestionId(qid),
        answer: {
          label: safeString(draft.answerLabel),
          value: safeString(draft.answerValue),
          controlType: safeString(draft.controlType),
        },
        ratingScale,
        onChainAnswer: onChainAnswerFromDraft(draft),
        answerRef: draft.key ? { kind: 'telegram_answer_draft', key: draft.key } : null,
        draftProvenance,
        createdAt,
      },
    });
    // Sending the same answer again resends the saved request under its queue
    // generation (or saves it, if that write failed), so callers may retry it.
    const queued = await queueAgentSubmitRecord({ env, kvKey, record }).catch((error) => ({
      ok: false,
      reason: 'telegram_submit_queue_failed',
      retryable: true,
      error: safeString(error?.message || error),
    }));
    if (queued.ok === true) {
      await emitSubmittedEvent();
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
    // A rejected send promise can follow accepted queue publication. Falling
    // through to direct submission could race that already-enqueued message.
    return { ...queued, requestId, idempotencyKey };
  }
  const principal = normalizeLegacyManagedPrincipal(normalized);
  const account = await deriveManagedDemoAccount({
    principal,
    deploymentId: env.AGENT_BRIDGE_DEPLOYMENT_ID || 'agent-bridge-live-demo',
    rootSecret: env.DEMO_SIGNER_ROOT_SECRET || '',
    lifecycle: AGENT_BRIDGE_EVENT_TYPES.ACCOUNT_CREATED,
    createdAt,
  });
  const directSubmit = await submitAgentResponseOnChain({
    env,
    session,
    account,
    principal,
    questionRef: {
      sessionSlug: slug,
      questionId: qid,
      ratingScale,
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
      action: AGENT_ACTIONS.DIRECT_SUBMIT_RESPONSE,
      status: directSubmit.ok === true ? 'direct_submitted' : 'direct_submit_failed',
      lane: LEGACY_TRANSPORT_LANES.PRIVATE_ACCOUNT,
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
      draftProvenance,
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
    assertNoSecretShape(record, "Agent direct submit records must not serialize secrets.");
    await persistAgentSubmitRecord({ env, kvKey, record });
    if (directSubmit.ok === true) await emitSubmittedEvent();
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
    action: AGENT_ACTIONS.SUBMIT_RESPONSE,
    status: 'submit_request_created',
    lane: LEGACY_TRANSPORT_LANES.PRIVATE_ACCOUNT,
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
    draftProvenance,
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
  assertNoSecretShape(record, "Agent submit requests must not serialize secrets.");
  await persistAgentSubmitRecord({ env, kvKey, record });
  await emitSubmittedEvent();
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

function timestampMs(value = '') {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value > 0 && value < 10_000_000_000 ? Math.floor(value * 1000) : Math.floor(value);
  }
  const text = safeString(value);
  if (!text) return null;
  if (/^\d+$/.test(text)) {
    const number = Number(text);
    if (!Number.isFinite(number) || number <= 0) return null;
    return number < 10_000_000_000 ? Math.floor(number * 1000) : Math.floor(number);
  }
  const parsed = Date.parse(text);
  return Number.isFinite(parsed) ? parsed : null;
}

function agentSessionCreatedAfterMs(env = {}, policy = {}) {
  if (Object.prototype.hasOwnProperty.call(env, 'AGENT_BRIDGE_SESSION_CREATED_AFTER')) {
    return timestampMs(env.AGENT_BRIDGE_SESSION_CREATED_AFTER);
  }
  return timestampMs(
    env.AGENT_BRIDGE_TELEGRAM_SESSION_CREATED_AFTER ||
    env.AGENT_BRIDGE_TELEGRAM_SESSIONS_CREATED_AFTER ||
    env.AGENT_BRIDGE_TELEGRAM_GROUP_CREATED_AFTER ||
    policy.telegramSessionCreatedAfter ||
    policy.telegramSessionsCreatedAfter ||
    policy.telegramGroupCreatedAfter ||
      policy.sessionCreatedAfter,
  );
}

function sessionCreatedAtMs(session = {}) {
  return timestampMs(
    session.createdAt ||
    session.createdTimestamp ||
    session.createdAtMs ||
    session.createdTimestampMs ||
    session.sessionCreatedAt ||
    session.groupCreatedAt ||
    session.telegramCreatedAt ||
    session.blockTimestamp ||
      session.createdBlockTimestamp,
  );
}

function sessionVisibleToAgent(session = {}, {
  createdAfterMs = null,
  defaultSessionSlug = '',
} = {}) {
  const name = `${safeString(session.sessionSlug)} ${safeString(session.sessionName)}`;
  const slug = sanitizeSessionSlug(session.sessionSlug || session.slug);
  // Temporary smoke-test hygiene: hide old E2E registry spam until session metadata
  // has a durable production flag for Agent HTTP visibility.
  if (/\be2e\b|e2e/i.test(name)) return false;
  if (Number.isFinite(createdAfterMs)) {
    const createdAtMs = sessionCreatedAtMs(session);
    const defaultAgentSession = slug && slug === sanitizeSessionSlug(defaultSessionSlug);
    if (!defaultAgentSession) {
      if (!Number.isFinite(createdAtMs)) return false;
      if (createdAtMs < createdAfterMs) return false;
    }
  }
  return session.agentHttpEnabled === true && sessionUsesWorkerBackedQuestions(session);
}

function agentVisibleSessions(policy = {}, env = {}) {
  const createdAfterMs = agentSessionCreatedAfterMs(env, policy);
  return (Array.isArray(policy.linkedSessions) ? policy.linkedSessions : [])
    .filter((session) => sessionVisibleToAgent(session, {
      createdAfterMs,
      defaultSessionSlug: policy.defaultSessionSlug,
    }));
}

function normalizeResultAnswerLabel(value = '') {
  const label = safeAnswerString(value);
  const normalized = lower(label);
  if (normalized === 'agree' || normalized === 'yes' || normalized === 'true') return 'Agree';
  if (normalized === 'disagree' || normalized === 'no' || normalized === 'false') return 'Disagree';
  if (normalized === 'unsure' || normalized === 'unknown') return 'Unsure';
  return label || 'Response';
}

function dedupeSubmitRecords(records = []) {
  const byId = new Map();
  (Array.isArray(records) ? records : []).forEach((record) => {
    const requestId = safeString(record.requestId || record.idempotencyKey || record.key);
    if (!requestId) return;
    const existing = byId.get(requestId);
    if (!existing || safeString(existing.createdAt).localeCompare(safeString(record.createdAt)) <= 0) {
      byId.set(requestId, record);
    }
  });
  return Array.from(byId.values());
}

async function loadSubmittedResultRecords(env = {}, sessionSlug = '') {
  const slug = sanitizeSessionSlug(sessionSlug);
  const indexedPrefix = submitRequestSessionKvPrefix(slug);
  const indexedRecords = indexedPrefix
    ? await listKvRecordsByPrefix(env, indexedPrefix, { limit: Infinity, parseJson: safeJsonParse })
    : [];
  const canonicalPrefix = canonicalAnswerSessionKvPrefix(slug);
  const canonicalRecords = canonicalPrefix
    ? await listKvRecordsByPrefix(env, canonicalPrefix, { limit: Infinity, parseJson: safeJsonParse })
    : [];
  const records = dedupeSubmitRecords([...indexedRecords, ...canonicalRecords]);
  const submittedStatuses = new Set(SUBMITTED_RESULT_STATUSES);
  return records
    .filter((record) => (
      submittedStatuses.has(safeString(record?.status)) &&
      sanitizeSessionSlug(record.sessionSlug) === slug &&
      safeString(record.questionId)
    ))
    .map((record) => {
      const answer = structuredResultAnswer(record);
      return {
        key: safeString(record.key),
        requestId: safeString(record.requestId),
        createdAt: safeString(record.createdAt),
        telegramUserId: safeString(record.telegramUserId),
        questionId: safeString(record.questionId),
        label: normalizeResultAnswerLabel(firstAnswerValue(
          answer.label,
          answer.value,
          answer.text,
          record.answerLabel,
          record.answerValue,
        )),
        value: safeAnswerString(firstAnswerValue(
          answer.value,
          answer.text,
          answer.label,
          record.answerValue,
          record.answerLabel,
        )),
        questionType: safeString(answer.questionType || record.questionType || record.controlType),
        ...(answer.questionType === 'quadratic' ? { answer: { value: answer.value, encrypted: answer.encrypted === true } } : {}),
        text: safeAnswerString(firstAnswerValue(
          answer.text,
          record.answerText,
        )),
        comments: safeAnswerString(firstAnswerValue(
          answer.comments,
          answer.additionalComments,
          record.comments,
          record.answerComments,
        )),
        txHash: safeString(record.onChain?.txHash),
      };
    })
    .sort((left, right) => safeString(left.createdAt).localeCompare(safeString(right.createdAt)));
}

function structuredResultAnswer(record = {}) {
  const answer = record.answer && typeof record.answer === 'object' && !Array.isArray(record.answer)
    ? { ...record.answer }
    : {};
  const parsed = safeJsonParse(answer.value || record.answerValue, null);
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    return {
      ...answer,
      ...parsed,
      label: safeString(answer.label || parsed.label),
    };
  }
  return answer;
}

function questionPromptById(questions = []) {
  const map = new Map();
  for (const question of questions) {
    const id = questionId(question);
    if (id) map.set(id, questionText(question));
  }
  return map;
}

function consensusQuestionType(question = {}) {
  return lower(question.questionType || question.type || question.controlType);
}

function questionSupportsConsensus(question = {}) {
  return [
    'agree_unsure_disagree',
    'agree-disagree',
    'binary',
    'boolean',
    'yes_no',
    'yes-no',
  ].includes(consensusQuestionType(question));
}

function consensusQuestionsForResults(questions = []) {
  return (Array.isArray(questions) ? questions : []).filter(questionSupportsConsensus);
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

function formatCounts(counts = []) {
  return counts.map(([label, count]) => `${label} ${count}`).join(' | ');
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

function extractAiText(body = {}) {
  if (typeof body === 'string') return body;
  const direct = safeString(body?.completion || body?.output_text || body?.text || body?.content);
  if (direct) return direct;
  const choiceText = safeString(body?.choices?.[0]?.message?.content || body?.choices?.[0]?.text);
  if (choiceText) return choiceText;
  const outputContent = Array.isArray(body?.output)
    ? body.output.flatMap((item) => Array.isArray(item?.content) ? item.content : [])
    : [];
  return safeString(outputContent.map((item) => item?.text || item?.content || '').filter(Boolean).join('\n'));
}

function buildGroupAnalysisPrompt(group = {}, groups = []) {
  const allGroupsData = {
    clusterCount: groups.length,
    sizes: Object.fromEntries(groups.map((item, index) => [String(index + 1), item.size])),
    previousNames: [],
    nameUniqueness: true,
  };
  const clusterData = {
    clusterIndex: Number(String(group.groupId || '').replace(/\D+/g, '')) || 1,
    clusterSize: group.size,
    totalClusters: groups.length,
    topStatements: group.topStatements,
    qualitativeResponses: group.qualitativeResponses || [],
  };
  return `
We have grouped participants into ${allGroupsData.clusterCount || 'N'} opinion clusters.
Each cluster represents people whose voting patterns on statements are similar.

You are analyzing cluster #${clusterData.clusterIndex} of size ${clusterData.clusterSize || '?'}.
For this cluster, here are the most representative statements with per-cluster vs overall agreement.

Top statements (JSON):
${JSON.stringify(clusterData.topStatements || [], null, 2)}

Additional comments and freeform responses from this cluster (JSON, optional):
${JSON.stringify(clusterData.qualitativeResponses || [], null, 2)}

All-clusters context (JSON, optional):
${JSON.stringify(allGroupsData, null, 2)}

TASK:
1) Give this cluster a brief, neutral NAME (2-4 words). No slurs or niche jargon.
2) Write a SHORT one-sentence tagline about what unites the cluster.
3) Write a LONG 2-4 sentence overview explaining what distinguishes them from others. Use both vote patterns and any additional comments/freeform responses, without quoting private identifying details.

STRICT OUTPUT (JSON only, no extra text):
{
  "name": "<2-4 words label>",
  "short": "<single-sentence tagline>",
  "long": "<2-4 sentences>"
}`.trim();
}

function localGroupAnalysis(group = {}) {
  if (group.demoAnalysis && typeof group.demoAnalysis === 'object' && !Array.isArray(group.demoAnalysis)) {
    return {
      name: safeString(group.demoAnalysis.name) || group.label || 'Demo cluster',
      short: safeString(group.demoAnalysis.short) || 'This demo cluster shares a visible answer pattern.',
      long: safeString(group.demoAnalysis.long) || 'Demo data is synthetic and is only intended to preview the group analysis workflow.',
    };
  }
  const top = (group.topStatements || []).slice(0, 3).map((statement) => (
    `${statement.label}: ${statement.prompt} (${statement.cluster.agreeRate}% agree, ${statement.cluster.disagreeRate}% disagree)`
  ));
  const qualitative = (group.qualitativeResponses || []).slice(0, 3).map((item) => (
    `${item.questionLabel}: ${item.text}`
  ));
  return {
    name: `${group.label} ${group.theme || ''}`.trim(),
    short: `This group trends toward ${group.theme || 'a distinct answer pattern'} across the strongest differentiating questions.`,
    long: top.length || qualitative.length
      ? [
        top.length ? `Most distinguishing positions: ${top.join('; ')}.` : '',
        qualitative.length ? `Qualitative context: ${qualitative.join('; ')}.` : '',
      ].filter(Boolean).join(' ')
      : 'There is not enough question overlap to summarize distinctive positions yet.',
  };
}

async function analyzeParticipantResultGroup({
  env = {},
  normalized = {},
  policy = {},
  session = {},
  group = {},
  groups = [],
  createdAt = null,
} = {}) {
  const fallback = localGroupAnalysis(group);
  if (group.demo === true) {
    return { ok: true, reason: 'demo_group_analysis', analysis: fallback };
  }
  const eligibility = evaluateSponsoredResourceEligibility(session, {
    resource: 'ai',
    requestedRisk: RISK_CEILINGS.SUBMIT,
    riskCeiling: policy.riskCeiling,
  });
  const workerUrl = resolveSessionWorkerUrl(env, session);
  if (!eligibility.ok || !workerUrl) {
    return {
      ok: false,
      reason: eligibility.reason || 'session_worker_url_missing',
      analysis: fallback,
    };
  }
  const principal = normalizeLegacyManagedPrincipal(normalized);
  const account = await deriveManagedDemoAccount({
    principal,
    deploymentId: env.AGENT_BRIDGE_DEPLOYMENT_ID || 'agent-bridge-live-demo',
    rootSecret: env.DEMO_SIGNER_ROOT_SECRET || '',
    lifecycle: AGENT_BRIDGE_EVENT_TYPES.ACCOUNT_CREATED,
    createdAt,
  });
  const fetchImpl = env.AGENT_BRIDGE_FETCH || globalThis.fetch;
  try {
    const sessionAuth = await authenticateSessionWorker({
      env,
      session,
      account,
      principal,
      workerUrl,
      fetchImpl,
      now: createdAt ? new Date(createdAt) : new Date(),
    });
    if (!sessionAuth.ok || !sessionAuth.token) {
      return {
        ok: false,
        reason: sessionAuth.reason || 'worker_auth_failed',
        analysis: fallback,
      };
    }
    const response = await fetchImpl(`${sessionAuth.workerUrl}/ai`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        Authorization: `Bearer ${sessionAuth.token}`,
      },
      body: JSON.stringify(withBridgeOpenAiApiKey({
        provider: 'openai',
        model: safeString(env.AGENT_BRIDGE_CLUSTER_ANALYSIS_MODEL || env.AGENT_BRIDGE_AI_SEARCH_MODEL || 'gpt-5'),
        messages: [
          {
            role: 'system',
            content: 'You are an expert survey analyst. You write neutral, helpful summaries of opinion clusters.',
          },
          {
            role: 'user',
            content: buildGroupAnalysisPrompt(group, groups),
          },
        ],
        max_output_tokens: 700,
        response_format: { type: 'json_object' },
        temperature: 0,
      }, env)),
    });
    const body = await response.json().catch(() => ({}));
    if (!response?.ok) {
      return {
        ok: false,
        reason: safeString(body?.error || body?.message || response?.status) || 'ai_group_analysis_failed',
        analysis: fallback,
      };
    }
    const parsed = extractJsonObject(extractAiText(body));
    return {
      ok: Boolean(parsed),
      reason: parsed ? '' : 'ai_response_parse_failed',
      analysis: parsed ? {
        name: safeString(parsed.name) || fallback.name,
        short: safeString(parsed.short) || fallback.short,
        long: safeString(parsed.long) || fallback.long,
      } : fallback,
    };
  } catch (error) {
    return {
      ok: false,
      reason: safeString(error?.message || error) || 'ai_group_analysis_failed',
      analysis: fallback,
    };
  }
}

function participantAlias(id = '', index = 0) {
  return `P${index + 1}`;
}

function answerScore(label = '', value = '') {
  const text = lower(value || label);
  if (!text) return 0;
  if (/\b(agree|yes|true|support|approve)\b/.test(text)) return 1;
  if (/\b(disagree|no|false|oppose|reject)\b/.test(text)) return -1;
  if (/\b(unsure|unknown|neutral|mixed|abstain)\b/.test(text)) return 0;
  const numeric = Number(text.match(/-?\d+(?:\.\d+)?/)?.[0]);
  if (!Number.isFinite(numeric)) return 0;
  if (numeric >= 1 && numeric <= 5) return Math.max(-1, Math.min(1, (numeric - 3) / 2));
  if (numeric >= 0 && numeric <= 10) return Math.max(-1, Math.min(1, (numeric - 5) / 5));
  return Math.max(-1, Math.min(1, numeric));
}

function averageAnswerScore(records = []) {
  const scored = records
    .map((record) => answerScore(record.label, record.value))
    .filter((score) => Number.isFinite(score));
  if (!scored.length) return 0;
  return scored.reduce((sum, score) => sum + score, 0) / scored.length;
}

function countResultVotes(records = []) {
  const counts = { agree: 0, disagree: 0, unsure: 0, responded: 0 };
  for (const record of records) {
    const score = answerScore(record.label, record.value);
    if (score > 0.25) counts.agree += 1;
    else if (score < -0.25) counts.disagree += 1;
    else counts.unsure += 1;
    counts.responded += 1;
  }
  return {
    ...counts,
    agreeRate: counts.responded ? Number(((counts.agree * 100) / counts.responded).toFixed(1)) : 0,
    disagreeRate: counts.responded ? Number(((counts.disagree * 100) / counts.responded).toFixed(1)) : 0,
    unsureRate: counts.responded ? Number(((counts.unsure * 100) / counts.responded).toFixed(1)) : 0,
  };
}

function questionTypeById(questions = []) {
  const map = new Map();
  for (const question of questions) {
    const id = questionId(question);
    if (id) map.set(id, lower(question.questionType || question.type || question.controlType));
  }
  return map;
}

function qualitativeTextFromResultRecord(record = {}, questionTypeLookup = new Map()) {
  const type = lower(record.questionType || questionTypeLookup.get(record.questionId));
  const text = safeAnswerString(record.text);
  const comments = safeAnswerString(record.comments);
  const parts = [];
  if (type === 'freeform' && text) parts.push(text);
  if (comments) parts.push(comments);
  return parts.join(' ').trim();
}

function qualitativeResponsesForGroup({
  records = [],
  aliases = new Map(),
  questionIndex = new Map(),
  promptMap = new Map(),
  questionTypeLookup = new Map(),
  limit = 8,
} = {}) {
  const responses = [];
  for (const record of records) {
    const text = qualitativeTextFromResultRecord(record, questionTypeLookup);
    if (!text) continue;
    responses.push({
      participant: aliases.get(record.telegramUserId) || 'Participant',
      questionId: record.questionId,
      questionLabel: questionIndex.get(record.questionId) || 'Q?',
      prompt: promptMap.get(record.questionId) || shortQuestionId(record.questionId),
      text: text.slice(0, 500),
    });
    if (responses.length >= limit) break;
  }
  return responses;
}

function groupBucketForScore(score = 0) {
  if (score > 0.25) return { bucketId: 'support', theme: 'higher agreement' };
  if (score < -0.25) return { bucketId: 'concern', theme: 'higher disagreement' };
  return { bucketId: 'mixed', theme: 'mixed or unsure' };
}

function groupThemeForScore(score = 0) {
  if (score > 0.35) return 'higher agreement';
  if (score < -0.35) return 'higher disagreement';
  if (score > 0.08) return 'leaning agreement';
  if (score < -0.08) return 'leaning disagreement';
  return 'mixed or unsure';
}

function requestedScoreBuckets({ records = [], participantIds = [], clusterCount = null } = {}) {
  const count = Number(clusterCount);
  if (!Number.isFinite(count) || count <= 0) return null;
  const scored = participantIds
    .map((id) => ({
      id,
      score: averageAnswerScore(records.filter((record) => record.telegramUserId === id)),
    }))
    .sort((left, right) => right.score - left.score || String(left.id).localeCompare(String(right.id)));
  const resolvedCount = Math.max(1, Math.min(6, Math.floor(count), scored.length));
  if (!resolvedCount || !scored.length) return [];
  const buckets = Array.from({ length: resolvedCount }, (_, index) => ({
    bucketId: `cluster-${index + 1}`,
    theme: '',
    participantIds: [],
    scoreTotal: 0,
  }));
  scored.forEach((item, index) => {
    const bucketIndex = Math.min(resolvedCount - 1, Math.floor(index * resolvedCount / scored.length));
    const bucket = buckets[bucketIndex];
    bucket.participantIds.push(item.id);
    bucket.scoreTotal += item.score;
  });
  buckets.forEach((bucket) => {
    const average = bucket.participantIds.length ? bucket.scoreTotal / bucket.participantIds.length : 0;
    bucket.theme = groupThemeForScore(average);
  });
  return buckets;
}

function buildParticipantResultGroups({
  records = [],
  participantIds = [],
  aliases = new Map(),
  questionIds = [],
  questionIndex = new Map(),
  promptMap = new Map(),
  questionTypeLookup = new Map(),
  clusterCount = null,
} = {}) {
  const requestedBuckets = requestedScoreBuckets({ records, participantIds, clusterCount });
  const buckets = Array.isArray(requestedBuckets) ? requestedBuckets : (() => {
    const out = new Map();
    for (const id of participantIds) {
      const participantRecords = records.filter((record) => record.telegramUserId === id);
      const score = averageAnswerScore(participantRecords);
      const bucket = groupBucketForScore(score);
      if (!out.has(bucket.bucketId)) {
        out.set(bucket.bucketId, {
          bucketId: bucket.bucketId,
          theme: bucket.theme,
          participantIds: [],
          scoreTotal: 0,
        });
      }
      const item = out.get(bucket.bucketId);
      item.participantIds.push(id);
      item.scoreTotal += score;
    }
    return Array.from(out.values());
  })();

  return buckets
    .filter((bucket) => bucket.participantIds.length)
    .sort((left, right) => (
      (right.scoreTotal / right.participantIds.length) -
      (left.scoreTotal / left.participantIds.length) ||
      right.participantIds.length - left.participantIds.length ||
      left.theme.localeCompare(right.theme)
    ))
    .map((bucket, index) => {
      const participantSet = new Set(bucket.participantIds);
      const clusterRecords = records.filter((record) => participantSet.has(record.telegramUserId));
      const qualitativeResponses = qualitativeResponsesForGroup({
        records: clusterRecords,
        aliases,
        questionIndex,
        promptMap,
        questionTypeLookup,
      });
      const topStatements = questionIds.map((id, questionNumber) => {
        const clusterQuestionRecords = clusterRecords.filter((record) => record.questionId === id);
        const overallQuestionRecords = records.filter((record) => record.questionId === id);
        const clusterAverage = averageAnswerScore(clusterQuestionRecords);
        const overallAverage = averageAnswerScore(overallQuestionRecords);
        return {
          label: questionIndex.get(id) || `Q${questionNumber + 1}`,
          questionIndex: questionNumber,
          prompt: promptMap.get(id) || shortQuestionId(id),
          cluster: countResultVotes(clusterQuestionRecords),
          overall: countResultVotes(overallQuestionRecords),
          differenceScore: Number(Math.abs(clusterAverage - overallAverage).toFixed(3)),
        };
      })
        .filter((statement) => statement.cluster.responded > 0)
        .sort((left, right) => (
          right.differenceScore - left.differenceScore ||
          right.cluster.responded - left.cluster.responded ||
          left.prompt.localeCompare(right.prompt)
        ))
        .slice(0, 5);
      return {
        groupId: `group-${index + 1}`,
        label: `Group ${index + 1}`,
        theme: bucket.theme,
        size: bucket.participantIds.length,
        aliases: bucket.participantIds.map((id) => aliases.get(id)).filter(Boolean),
        averageScore: Number((bucket.scoreTotal / bucket.participantIds.length).toFixed(3)),
        topStatements,
        qualitativeResponses,
      };
    });
}

function buildParticipantGraph(records = [], questions = [], options = {}) {
  const questionTypeLookup = questionTypeById(questions);
  const graphRecords = (Array.isArray(records) ? records : []).map((record) => ({
    ...record,
    questionType: safeString(record.questionType || questionTypeLookup.get(record.questionId)),
  }));
  const questionIds = Array.from(new Set(graphRecords.map((record) => record.questionId).filter(Boolean)));
  const questionIndex = new Map(questionIds.map((id, index) => [id, `Q${index + 1}`]));
  const participants = Array.from(new Set(graphRecords.map((record) => record.telegramUserId).filter(Boolean)));
  const aliases = new Map(participants.map((id, index) => [id, participantAlias(id, index)]));
  const lines = participants.map((id) => {
    const answered = graphRecords
      .filter((record) => record.telegramUserId === id)
      .map((record) => `${questionIndex.get(record.questionId) || 'Q?'}:${record.label}`);
    return `${aliases.get(id)} -> ${answered.join(', ') || 'No answers'}`;
  });
  const promptMap = questionPromptById(questions);
  const legend = questionIds.slice(0, 5).map((id, index) => `${index + 1}. ${promptMap.get(id) || shortQuestionId(id)}`);
  const imageParticipants = participants.slice(0, 8).map((id) => ({
    participant: aliases.get(id),
    answers: graphRecords
      .filter((record) => record.telegramUserId === id)
      .map((record) => ({
        question: questionIndex.get(record.questionId) || 'Q?',
        label: record.label,
      })),
  }));
  const groups = buildParticipantResultGroups({
    records: graphRecords,
    participantIds: participants,
    aliases,
    questionIds,
    questionIndex,
    promptMap,
    questionTypeLookup,
    clusterCount: options.clusterCount,
  });
  return {
    lines,
    legend,
    participants: imageParticipants,
    groups,
    participantCount: participants.length,
    questionCount: questionIds.length,
  };
}

function publicBridgeBaseUrl(env = {}) {
  return safeString(env.AGENT_BRIDGE_PUBLIC_URL || env.PUBLIC_URL).replace(/\/+$/, '');
}

export {
  ACTION_KV_PREFIX,
  AGENT_REQUEST_KV_PREFIX,
  ANSWER_DRAFT_KV_PREFIX,
  ANSWER_DRAFT_VIEW_KV_PREFIX,
  answerDraftFingerprint,
  deleteAnswerDraft,
  analyzeParticipantResultGroup,
  buildDraftProvenance,
  buildParticipantGraph,
  consensusQuestionsForResults,
  formatCounts,
  loadSubmittedResultRecords,
  loadSessionPolicy,
  loadQuestionsForSession,
  markAnswerDraftViewed,
  persistActionRecord,
  persistAnswerDraft,
  persistAgentSubmitRequest,
  questionId,
  readActionRecord,
  readAnswerDraft,
  readAnswerDraftFirstViewedAt,
  readGroupSessionBinding,
  readPrivateSessionBinding,
  shortQuestionId,
  summarizeQuestionResults,
  SUBMIT_REQUEST_KV_PREFIX,
  agentVisibleSessions,
  readAgentSkillUpdateFlag,
  readAdminDefaultSessionOverride,
  sessionUsesWorkerBackedQuestions,
  writeAgentSkillUpdateFlag,
  writeAdminDefaultSessionOverride,
  writeDraftLifecycleEvent,
  clearAgentSkillUpdateFlag,
  clearAdminDefaultSessionOverride,
  writeResultsExposureOverride,
};
