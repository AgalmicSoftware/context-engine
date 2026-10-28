import { normalizeRatingAnswer, normalizeRatingScale, ratingStepFor } from '../../../shared/questions/ratingScale.mjs';
import { validateQuadraticAllocation } from '../../../shared/questions/quadraticAllocation.mjs';
import { safeString, lower, safeJsonParse, stableJson, kvKeySafePart, nowIsoOrCurrent as nowIso, sanitizeSessionSlug, sha256Hex } from './runtimePrimitives.mjs';
import { assertNoSecretShape } from './redaction.mjs';
import { AGENT_ONLY_INSTRUCTIONS_VERSION, MAX_BULK_ROWS, randomHex, answerEventPrefix, answerStateKey, runIdFromBody } from './wrappedCore.mjs';
import { loadWrappedStatements } from './wrappedStatements.mjs';
import { normalizeAgentMetadata } from './wrappedMetadata.mjs';

export function statementMap(space = {}) {
  return new Map((Array.isArray(space.statements) ? space.statements : [])
    .map((statement) => [safeString(statement.statement_id), statement])
    .filter(([id]) => id));
}

export function normalizeAnswerForSchema(answer = {}, schema = {}) {
  const source = answer && typeof answer === 'object' && !Array.isArray(answer) ? answer : {};
  if (schema.kind === 'quadratic') {
    const value = source.value;
    if (validateQuadraticAllocation(value, schema)) return { ok: false, reason: 'answer_quadratic_invalid' };
    return { ok: true, answer: { value } };
  }
  if (schema.kind === 'rating') {
    const raw = Object.hasOwn(source, 'value') ? source.value : (source.answer ?? source.rating);
    const value = normalizeRatingAnswer(raw, schema);
    return value === null ? { ok: false, reason: 'answer_rating_invalid' } : { ok: true, answer: { value } };
  }
  if (schema.kind === 'choice') {
    const raw = Object.hasOwn(source, 'value') ? source.value : (source.answer ?? source.rating);
    const scaleValues = Array.isArray(schema.values) && schema.values.length
      ? schema.values
      : ratingValuesFromSchema(schema);
    const matched = scaleValues
      .find((value) => String(value) === String(raw));
    if (matched === undefined) return { ok: false, reason: schema.kind === 'rating' ? 'answer_rating_invalid' : 'answer_choice_invalid' };
    return { ok: true, answer: { value: matched } };
  }
  if (schema.kind === 'multichoice') {
    const singleScalarValue = !Array.isArray(source.value) && Object.hasOwn(source, 'value')
      ? safeString(source.value)
      : '';
    const rawValues = Array.isArray(source.values)
      ? source.values
      : (Array.isArray(source.value) ? source.value : (singleScalarValue ? [singleScalarValue] : []));
    const options = (Array.isArray(schema.options) ? schema.options : []).map(safeString).filter(Boolean);
    const values = rawValues.map(safeString).filter(Boolean);
    if (values.some((value) => !options.includes(value))) return { ok: false, reason: 'answer_multichoice_invalid' };
    const unique = values.filter((value, index, list) => list.indexOf(value) === index);
    const minSelections = Math.max(0, Math.floor(Number(schema.minSelections ?? 1)) || 0);
    const fallbackMax = lower(schema.selectionMode) === 'single' ? 1 : options.length;
    const maxSelections = Math.max(1, Math.floor(Number(schema.maxSelections ?? fallbackMax)) || fallbackMax || 1);
    if (unique.length < minSelections) return { ok: false, reason: 'answer_multichoice_required' };
    if (unique.length > maxSelections) return { ok: false, reason: 'answer_multichoice_too_many' };
    return { ok: true, answer: { values: unique } };
  }
  if (schema.kind === 'text') {
    const text = safeString(source.text ?? source.value ?? source.answer).replace(/\s+/g, ' ');
    const maxChars = Math.max(1, Math.min(1000, Number(schema.maxChars) || 280));
    if (!text) return { ok: false, reason: 'answer_text_required' };
    if (text.length > maxChars) return { ok: false, reason: 'answer_text_too_long' };
    return { ok: true, answer: { text } };
  }
  return { ok: false, reason: 'answer_schema_unsupported' };
}

export function ratingValuesFromSchema(schema = {}) {
  const scale = normalizeRatingScale(schema);
  if (!scale) return [];
  const step = ratingStepFor(schema);
  const lastIndex = Math.floor((scale.max - scale.min) / step + 1e-9);
  return Array.from({ length: Math.min(50, lastIndex + 1) }, (_, index) =>
    normalizeRatingAnswer(Number((scale.min + index * step).toPrecision(12)), schema));
}

export function validateAnswerRows(rows = [], space = {}) {
  if (!Array.isArray(rows) || rows.length < 1 || rows.length > MAX_BULK_ROWS) {
    return { ok: false, errors: [{ index: -1, reason: 'answers_batch_size_invalid' }] };
  }
  const byStatement = statementMap(space);
  const seen = new Set();
  const accepted = [];
  const errors = [];
  rows.forEach((row, index) => {
    const source = row && typeof row === 'object' && !Array.isArray(row) ? row : {};
    const statementId = safeString(source.statement_id || source.statementId);
    const statement = byStatement.get(statementId);
    if (!statement) {
      errors.push({ index, statement_id: statementId, reason: 'statement_unknown' });
      return;
    }
    if (source.statement_version !== statement.statement_version) {
      errors.push({ index, statement_id: statementId, reason: 'statement_version_mismatch' });
      return;
    }
    if (seen.has(statementId)) {
      errors.push({ index, statement_id: statementId, reason: 'statement_duplicate' });
      return;
    }
    seen.add(statementId);
    if (source.skipped === true) {
      if (safeString(source.skip_reason || source.skipReason) !== 'privacy_protective') {
        errors.push({ index, statement_id: statementId, reason: 'skip_reason_invalid' });
        return;
      }
      if (
        Object.hasOwn(source, 'answer') ||
        Object.hasOwn(source, 'confidence') ||
        Object.hasOwn(source, 'rationale') ||
        Object.hasOwn(source, 'explanation')
      ) {
        errors.push({ index, statement_id: statementId, reason: 'privacy_skip_shape_invalid' });
        return;
      }
      accepted.push({ statementId, statement, skipped: true });
      return;
    }
    const confidence = Number(source.confidence);
    if (!Number.isInteger(confidence) || confidence < 0 || confidence > 100) {
      errors.push({ index, statement_id: statementId, reason: 'confidence_invalid' });
      return;
    }
    const normalized = normalizeAnswerForSchema(source.answer, statement.answer_schema || {});
    if (!normalized.ok) {
      errors.push({ index, statement_id: statementId, reason: normalized.reason });
      return;
    }
    const rationale = safeString(source.rationale).replace(/\s+/g, ' ');
    if (rationale.length > 200) {
      errors.push({ index, statement_id: statementId, reason: 'rationale_too_long' });
      return;
    }
    accepted.push({ statementId, statement, answer: normalized.answer, answerSchema: statement.answer_schema || {}, confidence, rationale });
  });
  return errors.length ? { ok: false, errors } : { ok: true, accepted };
}

export async function loadAnswerState({ env = {}, sessionSlug = '', telegramUserId = '' } = {}) {
  const key = answerStateKey(sessionSlug, telegramUserId);
  const kv = env?.AGENT_ACTION_KV;
  const parsed = key && kv && typeof kv.get === 'function'
    ? safeJsonParse(await kv.get(key), null)
    : null;
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    assertNoSecretShape(parsed, 'Agent-only answer state must not serialize secrets.');
    return {
      ...parsed,
      byStatement: parsed.byStatement && typeof parsed.byStatement === 'object' && !Array.isArray(parsed.byStatement)
        ? parsed.byStatement
        : {},
      recentRequestIds: Array.isArray(parsed.recentRequestIds) ? parsed.recentRequestIds : [],
    };
  }
  const createdAt = nowIso();
  return {
    type: 'telegram_agent_only_answer_state',
    version: 1,
    sessionSlug: sanitizeSessionSlug(sessionSlug),
    telegramUserId: safeString(telegramUserId),
    byStatement: {},
    recentRequestIds: [],
    counts: { answers: 0, skips: 0 },
    createdAt,
    updatedAt: createdAt,
  };
}

export async function requestSummaryHash(kind = '', body = {}) {
  return sha256Hex(stableJson({ kind, body }));
}

export async function canonicalRequestId(kind = '', body = {}, supplied = '') {
  const explicit = safeString(supplied).slice(0, 160);
  if (explicit) return explicit;
  const hash = await requestSummaryHash(kind, body);
  return `derived_${hash.slice(0, 32)}`;
}

export function findRecentRequest(state = {}, requestId = '') {
  return (Array.isArray(state.recentRequestIds) ? state.recentRequestIds : [])
    .find((entry) => safeString(entry?.requestId) === requestId) || null;
}

export function rawAnswerValue(source = {}) {
  if (Object.hasOwn(source, 'value')) return source.value;
  if (Object.hasOwn(source, 'answer')) return source.answer;
  if (Object.hasOwn(source, 'rating')) return source.rating;
  return '';
}

export function answerScalarString(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

export function collapsedText(value = '') {
  return safeString(value).replace(/\s+/g, ' ');
}

export function canonicalAgentOnlyAnswerProjection(answer = {}, schema = {}) {
  const source = answer && typeof answer === 'object' && !Array.isArray(answer) ? answer : {};
  const questionType = lower(source.questionType);
  const schemaKind = lower(schema.kind);
  if (schemaKind === 'quadratic' || questionType === 'quadratic') return { value: source.value };
  const rawValues = Array.isArray(source.values)
    ? source.values
    : (Array.isArray(source.value)
      ? source.value
      : (Array.isArray(source.selectedValues) ? source.selectedValues : []));
  if (
    schemaKind === 'multichoice' ||
    questionType === 'multichoice' ||
    questionType === 'multi-choice' ||
    questionType === 'multiple-choice' ||
    rawValues.length > 0
  ) {
    const values = rawValues
      .map(safeString)
      .filter(Boolean)
      .filter((value, index, list) => list.indexOf(value) === index)
      .sort((left, right) => (left < right ? -1 : (left > right ? 1 : 0)));
    return { values };
  }
  if (schemaKind === 'text' || questionType === 'freeform' || Object.hasOwn(source, 'text')) {
    return { text: collapsedText(source.text ?? rawAnswerValue(source)) };
  }
  return { value: answerScalarString(rawAnswerValue(source)).toLowerCase() };
}

export async function semanticFingerprintForAgentOnlyAnswer(answer = {}, schema = {}) {
  return `sf_${(await sha256Hex(stableJson(canonicalAgentOnlyAnswerProjection(answer, schema)))).slice(0, 24)}`;
}

export function eventId() {
  return `${String(Date.now()).padStart(13, '0')}-${randomHex(4)}`;
}

export async function submitAgentOnlyAnswersBulk({
  env = {},
  sessionSlug = '',
  telegramUserId = '',
  body = {},
  now = null,
} = {}) {
  const slug = sanitizeSessionSlug(sessionSlug || body.sessionSlug);
  const runId = runIdFromBody(body);
  if (!runId) return { ok: false, status: 400, reason: 'agent_only_run_id_required' };
  const materialized = await loadWrappedStatements({ env, sessionSlug: slug });
  if (!materialized.ok) return materialized;
  const metadata = normalizeAgentMetadata(body.agent_metadata || body.agentMetadata);
  if (!metadata.ok) return { ok: false, status: 400, reason: metadata.reason };
  const validated = validateAnswerRows(body.answers, materialized.space);
  if (!validated.ok) {
    return { ok: false, status: 400, reason: 'agent_only_answers_invalid', errors: validated.errors };
  }

  const requestBody = {
    run_id: runId,
    agent_metadata: metadata.value,
    answers: validated.accepted,
  };
  const requestId = await canonicalRequestId('answers', requestBody, body.request_id || body.requestId);
  const summaryHash = await requestSummaryHash('answers', requestBody);
  const state = await loadAnswerState({ env, sessionSlug: slug, telegramUserId });
  const replay = findRecentRequest(state, requestId);
  const skipsRecorded = validated.accepted.filter((row) => row.skipped).length;
  const response = {
    ok: true,
    accepted: validated.accepted.length,
    skipsRecorded,
    replay: false,
  };
  if (replay) {
    if (safeString(replay.summaryHash) !== summaryHash) {
      return { ok: false, status: 409, reason: 'request_id_conflict' };
    }
    return { ...response, replay: true };
  }

  const kv = env?.AGENT_ACTION_KV;
  if (!kv || typeof kv.put !== 'function') {
    return { ok: false, status: 500, reason: 'agent_only_answer_storage_unavailable' };
  }
  const createdAt = nowIso(now);
  const userPart = kvKeySafePart(telegramUserId);
  const events = [], changes = {};
  for (const row of validated.accepted) {
    const isSkip = row.skipped === true;
    // One key per request and statement: a retry after a lost reply or a
    // rejected state write finds its event instead of adding a duplicate row.
    const key = `${answerEventPrefix(slug, userPart)}${kvKeySafePart(requestId)}:${kvKeySafePart(row.statementId)}`;
    const semanticFingerprint = isSkip ? '' : await semanticFingerprintForAgentOnlyAnswer(row.answer, row.answerSchema);
    const record = {
      type: 'telegram_agent_only_answer_event',
      version: 1,
      sessionSlug: slug,
      telegramUserId: safeString(telegramUserId),
      questionId: row.statementId,
      statement: row.statement,
      evalType: safeString(materialized.space.evalTypesByQuestionId[row.statementId]),
      source: 'agent_autofill',
      eventKind: isSkip ? 'privacy_protective_skip' : 'answer',
      answer: isSkip ? null : row.answer,
      confidence: isSkip ? null : row.confidence,
      rationale: isSkip ? null : safeString(row.rationale),
      skipReason: isSkip ? 'privacy_protective' : null,
      agentMetadata: metadata.value,
      instructionsVersion: AGENT_ONLY_INSTRUCTIONS_VERSION,
      runId,
      requestId,
      semanticFingerprint,
      createdAt,
    };
    assertNoSecretShape(record, 'Agent-only answer events must not serialize secrets.');
    events.push({ key, value: record, metadata: { v: 1, t: 'ao_evt', sg: slug, k: isSkip ? 's' : 'a', src: 'agent_autofill' } });
    const current = state.byStatement[row.statementId] && typeof state.byStatement[row.statementId] === 'object'
      ? state.byStatement[row.statementId]
      : {};
    changes[row.statementId] = isSkip
      ? {
        ...current,
        agent: null,
        agentSkip: { statement: row.statement, reason: 'privacy_protective', runId, eventKey: key, updatedAt: createdAt },
      }
      : {
        ...current,
        agent: {
          statement: row.statement,
          evalType: safeString(materialized.space.evalTypesByQuestionId[row.statementId]),
          answer: row.answer,
          confidence: row.confidence,
          rationale: safeString(row.rationale),
          agentMetadata: metadata.value,
          semanticFingerprint,
          runId,
          eventKey: key,
          updatedAt: createdAt,
        },
        agentSkip: null,
      };
  }
  if (!env.AGENT_SERVICES?.commitWrappedResearch) return { ok: false, status: 503, reason: 'wrapped_coordinator_unavailable', retryable: true };
  return env.AGENT_SERVICES.commitWrappedResearch({ kind: 'answers', subjectId: safeString(telegramUserId), requestId,
    summaryHash, createdAt, events, changes, initialState: state, response,
    stateMetadata: { v: 1, t: 'ao_ans', sg: slug } });
}
