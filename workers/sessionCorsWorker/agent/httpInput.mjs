import { safeString, lower } from './runtimePrimitives.mjs';
import { LEGACY_TRANSPORT_LANES } from './constants.mjs';


export function safeAnswerString(value) {
  if (value === undefined || value === null) return '';
  return String(value).trim();
}

export function normalizeBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback;
  if (value === true || value === false) return value;
  const normalized = lower(value);
  if (['true', '1', 'yes', 'y', 'on'].includes(normalized)) return true;
  if (['false', '0', 'no', 'n', 'off'].includes(normalized)) return false;
  return fallback;
}

export function toCanonicalAgentApiPathname(pathname = '') { return safeString(pathname); }

export function json(data, init = {}) {
  const headers = new Headers({ 'content-type': 'application/json; charset=utf-8' });
  new Headers(init.headers).forEach((value, name) => headers.set(name, value));
  return new Response(JSON.stringify(data, null, 2), { ...init, headers });
}

export function sessionAgentOrigin(env = {}) { return env.AGENT_CONTEXT?.origin || ''; }

export function firstValue(...values) {
  return values.find((value) => safeString(value) !== '');
}

export function titleAnswer(value = '') {
  const normalized = lower(value);
  if (normalized === 'agree' || normalized === 'yes' || normalized === 'true') return 'Agree';
  if (normalized === 'disagree' || normalized === 'no' || normalized === 'false') return 'Disagree';
  if (normalized === 'unsure' || normalized === 'unknown' || normalized === 'maybe') return 'Unsure';
  return safeString(value);
}

export function normalizeAgentRequestContext(input = {}) {
  const telegram =
    input.telegram && typeof input.telegram === 'object' && !Array.isArray(input.telegram) ? input.telegram : {};
  const telegramUserId = safeString(input.telegramUserId || input.userId || telegram.telegramUserId || telegram.userId);
  const username = safeString(input.username || telegram.username);
  const groupChatId = safeString(input.groupChatId || input.chatId || telegram.groupChatId || telegram.chatId);
  const chatId = groupChatId || telegramUserId;
  const isPrivate = !groupChatId;
  return {
    type: 'telegram_mock_update',
    updateId: safeString(input.updateId) || `agent-${Date.now()}`,
    kind: 'agent_handoff',
    lane: isPrivate ? LEGACY_TRANSPORT_LANES.PRIVATE_ACCOUNT : LEGACY_TRANSPORT_LANES.GROUP_LOBBY,
    user: { telegramUserId, username },
    chat: {
      chatId,
      chatType: groupChatId ? 'supergroup' : 'private',
      type: groupChatId ? 'supergroup' : 'private',
      isPrivate,
    },
  };
}

export async function readRequestJson(request) {
  if (request.method === 'GET' || request.method === 'HEAD') return {};
  return request.json().catch(() => ({}));
}

export function inputFromRequest(request, body = {}) {
  const url = new URL(request.url);
  return {
    ...body,
    sessionSlug: safeString(body.sessionSlug || url.searchParams.get('sessionSlug')),
    telegramUserId: safeString(body.telegramUserId || url.searchParams.get('telegramUserId')),
    createdAt: safeString(body.createdAt || url.searchParams.get('createdAt')),
    chatId: safeString(body.chatId || url.searchParams.get('chatId')),
    groupChatId: safeString(body.groupChatId || url.searchParams.get('groupChatId')),
    username: safeString(body.username || url.searchParams.get('username')),
    tags: body.tags || url.searchParams.get('tags') || url.searchParams.get('tag'),
    interests: body.interests || url.searchParams.get('interests'),
    sessionsAttended:
      body.sessionsAttended ||
      body.attendedSessions ||
      url.searchParams.get('sessionsAttended') ||
      url.searchParams.get('attendedSessions'),
    relevanceMode: safeString(body.relevanceMode || url.searchParams.get('relevanceMode')),
    questionTypes:
      body.questionTypes ||
      body.questionType ||
      url.searchParams.get('questionTypes') ||
      url.searchParams.get('questionType'),
    limit: Object.hasOwn(body, 'limit') ? body.limit : url.searchParams.get('limit'),
    count: Object.hasOwn(body, 'count') ? body.count : url.searchParams.get('count'),
    topN: Object.hasOwn(body, 'topN') ? body.topN : url.searchParams.get('topN'),
    cursor: safeString(body.cursor || url.searchParams.get('cursor')),
    compact: Object.hasOwn(body, 'compact') ? body.compact : url.searchParams.get('compact'),
    format: safeString(body.format || url.searchParams.get('format')),
    include_base64: Object.hasOwn(body, 'include_base64')
      ? body.include_base64
      : url.searchParams.get('include_base64'),
    includeBase64: Object.hasOwn(body, 'includeBase64') ? body.includeBase64 : url.searchParams.get('includeBase64'),
    queueKey: safeString(body.queueKey || url.searchParams.get('queueKey')),
    advance: Object.hasOwn(body, 'advance') ? body.advance : url.searchParams.get('advance'),
    resetQueue: Object.hasOwn(body, 'resetQueue')
      ? body.resetQueue
      : body.reset || url.searchParams.get('resetQueue') || url.searchParams.get('reset'),
    includeSponsored: Object.hasOwn(body, 'includeSponsored')
      ? body.includeSponsored
      : url.searchParams.get('includeSponsored'),
    sponsoredFirst: Object.hasOwn(body, 'sponsoredFirst')
      ? body.sponsoredFirst
      : url.searchParams.get('sponsoredFirst'),
    questionIds: Object.hasOwn(body, 'questionIds') ? body.questionIds : url.searchParams.get('questionIds'),
    orderedQuestionIds: Object.hasOwn(body, 'orderedQuestionIds')
      ? body.orderedQuestionIds
      : url.searchParams.get('orderedQuestionIds'),
    skippedQuestionIds: Object.hasOwn(body, 'skippedQuestionIds')
      ? body.skippedQuestionIds
      : url.searchParams.get('skippedQuestionIds'),
    questionSeries: Object.hasOwn(body, 'questionSeries') ? body.questionSeries : undefined,
    draftAnswersByQuestionId: Object.hasOwn(body, 'draftAnswersByQuestionId')
      ? body.draftAnswersByQuestionId
      : undefined,
    prefilledDraftsByQuestionId: Object.hasOwn(body, 'prefilledDraftsByQuestionId')
      ? body.prefilledDraftsByQuestionId
      : undefined,
    sponsoredQuestionIds: Object.hasOwn(body, 'sponsoredQuestionIds')
      ? body.sponsoredQuestionIds
      : url.searchParams.get('sponsoredQuestionIds'),
    sponsoredQuestions: Object.hasOwn(body, 'sponsoredQuestions')
      ? body.sponsoredQuestions
      : url.searchParams.get('sponsoredQuestions'),
    operation: safeString(body.operation || url.searchParams.get('operation')),
    clearQueue: Object.hasOwn(body, 'clear') ? body.clear : url.searchParams.get('clear'),
    view: safeString(body.view || body.mode || url.searchParams.get('view') || url.searchParams.get('mode')),
    viewType: safeString(
      body.viewType || body.type || url.searchParams.get('viewType') || url.searchParams.get('type'),
    ),
    dataVersionKey: safeString(
      body.dataVersionKey ||
        body.dataKey ||
        body.cacheKey ||
        url.searchParams.get('dataVersionKey') ||
        url.searchParams.get('dataKey') ||
        url.searchParams.get('cacheKey'),
    ),
    value: Object.hasOwn(body, 'value') ? body.value : undefined,
    result: Object.hasOwn(body, 'result') ? body.result : undefined,
    cache: Object.hasOwn(body, 'cache') ? body.cache : undefined,
    demo: Object.hasOwn(body, 'demo') ? body.demo : url.searchParams.get('demo'),
    includeLegacySessions: Object.hasOwn(body, 'includeLegacySessions')
      ? body.includeLegacySessions
      : body.includeLegacy || url.searchParams.get('includeLegacySessions') || url.searchParams.get('includeLegacy'),
    questionId: safeString(body.questionId || url.searchParams.get('questionId')),
    geoId: safeString(
      body.geoId || body.geoNodeId || url.searchParams.get('geoId') || url.searchParams.get('geoNodeId'),
    ),
    geoRefs: Object.hasOwn(body, 'geoRefs')
      ? body.geoRefs
      : body.geoIds || url.searchParams.get('geoRefs') || url.searchParams.get('geoIds'),
  };
}
