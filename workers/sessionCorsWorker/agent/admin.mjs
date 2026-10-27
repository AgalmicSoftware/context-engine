import { safeString, lower, safeJsonParse, sanitizeSessionSlug } from './runtimePrimitives.mjs';
import { clearAgentSkillUpdateFlag, readAgentSkillUpdateFlag, writeAgentSkillUpdateFlag } from './agentSessionRuntime.mjs';

import { archiveAgentProposedQuestion, deleteAgentProposedQuestion } from './agentQuestionProposals.mjs';

import { assertNoSecretShape } from './redaction.mjs';
import { DRAFT_EDIT_METRIC_KV_PREFIX } from './agentDraftEditMetrics.mjs';
import { listCurrentAgentSession } from './registrySessions.mjs';
import { canManageResponseExportAllowlist } from './agentResponseAccess.mjs';
import { AGENT_CREDENTIAL_KV_PREFIX } from './agentCredentials.mjs';
import { buildAgentOnlyMetrics, exportAgentOnlyData, loadAgentOnlyModeConfig, saveAgentOnlyModeConfig } from './agentOnlyMode.mjs';
import { SUBMIT_REQUEST_KV_PREFIX, SUBMIT_REQUEST_SESSION_KV_PREFIX, SUBMIT_REQUEST_USER_KV_PREFIX, SUBMIT_REQUEST_TTL_SECONDS, SUBMITTED_RESULT_STATUSES, submitRequestSessionKvPrefix } from './agentSubmitQueue.mjs';
import { ADMIN_METRICS_CACHE_KV_PREFIX, ADMIN_METRICS_CACHE_TTL_SECONDS, ADMIN_METRICS_SUBMIT_ENTRY_LIMIT, ADMIN_QUESTIONS_DELETE_MAX_IDS, ANSWER_DRAFT_KV_PREFIX, CE_AGENT_ACCESS_SKILL_VERSION, LIGHTWEIGHT_GROUP_PROPOSAL_KV_PREFIX, PROPOSED_QUESTION_KV_PREFIX } from './httpConstants.mjs';
import { json, normalizeBoolean } from './httpInput.mjs';
import { emptyAdminMetricTotals, incrementMetric, listMetricKvEntriesByPrefix, publicSessionMetric, readMetricRecord, sessionFromDraftKey, sessionFromSessionFirstKey, sessionMetric, userFromSubmitUserKey } from './adminMetrics.mjs';
import { loadAgentAdminStatus, requireQuestionQueueAdmin } from './adminAuthority.mjs';

export async function handleAdminStatusRequest({ env = {}, context = {}, input = {} } = {}) {
  const status = await loadAgentAdminStatus({ env, context, input });
  return json(status);
}

export async function handleAdminSkillUpdateRequest({ env = {}, context = {}, input = {}, method = 'GET' } = {}) {
  const methodName = safeString(method).toUpperCase();
  if (methodName === 'GET') {
    const admin = await requireQuestionQueueAdmin({
      env,
      context,
      input,
      allowDelegatedAdmin: true,
    });
    if (!admin.ok) {
      const payload = {
        ok: false,
        reason: admin.reason,
        accountAddress: admin.accountAddress || '',
      };
      assertNoSecretShape(payload, "Agent admin skill-update denied response must not serialize secrets.");
      return json(payload, { status: admin.status || 403 });
    }
    const flag = await readAgentSkillUpdateFlag(env);
    const payload = {
      ok: true,
      updateAvailable: flag.updateAvailable === true,
      latestVersion: flag.latestVersion || CE_AGENT_ACCESS_SKILL_VERSION,
      updateNote: flag.note || '',
      version: CE_AGENT_ACCESS_SKILL_VERSION,
    };
    assertNoSecretShape(payload, "Agent admin skill-update status must not serialize secrets.");
    return json(payload);
  }

  if (methodName === 'POST') {
    const admin = await requireQuestionQueueAdmin({
      env,
      context,
      input,
      allowDelegatedAdmin: false,
    });
    if (!admin.ok) {
      const payload = {
        ok: false,
        reason: admin.reason,
        accountAddress: admin.accountAddress || '',
      };
      assertNoSecretShape(payload, "Agent admin skill-update denied response must not serialize secrets.");
      return json(payload, { status: admin.status || 403 });
    }
    const written = await writeAgentSkillUpdateFlag({
      env,
      latestVersion: input.latestVersion || CE_AGENT_ACCESS_SKILL_VERSION,
      note: input.note || input.updateNote || '',
      accountAddress: admin.manager?.accountAddress || '',
      createdAt: input.createdAt || null,
    });
    if (!written.ok) {
      const payload = {
        ok: false,
        reason: written.reason || 'agent_skill_update_write_failed',
      };
      assertNoSecretShape(payload, "Agent admin skill-update write failure must not serialize secrets.");
      return json(payload, { status: 500 });
    }
    const payload = {
      ok: true,
      updateAvailable: true,
      latestVersion: written.latestVersion || CE_AGENT_ACCESS_SKILL_VERSION,
      version: CE_AGENT_ACCESS_SKILL_VERSION,
    };
    assertNoSecretShape(payload, "Agent admin skill-update set response must not serialize secrets.");
    return json(payload);
  }

  if (methodName === 'DELETE') {
    const admin = await requireQuestionQueueAdmin({
      env,
      context,
      input,
      allowDelegatedAdmin: false,
    });
    if (!admin.ok) {
      const payload = {
        ok: false,
        reason: admin.reason,
        accountAddress: admin.accountAddress || '',
      };
      assertNoSecretShape(payload, "Agent admin skill-update denied response must not serialize secrets.");
      return json(payload, { status: admin.status || 403 });
    }
    const cleared = await clearAgentSkillUpdateFlag(env);
    if (!cleared.ok) {
      const payload = {
        ok: false,
        reason: cleared.reason || 'agent_skill_update_clear_failed',
      };
      assertNoSecretShape(payload, "Agent admin skill-update clear failure must not serialize secrets.");
      return json(payload, { status: 500 });
    }
    const payload = {
      ok: true,
      updateAvailable: false,
      cleared: true,
      latestVersion: CE_AGENT_ACCESS_SKILL_VERSION,
      version: CE_AGENT_ACCESS_SKILL_VERSION,
    };
    assertNoSecretShape(payload, "Agent admin skill-update clear response must not serialize secrets.");
    return json(payload);
  }

  const payload = { ok: false, reason: 'method_not_allowed' };
  assertNoSecretShape(payload, "Agent admin skill-update method response must not serialize secrets.");
  return json(payload, { status: 405 });
}

export async function loadAdminMetricsCache(env = {}, cacheKey = '') {
  const kv = env?.AGENT_ACTION_KV;
  if (!cacheKey || !kv || typeof kv.get !== 'function') return null;
  const cached = safeJsonParse(await kv.get(cacheKey).catch(() => null), null);
  if (!cached || typeof cached !== 'object' || Array.isArray(cached) || cached.ok !== true) return null;
  assertNoSecretShape(cached, "Cached Agent admin metrics must not serialize secrets.");
  return {
    ...cached,
    cached: true,
  };
}

export async function saveAdminMetricsCache(env = {}, cacheKey = '', payload = {}) {
  const kv = env?.AGENT_ACTION_KV;
  if (!cacheKey || !kv || typeof kv.put !== 'function') return;
  assertNoSecretShape(payload, "Agent admin metrics cache payload must not serialize secrets.");
  await kv.put(cacheKey, JSON.stringify(payload), {
    expirationTtl: ADMIN_METRICS_CACHE_TTL_SECONDS,
  });
}

export async function buildAdminMetricsSnapshot({
  env = {},
  scope = 'session',
  sessionSlug = '',
  visibleSessionSlugs = null,
} = {}) {
  const scopedSessionSlug = scope === 'session' ? sanitizeSessionSlug(sessionSlug) : '';
  const visibleSlugSet =
    visibleSessionSlugs instanceof Set
      ? visibleSessionSlugs
      : Array.isArray(visibleSessionSlugs)
        ? new Set(visibleSessionSlugs.map(sanitizeSessionSlug).filter(Boolean))
        : null;
  const inScope = (slug = '') => {
    const normalized = sanitizeSessionSlug(slug);
    if (!normalized) return false;
    if (scope === 'session') return normalized === scopedSessionSlug;
    if (visibleSlugSet) return visibleSlugSet.has(normalized);
    return true;
  };
  const totals = emptyAdminMetricTotals();
  const perSession = new Map();
  const onboardedUsers = new Set();
  const respondents = new Set();
  const activitySessions = new Set();

  const tokenEntries = await listMetricKvEntriesByPrefix(env, AGENT_CREDENTIAL_KV_PREFIX);
  for (const entry of tokenEntries) {
    const metadata =
      entry.metadata && typeof entry.metadata === 'object' && !Array.isArray(entry.metadata) ? entry.metadata : null;
    let tokenSessionSlug = sanitizeSessionSlug(metadata?.sg);
    let telegramUserId = safeString(metadata?.p || metadata?.u);
    if (!tokenSessionSlug || !telegramUserId) {
      const record = await readMetricRecord(env, entry.key);
      tokenSessionSlug = sanitizeSessionSlug(record?.sessionSlug);
      telegramUserId = safeString(record?.principal?.principalId || record?.telegramUserId);
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
    const slug =
      sanitizeSessionSlug(entry.metadata?.sg) || sessionFromSessionFirstKey(entry.key, PROPOSED_QUESTION_KV_PREFIX);
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
    if (Number(entry.metadata?.e) > 0) {
      totals.answerDraftsEdited += 1;
      incrementMetric(perSession, slug, 'answerDraftsEdited');
    }
    if (safeString(entry.metadata?.o) === 'agent_handoff') {
      totals.agentDraftedAnswers += 1;
      incrementMetric(perSession, slug, 'agentDraftedAnswers');
    }
  }

  const draftEditEntries = await listMetricKvEntriesByPrefix(env, DRAFT_EDIT_METRIC_KV_PREFIX);
  for (const entry of draftEditEntries) {
    const slug = sessionFromSessionFirstKey(entry.key, DRAFT_EDIT_METRIC_KV_PREFIX);
    if (!slug || !inScope(slug)) continue;
    totals.draftEditMetrics += 1;
    activitySessions.add(slug);
    incrementMetric(perSession, slug, 'draftEditMetrics');
  }

  const groupEntries = await listMetricKvEntriesByPrefix(env, LIGHTWEIGHT_GROUP_PROPOSAL_KV_PREFIX);
  for (const entry of groupEntries) {
    const slug =
      sanitizeSessionSlug(entry.metadata?.sg) ||
      sessionFromSessionFirstKey(entry.key, LIGHTWEIGHT_GROUP_PROPOSAL_KV_PREFIX);
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
    const meta =
      entry.metadata && typeof entry.metadata === 'object' && !Array.isArray(entry.metadata) ? entry.metadata : null;
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

  const registry = await listCurrentAgentSession({ env }).catch(() => ({
    ok: false,
    sessions: [],
  }));
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

export async function handleAdminMetricsRequest({ env = {}, context = {}, input = {} } = {}) {
  const manager = await canManageResponseExportAllowlist({
    env,
    normalized: context.storageContext,
    session: context.session,
    createdAt: input.createdAt || null,
  });
  if (!manager.ok) {
    return json(
      {
        ok: false,
        reason: 'metrics_admin_required',
        accountAddress: manager.accountAddress || '',
      },
      { status: 403 },
    );
  }
  const scope = 'session';
  const sessionSlug = context.session.sessionSlug;
  const visibleSessionSlugs = new Set([sessionSlug]);
  const cacheKey = `${ADMIN_METRICS_CACHE_KV_PREFIX}${env.AGENT_CONTEXT.sessionId}:${env.AGENT_CONTEXT.revision}:${sessionSlug}`;
  const cached = await loadAdminMetricsCache(env, cacheKey);
  if (cached) return json(cached);

  const computedAt = new Date().toISOString();
  const snapshot = await buildAdminMetricsSnapshot({
    env,
    scope,
    sessionSlug,
    visibleSessionSlugs,
  });
  const agentOnly = await buildAgentOnlyMetrics({
    env,
    scope,
    sessionSlug,
    visibleSessionSlugs,
  });
  const metricVisibility = { mode: 'session' };
  const payload = {
    ok: true,
    scope,
    ...(scope === 'session' ? { sessionSlug } : {}),
    computedAt,
    cached: false,
    metricVisibility,
    definitions: {
      agentsOnboarded: 'Delegation-token mints observed by the worker; this is not a count of external skill installs.',
      registrySessionCount:
        'The current canonical session; the worker does not discover other sessions.',
      sessionsWithBridgeActivity:
        'Distinct session slugs with bridge KV activity such as token mints, drafts, proposed questions, group proposals, or submitted answers.',
      draftEditMetrics:
        'Opt-in draft-edit metric records that compare an initial agent draft with the saved or submitted answer without storing raw answer text.',
      answerDraftsEdited:
        'Live drafts whose content changed at least once after the first save (point-in-time KV scan, decays with draft TTL).',
      agentDraftedAnswers:
        'Live drafts whose first revision was written through the agent handoff preferences endpoint.',
      metricVisibility:
        'Metrics include only the current canonical session.',
      questionsAnswered: `Submit queue records with submitted statuses over the rolling ${Math.round(SUBMIT_REQUEST_TTL_SECONDS / 86400)} day submit-record window.`,
      agentOnly:
        'Agent-only sidecar predictions, privacy skips, and token allocations counted from KV metadata only; these records are source-separated from normal drafts and submits.',
    },
    totals: snapshot.totals,
    agentOnly,

  };
  assertNoSecretShape(payload, "Agent admin metrics response must not serialize secrets.");
  await saveAdminMetricsCache(env, cacheKey, payload);
  return json(payload);
}

export function normalizeAdminQuestionDeleteIds(body = {}) {
  const source = [];
  if (Object.hasOwn(body, 'questionId')) source.push(body.questionId);
  if (Array.isArray(body.questionIds)) {
    source.push(...body.questionIds);
  } else if (Object.hasOwn(body, 'questionIds')) {
    source.push(body.questionIds);
  }
  const seen = new Set();
  const ids = [];
  for (const raw of source) {
    const id = safeString(raw);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }
  return ids;
}

export async function removeProcessedQuestionIdsFromAgentOnlyConfig({ env = {}, sessionSlug = '', results = [] } = {}) {
  const idsToRemove = new Set(
    (Array.isArray(results) ? results : [])
      .filter((entry) => !['failed', 'not_proposed'].includes(safeString(entry?.result)))
      .map((entry) => safeString(entry?.questionId))
      .filter((id) => id.startsWith('ceq_')),
  );
  if (!idsToRemove.size) return false;
  const loaded = await loadAgentOnlyModeConfig({ env, sessionSlug });
  if (loaded.source !== 'kv') return false;
  const current = Array.isArray(loaded.config?.enabledQuestionIds) ? loaded.config.enabledQuestionIds : [];
  const next = current.filter((id) => !idsToRemove.has(safeString(id)));
  if (next.length === current.length) return false;
  const saved = await saveAgentOnlyModeConfig({
    env,
    sessionSlug,
    patch: {
      ...loaded.config,
      enabledQuestionIds: next,
    },
    updatedBy: 'service',
  });
  return saved.ok !== false;
}

export async function handleAdminQuestionsDeleteRequest({ env = {}, input = {}, body = {} } = {}) {
  const sessionSlug = sanitizeSessionSlug(input.sessionSlug || body.sessionSlug);
  if (!sessionSlug) return json({ ok: false, reason: 'session_slug_required' }, { status: 400 });
  // Mode is read from body.mode only: input.view aggregates ?view=/?mode= query
  // params, which must never escalate the default archive to a hard delete.
  const mode = lower(safeString(body.mode)) || 'archive';
  if (!['archive', 'delete'].includes(mode)) {
    return json({ ok: false, reason: 'questions_delete_mode_invalid' }, { status: 400 });
  }
  const questionIds = normalizeAdminQuestionDeleteIds(body);
  if (!questionIds.length) return json({ ok: false, reason: 'question_ids_required' }, { status: 400 });
  if (questionIds.length > ADMIN_QUESTIONS_DELETE_MAX_IDS) {
    return json({ ok: false, reason: 'question_ids_too_many' }, { status: 400 });
  }
  const results = [];
  for (const questionId of questionIds) {
    try {
      const processed =
        mode === 'delete'
          ? await deleteAgentProposedQuestion({
              env,
              sessionSlug,
              questionId,
            })
          : await archiveAgentProposedQuestion({
              env,
              sessionSlug,
              questionId,
              now: input.createdAt || null,
            });
      results.push({
        questionId,
        result: safeString(processed?.result) || 'failed',
      });
    } catch {
      results.push({ questionId, result: 'failed' });
    }
  }
  let configUpdated = false;
  try {
    configUpdated = await removeProcessedQuestionIdsFromAgentOnlyConfig({
      env,
      sessionSlug,
      results,
    });
  } catch {
    configUpdated = false;
  }
  const payload = { ok: true, sessionSlug, mode, results, configUpdated };
  assertNoSecretShape(payload, "Agent admin questions delete response must not serialize secrets.");
  return json(payload);
}

export async function handleAdminAgentOnlyConfigRequest({ env = {}, input = {}, body = {}, method = 'GET' } = {}) {
  const sessionSlug = sanitizeSessionSlug(input.sessionSlug || body.sessionSlug);
  if (!sessionSlug) return json({ ok: false, reason: 'session_slug_required' }, { status: 400 });
  if (method === 'GET') {
    const loaded = await loadAgentOnlyModeConfig({ env, sessionSlug });
    const payload = { ok: true, source: loaded.source, config: loaded.config };
    assertNoSecretShape(payload, 'Agent-only admin config response must not serialize secrets.');
    return json(payload);
  }
  if (method !== 'POST') {
    return json({ ok: false, reason: 'method_not_allowed' }, { status: 405 });
  }
  const saved = await saveAgentOnlyModeConfig({
    env,
    sessionSlug,
    patch: body,
    updatedBy: 'service',
    createdAt: input.createdAt || null,
  });
  const status = saved.ok === false ? saved.status || 400 : 200;
  assertNoSecretShape(saved, 'Agent-only admin config save response must not serialize secrets.');
  return json(saved, { status });
}

export async function handleAdminAgentOnlyExportRequest({ env = {}, input = {} } = {}) {
  const sessionSlug = sanitizeSessionSlug(input.sessionSlug);
  if (!sessionSlug) return json({ ok: false, reason: 'session_slug_required' }, { status: 400 });
  const includeBase64Input = lower(input.include_base64 || input.includeBase64);
  const includeImageBase64 =
    normalizeBoolean(input.include_base64, false) ||
    normalizeBoolean(input.includeBase64, false) ||
    includeBase64Input === 'true';
  const exported = await exportAgentOnlyData({
    env,
    sessionSlug,
    view: input.view || 'answers',
    format: input.format || 'jsonl',
    compact: normalizeBoolean(input.compact, false),
    includeImageBase64,
    cursor: input.cursor,
    limit: input.limit,
  });
  if (!exported.ok) {
    const payload = { ok: false, reason: exported.reason };
    assertNoSecretShape(payload, 'Agent-only admin export error must not serialize secrets.');
    return json(payload, { status: exported.status || 400 });
  }
  const headers = {
    'content-type': exported.contentType,
    'cache-control': 'no-store',
    'x-agent-only-row-count': String(Array.isArray(exported.rows) ? exported.rows.length : 0),
  };
  if (exported.nextCursor) headers['x-agent-only-next-cursor'] = exported.nextCursor;
  return new Response(exported.body, {
    status: 200,
    headers,
  });
}
