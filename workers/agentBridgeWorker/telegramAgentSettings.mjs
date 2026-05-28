import { assertNoSecretShape } from './redaction.mjs';

const TELEGRAM_AGENT_SETTINGS_KV_PREFIX = 'telegram:agent-settings:v1:';

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
    agentAutoApplyQuestionVotes: normalizeBoolean(source.agentAutoApplyQuestionVotes, false),
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
  if (Object.hasOwn(input, 'agentAutoApplyQuestionVotes')) {
    const normalized = normalizeBoolean(input.agentAutoApplyQuestionVotes, null);
    if (normalized === null) return { ok: false, reason: 'agent_auto_apply_question_votes_invalid' };
    patch.agentAutoApplyQuestionVotes = normalized;
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
    agentAutoApplyQuestionVotes: normalizeBoolean(
      settings.agentAutoApplyQuestionVotes,
      defaults.agentAutoApplyQuestionVotes
    ),
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
  normalizeTelegramAgentSettingsPatch,
  telegramAgentSettingsKey,
};
