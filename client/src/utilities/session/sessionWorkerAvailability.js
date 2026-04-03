import {
  CLOUDFLARE_CORS_WORKER_URL,
  USE_ONCHAIN_SESSION_REGISTRY,
} from '../../variables/appConfig.js';
import { canonicalizeSessionSlug } from './canonicalSessionContext.js';
import { overlayCachedSessionWorkerConfig } from './sessionWorkerConfigCache.js';
import { parseWorkerConfig } from './sessionParsers.js';
import { normalizeWorkerUrl } from '../worker/workerUrl.js';

const isObj = (value) => !!value && typeof value === 'object' && !Array.isArray(value);

export const getConfiguredSessionWorkerUrlFromConfig = (sessionConfig = null) => {
  const parsed = parseWorkerConfig(sessionConfig);
  const canonicalUrl = normalizeWorkerUrl(parsed?.config?.corsWorkerUrl || '');
  return canonicalUrl;
};

export const resolveConfiguredSessionWorkerUrlFromConfig = (
  sessionConfig = null
) => getConfiguredSessionWorkerUrlFromConfig(sessionConfig);

export const getSharedFallbackWorkerUrl = () => {
  return normalizeWorkerUrl(CLOUDFLARE_CORS_WORKER_URL);
};

export const shouldUseSharedFallbackWorkerUrl = ({
  slug,
  sessionConfig,
} = {}) => {
  const normalizedSlug = canonicalizeSessionSlug(slug ?? sessionConfig?.slug ?? '');
  if (normalizedSlug !== '') return false;
  if (!USE_ONCHAIN_SESSION_REGISTRY) return false;
  const baseConfig = isObj(sessionConfig) ? sessionConfig : null;
  if (!baseConfig) return false;
  if (resolveConfiguredSessionWorkerUrlFromConfig(baseConfig)) {
    return false;
  }
  return !isObj(baseConfig.__registry);
};

const getEffectiveSessionWorkerConfig = ({
  slug,
  sessionConfig,
} = {}) => {
  const normalizedSlug = canonicalizeSessionSlug(slug ?? sessionConfig?.slug ?? '');
  const baseConfig = sessionConfig && typeof sessionConfig === 'object' ? sessionConfig : null;
  return overlayCachedSessionWorkerConfig({
    slug: normalizedSlug,
    sessionConfig: baseConfig,
  }) || baseConfig;
};

export const getUsableSessionWorkerUrl = ({
  slug,
  sessionConfig,
  allowSharedFallback = false,
} = {}) => {
  const normalizedSlug = canonicalizeSessionSlug(slug ?? sessionConfig?.slug ?? '');
  const effectiveSessionConfig = getEffectiveSessionWorkerConfig({
    slug: normalizedSlug,
    sessionConfig,
  });
  const configuredUrl = shouldUseSharedFallbackWorkerUrl({
    slug: normalizedSlug,
    sessionConfig: effectiveSessionConfig,
  })
    ? ''
    : resolveConfiguredSessionWorkerUrlFromConfig(effectiveSessionConfig);
  if (configuredUrl) return configuredUrl;
  if (allowSharedFallback && normalizedSlug === '') {
    return getSharedFallbackWorkerUrl();
  }
  return '';
};

export const hasUsableSessionWorkerConfig = ({
  slug,
  sessionConfig,
  allowSharedFallback = true,
} = {}) => {
  const normalizedSlug = canonicalizeSessionSlug(slug ?? sessionConfig?.slug ?? '');
  return getUsableSessionWorkerUrl({
    slug: normalizedSlug,
    sessionConfig,
    allowSharedFallback,
  }).length > 0;
};
