import {
  AGENT_BRIDGE_EVENT_TYPES,
  TELEGRAM_BRIDGE_ACTIONS,
  TELEGRAM_CHAT_LANES,
} from './constants.mjs';
import {
  buildParticipantGraph,
  buildTelegramCommandResponse,
  clearAdminDefaultSessionOverride,
  clearAgentSkillUpdateFlag,
  consensusQuestionsForResults,
  loadQuestionsForSession,
  loadSessionPolicy,
  loadSubmittedResultRecords,
  mintTelegramGroupApprovalLink,
  parseAgentOnboardingStartParam,
  persistActionRecord,
  persistAnswerDraft,
  persistLatestMiniAppLaunchPointer,
  persistTelegramUserSessionBinding,
  readGroupSessionBinding,
  readAgentSkillUpdateFlag,
  readPrivateSessionBinding,
  resolveAgentTokenSession,
  summarizeQuestionResults,
  writeAgentSkillUpdateFlag,
  writeAdminDefaultSessionOverride,
} from './telegramCommands.mjs';
import { deriveManagedDemoAccount } from './managedAccounts.mjs';
import { buildResultsImage } from './resultImage.mjs';
import { loadOrBuildTelegramTopicMap } from './telegramTopicMap.mjs';
import { validateTelegramMiniAppInitData } from './telegramMiniApp.mjs';
import {
  geoTagsFromRefs,
  inferQuestionTags,
  normalizeQuestionReferences,
  normalizeQuestionGeoRefs,
  normalizeQuestionTags,
  persistTelegramProposedQuestion,
  sessionContextFromPolicySession,
} from './telegramQuestionProposals.mjs';
import { evaluateTelegramQuestionAuthoringPermission } from './telegramAuthoringPermissions.mjs';
import { resolveSessionInvocation } from './sessionPolicy.mjs';
import {
  deleteTelegramGroupApproval,
  evaluateTelegramGroupSessionAccessForEnv,
} from './telegramGroupApprovals.mjs';
import { telegramBotApiRequest } from './telegramSender.mjs';
import { buildOpaqueActionId, createRandomTelegramCallbackAction } from './opaqueActions.mjs';
import { assertNoSecretShape } from './redaction.mjs';
import {
  loadTelegramLightweightGroups,
  persistTelegramChildSession,
  persistTelegramLightweightGroupProposal,
  saveTelegramLightweightGroupMembership,
} from './telegramGroups.mjs';
import {
  loadTelegramAgentSettings,
  saveTelegramAgentSettingsPatch,
} from './telegramAgentSettings.mjs';
import {
  AGENT_QUESTION_VOTE_RECOMMENDATION_KV_PREFIX,
  listTelegramAgentActivity,
} from './telegramAgentActivity.mjs';
import { listRegistrySessionsForBridge } from './registrySessions.mjs';
import {
  loadTelegramQuestionQueueConfig,
  saveTelegramQuestionQueueConfig,
  selectNextTelegramQuestion,
} from './telegramQuestionQueue.mjs';
import { canManageResponseExportAllowlist } from './telegramResponseExport.mjs';
import {
  createTelegramAgentDelegationToken,
  delegationTokenHasScope,
  loadTelegramAgentDelegationToken,
  readTelegramAgentDelegationTokenUserPointer,
  revokeTelegramAgentDelegationTokenHash,
  TELEGRAM_AGENT_DELEGATION_TOKEN_KV_PREFIX,
  TELEGRAM_AGENT_DELEGATION_TOKEN_DEFAULT_TTL_SECONDS,
  TELEGRAM_AGENT_DELEGATION_TOKEN_SCOPES,
  writeTelegramAgentDelegationTokenUserPointer,
} from './telegramAgentDelegationTokens.mjs';
import {
  SUBMIT_REQUEST_KV_PREFIX,
  SUBMIT_REQUEST_SESSION_KV_PREFIX,
  SUBMIT_REQUEST_USER_KV_PREFIX,
  SUBMIT_REQUEST_TTL_SECONDS,
  SUBMITTED_RESULT_STATUSES,
  submitRequestSessionKvPrefix,
} from './telegramSubmitQueue.mjs';
import { authenticateSessionWorker } from './onChainResponses.mjs';

const DEFAULT_AGENT_BRIDGE_PUBLIC_URL = 'https://ce-agent-bridge-worker.agalmic.workers.dev';
const DEFAULT_AGENT_SKILL_URL = 'https://raw.githubusercontent.com/AgalmicSoftware/context-engine/edge-2026/workers/agentBridgeWorker/skills/ce-telegram-agent-handoff/SKILL.md';
const CE_TELEGRAM_AGENT_HANDOFF_SKILL_VERSION = '2026-05-30 (v5)';
const MINI_APP_QUESTION_VOTE_KV_PREFIX = 'telegram:mini-app-question-vote:v1:';
const AGENT_QUESTION_VOTE_DECISION_KV_PREFIX = 'telegram:agent-question-vote-decision:v1:';
const ANSWER_DRAFT_KV_PREFIX = 'telegram:answer-draft:';
const PROPOSED_QUESTION_KV_PREFIX = 'telegram:proposed-question:';
const LIGHTWEIGHT_GROUP_PROPOSAL_KV_PREFIX = 'telegram:lightweight-group-proposal:';
const ADMIN_METRICS_CACHE_KV_PREFIX = 'telegram:admin-metrics-cache:v1:';
const ADMIN_METRICS_CACHE_TTL_SECONDS = 60;
const ADMIN_METRICS_SUBMIT_ENTRY_LIMIT = 100000;
const RESULT_VIEW_CACHE_KV_PREFIX = 'telegram:result-view-cache:v1:';
const RESULT_VIEW_CACHE_TTL_SECONDS = 7 * 24 * 60 * 60;
const RESULT_VIEW_VALUE_MAX_CHARS = 8000;
const RESULT_VIEW_GENERIC_MAX_ARRAY_ITEMS = 200;
const RESULT_VIEW_GENERIC_MAX_OBJECT_KEYS = 200;
const RESULT_VIEW_GENERIC_MAX_DEPTH = 6;
const RESULT_VIEW_CACHE_MAX_BYTES = 512 * 1024;
const TELEGRAM_AGENT_ONBOARDING_QUESTIONS = Object.freeze([
  {
    id: 'preference_tailoring',
    prompt: 'Can your agent pass preference info to CE to tailor which questions you see?',
  },
  {
    id: 'demographics_research',
    prompt: 'Can your agent share non-identifying demographics for research only, never published in connection to you?',
  },
  {
    id: 'demographic_link_opt_in',
    prompt: 'Can CE link your otherwise-anonymous responses to approved demographic buckets for aggregate research?',
  },
  {
    id: 'attendance_context_opt_in',
    prompt: 'Can CE associate your Edge attendance buckets with your answers, but not your identity?',
  },
  {
    id: 'draft_responses',
    prompt: 'Can your agent draft question responses for you based on your activity and user file?',
  },
  {
    id: 'draft_divergence_research',
    prompt: 'Can CE store agent-drafted answers and final sent answers to study where people edit drafts?',
  },
  {
    id: 'auto_apply_question_votes',
    prompt: 'Can your agent upvote questions it thinks you will find relevant?',
  },
  {
    id: 'edge_daily_digest',
    prompt: 'Want your top 3 CE questions (from your activity + admin sponsored) in your Edge daily digest?',
  },
]);

function safeString(value) {
  return String(value || '').trim();
}

function lower(value) {
  return safeString(value).toLowerCase();
}

function normalizeBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback;
  if (value === true || value === false) return value;
  const normalized = lower(value);
  if (['true', '1', 'yes', 'y', 'on'].includes(normalized)) return true;
  if (['false', '0', 'no', 'n', 'off'].includes(normalized)) return false;
  return fallback;
}

function sanitizeSessionSlug(value = '') {
  return lower(value).replace(/[^a-z0-9_-]/g, '').slice(0, 128);
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

function json(data, init = {}) {
  return new Response(JSON.stringify(data, null, 2), {
    ...init,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      ...(init.headers || {}),
    },
  });
}

function agentBridgePublicUrl(env = {}) {
  return safeString(env.AGENT_BRIDGE_PUBLIC_URL || env.PUBLIC_URL || DEFAULT_AGENT_BRIDGE_PUBLIC_URL).replace(/\/+$/, '');
}

function agentSkillUrl(env = {}) {
  return safeString(
    env.AGENT_BRIDGE_AGENT_SKILL_URL ||
      env.CE_TELEGRAM_AGENT_SKILL_URL ||
      DEFAULT_AGENT_SKILL_URL
  );
}

function skillVersionPayload(env = {}) {
  const skillUrl = agentSkillUrl(env);
  return {
    ok: true,
    version: CE_TELEGRAM_AGENT_HANDOFF_SKILL_VERSION,
    skill: 'ce-telegram-agent-handoff',
    skillUrl,
    changelogUrl: `${skillUrl}#changelog`,
  };
}

async function skillVersionPayloadWithFlag(env = {}) {
  const base = skillVersionPayload(env);
  const flag = await readAgentSkillUpdateFlag(env);
  const payload = {
    ...base,
    updateAvailable: flag.updateAvailable === true,
    latestVersion: flag.latestVersion || base.version,
    updateNote: flag.note || '',
  };
  assertNoSecretShape(payload, 'Telegram agent skill-version response must not serialize secrets.');
  return payload;
}

function miniAppOnboardAllowedOrigins(env = {}) {
  return safeString(env.AGENT_BRIDGE_MINIAPP_ALLOWED_ORIGINS)
    .split(',')
    .map((entry) => safeString(entry).replace(/\/+$/, ''))
    .filter(Boolean);
}

function miniAppOnboardCorsHeaders(request, env = {}) {
  const origin = safeString(request.headers.get('origin')).replace(/\/+$/, '');
  if (!origin) return {};
  const allowed = miniAppOnboardAllowedOrigins(env);
  if (!allowed.includes(origin) && !allowed.includes('*')) return null;
  return {
    'access-control-allow-origin': allowed.includes('*') ? origin : origin,
    'access-control-allow-methods': 'GET, POST, OPTIONS',
    'access-control-allow-headers': 'content-type, x-telegram-init-data, telegram-web-app-init-data, x-ce-telegram-init-data',
    'access-control-max-age': '600',
    vary: 'Origin',
  };
}

function jsonMiniAppOnboard(request, env, data, init = {}) {
  const cors = miniAppOnboardCorsHeaders(request, env);
  return json(data, {
    ...init,
    headers: {
      ...(cors || {}),
      ...(init.headers || {}),
    },
  });
}

function clientLoginAllowedOrigins(env = {}) {
  return [
    ...safeString(env.AGENT_BRIDGE_CLIENT_LOGIN_ALLOWED_ORIGINS).split(','),
    ...miniAppOnboardAllowedOrigins(env),
  ]
    .map((entry) => safeString(entry).replace(/\/+$/, ''))
    .filter(Boolean);
}

function isLocalClientOrigin(origin = '') {
  try {
    const parsed = new URL(origin);
    return ['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname);
  } catch {
    return false;
  }
}

function clientLoginCorsHeaders(request, env = {}) {
  const origin = safeString(request.headers.get('origin')).replace(/\/+$/, '');
  if (!origin) return {};
  const allowed = clientLoginAllowedOrigins(env);
  if (!allowed.includes('*') && !allowed.includes(origin) && !isLocalClientOrigin(origin)) {
    return null;
  }
  return {
    'access-control-allow-origin': origin,
    'access-control-allow-methods': 'POST, OPTIONS',
    'access-control-allow-headers': 'content-type',
    'access-control-max-age': '600',
    vary: 'Origin',
  };
}

function resultViewCacheCorsHeaders(request, env = {}) {
  const origin = safeString(request.headers.get('origin')).replace(/\/+$/, '');
  if (!origin) return {};
  const allowed = clientLoginAllowedOrigins(env);
  if (!allowed.includes('*') && !allowed.includes(origin) && !isLocalClientOrigin(origin)) {
    return null;
  }
  return {
    'access-control-allow-origin': origin,
    'access-control-allow-methods': 'GET, POST, OPTIONS',
    'access-control-allow-headers': 'authorization, content-type, x-ce-agent-token, x-context-engine-agent-token',
    'access-control-max-age': '600',
    vary: 'Origin',
  };
}

function jsonResultViewCache(request, env, data, init = {}) {
  const cors = resultViewCacheCorsHeaders(request, env);
  return json(data, {
    ...init,
    headers: {
      ...(cors || {}),
      ...(init.headers || {}),
    },
  });
}

function jsonClientLogin(request, env, data, init = {}) {
  const cors = clientLoginCorsHeaders(request, env);
  return json(data, {
    ...init,
    headers: {
      ...(cors || {}),
      ...(init.headers || {}),
    },
  });
}

function extractTelegramAgentToken(value = '') {
  const raw = safeString(value);
  if (!raw) return '';
  const match = raw.match(/\bceagt_[A-Za-z0-9_-]{16,}\b/);
  return safeString(match?.[0] || (/^ceagt_[A-Za-z0-9_-]{16,}$/.test(raw) ? raw : ''));
}

async function readMiniAppOnboardInput(request) {
  const url = new URL(request.url);
  const body = request.method === 'POST'
    ? await request.json().catch(() => ({}))
    : {};
  return {
    ...body,
    initData: safeString(
      body.initData ||
      body.telegramInitData ||
      url.searchParams.get('initData') ||
      url.searchParams.get('telegramInitData') ||
      request.headers.get('X-Telegram-Init-Data') ||
      request.headers.get('Telegram-Web-App-Init-Data') ||
      request.headers.get('X-Ce-Telegram-Init-Data')
    ),
    startParam: safeString(body.startParam || body.startapp || body.startApp || url.searchParams.get('startParam') || url.searchParams.get('startapp')),
    sessionSlug: safeString(body.sessionSlug || url.searchParams.get('sessionSlug')),
  };
}

function firstValue(...values) {
  return values.find((value) => safeString(value) !== '');
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

function kvKeySafePart(value = '') {
  const text = safeString(value);
  if (!text) return '';
  const safe = text.replace(/[^a-zA-Z0-9_-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 56);
  return `${safe || 'ref'}_${stableFingerprint(text)}`;
}

function titleAnswer(value = '') {
  const normalized = lower(value);
  if (normalized === 'agree' || normalized === 'yes' || normalized === 'true') return 'Agree';
  if (normalized === 'disagree' || normalized === 'no' || normalized === 'false') return 'Disagree';
  if (normalized === 'unsure' || normalized === 'unknown' || normalized === 'maybe') return 'Unsure';
  return safeString(value);
}

function expectedAgentToken(env = {}) {
  return safeString(env.AGENT_BRIDGE_AGENT_API_TOKEN || env.AGENT_BRIDGE_OPENCLAW_AGENT_TOKEN);
}

function suppliedAgentToken(request) {
  const authorization = safeString(request.headers.get('authorization'));
  const bearer = authorization.match(/^Bearer\s+(.+)$/i);
  return safeString(
    bearer?.[1] ||
    request.headers.get('x-ce-agent-token') ||
    request.headers.get('x-context-engine-agent-token')
  );
}

function agentTokenRefreshError(reason = 'agent_token_invalid') {
  return {
    ok: false,
    status: 401,
    reason,
    message: 'This Context Engine agent token is expired, revoked, or no longer available. Ask the user to open the Context Engine Telegram bot, run /start, tap Onboard Agent, and paste the copied install info into the agent.',
    action: 'refresh_token_via_telegram',
    telegramCommand: '/start',
    telegramButton: 'Onboard Agent',
  };
}

async function authenticateAgentHandoff(request, env = {}) {
  const expected = expectedAgentToken(env);
  const supplied = suppliedAgentToken(request);
  if (!supplied) {
    return { ok: false, status: 401, reason: 'agent_api_token_invalid' };
  }
  if (expected && supplied === expected) {
    return { ok: true, authMode: 'service_token' };
  }
  const delegated = await loadTelegramAgentDelegationToken({ env, token: supplied });
  if (delegated.ok) {
    return { ok: true, authMode: 'telegram_agent_delegation_token', delegation: delegated.record };
  }
  if (safeString(supplied).startsWith('ceagt_')) {
    return agentTokenRefreshError(delegated.reason || 'agent_token_invalid');
  }
  if (!expected) {
    return { ok: false, status: 503, reason: 'agent_api_token_not_configured' };
  }
  return { ok: false, status: 401, reason: 'agent_api_token_invalid' };
}

function normalizeAgentTelegramContext(input = {}) {
  const telegram = input.telegram && typeof input.telegram === 'object' && !Array.isArray(input.telegram)
    ? input.telegram
    : {};
  const telegramUserId = safeString(input.telegramUserId || input.userId || telegram.telegramUserId || telegram.userId);
  const username = safeString(input.username || telegram.username);
  const groupChatId = safeString(input.groupChatId || input.chatId || telegram.groupChatId || telegram.chatId);
  const chatId = groupChatId || telegramUserId;
  const isPrivate = !groupChatId;
  return {
    type: 'telegram_mock_update',
    updateId: safeString(input.updateId) || `agent-${Date.now()}`,
    kind: 'agent_handoff',
    lane: isPrivate ? TELEGRAM_CHAT_LANES.PRIVATE_ACCOUNT : TELEGRAM_CHAT_LANES.GROUP_LOBBY,
    user: { telegramUserId, username },
    chat: {
      chatId,
      chatType: groupChatId ? 'supergroup' : 'private',
      type: groupChatId ? 'supergroup' : 'private',
      isPrivate,
    },
  };
}

async function readRequestJson(request) {
  if (request.method === 'GET' || request.method === 'HEAD') return {};
  return request.json().catch(() => ({}));
}

function inputFromRequest(request, body = {}) {
  const url = new URL(request.url);
  return {
    ...body,
    sessionSlug: safeString(body.sessionSlug || url.searchParams.get('sessionSlug')),
    telegramUserId: safeString(body.telegramUserId || url.searchParams.get('telegramUserId')),
    chatId: safeString(body.chatId || url.searchParams.get('chatId')),
    groupChatId: safeString(body.groupChatId || url.searchParams.get('groupChatId')),
    username: safeString(body.username || url.searchParams.get('username')),
    tags: body.tags || url.searchParams.get('tags') || url.searchParams.get('tag'),
    interests: body.interests || url.searchParams.get('interests'),
    sessionsAttended: body.sessionsAttended || body.attendedSessions || url.searchParams.get('sessionsAttended') || url.searchParams.get('attendedSessions'),
    relevanceMode: safeString(body.relevanceMode || url.searchParams.get('relevanceMode')),
    questionTypes: body.questionTypes || body.questionType || url.searchParams.get('questionTypes') || url.searchParams.get('questionType'),
    queueKey: safeString(body.queueKey || url.searchParams.get('queueKey')),
    advance: Object.hasOwn(body, 'advance') ? body.advance : url.searchParams.get('advance'),
    resetQueue: Object.hasOwn(body, 'resetQueue') ? body.resetQueue : (body.reset || url.searchParams.get('resetQueue') || url.searchParams.get('reset')),
    includeSponsored: Object.hasOwn(body, 'includeSponsored') ? body.includeSponsored : url.searchParams.get('includeSponsored'),
    sponsoredFirst: Object.hasOwn(body, 'sponsoredFirst') ? body.sponsoredFirst : url.searchParams.get('sponsoredFirst'),
    questionIds: Object.hasOwn(body, 'questionIds') ? body.questionIds : url.searchParams.get('questionIds'),
    orderedQuestionIds: Object.hasOwn(body, 'orderedQuestionIds') ? body.orderedQuestionIds : url.searchParams.get('orderedQuestionIds'),
    skippedQuestionIds: Object.hasOwn(body, 'skippedQuestionIds') ? body.skippedQuestionIds : url.searchParams.get('skippedQuestionIds'),
    questionSeries: Object.hasOwn(body, 'questionSeries') ? body.questionSeries : undefined,
    draftAnswersByQuestionId: Object.hasOwn(body, 'draftAnswersByQuestionId') ? body.draftAnswersByQuestionId : undefined,
    prefilledDraftsByQuestionId: Object.hasOwn(body, 'prefilledDraftsByQuestionId') ? body.prefilledDraftsByQuestionId : undefined,
    sponsoredQuestionIds: Object.hasOwn(body, 'sponsoredQuestionIds') ? body.sponsoredQuestionIds : url.searchParams.get('sponsoredQuestionIds'),
    sponsoredQuestions: Object.hasOwn(body, 'sponsoredQuestions') ? body.sponsoredQuestions : url.searchParams.get('sponsoredQuestions'),
    operation: safeString(body.operation || url.searchParams.get('operation')),
    clearQueue: Object.hasOwn(body, 'clear') ? body.clear : url.searchParams.get('clear'),
    view: safeString(body.view || body.mode || url.searchParams.get('view') || url.searchParams.get('mode')),
    viewType: safeString(body.viewType || body.type || url.searchParams.get('viewType') || url.searchParams.get('type')),
    dataVersionKey: safeString(
      body.dataVersionKey ||
      body.dataKey ||
      body.cacheKey ||
      url.searchParams.get('dataVersionKey') ||
      url.searchParams.get('dataKey') ||
      url.searchParams.get('cacheKey')
    ),
    value: Object.hasOwn(body, 'value') ? body.value : undefined,
    result: Object.hasOwn(body, 'result') ? body.result : undefined,
    cache: Object.hasOwn(body, 'cache') ? body.cache : undefined,
    demo: Object.hasOwn(body, 'demo') ? body.demo : url.searchParams.get('demo'),
    questionId: safeString(body.questionId || url.searchParams.get('questionId')),
    geoId: safeString(body.geoId || body.geoNodeId || url.searchParams.get('geoId') || url.searchParams.get('geoNodeId')),
    geoRefs: Object.hasOwn(body, 'geoRefs') ? body.geoRefs : (body.geoIds || url.searchParams.get('geoRefs') || url.searchParams.get('geoIds')),
  };
}

function delegationScopeForRequest(pathname = '', method = 'GET') {
  const methodName = safeString(method).toUpperCase();
  if (pathname === '/telegram/agent/api/questions') {
    return TELEGRAM_AGENT_DELEGATION_TOKEN_SCOPES.READ_QUESTIONS;
  }
  if (pathname === '/telegram/agent/api/tags') {
    return TELEGRAM_AGENT_DELEGATION_TOKEN_SCOPES.READ_QUESTIONS;
  }
  if (pathname === '/telegram/agent/api/questions/next') {
    return TELEGRAM_AGENT_DELEGATION_TOKEN_SCOPES.READ_QUESTIONS;
  }
  if (pathname === '/telegram/agent/api/actions') {
    return TELEGRAM_AGENT_DELEGATION_TOKEN_SCOPES.READ_QUESTIONS;
  }
  if (pathname === '/telegram/agent/api/mini-app-launch') {
    return TELEGRAM_AGENT_DELEGATION_TOKEN_SCOPES.DRAFT_ANSWERS;
  }
  if (pathname === '/telegram/agent/api/results') {
    return TELEGRAM_AGENT_DELEGATION_TOKEN_SCOPES.READ_QUESTIONS;
  }
  if (pathname === '/telegram/agent/api/results-image') {
    return TELEGRAM_AGENT_DELEGATION_TOKEN_SCOPES.READ_QUESTIONS;
  }
  if (pathname === '/telegram/agent/api/result-view-cache') {
    return TELEGRAM_AGENT_DELEGATION_TOKEN_SCOPES.READ_QUESTIONS;
  }
  if (pathname === '/telegram/agent/api/geo-backlink') {
    return TELEGRAM_AGENT_DELEGATION_TOKEN_SCOPES.READ_QUESTIONS;
  }
  if (pathname === '/telegram/agent/api/admin/status') {
    return TELEGRAM_AGENT_DELEGATION_TOKEN_SCOPES.READ_QUESTIONS;
  }
  if (pathname === '/telegram/agent/api/admin/metrics') {
    return TELEGRAM_AGENT_DELEGATION_TOKEN_SCOPES.READ_QUESTIONS;
  }
  if (pathname === '/telegram/agent/api/admin/default-session') {
    return TELEGRAM_AGENT_DELEGATION_TOKEN_SCOPES.READ_QUESTIONS;
  }
  if (pathname === '/telegram/agent/api/admin/skill-update') {
    return TELEGRAM_AGENT_DELEGATION_TOKEN_SCOPES.READ_QUESTIONS;
  }
  if (pathname === '/telegram/agent/api/onboarding') {
    return methodName === 'POST'
      ? TELEGRAM_AGENT_DELEGATION_TOKEN_SCOPES.DRAFT_ANSWERS
      : TELEGRAM_AGENT_DELEGATION_TOKEN_SCOPES.READ_QUESTIONS;
  }
  if (pathname === '/telegram/agent/api/question-queue/plan') {
    return TELEGRAM_AGENT_DELEGATION_TOKEN_SCOPES.READ_QUESTIONS;
  }
  if (pathname === '/telegram/agent/api/question-queue/apply') {
    return TELEGRAM_AGENT_DELEGATION_TOKEN_SCOPES.READ_QUESTIONS;
  }
  if (
    pathname === '/telegram/agent/api/group-approval-link' ||
    pathname === '/telegram/agent/api/group-approval-revoke'
  ) {
    return TELEGRAM_AGENT_DELEGATION_TOKEN_SCOPES.MANAGE_GROUP_APPROVALS;
  }
  if (pathname === '/telegram/agent/api/question-votes/recommend') {
    return TELEGRAM_AGENT_DELEGATION_TOKEN_SCOPES.RECOMMEND_QUESTION_VOTES;
  }
  if (pathname === '/telegram/agent/api/question-votes/apply') {
    return TELEGRAM_AGENT_DELEGATION_TOKEN_SCOPES.APPLY_QUESTION_VOTES;
  }
  if (pathname === '/telegram/agent/api/preferences') {
    return TELEGRAM_AGENT_DELEGATION_TOKEN_SCOPES.DRAFT_ANSWERS;
  }
  if (pathname === '/telegram/agent/api/questions/pose' || pathname === '/telegram/agent/api/questions/create') {
    return TELEGRAM_AGENT_DELEGATION_TOKEN_SCOPES.POSE_QUESTIONS;
  }
  if (pathname === '/telegram/agent/api/groups' && methodName === 'GET') {
    return TELEGRAM_AGENT_DELEGATION_TOKEN_SCOPES.READ_GROUPS;
  }
  if (pathname === '/telegram/agent/api/groups/propose') {
    return TELEGRAM_AGENT_DELEGATION_TOKEN_SCOPES.PROPOSE_GROUPS;
  }
  return '';
}

function onboardingAnswersFromSettings(settings = {}) {
  const uses = new Set(Array.isArray(settings.allowedUses) ? settings.allowedUses : []);
  const profileFields = new Set(Array.isArray(settings.allowedProfileFields) ? settings.allowedProfileFields : []);
  return {
    preference_tailoring: uses.has('rank_questions') ||
      profileFields.has('interests') ||
      profileFields.has('sessions_attended') ||
      profileFields.has('roles'),
    demographics_research: uses.has('research_demographics') ||
      profileFields.has('non_identifying_demographics'),
    demographic_link_opt_in: settings.demographicLinkOptIn === true ||
      uses.has('link_demographics_research'),
    attendance_context_opt_in: settings.attendanceLinkOptIn === true ||
      uses.has('link_attendance_context') ||
      profileFields.has('edge_attendance'),
    draft_responses: uses.has('draft_answers'),
    draft_divergence_research: settings.draftDivergenceOptIn === true ||
      uses.has('research_draft_divergence'),
    auto_apply_question_votes: settings.agentAutoApplyQuestionVotes === true,
    edge_daily_digest: settings.dailyDigestOptIn === true,
  };
}

function normalizeOnboardingTopicPreferences(input = {}, settings = {}) {
  const source = input.topicPreferences ||
    input.topics ||
    input.interests ||
    input.answers?.topic_preferences ||
    settings.topicPreferences ||
    [];
  return normalizeQuestionTags(source).slice(0, 30);
}

function plainObject(value = {}) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function normalizeOnboardingGroupMembershipInput(input = {}, answers = {}) {
  const groups = plainObject(input.groups);
  const rawSelections = plainObject(
    input.groupSelections ||
    input.bucketSelections ||
    input.demographicBuckets ||
    groups.selections
  );
  const rawDetails = plainObject(
    input.groupDetails ||
    input.bucketDetails ||
    input.demographicDetails ||
    groups.details
  );
  const allowedCategories = new Set();
  if (answers.demographic_link_opt_in === true || answers.demographics_research === true) {
    ['age_bucket', 'country_relationship', 'region', 'ai_tribe', 'contribution_role'].forEach((id) => allowedCategories.add(id));
  }
  if (answers.attendance_context_opt_in === true) {
    allowedCategories.add('events_attended');
  }
  const selections = {};
  for (const [categoryId, value] of Object.entries(rawSelections)) {
    const category = safeString(categoryId);
    if (!allowedCategories.has(category)) continue;
    const values = Array.isArray(value) ? value : safeString(value).split(/[\n,;|]+/);
    const normalized = values
      .map((entry) => safeString(entry).toLowerCase().replace(/[^a-z0-9_-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 80))
      .filter(Boolean)
      .slice(0, 12);
    if (normalized.length) selections[category] = [...new Set(normalized)];
  }
  const details = {};
  for (const [categoryId, value] of Object.entries(rawDetails)) {
    const category = safeString(categoryId);
    if (!allowedCategories.has(category)) continue;
    if (Array.isArray(value)) {
      details[category] = value.map(safeString).filter(Boolean).slice(0, 8);
    } else if (value && typeof value === 'object') {
      details[category] = Object.fromEntries(
        Object.entries(value)
          .map(([key, entry]) => [safeString(key).slice(0, 64), safeString(entry).slice(0, 160)])
          .filter(([key, entry]) => key && entry)
          .slice(0, 12)
      );
    } else {
      const detail = safeString(value).slice(0, 160);
      if (detail) details[category] = detail;
    }
  }
  return { selections, details };
}

function hasOnboardingGroupMembership(input = {}) {
  return Object.keys(input.selections || {}).length > 0 || Object.keys(input.details || {}).length > 0;
}

function normalizeOnboardingAnswers(input = {}, settings = {}) {
  const source = input.answers && typeof input.answers === 'object' && !Array.isArray(input.answers)
    ? input.answers
    : input;
  const previous = onboardingAnswersFromSettings(settings);
  return TELEGRAM_AGENT_ONBOARDING_QUESTIONS.reduce((answers, question) => {
    answers[question.id] = normalizeBoolean(
      Object.hasOwn(source, question.id) ? source[question.id] : undefined,
      previous[question.id] === true ? true : false
    );
    return answers;
  }, {});
}

function settingsPatchFromOnboardingAnswers(answers = {}, completedAt = '') {
  const allowedProfileFields = [];
  const allowedUses = [];
  if (answers.preference_tailoring === true) {
    allowedProfileFields.push('interests', 'sessions_attended', 'roles');
    allowedUses.push('rank_questions');
  }
  if (answers.demographics_research === true) {
    allowedProfileFields.push('non_identifying_demographics');
    allowedUses.push('research_demographics');
  }
  if (answers.demographic_link_opt_in === true) {
    allowedProfileFields.push('edge_bio_keywords', 'age_bucket', 'country', 'region');
    allowedUses.push('link_demographics_research');
  }
  if (answers.attendance_context_opt_in === true) {
    allowedProfileFields.push('edge_attendance');
    allowedUses.push('link_attendance_context');
  }
  if (answers.draft_responses === true) {
    allowedUses.push('draft_answers');
  }
  if (answers.draft_divergence_research === true) {
    allowedUses.push('research_draft_divergence');
  }
  if (answers.auto_apply_question_votes === true) {
    allowedUses.push('recommend_votes');
  }
  return {
    allowedProfileFields: [...new Set(allowedProfileFields)],
    allowedUses: [...new Set(allowedUses)],
    demographicLinkOptIn: answers.demographic_link_opt_in === true,
    attendanceLinkOptIn: answers.attendance_context_opt_in === true,
    draftDivergenceOptIn: answers.draft_divergence_research === true,
    approvalMode: {
      answers: answers.draft_responses === true ? 'draft_for_review' : 'manual_review',
      questionVotes: answers.auto_apply_question_votes === true ? 'auto_apply' : 'suggest_for_review',
      groups: 'suggest_for_review',
    },
    agentAutoApplyQuestionVotes: answers.auto_apply_question_votes === true,
    dailyDigestOptIn: answers.edge_daily_digest === true,
    onboardingCompletedAt: completedAt,
  };
}

function publicOnboardingState({ sessionSlug = '', settings = {} } = {}) {
  const answers = onboardingAnswersFromSettings(settings);
  const questions = TELEGRAM_AGENT_ONBOARDING_QUESTIONS.map((question, index) => ({
    ...question,
    order: index + 1,
    answer: answers[question.id] === true,
  }));
  const payload = {
    ok: true,
    sessionSlug: sanitizeSessionSlug(sessionSlug),
    completed: Boolean(safeString(settings.onboardingCompletedAt)),
    completedAt: safeString(settings.onboardingCompletedAt),
    questions,
    answers,
    topicPreferences: Array.isArray(settings.topicPreferences) ? settings.topicPreferences : [],
    settings: {
      allowedProfileFields: Array.isArray(settings.allowedProfileFields) ? settings.allowedProfileFields : [],
      allowedUses: Array.isArray(settings.allowedUses) ? settings.allowedUses : [],
      topicPreferences: Array.isArray(settings.topicPreferences) ? settings.topicPreferences : [],
      demographicLinkOptIn: settings.demographicLinkOptIn === true,
      attendanceLinkOptIn: settings.attendanceLinkOptIn === true,
      draftDivergenceOptIn: settings.draftDivergenceOptIn === true,
      approvalMode: settings.approvalMode || {},
      agentAutoApplyQuestionVotes: settings.agentAutoApplyQuestionVotes === true,
      dailyDigestOptIn: settings.dailyDigestOptIn === true,
    },
  };
  assertNoSecretShape(payload, 'Telegram agent onboarding state must not serialize secrets.');
  return payload;
}

function normalizeAddress(value = '') {
  const text = safeString(value).toLowerCase();
  return /^0x[0-9a-f]{40}$/.test(text) ? text : '';
}

function bindingSessionSlug(binding = {}, policy = {}) {
  if (!binding || typeof binding !== 'object') return '';
  if (binding.followDefault === true) return sanitizeSessionSlug(policy.defaultSessionSlug);
  return sanitizeSessionSlug(binding.sessionSlug);
}

function parseAddressList(value = '') {
  const raw = safeString(value);
  if (!raw) return [];
  const parsed = safeJsonParse(raw, null);
  if (Array.isArray(parsed)) return parsed.map(normalizeAddress).filter(Boolean);
  return raw.split(/[\s,;]+/).map(normalizeAddress).filter(Boolean);
}

function isRootResponseExportAdmin(env = {}, accountAddress = '') {
  const account = normalizeAddress(accountAddress);
  if (!account) return false;
  return parseAddressList(env.AGENT_BRIDGE_RESPONSE_EXPORT_ALLOWED_ADDRESSES).includes(account);
}

async function listMetricKvEntriesByPrefix(env = {}, prefix = '', {
  limit = 10000,
} = {}) {
  const kv = env?.AGENT_ACTION_KV;
  if (!prefix || !kv || typeof kv.list !== 'function') return [];
  const maxEntries = Math.max(1, Math.min(ADMIN_METRICS_SUBMIT_ENTRY_LIMIT, Number(limit) || 10000));
  const pageLimit = Math.min(1000, maxEntries);
  const entries = [];
  let cursor = undefined;
  do {
    const page = await kv.list({
      prefix,
      limit: pageLimit,
      ...(cursor ? { cursor } : {}),
    }).catch(() => null);
    const keys = Array.isArray(page?.keys) ? page.keys : [];
    for (const entry of keys) {
      const key = safeString(entry?.name || entry);
      if (!key) continue;
      entries.push({
        key,
        metadata: entry && typeof entry === 'object' && !Array.isArray(entry)
          ? (entry.metadata || null)
          : null,
      });
      if (entries.length >= maxEntries) return entries;
    }
    cursor = page?.list_complete === false ? safeString(page.cursor) : '';
  } while (cursor);
  return entries;
}

async function readMetricRecord(env = {}, key = '') {
  const kv = env?.AGENT_ACTION_KV;
  if (!key || !kv || typeof kv.get !== 'function') return null;
  const record = safeJsonParse(await kv.get(key).catch(() => null), null);
  return record && typeof record === 'object' && !Array.isArray(record) ? record : null;
}

function sessionFromSessionFirstKey(key = '', prefix = '') {
  const rest = safeString(key).startsWith(prefix) ? safeString(key).slice(prefix.length) : '';
  return sanitizeSessionSlug(rest.split(':')[0]);
}

function sessionFromDraftKey(key = '') {
  const rest = safeString(key).startsWith(ANSWER_DRAFT_KV_PREFIX)
    ? safeString(key).slice(ANSWER_DRAFT_KV_PREFIX.length)
    : '';
  return sanitizeSessionSlug(rest.split(':')[1]);
}

function userFromSubmitUserKey(key = '') {
  const rest = safeString(key).startsWith(SUBMIT_REQUEST_USER_KV_PREFIX)
    ? safeString(key).slice(SUBMIT_REQUEST_USER_KV_PREFIX.length)
    : '';
  const [sessionSlug, telegramUserId] = rest.split(':');
  return {
    sessionSlug: sanitizeSessionSlug(sessionSlug),
    telegramUserId: safeString(telegramUserId),
  };
}

function emptyAdminMetricTotals() {
  return {
    agentsOnboarded: 0,
    distinctUsersOnboarded: 0,
    questionsCreated: 0,
    questionsAnswered: 0,
    answerDrafts: 0,
    groupProposals: 0,
    sessionsWithBridgeActivity: 0,
    registrySessionCount: 0,
    distinctRespondents: 0,
  };
}

function incrementMetric(perSession = new Map(), sessionSlug = '', field = '') {
  const slug = sanitizeSessionSlug(sessionSlug);
  if (!slug || !field) return;
  const current = perSession.get(slug) || {
    sessionSlug: slug,
    ...emptyAdminMetricTotals(),
    _usersOnboarded: new Set(),
    _respondents: new Set(),
  };
  current[field] = Number(current[field] || 0) + 1;
  perSession.set(slug, current);
}

function sessionMetric(perSession = new Map(), sessionSlug = '') {
  const slug = sanitizeSessionSlug(sessionSlug);
  if (!slug) return null;
  const current = perSession.get(slug) || {
    sessionSlug: slug,
    ...emptyAdminMetricTotals(),
    _usersOnboarded: new Set(),
    _respondents: new Set(),
  };
  perSession.set(slug, current);
  return current;
}

function publicSessionMetric(metric = {}) {
  const out = {
    sessionSlug: sanitizeSessionSlug(metric.sessionSlug),
    agentsOnboarded: Number(metric.agentsOnboarded || 0),
    distinctUsersOnboarded: metric._usersOnboarded instanceof Set
      ? metric._usersOnboarded.size
      : Number(metric.distinctUsersOnboarded || 0),
    questionsCreated: Number(metric.questionsCreated || 0),
    questionsAnswered: Number(metric.questionsAnswered || 0),
    answerDrafts: Number(metric.answerDrafts || 0),
    groupProposals: Number(metric.groupProposals || 0),
    sessionsWithBridgeActivity: 0,
    registrySessionCount: Number(metric.registrySessionCount || 0),
    distinctRespondents: metric._respondents instanceof Set
      ? metric._respondents.size
      : Number(metric.distinctRespondents || 0),
  };
  out.sessionsWithBridgeActivity = [
    out.agentsOnboarded,
    out.questionsCreated,
    out.questionsAnswered,
    out.answerDrafts,
    out.groupProposals,
  ].some((count) => count > 0) ? 1 : 0;
  return out;
}

function applyDelegationToInput(auth = {}, input = {}, pathname = '', method = 'GET') {
  if (auth.authMode !== 'telegram_agent_delegation_token') return { ok: true, input };
  const delegation = auth.delegation || {};
  const scope = delegationScopeForRequest(pathname, method);
  if (!scope || !delegationTokenHasScope(delegation, scope)) {
    return { ok: false, status: 403, reason: 'agent_token_scope_denied', requiredScope: scope || 'unsupported_route' };
  }
  const requestedSessionSlug = sanitizeSessionSlug(input.sessionSlug);
  return {
    ok: true,
    input: {
      ...input,
      telegramUserId: safeString(delegation.telegramUserId),
      username: safeString(input.username || delegation.username),
      sessionSlug: requestedSessionSlug,
      groupChatId: safeString(input.groupChatId),
    },
  };
}

async function resolveHandoffContext({
  env = {},
  input = {},
  auth = {},
  requireQuestionAuthoring = true,
  ignoreSessionBinding = false,
} = {}) {
  const policy = await loadSessionPolicy(env);
  const normalized = normalizeAgentTelegramContext(input);
  if (!normalized.user.telegramUserId) {
    return { ok: false, status: 400, reason: 'telegram_user_required' };
  }
  const groupBinding = ignoreSessionBinding ? null : await readGroupSessionBinding(env, normalized);
  let privateBinding = ignoreSessionBinding ? null : await readPrivateSessionBinding(env, normalized);
  const delegation = auth.authMode === 'telegram_agent_delegation_token' ? auth.delegation : null;
  const requestedSessionSlug = sanitizeSessionSlug(input.sessionSlug);
  const groupBindingSlug = delegation ? '' : bindingSessionSlug(groupBinding, policy);
  const privateBindingSlug = bindingSessionSlug(privateBinding, policy);
  const sessionSlug = sanitizeSessionSlug(
    requestedSessionSlug ||
    groupBindingSlug ||
    privateBindingSlug ||
    policy.defaultSessionSlug
  );
  const resolved = resolveSessionInvocation(policy, sessionSlug);
  if (!resolved.ok) {
    return { ok: false, status: 404, reason: resolved.reason || 'session_not_found', sessionSlug };
  }
  if (delegation && requestedSessionSlug && !ignoreSessionBinding) {
    const existingPinnedSlug = privateBinding?.followDefault === true ? '' : sanitizeSessionSlug(privateBinding?.sessionSlug);
    if (existingPinnedSlug !== resolved.session.sessionSlug) {
      const saved = await persistTelegramUserSessionBinding({
        env,
        normalized,
        session: resolved.session,
        createdAt: input.createdAt || null,
        source: 'telegram_agent_delegation_token',
        followDefault: false,
      });
      if (saved.ok) {
        privateBinding = {
          ...(privateBinding || {}),
          sessionSlug: resolved.session.sessionSlug,
          source: 'telegram_agent_delegation_token',
          followDefault: false,
        };
      }
    }
  }
  const effectiveGroupBinding = groupBinding?.followDefault === true
    ? { ...groupBinding, sessionSlug: resolved.session.sessionSlug }
    : groupBinding;
  const effectivePrivateBinding = privateBinding?.followDefault === true
    ? { ...privateBinding, sessionSlug: resolved.session.sessionSlug }
    : privateBinding;
  if (normalized.chat?.isPrivate !== true) {
    const groupAccess = await evaluateTelegramGroupSessionAccessForEnv({ env, session: resolved.session, normalized });
    if (!groupAccess.ok) {
      return {
        ok: false,
        status: 403,
        reason: groupAccess.reason,
        sessionSlug: resolved.session.sessionSlug,
        groupChatId: groupAccess.groupChatId,
      };
    }
  }
  let permission = { ok: true, mode: 'not_required' };
  if (requireQuestionAuthoring) {
    permission = evaluateTelegramQuestionAuthoringPermission({
      env,
      normalized,
      session: resolved.session,
      groupBinding: effectiveGroupBinding,
      privateBinding: effectivePrivateBinding || (delegation ? {
        sessionSlug: resolved.session.sessionSlug,
        source: 'telegram_agent_delegation_token',
      } : null),
      requestedSessionSlug: resolved.session.sessionSlug,
    });
    if (!permission.ok) {
      return { ok: false, status: 403, reason: permission.reason, sessionSlug: resolved.session.sessionSlug };
    }
  }
  return {
    ok: true,
    policy,
    session: resolved.session,
    normalized,
    groupBinding: effectiveGroupBinding,
    privateBinding: effectivePrivateBinding,
    permission,
    delegation,
    authMode: auth.authMode || '',
  };
}

function questionIsLocked(question = {}) {
  const visibility = lower(question.visibility);
  return question.locked === true || ['private', 'sbt_gated', 'lit_encrypted'].includes(visibility);
}

function questionIsUnavailable(question = {}) {
  return question.payloadUnavailable === true || lower(question.visibility) === 'payload_unavailable';
}

function publicAgentQuestion(question = {}, {
  session = {},
} = {}) {
  const questionId = safeString(question.questionId || question.id);
  const locked = questionIsLocked(question);
  const unavailable = questionIsUnavailable(question);
  const prompt = locked || unavailable
    ? ''
    : safeString(question.questionText || question.prompt || question.title);
  const questionType = safeString(question.questionType || question.type || 'freeform') || 'freeform';
  const options = Array.isArray(question.options) ? question.options.map(safeString).filter(Boolean) : [];
  const references = locked || unavailable ? [] : normalizeQuestionReferences(question.references);
  const geoRefs = locked || unavailable
    ? []
    : normalizeQuestionGeoRefs(question.geoRefs || question.geoIds || question.geoId);
  const tags = locked || unavailable
    ? []
    : inferQuestionTags({
      question,
      prompt,
      questionType,
      options,
      session,
      sessionContext: sessionContextFromPolicySession(session),
    });
  return {
    questionId,
    sessionSlug: sanitizeSessionSlug(question.sessionSlug),
    questionType,
    prompt,
    options,
    tags,
    answerable: Boolean(questionId && prompt && !locked && !unavailable),
    locked,
    payloadUnavailable: unavailable,
    proposed: question.proposed === true,
    source: safeString(question.source),
    references,
    geoRefs,
  };
}

function normalizePreferenceTagHints(input = {}) {
  const preferences = input.preferences && typeof input.preferences === 'object' && !Array.isArray(input.preferences)
    ? input.preferences
    : {};
  const profile = preferences.profile && typeof preferences.profile === 'object' && !Array.isArray(preferences.profile)
    ? preferences.profile
    : {};
  const source = [
    input.tags,
    input.interests,
    input.topics,
    preferences.tags,
    preferences.tagIds,
    preferences.interests,
    preferences.topics,
    preferences.sessionTags,
    profile.tags,
    profile.interests,
    profile.topics,
  ].flatMap((value) => (Array.isArray(value) ? value : safeString(value).split(/[\n,;|]+/)));
  return normalizeQuestionTags(source);
}

function normalizePreferenceSessionHints(input = {}) {
  const preferences = input.preferences && typeof input.preferences === 'object' && !Array.isArray(input.preferences)
    ? input.preferences
    : {};
  const source = [
    input.sessionsAttended,
    input.attendedSessions,
    input.sessionSlugs,
    preferences.sessionsAttended,
    preferences.attendedSessions,
    preferences.sessionSlugs,
  ].flatMap((value) => (Array.isArray(value) ? value : safeString(value).split(/[\n,;|]+/)));
  const slugs = new Set();
  const names = new Set();
  source.forEach((entry) => {
    const raw = entry && typeof entry === 'object' && !Array.isArray(entry)
      ? firstValue(entry.sessionSlug, entry.slug, entry.id, entry.sessionName, entry.name, entry.title)
      : entry;
    const text = safeString(raw);
    if (!text) return;
    const slug = sanitizeSessionSlug(text);
    if (slug) slugs.add(slug);
    normalizeQuestionTags(text).forEach((tag) => names.add(tag));
  });
  return { slugs: [...slugs], tags: [...names] };
}

function questionRelevance(question = {}, {
  tagHints = [],
  sessionHints = { slugs: [], tags: [] },
  session = {},
} = {}) {
  const qTags = normalizeQuestionTags(question.tags);
  const tagSet = new Set(qTags);
  const promptText = [
    question.prompt,
    question.questionType,
    Array.isArray(question.options) ? question.options.join(' ') : '',
    session.sessionName,
    session.sessionSlug,
    sessionContextFromPolicySession(session),
  ].map((value) => safeString(value).toLowerCase()).join(' ');
  const matchedTags = [];
  let score = 0;
  tagHints.forEach((tag) => {
    if (tagSet.has(tag)) {
      score += 20;
      matchedTags.push(tag);
    } else if (tag && promptText.includes(tag.replace(/-/g, ' '))) {
      score += 6;
      matchedTags.push(tag);
    }
  });
  const matchedSessions = [];
  const questionSlug = sanitizeSessionSlug(question.sessionSlug || session.sessionSlug);
  sessionHints.slugs.forEach((slug) => {
    if (slug && slug === questionSlug) {
      score += 30;
      matchedSessions.push(slug);
    }
  });
  sessionHints.tags.forEach((tag) => {
    if (tagSet.has(tag) || promptText.includes(tag.replace(/-/g, ' '))) {
      score += 8;
      if (!matchedTags.includes(tag)) matchedTags.push(tag);
    }
  });
  return {
    score,
    matchedTags: [...new Set(matchedTags)],
    matchedSessions: [...new Set(matchedSessions)],
  };
}

function rankQuestionsByPreferences(questions = [], input = {}, context = {}) {
  const tagHints = normalizePreferenceTagHints(input);
  const sessionHints = normalizePreferenceSessionHints(input);
  if (!tagHints.length && !sessionHints.slugs.length && !sessionHints.tags.length) {
    return {
      questions,
      relevance: {
        mode: 'none',
        tags: [],
        sessionsAttended: [],
      },
    };
  }
  const ranked = questions.map((question, index) => {
    const relevance = questionRelevance(question, {
      tagHints,
      sessionHints,
      session: context.session,
    });
    return { question: { ...question, relevance }, index, relevance };
  });
  const mode = lower(input.relevanceMode);
  const filtered = ['filter', 'relevant_only', 'relevant-only'].includes(mode)
    ? ranked.filter((entry) => entry.relevance.score > 0)
    : ranked;
  filtered.sort((left, right) => right.relevance.score - left.relevance.score || left.index - right.index);
  return {
    questions: filtered.map((entry) => entry.question),
    relevance: {
      mode: filtered.length === ranked.length ? 'rank' : 'filter',
      tags: tagHints,
      sessionsAttended: sessionHints.slugs,
      sessionTags: sessionHints.tags,
    },
  };
}

async function loadPublicQuestionsForHandoff({ env = {}, context = {}, waitUntil = null } = {}) {
  const loaded = await loadQuestionsForSession(env, context.session.sessionSlug, { waitUntil });
  const questions = (Array.isArray(loaded.questions) ? loaded.questions : [])
    .map((question) => publicAgentQuestion(question, { session: context.session }))
    .filter((question) => question.questionId);
  return { loaded, questions };
}

async function handleQuestionsRequest({ env = {}, context = {}, input = {}, waitUntil = null } = {}) {
  const { loaded, questions } = await loadPublicQuestionsForHandoff({ env, context, waitUntil });
  const ranked = rankQuestionsByPreferences(questions, input, context);
  const requestedQuestionId = safeString(input.questionId);
  const responseQuestions = requestedQuestionId
    ? ranked.questions.filter((question) => safeString(question.questionId) === requestedQuestionId)
    : ranked.questions;
  const flag = await readAgentSkillUpdateFlag(env);
  const body = {
    ok: true,
    sessionSlug: context.session.sessionSlug,
    permissionMode: context.permission.mode,
    questionSource: loaded.source || '',
    questionSourceReason: loaded.reason || '',
    relevance: ranked.relevance,
    skillVersion: CE_TELEGRAM_AGENT_HANDOFF_SKILL_VERSION,
    skillUpdateAvailable: flag.updateAvailable === true,
    questions: responseQuestions,
  };
  assertNoSecretShape(body, 'Telegram questions response must not serialize secrets.');
  return json(body);
}

async function handleTagsRequest({ env = {}, context = {}, waitUntil = null } = {}) {
  const { questions } = await loadPublicQuestionsForHandoff({ env, context, waitUntil });
  const counts = new Map();
  questions.forEach((question) => {
    normalizeQuestionTags(question.tags).forEach((tag) => {
      counts.set(tag, (counts.get(tag) || 0) + 1);
    });
  });
  const tags = Array.from(counts.entries())
    .map(([tag, count]) => ({ tag, count }))
    .sort((left, right) => right.count - left.count || left.tag.localeCompare(right.tag))
    .slice(0, 200);
  const payload = {
    ok: true,
    sessionSlug: context.session.sessionSlug,
    tags,
    total: tags.length,
  };
  assertNoSecretShape(payload, 'Telegram tags response must not serialize secrets.');
  return json(payload);
}

function emptyTagsResponse(sessionSlug = '') {
  const payload = {
    ok: true,
    sessionSlug: sanitizeSessionSlug(sessionSlug),
    tags: [],
    total: 0,
  };
  assertNoSecretShape(payload, 'Telegram empty tags response must not serialize secrets.');
  return json(payload);
}

async function handleNextQuestionRequest({ env = {}, context = {}, input = {}, waitUntil = null } = {}) {
  const { loaded, questions } = await loadPublicQuestionsForHandoff({ env, context, waitUntil });
  const ranked = rankQuestionsByPreferences(questions, input, context);
  const queueConfig = await loadTelegramQuestionQueueConfig({
    env,
    sessionSlug: context.session.sessionSlug,
  });
  const selected = await selectNextTelegramQuestion({
    env,
    sessionSlug: context.session.sessionSlug,
    telegramUserId: context.normalized.user.telegramUserId,
    questions: ranked.questions,
    sponsoredQuestionIds: queueConfig.sponsoredQuestionIds,
    input,
    createdAt: input.createdAt || null,
  });
  return json({
    ok: selected.ok,
    sessionSlug: context.session.sessionSlug,
    permissionMode: context.permission.mode,
    questionSource: loaded.source || '',
    questionSourceReason: loaded.reason || '',
    relevance: ranked.relevance,
    queueConfig: {
      source: queueConfig.source || '',
      sponsoredQuestionCount: queueConfig.sponsoredQuestionIds.length,
    },
    question: selected.question || null,
    sponsored: selected.sponsored === true,
    reason: selected.reason,
    queue: selected.queue,
  }, { status: selected.ok ? 200 : 404 });
}

function normalizeQuestionQueueRefs(value = []) {
  const source = Array.isArray(value) ? value : safeString(value).split(/[\n,;|]+/);
  return source
    .map((entry) => {
      if (entry && typeof entry === 'object' && !Array.isArray(entry)) {
        return safeString(entry.questionId || entry.id || entry.value || entry.label || entry.name);
      }
      return safeString(entry);
    })
    .filter(Boolean)
    .filter((entry, index, values) => values.indexOf(entry) === index)
    .slice(0, 50);
}

function normalizeQuestionQueueReferenceInputs(input = {}) {
  return normalizeQuestionQueueRefs(
    input.references ||
    input.reference ||
    input.queries ||
    input.query ||
    input.sponsoredQuestionRefs ||
    input.questionRefs ||
    input.sponsoredQuestionIds ||
    input.questionIds ||
    input.sponsoredQuestions ||
    input.questionsToSponsor ||
    input.ids
  );
}

function questionQueueCandidates(questions = []) {
  return (Array.isArray(questions) ? questions : [])
    .filter((question) => question?.answerable === true)
    .filter((question) => safeString(question.questionId) && safeString(question.prompt));
}

function findQuestionQueueCandidate(questions = [], ref = '') {
  const token = safeString(ref);
  if (!token) return null;
  const numeric = Number(token);
  if (Number.isInteger(numeric) && numeric > 0 && numeric <= questions.length) {
    return questions[numeric - 1] || null;
  }
  const normalized = lower(token);
  return questions.find((question) => (
    lower(question.questionId) === normalized ||
    lower(question.id) === normalized ||
    lower(question.questionId).startsWith(normalized)
  )) || null;
}

function tokenizeQuestionQueueReference(value = '') {
  const stop = new Set([
    'a', 'an', 'and', 'are', 'as', 'be', 'by', 'for', 'from', 'is', 'it',
    'make', 'mark', 'of', 'on', 'or', 'question', 'questions', 'sponsor',
    'sponsored', 'that', 'the', 'this', 'to', 'with',
  ]);
  return lower(value)
    .split(/[^a-z0-9]+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3 && !stop.has(token))
    .filter((token, index, values) => values.indexOf(token) === index)
    .slice(0, 16);
}

function questionQueueCandidateSearchText(question = {}) {
  return [
    question.questionId,
    question.prompt,
    question.questionType,
    Array.isArray(question.tags) ? question.tags.join(' ') : '',
    Array.isArray(question.options) ? question.options.join(' ') : '',
  ].map((value) => safeString(value).toLowerCase()).join(' ');
}

function scoreQuestionQueueCandidate(question = {}, ref = '') {
  const tokens = tokenizeQuestionQueueReference(ref);
  if (!tokens.length) return 0;
  const haystack = questionQueueCandidateSearchText(question);
  let score = 0;
  tokens.forEach((token) => {
    if (lower(question.questionId) === token) score += 100;
    if (haystack.includes(token)) score += 10;
    if ((Array.isArray(question.tags) ? question.tags : []).map(lower).includes(token)) score += 12;
  });
  return score;
}

function findQuestionQueueCandidateByText(questions = [], ref = '') {
  const scored = questions
    .map((question) => ({ question, score: scoreQuestionQueueCandidate(question, ref) }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score);
  return scored[0]?.question || null;
}

function resolveQuestionQueueRefs(input = {}, questions = []) {
  const refs = normalizeQuestionQueueRefs(
    input.sponsoredQuestionIds ||
    input.questionIds ||
    input.sponsoredQuestions ||
    input.questions ||
    input.ids
  );
  const ids = [];
  const skipped = [];
  refs.forEach((ref) => {
    const question = findQuestionQueueCandidate(questions, ref);
    const questionId = safeString(question?.questionId);
    if (!question || !questionId) {
      skipped.push(ref);
      return;
    }
    if (!ids.includes(questionId)) ids.push(questionId);
  });
  return { refs, ids, skipped };
}

function resolveNaturalQuestionQueueRefs(input = {}, questions = []) {
  const refs = normalizeQuestionQueueReferenceInputs(input);
  const instruction = safeString(input.instruction || input.promptRequest || input.request);
  if (!refs.length && instruction && !/\b(create|draft|new|write|add)\b/i.test(instruction)) {
    refs.push(instruction);
  }
  const ids = [];
  const matches = [];
  const skipped = [];
  refs.forEach((ref) => {
    const question = findQuestionQueueCandidate(questions, ref) || findQuestionQueueCandidateByText(questions, ref);
    const questionId = safeString(question?.questionId);
    if (!question || !questionId) {
      skipped.push(ref);
      return;
    }
    if (!ids.includes(questionId)) ids.push(questionId);
    matches.push({
      ref,
      question: questionQueueCandidateSummary(question, questions.indexOf(question)),
    });
  });
  return { refs, ids, matches, skipped };
}

function topicFromInstruction(value = '') {
  const text = safeString(value).replace(/\s+/g, ' ');
  if (!text) return '';
  const quoted = text.match(/["“”']([^"“”']{4,160})["“”']/);
  if (quoted?.[1]) return safeString(quoted[1]);
  const about = text.match(/\babout\s+(.+?)(?:\s+(?:and|then)\s+(?:make|mark|sponsor)|$)/i);
  if (about?.[1]) {
    return safeString(about[1])
      .replace(/\b(as|a)?\s*sponsored\s+question\b.*$/i, '')
      .replace(/\b(make|mark)\s+it\s+sponsored\b.*$/i, '')
      .replace(/[.?!]+$/g, '');
  }
  return '';
}

function normalizeQuestionDraftInputs(input = {}) {
  const source = input.createQuestions || input.newQuestions || input.questionsToCreate || input.draftQuestions || [];
  const entries = Array.isArray(source) ? source : (source ? [source] : []);
  const questions = entries.map((entry) => {
    if (typeof entry === 'string') return { prompt: entry };
    if (entry && typeof entry === 'object' && !Array.isArray(entry)) return entry;
    return null;
  }).filter(Boolean);
  const directPrompt = safeString(input.createQuestionPrompt || input.newQuestionPrompt);
  if (directPrompt) questions.push({ prompt: directPrompt, questionType: input.questionType });
  const instruction = safeString(input.instruction || input.promptRequest || input.request);
  if (input.create === true && instruction) {
    const topic = topicFromInstruction(instruction) || (!questions.length ? instruction : '');
    if (topic) questions.push({ prompt: `Should this session prioritize ${topic}?`, questionType: input.questionType || 'binary' });
  } else if (/\b(create|draft|new|write|add)\b/i.test(instruction) && /\bquestion\b/i.test(instruction)) {
    const topic = topicFromInstruction(instruction);
    if (topic) questions.push({ prompt: `Should this session prioritize ${topic}?`, questionType: input.questionType || 'binary' });
  }
  return questions
    .map((entry) => ({
      prompt: safeString(entry.prompt || entry.questionText || entry.text).replace(/\s+/g, ' ').slice(0, 1000),
      questionType: safeString(entry.questionType || entry.type || input.questionType || 'binary') || 'binary',
      options: Array.isArray(entry.options) ? entry.options.map(safeString).filter(Boolean).slice(0, 12) : [],
      tags: normalizeQuestionTags(entry.tags || input.tags),
      sessionContext: safeString(entry.sessionContext || input.sessionContext || input.context || sessionContextFromPolicySession(input.session || {})),
    }))
    .filter((entry) => entry.prompt)
    .filter((entry, index, values) => values.findIndex((candidate) => lower(candidate.prompt) === lower(entry.prompt)) === index)
    .slice(0, 20);
}

function questionQueueCandidateSummary(question = {}, index = 0) {
  return {
    index: index + 1,
    questionId: safeString(question.questionId),
    questionType: safeString(question.questionType),
    prompt: safeString(question.prompt),
    tags: Array.isArray(question.tags) ? question.tags.map(safeString).filter(Boolean) : [],
  };
}

function isQuestionQueueClearRequested(input = {}) {
  const operation = lower(input.operation);
  const clear = lower(input.clearQueue);
  return ['clear', 'reset', 'none', 'empty'].includes(operation) ||
    ['true', '1', 'yes', 'on'].includes(clear);
}

async function loadAgentAdminStatus({ env = {}, context = {}, input = {} } = {}) {
  const manager = await canManageResponseExportAllowlist({
    env,
    normalized: context.normalized,
    session: context.session,
    createdAt: input.createdAt || null,
  });
  return {
    ok: true,
    sessionSlug: context.session.sessionSlug,
    telegramUserId: context.normalized.user.telegramUserId,
    accountAddress: manager.accountAddress || '',
    admin: manager.ok === true,
    reason: manager.ok ? 'admin_allowed' : manager.reason,
    capabilities: {
      canManageSponsoredQuestions: manager.ok === true,
      canManageResponseExportAllowlist: manager.ok === true,
    },
  };
}

async function requireQuestionQueueAdmin({
  env = {},
  context = {},
  input = {},
  allowDelegatedAdmin = false,
} = {}) {
  if (context.authMode !== 'service_token' && !(allowDelegatedAdmin && context.authMode === 'telegram_agent_delegation_token')) {
    return { ok: false, status: 403, reason: 'question_queue_service_token_required' };
  }
  const manager = await canManageResponseExportAllowlist({
    env,
    normalized: context.normalized,
    session: context.session,
    createdAt: input.createdAt || null,
  });
  if (!manager.ok) {
    return {
      ok: false,
      status: 403,
      reason: manager.reason || 'question_queue_admin_required',
      accountAddress: manager.accountAddress || '',
    };
  }
  return { ok: true, manager };
}

async function buildSponsoredQuestionPlan({
  env = {},
  context = {},
  input = {},
  waitUntil = null,
} = {}) {
  const admin = await requireQuestionQueueAdmin({
    env,
    context,
    input,
    allowDelegatedAdmin: true,
  });
  if (!admin.ok) return { ok: false, admin, status: admin.status || 403 };
  const { loaded, questions } = await loadPublicQuestionsForHandoff({ env, context, waitUntil });
  const candidates = questionQueueCandidates(questions);
  const resolved = resolveNaturalQuestionQueueRefs(input, candidates);
  const drafts = normalizeQuestionDraftInputs({ ...input, session: context.session });
  const sponsoredQuestionIds = [...resolved.ids];
  const queueConfig = await loadTelegramQuestionQueueConfig({
    env,
    sessionSlug: context.session.sessionSlug,
  });
  const existingSponsoredQuestionIds = Array.isArray(queueConfig.sponsoredQuestionIds)
    ? queueConfig.sponsoredQuestionIds
    : [];
  return {
    ok: true,
    sessionSlug: context.session.sessionSlug,
    permissionMode: context.permission.mode,
    admin: {
      accountAddress: admin.manager.accountAddress,
      canManageSponsoredQuestions: true,
    },
    questionSource: loaded.source || '',
    questionSourceReason: loaded.reason || '',
    existingSponsoredQuestionIds,
    mode: input.replace === true || lower(input.mode) === 'replace' ? 'replace' : 'append',
    resolvedExistingQuestions: resolved.matches,
    draftQuestions: drafts,
    sponsoredQuestionIds,
    skipped: resolved.skipped,
    candidates: candidates.slice(0, 25).map(questionQueueCandidateSummary),
    requiresConfirmation: true,
    confirmation: {
      endpoint: '/telegram/agent/api/question-queue/apply',
      required: 'Show resolvedExistingQuestions and draftQuestions to the admin, then call apply only after explicit approval.',
    },
  };
}

function hasExplicitSponsoredQueueApproval(input = {}) {
  if (input.approved === true || input.confirm === true || input.confirmed === true) return true;
  const text = lower(input.approvalText || input.confirmationText || input.userApproval);
  return /\b(approve|approved|confirm|confirmed|yes|go ahead|do it|ship it|make.+sponsored)\b/.test(text);
}

async function handleAdminStatusRequest({ env = {}, context = {}, input = {} } = {}) {
  const status = await loadAgentAdminStatus({ env, context, input });
  return json(status);
}

async function handleAdminDefaultSessionRequest({
  env = {},
  context = {},
  input = {},
  method = 'GET',
} = {}) {
  const methodName = safeString(method).toUpperCase();
  if (methodName === 'GET') {
    const admin = await requireQuestionQueueAdmin({ env, context, input, allowDelegatedAdmin: true });
    if (!admin.ok) {
      return json({
        ok: false,
        reason: admin.reason,
        accountAddress: admin.accountAddress || '',
      }, { status: admin.status || 403 });
    }
    const policy = await loadSessionPolicy(env);
    const payload = {
      ok: true,
      effectiveDefaultSessionSlug: policy.defaultSessionSlug,
      adminDefaultSessionSlug: policy.adminDefaultSessionSlug || '',
      scheduledDefaultSessionSlug: policy.scheduledDefaultSessionSlug || policy.defaultSessionSlug,
      configuredDefaultSessionSlug: policy.configuredDefaultSessionSlug || '',
      adminDefaultSessionInvalidSlug: policy.adminDefaultSessionInvalidSlug || '',
    };
    assertNoSecretShape(payload, 'Telegram admin default-session status must not serialize secrets.');
    return json(payload);
  }

  const clearRequested = methodName === 'DELETE' ||
    (methodName === 'POST' && normalizeBoolean(input.clear, false));
  if (methodName === 'POST' && !clearRequested) {
    const admin = await requireQuestionQueueAdmin({ env, context, input, allowDelegatedAdmin: false });
    if (!admin.ok) {
      return json({
        ok: false,
        reason: admin.reason,
        accountAddress: admin.accountAddress || '',
      }, { status: admin.status || 403 });
    }
    const slug = sanitizeSessionSlug(input.sessionSlug || input.defaultSessionSlug || input.slug);
    if (!slug) return json({ ok: false, reason: 'invalid_session_slug' }, { status: 400 });
    const policy = await loadSessionPolicy(env);
    const resolved = resolveSessionInvocation(policy, slug);
    if (!resolved.ok) {
      return json({
        ok: false,
        reason: resolved.reason,
        sessionSlug: slug,
      }, { status: resolved.reason === 'session_not_linked' ? 404 : 400 });
    }
    const written = await writeAdminDefaultSessionOverride({
      env,
      sessionSlug: resolved.session.sessionSlug,
      accountAddress: admin.manager?.accountAddress || '',
      createdAt: input.createdAt || null,
    });
    if (!written.ok) {
      return json({
        ok: false,
        reason: written.reason || 'admin_default_session_write_failed',
      }, { status: 500 });
    }
    const payload = {
      ok: true,
      adminDefaultSessionSlug: resolved.session.sessionSlug,
      effectiveDefaultSessionSlug: resolved.session.sessionSlug,
    };
    assertNoSecretShape(payload, 'Telegram admin default-session set response must not serialize secrets.');
    return json(payload);
  }

  if (methodName === 'DELETE' || clearRequested) {
    const admin = await requireQuestionQueueAdmin({ env, context, input, allowDelegatedAdmin: false });
    if (!admin.ok) {
      return json({
        ok: false,
        reason: admin.reason,
        accountAddress: admin.accountAddress || '',
      }, { status: admin.status || 403 });
    }
    const cleared = await clearAdminDefaultSessionOverride(env);
    if (!cleared.ok) {
      return json({
        ok: false,
        reason: cleared.reason || 'admin_default_session_clear_failed',
      }, { status: 500 });
    }
    const policy = await loadSessionPolicy(env);
    const payload = {
      ok: true,
      cleared: true,
      effectiveDefaultSessionSlug: policy.defaultSessionSlug,
      configuredDefaultSessionSlug: policy.configuredDefaultSessionSlug || '',
    };
    assertNoSecretShape(payload, 'Telegram admin default-session clear response must not serialize secrets.');
    return json(payload);
  }

  return json({ ok: false, reason: 'method_not_allowed' }, { status: 405 });
}

async function handleAdminSkillUpdateRequest({
  env = {},
  context = {},
  input = {},
  method = 'GET',
} = {}) {
  const methodName = safeString(method).toUpperCase();
  if (methodName === 'GET') {
    const admin = await requireQuestionQueueAdmin({ env, context, input, allowDelegatedAdmin: true });
    if (!admin.ok) {
      const payload = { ok: false, reason: admin.reason, accountAddress: admin.accountAddress || '' };
      assertNoSecretShape(payload, 'Telegram admin skill-update denied response must not serialize secrets.');
      return json(payload, { status: admin.status || 403 });
    }
    const flag = await readAgentSkillUpdateFlag(env);
    const payload = {
      ok: true,
      updateAvailable: flag.updateAvailable === true,
      latestVersion: flag.latestVersion || CE_TELEGRAM_AGENT_HANDOFF_SKILL_VERSION,
      updateNote: flag.note || '',
      version: CE_TELEGRAM_AGENT_HANDOFF_SKILL_VERSION,
    };
    assertNoSecretShape(payload, 'Telegram admin skill-update status must not serialize secrets.');
    return json(payload);
  }

  if (methodName === 'POST') {
    const admin = await requireQuestionQueueAdmin({ env, context, input, allowDelegatedAdmin: false });
    if (!admin.ok) {
      const payload = { ok: false, reason: admin.reason, accountAddress: admin.accountAddress || '' };
      assertNoSecretShape(payload, 'Telegram admin skill-update denied response must not serialize secrets.');
      return json(payload, { status: admin.status || 403 });
    }
    const written = await writeAgentSkillUpdateFlag({
      env,
      latestVersion: input.latestVersion || CE_TELEGRAM_AGENT_HANDOFF_SKILL_VERSION,
      note: input.note || input.updateNote || '',
      accountAddress: admin.manager?.accountAddress || '',
      createdAt: input.createdAt || null,
    });
    if (!written.ok) {
      const payload = { ok: false, reason: written.reason || 'agent_skill_update_write_failed' };
      assertNoSecretShape(payload, 'Telegram admin skill-update write failure must not serialize secrets.');
      return json(payload, { status: 500 });
    }
    const payload = {
      ok: true,
      updateAvailable: true,
      latestVersion: written.latestVersion || CE_TELEGRAM_AGENT_HANDOFF_SKILL_VERSION,
      version: CE_TELEGRAM_AGENT_HANDOFF_SKILL_VERSION,
    };
    assertNoSecretShape(payload, 'Telegram admin skill-update set response must not serialize secrets.');
    return json(payload);
  }

  if (methodName === 'DELETE') {
    const admin = await requireQuestionQueueAdmin({ env, context, input, allowDelegatedAdmin: false });
    if (!admin.ok) {
      const payload = { ok: false, reason: admin.reason, accountAddress: admin.accountAddress || '' };
      assertNoSecretShape(payload, 'Telegram admin skill-update denied response must not serialize secrets.');
      return json(payload, { status: admin.status || 403 });
    }
    const cleared = await clearAgentSkillUpdateFlag(env);
    if (!cleared.ok) {
      const payload = { ok: false, reason: cleared.reason || 'agent_skill_update_clear_failed' };
      assertNoSecretShape(payload, 'Telegram admin skill-update clear failure must not serialize secrets.');
      return json(payload, { status: 500 });
    }
    const payload = {
      ok: true,
      updateAvailable: false,
      cleared: true,
      latestVersion: CE_TELEGRAM_AGENT_HANDOFF_SKILL_VERSION,
      version: CE_TELEGRAM_AGENT_HANDOFF_SKILL_VERSION,
    };
    assertNoSecretShape(payload, 'Telegram admin skill-update clear response must not serialize secrets.');
    return json(payload);
  }

  const payload = { ok: false, reason: 'method_not_allowed' };
  assertNoSecretShape(payload, 'Telegram admin skill-update method response must not serialize secrets.');
  return json(payload, { status: 405 });
}

async function handleOnboardingRequest({
  env = {},
  context = {},
  input = {},
  body = {},
  method = 'GET',
} = {}) {
  const sessionSlug = context.session.sessionSlug;
  const telegramUserId = context.normalized.user.telegramUserId;
  const current = await loadTelegramAgentSettings({ env, sessionSlug, telegramUserId });
  if (safeString(method).toUpperCase() !== 'POST') {
    return json(publicOnboardingState({ sessionSlug, settings: current }));
  }
  const completedAt = safeString(input.completedAt || input.createdAt) || new Date().toISOString();
  const answers = normalizeOnboardingAnswers(body, current);
  const patch = {
    ...settingsPatchFromOnboardingAnswers(answers, completedAt),
    topicPreferences: answers.preference_tailoring === true
      ? normalizeOnboardingTopicPreferences(body, current)
      : [],
  };
  const groupMembership = normalizeOnboardingGroupMembershipInput(body, answers);
  let savedGroups = null;
  if (hasOnboardingGroupMembership(groupMembership)) {
    savedGroups = await saveTelegramLightweightGroupMembership({
      env,
      session: context.session,
      telegramUserId,
      accountAddress: context.delegation?.accountAddress || body.accountAddress || '',
      selections: groupMembership.selections,
      details: groupMembership.details,
      createdAt: completedAt,
    });
  }
  const saved = await saveTelegramAgentSettingsPatch({
    env,
    sessionSlug,
    telegramUserId,
    patch,
    createdAt: completedAt,
  });
  if (!saved.ok) {
    return json({
      ok: false,
      reason: saved.reason || 'onboarding_settings_save_failed',
    }, { status: 400 });
  }
  const payload = {
    ...publicOnboardingState({ sessionSlug, settings: saved.settings }),
    ...(savedGroups?.ok ? { groups: savedGroups.groups } : {}),
  };
  assertNoSecretShape(payload, 'Telegram agent onboarding save response must not serialize secrets.');
  return json(payload);
}

async function loadAdminMetricsCache(env = {}, cacheKey = '') {
  const kv = env?.AGENT_ACTION_KV;
  if (!cacheKey || !kv || typeof kv.get !== 'function') return null;
  const cached = safeJsonParse(await kv.get(cacheKey).catch(() => null), null);
  if (!cached || typeof cached !== 'object' || Array.isArray(cached) || cached.ok !== true) return null;
  assertNoSecretShape(cached, 'Cached Telegram admin metrics must not serialize secrets.');
  return {
    ...cached,
    cached: true,
  };
}

async function saveAdminMetricsCache(env = {}, cacheKey = '', payload = {}) {
  const kv = env?.AGENT_ACTION_KV;
  if (!cacheKey || !kv || typeof kv.put !== 'function') return;
  assertNoSecretShape(payload, 'Telegram admin metrics cache payload must not serialize secrets.');
  await kv.put(cacheKey, JSON.stringify(payload), { expirationTtl: ADMIN_METRICS_CACHE_TTL_SECONDS });
}

function normalizeResultViewType(value = '') {
  const normalized = safeString(value || 'polis_clusters')
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48);
  return normalized || 'polis_clusters';
}

function resultViewCacheKey(sessionSlug = '', viewType = '', dataVersionKey = '') {
  const slug = sanitizeSessionSlug(sessionSlug);
  const type = normalizeResultViewType(viewType);
  const fingerprint = stableFingerprint(`${slug}|${type}|${safeString(dataVersionKey)}`);
  return `${RESULT_VIEW_CACHE_KV_PREFIX}${slug}:${type}:${fingerprint}`;
}

function normalizeGenericResultViewValue(value = {}, depth = 0) {
  if (value == null) return null;
  if (typeof value === 'string') return safeString(value).slice(0, RESULT_VIEW_VALUE_MAX_CHARS);
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'boolean') return value;
  if (depth >= RESULT_VIEW_GENERIC_MAX_DEPTH) return null;
  if (Array.isArray(value)) {
    return value
      .slice(0, RESULT_VIEW_GENERIC_MAX_ARRAY_ITEMS)
      .map((entry) => normalizeGenericResultViewValue(entry, depth + 1))
      .filter((entry) => entry !== undefined);
  }
  if (typeof value === 'object') {
    const out = {};
    Object.entries(value)
      .slice(0, RESULT_VIEW_GENERIC_MAX_OBJECT_KEYS)
      .forEach(([key, entry]) => {
        const safeKey = safeString(key).replace(/[^0-9A-Za-z_-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 64);
        if (!safeKey) return;
        const normalized = normalizeGenericResultViewValue(entry, depth + 1);
        if (normalized !== undefined) out[safeKey] = normalized;
      });
    return out;
  }
  return null;
}

function normalizeResultViewAnalysisValue(value = {}, viewType = 'polis_clusters') {
  const type = normalizeResultViewType(viewType);
  if (type !== 'polis_clusters') {
    return normalizeGenericResultViewValue(value);
  }
  const input = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const clustersInput = input.clusters && typeof input.clusters === 'object' && !Array.isArray(input.clusters)
    ? input.clusters
    : input;
  const clusters = {};
  for (const [clusterKey, clusterValue] of Object.entries(clustersInput || {})) {
    const key = safeString(clusterKey).replace(/[^0-9A-Za-z_-]+/g, '').slice(0, 24);
    if (!key || !clusterValue || typeof clusterValue !== 'object' || Array.isArray(clusterValue)) continue;
    clusters[key] = {
      name: safeString(clusterValue.name).slice(0, 160),
      short: safeString(clusterValue.short).slice(0, RESULT_VIEW_VALUE_MAX_CHARS),
      long: safeString(clusterValue.long).slice(0, RESULT_VIEW_VALUE_MAX_CHARS),
    };
  }
  return { clusters };
}

async function loadResultViewCache(env = {}, {
  sessionSlug = '',
  viewType = '',
  dataVersionKey = '',
} = {}) {
  const kv = env?.AGENT_ACTION_KV;
  if (!kv || typeof kv.get !== 'function') return null;
  const key = resultViewCacheKey(sessionSlug, viewType, dataVersionKey);
  const cached = safeJsonParse(await kv.get(key).catch(() => null), null);
  if (!cached || typeof cached !== 'object' || Array.isArray(cached) || cached.ok !== true) return null;
  assertNoSecretShape(cached, 'Cached Telegram result view must not serialize secrets.');
  return {
    ...cached,
    cached: true,
    cacheLayer: 'kv',
  };
}

async function saveResultViewCache(env = {}, {
  sessionSlug = '',
  viewType = '',
  dataVersionKey = '',
  value = {},
} = {}) {
  const kv = env?.AGENT_ACTION_KV;
  if (!kv || typeof kv.put !== 'function') return null;
  const slug = sanitizeSessionSlug(sessionSlug);
  const type = normalizeResultViewType(viewType);
  const dataKey = safeString(dataVersionKey).slice(0, 512);
  const payload = {
    ok: true,
    type: 'telegram_result_view_cache',
    sessionSlug: slug,
    viewType: type,
    dataVersionKey: dataKey,
    generatedAt: new Date().toISOString(),
    model: 'gpt-5.5',
    reasoning_effort: 'high',
    value: normalizeResultViewAnalysisValue(value, type),
  };
  assertNoSecretShape(payload, 'Telegram result view cache payload must not serialize secrets.');
  const serialized = JSON.stringify(payload);
  if (new TextEncoder().encode(serialized).byteLength > RESULT_VIEW_CACHE_MAX_BYTES) {
    return { ok: false, reason: 'result_view_cache_value_too_large' };
  }
  await kv.put(resultViewCacheKey(slug, type, dataKey), serialized, {
    expirationTtl: RESULT_VIEW_CACHE_TTL_SECONDS,
  });
  return payload;
}

async function handleResultViewCacheRequest({ env = {}, context = {}, input = {}, request = null } = {}) {
  const method = safeString(request?.method || 'GET').toUpperCase();
  const sessionSlug = context.session.sessionSlug;
  const viewType = normalizeResultViewType(input.viewType || input.type || 'polis_clusters');
  const dataVersionKey = safeString(input.dataVersionKey || input.dataKey || input.cacheKey).slice(0, 512);
  if (!dataVersionKey) {
    return jsonResultViewCache(request, env, { ok: false, reason: 'data_version_key_required' }, { status: 400 });
  }
  if (method === 'GET') {
    const cached = await loadResultViewCache(env, { sessionSlug, viewType, dataVersionKey });
    if (cached) return jsonResultViewCache(request, env, cached);
    return jsonResultViewCache(request, env, {
      ok: true,
      cached: false,
      cacheLayer: 'miss',
      sessionSlug,
      viewType,
      dataVersionKey,
    });
  }
  if (method !== 'POST') {
    return jsonResultViewCache(request, env, { ok: false, reason: 'method_not_allowed' }, { status: 405 });
  }
  const saved = await saveResultViewCache(env, {
    sessionSlug,
    viewType,
    dataVersionKey,
    value: input.value || input.result || input.cache || {},
  });
  if (saved?.ok === false) {
    return jsonResultViewCache(request, env, saved, { status: 413 });
  }
  if (!saved) {
    return jsonResultViewCache(request, env, { ok: false, reason: 'result_view_cache_unavailable' }, { status: 503 });
  }
  return jsonResultViewCache(request, env, {
    ...saved,
    cached: false,
    cacheLayer: 'stored',
  });
}

async function handleResultViewCacheHttpRequest({ request, env = {} } = {}) {
  const cors = resultViewCacheCorsHeaders(request, env);
  if (cors === null) {
    return json({ ok: false, reason: 'origin_not_allowed' }, { status: 403 });
  }
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors || {} });
  }
  const url = new URL(request.url);
  const body = await readRequestJson(request);
  const auth = await authenticateAgentHandoff(request, env);
  if (!auth.ok) {
    return jsonResultViewCache(request, env, { ok: false, reason: auth.reason }, { status: auth.status || 401 });
  }
  const delegated = applyDelegationToInput(auth, inputFromRequest(request, body), url.pathname, request.method);
  if (!delegated.ok) {
    return jsonResultViewCache(request, env, {
      ok: false,
      reason: delegated.reason,
      requiredScope: delegated.requiredScope,
      sessionSlug: delegated.sessionSlug || '',
    }, { status: delegated.status || 403 });
  }
  const input = delegated.input;
  const context = await resolveHandoffContext({
    env,
    input,
    auth,
    requireQuestionAuthoring: false,
  });
  if (!context.ok) {
    return jsonResultViewCache(request, env, {
      ok: false,
      reason: context.reason,
      sessionSlug: context.sessionSlug || '',
    }, { status: context.status || 400 });
  }
  return handleResultViewCacheRequest({ env, context, input, request });
}

async function buildAdminMetricsSnapshot({
  env = {},
  scope = 'session',
  sessionSlug = '',
} = {}) {
  const scopedSessionSlug = scope === 'session' ? sanitizeSessionSlug(sessionSlug) : '';
  const inScope = (slug = '') => {
    const normalized = sanitizeSessionSlug(slug);
    return scope !== 'session' || normalized === scopedSessionSlug;
  };
  const totals = emptyAdminMetricTotals();
  const perSession = new Map();
  const onboardedUsers = new Set();
  const respondents = new Set();
  const activitySessions = new Set();

  const tokenEntries = await listMetricKvEntriesByPrefix(env, TELEGRAM_AGENT_DELEGATION_TOKEN_KV_PREFIX);
  for (const entry of tokenEntries) {
    const metadata = entry.metadata && typeof entry.metadata === 'object' && !Array.isArray(entry.metadata)
      ? entry.metadata
      : null;
    let tokenSessionSlug = sanitizeSessionSlug(metadata?.sg);
    let telegramUserId = safeString(metadata?.u);
    if (!tokenSessionSlug || !telegramUserId) {
      const record = await readMetricRecord(env, entry.key);
      tokenSessionSlug = sanitizeSessionSlug(record?.sessionSlug);
      telegramUserId = safeString(record?.telegramUserId);
    }
    if (!tokenSessionSlug || !inScope(tokenSessionSlug)) continue;
    totals.agentsOnboarded += 1;
    activitySessions.add(tokenSessionSlug);
    incrementMetric(perSession, tokenSessionSlug, 'agentsOnboarded');
    if (telegramUserId) {
      onboardedUsers.add(telegramUserId);
      sessionMetric(perSession, tokenSessionSlug)?._usersOnboarded.add(telegramUserId);
    }
  }

  const proposedEntries = await listMetricKvEntriesByPrefix(env, PROPOSED_QUESTION_KV_PREFIX);
  for (const entry of proposedEntries) {
    const slug = sanitizeSessionSlug(entry.metadata?.sg) || sessionFromSessionFirstKey(entry.key, PROPOSED_QUESTION_KV_PREFIX);
    if (!slug || !inScope(slug)) continue;
    totals.questionsCreated += 1;
    activitySessions.add(slug);
    incrementMetric(perSession, slug, 'questionsCreated');
  }

  const draftEntries = await listMetricKvEntriesByPrefix(env, ANSWER_DRAFT_KV_PREFIX);
  for (const entry of draftEntries) {
    const slug = sanitizeSessionSlug(entry.metadata?.sg) || sessionFromDraftKey(entry.key);
    if (!slug || !inScope(slug)) continue;
    totals.answerDrafts += 1;
    activitySessions.add(slug);
    incrementMetric(perSession, slug, 'answerDrafts');
  }

  const groupEntries = await listMetricKvEntriesByPrefix(env, LIGHTWEIGHT_GROUP_PROPOSAL_KV_PREFIX);
  for (const entry of groupEntries) {
    const slug = sanitizeSessionSlug(entry.metadata?.sg) || sessionFromSessionFirstKey(entry.key, LIGHTWEIGHT_GROUP_PROPOSAL_KV_PREFIX);
    if (!slug || !inScope(slug)) continue;
    totals.groupProposals += 1;
    activitySessions.add(slug);
    incrementMetric(perSession, slug, 'groupProposals');
  }

  const submitPrefix = scopedSessionSlug ? submitRequestSessionKvPrefix(scopedSessionSlug) : SUBMIT_REQUEST_KV_PREFIX;
  const submitEntries = await listMetricKvEntriesByPrefix(env, submitPrefix, {
    limit: ADMIN_METRICS_SUBMIT_ENTRY_LIMIT,
  });
  const submittedStatuses = new Set(SUBMITTED_RESULT_STATUSES);
  for (const entry of submitEntries) {
    const meta = entry.metadata && typeof entry.metadata === 'object' && !Array.isArray(entry.metadata)
      ? entry.metadata
      : null;
    let status = safeString(meta?.st);
    let slug = sanitizeSessionSlug(meta?.sg);
    let telegramUserId = safeString(meta?.u);
    if (!status || !slug) {
      const record = await readMetricRecord(env, entry.key);
      status = status || safeString(record?.status);
      slug = slug || sanitizeSessionSlug(record?.sessionSlug);
      telegramUserId = telegramUserId || safeString(record?.telegramUserId);
    }
    slug = slug || scopedSessionSlug || sessionFromSessionFirstKey(entry.key, SUBMIT_REQUEST_SESSION_KV_PREFIX);
    if (!slug || !inScope(slug)) continue;
    if (!submittedStatuses.has(status)) continue;
    totals.questionsAnswered += 1;
    activitySessions.add(slug);
    incrementMetric(perSession, slug, 'questionsAnswered');
    if (telegramUserId) {
      respondents.add(`${slug}:${telegramUserId}`);
      sessionMetric(perSession, slug)?._respondents.add(telegramUserId);
    }
  }

  const submitUserPrefix = scopedSessionSlug
    ? `${SUBMIT_REQUEST_USER_KV_PREFIX}${scopedSessionSlug}:`
    : SUBMIT_REQUEST_USER_KV_PREFIX;
  const submitUserEntries = await listMetricKvEntriesByPrefix(env, submitUserPrefix, {
    limit: ADMIN_METRICS_SUBMIT_ENTRY_LIMIT,
  });
  for (const entry of submitUserEntries) {
    const parsed = userFromSubmitUserKey(entry.key);
    if (!parsed.sessionSlug || !parsed.telegramUserId || !inScope(parsed.sessionSlug)) continue;
    respondents.add(`${parsed.sessionSlug}:${parsed.telegramUserId}`);
    sessionMetric(perSession, parsed.sessionSlug)?._respondents.add(parsed.telegramUserId);
  }

  const registry = await listRegistrySessionsForBridge({ env }).catch(() => ({ ok: false, sessions: [] }));
  const registrySessionCount = Array.isArray(registry?.sessions) ? registry.sessions.length : 0;
  totals.distinctUsersOnboarded = onboardedUsers.size;
  totals.distinctRespondents = respondents.size;
  totals.sessionsWithBridgeActivity = activitySessions.size;
  totals.registrySessionCount = registrySessionCount;
  for (const metric of perSession.values()) {
    metric.registrySessionCount = registrySessionCount;
  }

  return {
    totals,
    perSession: [...perSession.values()]
      .map(publicSessionMetric)
      .sort((left, right) => left.sessionSlug.localeCompare(right.sessionSlug)),
  };
}

async function handleAdminMetricsRequest({ env = {}, context = {}, input = {} } = {}) {
  const manager = await canManageResponseExportAllowlist({
    env,
    normalized: context.normalized,
    session: context.session,
    createdAt: input.createdAt || null,
  });
  if (!manager.ok) {
    return json({
      ok: false,
      reason: 'metrics_admin_required',
      accountAddress: manager.accountAddress || '',
    }, { status: 403 });
  }
  const rootAdmin = isRootResponseExportAdmin(env, manager.accountAddress);
  const scope = rootAdmin ? 'global' : 'session';
  const sessionSlug = context.session.sessionSlug;
  const cacheKey = `${ADMIN_METRICS_CACHE_KV_PREFIX}${scope}:${scope === 'session' ? sessionSlug : 'all'}`;
  const cached = await loadAdminMetricsCache(env, cacheKey);
  if (cached) return json(cached);

  const computedAt = new Date().toISOString();
  const snapshot = await buildAdminMetricsSnapshot({ env, scope, sessionSlug });
  const payload = {
    ok: true,
    scope,
    ...(scope === 'session' ? { sessionSlug } : {}),
    computedAt,
    cached: false,
    definitions: {
      agentsOnboarded: 'Delegation-token mints observed by the worker; this is not a count of external skill installs.',
      registrySessionCount: 'Count of sessions from the cached on-chain SessionRegistry read; the worker does not create registry sessions.',
      sessionsWithBridgeActivity: 'Distinct session slugs with bridge KV activity such as token mints, drafts, proposed questions, group proposals, or submitted answers.',
      questionsAnswered: `Submit queue records with submitted statuses over the rolling ${Math.round(SUBMIT_REQUEST_TTL_SECONDS / 86400)} day submit-record window.`,
    },
    totals: snapshot.totals,
    ...(rootAdmin ? { perSession: snapshot.perSession } : {}),
  };
  assertNoSecretShape(payload, 'Telegram admin metrics response must not serialize secrets.');
  await saveAdminMetricsCache(env, cacheKey, payload);
  return json(payload);
}

async function handleQuestionQueuePlanRequest({
  env = {},
  context = {},
  input = {},
  waitUntil = null,
} = {}) {
  const plan = await buildSponsoredQuestionPlan({ env, context, input, waitUntil });
  if (!plan.ok) {
    return json({
      ok: false,
      reason: plan.admin?.reason || 'question_queue_admin_required',
      accountAddress: plan.admin?.accountAddress || '',
    }, { status: plan.status || 403 });
  }
  return json(plan);
}

async function handleQuestionQueueApplyRequest({
  env = {},
  context = {},
  input = {},
  waitUntil = null,
} = {}) {
  const plan = await buildSponsoredQuestionPlan({ env, context, input, waitUntil });
  if (!plan.ok) {
    return json({
      ok: false,
      reason: plan.admin?.reason || 'question_queue_admin_required',
      accountAddress: plan.admin?.accountAddress || '',
    }, { status: plan.status || 403 });
  }
  if (!hasExplicitSponsoredQueueApproval(input)) {
    return json({
      ...plan,
      ok: false,
      reason: 'sponsored_question_confirmation_required',
    }, { status: 400 });
  }
  const createdQuestions = [];
  const createdQuestionIds = [];
  for (const draft of plan.draftQuestions) {
    const saved = await persistTelegramProposedQuestion({
      env,
      normalized: context.normalized,
      sessionSlug: context.session.sessionSlug,
      prompt: draft.prompt,
      questionType: draft.questionType,
      options: draft.options,
      tags: draft.tags,
      sessionContext: draft.sessionContext || sessionContextFromPolicySession(context.session),
      metadata: {
        source: 'agent_handoff',
        authMode: safeString(context.authMode),
        endpoint: '/telegram/agent/api/question-queue/apply',
        sponsoredQuestion: true,
        approvalText: safeString(input.approvalText || input.confirmationText || input.userApproval).slice(0, 500),
      },
      createdAt: input.createdAt || null,
    });
    if (!saved.ok) {
      plan.skipped.push({ prompt: draft.prompt, reason: saved.reason || 'question_create_failed' });
      continue;
    }
    createdQuestionIds.push(saved.questionId);
    createdQuestions.push({
      questionId: saved.questionId,
      prompt: saved.question?.prompt || draft.prompt,
      questionType: saved.question?.questionType || draft.questionType,
    });
  }
  const baseIds = plan.mode === 'replace' ? [] : plan.existingSponsoredQuestionIds;
  const nextIds = [...baseIds, ...plan.sponsoredQuestionIds, ...createdQuestionIds]
    .map(safeString)
    .filter(Boolean)
    .filter((id, index, values) => values.indexOf(id) === index)
    .slice(0, 50);
  if (!nextIds.length) {
    return json({
      ...plan,
      ok: false,
      reason: 'sponsored_question_targets_required',
      createdQuestions,
    }, { status: 400 });
  }
  const saved = await saveTelegramQuestionQueueConfig({
    env,
    sessionSlug: context.session.sessionSlug,
    sponsoredQuestionIds: nextIds,
    updatedByTelegramUserId: context.normalized.user.telegramUserId,
    updatedByAccountAddress: plan.admin.accountAddress,
    createdAt: input.createdAt || null,
  });
  if (!saved.ok) {
    return json({
      ok: false,
      reason: saved.reason || 'question_queue_save_failed',
      sessionSlug: context.session.sessionSlug,
    }, { status: 500 });
  }
  return json({
    ok: true,
    sessionSlug: context.session.sessionSlug,
    mode: plan.mode,
    saved: true,
    questionQueue: {
      sponsoredQuestionIds: saved.config.sponsoredQuestionIds,
      sponsoredQuestionCount: saved.config.sponsoredQuestionIds.length,
      updatedAt: saved.config.updatedAt,
    },
    resolvedExistingQuestions: plan.resolvedExistingQuestions,
    createdQuestions,
    skipped: plan.skipped,
    approval: {
      approved: true,
      approvalText: safeString(input.approvalText || input.confirmationText || input.userApproval).slice(0, 500),
    },
  });
}

async function handleQuestionQueueRequest({
  env = {},
  context = {},
  input = {},
  waitUntil = null,
  method = 'GET',
} = {}) {
  const admin = await requireQuestionQueueAdmin({ env, context, input });
  if (!admin.ok) {
    return json({
      ok: false,
      reason: admin.reason,
      accountAddress: admin.accountAddress || '',
    }, { status: admin.status || 403 });
  }

  const { loaded, questions } = await loadPublicQuestionsForHandoff({ env, context, waitUntil });
  const candidates = questionQueueCandidates(questions);
  const candidateSummaries = candidates.map(questionQueueCandidateSummary);
  const writeRequested = safeString(method).toUpperCase() !== 'GET';
  const clearRequested = isQuestionQueueClearRequested(input);
  let skipped = [];
  let saved = null;

  if (writeRequested) {
    const resolved = clearRequested
      ? { refs: [], ids: [], skipped: [] }
      : resolveQuestionQueueRefs(input, candidates);
    skipped = resolved.skipped;
    if (!clearRequested && !resolved.refs.length) {
      return json({
        ok: false,
        reason: 'question_queue_question_ids_required',
        sessionSlug: context.session.sessionSlug,
        candidates: candidateSummaries,
      }, { status: 400 });
    }
    if (!clearRequested && !resolved.ids.length) {
      return json({
        ok: false,
        reason: 'question_queue_no_matching_questions',
        sessionSlug: context.session.sessionSlug,
        skipped,
        candidates: candidateSummaries,
      }, { status: 400 });
    }
    saved = await saveTelegramQuestionQueueConfig({
      env,
      sessionSlug: context.session.sessionSlug,
      sponsoredQuestionIds: clearRequested ? [] : resolved.ids,
      updatedByTelegramUserId: context.normalized.user.telegramUserId,
      updatedByAccountAddress: admin.manager.accountAddress,
      createdAt: input.createdAt || null,
    });
    if (!saved.ok) {
      return json({
        ok: false,
        reason: saved.reason || 'question_queue_save_failed',
        sessionSlug: context.session.sessionSlug,
      }, { status: 500 });
    }
  }

  const queueConfig = saved?.config || await loadTelegramQuestionQueueConfig({
    env,
    sessionSlug: context.session.sessionSlug,
  });
  return json({
    ok: true,
    sessionSlug: context.session.sessionSlug,
    permissionMode: context.permission.mode,
    questionSource: loaded.source || '',
    questionSourceReason: loaded.reason || '',
    questionQueue: {
      source: queueConfig.source || (saved ? 'kv' : ''),
      sponsoredQuestionIds: Array.isArray(queueConfig.sponsoredQuestionIds) ? queueConfig.sponsoredQuestionIds : [],
      sponsoredQuestionCount: Array.isArray(queueConfig.sponsoredQuestionIds) ? queueConfig.sponsoredQuestionIds.length : 0,
      updatedAt: safeString(queueConfig.updatedAt),
    },
    saved: saved?.ok === true,
    skipped,
    candidates: candidateSummaries,
  });
}

async function handleGroupApprovalLinkRequest({
  env = {},
  context = {},
  input = {},
} = {}) {
  const admin = await requireQuestionQueueAdmin({
    env,
    context,
    input,
    allowDelegatedAdmin: true,
  });
  if (!admin.ok) {
    return json({
      ok: false,
      reason: 'group_approval_admin_required',
      accountAddress: admin.accountAddress || '',
    }, { status: admin.status || 403 });
  }
  const minted = await mintTelegramGroupApprovalLink({
    env,
    session: context.session,
    approvedByTelegramUserId: context.normalized.user.telegramUserId,
    approvedByAccountAddress: admin.manager.accountAddress,
    createdAt: input.createdAt || null,
  });
  if (!minted.url) {
    return json({
      ok: false,
      reason: 'telegram_bot_username_missing',
      sessionSlug: context.session.sessionSlug,
    }, { status: 500 });
  }
  const response = {
    ok: true,
    url: minted.url,
    expiresAt: minted.expiresAt,
    sessionSlug: context.session.sessionSlug,
  };
  assertNoSecretShape(response, 'Telegram group approval link response must not serialize secrets.');
  return json(response);
}

async function handleGroupApprovalRevokeRequest({
  env = {},
  context = {},
  input = {},
} = {}) {
  const admin = await requireQuestionQueueAdmin({
    env,
    context,
    input,
    allowDelegatedAdmin: true,
  });
  if (!admin.ok) {
    return json({
      ok: false,
      reason: 'group_approval_admin_required',
      accountAddress: admin.accountAddress || '',
    }, { status: admin.status || 403 });
  }
  const chatId = safeString(input.chatId || input.groupChatId);
  if (!chatId) {
    return json({
      ok: false,
      reason: 'telegram_group_chat_id_required',
      sessionSlug: context.session.sessionSlug,
    }, { status: 400 });
  }
  const revoked = await deleteTelegramGroupApproval({
    env,
    sessionSlug: context.session.sessionSlug,
    chatId,
  });
  const response = {
    ok: revoked.ok === true,
    sessionSlug: context.session.sessionSlug,
    chatId,
    revoked: revoked.revoked === true,
    reason: revoked.ok ? '' : revoked.reason,
  };
  assertNoSecretShape(response, 'Telegram group approval revoke response must not serialize secrets.');
  return json(response, { status: revoked.ok ? 200 : 400 });
}

function normalizeTelegramQuestionVote(value = '') {
  const vote = lower(value);
  return vote === 'up' || vote === 'down' ? vote : '';
}

function telegramQuestionVoteKey({
  sessionSlug = '',
  questionId = '',
  telegramUserId = '',
} = {}) {
  const slug = sanitizeSessionSlug(sessionSlug);
  const qid = kvKeySafePart(questionId);
  const user = kvKeySafePart(telegramUserId);
  if (!slug || !qid || !user) return '';
  return `${MINI_APP_QUESTION_VOTE_KV_PREFIX}${slug}:${qid}:${user}`;
}

function normalizeQuestionIdSet(value) {
  const source = Array.isArray(value) ? value : safeString(value).split(/[\n,;|]+/);
  return new Set(source.map(safeString).filter(Boolean));
}

function normalizeNegativePreferenceTagHints(input = {}) {
  const preferences = input.preferences && typeof input.preferences === 'object' && !Array.isArray(input.preferences)
    ? input.preferences
    : {};
  const source = [
    input.deprioritizeTags,
    input.downvoteTags,
    input.irrelevantTags,
    input.avoidTags,
    preferences.deprioritizeTags,
    preferences.downvoteTags,
    preferences.irrelevantTags,
    preferences.avoidTags,
    preferences.dislikedTags,
  ].flatMap((value) => (Array.isArray(value) ? value : safeString(value).split(/[\n,;|]+/)));
  return normalizeQuestionTags(source);
}

function recommendationLimit(input = {}) {
  const value = Number(input.limit || input.topN || input.count || 10);
  if (!Number.isFinite(value) || value <= 0) return 10;
  return Math.max(1, Math.min(20, Math.floor(value)));
}

function buildQuestionVoteRecommendations(questions = [], input = {}, context = {}) {
  const tagHints = normalizePreferenceTagHints(input);
  const negativeTags = normalizeNegativePreferenceTagHints(input);
  const sessionHints = normalizePreferenceSessionHints(input);
  const preferences = input.preferences && typeof input.preferences === 'object' && !Array.isArray(input.preferences)
    ? input.preferences
    : {};
  const importantIds = normalizeQuestionIdSet(input.importantQuestionIds || preferences.importantQuestionIds);
  const deprioritizeIds = normalizeQuestionIdSet(input.deprioritizeQuestionIds || preferences.deprioritizeQuestionIds);
  const limit = recommendationLimit(input);
  const hasTargeting = Boolean(
    tagHints.length ||
    negativeTags.length ||
    sessionHints.slugs.length ||
    sessionHints.tags.length ||
    importantIds.size ||
    deprioritizeIds.size
  );
  const entries = (Array.isArray(questions) ? questions : [])
    .filter((question) => question.answerable === true)
    .map((question, index) => {
      const positive = questionRelevance(question, { tagHints, sessionHints, session: context.session });
      const negative = questionRelevance(question, {
        tagHints: negativeTags,
        sessionHints: { slugs: [], tags: [] },
        session: context.session,
      });
      let positiveScore = positive.score;
      let negativeScore = negative.score;
      if (importantIds.has(question.questionId)) positiveScore += 50;
      if (deprioritizeIds.has(question.questionId)) negativeScore += 50;
      const suggestedVote = negativeScore > positiveScore && negativeScore > 0 ? 'down' : 'up';
      const rawScore = Math.max(positiveScore, negativeScore);
      const fallbackScore = rawScore > 0 ? rawScore : Math.max(1, questions.length - index);
      const confidence = Math.max(0.35, Math.min(0.95, 0.45 + (fallbackScore / 100)));
      const matchedTags = suggestedVote === 'down' ? negative.matchedTags : positive.matchedTags;
      const reason = matchedTags.length
        ? `Matched ${suggestedVote === 'down' ? 'deprioritized' : 'relevant'} tags: ${matchedTags.join(', ')}.`
        : 'No strong tag match; surfaced from the active question list for human review.';
      return {
        questionId: question.questionId,
        questionType: question.questionType,
        prompt: question.prompt,
        tags: Array.isArray(question.tags) ? question.tags : [],
        suggestedVote,
        score: fallbackScore,
        confidence: Number(confidence.toFixed(2)),
        reason,
        agentNote: `Suggested ${suggestedVote}vote: ${reason}`,
        relevance: {
          positiveScore,
          negativeScore,
          matchedTags,
          matchedSessions: positive.matchedSessions,
        },
        index,
      };
    })
    .filter((entry) => !hasTargeting || entry.score > Math.max(1, questions.length - entry.index));
  entries.sort((left, right) => (
    right.score - left.score ||
    (left.suggestedVote === 'up' ? -1 : 1) ||
    left.index - right.index
  ));
  return {
    recommendations: entries.slice(0, limit).map(({ index, ...entry }) => entry),
    relevance: {
      tags: tagHints,
      downvoteTags: negativeTags,
      sessionsAttended: sessionHints.slugs,
      sessionTags: sessionHints.tags,
    },
  };
}

async function persistAgentQuestionVoteRecommendations({
  env = {},
  context = {},
  input = {},
  recommendations = [],
  createdAt = new Date().toISOString(),
} = {}) {
  const kv = env?.AGENT_ACTION_KV;
  if (!kv || typeof kv.put !== 'function') return { ok: false, reason: 'question_vote_recommendation_storage_unavailable' };
  const telegramUserId = safeString(context.normalized?.user?.telegramUserId);
  const sessionSlug = sanitizeSessionSlug(context.session?.sessionSlug);
  if (!telegramUserId || !sessionSlug) return { ok: false, reason: 'question_vote_recommendation_context_incomplete' };
  const requestId = safeString(input.requestId || input.idempotencyKey) ||
    buildOpaqueActionId(`agent_question_vote_recommendations|${sessionSlug}|${telegramUserId}|${stableFingerprint(recommendations)}|${createdAt}`);
  const record = {
    type: 'telegram_agent_question_vote_recommendation',
    version: 1,
    requestId,
    sessionSlug,
    telegramUserId,
    status: 'pending_review',
    source: 'agent_handoff',
    authMode: safeString(context.authMode),
    recommendations: (Array.isArray(recommendations) ? recommendations : []).slice(0, 20).map((recommendation) => ({
      questionId: safeString(recommendation.questionId),
      prompt: safeString(recommendation.prompt).slice(0, 500),
      suggestedVote: normalizeTelegramQuestionVote(recommendation.suggestedVote),
      reason: safeString(recommendation.reason).slice(0, 800),
      confidence: Number(recommendation.confidence || 0) || 0,
    })),
    createdAt,
  };
  assertNoSecretShape(record, 'Telegram agent question vote recommendation records must not serialize secrets.');
  await kv.put(
    `${AGENT_QUESTION_VOTE_RECOMMENDATION_KV_PREFIX}${sessionSlug}:${kvKeySafePart(telegramUserId)}:${requestId}`,
    JSON.stringify(record)
  );
  return { ok: true, requestId, record };
}

const SECRETISH_METADATA_KEY_RE = /(?:secret|token|api.?key|private.?key|password|authorization|bearer|signature|mnemonic|seed)/i;

function sanitizeResearchMetadata(value, {
  depth = 0,
  maxString = 600,
} = {}) {
  if (value === undefined || value === null) return null;
  if (typeof value === 'string') return value.slice(0, maxString);
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) {
    if (depth >= 3) return [];
    return value.slice(0, 20).map((entry) => sanitizeResearchMetadata(entry, { depth: depth + 1, maxString }));
  }
  if (typeof value !== 'object') return safeString(value).slice(0, maxString);
  if (depth >= 3) return {};
  const result = {};
  Object.entries(value).slice(0, 30).forEach(([key, entry]) => {
    const safeKey = safeString(key).replace(/[^a-zA-Z0-9_.:-]+/g, '_').slice(0, 80);
    if (!safeKey || SECRETISH_METADATA_KEY_RE.test(safeKey)) return;
    result[safeKey] = sanitizeResearchMetadata(entry, { depth: depth + 1, maxString });
  });
  return result;
}

function normalizeAgentMetadata(input = {}) {
  const agent = input.agent && typeof input.agent === 'object' && !Array.isArray(input.agent)
    ? input.agent
    : (input.agentMetadata && typeof input.agentMetadata === 'object' && !Array.isArray(input.agentMetadata) ? input.agentMetadata : {});
  return sanitizeResearchMetadata({
    agentId: firstValue(input.agentId, agent.agentId, agent.id),
    agentName: firstValue(input.agentName, agent.agentName, agent.name),
    platform: firstValue(input.agentPlatform, agent.platform, agent.vendor),
    model: firstValue(input.model, agent.model),
    version: firstValue(input.agentVersion, agent.version),
  });
}

function normalizeApprovalText(value = '') {
  return safeString(sanitizeResearchMetadata(value, { maxString: 1500 }));
}

function explicitApprovalValue(value) {
  if (value === true || value === false) return value;
  const normalized = lower(value);
  if (['approve', 'approved', 'accept', 'accepted', 'yes', 'use', 'used', 'true'].includes(normalized)) return true;
  if (['reject', 'rejected', 'disapprove', 'decline', 'skip', 'no', 'false'].includes(normalized)) return false;
  return null;
}

function approvalFromNaturalLanguage(approvalText = '', questionId = '') {
  const text = lower(approvalText);
  if (!text) return null;
  const qid = lower(questionId);
  if (qid && text.includes(qid)) {
    const index = text.indexOf(qid);
    const local = text.slice(Math.max(0, index - 48), Math.min(text.length, index + qid.length + 48));
    if (/\b(reject|rejected|disapprove|decline|skip|do not|don't|no)\b/.test(local)) return false;
    if (/\b(approve|approved|accept|accepted|yes|use|looks good)\b/.test(local)) return true;
  }
  if (/\b(approve all|accept all|use all|looks good|yes,? apply|apply all)\b/.test(text)) return true;
  if (/\b(reject all|decline all|do not apply|don't apply|no,? do not)\b/.test(text)) return false;
  return null;
}

function finalVoteFromNaturalLanguage(approvalText = '', questionId = '') {
  const text = lower(approvalText);
  const qid = lower(questionId);
  if (!text || !qid || !text.includes(qid)) return '';
  const index = text.indexOf(qid);
  const local = text.slice(Math.max(0, index - 48), Math.min(text.length, index + qid.length + 48));
  if (/\b(up|upvote|\+1)\b/.test(local)) return 'up';
  if (/\b(down|downvote|-1)\b/.test(local)) return 'down';
  return '';
}

async function applyAgentQuestionVotes({
  env = {},
  context = {},
  input = {},
  questions = [],
  recommendations = [],
  createdAt = new Date().toISOString(),
} = {}) {
  const kv = env?.AGENT_ACTION_KV;
  if (!kv || typeof kv.put !== 'function') {
    return { ok: false, reason: 'question_vote_storage_unavailable' };
  }
  const telegramUserId = safeString(context.normalized?.user?.telegramUserId);
  const sessionSlug = sanitizeSessionSlug(context.session?.sessionSlug);
  if (!telegramUserId || !sessionSlug) return { ok: false, reason: 'question_vote_context_incomplete' };
  const settings = await loadTelegramAgentSettings({ env, sessionSlug, telegramUserId });
  const autoApplyRequested = input.autoApply === true || lower(input.applyMode) === 'auto';
  if (autoApplyRequested && settings.agentAutoApplyQuestionVotes === false) {
    return {
      ok: false,
      reason: 'agent_question_vote_auto_apply_disabled',
      settings: { agentAutoApplyQuestionVotes: false },
    };
  }

  const questionById = new Map((Array.isArray(questions) ? questions : [])
    .filter((question) => question.answerable === true)
    .map((question) => [safeString(question.questionId), question]));
  const recommendationById = new Map((Array.isArray(recommendations) ? recommendations : [])
    .map((recommendation) => [safeString(recommendation.questionId), recommendation]));
  const decisionInputs = Array.isArray(input.decisions)
    ? input.decisions
    : (Array.isArray(input.votes) ? input.votes : []);
  const sourceDecisions = decisionInputs.length
    ? decisionInputs
    : (autoApplyRequested ? recommendations : []);
  const approvalText = normalizeApprovalText(input.approvalText || input.humanApproval || input.userApproval || '');
  const agentMetadata = normalizeAgentMetadata(input);
  const actionMetadata = sanitizeResearchMetadata({
    ...(input.metadata && typeof input.metadata === 'object' && !Array.isArray(input.metadata) ? input.metadata : {}),
    source: 'agent_handoff',
    authMode: safeString(context.authMode),
    clientSource: firstValue(input.source, input.client, input.integration, input.metadata?.source),
    runId: firstValue(input.runId, input.requestRunId, input.metadata?.runId),
    requestId: firstValue(input.requestId, input.idempotencyKey, input.metadata?.requestId),
    preferenceTags: normalizePreferenceTagHints(input),
    downvoteTags: normalizeNegativePreferenceTagHints(input),
  });
  const appliedVotes = [];
  const skipped = [];
  const decisions = [];
  for (const entry of sourceDecisions) {
    const questionId = safeString(entry?.questionId || entry?.id);
    const question = questionById.get(questionId);
    if (!question) {
      skipped.push({ questionId, reason: 'question_not_active_or_answerable' });
      continue;
    }
    const recommendation = recommendationById.get(questionId) || {};
    const suggestedVote = normalizeTelegramQuestionVote(entry?.suggestedVote || recommendation.suggestedVote);
    const naturalVote = finalVoteFromNaturalLanguage(approvalText, questionId);
    const finalVote = normalizeTelegramQuestionVote(entry?.finalVote || entry?.vote || naturalVote || suggestedVote);
    if (!finalVote) {
      skipped.push({ questionId, reason: 'vote_not_understood' });
      continue;
    }
    const explicitApproval = explicitApprovalValue(entry?.approved ?? entry?.approval ?? entry?.decision ?? entry?.status);
    const naturalApproval = approvalFromNaturalLanguage(approvalText, questionId);
    const approved = autoApplyRequested ? true : (explicitApproval ?? naturalApproval ?? false);
    const approvalStatus = autoApplyRequested
      ? 'agent_auto_applied_pending_human_review'
      : (approved ? 'human_approved' : 'human_rejected_or_missing');
    const decision = {
      questionId,
      suggestedVote: suggestedVote || finalVote,
      finalVote,
      approved,
      applied: approved,
      overridden: approved && Boolean(suggestedVote) && finalVote !== suggestedVote,
      approvalStatus,
      agentNote: safeString(entry?.agentNote || recommendation.agentNote).slice(0, 800),
      humanNote: safeString(entry?.humanNote || entry?.note).slice(0, 800),
      reason: safeString(entry?.reason || recommendation.reason).slice(0, 800),
      confidence: Number(entry?.confidence || recommendation.confidence || 0) || 0,
    };
    decisions.push(decision);
    if (!approved) {
      skipped.push({ questionId, reason: 'question_vote_not_approved' });
      continue;
    }
    const voteKey = telegramQuestionVoteKey({ sessionSlug, questionId, telegramUserId });
    if (!voteKey) {
      skipped.push({ questionId, reason: 'question_vote_ref_incomplete' });
      continue;
    }
    const previous = typeof kv.get === 'function'
      ? safeJsonParse(await kv.get(voteKey).catch(() => null), null)
      : null;
    const voteRecord = {
      type: 'telegram_mini_app_question_vote',
      version: 1,
      sessionSlug,
      questionId,
      telegramUserId,
      vote: finalVote,
      weight: 1,
      votingMode: 'single',
      source: 'agent_handoff',
      agentMetadata,
      agentNote: decision.agentNote,
      agentSuggestedVote: decision.suggestedVote,
      humanApproval: {
        status: approvalStatus,
        approved: autoApplyRequested ? false : approved,
        humanReviewed: !autoApplyRequested,
        overridden: decision.overridden,
        approvalText,
        humanNote: decision.humanNote,
      },
      actionMetadata,
      quadraticVoting: {
        enabled: false,
        maxCredits: 1,
        upgradePath: 'replace weight with credit-derived weight after credit allocation is enabled',
      },
      createdAt: safeString(previous?.createdAt) || createdAt,
      updatedAt: createdAt,
    };
    assertNoSecretShape(voteRecord, 'Telegram agent question vote records must not serialize secrets.');
    await kv.put(voteKey, JSON.stringify(voteRecord));
    appliedVotes.push({ questionId, vote: finalVote, voteKey, approvalStatus });
  }
  const decisionFingerprint = stableFingerprint({
    sessionSlug,
    telegramUserId,
    decisions,
    approvalText,
    actionMetadata,
  });
  const requestId = safeString(input.requestId || input.idempotencyKey) ||
    buildOpaqueActionId(`agent_question_votes|${sessionSlug}|${telegramUserId}|${decisionFingerprint}|${createdAt}`);
  const decisionRecordKey = `${AGENT_QUESTION_VOTE_DECISION_KV_PREFIX}${sessionSlug}:${kvKeySafePart(telegramUserId)}:${requestId}`;
  const decisionRecord = {
    type: 'telegram_agent_question_vote_decision',
    version: 1,
    requestId,
    sessionSlug,
    telegramUserId,
    autoApplyRequested,
    autoApplyAllowed: settings.agentAutoApplyQuestionVotes !== false,
    approvalText,
    agentMetadata,
    actionMetadata,
    decisions,
    appliedVotes,
    skipped,
    createdAt,
  };
  assertNoSecretShape(decisionRecord, 'Telegram agent question vote decision records must not serialize secrets.');
  await kv.put(decisionRecordKey, JSON.stringify(decisionRecord));
  return {
    ok: true,
    requestId,
    decisionRecordKey,
    settings: { agentAutoApplyQuestionVotes: settings.agentAutoApplyQuestionVotes !== false },
    appliedVotes,
    skipped,
    decisions,
  };
}

async function handleQuestionVoteRecommendationsRequest({
  env = {},
  context = {},
  input = {},
  waitUntil = null,
} = {}) {
  const { loaded, questions } = await loadPublicQuestionsForHandoff({ env, context, waitUntil });
  const built = buildQuestionVoteRecommendations(questions, input, context);
  const recommendationRecord = built.recommendations.length
    ? await persistAgentQuestionVoteRecommendations({
      env,
      context,
      input,
      recommendations: built.recommendations,
      createdAt: input.createdAt || new Date().toISOString(),
    })
    : { ok: false, reason: 'no_recommendations' };
  const settings = await loadTelegramAgentSettings({
    env,
    sessionSlug: context.session.sessionSlug,
    telegramUserId: context.normalized.user.telegramUserId,
  });
  let autoApply = null;
  if (input.autoApply === true || lower(input.applyMode) === 'auto') {
    autoApply = settings.agentAutoApplyQuestionVotes === false
      ? {
        ok: false,
        reason: 'agent_question_vote_auto_apply_disabled',
        appliedVotes: [],
      }
      : await applyAgentQuestionVotes({
        env,
        context,
        input: { ...input, autoApply: true },
        questions,
        recommendations: built.recommendations,
      });
  }
  return json({
    ok: true,
    sessionSlug: context.session.sessionSlug,
    permissionMode: context.permission.mode,
    questionSource: loaded.source || '',
    questionSourceReason: loaded.reason || '',
    metaQuestion: {
      questionId: 'meta-question-importance',
      prompt: 'Which active questions are most important for this user to prioritize?',
      responseMode: 'approve_or_override_agent_question_votes',
    },
    settings: {
      agentAutoApplyQuestionVotes: settings.agentAutoApplyQuestionVotes !== false,
    },
    relevance: built.relevance,
    recommendations: built.recommendations,
    recommendationRecord: recommendationRecord.ok ? {
      requestId: recommendationRecord.requestId,
      status: recommendationRecord.record.status,
    } : null,
    autoApply,
    approval: {
      endpoint: '/telegram/agent/api/question-votes/apply',
      note: 'Send approved, rejected, or overridden vote decisions after human review. Natural-language approval text is stored with the decision record.',
    },
  });
}

async function handleQuestionVoteApplyRequest({
  env = {},
  context = {},
  input = {},
  waitUntil = null,
} = {}) {
  const { questions } = await loadPublicQuestionsForHandoff({ env, context, waitUntil });
  const recommendations = Array.isArray(input.recommendations)
    ? input.recommendations
    : buildQuestionVoteRecommendations(questions, input, context).recommendations;
  const applied = await applyAgentQuestionVotes({
    env,
    context,
    input,
    questions,
    recommendations,
  });
  return json(applied, { status: applied.ok ? 200 : 400 });
}

async function handleActionsRequest({
  env = {},
  context = {},
  input = {},
} = {}) {
  const sessionSlug = sanitizeSessionSlug(context.session?.sessionSlug || input.sessionSlug);
  const items = await listTelegramAgentActivity({
    env,
    telegramUserId: context.normalized.user.telegramUserId,
    sessionSlugs: sessionSlug ? [sessionSlug] : [],
    includeContent: true,
    limit: Number(input.limit || 50) || 50,
  });
  assertNoSecretShape(items, 'Telegram agent activity response must not serialize secrets.');
  return json({
    ok: true,
    sessionSlug,
    telegramUserId: context.normalized.user.telegramUserId,
    actions: items,
  });
}

function directLinkMiniAppShortName(env = {}) {
  return safeString(
    env.AGENT_BRIDGE_MINIAPP_SHORT_NAME ||
    env.AGENT_BRIDGE_MINI_APP_SHORT_NAME ||
    env.TELEGRAM_MINIAPP_SHORT_NAME ||
    env.TELEGRAM_MINI_APP_SHORT_NAME
  ).replace(/^@+/, '');
}

function directLinkMiniAppUrl(env = {}, launch = '') {
  const botUsername = safeString(env.TELEGRAM_BOT_USERNAME).replace(/^@+/, '');
  const shortName = directLinkMiniAppShortName(env);
  const payload = safeString(launch);
  if (botUsername && shortName && payload) {
    return `https://t.me/${botUsername}/${shortName}?startapp=${encodeURIComponent(payload)}`;
  }
  const publicUrl = safeString(env.AGENT_BRIDGE_PUBLIC_URL || DEFAULT_AGENT_BRIDGE_PUBLIC_URL).replace(/\/+$/, '');
  if (!publicUrl || !payload) return '';
  return `${publicUrl}/telegram/mini-app?launch=${encodeURIComponent(payload)}`;
}

function normalizeMiniAppLaunchQuestionIds(input = {}, questions = []) {
  const source = input.questionSeries?.questionIds ||
    input.questionSeries?.orderedQuestionIds ||
    input.orderedQuestionIds ||
    input.questionIds ||
    input.ids ||
    input.questionId;
  const refs = normalizeQuestionQueueRefs(source);
  const ids = [];
  const skipped = [];
  refs.forEach((ref) => {
    const question = findQuestionQueueCandidate(questions, ref) || findQuestionQueueCandidateByText(questions, ref);
    const questionId = safeString(question?.questionId);
    if (!questionId) {
      skipped.push(ref);
      return;
    }
    if (!ids.some((existing) => lower(existing) === lower(questionId))) ids.push(questionId);
  });
  return { ids, skipped };
}

function normalizeMiniAppLaunchDrafts(input = {}, questionIds = []) {
  const source = input.questionSeries?.draftAnswersByQuestionId ||
    input.questionSeries?.prefilledDraftsByQuestionId ||
    input.questionSeries?.draftsByQuestionId ||
    input.draftAnswersByQuestionId ||
    input.prefilledDraftsByQuestionId ||
    {};
  const allowed = new Set(questionIds.map(lower));
  const out = {};
  if (source && typeof source === 'object' && !Array.isArray(source)) {
    Object.entries(source).forEach(([questionId, draft]) => {
      if (!allowed.has(lower(questionId))) return;
      if (typeof draft === 'string') {
        const text = safeString(draft).slice(0, 4000);
        if (text) out[questionId] = { text };
        return;
      }
      if (!draft || typeof draft !== 'object' || Array.isArray(draft)) return;
      const text = safeString(draft.text || draft.answer || draft.value).slice(0, 4000);
      const comments = safeString(draft.comments || draft.additionalComments).slice(0, 1000);
      const value = safeString(draft.value || draft.answerValue).slice(0, 1000);
      const values = Array.isArray(draft.values || draft.selectedValues)
        ? (draft.values || draft.selectedValues).map(safeString).filter(Boolean).slice(0, 20)
        : [];
      const normalized = {};
      if (text) normalized.text = text;
      if (comments) normalized.comments = comments;
      if (value) normalized.value = value;
      if (values.length) normalized.values = values;
      if (Object.keys(normalized).length) out[questionId] = normalized;
    });
  }
  return out;
}

async function handleMiniAppLaunchRequest({
  env = {},
  context = {},
  input = {},
  waitUntil = null,
} = {}) {
  const { questions } = await loadPublicQuestionsForHandoff({ env, context, waitUntil });
  const resolved = normalizeMiniAppLaunchQuestionIds(input, questions);
  if (!resolved.ids.length) {
    return json({
      ok: false,
      reason: 'mini_app_launch_questions_required',
      skipped: resolved.skipped,
    }, { status: 400 });
  }
  const skipIds = new Set(normalizeQuestionQueueRefs(input.questionSeries?.skippedQuestionIds || input.skippedQuestionIds).map(lower));
  const skippedQuestionIds = resolved.ids.filter((questionId) => skipIds.has(lower(questionId)));
  const draftAnswersByQuestionId = normalizeMiniAppLaunchDrafts(input, resolved.ids);
  const callback = createRandomTelegramCallbackAction({
    action: TELEGRAM_BRIDGE_ACTIONS.SUBMIT_RESPONSE,
    lane: TELEGRAM_CHAT_LANES.MINI_APP,
    serverContextRef: {
      sessionSlug: context.session.sessionSlug,
      questionId: resolved.ids[0],
      questionSeries: {
        questionIds: resolved.ids,
        skippedQuestionIds,
        draftAnswersByQuestionId,
      },
    },
  });
  const record = {
    ...callback.record,
    callbackData: callback.callbackData,
    miniAppLaunch: true,
  };
  assertNoSecretShape(record, 'Telegram Mini App launch records must not serialize secrets.');
  const stored = await persistActionRecord(env, callback.callbackData, record);
  if (!stored.ok) return json({ ok: false, reason: stored.reason || 'action_record_unavailable' }, { status: 503 });
  await persistLatestMiniAppLaunchPointer({
    env,
    telegramUserId: context.normalized?.user?.telegramUserId,
    sessionSlug: context.session.sessionSlug,
    launch: callback.callbackData,
    questionIds: resolved.ids,
    createdAt: new Date().toISOString(),
  }).catch(() => null);
  const link = directLinkMiniAppUrl(env, callback.callbackData);
  return json({
    ok: true,
    sessionSlug: context.session.sessionSlug,
    launch: callback.callbackData,
    link,
    directLink: link,
    questionIds: resolved.ids,
    skipped: resolved.skipped,
    skippedQuestionCount: skippedQuestionIds.length,
    prefilledDraftCount: Object.keys(draftAnswersByQuestionId).length,
    instructions: 'Send link to the user. The Mini App opens the ordered question series with editable prefilled drafts and local skip controls.',
  });
}

function agentBoolean(value) {
  if (typeof value === 'boolean') return value;
  return ['1', 'true', 'yes', 'on', 'demo'].includes(lower(value));
}

function aggregateResultsEnabledForAgent(session = {}) {
  const exposure = session.resultsExposure && typeof session.resultsExposure === 'object' && !Array.isArray(session.resultsExposure)
    ? session.resultsExposure
    : {};
  return exposure.aggregateResultsEnabled !== false;
}

function anonymizedGroupsEnabledForAgent(session = {}) {
  const exposure = session.resultsExposure && typeof session.resultsExposure === 'object' && !Array.isArray(session.resultsExposure)
    ? session.resultsExposure
    : {};
  return exposure.anonymizedGroupsEnabled !== false;
}

function agentResultsMinGroupSize(session = {}) {
  const exposure = session.resultsExposure && typeof session.resultsExposure === 'object' && !Array.isArray(session.resultsExposure)
    ? session.resultsExposure
    : {};
  const n = Math.floor(Number(exposure.minGroupSize));
  return Number.isFinite(n) && n >= 1 ? n : 2;
}

function normalizeAgentResultsView(value = '') {
  const view = lower(value || 'topic-map');
  if (['topic-map', 'topic', 'topic_map'].includes(view)) return 'topic-map';
  if (['group', 'groups'].includes(view)) return 'groups';
  if (view === 'consensus') return 'consensus';
  if (view === 'difference') return 'difference';
  return view;
}

const AGENT_RESULTS_SUPPORTED_VIEWS = ['topic-map', 'consensus', 'difference', 'groups'];
const AGENT_RESULTS_IMAGE_SUPPORTED_VIEWS = ['topic-map', 'consensus', 'groups'];

function anonymizeAgentGroups(groups = [], minGroupSize = 2) {
  const source = Array.isArray(groups) ? groups : [];
  const kept = source.filter((group) => Number(group?.size) >= minGroupSize);
  const safe = kept.map((group) => ({
    groupId: safeString(group.groupId),
    label: safeString(group.label),
    theme: safeString(group.theme),
    size: Number(group.size || 0),
    averageScore: Number(group.averageScore || 0),
    topStatements: Array.isArray(group.topStatements)
      ? group.topStatements.map((statement) => ({
        label: safeString(statement.label),
        prompt: safeString(statement.prompt),
        cluster: statement.cluster && typeof statement.cluster === 'object' && !Array.isArray(statement.cluster)
          ? statement.cluster
          : {},
        overall: statement.overall && typeof statement.overall === 'object' && !Array.isArray(statement.overall)
          ? statement.overall
          : {},
        differenceScore: Number(statement.differenceScore || 0),
      }))
      : [],
  }));
  return {
    groups: safe,
    suppressedGroupCount: source.length - kept.length,
  };
}

function demoAgentResultsQuestions(questions = []) {
  const source = Array.isArray(questions) && questions.length ? questions : [
    { questionId: 'demo-q-1', questionType: 'binary', prompt: 'Should onboarding optimize for one-click agent setup?' },
    { questionId: 'demo-q-2', questionType: 'binary', prompt: 'Should admins sponsor organizer-priority questions first?' },
    { questionId: 'demo-q-3', questionType: 'binary', prompt: 'Should topic maps hide raw response text by default?' },
    { questionId: 'demo-q-4', questionType: 'binary', prompt: 'Should agents draft answers from natural language context?' },
  ];
  return source.slice(0, 6).map((question, index) => ({
    ...question,
    questionId: safeString(question.questionId || question.id) || `demo-q-${index + 1}`,
    questionType: safeString(question.questionType || question.type || question.controlType) || 'binary',
    prompt: safeString(question.prompt || question.text || question.question) || `Demo question ${index + 1}`,
  }));
}

function demoAgentResultsRecords(questions = []) {
  const labels = [
    ['Agree', 'Agree', 'Unsure', 'Disagree'],
    ['Agree', 'Unsure', 'Disagree', 'Disagree'],
    ['Unsure', 'Agree', 'Agree', 'Disagree'],
    ['Disagree', 'Disagree', 'Unsure', 'Agree'],
  ];
  return demoAgentResultsQuestions(questions).flatMap((question, questionIndex) => (
    Array.from({ length: 4 }, (_, participantIndex) => {
      const label = labels[questionIndex % labels.length][participantIndex % 4];
      return {
        telegramUserId: `demo-user-${participantIndex + 1}`,
        questionId: question.questionId,
        label,
        value: lower(label),
        questionType: question.questionType,
        createdAt: `demo-results-${questionIndex + 1}-${participantIndex + 1}`,
      };
    })
  ));
}

async function loadAgentResultsDataset({
  env = {},
  context = {},
  input = {},
} = {}) {
  const sessionSlug = sanitizeSessionSlug(context.session?.sessionSlug || input.sessionSlug);
  const loaded = await loadQuestionsForSession(env, sessionSlug);
  const questions = Array.isArray(loaded.questions) ? loaded.questions : [];
  const demo = agentBoolean(input.demo);
  const sourceQuestions = demo ? demoAgentResultsQuestions(questions) : questions;
  const sourceRecords = demo ? demoAgentResultsRecords(sourceQuestions) : await loadSubmittedResultRecords(env, sessionSlug);
  return {
    sessionSlug,
    questions,
    sourceQuestions,
    sourceRecords,
    demo,
  };
}

function aggregateQuestionRows(records = [], questions = [], view = 'consensus') {
  const consensusQuestions = consensusQuestionsForResults(questions);
  const consensusQuestionIds = new Set(consensusQuestions.map((question) => safeString(question.questionId || question.id)).filter(Boolean));
  const consensusRecords = records.filter((record) => consensusQuestionIds.has(safeString(record.questionId)));
  const rows = summarizeQuestionResults(consensusRecords, consensusQuestions).map((summary) => {
    const counts = summary.counts.map(([label, count]) => ({ label, count }));
    const maxCount = counts.reduce((max, item) => Math.max(max, Number(item.count || 0)), 0);
    const agreementScore = summary.total > 0 ? maxCount / summary.total : 0;
    return {
      questionId: safeString(summary.questionId),
      prompt: safeString(summary.prompt),
      total: Number(summary.total || 0),
      participants: Number(summary.participants || 0),
      counts,
      agreementScore: Number(agreementScore.toFixed(3)),
      differenceScore: Number(Number(summary.differenceScore || 0).toFixed(3)),
      hasDifference: summary.hasDifference === true,
    };
  }).filter((row) => row.total > 0);
  return rows.sort((left, right) => (
    view === 'difference'
      ? right.differenceScore - left.differenceScore || right.total - left.total || left.prompt.localeCompare(right.prompt)
      : right.agreementScore - left.agreementScore || right.total - left.total || left.prompt.localeCompare(right.prompt)
  ));
}

function beeswarmRowsFromAgentQuestionRows(rows = []) {
  return rows.slice(0, 3).map((row, index) => ({
    label: `Q${index + 1}`,
    prompt: row.prompt,
    answers: row.counts.flatMap((item) => (
      new Array(Math.max(0, Number(item.count || 0))).fill(item.label)
    )),
  }));
}

async function buildAgentTopicMap({
  env = {},
  context = {},
  input = {},
} = {}) {
  const sessionSlug = sanitizeSessionSlug(context.session?.sessionSlug || input.sessionSlug);
  const loaded = await loadQuestionsForSession(env, sessionSlug);
  const questions = Array.isArray(loaded.questions) ? loaded.questions : [];
  const records = await loadSubmittedResultRecords(env, sessionSlug);
  const demo = agentBoolean(input.demo);
  const sourceQuestions = demo ? [
    { questionId: 'demo-topic-q-1', prompt: 'Should onboarding optimize for one-click agent setup?', tags: ['onboarding'] },
    { questionId: 'demo-topic-q-2', prompt: 'Should admins sponsor organizer-priority questions first?', tags: ['question-cadence'] },
    { questionId: 'demo-topic-q-3', prompt: 'Should topic maps hide raw response text by default?', tags: ['privacy'] },
    { questionId: 'demo-topic-q-4', prompt: 'Should agents draft answers from natural language context?', tags: ['agent-workflow'] },
  ] : questions;
  const sourceRecords = demo ? sourceQuestions.flatMap((question, questionIndex) => (
    Array.from({ length: 4 }, (_, participantIndex) => ({
      telegramUserId: `demo-user-${participantIndex + 1}`,
      questionId: question.questionId,
      label: ['Agree', 'Unsure', 'Disagree', 'Agree'][(questionIndex + participantIndex) % 4],
      createdAt: `demo-topic-${questionIndex}-${participantIndex}`,
    }))
  )) : records;
  const topicMap = await loadOrBuildTelegramTopicMap({
    env,
    session: context.session,
    sessionSlug,
    questions: sourceQuestions,
    records: sourceRecords,
    demo,
    variantKey: 'agent',
  });
  return {
    sessionSlug,
    records,
    sourceRecords,
    topicMap,
    demo,
  };
}

async function handleResultsRequest({
  env = {},
  context = {},
  input = {},
} = {}) {
  const view = normalizeAgentResultsView(input.view || 'topic-map');
  if (!AGENT_RESULTS_SUPPORTED_VIEWS.includes(view)) {
    const body = { ok: false, reason: 'unsupported_results_view', supportedViews: AGENT_RESULTS_SUPPORTED_VIEWS };
    assertNoSecretShape(body, 'Telegram agent results unsupported-view response must not serialize secrets.');
    return json(body, { status: 400 });
  }
  const demo = agentBoolean(input.demo);
  if (view === 'topic-map') {
    if (!demo && !aggregateResultsEnabledForAgent(context.session)) {
      const body = { ok: false, reason: 'level_3_aggregate_results_admin_disabled' };
      assertNoSecretShape(body, 'Telegram agent results gate response must not serialize secrets.');
      return json(body, { status: 403 });
    }
    const built = await buildAgentTopicMap({ env, context, input });
    const body = {
      ok: true,
      sessionSlug: built.sessionSlug,
      view: 'topic-map',
      demo: built.demo,
      counts: built.topicMap.counts,
      available: built.topicMap.availability.available,
      unavailableReason: built.topicMap.availability.available ? '' : built.topicMap.availability.reason,
      topicMap: built.topicMap,
    };
    assertNoSecretShape(body, 'Telegram agent results response must not serialize secrets.');
    return json(body, { status: 200 });
  }
  if (['consensus', 'difference'].includes(view)) {
    if (!demo && !aggregateResultsEnabledForAgent(context.session)) {
      const body = { ok: false, reason: 'level_3_aggregate_results_admin_disabled' };
      assertNoSecretShape(body, 'Telegram agent results gate response must not serialize secrets.');
      return json(body, { status: 403 });
    }
    const loaded = await loadAgentResultsDataset({ env, context, input });
    const rows = aggregateQuestionRows(loaded.sourceRecords, loaded.sourceQuestions, view);
    const body = {
      ok: true,
      sessionSlug: loaded.sessionSlug,
      view,
      demo: loaded.demo,
      questionCount: rows.length,
      responseCount: loaded.sourceRecords.length,
      questions: rows,
    };
    assertNoSecretShape(body, 'Telegram agent aggregate results response must not serialize secrets.');
    return json(body, { status: 200 });
  }
  if (!demo && !anonymizedGroupsEnabledForAgent(context.session)) {
    const body = { ok: false, reason: 'anonymized_groups_admin_disabled' };
    assertNoSecretShape(body, 'Telegram agent groups gate response must not serialize secrets.');
    return json(body, { status: 403 });
  }
  const loaded = await loadAgentResultsDataset({ env, context, input });
  const graph = buildParticipantGraph(loaded.sourceRecords, loaded.sourceQuestions);
  const minGroupSize = agentResultsMinGroupSize(context.session);
  const anonymized = anonymizeAgentGroups(graph.groups, minGroupSize);
  const body = {
    ok: true,
    sessionSlug: loaded.sessionSlug,
    view: 'groups',
    demo: loaded.demo,
    minGroupSize,
    groupCount: anonymized.groups.length,
    suppressedGroupCount: anonymized.suppressedGroupCount,
    participantCount: graph.participantCount,
    questionCount: graph.questionCount,
    groups: anonymized.groups,
  };
  assertNoSecretShape(body, 'Telegram agent anonymized groups response must not serialize secrets.');
  return json(body, { status: 200 });
}

async function handleResultsImageRequest({
  env = {},
  context = {},
  input = {},
} = {}) {
  const view = normalizeAgentResultsView(input.view || 'topic-map');
  if (!AGENT_RESULTS_IMAGE_SUPPORTED_VIEWS.includes(view)) {
    const body = { ok: false, reason: 'unsupported_results_view', supportedViews: AGENT_RESULTS_IMAGE_SUPPORTED_VIEWS };
    assertNoSecretShape(body, 'Telegram agent results-image unsupported-view response must not serialize secrets.');
    return json(body, { status: 400 });
  }
  const demo = agentBoolean(input.demo);
  if (view === 'topic-map') {
    if (!demo && !aggregateResultsEnabledForAgent(context.session)) {
      const body = { ok: false, reason: 'level_3_aggregate_results_admin_disabled' };
      assertNoSecretShape(body, 'Telegram agent results-image gate response must not serialize secrets.');
      return json(body, { status: 403 });
    }
    const built = await buildAgentTopicMap({ env, context, input });
    if (!built.topicMap.availability.available && !built.demo) {
      const body = {
        ok: false,
        reason: built.topicMap.availability.reason || 'topic_map_not_enough_data',
        sessionSlug: built.sessionSlug,
        view: 'topic-map',
      };
      assertNoSecretShape(body, 'Telegram agent topic-map image unavailable response must not serialize secrets.');
      return json(body, { status: 409 });
    }
    const image = buildResultsImage({
      mode: 'topic-map',
      sessionTitle: context.session.sessionName || context.session.sessionSlug,
      responseCount: built.sourceRecords.length,
      demo: built.demo,
      topicMap: built.topicMap,
    });
    return new Response(image.bytes, {
      status: 200,
      headers: {
        'content-type': image.contentType,
        'cache-control': 'no-store',
        'content-disposition': `inline; filename="${image.filename.replace(/[^A-Za-z0-9_.-]/g, '_')}"`,
      },
    });
  }
  if (view === 'consensus') {
    if (!demo && !aggregateResultsEnabledForAgent(context.session)) {
      const body = { ok: false, reason: 'level_3_aggregate_results_admin_disabled' };
      assertNoSecretShape(body, 'Telegram agent consensus image gate response must not serialize secrets.');
      return json(body, { status: 403 });
    }
    const loaded = await loadAgentResultsDataset({ env, context, input });
    const rows = aggregateQuestionRows(loaded.sourceRecords, loaded.sourceQuestions, 'consensus');
    if (!loaded.demo && (!loaded.sourceRecords.length || !rows.length)) {
      const body = {
        ok: false,
        reason: 'not_enough_data_for_view',
        sessionSlug: loaded.sessionSlug,
        view: 'consensus',
      };
      assertNoSecretShape(body, 'Telegram agent consensus image unavailable response must not serialize secrets.');
      return json(body, { status: 409 });
    }
    const image = buildResultsImage({
      mode: 'consensus',
      sessionTitle: context.session.sessionName || context.session.sessionSlug,
      responseCount: loaded.sourceRecords.length,
      demo: loaded.demo,
      beeswarmRows: beeswarmRowsFromAgentQuestionRows(rows),
    });
    return new Response(image.bytes, {
      status: 200,
      headers: {
        'content-type': image.contentType,
        'cache-control': 'no-store',
        'content-disposition': `inline; filename="${image.filename.replace(/[^A-Za-z0-9_.-]/g, '_')}"`,
      },
    });
  }
  if (!demo && !anonymizedGroupsEnabledForAgent(context.session)) {
    const body = { ok: false, reason: 'anonymized_groups_admin_disabled' };
    assertNoSecretShape(body, 'Telegram agent groups image gate response must not serialize secrets.');
    return json(body, { status: 403 });
  }
  const loaded = await loadAgentResultsDataset({ env, context, input });
  const graph = buildParticipantGraph(loaded.sourceRecords, loaded.sourceQuestions);
  const minGroupSize = agentResultsMinGroupSize(context.session);
  const keptGroupIds = new Set(anonymizeAgentGroups(graph.groups, minGroupSize).groups.map((group) => group.groupId));
  const keptGroups = graph.groups.filter((group) => keptGroupIds.has(group.groupId));
  if (!loaded.demo && (!loaded.sourceRecords.length || !keptGroups.length)) {
    const body = {
      ok: false,
      reason: 'not_enough_data_for_view',
      sessionSlug: loaded.sessionSlug,
      view: 'groups',
    };
    assertNoSecretShape(body, 'Telegram agent groups image unavailable response must not serialize secrets.');
    return json(body, { status: 409 });
  }
  const image = buildResultsImage({
    mode: 'group',
    sessionTitle: context.session.sessionName || context.session.sessionSlug,
    responseCount: loaded.sourceRecords.length,
    demo: loaded.demo,
    participants: graph.participants,
    groups: keptGroups,
  });
  return new Response(image.bytes, {
    status: 200,
    headers: {
      'content-type': image.contentType,
      'cache-control': 'no-store',
      'content-disposition': `inline; filename="${image.filename.replace(/[^A-Za-z0-9_.-]/g, '_')}"`,
    },
  });
}

function normalizePreferenceEntries(input = {}) {
  const preferences = input.preferences && typeof input.preferences === 'object' && !Array.isArray(input.preferences)
    ? input.preferences
    : input;
  const byId = preferences.answersByQuestionId || preferences.draftsByQuestionId || input.answersByQuestionId;
  if (byId && typeof byId === 'object' && !Array.isArray(byId)) {
    return Object.entries(byId).map(([questionId, answer]) => ({ questionId, answer }));
  }
  const drafts = preferences.answers || preferences.drafts || input.answers || input.drafts;
  if (Array.isArray(drafts)) {
    return drafts.map((entry) => ({
      questionId: safeString(entry?.questionId || entry?.id),
      answer: entry,
    }));
  }
  return [];
}

function normalizeDraftForQuestion(answer = {}, question = {}) {
  const source = answer && typeof answer === 'object' && !Array.isArray(answer)
    ? answer
    : { value: answer };
  const questionType = safeString(question.questionType || source.questionType || 'freeform');
  const comments = safeString(source.comments || source.additionalComments || source.reason || source.rationale);
  if (questionType === 'binary') {
    const raw = lower(firstValue(source.value, source.answer, source.choice, source.stance, source.label));
    const value = raw === 'yes' || raw === 'true' ? 'agree'
      : raw === 'no' || raw === 'false' ? 'disagree'
      : raw === 'maybe' || raw === 'unknown' ? 'unsure'
      : raw;
    if (!['agree', 'disagree', 'unsure'].includes(value)) return null;
    return {
      label: titleAnswer(value),
      value: { questionType: 'binary', value, comments },
      controlType: 'agree_unsure_disagree',
    };
  }
  if (questionType === 'rating') {
    const value = Number(firstValue(source.value, source.rating, source.answer, source.label));
    if (!Number.isFinite(value)) return null;
    return {
      label: String(value),
      value: { questionType: 'rating', value, comments },
      controlType: 'rating_button',
    };
  }
  if (questionType === 'multichoice') {
    const values = Array.isArray(source.values)
      ? source.values.map(safeString).filter(Boolean)
      : [firstValue(source.value, source.answer, source.choice, source.label)].map(safeString).filter(Boolean);
    if (!values.length) return null;
    return {
      label: values.join(', '),
      value: { questionType: 'multichoice', values, comments },
      controlType: 'multi_select_toggle',
    };
  }
  const text = safeString(firstValue(source.text, source.value, source.answer, source.label));
  if (!text) return null;
  return {
    label: text.slice(0, 80),
    value: { questionType: 'freeform', text, comments },
    controlType: 'freeform_text',
  };
}

async function handlePreferencesRequest({ env = {}, context = {}, input = {}, waitUntil = null } = {}) {
  const loaded = await loadQuestionsForSession(env, context.session.sessionSlug, { waitUntil });
  const questions = (Array.isArray(loaded.questions) ? loaded.questions : [])
    .filter((question) => !questionIsLocked(question) && !questionIsUnavailable(question));
  const byId = new Map(questions.map((question) => [safeString(question.questionId || question.id), question]));
  const entries = normalizePreferenceEntries(input);
  const drafts = [];
  const skipped = [];
  for (const entry of entries) {
    const questionId = safeString(entry.questionId);
    const question = byId.get(questionId);
    if (!question) {
      skipped.push({ questionId, reason: 'question_not_active_or_answerable' });
      continue;
    }
    const draft = normalizeDraftForQuestion(entry.answer, question);
    if (!draft) {
      skipped.push({ questionId, reason: 'answer_not_understood' });
      continue;
    }
    const saved = await persistAnswerDraft({
      env,
      normalized: context.normalized,
      sessionSlug: context.session.sessionSlug,
      selectedQuestionId: questionId,
      answerLabel: draft.label,
      answerValue: JSON.stringify(draft.value),
      controlType: draft.controlType,
      submitLane: TELEGRAM_CHAT_LANES.MINI_APP,
      metadata: {
        source: 'agent_handoff',
        authMode: safeString(context.authMode),
        endpoint: '/telegram/agent/api/preferences',
        reviewRequired: true,
      },
      createdAt: input.createdAt || null,
    });
    if (!saved.ok) {
      skipped.push({ questionId, reason: saved.reason || 'draft_save_failed' });
      continue;
    }
    drafts.push({ questionId, answerLabel: draft.label, controlType: draft.controlType });
  }
  return json({
    ok: true,
    sessionSlug: context.session.sessionSlug,
    draftCount: drafts.length,
    skipped,
    drafts,
    reviewRequired: true,
    review: {
      route: '/telegram/mini-app',
      note: 'Drafted preferences are saved for user review. This endpoint does not submit answers.',
    },
  });
}

function normalizeCreateQuestionBatch(input = {}) {
  const questions = Array.isArray(input.questions)
    ? input.questions
    : (Array.isArray(input.questionDrafts) ? input.questionDrafts : []);
  return questions.slice(0, 21).map((question) => (
    question && typeof question === 'object' && !Array.isArray(question)
      ? question
      : { prompt: question }
  ));
}

function normalizeSourceUrl(value = '') {
  const text = safeString(value).slice(0, 2000);
  if (!text) return '';
  try {
    const url = new URL(text);
    if (!['http:', 'https:'].includes(url.protocol)) return '';
    return url.toString();
  } catch {
    return '';
  }
}

function sourceTagForUrl(value = '') {
  const url = normalizeSourceUrl(value);
  if (!url) return '';
  const hostname = safeString(new URL(url).hostname).replace(/^www\./i, '').toLowerCase();
  return normalizeQuestionTags([`src:${hostname}`])[0] || '';
}

function referencesForCreatedQuestion(question = {}, batchSourceUrl = '') {
  const explicit = normalizeQuestionReferences(question.references);
  if (explicit.length) return explicit;
  const sourceUrl = normalizeSourceUrl(question.sourceUrl || question.url || batchSourceUrl);
  if (!sourceUrl) return [];
  return normalizeQuestionReferences([{
    type: 'url',
    url: sourceUrl,
    title: question.sourceTitle || question.title,
  }]);
}

function geoRefsForCreatedQuestion(question = {}, input = {}) {
  return normalizeQuestionGeoRefs(
    question.geoRefs ||
    question.geoIds ||
    question.geoId ||
    input.geoRefs ||
    input.geoIds ||
    input.geoId
  );
}

async function handleCreateQuestionsRequest({
  env = {},
  context = {},
  input = {},
} = {}) {
  const batch = normalizeCreateQuestionBatch(input);
  if (!batch.length) {
    return json({ ok: false, reason: 'questions_create_batch_required' }, { status: 400 });
  }
  if (batch.length > 20) {
    return json({ ok: false, reason: 'questions_create_batch_too_large', maxQuestions: 20 }, { status: 400 });
  }
  const batchSourceUrl = normalizeSourceUrl(input.sourceUrl || input.url || input.link);
  if ((input.sourceUrl || input.url || input.link) && !batchSourceUrl) {
    return json({ ok: false, reason: 'source_url_invalid' }, { status: 400 });
  }
  const created = [];
  const skipped = [];
  for (const question of batch) {
    const prompt = safeString(question.prompt || question.questionText || question.text).replace(/\s+/g, ' ').slice(0, 1000);
    if (!prompt) {
      skipped.push({ prompt: '', reason: 'question_prompt_missing' });
      continue;
    }
    const references = referencesForCreatedQuestion(question, batchSourceUrl);
    const geoRefs = geoRefsForCreatedQuestion(question, input);
    const questionSourceUrl = references.find((reference) => reference.type === 'url')?.url || '';
    const sourceTag = sourceTagForUrl(questionSourceUrl || batchSourceUrl);
    const tags = normalizeQuestionTags([
      ...geoTagsFromRefs(geoRefs),
      ...(Array.isArray(question.tags) ? question.tags : normalizeQuestionTags(question.tags)),
      ...(sourceTag ? [sourceTag] : []),
    ]);
    let saved = null;
    try {
      saved = await persistTelegramProposedQuestion({
        env,
        normalized: context.normalized,
        sessionSlug: context.session.sessionSlug,
        prompt,
        questionType: question.questionType || question.type || 'binary',
        options: question.options,
        tags,
        references,
        geoRefs,
        sessionContext: question.sessionContext || input.sessionContext || input.context || sessionContextFromPolicySession(context.session),
        metadata: {
          source: 'agent_handoff',
          authMode: safeString(context.authMode),
          endpoint: '/telegram/agent/api/questions/create',
          sourceUrl: questionSourceUrl || batchSourceUrl,
        },
        createdAt: input.createdAt || question.createdAt || null,
      });
    } catch (error) {
      skipped.push({ prompt, reason: safeString(error?.message || error) || 'question_create_failed' });
      continue;
    }
    if (!saved.ok) {
      skipped.push({ prompt, reason: saved.reason || 'question_create_failed' });
      continue;
    }
    created.push({
      questionId: saved.questionId,
      prompt: saved.record.prompt,
      questionType: saved.record.questionType,
      tags: saved.record.tags,
      references: saved.record.references || [],
      geoRefs: saved.record.geoRefs || [],
    });
  }
  const payload = {
    ok: true,
    sessionSlug: context.session.sessionSlug,
    created,
    skipped,
  };
  assertNoSecretShape(payload, 'Telegram questions/create response must not serialize secrets.');
  return json(payload);
}

async function handleGeoBacklinkRequest({ env = {}, context = {}, input = {}, waitUntil = null } = {}) {
  const questionId = safeString(input.questionId);
  if (!questionId) {
    return json({ ok: false, reason: 'question_id_required' }, { status: 400 });
  }
  const { questions } = await loadPublicQuestionsForHandoff({ env, context, waitUntil });
  const question = questions.find((candidate) => safeString(candidate.questionId) === questionId);
  if (!question) {
    return json({
      ok: false,
      reason: 'question_not_found',
      sessionSlug: context.session.sessionSlug,
      questionId,
    }, { status: 404 });
  }
  const requestedGeoRefs = normalizeQuestionGeoRefs(input.geoRefs || input.geoId);
  const existingGeoRefs = normalizeQuestionGeoRefs(question.geoRefs);
  const geoRefs = requestedGeoRefs.length ? requestedGeoRefs : existingGeoRefs;
  const worker = agentBridgePublicUrl(env);
  const questionEndpoint = `${worker}/telegram/agent/api/questions`;
  const payload = {
    ok: true,
    sessionSlug: context.session.sessionSlug,
    questionId: question.questionId,
    geoRefs,
    backlink: {
      type: 'context-engine-question',
      source: 'context-engine',
      sessionSlug: context.session.sessionSlug,
      questionId: question.questionId,
      questionEndpoint,
      questionQuery: {
        sessionSlug: context.session.sessionSlug,
        questionId: question.questionId,
      },
      prompt: safeString(question.prompt).slice(0, 500),
      tags: normalizeQuestionTags(question.tags),
      geoRefs,
    },
    note: 'Post backlink with the agent Geo credentials. The CE worker does not call Geo or store Geo tokens.',
  };
  assertNoSecretShape(payload, 'Telegram geo-backlink response must not serialize secrets.');
  return json(payload);
}

async function handlePoseRequest({
  env = {},
  context = {},
  input = {},
  fetchImpl = globalThis.fetch,
} = {}) {
  const prompt = safeString(input.prompt || input.questionText || input.text);
  const explicitQuestionId = safeString(input.questionId || input.id);
  let questionId = explicitQuestionId;
  if (!questionId && prompt) {
    const saved = await persistTelegramProposedQuestion({
      env,
      normalized: context.normalized,
      sessionSlug: context.session.sessionSlug,
      prompt,
      questionType: input.questionType || 'freeform',
      options: input.options,
      tags: input.tags,
      sessionContext: input.sessionContext || input.context || sessionContextFromPolicySession(context.session),
      metadata: {
        source: 'agent_handoff',
        authMode: safeString(context.authMode),
        endpoint: '/telegram/agent/api/questions/pose',
      },
      createdAt: input.createdAt || null,
    });
    if (!saved.ok) return json({ ok: false, reason: saved.reason || 'question_save_failed' }, { status: 400 });
    questionId = saved.questionId;
  }
  if (!questionId) {
    return json({ ok: false, reason: 'question_id_or_prompt_required' }, { status: 400 });
  }
  const update = {
    update_id: Date.now(),
    message: {
      message_id: Number(input.messageId || 1) || 1,
      text: `/q ${questionId}`,
      chat: {
        id: Number(context.permission.groupChatId || context.normalized.chat.chatId),
        type: 'supergroup',
        title: 'Context Engine Group',
      },
      from: {
        id: Number(context.normalized.user.telegramUserId),
        username: context.normalized.user.username || 'agent',
      },
    },
  };
  const commandResponse = await buildTelegramCommandResponse({ update, env, now: input.createdAt || null });
  const send = input.send !== false;
  let telegramSend = null;
  if (send && commandResponse.ok && commandResponse.response?.text && safeString(env.TELEGRAM_BOT_TOKEN)) {
    telegramSend = await telegramBotApiRequest({
      botToken: env.TELEGRAM_BOT_TOKEN,
      method: 'sendMessage',
      payload: {
        chat_id: commandResponse.response.chatId,
        text: commandResponse.response.text,
        reply_markup: commandResponse.response.replyMarkup || undefined,
      },
      fetchImpl,
    });
  }
  return json({
    ok: commandResponse.ok === true,
    sessionSlug: context.session.sessionSlug,
    questionId,
    posed: commandResponse.posed === true,
    sent: telegramSend ? telegramSend.ok === true : false,
    sendReason: telegramSend ? (telegramSend.ok ? '' : telegramSend.error) : (send ? 'telegram_bot_token_missing_or_send_skipped' : 'send_disabled'),
  }, { status: commandResponse.ok === true ? 200 : 400 });
}

function telegramOnlyRouteGuard(context = {}) {
  if (context.session?.telegramOnly === true) return null;
  return json({
    ok: false,
    reason: 'telegram_only_session_required',
    sessionSlug: context.session?.sessionSlug || '',
  }, { status: 403 });
}

async function handleGroupsRequest({ env = {}, context = {} } = {}) {
  const guard = telegramOnlyRouteGuard(context);
  if (guard) return guard;
  const groups = await loadTelegramLightweightGroups({
    env,
    session: context.session,
    telegramUserId: context.normalized.user.telegramUserId,
  });
  return json({
    ok: true,
    sessionSlug: context.session.sessionSlug,
    permissionMode: context.permission.mode,
    groups,
  });
}

async function handleGroupProposalRequest({ env = {}, context = {}, input = {} } = {}) {
  const guard = telegramOnlyRouteGuard(context);
  if (guard) return guard;
  const saved = await persistTelegramLightweightGroupProposal({
    env,
    session: context.session,
    normalized: context.normalized,
    input,
    metadata: {
      source: 'agent_handoff',
      authMode: safeString(context.authMode),
      endpoint: '/telegram/agent/api/groups/propose',
    },
    createdAt: input.createdAt || null,
  });
  return json(saved, { status: saved.ok ? 200 : 400 });
}

async function handleChildSessionRequest({ env = {}, context = {}, input = {} } = {}) {
  const guard = telegramOnlyRouteGuard(context);
  if (guard) return guard;
  const saved = await persistTelegramChildSession({
    env,
    parentSession: context.session,
    normalized: context.normalized,
    input,
    createdAt: input.createdAt || null,
  });
  return json(saved, { status: saved.ok ? 200 : 400 });
}

async function handleMiniAppOnboardRequest({
  request,
  env = {},
  createdAt = null,
} = {}) {
  const cors = miniAppOnboardCorsHeaders(request, env);
  if (cors === null) {
    return json({ ok: false, reason: 'origin_not_allowed' }, { status: 403 });
  }
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors || {} });
  }
  if (!['GET', 'POST'].includes(request.method)) {
    return jsonMiniAppOnboard(request, env, { ok: false, reason: 'method_not_allowed' }, { status: 405 });
  }

  const input = await readMiniAppOnboardInput(request);
  const ttlSeconds = Number(env.AGENT_BRIDGE_MINIAPP_INITDATA_TTL_SECONDS || 3600);
  const validationEnv = {
    ...env,
    AGENT_BRIDGE_MINI_APP_AUTH_MAX_AGE_SECONDS: Number.isFinite(ttlSeconds) && ttlSeconds > 0
      ? String(Math.floor(ttlSeconds))
      : '3600',
  };
  const validated = await validateTelegramMiniAppInitData(input.initData, validationEnv);
  if (!validated.ok) {
    const reason = validated.reason === 'telegram_init_data_expired'
      ? 'miniapp_initdata_expired'
      : 'miniapp_initdata_invalid';
    return jsonMiniAppOnboard(request, env, { ok: false, reason }, { status: 401 });
  }
  const telegramUserId = safeString(validated.user?.telegramUserId);
  if (!telegramUserId) {
    return jsonMiniAppOnboard(request, env, { ok: false, reason: 'miniapp_user_missing' }, { status: 401 });
  }

  const parsedStart = parseAgentOnboardingStartParam(input.startParam);
  const sessionSlug = parsedStart.ok ? parsedStart.sessionSlug : sanitizeSessionSlug(input.sessionSlug);
  const policy = await loadSessionPolicy(env);
  const normalized = {
    type: 'telegram_mock_update',
    updateId: `miniapp-onboard-${Date.now()}`,
    kind: 'mini_app_agent_onboarding',
    lane: TELEGRAM_CHAT_LANES.PRIVATE_ACCOUNT,
    user: {
      telegramUserId,
      username: safeString(validated.user?.username),
      languageCode: safeString(validated.user?.languageCode),
    },
    chat: {
      chatId: telegramUserId,
      chatType: 'private',
      type: 'private',
      isPrivate: true,
    },
  };
  const resolved = await resolveAgentTokenSession({
    env,
    normalized,
    policy,
    explicitSessionSlug: sessionSlug,
  });
  if (!resolved.ok) {
    return jsonMiniAppOnboard(request, env, {
      ok: false,
      reason: resolved.reason || 'session_not_found',
      sessionSlug: resolved.sessionSlug || sessionSlug || '',
    }, { status: 404 });
  }

  const account = await deriveManagedDemoAccount({
    principal: normalized,
    deploymentId: env.AGENT_BRIDGE_DEPLOYMENT_ID || 'agent-bridge-live-demo',
    rootSecret: env.DEMO_SIGNER_ROOT_SECRET || '',
    lifecycle: AGENT_BRIDGE_EVENT_TYPES.ACCOUNT_RECOVERED,
    createdAt,
  });
  const previousPointer = await readTelegramAgentDelegationTokenUserPointer({ env, telegramUserId });
  if (previousPointer.tokenHash) {
    await revokeTelegramAgentDelegationTokenHash({ env, tokenHash: previousPointer.tokenHash });
  }
  if (sessionSlug) {
    const followDefault = sanitizeSessionSlug(resolved.session.sessionSlug) === sanitizeSessionSlug(policy.defaultSessionSlug);
    await persistTelegramUserSessionBinding({
      env,
      normalized,
      session: resolved.session,
      createdAt,
      source: 'mini_app_agent_onboarding',
      followDefault,
    });
  }
  const issued = await createTelegramAgentDelegationToken({
    env,
    telegramUserId,
    username: safeString(validated.user?.username),
    sessionSlug: resolved.session.sessionSlug,
    accountAddress: account.accountAddress,
    ttlSeconds: TELEGRAM_AGENT_DELEGATION_TOKEN_DEFAULT_TTL_SECONDS,
    createdAt,
  });
  if (!issued.ok) {
    return jsonMiniAppOnboard(request, env, {
      ok: false,
      reason: issued.reason || 'agent_token_create_failed',
    }, { status: 500 });
  }
  const pointer = await writeTelegramAgentDelegationTokenUserPointer({
    env,
    telegramUserId,
    tokenHash: issued.tokenHash,
    issuedAt: issued.record?.issuedAt || createdAt,
    createdAt,
  });
  if (!pointer.ok) {
    return jsonMiniAppOnboard(request, env, {
      ok: false,
      reason: pointer.reason || 'agent_token_pointer_write_failed',
    }, { status: 500 });
  }
  const response = {
    ok: true,
    token: issued.token,
    worker: agentBridgePublicUrl(env),
    sessionSlug: resolved.session.sessionSlug,
    expiresAt: issued.record.expiresAt,
    skill: 'ce-telegram-agent-handoff',
  };
  const { token: _token, ...secretFree } = response;
  assertNoSecretShape(secretFree, 'Mini App onboarding token response metadata must not serialize secrets.');
  return jsonMiniAppOnboard(request, env, response);
}

async function handleClientLoginExchangeRequest({
  request,
  env = {},
  fetchImpl = globalThis.fetch,
} = {}) {
  const cors = clientLoginCorsHeaders(request, env);
  if (cors === null) {
    return json({ ok: false, reason: 'origin_not_allowed' }, { status: 403 });
  }
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors || {} });
  }
  if (request.method !== 'POST') {
    return jsonClientLogin(request, env, { ok: false, reason: 'method_not_allowed' }, { status: 405 });
  }
  const url = new URL(request.url);
  const body = await readRequestJson(request);
  const suppliedToken = extractTelegramAgentToken(
    body.token ||
    body.agentToken ||
    body.telegramToken ||
    url.searchParams.get('token') ||
    url.searchParams.get('agentToken') ||
    request.headers.get('authorization')
  );
  if (!suppliedToken) {
    return jsonClientLogin(request, env, { ok: false, reason: 'agent_token_missing' }, { status: 401 });
  }
  if (suppliedToken === 'preview-user') {
    return jsonClientLogin(request, env, { ok: false, reason: 'preview_user_not_allowed' }, { status: 401 });
  }
  const delegated = await loadTelegramAgentDelegationToken({ env, token: suppliedToken });
  if (!delegated.ok) {
    return jsonClientLogin(request, env, {
      ok: false,
      reason: delegated.reason || 'agent_token_invalid',
      message: 'Open the Context Engine Telegram bot, tap Onboard Agent, and paste the copied install token again.',
    }, { status: 401 });
  }
  const requestedSessionSlug = sanitizeSessionSlug(body.sessionSlug || url.searchParams.get('sessionSlug'));
  const context = await resolveHandoffContext({
    env,
    input: {
      telegramUserId: safeString(delegated.record.telegramUserId),
      username: safeString(delegated.record.username),
      sessionSlug: requestedSessionSlug,
    },
    auth: {
      authMode: 'telegram_agent_delegation_token',
      delegation: delegated.record,
    },
    requireQuestionAuthoring: false,
  });
  if (!context.ok) {
    return jsonClientLogin(request, env, {
      ok: false,
      reason: context.reason,
      sessionSlug: context.sessionSlug || requestedSessionSlug || '',
    }, { status: context.status || 400 });
  }
  const account = delegated.record.accountAddress
    ? { accountAddress: delegated.record.accountAddress }
    : await deriveManagedDemoAccount({
      principal: context.normalized,
      deploymentId: env.AGENT_BRIDGE_DEPLOYMENT_ID,
      rootSecret: env.DEMO_SIGNER_ROOT_SECRET || env.AGENT_BRIDGE_DEMO_ROOT_SECRET || '',
      createdAt: safeString(delegated.record.issuedAt),
    });
  const login = await authenticateSessionWorker({
    env,
    session: context.session,
    account,
    principal: context.normalized,
    workerUrl: '',
    fetchImpl,
  });
  if (!login.ok) {
    return jsonClientLogin(request, env, {
      ok: false,
      reason: login.reason || 'session_worker_login_failed',
      skipped: login.skipped === true,
    }, { status: login.skipped ? 400 : 502 });
  }
  const groups = await loadTelegramLightweightGroups({
    env,
    session: context.session,
    telegramUserId: safeString(delegated.record.telegramUserId),
    accountAddress: login.accountAddress,
  });
  const payload = {
    ok: true,
    tokenType: 'session_worker_jwt',
    sessionSlug: context.session.sessionSlug,
    accountAddress: login.accountAddress,
    workerUrl: login.workerUrl,
    workerToken: login.token,
    exp: login.exp,
    expiresAt: login.exp ? new Date(Number(login.exp) * 1000).toISOString() : '',
    buckets: groups,
  };
  const { workerToken: _workerToken, ...secretFree } = payload;
  assertNoSecretShape(secretFree, 'Telegram client-login exchange metadata must not serialize bearer tokens.');
  return jsonClientLogin(request, env, payload);
}

export async function handleTelegramAgentHandoffRequest({
  request,
  env = {},
  waitUntil = null,
  fetchImpl = globalThis.fetch,
} = {}) {
  const url = new URL(request.url);
  if (url.pathname === '/telegram/agent/api/miniapp/onboard') {
    return handleMiniAppOnboardRequest({ request, env });
  }
  if (url.pathname === '/telegram/agent/api/client-login/exchange') {
    return handleClientLoginExchangeRequest({ request, env, fetchImpl });
  }
  if (url.pathname === '/telegram/agent/api/result-view-cache') {
    return handleResultViewCacheHttpRequest({ request, env });
  }
  if (url.pathname === '/telegram/agent/api/skill-version' && request.method === 'GET') {
    const payload = await skillVersionPayloadWithFlag(env);
    return json(payload);
  }

  const auth = await authenticateAgentHandoff(request, env);
  if (!auth.ok) {
    return json({
      ok: false,
      reason: auth.reason,
      ...(auth.message ? { message: auth.message } : {}),
      ...(auth.action ? { action: auth.action } : {}),
      ...(auth.telegramCommand ? { telegramCommand: auth.telegramCommand } : {}),
      ...(auth.telegramButton ? { telegramButton: auth.telegramButton } : {}),
    }, { status: auth.status });
  }

  const body = await readRequestJson(request);
  const delegated = applyDelegationToInput(auth, inputFromRequest(request, body), url.pathname, request.method);
  if (!delegated.ok) {
    return json({
      ok: false,
      reason: delegated.reason,
      requiredScope: delegated.requiredScope,
      sessionSlug: delegated.sessionSlug || '',
    }, { status: delegated.status || 403 });
  }
  const input = url.pathname === '/telegram/agent/api/group-approval-revoke'
    ? {
      ...delegated.input,
      chatId: safeString(delegated.input.chatId || delegated.input.groupChatId),
      groupChatId: '',
    }
    : delegated.input;
  const routeRequiresQuestionAuthoring = ![
    '/telegram/agent/api/admin/status',
    '/telegram/agent/api/admin/metrics',
    '/telegram/agent/api/admin/default-session',
    '/telegram/agent/api/admin/skill-update',
    '/telegram/agent/api/tags',
    '/telegram/agent/api/question-queue',
    '/telegram/agent/api/question-queue/plan',
    '/telegram/agent/api/question-queue/apply',
    '/telegram/agent/api/group-approval-link',
    '/telegram/agent/api/group-approval-revoke',
    '/telegram/agent/api/onboarding',
    '/telegram/agent/api/results',
    '/telegram/agent/api/results-image',
    '/telegram/agent/api/geo-backlink',
  ].includes(url.pathname);
  const context = await resolveHandoffContext({
    env,
    input,
    auth,
    requireQuestionAuthoring: routeRequiresQuestionAuthoring,
  });
  if (!context.ok) {
    if (url.pathname === '/telegram/agent/api/tags' && context.status === 404) {
      if (safeString(input.sessionSlug)) {
        return json({
          ok: false,
          reason: 'session_not_found',
          sessionSlug: context.sessionSlug || sanitizeSessionSlug(input.sessionSlug),
          message: 'Unknown sessionSlug. Omit sessionSlug to use the current default session.',
        }, { status: 404 });
      }
      const fallbackContext = await resolveHandoffContext({
        env,
        input: { ...input, sessionSlug: '' },
        auth,
        requireQuestionAuthoring: false,
        ignoreSessionBinding: true,
      });
      if (fallbackContext.ok) {
        return handleTagsRequest({ env, context: fallbackContext, waitUntil });
      }
      if (fallbackContext.status !== 404) {
        return json({ ok: false, reason: fallbackContext.reason, sessionSlug: fallbackContext.sessionSlug || '' }, { status: fallbackContext.status });
      }
      return emptyTagsResponse(context.sessionSlug || input.sessionSlug);
    }
    return json({ ok: false, reason: context.reason, sessionSlug: context.sessionSlug || '' }, { status: context.status });
  }

  if (url.pathname === '/telegram/agent/api/questions' && (request.method === 'GET' || request.method === 'POST')) {
    return handleQuestionsRequest({ env, context, input, waitUntil });
  }
  if (url.pathname === '/telegram/agent/api/tags' && (request.method === 'GET' || request.method === 'POST')) {
    return handleTagsRequest({ env, context, waitUntil });
  }
  if (url.pathname === '/telegram/agent/api/admin/status' && (request.method === 'GET' || request.method === 'POST')) {
    return handleAdminStatusRequest({ env, context, input });
  }
  if (url.pathname === '/telegram/agent/api/admin/metrics' && (request.method === 'GET' || request.method === 'POST')) {
    return handleAdminMetricsRequest({ env, context, input });
  }
  if (url.pathname === '/telegram/agent/api/admin/default-session') {
    return handleAdminDefaultSessionRequest({ env, context, input, method: request.method });
  }
  if (url.pathname === '/telegram/agent/api/admin/skill-update') {
    return handleAdminSkillUpdateRequest({ env, context, input, method: request.method });
  }
  if (url.pathname === '/telegram/agent/api/onboarding' && (request.method === 'GET' || request.method === 'POST')) {
    return handleOnboardingRequest({ env, context, input, body, method: request.method });
  }
  if (url.pathname === '/telegram/agent/api/question-queue' && (request.method === 'GET' || request.method === 'POST')) {
    return handleQuestionQueueRequest({ env, context, input, waitUntil, method: request.method });
  }
  if (url.pathname === '/telegram/agent/api/question-queue/plan' && request.method === 'POST') {
    return handleQuestionQueuePlanRequest({ env, context, input, waitUntil });
  }
  if (url.pathname === '/telegram/agent/api/question-queue/apply' && request.method === 'POST') {
    return handleQuestionQueueApplyRequest({ env, context, input, waitUntil });
  }
  if (url.pathname === '/telegram/agent/api/group-approval-link' && request.method === 'POST') {
    return handleGroupApprovalLinkRequest({ env, context, input });
  }
  if (url.pathname === '/telegram/agent/api/group-approval-revoke' && request.method === 'POST') {
    return handleGroupApprovalRevokeRequest({ env, context, input });
  }
  if (url.pathname === '/telegram/agent/api/questions/next' && (request.method === 'GET' || request.method === 'POST')) {
    return handleNextQuestionRequest({ env, context, input, waitUntil });
  }
  if (url.pathname === '/telegram/agent/api/question-votes/recommend' && request.method === 'POST') {
    return handleQuestionVoteRecommendationsRequest({ env, context, input, waitUntil });
  }
  if (url.pathname === '/telegram/agent/api/question-votes/apply' && request.method === 'POST') {
    return handleQuestionVoteApplyRequest({ env, context, input, waitUntil });
  }
  if (url.pathname === '/telegram/agent/api/actions' && request.method === 'GET') {
    return handleActionsRequest({ env, context, input });
  }
  if (url.pathname === '/telegram/agent/api/mini-app-launch' && request.method === 'POST') {
    return handleMiniAppLaunchRequest({ env, context, input, waitUntil });
  }
  if (url.pathname === '/telegram/agent/api/results' && (request.method === 'GET' || request.method === 'POST')) {
    return handleResultsRequest({ env, context, input });
  }
  if (url.pathname === '/telegram/agent/api/results-image' && request.method === 'GET') {
    return handleResultsImageRequest({ env, context, input });
  }
  if (url.pathname === '/telegram/agent/api/geo-backlink' && (request.method === 'GET' || request.method === 'POST')) {
    return handleGeoBacklinkRequest({ env, context, input, waitUntil });
  }
  if (url.pathname === '/telegram/agent/api/preferences' && request.method === 'POST') {
    return handlePreferencesRequest({ env, context, input, waitUntil });
  }
  if (url.pathname === '/telegram/agent/api/questions/create' && request.method === 'POST') {
    return handleCreateQuestionsRequest({ env, context, input });
  }
  if (url.pathname === '/telegram/agent/api/questions/pose' && request.method === 'POST') {
    return handlePoseRequest({ env, context, input, fetchImpl });
  }
  if (url.pathname === '/telegram/agent/api/groups' && request.method === 'GET') {
    return handleGroupsRequest({ env, context });
  }
  if (url.pathname === '/telegram/agent/api/groups/propose' && request.method === 'POST') {
    return handleGroupProposalRequest({ env, context, input });
  }
  if (url.pathname === '/telegram/agent/api/sessions/child' && request.method === 'POST') {
    return handleChildSessionRequest({ env, context, input });
  }
  return json({ ok: false, reason: 'telegram_agent_route_not_found' }, { status: 404 });
}

export const __test__telegramAgentHandoff = {
  CE_TELEGRAM_AGENT_HANDOFF_SKILL_VERSION,
  authenticateAgentHandoff,
  normalizeAgentTelegramContext,
  normalizeDraftForQuestion,
  normalizePreferenceTagHints,
  normalizePreferenceEntries,
  buildQuestionVoteRecommendations,
  publicAgentQuestion,
  rankQuestionsByPreferences,
  safeJsonParse,
  skillVersionPayload,
  skillVersionPayloadWithFlag,
};
