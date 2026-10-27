import { safeString, lower, safeJsonParse, nowIsoOrCurrent as nowIso, sanitizeSessionSlug } from './runtimePrimitives.mjs';
import { assertNoSecretShape } from './redaction.mjs';
import { WRAPPED_QUESTION_SOURCE_MODES, resolveWrappedQuestionSourceMode } from './wrappedQuestionSource.mjs';
import { MAX_AGENT_ONLY_QUESTIONS, AGENT_ONLY_EVAL_TYPES, normalizeQuestionId, configKvKey } from './wrappedCore.mjs';

export function defaultAgentOnlyModeConfig(sessionSlug = '') {
  return {
    type: 'telegram_agent_mode_config',
    version: 1,
    sessionSlug: sanitizeSessionSlug(sessionSlug),
    questionSourceMode: WRAPPED_QUESTION_SOURCE_MODES.CANONICAL_SESSION,
    enabledQuestionIds: [],
    evalTypesByQuestionId: {},
    createdAt: '',
    updatedAt: '',
    updatedBy: 'default',
  };
}

export function normalizeQuestionIds(value = []) {
  const source = Array.isArray(value) ? value : safeString(value).split(/[\s,;|]+/);
  const seen = new Set();
  const out = [];
  for (const raw of source) {
    const id = normalizeQuestionId(raw);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
    if (out.length >= MAX_AGENT_ONLY_QUESTIONS) break;
  }
  return out;
}

export function normalizeEvalTypes(value = {}, enabledQuestionIds = []) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const allowedIds = new Set(enabledQuestionIds);
  const out = {};
  Object.entries(source).forEach(([rawId, rawType]) => {
    const id = normalizeQuestionId(rawId);
    const type = lower(rawType).replace(/[^a-z0-9_-]+/g, '_').slice(0, 48);
    if (id && allowedIds.has(id) && AGENT_ONLY_EVAL_TYPES.has(type)) out[id] = type;
  });
  return out;
}

export function normalizeAgentOnlyModeConfigPatch(patch = {}, current = null) {
  const input = patch && typeof patch === 'object' && !Array.isArray(patch) ? patch : {};
  const base = current && typeof current === 'object' && !Array.isArray(current)
    ? current
    : defaultAgentOnlyModeConfig(input.sessionSlug);
  const enabledQuestionIds = Object.hasOwn(input, 'enabledQuestionIds')
    ? normalizeQuestionIds(input.enabledQuestionIds)
    : normalizeQuestionIds(base.enabledQuestionIds);
  const evalTypesByQuestionId = Object.hasOwn(input, 'evalTypesByQuestionId')
    ? normalizeEvalTypes(input.evalTypesByQuestionId, enabledQuestionIds)
    : normalizeEvalTypes(base.evalTypesByQuestionId, enabledQuestionIds);
  const questionSourceMode = Object.hasOwn(input, 'questionSourceMode')
    ? resolveWrappedQuestionSourceMode({ source: 'default', config: { questionSourceMode: input.questionSourceMode } })
    : (
        Object.hasOwn(input, 'enabledQuestionIds') && enabledQuestionIds.length > 0
          ? WRAPPED_QUESTION_SOURCE_MODES.AGENT_ONLY_PROPOSALS
          : resolveWrappedQuestionSourceMode({ source: 'default', config: base })
      );
  return {
    questionSourceMode,
    enabledQuestionIds,
    evalTypesByQuestionId,
  };
}

export async function loadAgentOnlyModeConfig({ env = {}, sessionSlug = '' } = {}) {
  const slug = sanitizeSessionSlug(sessionSlug);
  const fallback = defaultAgentOnlyModeConfig(slug);
  const kv = env?.AGENT_ACTION_KV;
  const key = configKvKey(slug);
  if (!key || !kv || typeof kv.get !== 'function') return { source: 'default', config: fallback };
  const parsed = safeJsonParse(await kv.get(key), null);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { source: 'default', config: fallback };
  }
  assertNoSecretShape(parsed, "Agent-only config records must not serialize secrets.");
  const normalized = normalizeAgentOnlyModeConfigPatch(parsed, fallback);
  if (!Object.hasOwn(parsed, 'questionSourceMode')) {
    normalized.questionSourceMode = WRAPPED_QUESTION_SOURCE_MODES.AGENT_ONLY_PROPOSALS;
  }
  return {
    source: 'kv',
    config: {
      ...fallback,
      sessionSlug: slug,
      ...normalized,
      createdAt: safeString(parsed.createdAt),
      updatedAt: safeString(parsed.updatedAt),
      updatedBy: safeString(parsed.updatedBy || 'service'),
    },
  };
}

export async function saveAgentOnlyModeConfig({
  env = {},
  sessionSlug = '',
  patch = {},
  updatedBy = 'service',
  createdAt = null,
} = {}) {
  const slug = sanitizeSessionSlug(sessionSlug || patch.sessionSlug);
  const key = configKvKey(slug);
  const kv = env?.AGENT_ACTION_KV;
  if (!key || !kv || typeof kv.put !== 'function') {
    return { ok: false, status: 500, reason: 'agent_only_config_storage_unavailable' };
  }
  const loaded = await loadAgentOnlyModeConfig({ env, sessionSlug: slug });
  const normalized = normalizeAgentOnlyModeConfigPatch(patch, loaded.config);
  const timestamp = nowIso(createdAt);
  const record = {
    ...defaultAgentOnlyModeConfig(slug),
    ...loaded.config,
    ...normalized,
    sessionSlug: slug,
    createdAt: safeString(loaded.config.createdAt) || timestamp,
    updatedAt: timestamp,
    updatedBy: safeString(updatedBy) || 'service',
  };
  assertNoSecretShape(record, "Agent-only config records must not serialize secrets.");
  await kv.put(key, JSON.stringify(record), {
    metadata: { v: 1, t: 'ao_config', sg: slug, q: record.enabledQuestionIds.length },
  });
  return { ok: true, source: 'kv', config: record };
}
