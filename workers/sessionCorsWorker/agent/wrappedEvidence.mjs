import { safeString, lower } from './runtimePrimitives.mjs';
import { redactSecrets } from './redaction.mjs';
import { DEFAULT_WRAPPED_IMAGE_QUALITY, WRAPPED_SECTION_ITEM_LIMIT, normalizeAgentOnlyRunId, WRAPPED_TOKEN_WEEK_BUCKETS } from './wrappedCore.mjs';
import { statementMap, ratingValuesFromSchema, answerScalarString } from './wrappedAnswers.mjs';
import { normalizeTokenCount, normalizeTokenUsageDate, normalizeDailyTokenUsage, normalizeTokenUsageDates } from './wrappedMetadata.mjs';
import { answerLabelForSchema } from './wrappedReview.mjs';
import { wrappedRowIsUnavailableGuess } from './wrappedPrompts.mjs';

export function wrappedDisplayText(value = '', maxChars = 180) {
  const redacted = redactSecrets(String(value ?? ''));
  return safeString(redacted).replace(/\s+/g, ' ').slice(0, maxChars);
}

export function normalizeWrappedImageQuality(value = '') {
  const quality = lower(value);
  return ['low', 'medium', 'high', 'auto'].includes(quality) ? quality : DEFAULT_WRAPPED_IMAGE_QUALITY;
}

export function normalizeWrappedImageMode(value = '') {
  const mode = lower(value).replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  if (['political_compass', 'compass', 'political_meme'].includes(mode)) return 'political_compass';
  if (['wrapped_story', 'story', 'story_video', 'wrapped_video', 'phone_story', 'phone_video', 'video'].includes(mode)) return 'wrapped_story';
  return 'wrapped';
}

export function allowsExperimentalWrappedSvgStoryboard(body = {}) {
  const mediaKind = lower(body.media_kind || body.mediaKind || body.output_media_kind || body.outputMediaKind);
  const format = lower(body.format);
  return mediaKind === 'animated_svg_storyboard'
    || body.allow_svg_storyboard === true
    || body.allowSvgStoryboard === true
    || format === 'svg';
}

export function wrappedImageModeMetadata(mode = '') {
  const normalized = normalizeWrappedImageMode(mode);
  if (normalized === 'political_compass') return 'c';
  if (normalized === 'wrapped_story') return 's';
  return 'w';
}

export function resolveWrappedPosterOpenAiKey(env = {}) {
  return safeString(env.AGENT_POSTER_API_KEY);
}

export function resolveWrappedPosterRenderer(env = {}) {
  return lower(env.AGENT_CONTEXT.config.agentHttp?.wrapped?.posterRenderer) === 'openai' ? 'openai' : 'local';
}

export function wrappedPredictionRows(space = {}, state = {}, { includeUnavailableGuesses = false, runId = '' } = {}) {
  const scopedRunId = normalizeAgentOnlyRunId(runId);
  const statements = statementMap(space);
  const rows = Object.entries(state.byStatement || {})
    .map(([questionId, entry]) => {
      const statement = entry?.agent?.statement;
      if (!entry?.agent?.answer || !statement || !statements.has(questionId)) return null;
      if (scopedRunId && normalizeAgentOnlyRunId(entry.agent.runId) !== scopedRunId) return null;
      return {
        questionId,
        question: wrappedDisplayText(statement.text, 280),
        answer: wrappedDisplayText(wrappedAnswerLabelForSchema(entry.agent.answer, statement.answer_schema || {}), 120),
        answerFormat: wrappedAnswerFormatForSchema(statement.answer_schema || {}),
        evalType: safeString(entry.agent.evalType),
        confidence: Math.max(0, Math.min(100, Math.floor(Number(entry.agent.confidence) || 0))),
      };
    })
    .filter(Boolean);
  return includeUnavailableGuesses ? rows : rows.filter((row) => !wrappedRowIsUnavailableGuess(row));
}

export function formatWrappedTokenCount(value = 0) {
  const count = normalizeTokenCount(value);
  if (!count) return '';
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(count >= 10_000_000 ? 0 : 1).replace(/\.0$/, '')}M`;
  if (count >= 1_000) return `${Math.round(count / 1_000)}K`;
  return String(count);
}

export function formatWrappedStackHeight(inches = 0) {
  if (!Number.isFinite(inches) || inches <= 0) return '';
  if (inches < 12) return `${Math.max(1, Math.round(inches))} in`;
  return `${(inches / 12).toFixed(inches >= 120 ? 0 : 1).replace(/\.0$/, '')} ft`;
}

export function wrappedTokenUsageComparison(value = 0) {
  const count = normalizeTokenCount(value);
  if (!count) return '';
  const pages = Math.max(1, Math.round(count / 750));
  const books = Math.max(1, Math.round(count / 75_000));
  const stackHeight = formatWrappedStackHeight(pages / 250);
  const pageLabel = pages >= 1000 ? `${(pages / 1000).toFixed(pages >= 10_000 ? 0 : 1).replace(/\.0$/, '')}K pages` : `${pages} pages`;
  const bookLabel = books === 1 ? '1 book' : `${books} books`;
  return `roughly ${bookLabel} at ~75K tokens/book, ${pageLabel}${stackHeight ? `, paper stack about ${stackHeight} tall` : ''}`;
}

export function wrappedDateInRange(date = '', bucket = {}) {
  const normalized = normalizeTokenUsageDate(date);
  if (!normalized) return false;
  return normalized >= bucket.start && normalized <= bucket.end;
}

export function wrappedWeeklyTokenUsageLine(rows = []) {
  const normalized = normalizeDailyTokenUsage(rows);
  if (!normalized.length) return '';
  const usageByWeek = WRAPPED_TOKEN_WEEK_BUCKETS.map((bucket) => {
    const total = normalized
      .filter((row) => wrappedDateInRange(row.date, bucket))
      .reduce((sum, row) => sum + row.tokens, 0);
    return `${bucket.label}=${formatWrappedTokenCount(total) || '0'}`;
  }).join(', ');
  const ranges = WRAPPED_TOKEN_WEEK_BUCKETS
    .map((bucket) => `${bucket.label} ${bucket.range}`)
    .join(', ');
  return [
    `weekly usage: ${usageByWeek}`,
    `week ranges: ${ranges}`,
  ].filter(Boolean).join('; ');
}

export function wrappedDailyTokenUsageTotal(rows = []) {
  return normalizeDailyTokenUsage(rows).reduce((sum, row) => sum + row.tokens, 0);
}

export function wrappedDailyTokenUsageMatchesTotal(rows = [], total = 0) {
  const rowTotal = wrappedDailyTokenUsageTotal(rows);
  const normalizedTotal = normalizeTokenCount(total);
  if (!rowTotal) return false;
  if (!normalizedTotal) return true;
  const ratio = rowTotal / normalizedTotal;
  return ratio >= 0.8 && ratio <= 1.25;
}

export function wrappedTokenUsageEvidenceLine(state = {}) {
  const candidates = [];
  for (const entry of Object.values(state.byStatement || {})) {
    const agent = entry?.agent;
    const usage = agent?.agentMetadata?.tokenUsage;
    if (!usage || typeof usage !== 'object' || Array.isArray(usage)) continue;
    candidates.push({
      updatedAt: safeString(agent.updatedAt),
      currentRunTotalTokens: normalizeTokenCount(usage.currentRunTotalTokens),
      recentSessionsTotalTokens: normalizeTokenCount(usage.recentSessionsTotalTokens),
      inputTokens: normalizeTokenCount(usage.inputTokens),
      outputTokens: normalizeTokenCount(usage.outputTokens),
      dailyUsage30d: normalizeDailyTokenUsage(usage.dailyUsage30d),
      edgeInPersonDates: normalizeTokenUsageDates(usage.edgeInPersonDates),
      source: wrappedDisplayText(usage.source, 80),
    });
  }
  candidates.sort((left, right) => safeString(right.updatedAt).localeCompare(safeString(left.updatedAt)));
  const usage = candidates.find((candidate) => (
    candidate.recentSessionsTotalTokens ||
    candidate.inputTokens ||
    candidate.outputTokens ||
    candidate.dailyUsage30d.length
  ));
  if (!usage) return '';
  const parts = [];
  const visibleMonthlyTotal = usage.recentSessionsTotalTokens
    || usage.dailyUsage30d.reduce((sum, row) => sum + row.tokens, 0)
    || usage.inputTokens + usage.outputTokens;
  if (!visibleMonthlyTotal) return '';
  parts.push(`${formatWrappedTokenCount(visibleMonthlyTotal)} tokens`);
  const comparisonBase = visibleMonthlyTotal;
  const comparison = wrappedTokenUsageComparison(comparisonBase);
  const weeklyLine = wrappedDailyTokenUsageMatchesTotal(usage.dailyUsage30d, visibleMonthlyTotal)
    ? wrappedWeeklyTokenUsageLine(usage.dailyUsage30d)
    : '';
  const weeklySuffix = weeklyLine ? `; ${weeklyLine}` : '';
  return `Token Use: ${parts.join('; ')}${comparison ? `; intuition: ${comparison}` : ''}${weeklySuffix}${usage.source ? ` (source: ${usage.source})` : ''}.`;
}

export function answerStateForRun(state = {}, runId = '') {
  const scopedRunId = normalizeAgentOnlyRunId(runId);
  if (!scopedRunId) return state;
  const byStatement = {};
  for (const [questionId, entry] of Object.entries(state.byStatement || {})) {
    const nextEntry = {};
    if (entry?.agent && normalizeAgentOnlyRunId(entry.agent.runId) === scopedRunId) {
      nextEntry.agent = entry.agent;
    }
    if (entry?.agentSkip && normalizeAgentOnlyRunId(entry.agentSkip.runId) === scopedRunId) {
      nextEntry.agentSkip = entry.agentSkip;
    }
    if (entry?.human) nextEntry.human = entry.human;
    if (Object.keys(nextEntry).length) byStatement[questionId] = nextEntry;
  }
  return { ...state, byStatement };
}

export function agentOnlyResponseCoverage(space = {}, state = {}, { runId = '' } = {}) {
  const scopedRunId = normalizeAgentOnlyRunId(runId);
  const statementIds = new Set((Array.isArray(space.statements) ? space.statements : [])
    .map((statement) => safeString(statement?.statement_id || statement?.questionId))
    .filter(Boolean));
  let agentPredictionCount = 0;
  let privacySkipCount = 0;
  statementIds.forEach((statementId) => {
    const entry = state?.byStatement?.[statementId];
    if (entry?.agent?.answer && (!scopedRunId || normalizeAgentOnlyRunId(entry.agent.runId) === scopedRunId)) {
      agentPredictionCount += 1;
    } else if (entry?.agentSkip && (!scopedRunId || normalizeAgentOnlyRunId(entry.agentSkip.runId) === scopedRunId)) {
      privacySkipCount += 1;
    }
  });
  const agentResponseCount = agentPredictionCount + privacySkipCount;
  return {
    statementCount: statementIds.size,
    agentPredictionCount,
    privacySkipCount,
    agentResponseCount,
    allStatementsPredicted: statementIds.size > 0 && agentPredictionCount >= statementIds.size,
    allStatementsCovered: statementIds.size > 0 && agentResponseCount >= statementIds.size,
  };
}

export function agentOnlyRunResponseCoverage(scope = {}) {
  const ids = Array.isArray(scope.runStatementIds) ? scope.runStatementIds : [];
  const coverage = String(scope.coverage || '').slice(0, ids.length);
  const agentPredictionCount = [...coverage].filter(value => value === 'a').length;
  const privacySkipCount = [...coverage].filter(value => value === 's').length;
  const agentResponseCount = agentPredictionCount + privacySkipCount;
  return { statementCount: ids.length, agentPredictionCount, privacySkipCount, agentResponseCount,
    allStatementsPredicted: ids.length > 0 && agentPredictionCount === ids.length,
    allStatementsCovered: ids.length > 0 && agentResponseCount === ids.length };
}

export function wrappedAnswerFormatForSchema(schema = {}) {
  const kind = safeString(schema?.kind);
  if (kind === 'text') return 'freeform text';
  if (kind === 'multichoice') return 'multichoice selection';
  if (kind === 'quadratic') return 'quadratic allocation';
  if (kind === 'choice' || kind === 'rating') {
    const rawValues = Array.isArray(schema.values) && schema.values.length ? schema.values : ratingValuesFromSchema(schema);
    const values = rawValues.map((value) => lower(answerScalarString(value)));
    const valueSet = new Set(values);
    if (['agree', 'unsure', 'disagree'].every((value) => valueSet.has(value))) return 'binary choice';
    const numericValues = values.map(Number).filter((value) => Number.isFinite(value));
    if (numericValues.length >= 2) return 'rating scale';
    return 'single choice';
  }
  return kind || 'answer';
}

export function wrappedAnswerLabelForSchema(answer = {}, schema = {}) {
  const base = answerLabelForSchema(answer, schema);
  if (schema?.kind !== 'choice' && schema?.kind !== 'rating') return base;
  const valueText = answerScalarString(answer?.value);
  if (!valueText) return base;
  if (['agree', 'unsure', 'disagree'].includes(lower(valueText))) return base;
  const numericValue = Number(valueText);
  if (!Number.isFinite(numericValue)) return base;
  const numericOptions = (Array.isArray(schema.values) && schema.values.length ? schema.values : ratingValuesFromSchema(schema))
    .map((value) => Number(answerScalarString(value)))
    .filter((value) => Number.isFinite(value));
  if (numericOptions.length < 2) return base;
  const max = Math.max(...numericOptions);
  if (!Number.isFinite(max) || max <= 0) return base;
  return `${answerScalarString(numericValue)}/${answerScalarString(max)}`;
}

export function wrappedImportanceRows(space = {}, voteStates = [], { excludeQuestionIds = new Set() } = {}) {
  const statements = statementMap(space);
  const weights = new Map();
  for (const state of voteStates) {
    const mode = lower(state?.mode);
    for (const [questionId, rawWeight] of Object.entries(state?.votes || {})) {
      const weight = Math.floor(Number(rawWeight) || 0);
      if (!weight) continue;
      const contribution = mode === 'quadratic' ? weight * weight : Math.abs(weight);
      const signedContribution = weight > 0 ? contribution : 0;
      const existing = weights.get(questionId) || { positive: 0, absolute: 0 };
      existing.positive += signedContribution;
      existing.absolute += contribution;
      weights.set(questionId, existing);
    }
  }
  return [...weights.entries()]
    .map(([questionId, score]) => {
      if (excludeQuestionIds.has(questionId)) return null;
      const statement = statements.get(questionId);
      if (!statement) return null;
      if (score.positive <= 0) return null;
      return {
        questionId,
        score: score.positive,
        question: wrappedDisplayText(statement.text, 260),
      };
    })
    .filter((row) => row && row.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, WRAPPED_SECTION_ITEM_LIMIT);
}

export function predictionLine(row = {}, { questionChars = 240, answerChars = 80 } = {}) {
  return `Question: "${wrappedDisplayText(row.question, questionChars)}"; answer format: ${wrappedDisplayText(row.answerFormat || 'answer', 40)}; prediction: ${wrappedDisplayText(row.answer || 'N/A', answerChars)}; confidence: ${row.confidence}%`;
}

export function wrappedAnswerIsUnavailable(value = '') {
  const text = (value === undefined || value === null ? '' : String(value)).trim().toLowerCase();
  if (/(^|[^a-z0-9])n\s*\/?\s*a([^a-z0-9]|$)/i.test(text)) return true;
  if (/\bnot\s+applicable\b|\bnot\s+enough\b|\binsufficient\b|\bunsupported\b|\bunknown\b|\bunavailable\b/.test(text)) return true;
  const normalized = text.replace(/[^a-z0-9]+/g, '');
  if (!normalized) return true;
  if ([
    'na',
    'notsupported',
    'unsupported',
    'unknown',
    'unavailable',
    'notapplicable',
    'notenoughcontext',
    'notenoughevidence',
    'notenoughinformation',
    'insufficientcontext',
    'insufficientevidence',
    'insufficientdata',
    'nodata',
    'noevidence',
  ].includes(normalized)) return true;
  return normalized.startsWith('notenough') || normalized.startsWith('insufficient');
}
