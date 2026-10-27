import { safeString } from './runtimePrimitives.mjs';
import { redactSecrets } from './redaction.mjs';
import { wrappedDisplayText } from './wrappedEvidence.mjs';

export function normalizeAgentMetadata(value = {}) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const model = safeString(source.model);
  const scaffoldVersion = safeString(source.scaffold_version || source.scaffoldVersion);
  if (!model) return { ok: false, reason: 'agent_metadata_model_required' };
  if (!scaffoldVersion) return { ok: false, reason: 'agent_metadata_scaffold_version_required' };
  const initializedAt = safeString(source.agent_initialized_at || source.agentInitializedAt);
  if (initializedAt && !Number.isFinite(Date.parse(initializedAt))) {
    return { ok: false, reason: 'agent_metadata_initialized_at_invalid' };
  }
  const tokenUsage = normalizeAgentTokenUsage(source.token_usage || source.tokenUsage || source.tokens || source.usage);
  return {
    ok: true,
    value: {
      model: model.slice(0, 160),
      scaffoldVersion: scaffoldVersion.slice(0, 160),
      agentInitializedAt: initializedAt ? new Date(Date.parse(initializedAt)).toISOString() : '',
      ...(tokenUsage ? { tokenUsage } : {}),
    },
  };
}

export function normalizeTokenCount(value) {
  const numeric = Number(String(value ?? '').replace(/[\s,_]/g, ''));
  if (!Number.isFinite(numeric) || numeric <= 0) return 0;
  return Math.min(Math.floor(numeric), 1_000_000_000);
}

export function normalizeTokenUsageDate(value) {
  const raw = safeString(value);
  if (!raw) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const parsed = Date.parse(raw);
  if (!Number.isFinite(parsed)) return '';
  return new Date(parsed).toISOString().slice(0, 10);
}

export function normalizeDailyTokenUsage(value) {
  const rows = [];
  const addRow = (dateValue, tokenValue) => {
    const date = normalizeTokenUsageDate(dateValue);
    const tokens = normalizeTokenCount(tokenValue);
    if (!date || !tokens) return;
    rows.push({ date, tokens });
  };
  if (Array.isArray(value)) {
    for (const entry of value) {
      if (Array.isArray(entry)) {
        addRow(entry[0], entry[1]);
      } else if (entry && typeof entry === 'object') {
        const explicitTokens = entry.tokens
          ?? entry.total_tokens
          ?? entry.totalTokens
          ?? entry.total_combined_tokens
          ?? entry.totalCombinedTokens
          ?? entry.combined_tokens
          ?? entry.combinedTokens
          ?? entry.token_count
          ?? entry.tokenCount
          ?? entry.count;
        const fallbackCombinedTokens = explicitTokens == null
          ? normalizeTokenCount(entry.raw_network_tokens ?? entry.rawNetworkTokens ?? entry.rawTokens)
            + normalizeTokenCount(entry.evaluated_cache_read_tokens ?? entry.evaluatedCacheReadTokens ?? entry.cache_read_tokens ?? entry.cacheReadTokens)
          : explicitTokens;
        addRow(
          entry.date ?? entry.day ?? entry.d,
          fallbackCombinedTokens,
        );
      }
    }
  } else if (value && typeof value === 'object') {
    for (const [date, tokens] of Object.entries(value)) addRow(date, tokens);
  }
  const merged = new Map();
  for (const row of rows) merged.set(row.date, (merged.get(row.date) || 0) + row.tokens);
  return [...merged.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .slice(-30)
    .map(([date, tokens]) => ({ date, tokens }));
}

export function normalizeTokenUsageDates(value) {
  const source = Array.isArray(value) ? value : safeString(value).split(/[,\s]+/);
  const seen = new Set();
  const dates = [];
  for (const entry of source) {
    const date = normalizeTokenUsageDate(entry);
    if (!date || seen.has(date)) continue;
    seen.add(date);
    dates.push(date);
  }
  return dates.sort().slice(-30);
}

export function normalizeAgentTokenUsage(value = {}) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const currentRunTotalTokens = normalizeTokenCount(
    source.current_run_total_tokens
      ?? source.currentRunTotalTokens
      ?? source.run_total_tokens
      ?? source.runTotalTokens
      ?? source.current_run
      ?? source.currentRun
      ?? source.total_tokens
      ?? source.totalTokens,
  );
  const recentSessionsTotalTokens = normalizeTokenCount(
    source.recent_sessions_total_tokens ??
      source.recentSessionsTotalTokens ??
      source.across_sessions_total_tokens ??
      source.acrossSessionsTotalTokens ??
      source.historical_total_tokens ??
      source.historicalTotalTokens ??
      source.sessions_total_tokens ??
      source.sessionsTotalTokens,
  );
  const inputTokens = normalizeTokenCount(
    source.input_tokens ?? source.inputTokens ?? source.prompt_tokens ?? source.promptTokens,
  );
  const outputTokens = normalizeTokenCount(
    source.output_tokens ?? source.outputTokens ?? source.completion_tokens ?? source.completionTokens,
  );
  const dailyUsage30d = normalizeDailyTokenUsage(
    source.daily_usage_30d
      ?? source.dailyUsage30d
      ?? source.daily_usage
      ?? source.dailyUsage
      ?? source.usage_by_day
      ?? source.usageByDay
      ?? source.days,
  );
  const edgeInPersonDates = normalizeTokenUsageDates(
    source.edge_in_person_dates ??
      source.edgeInPersonDates ??
      source.edge_dates ??
      source.edgeDates ??
      source.edgeos_in_person_dates ??
      source.edgeosInPersonDates,
  );
  const tokenSource = wrappedDisplayText(
    redactSecrets(source.source || source.surface || source.observed_from || source.observedFrom),
    120,
  );
  if (!currentRunTotalTokens && !recentSessionsTotalTokens && !inputTokens && !outputTokens && !dailyUsage30d.length)
    return null;
  return {
    ...(currentRunTotalTokens ? { currentRunTotalTokens } : {}),
    ...(recentSessionsTotalTokens ? { recentSessionsTotalTokens } : {}),
    ...(inputTokens ? { inputTokens } : {}),
    ...(outputTokens ? { outputTokens } : {}),
    ...(dailyUsage30d.length ? { dailyUsage30d } : {}),
    ...(edgeInPersonDates.length ? { edgeInPersonDates } : {}),
    ...(tokenSource ? { source: tokenSource } : {}),
  };
}
