import { safeString, lower } from './runtimePrimitives.mjs';
import { RISK_CEILINGS } from './constants.mjs';
import { assertNoSecretShape } from './redaction.mjs';
import { listRegistrySessionsForBridge } from './registrySessions.mjs';
import { normalizeSessionPolicy, resolveSessionInvocation } from './sessionPolicy.mjs';

const RESULTS_EXPOSURE_OVERRIDE_KV_PREFIX = 'telegram:results-exposure:';
const ADMIN_DEFAULT_SESSION_KV_KEY = 'telegram:admin-default-session:v1';

export const RESULTS_EXPOSURE_TOGGLE_FIELDS = Object.freeze({
  published_questions: 'publishedQuestionsEnabled',
  aggregate_results: 'aggregateResultsEnabled',
  anonymized_groups: 'anonymizedGroupsEnabled',
});

function nowIso(now = null) {
  if (now instanceof Date) return now.toISOString();
  if (safeString(now)) return new Date(now).toISOString();
  return new Date().toISOString();
}

function safeJsonParse(value, fallback = null) {
  const text = safeString(value);
  if (!text) return fallback;
  try {
    return JSON.parse(text);
  } catch {
    const dotenvEscaped = text.includes('\\"') ? text.replace(/\\"/g, '"').replace(/\\\\/g, '\\') : '';
    if (dotenvEscaped && dotenvEscaped !== text) {
      try {
        return JSON.parse(dotenvEscaped);
      } catch {
        return fallback;
      }
    }
    return fallback;
  }
}

function sanitizeSessionSlug(value = '') {
  return lower(value).replace(/[^a-z0-9_-]/g, '').slice(0, 128);
}

function normalizeResultBoolean(value, fallback = false) {
  if (value === true || value === false) return value;
  const normalized = lower(value);
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return fallback;
}

function normalizePositiveInteger(value, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return fallback;
  return Math.floor(number);
}

function shortAddress(value = '') {
  const text = safeString(value);
  return /^0x[0-9a-fA-F]{40}$/.test(text) ? `${text.slice(0, 6)}...${text.slice(-4)}` : text;
}

function resultExposureOverrideKey(sessionSlug = '') {
  const slug = sanitizeSessionSlug(sessionSlug);
  return slug ? `${RESULTS_EXPOSURE_OVERRIDE_KV_PREFIX}${slug}` : '';
}

function normalizeResultsExposureOverride(value = {}, base = {}) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const out = {};
  for (const field of Object.values(RESULTS_EXPOSURE_TOGGLE_FIELDS)) {
    if (Object.hasOwn(source, field)) {
      out[field] = normalizeResultBoolean(source[field], base[field] === true);
    }
  }
  if (Object.hasOwn(source, 'minGroupSize')) {
    out.minGroupSize = normalizePositiveInteger(source.minGroupSize, base.minGroupSize || 2);
  }
  return out;
}

export async function readResultsExposureOverride(env = {}, sessionSlug = '') {
  const key = resultExposureOverrideKey(sessionSlug);
  const kv = env?.AGENT_ACTION_KV;
  if (!key || !kv || typeof kv.get !== 'function') return {};
  const parsed = safeJsonParse(await kv.get(key).catch(() => null), null);
  return normalizeResultsExposureOverride(parsed);
}

export async function writeResultsExposureOverride({
  env = {},
  session = {},
  patch = {},
  createdAt = null,
} = {}) {
  const key = resultExposureOverrideKey(session.sessionSlug || session.slug);
  const kv = env?.AGENT_ACTION_KV;
  if (!key || !kv || typeof kv.put !== 'function') return { ok: false, reason: 'action_kv_unavailable' };
  const base = session.resultsExposure || {};
  const current = await readResultsExposureOverride(env, session.sessionSlug || session.slug);
  const next = normalizeResultsExposureOverride({ ...base, ...current, ...patch }, base);
  const record = {
    version: 1,
    sessionSlug: sanitizeSessionSlug(session.sessionSlug || session.slug),
    ...next,
    updatedAt: createdAt || nowIso(),
  };
  assertNoSecretShape(record, 'Telegram results exposure overrides must not serialize secrets.');
  await kv.put(key, JSON.stringify(record));
  return { ok: true, resultsExposure: next };
}

async function applyResultsExposureOverrides(env = {}, policy = {}) {
  const kv = env?.AGENT_ACTION_KV;
  const sessions = Array.isArray(policy.linkedSessions) ? policy.linkedSessions : [];
  if (!kv || typeof kv.get !== 'function' || !sessions.length) return policy;
  const linkedSessions = await Promise.all(sessions.map(async (session) => {
    const override = await readResultsExposureOverride(env, session.sessionSlug);
    if (!Object.keys(override).length) return session;
    return {
      ...session,
      resultsExposure: {
        ...(session.resultsExposure || {}),
        ...override,
      },
    };
  }));
  return { ...policy, linkedSessions };
}

export async function readAdminDefaultSessionOverride(env = {}) {
  const kv = env?.AGENT_ACTION_KV;
  if (!kv || typeof kv.get !== 'function') return {};
  const parsed = safeJsonParse(await kv.get(ADMIN_DEFAULT_SESSION_KV_KEY).catch(() => null), null);
  const sessionSlug = sanitizeSessionSlug(parsed?.sessionSlug);
  if (!sessionSlug) return {};
  return {
    sessionSlug,
    updatedAt: safeString(parsed?.updatedAt).slice(0, 64),
    updatedBy: safeString(parsed?.updatedBy).slice(0, 64),
  };
}

export async function writeAdminDefaultSessionOverride({
  env = {},
  sessionSlug = '',
  accountAddress = '',
  createdAt = null,
} = {}) {
  const kv = env?.AGENT_ACTION_KV;
  if (!kv || typeof kv.put !== 'function') return { ok: false, reason: 'action_kv_unavailable' };
  const slug = sanitizeSessionSlug(sessionSlug);
  if (!slug) return { ok: false, reason: 'invalid_session_slug' };
  const record = {
    version: 1,
    sessionSlug: slug,
    updatedBy: accountAddress ? shortAddress(accountAddress) : '',
    updatedAt: createdAt || nowIso(),
  };
  assertNoSecretShape(record, 'Telegram admin default-session override must not serialize secrets.');
  await kv.put(ADMIN_DEFAULT_SESSION_KV_KEY, JSON.stringify(record));
  return { ok: true, sessionSlug: slug };
}

export async function clearAdminDefaultSessionOverride(env = {}) {
  const kv = env?.AGENT_ACTION_KV;
  if (!kv || typeof kv.delete !== 'function') return { ok: false, reason: 'action_kv_unavailable' };
  await kv.delete(ADMIN_DEFAULT_SESSION_KV_KEY);
  return { ok: true };
}

async function applyAdminDefaultSessionOverride(env = {}, policy = {}) {
  const override = await readAdminDefaultSessionOverride(env);
  const slug = sanitizeSessionSlug(override.sessionSlug);
  if (!slug) return policy;
  const resolved = resolveSessionInvocation(policy, slug);
  if (!resolved.ok) {
    return {
      ...policy,
      adminDefaultSessionSlug: '',
      adminDefaultSessionInvalidSlug: slug,
    };
  }
  return {
    ...policy,
    defaultSessionSlug: resolved.session.sessionSlug,
    adminDefaultSessionSlug: resolved.session.sessionSlug,
    scheduledDefaultSessionSlug: policy.defaultSessionSlug,
  };
}

async function finalizeSessionPolicy(env = {}, normalizedPolicy = {}, {
  includeResultsExposureOverrides = true,
  includeAdminDefaultOverride = true,
} = {}) {
  const withExposure = includeResultsExposureOverrides
    ? await applyResultsExposureOverrides(env, normalizedPolicy)
    : normalizedPolicy;
  return includeAdminDefaultOverride
    ? applyAdminDefaultSessionOverride(env, withExposure)
    : withExposure;
}

export async function loadSessionPolicy(env = {}, {
  forceRefresh = false,
  includeResultsExposureOverrides = true,
  includeAdminDefaultOverride = true,
} = {}) {
  const finalizeOptions = {
    includeResultsExposureOverrides,
    includeAdminDefaultOverride,
  };
  const policyNow = env.AGENT_BRIDGE_SESSION_POLICY_NOW || env.AGENT_BRIDGE_NOW || null;
  const configured = safeJsonParse(env.AGENT_BRIDGE_SESSION_POLICY_JSON, null);
  if (configured && typeof configured === 'object' && !Array.isArray(configured)) {
    return finalizeSessionPolicy(env, normalizeSessionPolicy(configured, { now: policyNow }), finalizeOptions);
  }
  const registry = await listRegistrySessionsForBridge({ env, forceRefresh }).catch((error) => ({
    ok: false,
    reason: 'session_registry_unavailable',
    error: safeString(error?.message || error),
    sessions: [],
  }));
  if (registry.ok && registry.sessions.length) {
    return finalizeSessionPolicy(env, normalizeSessionPolicy({
      defaultSessionSlug: (
        sanitizeSessionSlug(env.AGENT_BRIDGE_DEFAULT_SESSION_SLUG || env.DEFAULT_SESSION_SLUG) ||
        registry.sessions.find((session) => session.default)?.sessionSlug ||
        registry.sessions[0]?.sessionSlug
      ),
      riskCeiling: RISK_CEILINGS.SUBMIT,
      allowQuestionGeneration: true,
      allowGenerateQuestion: true,
      sessions: registry.sessions,
    }, { now: policyNow }), finalizeOptions);
  }
  const defaultSessionSlug = sanitizeSessionSlug(
    env.AGENT_BRIDGE_DEFAULT_SESSION_SLUG ||
    env.DEFAULT_SESSION_SLUG ||
    'general'
  ) || 'general';
  return finalizeSessionPolicy(env, normalizeSessionPolicy({
    defaultSessionSlug,
    riskCeiling: RISK_CEILINGS.SUBMIT,
    allowQuestionGeneration: true,
    allowGenerateQuestion: true,
    sessions: [{
      sessionSlug: defaultSessionSlug,
      sessionName: defaultSessionSlug,
      default: true,
      telegramBridgeEnabled: true,
      managedAccountSubmitAllowed: true,
      sponsoredAiAllowed: true,
      sponsoredRpcAllowed: true,
      sponsoredFaucetAllowed: true,
      sbtJoinModes: ['public', 'password'],
      docLibraryEnabled: true,
    }],
  }, { now: policyNow }), finalizeOptions);
}
