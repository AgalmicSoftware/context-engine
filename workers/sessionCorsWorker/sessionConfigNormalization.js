import { normalizeWorkerSessionSlug } from './sessionSlugResolution.js';
import { trimIfString } from './stringCoercion.js';
import { normalizeWorkerSessionAppearance } from '../shared/sessionColorSchemeConfig.mjs';

const toStr = (value) => (typeof value === 'string' ? value : value == null ? '' : String(value));
const isObj = (value) => !!value && typeof value === 'object' && !Array.isArray(value);
const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value || {}, key);
const normalizeEmbeddedDeployHelperEnabled = (raw) => {
  if (raw == null) return true;
  if (typeof raw === 'boolean') return raw;
  return null;
};

const cloneValue = (value) => {
  if (Array.isArray(value)) return value.map((entry) => cloneValue(entry));
  if (isObj(value)) {
    return Object.keys(value).reduce((acc, key) => {
      acc[key] = cloneValue(value[key]);
      return acc;
    }, {});
  }
  return trimIfString(value);
};

const appendListEntries = (target, raw) => {
  if (Array.isArray(raw)) {
    raw.forEach((entry) => appendListEntries(target, entry));
    return;
  }
  const value = toStr(raw).trim();
  if (!value) return;
  value
    .split(/[\n,]+/)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .forEach((entry) => target.push(entry));
};

export const normalizeWorkerAllowOrigins = (raw) => {
  const entries = [];
  appendListEntries(entries, raw);
  const seen = new Set();
  return entries.filter((entry) => {
    if (seen.has(entry)) return false;
    seen.add(entry);
    return true;
  });
};

export const normalizeWorkerRpcUrlsByChainId = (raw) => {
  if (!isObj(raw)) return {};
  return Object.keys(raw).reduce((acc, key) => {
    const urls = normalizeWorkerAllowOrigins(raw[key]);
    if (urls.length) acc[key] = urls;
    return acc;
  }, {});
};

export const normalizeWorkerConfigRecord = (raw, { slug } = {}) => {
  if (!isObj(raw)) return null;

  const normalized = cloneValue(raw);
  const normalizedSlug = normalizeWorkerSessionSlug(slug);
  if (hasOwn(normalized, 'slug')) {
    normalized.slug = normalizedSlug || normalizeWorkerSessionSlug(normalized.slug);
  }
  if (hasOwn(normalized, 'allowOrigins')) {
    normalized.allowOrigins = normalizeWorkerAllowOrigins(normalized.allowOrigins);
  }
  if (hasOwn(normalized, 'limits')) {
    normalized.limits = isObj(normalized.limits) ? cloneValue(normalized.limits) : {};
  }
  if (hasOwn(normalized, 'scopes')) {
    normalized.scopes = isObj(normalized.scopes) ? cloneValue(normalized.scopes) : {};
  }
  if (hasOwn(normalized, 'faucet')) {
    normalized.faucet = isObj(normalized.faucet) ? cloneValue(normalized.faucet) : {};
  }
  if (hasOwn(normalized, 'rpcUrlsByChainId')) {
    normalized.rpcUrlsByChainId = normalizeWorkerRpcUrlsByChainId(normalized.rpcUrlsByChainId);
  }
  if (hasOwn(normalized, 'appearance')) {
    const appearance = normalizeWorkerSessionAppearance(normalized.appearance);
    if (appearance) normalized.appearance = appearance;
    else delete normalized.appearance;
  }
  delete normalized.theme;
  const embeddedDeployHelperEnabledRaw = hasOwn(normalized, 'embeddedDeployHelperEnabled')
    ? normalized.embeddedDeployHelperEnabled
    : (hasOwn(normalized, 'deployHelperEnabled') ? normalized.deployHelperEnabled : undefined);
  if (embeddedDeployHelperEnabledRaw !== undefined) {
    const embeddedDeployHelperEnabled = normalizeEmbeddedDeployHelperEnabled(embeddedDeployHelperEnabledRaw);
    if (embeddedDeployHelperEnabled === null) {
      delete normalized.embeddedDeployHelperEnabled;
    } else {
      normalized.embeddedDeployHelperEnabled = embeddedDeployHelperEnabled;
    }
  }
  delete normalized.deployHelperEnabled;

  return normalized;
};

export const mergeWorkerConfigRecords = ({
  existingConfig,
  incomingConfig,
  slug,
} = {}) => {
  const existing = normalizeWorkerConfigRecord(existingConfig, { slug }) || {};
  const incoming = isObj(incomingConfig) ? cloneValue(incomingConfig) : {};
  const merged = {
    ...existing,
    ...incoming,
  };

  merged.limits = {
    ...(isObj(existing.limits) ? existing.limits : {}),
    ...(isObj(incoming.limits) ? cloneValue(incoming.limits) : {}),
  };
  merged.scopes = {
    ...(isObj(existing.scopes) ? existing.scopes : {}),
    ...(isObj(incoming.scopes) ? cloneValue(incoming.scopes) : {}),
  };

  return normalizeWorkerConfigRecord(merged, { slug }) || {};
};

export const mergeWorkerLimitRecords = ({
  existingConfig,
  incomingLimits,
  slug,
} = {}) => {
  const existing = normalizeWorkerConfigRecord(existingConfig, { slug }) || {};
  return normalizeWorkerConfigRecord({
    ...existing,
    limits: {
      ...(isObj(existing.limits) ? existing.limits : {}),
      ...(isObj(incomingLimits) ? cloneValue(incomingLimits) : {}),
    },
  }, { slug }) || {};
};
