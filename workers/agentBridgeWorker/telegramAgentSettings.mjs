import {
  safeString,
  lower,
  safeJsonParse,
  stableJson,
  stableFingerprint,
  kvKeySafePart,
} from './runtimePrimitives.mjs';
import { assertNoSecretShape } from './redaction.mjs';

const TELEGRAM_AGENT_SETTINGS_KV_PREFIX = 'telegram:agent-settings:v1:';

function sanitizeSessionSlug(value = '') {
  return lower(value).replace(/[^a-z0-9_-]/g, '').slice(0, 128);
}

function normalizeBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback;
  if (value === true || value === false) return value;
  const normalized = lower(value);
  if (['true', '1', 'yes', 'on'].includes(normalized)) return true;
  if (['false', '0', 'no', 'off'].includes(normalized)) return false;
  return fallback;
}

function normalizeDraftStyle(value = '') {
  const draftStyle = lower(value);
  return ['concise', 'balanced', 'detailed'].includes(draftStyle) ? draftStyle : 'balanced';
}

function parseQuestionBatchNumber(value) {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  if (typeof value === 'string' && !value.trim()) return null;
  const n = Math.floor(Number(value));
  return Number.isFinite(n) ? n : null;
}

function normalizeQuestionsPerBatch(value, fallback = 3) {
  const n = parseQuestionBatchNumber(value);
  if (n === null) return fallback;
  return Math.min(10, Math.max(1, n));
}

function normalizeDigestFrequency(value = '') {
  const frequency = lower(value);
  return ['off', 'weekly', 'few_per_week', 'daily'].includes(frequency) ? frequency : 'weekly';
}

function normalizeDigestTimeOfDay(value = '', fallback = 'morning') {
  const time = lower(value);
  if (['morning', 'am', 'day'].includes(time)) return 'morning';
  if (['night', 'evening', 'pm'].includes(time)) return 'night';
  return fallback;
}

function normalizeStringList(value = []) {
  const source = Array.isArray(value) ? value : safeString(value).split(/[\n,;|]+/);
  return source
    .map((entry) => lower(entry).replace(/[^a-z0-9_-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 64))
    .filter(Boolean)
    .filter((entry, index, values) => values.indexOf(entry) === index);
}

function normalizeTopicPreferences(value = []) {
  const source = Array.isArray(value) ? value : safeString(value).split(/[\n,;|#]+/);
  return source
    .map((entry) => lower(entry).replace(/&/g, ' and ').replace(/[^a-z0-9:]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 64))
    .filter(Boolean)
    .filter((entry, index, values) => values.indexOf(entry) === index)
    .slice(0, 30);
}

function normalizeApprovalMode(value = {}) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const normalized = {};
  ['answers', 'questionVotes', 'groups'].forEach((key) => {
    const mode = lower(source[key]).replace(/[^a-z0-9_-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 64);
    if (mode) normalized[key] = mode;
  });
  return {
    answers: normalized.answers || 'draft_for_review',
    questionVotes: normalized.questionVotes || 'suggest_for_review',
    groups: normalized.groups || 'suggest_for_review',
  };
}

function normalizeIsoString(value = '') {
  const text = safeString(value);
  if (!text) return '';
  const parsed = Date.parse(text);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : '';
}

export function telegramAgentSettingsKey({
  sessionSlug = '',
  telegramUserId = '',
} = {}) {
  const slug = sanitizeSessionSlug(sessionSlug) || 'global';
  const user = kvKeySafePart(telegramUserId);
  return user ? `${TELEGRAM_AGENT_SETTINGS_KV_PREFIX}${slug}:${user}` : '';
}

export function defaultTelegramAgentSettings(env = {}) {
  const parsed = safeJsonParse(env.AGENT_BRIDGE_DEMO_AGENT_SETTINGS_JSON, null);
  const source = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  const settings = {
    draftStyle: normalizeDraftStyle(source.draftStyle),
    showUnansweredFirst: normalizeBoolean(source.showUnansweredFirst, true),
    showAgentResponses: normalizeBoolean(source.showAgentResponses, true),
    agentAutoApplyQuestionVotes: normalizeBoolean(source.agentAutoApplyQuestionVotes, false),
    allowedProfileFields: normalizeStringList(source.allowedProfileFields),
    allowedUses: normalizeStringList(source.allowedUses),
    topicPreferences: normalizeTopicPreferences(source.topicPreferences || source.topics),
    demographicLinkOptIn: normalizeBoolean(source.demographicLinkOptIn, false),
    attendanceLinkOptIn: normalizeBoolean(source.attendanceLinkOptIn, false),
    draftDivergenceOptIn: normalizeBoolean(source.draftDivergenceOptIn, false),
    approvalMode: normalizeApprovalMode(source.approvalMode),
    dailyDigestOptIn: normalizeBoolean(source.dailyDigestOptIn, false),
    questionsPerBatch: normalizeQuestionsPerBatch(source.questionsPerBatch, 3),
    digestFrequency: normalizeDigestFrequency(source.digestFrequency),
    digestTimeOfDay: normalizeDigestTimeOfDay(source.digestTimeOfDay),
    onboardingCompletedAt: normalizeIsoString(source.onboardingCompletedAt),
  };
  assertNoSecretShape(settings, 'Telegram agent settings defaults must not serialize secrets.');
  return settings;
}

export function normalizeTelegramAgentSettingsPatch(settings = {}) {
  const input = settings && typeof settings === 'object' && !Array.isArray(settings) ? settings : {};
  assertNoSecretShape(input, 'Telegram Mini App settings payloads must not serialize secrets.');
  const patch = {};
  if (Object.hasOwn(input, 'draftStyle')) {
    const draftStyle = lower(input.draftStyle);
    if (!['concise', 'balanced', 'detailed'].includes(draftStyle)) {
      return { ok: false, reason: 'draft_style_invalid' };
    }
    patch.draftStyle = draftStyle;
  }
  if (Object.hasOwn(input, 'showUnansweredFirst')) {
    const normalized = normalizeBoolean(input.showUnansweredFirst, null);
    if (normalized === null) return { ok: false, reason: 'show_unanswered_first_invalid' };
    patch.showUnansweredFirst = normalized;
  }
  if (Object.hasOwn(input, 'showAgentResponses')) {
    const normalized = normalizeBoolean(input.showAgentResponses, null);
    if (normalized === null) return { ok: false, reason: 'show_agent_responses_invalid' };
    patch.showAgentResponses = normalized;
  }
  if (Object.hasOwn(input, 'agentAutoApplyQuestionVotes')) {
    const normalized = normalizeBoolean(input.agentAutoApplyQuestionVotes, null);
    if (normalized === null) return { ok: false, reason: 'agent_auto_apply_question_votes_invalid' };
    patch.agentAutoApplyQuestionVotes = normalized;
  }
  if (Object.hasOwn(input, 'allowedProfileFields')) {
    patch.allowedProfileFields = normalizeStringList(input.allowedProfileFields);
  }
  if (Object.hasOwn(input, 'allowedUses')) {
    patch.allowedUses = normalizeStringList(input.allowedUses);
  }
  if (Object.hasOwn(input, 'topicPreferences') || Object.hasOwn(input, 'topics')) {
    patch.topicPreferences = normalizeTopicPreferences(input.topicPreferences || input.topics);
  }
  if (Object.hasOwn(input, 'demographicLinkOptIn')) {
    const normalized = normalizeBoolean(input.demographicLinkOptIn, null);
    if (normalized === null) return { ok: false, reason: 'demographic_link_opt_in_invalid' };
    patch.demographicLinkOptIn = normalized;
  }
  if (Object.hasOwn(input, 'attendanceLinkOptIn')) {
    const normalized = normalizeBoolean(input.attendanceLinkOptIn, null);
    if (normalized === null) return { ok: false, reason: 'attendance_link_opt_in_invalid' };
    patch.attendanceLinkOptIn = normalized;
  }
  if (Object.hasOwn(input, 'draftDivergenceOptIn')) {
    const normalized = normalizeBoolean(input.draftDivergenceOptIn, null);
    if (normalized === null) return { ok: false, reason: 'draft_divergence_opt_in_invalid' };
    patch.draftDivergenceOptIn = normalized;
  }
  if (Object.hasOwn(input, 'approvalMode')) {
    patch.approvalMode = normalizeApprovalMode(input.approvalMode);
  }
  if (Object.hasOwn(input, 'dailyDigestOptIn')) {
    const normalized = normalizeBoolean(input.dailyDigestOptIn, null);
    if (normalized === null) return { ok: false, reason: 'daily_digest_opt_in_invalid' };
    patch.dailyDigestOptIn = normalized;
  }
  if (Object.hasOwn(input, 'questionsPerBatch')) {
    const parsed = parseQuestionBatchNumber(input.questionsPerBatch);
    if (parsed === null) return { ok: false, reason: 'questions_per_batch_invalid' };
    patch.questionsPerBatch = Math.min(10, Math.max(1, parsed));
  }
  if (Object.hasOwn(input, 'digestFrequency')) {
    const digestFrequency = lower(input.digestFrequency);
    if (!['off', 'weekly', 'few_per_week', 'daily'].includes(digestFrequency)) {
      return { ok: false, reason: 'digest_frequency_invalid' };
    }
    patch.digestFrequency = digestFrequency;
  }
  if (Object.hasOwn(input, 'digestTimeOfDay')) {
    const digestTime = lower(input.digestTimeOfDay);
    if (!['morning', 'am', 'day', 'night', 'evening', 'pm'].includes(digestTime)) {
      return { ok: false, reason: 'digest_time_of_day_invalid' };
    }
    patch.digestTimeOfDay = normalizeDigestTimeOfDay(digestTime);
  }
  if (Object.hasOwn(input, 'onboardingCompletedAt')) {
    patch.onboardingCompletedAt = normalizeIsoString(input.onboardingCompletedAt);
  }
  if (!Object.keys(patch).length) {
    return { ok: false, reason: 'settings_patch_required' };
  }
  return {
    ok: true,
    patch,
    publicSummary: { ...patch },
  };
}

export async function loadTelegramAgentSettings({
  env = {},
  sessionSlug = '',
  telegramUserId = '',
} = {}) {
  const defaults = defaultTelegramAgentSettings(env);
  const key = telegramAgentSettingsKey({ sessionSlug, telegramUserId });
  if (!key || !env?.AGENT_ACTION_KV || typeof env.AGENT_ACTION_KV.get !== 'function') return defaults;
  const record = safeJsonParse(await env.AGENT_ACTION_KV.get(key).catch(() => null), null);
  if (!record || typeof record !== 'object' || Array.isArray(record)) return defaults;
  assertNoSecretShape(record, 'Telegram agent settings records must not serialize secrets.');
  const settings = record.settings && typeof record.settings === 'object' && !Array.isArray(record.settings)
    ? record.settings
    : record;
  return {
    draftStyle: normalizeDraftStyle(settings.draftStyle || defaults.draftStyle),
    showUnansweredFirst: normalizeBoolean(settings.showUnansweredFirst, defaults.showUnansweredFirst),
    showAgentResponses: normalizeBoolean(settings.showAgentResponses, defaults.showAgentResponses),
    agentAutoApplyQuestionVotes: normalizeBoolean(
      settings.agentAutoApplyQuestionVotes,
      defaults.agentAutoApplyQuestionVotes
    ),
    allowedProfileFields: normalizeStringList(settings.allowedProfileFields || defaults.allowedProfileFields),
    allowedUses: normalizeStringList(settings.allowedUses || defaults.allowedUses),
    topicPreferences: normalizeTopicPreferences(settings.topicPreferences || defaults.topicPreferences),
    demographicLinkOptIn: normalizeBoolean(settings.demographicLinkOptIn, defaults.demographicLinkOptIn),
    attendanceLinkOptIn: normalizeBoolean(settings.attendanceLinkOptIn, defaults.attendanceLinkOptIn),
    draftDivergenceOptIn: normalizeBoolean(settings.draftDivergenceOptIn, defaults.draftDivergenceOptIn),
    approvalMode: normalizeApprovalMode(settings.approvalMode || defaults.approvalMode),
    dailyDigestOptIn: normalizeBoolean(settings.dailyDigestOptIn, defaults.dailyDigestOptIn),
    questionsPerBatch: normalizeQuestionsPerBatch(settings.questionsPerBatch, defaults.questionsPerBatch),
    digestFrequency: normalizeDigestFrequency(settings.digestFrequency || defaults.digestFrequency),
    digestTimeOfDay: normalizeDigestTimeOfDay(settings.digestTimeOfDay, defaults.digestTimeOfDay),
    onboardingCompletedAt: normalizeIsoString(settings.onboardingCompletedAt || defaults.onboardingCompletedAt),
  };
}

export async function saveTelegramAgentSettingsPatch({
  env = {},
  sessionSlug = '',
  telegramUserId = '',
  patch = {},
  createdAt = null,
} = {}) {
  const key = telegramAgentSettingsKey({ sessionSlug, telegramUserId });
  if (!key || !env?.AGENT_ACTION_KV || typeof env.AGENT_ACTION_KV.put !== 'function') {
    return { ok: false, reason: 'agent_settings_storage_unavailable' };
  }
  const normalized = normalizeTelegramAgentSettingsPatch(patch);
  if (!normalized.ok) return normalized;
  const current = await loadTelegramAgentSettings({ env, sessionSlug, telegramUserId });
  const settings = {
    ...current,
    ...normalized.publicSummary,
  };
  const existing = safeJsonParse(await env.AGENT_ACTION_KV.get(key).catch(() => null), null);
  const record = {
    type: 'telegram_agent_settings',
    version: 1,
    sessionSlug: sanitizeSessionSlug(sessionSlug) || 'global',
    telegramUserId: safeString(telegramUserId),
    settings,
    createdAt: safeString(existing?.createdAt) || createdAt,
    updatedAt: createdAt,
  };
  assertNoSecretShape(record, 'Telegram agent settings records must not serialize secrets.');
  await env.AGENT_ACTION_KV.put(key, JSON.stringify(record));
  return {
    ok: true,
    key,
    settings,
    patch: normalized.publicSummary,
  };
}

export const __test__telegramAgentSettings = {
  TELEGRAM_AGENT_SETTINGS_KV_PREFIX,
  defaultTelegramAgentSettings,
  normalizeDigestFrequency,
  normalizeDigestTimeOfDay,
  normalizeQuestionsPerBatch,
  normalizeTelegramAgentSettingsPatch,
  telegramAgentSettingsKey,
};
