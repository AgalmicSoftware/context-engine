import { TELEGRAM_CHAT_LANES } from './constants.mjs';
import {
  buildTelegramCommandResponse,
  loadQuestionsForSession,
  loadSessionPolicy,
  persistAnswerDraft,
  readGroupSessionBinding,
  readPrivateSessionBinding,
} from './telegramCommands.mjs';
import {
  inferQuestionTags,
  normalizeQuestionTags,
  persistTelegramProposedQuestion,
  sessionContextFromPolicySession,
} from './telegramQuestionProposals.mjs';
import { evaluateTelegramQuestionAuthoringPermission } from './telegramAuthoringPermissions.mjs';
import { resolveSessionInvocation } from './sessionPolicy.mjs';
import { evaluateTelegramGroupSessionAccessForEnv } from './telegramGroupApprovals.mjs';
import { telegramBotApiRequest } from './telegramSender.mjs';
import { buildOpaqueActionId } from './opaqueActions.mjs';
import { assertNoSecretShape } from './redaction.mjs';
import {
  loadTelegramLightweightGroups,
  persistTelegramChildSession,
  persistTelegramLightweightGroupProposal,
} from './telegramGroups.mjs';
import { loadTelegramAgentSettings } from './telegramAgentSettings.mjs';
import {
  AGENT_QUESTION_VOTE_RECOMMENDATION_KV_PREFIX,
  listTelegramAgentActivity,
} from './telegramAgentActivity.mjs';
import {
  loadTelegramQuestionQueueConfig,
  saveTelegramQuestionQueueConfig,
  selectNextTelegramQuestion,
} from './telegramQuestionQueue.mjs';
import { canManageResponseExportAllowlist } from './telegramResponseExport.mjs';
import {
  delegationTokenHasScope,
  loadTelegramAgentDelegationToken,
  TELEGRAM_AGENT_DELEGATION_TOKEN_SCOPES,
} from './telegramAgentDelegationTokens.mjs';

const MINI_APP_QUESTION_VOTE_KV_PREFIX = 'telegram:mini-app-question-vote:v1:';
const AGENT_QUESTION_VOTE_DECISION_KV_PREFIX = 'telegram:agent-question-vote-decision:v1:';

function safeString(value) {
  return String(value || '').trim();
}

function lower(value) {
  return safeString(value).toLowerCase();
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
    sponsoredQuestionIds: Object.hasOwn(body, 'sponsoredQuestionIds') ? body.sponsoredQuestionIds : url.searchParams.get('sponsoredQuestionIds'),
    sponsoredQuestions: Object.hasOwn(body, 'sponsoredQuestions') ? body.sponsoredQuestions : url.searchParams.get('sponsoredQuestions'),
    operation: safeString(body.operation || url.searchParams.get('operation')),
    clearQueue: Object.hasOwn(body, 'clear') ? body.clear : url.searchParams.get('clear'),
  };
}

function delegationScopeForRequest(pathname = '', method = 'GET') {
  const methodName = safeString(method).toUpperCase();
  if (pathname === '/telegram/agent/api/questions') {
    return TELEGRAM_AGENT_DELEGATION_TOKEN_SCOPES.READ_QUESTIONS;
  }
  if (pathname === '/telegram/agent/api/questions/next') {
    return TELEGRAM_AGENT_DELEGATION_TOKEN_SCOPES.READ_QUESTIONS;
  }
  if (pathname === '/telegram/agent/api/actions') {
    return TELEGRAM_AGENT_DELEGATION_TOKEN_SCOPES.READ_QUESTIONS;
  }
  if (pathname === '/telegram/agent/api/admin/status') {
    return TELEGRAM_AGENT_DELEGATION_TOKEN_SCOPES.READ_QUESTIONS;
  }
  if (pathname === '/telegram/agent/api/question-queue/plan') {
    return TELEGRAM_AGENT_DELEGATION_TOKEN_SCOPES.READ_QUESTIONS;
  }
  if (pathname === '/telegram/agent/api/question-queue/apply') {
    return TELEGRAM_AGENT_DELEGATION_TOKEN_SCOPES.READ_QUESTIONS;
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
  if (pathname === '/telegram/agent/api/questions/pose') {
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

function applyDelegationToInput(auth = {}, input = {}, pathname = '', method = 'GET') {
  if (auth.authMode !== 'telegram_agent_delegation_token') return { ok: true, input };
  const delegation = auth.delegation || {};
  const scope = delegationScopeForRequest(pathname, method);
  if (!scope || !delegationTokenHasScope(delegation, scope)) {
    return { ok: false, status: 403, reason: 'agent_token_scope_denied', requiredScope: scope || 'unsupported_route' };
  }
  const tokenSessionSlug = sanitizeSessionSlug(delegation.sessionSlug);
  const requestedSessionSlug = sanitizeSessionSlug(input.sessionSlug);
  if (requestedSessionSlug && tokenSessionSlug && requestedSessionSlug !== tokenSessionSlug) {
    return { ok: false, status: 403, reason: 'agent_token_session_mismatch', sessionSlug: requestedSessionSlug };
  }
  return {
    ok: true,
    input: {
      ...input,
      telegramUserId: safeString(delegation.telegramUserId),
      username: safeString(input.username || delegation.username),
      sessionSlug: tokenSessionSlug || requestedSessionSlug,
      groupChatId: safeString(input.groupChatId),
    },
  };
}

async function resolveHandoffContext({
  env = {},
  input = {},
  auth = {},
  requireQuestionAuthoring = true,
} = {}) {
  const policy = await loadSessionPolicy(env);
  const normalized = normalizeAgentTelegramContext(input);
  if (!normalized.user.telegramUserId) {
    return { ok: false, status: 400, reason: 'telegram_user_required' };
  }
  const groupBinding = await readGroupSessionBinding(env, normalized);
  const privateBinding = await readPrivateSessionBinding(env, normalized);
  const sessionSlug = sanitizeSessionSlug(
    input.sessionSlug ||
    groupBinding?.sessionSlug ||
    privateBinding?.sessionSlug ||
    policy.defaultSessionSlug
  );
  const resolved = resolveSessionInvocation(policy, sessionSlug);
  if (!resolved.ok) {
    return { ok: false, status: 404, reason: resolved.reason || 'session_not_found', sessionSlug };
  }
  const delegation = auth.authMode === 'telegram_agent_delegation_token' ? auth.delegation : null;
  if (delegation) {
    const delegatedSessionSlug = sanitizeSessionSlug(delegation.sessionSlug);
    if (delegatedSessionSlug && delegatedSessionSlug !== resolved.session.sessionSlug) {
      return { ok: false, status: 403, reason: 'agent_token_session_mismatch', sessionSlug: resolved.session.sessionSlug };
    }
  }
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
      groupBinding,
      privateBinding: privateBinding || (delegation ? {
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
    groupBinding,
    privateBinding,
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
  return json({
    ok: true,
    sessionSlug: context.session.sessionSlug,
    permissionMode: context.permission.mode,
    questionSource: loaded.source || '',
    questionSourceReason: loaded.reason || '',
    relevance: ranked.relevance,
    questions: ranked.questions,
  });
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

export async function handleTelegramAgentHandoffRequest({
  request,
  env = {},
  waitUntil = null,
  fetchImpl = globalThis.fetch,
} = {}) {
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

  const url = new URL(request.url);
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
  const input = delegated.input;
  const routeRequiresQuestionAuthoring = ![
    '/telegram/agent/api/admin/status',
    '/telegram/agent/api/question-queue',
    '/telegram/agent/api/question-queue/plan',
    '/telegram/agent/api/question-queue/apply',
  ].includes(url.pathname);
  const context = await resolveHandoffContext({
    env,
    input,
    auth,
    requireQuestionAuthoring: routeRequiresQuestionAuthoring,
  });
  if (!context.ok) return json({ ok: false, reason: context.reason, sessionSlug: context.sessionSlug || '' }, { status: context.status });

  if (url.pathname === '/telegram/agent/api/questions' && (request.method === 'GET' || request.method === 'POST')) {
    return handleQuestionsRequest({ env, context, input, waitUntil });
  }
  if (url.pathname === '/telegram/agent/api/admin/status' && (request.method === 'GET' || request.method === 'POST')) {
    return handleAdminStatusRequest({ env, context, input });
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
  if (url.pathname === '/telegram/agent/api/preferences' && request.method === 'POST') {
    return handlePreferencesRequest({ env, context, input, waitUntil });
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
  authenticateAgentHandoff,
  normalizeAgentTelegramContext,
  normalizeDraftForQuestion,
  normalizePreferenceTagHints,
  normalizePreferenceEntries,
  buildQuestionVoteRecommendations,
  publicAgentQuestion,
  rankQuestionsByPreferences,
  safeJsonParse,
};
