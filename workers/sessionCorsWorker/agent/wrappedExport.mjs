import { safeString, lower, safeJsonParse, nowIsoOrCurrent as nowIso, sanitizeSessionSlug } from './runtimePrimitives.mjs';
import { SUBMIT_REQUEST_USER_KV_PREFIX, SUBMITTED_RESULT_STATUSES } from './agentSubmitQueue.mjs';
import { AGENT_ONLY_ANSWER_EVENT_KV_PREFIX, AGENT_ONLY_ANSWER_STATE_KV_PREFIX, AGENT_ONLY_VOTE_EVENT_KV_PREFIX, AGENT_ONLY_HUMAN_VOTE_EVENT_KV_PREFIX, AGENT_ONLY_WRAPPED_IMAGE_KV_PREFIX, AGENT_ONLY_ATTEMPT_EVENT_KV_PREFIX, AGENT_ONLY_PRINCIPAL_ID_SALT, hmacSha256Hex, normalizeAgentOnlyRunId } from './wrappedCore.mjs';
import { loadWrappedStatements } from './wrappedStatements.mjs';
import { WRAPPED_QUESTION_SOURCE_MODES } from './wrappedQuestionSource.mjs';
import { normalizeTokenCount, normalizeDailyTokenUsage, normalizeTokenUsageDates } from './wrappedMetadata.mjs';
import { reviewStatusForCurrentAgentAnswer } from './wrappedReview.mjs';
import { listKvEntriesByPrefix, listKvEntriesPageByPrefix } from './wrappedMetrics.mjs';

export async function agentOnlyPrincipalId(env = {}, telegramUserId = '') {
  const salt = `${AGENT_ONLY_PRINCIPAL_ID_SALT}:${env.AGENT_CONTEXT.sessionId}`;
  return `cep_${(await hmacSha256Hex(safeString(telegramUserId), salt)).slice(0, 24)}`;
}

export async function readKvJson(env = {}, key = '') {
  const kv = env?.AGENT_ACTION_KV;
  if (!key || !kv || typeof kv.get !== 'function') return null;
  const parsed = safeJsonParse(await kv.get(key), null);
  return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
}

export function csvEscape(value) {
  const text = typeof value === 'string' ? value : JSON.stringify(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function rowsToCsv(rows = []) {
  if (!rows.length) return '';
  const columns = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  return [
    columns.join(','),
    ...rows.map((row) => columns.map((column) => csvEscape(row[column])).join(',')),
  ].join('\n');
}

export function rowsToJsonl(rows = []) {
  return rows.map((row) => JSON.stringify(row)).join('\n');
}

export async function latestSubmittedAnswerFor({
  env = {},
  sessionSlug = '',
  telegramUserId = '',
  questionId = '',
  beforeIso = '',
} = {}) {
  const slug = sanitizeSessionSlug(sessionSlug);
  const user = safeString(telegramUserId).replace(/[^0-9A-Za-z_-]/g, '').slice(0, 128);
  const question = safeString(questionId).replace(/[^0-9A-Za-z._:-]/g, '').slice(0, 160);
  if (!slug || !user || !question) return null;
  const prefix = `${SUBMIT_REQUEST_USER_KV_PREFIX}${slug}:${user}:${question}:`;
  const entries = await listKvEntriesByPrefix(env, prefix);
  const beforeMs = Date.parse(safeString(beforeIso));
  let latest = null;
  for (const entry of entries) {
    const record = await readKvJson(env, entry.key);
    if (!record || safeString(record.questionId) !== safeString(questionId)) continue;
    const status = safeString(record.status);
    if (status && !SUBMITTED_RESULT_STATUSES.includes(status)) continue;
    const createdAt = safeString(record.createdAt || record.processedAt || record.updatedAt);
    const createdMs = Date.parse(createdAt);
    if (Number.isFinite(beforeMs) && (!Number.isFinite(createdMs) || createdMs >= beforeMs)) continue;
    if (!latest || Date.parse(safeString(latest.createdAt)) < createdMs) latest = { ...record, createdAt };
  }
  return latest;
}

export async function exportAgentOnlyData({
  env = {},
  sessionSlug = '',
  view = 'answers',
  format = 'jsonl',
  now = null,
  compact = false,
  includeImageBase64 = false,
  cursor = '',
  limit = 0,
} = {}) {
  const slug = sanitizeSessionSlug(sessionSlug);
  const rows = [];
  const compactExport = compact === true;
  const exportCursor = safeString(cursor);
  const rawLimit = Math.floor(Number(limit)) || 0;
  const exportLimit = Math.max(1, Math.min(1000, rawLimit || 250));
  const pagedExport = Boolean(exportCursor || rawLimit > 0);
  let nextCursor = '';
  const listExportEntries = async (prefix) => {
    if (!pagedExport) return { entries: await listKvEntriesByPrefix(env, prefix), nextCursor: '' };
    return listKvEntriesPageByPrefix(env, prefix, { limit: exportLimit, cursor: exportCursor });
  };
  let readable = null;
  if (['answers', 'wide', 'calibration', 'gold', 'votes'].includes(view)) {
    // History covers every question of this session the reader can still read,
    // whichever source is selected now; switching sources never hides answers.
    // Either source failing makes this export incomplete, even when that source
    // is not selected for new answers. Never report a partial history as complete.
    const loaded = await loadWrappedStatements({ env, sessionSlug: slug, readabilityOnly: true });
    if (!loaded.ok) return loaded;
    readable = new Set(loaded.space.statements.map(statement => statement.statement_id));
    for (const questionSourceMode of Object.values(WRAPPED_QUESTION_SOURCE_MODES)) {
      if (questionSourceMode === loaded.space.questionSourceMode) continue;
      const other = await loadWrappedStatements({ env, sessionSlug: slug, readabilityOnly: true, questionSourceMode });
      if (!other.ok) return other;
      for (const statement of other.space.statements) readable.add(statement.statement_id);
    }
  }
  if (['answers', 'wide', 'calibration', 'gold'].includes(view)) {
    if (view === 'calibration') {
      const calibrationBuckets = new Map();
      const listed = await listExportEntries(`${AGENT_ONLY_ANSWER_STATE_KV_PREFIX}${slug}:`);
      const stateEntries = listed.entries;
      nextCursor = listed.nextCursor;
      for (const entry of stateEntries) {
        const state = await readKvJson(env, entry.key);
        if (!state) continue;
        const byStatement = state.byStatement && typeof state.byStatement === 'object' && !Array.isArray(state.byStatement)
          ? state.byStatement
          : {};
        for (const [statementId, value] of Object.entries(byStatement)) {
          if (!readable.has(statementId)) continue;
          if (!Number.isFinite(Number(value?.agent?.confidence))) continue;
          const bandStart = Math.floor(Number(value.agent.confidence) / 10) * 10;
          const band = `${bandStart}-${bandStart + 9}`;
          if (!calibrationBuckets.has(band)) {
            calibrationBuckets.set(band, {
              confidence_band: band,
              prediction_count: 0,
              confirm_count: 0,
              edit_count: 0,
              edit_rate: 0,
            });
          }
          const bucket = calibrationBuckets.get(band);
          bucket.prediction_count += 1;
          const reviewStatus = await reviewStatusForCurrentAgentAnswer({
            entry: value,
            env,
            sessionSlug: slug,
            questionId: statementId,
          });
          if (reviewStatus === 'confirm') bucket.confirm_count += 1;
          if (reviewStatus === 'edit' || reviewStatus === 'stale_confirm') bucket.edit_count += 1;
        }
      }
      rows.push(...[...calibrationBuckets.values()].map((row) => ({
        ...row,
        edit_rate: row.prediction_count ? row.edit_count / row.prediction_count : 0,
      })).sort((left, right) => left.confidence_band.localeCompare(right.confidence_band)));
      const outputFormat = lower(format) === 'csv' ? 'csv' : 'jsonl';
      return {
        ok: true,
        rows,
        nextCursor,
        body: outputFormat === 'csv' ? rowsToCsv(rows) : rowsToJsonl(rows),
        contentType: outputFormat === 'csv' ? 'text/csv; charset=utf-8' : 'application/x-ndjson; charset=utf-8',
      };
    }
    if (view === 'answers' || view === 'gold') {
      const listed = await listExportEntries(`${AGENT_ONLY_ANSWER_EVENT_KV_PREFIX}${slug}:`);
      const eventEntries = listed.entries;
      nextCursor = listed.nextCursor;
      for (const entry of eventEntries) {
        const record = await readKvJson(env, entry.key);
        if (!record) continue;
        if (!readable.has(record.questionId)) continue;
        const principalId = await agentOnlyPrincipalId(env, record.telegramUserId);
        if (view === 'answers') {
          rows.push({
            principal_id: principalId,
            statement_id: safeString(record.questionId),
            statement: record.statement || null,
            run_id: safeString(record.runId),
            source: safeString(record.source),
            event_kind: safeString(record.eventKind),
            answer: record.answer || null,
            confidence: record.confidence ?? null,
            rationale: safeString(record.eventKind) === 'privacy_protective_skip' ? null : safeString(record.rationale),
            agent_initialized_at: safeString(record.agentMetadata?.agentInitializedAt),
            model: safeString(record.agentMetadata?.model),
            scaffold_version: safeString(record.agentMetadata?.scaffoldVersion),
            token_current_run_total: normalizeTokenCount(record.agentMetadata?.tokenUsage?.currentRunTotalTokens),
            token_recent_sessions_total: normalizeTokenCount(record.agentMetadata?.tokenUsage?.recentSessionsTotalTokens),
            token_input: normalizeTokenCount(record.agentMetadata?.tokenUsage?.inputTokens),
            token_output: normalizeTokenCount(record.agentMetadata?.tokenUsage?.outputTokens),
            token_daily_usage_30d: normalizeDailyTokenUsage(record.agentMetadata?.tokenUsage?.dailyUsage30d),
            token_edge_in_person_dates: normalizeTokenUsageDates(record.agentMetadata?.tokenUsage?.edgeInPersonDates),
            token_usage_source: safeString(record.agentMetadata?.tokenUsage?.source),
            instructions_version: safeString(record.instructionsVersion),
            request_id: safeString(record.requestId),
            created_at: safeString(record.createdAt),
          });
        } else if (safeString(record.source) === 'agent_autofill' && record.eventKind === 'answer') {
          const prior = await latestSubmittedAnswerFor({
            env,
            sessionSlug: slug,
            telegramUserId: record.telegramUserId,
            questionId: record.questionId,
            beforeIso: record.createdAt,
          });
          if (!prior) continue;
          rows.push({
            principal_id: principalId,
            statement_id: safeString(record.questionId),
            statement: record.statement || null,
            run_id: safeString(record.runId),
            prior_human_answer: prior.answer || null,
            prior_human_created_at: safeString(prior.createdAt),
            agent_prediction: record.answer || null,
            agent_confidence: record.confidence ?? null,
            model: safeString(record.agentMetadata?.model),
            scaffold_version: safeString(record.agentMetadata?.scaffoldVersion),
            instructions_version: safeString(record.instructionsVersion),
            eval_type: compactExport ? '' : safeString(record.evalType),
            created_at: safeString(record.createdAt),
          });
        }
      }
    }
    if (view === 'wide') {
      const listedWide = await listExportEntries(`${AGENT_ONLY_ANSWER_STATE_KV_PREFIX}${slug}:`);
      const stateEntries = listedWide.entries;
      nextCursor = listedWide.nextCursor;
      for (const entry of stateEntries) {
        const state = await readKvJson(env, entry.key);
        if (!state) continue;
        const principalId = await agentOnlyPrincipalId(env, state.telegramUserId);
        const byStatement = state.byStatement && typeof state.byStatement === 'object' && !Array.isArray(state.byStatement)
          ? state.byStatement
          : {};
        for (const [statementId, value] of Object.entries(byStatement)) {
          if (!readable.has(statementId)) continue;
          const reviewStatus = compactExport ? '' : await reviewStatusForCurrentAgentAnswer({
            entry: value,
            env,
            sessionSlug: slug,
            questionId: statementId,
          });
          const normal = compactExport ? null : await latestSubmittedAnswerFor({
            env,
            sessionSlug: slug,
            telegramUserId: state.telegramUserId,
            questionId: statementId,
          });
          rows.push({
            principal_id: principalId,
            statement_id: safeString(statementId),
            statement: value?.agent?.statement || value?.agentSkip?.statement || null,
            agent_run_id: safeString(value?.agent?.runId),
            agent_prediction: value?.agent?.answer || null,
            agent_confidence: value?.agent?.confidence ?? null,
            human_current_answer: normal?.answer || null,
            review_status: reviewStatus ? `human_${reviewStatus}` : '',
            eval_type: compactExport ? '' : safeString(value?.agent?.evalType),
          });
        }
      }
    }
  } else if (view === 'votes') {
    const prefixes = [
      `${AGENT_ONLY_VOTE_EVENT_KV_PREFIX}${slug}:`,
      `${AGENT_ONLY_HUMAN_VOTE_EVENT_KV_PREFIX}${slug}:`,
    ];
    for (const prefix of prefixes) {
      const entries = await listKvEntriesByPrefix(env, prefix);
      for (const entry of entries) {
        const record = await readKvJson(env, entry.key);
        if (!record) continue;
        const principalId = await agentOnlyPrincipalId(env, record.telegramUserId);
        const votes = record.votes || record.nets || {};
        Object.entries(votes).forEach(([statementId, votesValue]) => {
          if (!readable.has(statementId)) return;
          rows.push({
            principal_id: principalId,
            statement_id: statementId,
            statement: record.statements?.[statementId] || null,
            run_id: safeString(record.runId),
            source: safeString(record.source),
            mode: safeString(record.mode),
            votes: Number(votesValue) || 0,
            budget_used: Number(record.budgetUsed) || 0,
            request_id: safeString(record.requestId),
            created_at: safeString(record.createdAt),
            updated_at: safeString(record.updatedAt || record.createdAt),
          });
        });
      }
    }
  } else if (view === 'attempts') {
    const listed = await listExportEntries(`${AGENT_ONLY_ATTEMPT_EVENT_KV_PREFIX}${slug}:`);
    const entries = listed.entries;
    nextCursor = listed.nextCursor;
    for (const entry of entries) {
      const record = await readKvJson(env, entry.key);
      if (!record) continue;
      rows.push({
        principal_id: await agentOnlyPrincipalId(env, record.telegramUserId),
        run_id: safeString(record.runId),
        stage: safeString(record.stage),
        mode: safeString(record.mode),
        ok: record.ok === true,
        status: Number(record.status) || 0,
        reason: safeString(record.reason),
        request_id: safeString(record.requestId),
        accepted: record.counts?.accepted ?? null,
        skips_recorded: record.counts?.skipsRecorded ?? null,
        budget_used: record.counts?.budgetUsed ?? null,
        statement_count: record.counts?.statementCount ?? null,
        agent_prediction_count: record.counts?.agentPredictionCount ?? null,
        agent_response_count: record.counts?.agentResponseCount ?? null,
        privacy_skip_count: record.counts?.privacySkipCount ?? null,
        created_at: safeString(record.createdAt),
      });
    }
  } else if (view === 'summary') {
    const entries = await listKvEntriesByPrefix(env, `${AGENT_ONLY_ATTEMPT_EVENT_KV_PREFIX}${slug}:`);
    const principalRows = new Map();
    const runRows = new Map();
    let firstAttemptAt = '';
    let latestAttemptAt = '';
    let includedAttemptEventCount = 0;
    for (const entry of entries) {
      const record = await readKvJson(env, entry.key);
      if (!record) continue;
      includedAttemptEventCount += 1;
      const createdAt = safeString(record.createdAt);
      if (createdAt && (!firstAttemptAt || createdAt < firstAttemptAt)) firstAttemptAt = createdAt;
      if (createdAt && (!latestAttemptAt || createdAt > latestAttemptAt)) latestAttemptAt = createdAt;
      const principalId = await agentOnlyPrincipalId(env, record.telegramUserId);
      if (!principalRows.has(principalId)) {
        principalRows.set(principalId, {
          principal_id: principalId,
          attempt_event_count: 0,
          run_count: 0,
          answer_complete_run_count: 0,
          wrapped_image_run_count: 0,
          successful_run_count: 0,
          first_attempt_at: createdAt,
          latest_attempt_at: createdAt,
        });
      }
      const principal = principalRows.get(principalId);
      principal.attempt_event_count += 1;
      if (createdAt && (!principal.first_attempt_at || createdAt < principal.first_attempt_at)) principal.first_attempt_at = createdAt;
      if (createdAt && (!principal.latest_attempt_at || createdAt > principal.latest_attempt_at)) principal.latest_attempt_at = createdAt;

      const runId = normalizeAgentOnlyRunId(record.runId) || 'unknown';
      const runKey = `${principalId}\t${runId}`;
      if (!runRows.has(runKey)) {
        runRows.set(runKey, {
          principal_id: principalId,
          run_id: runId,
          attempt_event_count: 0,
          accepted_answer_count: 0,
          statement_count: 0,
          agent_response_count: 0,
          privacy_skip_count: 0,
          wrapped_image_ok: false,
          first_attempt_at: createdAt,
          latest_attempt_at: createdAt,
        });
      }
      const run = runRows.get(runKey);
      run.attempt_event_count += 1;
      if (createdAt && (!run.first_attempt_at || createdAt < run.first_attempt_at)) run.first_attempt_at = createdAt;
      if (createdAt && (!run.latest_attempt_at || createdAt > run.latest_attempt_at)) run.latest_attempt_at = createdAt;
      const stage = safeString(record.stage);
      const counts = record.counts && typeof record.counts === 'object' && !Array.isArray(record.counts)
        ? record.counts
        : {};
      if (stage === 'answers_bulk' && record.ok === true) {
        run.accepted_answer_count += Number(counts.accepted || 0) || 0;
      }
      run.statement_count = Math.max(run.statement_count, Number(counts.statementCount || 0) || 0);
      run.agent_response_count = Math.max(run.agent_response_count, Number(counts.agentResponseCount || 0) || 0);
      run.privacy_skip_count = Math.max(run.privacy_skip_count, Number(counts.privacySkipCount || 0) || 0);
      if (stage === 'wrapped_image' && record.ok === true) run.wrapped_image_ok = true;
    }
    const runs = [...runRows.values()].map((run) => {
      const answerTarget = Math.max(Number(run.statement_count || 0), Number(run.agent_response_count || 0));
      const answerComplete = answerTarget > 0 && Number(run.accepted_answer_count || 0) >= answerTarget;
      return {
        ...run,
        answer_complete: answerComplete,
        successful: answerComplete || run.wrapped_image_ok,
      };
    }).sort((left, right) => safeString(left.first_attempt_at).localeCompare(safeString(right.first_attempt_at)));
    for (const run of runs) {
      const principal = principalRows.get(run.principal_id);
      if (!principal) continue;
      principal.run_count += 1;
      if (run.answer_complete) principal.answer_complete_run_count += 1;
      if (run.wrapped_image_ok) principal.wrapped_image_run_count += 1;
      if (run.successful) principal.successful_run_count += 1;
    }
    const principals = [...principalRows.values()]
      .sort((left, right) => safeString(left.first_attempt_at).localeCompare(safeString(right.first_attempt_at)));
    const summary = {
      ok: true,
      session_slug: slug,
      generated_at: nowIso(now),
      attempt_event_count: includedAttemptEventCount,
      distinct_principal_count: principals.length,
      answer_complete_principal_count: principals.filter((principal) => principal.answer_complete_run_count > 0).length,
      wrapped_image_principal_count: principals.filter((principal) => principal.wrapped_image_run_count > 0).length,
      successful_principal_count: principals.filter((principal) => principal.successful_run_count > 0).length,
      run_count: runs.length,
      answer_complete_run_count: runs.filter((run) => run.answer_complete).length,
      wrapped_image_run_count: runs.filter((run) => run.wrapped_image_ok).length,
      successful_run_count: runs.filter((run) => run.successful).length,
      first_attempt_at: firstAttemptAt,
      latest_attempt_at: latestAttemptAt,
      principals,
      runs,
    };
    const outputFormat = lower(format) === 'csv' ? 'csv' : lower(format) === 'jsonl' ? 'jsonl' : 'json';
    if (outputFormat === 'csv') {
      return {
        ok: true,
        rows: principals,
        body: rowsToCsv(principals),
        contentType: 'text/csv; charset=utf-8',
      };
    }
    return {
      ok: true,
      rows: [summary],
      body: outputFormat === 'jsonl' ? rowsToJsonl([summary]) : JSON.stringify(summary, null, 2),
      contentType: outputFormat === 'jsonl' ? 'application/x-ndjson; charset=utf-8' : 'application/json; charset=utf-8',
    };
  } else if (view === 'images') {
    const listed = await listExportEntries(`${AGENT_ONLY_WRAPPED_IMAGE_KV_PREFIX}${slug}:`);
    const entries = listed.entries;
    nextCursor = listed.nextCursor;
    for (const entry of entries) {
      const record = await readKvJson(env, entry.key);
      if (!record) continue;
      rows.push({
        principal_id: await agentOnlyPrincipalId(env, record.telegramUserId),
        image_id: safeString(record.imageId) || safeString(entry.key).split(':').pop() || '',
        image_view_id: safeString(record.imageViewId),
        run_id: safeString(record.runId),
        mode: safeString(record.mode),
        model: safeString(record.model),
        size: safeString(record.size),
        quality: safeString(record.quality),
        reference_image: safeString(record.referenceImage),
        media_kind: safeString(record.mediaKind),
        frame_count: Number(record.frameCount || 0) || 0,
        story_duration_seconds: Number(record.storyDurationSeconds || 0) || 0,
        frame_keys: Array.isArray(record.frameKeys) ? record.frameKeys.join(',') : '',
        image_content_type: safeString(record.imageContentType),
        image_byte_length_approx: Number(record.imageByteLengthApprox || 0) || 0,
        prompt_hash: safeString(record.promptHash),
        created_at: safeString(record.createdAt),
        ...(includeImageBase64 ? { image_base64: safeString(record.imageBase64) } : {}),
      });
    }
  } else {
    return { ok: false, status: 400, reason: 'agent_only_export_view_invalid' };
  }
  const outputFormat = lower(format) === 'csv' ? 'csv' : 'jsonl';
  return {
    ok: true,
    rows,
    nextCursor,
    body: outputFormat === 'csv' ? rowsToCsv(rows) : rowsToJsonl(rows),
    contentType: outputFormat === 'csv' ? 'text/csv; charset=utf-8' : 'application/x-ndjson; charset=utf-8',
  };
}
