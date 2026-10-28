import { selectCurrentSubmittedAnswers } from './submittedResults.mjs';
import { loadSessionPolicy } from './sessionPolicyLoader.mjs';
import { loadPublicQuestionsForHandoff } from './questions.mjs';
import { safeString, lower, safeJsonParse, stableFingerprint, sanitizeSessionSlug, sha256Hex } from './runtimePrimitives.mjs';
import { buildParticipantGraph, consensusQuestionsForResults, loadSubmittedResultRecords, summarizeQuestionResults } from './agentSessionRuntime.mjs';
import { buildResultsImage } from './resultImage.mjs';
import { loadOrBuildAgentTopicMap } from './agentTopicMap.mjs';
import { assertNoSecretShape } from './redaction.mjs';

import { RESULT_VIEW_CACHE_KV_PREFIX, RESULT_VIEW_CACHE_MAX_BYTES, RESULT_VIEW_CACHE_TTL_SECONDS, RESULT_VIEW_GENERIC_MAX_ARRAY_ITEMS, RESULT_VIEW_GENERIC_MAX_DEPTH, RESULT_VIEW_GENERIC_MAX_OBJECT_KEYS, RESULT_VIEW_VALUE_MAX_CHARS } from './httpConstants.mjs';
import { json } from './httpInput.mjs';
import { jsonResultViewCache } from './cors.mjs';


const sharedResultCacheScope = (env, value) => JSON.stringify([env.AGENT_CONTEXT.sessionId, env.AGENT_CONTEXT.revision, env.AGENT_CONTEXT.authzEpoch, value]);
export const resultCacheScope = (env, value) => JSON.stringify([env.AGENT_CONTEXT.sessionId, env.AGENT_CONTEXT.revision, env.AGENT_CONTEXT.authzEpoch, env.AGENT_CONTEXT.address?.toLowerCase(), env.AGENT_CONTEXT.auth?.delegation?.principal?.principalId, value]);

export function normalizeResultViewType(value = '') {
  const normalized = safeString(value || 'polis_clusters')
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48);
  return normalized || 'polis_clusters';
}

export function resultViewCacheKey(sessionSlug = '', viewType = '', dataVersionKey = '') {
  const slug = sanitizeSessionSlug(sessionSlug);
  const type = normalizeResultViewType(viewType);
  const fingerprint = stableFingerprint(`${slug}|${type}|${safeString(dataVersionKey)}`);
  return `${RESULT_VIEW_CACHE_KV_PREFIX}${slug}:${type}:${fingerprint}`;
}

export function normalizeGenericResultViewValue(value = {}, depth = 0) {
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
        const safeKey = safeString(key)
          .replace(/[^0-9A-Za-z_-]+/g, '_')
          .replace(/^_+|_+$/g, '')
          .slice(0, 64);
        if (!safeKey) return;
        const normalized = normalizeGenericResultViewValue(entry, depth + 1);
        if (normalized !== undefined) out[safeKey] = normalized;
      });
    return out;
  }
  return null;
}

export function normalizeResultViewAnalysisValue(value = {}, viewType = 'polis_clusters') {
  const type = normalizeResultViewType(viewType);
  if (type !== 'polis_clusters') {
    return normalizeGenericResultViewValue(value);
  }
  const input = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const clustersInput =
    input.clusters && typeof input.clusters === 'object' && !Array.isArray(input.clusters) ? input.clusters : input;
  const clusters = {};
  for (const [clusterKey, clusterValue] of Object.entries(clustersInput || {})) {
    const key = safeString(clusterKey)
      .replace(/[^0-9A-Za-z_-]+/g, '')
      .slice(0, 24);
    if (!key || !clusterValue || typeof clusterValue !== 'object' || Array.isArray(clusterValue)) continue;
    clusters[key] = {
      name: safeString(clusterValue.name).slice(0, 160),
      short: safeString(clusterValue.short).slice(0, RESULT_VIEW_VALUE_MAX_CHARS),
      long: safeString(clusterValue.long).slice(0, RESULT_VIEW_VALUE_MAX_CHARS),
    };
  }
  return { clusters };
}

// Prepared prose can contain source plaintext. Share it only with callers who
// can currently read the same complete canonical source set as its author.
async function currentResultSourceFingerprint(env, sessionSlug) {
  const policy = await loadSessionPolicy(env);
  const loaded = await loadPublicQuestionsForHandoff({ env, context: { session: policy.linkedSessions.find(session => session.sessionSlug === sessionSlug) } });
  const questions = loaded.questions || [];
  if (questions.length > 200) throw new Error('result_cache_source_limit');
  const responses = [];
  if (env.AGENT_CONTEXT.config.storageProfile?.backend === 'cloudflare') {
    let cursor = '', complete = false;
    const seen = new Set();
    for (let page = 0; page < 3 && !complete; page++) {
      const query = new URLSearchParams({ resource: 'responses', limit: '100', ...(cursor ? { cursor } : {}) });
      const response = await env.AGENT_SERVICES.storage(`/storage/list?${query}`);
      if (!response.ok) throw new Error('result_cache_source_denied');
      const body = await response.json();
      for (const item of body.items || []) {
        const id = item.storageRef?.id || item.id;
        if (!id || responses.length >= 200) throw new Error('result_cache_source_limit');
        const payload = await env.AGENT_SERVICES.storage(`/storage/read?id=${encodeURIComponent(id)}`);
        if (!payload.ok) throw new Error('result_cache_source_denied');
        responses.push({ id, payload: await payload.json() });
      }
      cursor = safeString(body.cursor);
      complete = body.listComplete === true || (body.listComplete === undefined && !cursor);
      if (!complete && (!cursor || seen.has(cursor))) throw new Error('result_cache_source_incomplete');
      seen.add(cursor);
    }
    if (!complete) throw new Error('result_cache_source_incomplete');
  }
  return sha256Hex(JSON.stringify({ questions, responses }));
}

export async function loadResultViewCache(env = {}, { sessionSlug = '', viewType = '', dataVersionKey = '' } = {}) {
  const kv = env?.AGENT_ACTION_KV;
  if (!kv || typeof kv.get !== 'function') return null;
  const key = resultViewCacheKey(sessionSlug, viewType, sharedResultCacheScope(env, dataVersionKey));
  const cached = safeJsonParse(await kv.get(key).catch(() => null), null);
  if (!cached || typeof cached !== 'object' || Array.isArray(cached) || cached.ok !== true) return null;
  try {
    if (!cached.sourceFingerprint || cached.sourceFingerprint !== await currentResultSourceFingerprint(env, sessionSlug)) return null;
  } catch { return null; }
  assertNoSecretShape(cached, "Cached Agent result view must not serialize secrets.");
  return {
    ...cached,
    cached: true,
    cacheLayer: 'kv',
  };
}

export async function saveResultViewCache(
  env = {},
  { sessionSlug = '', viewType = '', dataVersionKey = '', value = {} } = {},
) {
  const kv = env?.AGENT_ACTION_KV;
  if (!kv || typeof kv.put !== 'function') return null;
  const slug = sanitizeSessionSlug(sessionSlug);
  const type = normalizeResultViewType(viewType);
  const dataKey = safeString(dataVersionKey).slice(0, 512);
  const payload = {
    ok: true,
    type: 'telegram_result_view_cache',
    sourceFingerprint: await currentResultSourceFingerprint(env, slug),
    sessionSlug: slug,
    viewType: type,
    dataVersionKey: dataKey,
    generatedAt: new Date().toISOString(),
    model: 'gpt-5.5',
    reasoning_effort: 'high',
    value: normalizeResultViewAnalysisValue(value, type),
  };
  assertNoSecretShape(payload, "Agent result view cache payload must not serialize secrets.");
  const serialized = JSON.stringify(payload);
  if (new TextEncoder().encode(serialized).byteLength > RESULT_VIEW_CACHE_MAX_BYTES) {
    return { ok: false, reason: 'result_view_cache_value_too_large' };
  }
  await kv.put(resultViewCacheKey(slug, type, sharedResultCacheScope(env, dataKey)), serialized, {
    expirationTtl: RESULT_VIEW_CACHE_TTL_SECONDS,
  });
  return payload;
}

export async function handleResultViewCacheRequest({ env = {}, context = {}, input = {}, request = null } = {}) {
  const method = safeString(request?.method || 'GET').toUpperCase();
  const sessionSlug = context.session.sessionSlug;
  const viewType = normalizeResultViewType(input.viewType || input.type || 'polis_clusters');
  const dataVersionKey = safeString(input.dataVersionKey || input.dataKey || input.cacheKey).slice(0, 512);
  if (!dataVersionKey) {
    return jsonResultViewCache(request, env, { ok: false, reason: 'data_version_key_required' }, { status: 400 });
  }
  if (method === 'GET') {
    const cached = await loadResultViewCache(env, {
      sessionSlug,
      viewType,
      dataVersionKey,
    });
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

export function agentBoolean(value) {
  if (typeof value === 'boolean') return value;
  return ['1', 'true', 'yes', 'on', 'demo'].includes(lower(value));
}

export function aggregateResultsEnabledForAgent(session = {}) {
  const exposure =
    session.resultsExposure && typeof session.resultsExposure === 'object' && !Array.isArray(session.resultsExposure)
      ? session.resultsExposure
      : {};
  return exposure.aggregateResultsEnabled !== false;
}

export function anonymizedGroupsEnabledForAgent(session = {}) {
  const exposure =
    session.resultsExposure && typeof session.resultsExposure === 'object' && !Array.isArray(session.resultsExposure)
      ? session.resultsExposure
      : {};
  return exposure.anonymizedGroupsEnabled === true;
}

export function agentResultsMinGroupSize(session = {}) {
  const exposure =
    session.resultsExposure && typeof session.resultsExposure === 'object' && !Array.isArray(session.resultsExposure)
      ? session.resultsExposure
      : {};
  const n = Math.floor(Number(exposure.minGroupSize));
  return Number.isFinite(n) && n >= 2 ? n : 5;
}

export function requiresSessionMemberAggregateResults(context = {}, input = {}) {
  const results = context.session?.sessionModeProfile?.results;
  return (
    context.authMode === 'agent_credential' &&
    lower(results?.visibility) === 'session_member_aggregate'
  );
}

export async function authorizeSessionMemberAggregateResults({ env, context, input = {} }) {
  if (!requiresSessionMemberAggregateResults(context, input)) return { ok: true };
  try {
    const membership = await env.AGENT_SERVICES.memberships();
    const minGroupSize = agentResultsMinGroupSize(context.session);
    const rows = membership.groups;
    if (!membership.ok || !Array.isArray(rows)) return { ok: false, status: 503, reason: 'session_member_aggregate_membership_unavailable' };
    return rows.some(row => Number.isSafeInteger(row.memberCount) && row.memberCount >= minGroupSize) ? { ok: true } : { ok: false, status: 403, reason: 'session_member_aggregate_min_group_size_not_met', minGroupSize };
  } catch { return { ok: false, status: 403, reason: 'session_member_aggregate_membership_denied' }; }
}

export function sessionMemberAggregateDenial(access = {}) {
  const body = {
    ok: false,
    reason: access.reason || 'session_member_aggregate_membership_denied',
    ...(access.minGroupSize ? { minGroupSize: access.minGroupSize } : {}),
  };
  assertNoSecretShape(body, 'Session-member aggregate denial must not serialize secrets.');
  return json(body, { status: access.status || 403 });
}

export function normalizeAgentResultsView(value = '') {
  const view = lower(value || 'topic-map');
  if (['topic-map', 'topic', 'topic_map'].includes(view)) return 'topic-map';
  if (['group', 'groups'].includes(view)) return 'groups';
  if (view === 'consensus') return 'consensus';
  if (view === 'difference') return 'difference';
  return view;
}

export const AGENT_RESULTS_SUPPORTED_VIEWS = ['topic-map', 'consensus', 'difference', 'groups', 'polis'];

export const AGENT_RESULTS_IMAGE_SUPPORTED_VIEWS = ['topic-map', 'consensus', 'groups'];

export function anonymizeAgentGroups(groups = [], minGroupSize = 2) {
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
          cluster:
            statement.cluster && typeof statement.cluster === 'object' && !Array.isArray(statement.cluster)
              ? statement.cluster
              : {},
          overall:
            statement.overall && typeof statement.overall === 'object' && !Array.isArray(statement.overall)
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

export function demoAgentResultsQuestions(questions = []) {
  const source =
    Array.isArray(questions) && questions.length
      ? questions
      : [
          {
            questionId: 'demo-q-1',
            questionType: 'binary',
            prompt: 'Should onboarding optimize for one-click agent setup?',
          },
          {
            questionId: 'demo-q-2',
            questionType: 'binary',
            prompt: 'Should admins sponsor organizer-priority questions first?',
          },
          {
            questionId: 'demo-q-3',
            questionType: 'binary',
            prompt: 'Should topic maps hide raw response text by default?',
          },
          {
            questionId: 'demo-q-4',
            questionType: 'binary',
            prompt: 'Should agents draft answers from natural language context?',
          },
        ];
  return source.slice(0, 6).map((question, index) => ({
    ...question,
    questionId: safeString(question.questionId || question.id) || `demo-q-${index + 1}`,
    questionType: safeString(question.questionType || question.type || question.controlType) || 'binary',
    prompt: safeString(question.prompt || question.text || question.question) || `Demo question ${index + 1}`,
  }));
}

export function demoAgentResultsRecords(questions = []) {
  const labels = [
    ['Agree', 'Agree', 'Unsure', 'Disagree'],
    ['Agree', 'Unsure', 'Disagree', 'Disagree'],
    ['Unsure', 'Agree', 'Agree', 'Disagree'],
    ['Disagree', 'Disagree', 'Unsure', 'Agree'],
  ];
  return demoAgentResultsQuestions(questions).flatMap((question, questionIndex) =>
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
    }),
  );
}

export async function loadAgentResultsDataset({ env = {}, context = {}, input = {} } = {}) {
  const sessionSlug = sanitizeSessionSlug(context.session?.sessionSlug || input.sessionSlug);
  const loaded = await loadPublicQuestionsForHandoff({ env, context });
  const questions = loaded.questions.filter(q => q.answerable !== false && !q.locked && !q.encrypted);
  const visibleIds = new Set(questions.map(q => q.questionId));
  const demo = agentBoolean(input.demo);
  const sourceQuestions = demo ? demoAgentResultsQuestions(questions) : questions;
  const sourceRecords = demo
    ? demoAgentResultsRecords(sourceQuestions)
    : await loadSubmittedResultRecords(env, sessionSlug).then(rows => selectCurrentSubmittedAnswers(rows.filter(row => visibleIds.has(row.questionId))));
  return {
    sessionSlug,
    questions,
    sourceQuestions,
    sourceRecords,
    demo,
  };
}

// Pseudonymized per-participant binary vectors so the web client can render the
// full PolisReport (clusters need vectors, not the aggregate counts the other
// views return). Same exposure gate as the participant graph: this reveals the
// identical granularity, just shaped for the client-side polis math.
export const AGENT_POLIS_BINARY_LABELS = new Set(['Agree', 'Disagree', 'Unsure']);

export function buildAgentPolisDataset({ sessionSlug = '', sourceRecords = [], sourceQuestions = [], demo = false } = {}) {
  const binaryQuestions = consensusQuestionsForResults(sourceQuestions);
  const binaryQuestionIds = new Set(
    binaryQuestions.map((question) => safeString(question.questionId || question.id)).filter(Boolean),
  );
  const records = (Array.isArray(sourceRecords) ? sourceRecords : []).filter(
    (record) =>
      binaryQuestionIds.has(safeString(record.questionId)) &&
      AGENT_POLIS_BINARY_LABELS.has(safeString(record.label)) &&
      safeString(record.telegramUserId),
  );
  const latestRecords = demo ? records : selectCurrentSubmittedAnswers(records);
  const participants = Array.from(new Set(latestRecords.map((record) => safeString(record.telegramUserId))));
  const aliasById = new Map(participants.map((id, index) => [id, `P${index + 1}`]));
  const responses = {};
  for (const record of latestRecords) {
    const questionIdValue = safeString(record.questionId);
    if (!responses[questionIdValue]) responses[questionIdValue] = [];
    responses[questionIdValue].push({
      responder: aliasById.get(safeString(record.telegramUserId)),
      value: safeString(record.label),
    });
  }
  const questions = binaryQuestions
    .map((question) => ({
      questionId: safeString(question.questionId || question.id),
      prompt: safeString(question.questionText || question.prompt || question.title),
      questionType: 'binary',
    }))
    .filter((question) => question.questionId && question.prompt && responses[question.questionId]);
  const answeredQuestionIds = new Set(questions.map((question) => question.questionId));
  Object.keys(responses).forEach((questionIdValue) => {
    if (!answeredQuestionIds.has(questionIdValue)) delete responses[questionIdValue];
  });
  return {
    ok: true,
    sessionSlug: safeString(sessionSlug),
    view: 'polis',
    demo: demo === true,
    participantCount: participants.length,
    questionCount: questions.length,
    responseCount: latestRecords.length,
    questions,
    responses,
  };
}

export function aggregateQuestionRows(records = [], questions = [], view = 'consensus') {
  const consensusQuestions = consensusQuestionsForResults(questions);
  const consensusQuestionIds = new Set(
    consensusQuestions.map((question) => safeString(question.questionId || question.id)).filter(Boolean),
  );
  const consensusRecords = records.filter((record) => consensusQuestionIds.has(safeString(record.questionId)));
  const rows = summarizeQuestionResults(consensusRecords, consensusQuestions)
    .map((summary) => {
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
    })
    .filter((row) => row.total > 0);
  return rows.sort((left, right) =>
    view === 'difference'
      ? right.differenceScore - left.differenceScore ||
        right.total - left.total ||
        left.prompt.localeCompare(right.prompt)
      : right.agreementScore - left.agreementScore ||
        right.total - left.total ||
        left.prompt.localeCompare(right.prompt),
  );
}

export function beeswarmRowsFromAgentQuestionRows(rows = []) {
  return rows.slice(0, 3).map((row, index) => ({
    label: `Q${index + 1}`,
    prompt: row.prompt,
    answers: row.counts.flatMap((item) => new Array(Math.max(0, Number(item.count || 0))).fill(item.label)),
  }));
}

export async function buildAgentTopicMap({ env = {}, context = {}, input = {} } = {}) {
  const sessionSlug = sanitizeSessionSlug(context.session?.sessionSlug || input.sessionSlug);
  const loaded = await loadPublicQuestionsForHandoff({ env, context });
  const questions = loaded.questions.filter(q => q.answerable !== false && !q.locked && !q.encrypted);
  const visibleIds = new Set(questions.map(q => q.questionId));
  const records = await loadSubmittedResultRecords(env, sessionSlug).then(rows => selectCurrentSubmittedAnswers(rows.filter(row => visibleIds.has(row.questionId))));
  const demo = agentBoolean(input.demo);
  const sourceQuestions = demo
    ? [
        {
          questionId: 'demo-topic-q-1',
          prompt: 'Should onboarding optimize for one-click agent setup?',
          tags: ['onboarding'],
        },
        {
          questionId: 'demo-topic-q-2',
          prompt: 'Should admins sponsor organizer-priority questions first?',
          tags: ['question-cadence'],
        },
        {
          questionId: 'demo-topic-q-3',
          prompt: 'Should topic maps hide raw response text by default?',
          tags: ['privacy'],
        },
        {
          questionId: 'demo-topic-q-4',
          prompt: 'Should agents draft answers from natural language context?',
          tags: ['agent-workflow'],
        },
      ]
    : questions;
  const sourceRecords = demo
    ? sourceQuestions.flatMap((question, questionIndex) =>
        Array.from({ length: 4 }, (_, participantIndex) => ({
          telegramUserId: `demo-user-${participantIndex + 1}`,
          questionId: question.questionId,
          label: ['Agree', 'Unsure', 'Disagree', 'Agree'][(questionIndex + participantIndex) % 4],
          createdAt: `demo-topic-${questionIndex}-${participantIndex}`,
        })),
      )
    : records;
  const topicMap = await loadOrBuildAgentTopicMap({
    env,
    session: context.session,
    sessionSlug,
    questions: sourceQuestions,
    records: sourceRecords,
    demo,
    variantKey: resultCacheScope(env, 'agent'),
  });
  return {
    sessionSlug,
    records,
    sourceRecords,
    topicMap,
    demo,
  };
}

export async function handleResultsRequest({
  env = {},
  context = {},
  input = {},
  fetchImpl = env.AGENT_FETCH || globalThis.fetch,
} = {}) {
  const view = normalizeAgentResultsView(input.view || 'topic-map');
  if (!AGENT_RESULTS_SUPPORTED_VIEWS.includes(view)) {
    const body = {
      ok: false,
      reason: 'unsupported_results_view',
      supportedViews: AGENT_RESULTS_SUPPORTED_VIEWS,
    };
    assertNoSecretShape(body, "Agent results unsupported-view response must not serialize secrets.");
    return json(body, { status: 400 });
  }
  const demo = agentBoolean(input.demo);
  if (view === 'topic-map') {
    if (!demo && !aggregateResultsEnabledForAgent(context.session)) {
      const body = {
        ok: false,
        reason: 'level_3_aggregate_results_admin_disabled',
      };
      assertNoSecretShape(body, "Agent results gate response must not serialize secrets.");
      return json(body, { status: 403 });
    }
    const memberAccess = await authorizeSessionMemberAggregateResults({
      env,
      context,
      input,
      fetchImpl,
    });
    if (!memberAccess.ok) return sessionMemberAggregateDenial(memberAccess);
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
    assertNoSecretShape(body, "Agent results response must not serialize secrets.");
    return json(body, { status: 200 });
  }
  if (['consensus', 'difference'].includes(view)) {
    if (!demo && !aggregateResultsEnabledForAgent(context.session)) {
      const body = {
        ok: false,
        reason: 'level_3_aggregate_results_admin_disabled',
      };
      assertNoSecretShape(body, "Agent results gate response must not serialize secrets.");
      return json(body, { status: 403 });
    }
    const memberAccess = await authorizeSessionMemberAggregateResults({
      env,
      context,
      input,
      fetchImpl,
    });
    if (!memberAccess.ok) return sessionMemberAggregateDenial(memberAccess);
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
    assertNoSecretShape(body, "Agent aggregate results response must not serialize secrets.");
    return json(body, { status: 200 });
  }
  if (view === 'polis') {
    if (!demo && !anonymizedGroupsEnabledForAgent(context.session)) {
      const body = { ok: false, reason: 'anonymized_groups_admin_disabled' };
      assertNoSecretShape(body, "Agent polis gate response must not serialize secrets.");
      return json(body, { status: 403 });
    }
    const memberAccess = await authorizeSessionMemberAggregateResults({
      env,
      context,
      input,
      fetchImpl,
    });
    if (!memberAccess.ok) return sessionMemberAggregateDenial(memberAccess);
    const loaded = await loadAgentResultsDataset({ env, context, input });
    const body = buildAgentPolisDataset(loaded);
    const minGroupSize = agentResultsMinGroupSize(context.session);
    if (!loaded.demo && Number(body.participantCount || 0) < minGroupSize) {
      const insufficient = {
        ok: false,
        reason: 'polis_min_group_size_not_met',
        minGroupSize,
        participantCount: Number(body.participantCount || 0),
      };
      assertNoSecretShape(insufficient, "Agent polis min-group response must not serialize secrets.");
      return json(insufficient, { status: 403 });
    }
    body.minGroupSize = minGroupSize;
    assertNoSecretShape(body, "Agent polis dataset response must not serialize secrets.");
    return json(body, { status: 200 });
  }
  if (!demo && !anonymizedGroupsEnabledForAgent(context.session)) {
    const body = { ok: false, reason: 'anonymized_groups_admin_disabled' };
    assertNoSecretShape(body, "Agent groups gate response must not serialize secrets.");
    return json(body, { status: 403 });
  }
  const memberAccess = await authorizeSessionMemberAggregateResults({
    env,
    context,
    input,
    fetchImpl,
  });
  if (!memberAccess.ok) return sessionMemberAggregateDenial(memberAccess);
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
  assertNoSecretShape(body, "Agent anonymized groups response must not serialize secrets.");
  return json(body, { status: 200 });
}

export async function handleResultsImageRequest({
  env = {},
  context = {},
  input = {},
  fetchImpl = env.AGENT_FETCH || globalThis.fetch,
} = {}) {
  const view = normalizeAgentResultsView(input.view || 'topic-map');
  if (!AGENT_RESULTS_IMAGE_SUPPORTED_VIEWS.includes(view)) {
    const body = {
      ok: false,
      reason: 'unsupported_results_view',
      supportedViews: AGENT_RESULTS_IMAGE_SUPPORTED_VIEWS,
    };
    assertNoSecretShape(body, "Agent results-image unsupported-view response must not serialize secrets.");
    return json(body, { status: 400 });
  }
  const demo = agentBoolean(input.demo);
  if (view === 'topic-map') {
    if (!demo && !aggregateResultsEnabledForAgent(context.session)) {
      const body = {
        ok: false,
        reason: 'level_3_aggregate_results_admin_disabled',
      };
      assertNoSecretShape(body, "Agent results-image gate response must not serialize secrets.");
      return json(body, { status: 403 });
    }
    const memberAccess = await authorizeSessionMemberAggregateResults({
      env,
      context,
      input,
      fetchImpl,
    });
    if (!memberAccess.ok) return sessionMemberAggregateDenial(memberAccess);
    const built = await buildAgentTopicMap({ env, context, input });
    if (!built.topicMap.availability.available && !built.demo) {
      const body = {
        ok: false,
        reason: built.topicMap.availability.reason || 'topic_map_not_enough_data',
        sessionSlug: built.sessionSlug,
        view: 'topic-map',
      };
      assertNoSecretShape(body, "Agent topic-map image unavailable response must not serialize secrets.");
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
      const body = {
        ok: false,
        reason: 'level_3_aggregate_results_admin_disabled',
      };
      assertNoSecretShape(body, "Agent consensus image gate response must not serialize secrets.");
      return json(body, { status: 403 });
    }
    const memberAccess = await authorizeSessionMemberAggregateResults({
      env,
      context,
      input,
      fetchImpl,
    });
    if (!memberAccess.ok) return sessionMemberAggregateDenial(memberAccess);
    const loaded = await loadAgentResultsDataset({ env, context, input });
    const rows = aggregateQuestionRows(loaded.sourceRecords, loaded.sourceQuestions, 'consensus');
    if (!loaded.demo && (!loaded.sourceRecords.length || !rows.length)) {
      const body = {
        ok: false,
        reason: 'not_enough_data_for_view',
        sessionSlug: loaded.sessionSlug,
        view: 'consensus',
      };
      assertNoSecretShape(body, "Agent consensus image unavailable response must not serialize secrets.");
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
    assertNoSecretShape(body, "Agent groups image gate response must not serialize secrets.");
    return json(body, { status: 403 });
  }
  const memberAccess = await authorizeSessionMemberAggregateResults({
    env,
    context,
    input,
    fetchImpl,
  });
  if (!memberAccess.ok) return sessionMemberAggregateDenial(memberAccess);
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
    assertNoSecretShape(body, "Agent groups image unavailable response must not serialize secrets.");
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
