import store from '../../store.js';
import { USE_ONCHAIN_SESSION_REGISTRY } from '../../variables/appConfig.js';
import { resolveSessionConfigFromSources } from '../session/canonicalSessionContext.js';
import { getRegistrySessionConfig } from '../session/sessionRegistryReader.js';
import {
  normalizeSessionSlug,
  resolveActiveSessionSlug,
  resolveSessionConfigAliases,
  resolveSessionSlugFromPathname,
} from '../session/sessionNaming.js';
import { getDemoSessionConfigForDisplay } from '../session/sessionSourceResolver.js';
import { getVerifiedWorkerCanonicalSessionBootstrap } from '../session/sessionWorkerConfigCache.js';
import { parseSessionWorkerDiscoveryQuery } from '../session/sessionWorkerDiscovery.js';

type UnknownRecord = Record<string, unknown>;

const shouldPreferRegistrySessionConfig = () => true;
const asRecord = (value: unknown): UnknownRecord =>
  value && typeof value === 'object' ? (value as UnknownRecord) : {};

const shouldAllowDefaultWorkerDemoFallback = (): boolean => !USE_ONCHAIN_SESSION_REGISTRY;

export const defaultWorkerAuthAllowDemoFallback = (): boolean => shouldAllowDefaultWorkerDemoFallback();

/**
 * Strict demo-fallback policy for security-sensitive callers (uploads, AI, transcription).
 * Matches defaultWorkerAuthAllowDemoFallback semantics — fail-closed in on-chain mode.
 */
export const defaultStrictAllowDemoFallback = (): boolean => shouldAllowDefaultWorkerDemoFallback();

export const defaultCorsProxyAllowDemoFallback = (sessionSlug = ''): boolean => {
  void sessionSlug;
  return shouldAllowDefaultWorkerDemoFallback();
};

export const resolveWorkerAllowDemoFallback = ({
  sessionSlug,
  allowDemoFallback,
  getDefaultAllowDemoFallback,
}: {
  sessionSlug?: unknown;
  allowDemoFallback?: boolean;
  getDefaultAllowDemoFallback?: ((slug: string) => unknown) | null;
} = {}): boolean => {
  const normalizedSlug = normalizeSessionSlug(sessionSlug);
  if (typeof allowDemoFallback === 'boolean') return allowDemoFallback;
  if (typeof getDefaultAllowDemoFallback === 'function') {
    return !!getDefaultAllowDemoFallback(normalizedSlug);
  }
  return shouldAllowDefaultWorkerDemoFallback();
};

export const resolveWorkerSessionConfigBySlug = ({
  sessionSlug,
  allowDemoFallback,
  getDefaultAllowDemoFallback,
}: {
  sessionSlug?: unknown;
  allowDemoFallback?: boolean;
  getDefaultAllowDemoFallback?: ((slug: string) => unknown) | null;
} = {}) => {
  const normalizedSlug = normalizeSessionSlug(sessionSlug);
  if (typeof window !== 'undefined') {
    const search = window.location?.search || '';
    const hasExplicitWorkerDiscovery = new URLSearchParams(search).has('worker');
    if (hasExplicitWorkerDiscovery) {
      try {
        const workerOrigin = parseSessionWorkerDiscoveryQuery(search);
        return getVerifiedWorkerCanonicalSessionBootstrap({ slug: normalizedSlug, workerOrigin });
      } catch {
        return null;
      }
    }
  }
  const resolved = resolveSessionConfigFromSources({
    sessionSlug: normalizedSlug,
    getRegistrySessionConfig,
    preferRegistry: shouldPreferRegistrySessionConfig(),
    allowDemoFallback: false,
  });
  const shouldAllowDemoFallback = resolveWorkerAllowDemoFallback({
    sessionSlug: normalizedSlug,
    allowDemoFallback,
    getDefaultAllowDemoFallback,
  });
  if (resolved.sessionConfig || !shouldAllowDemoFallback) return resolved.sessionConfig;
  return getDemoSessionConfigForDisplay(resolved.sessionSlug);
};

const getActiveSessionSlugFromStore = (): string => {
  if (typeof window !== 'undefined' && new URLSearchParams(window.location?.search || '').has('worker')) {
    const routeSlug = resolveSessionSlugFromPathname(window.location?.pathname || '');
    if (routeSlug !== null) return routeSlug;
  }
  try {
    return resolveActiveSessionSlug(asRecord(store?.getState?.()?.sessionState));
  } catch {
    return '';
  }
};

export const resolveWorkerSessionContext = ({
  sessionSlug,
  sessionConfig,
  allowDemoFallback,
  getDefaultAllowDemoFallback,
}: {
  sessionSlug?: unknown;
  sessionConfig?: unknown;
  allowDemoFallback?: boolean;
  getDefaultAllowDemoFallback?: ((slug: string) => unknown) | null;
} = {}) => {
  return resolveSessionConfigAliases(
    {
      sessionSlug,
      sessionConfig,
    },
    {
      defaults: {
        activeSessionSlug: resolveActiveSessionSlug(asRecord(sessionConfig)) || getActiveSessionSlugFromStore(),
      },
      resolveBySlug: (slug) =>
        resolveWorkerSessionConfigBySlug({
          sessionSlug: slug,
          allowDemoFallback,
          getDefaultAllowDemoFallback,
        }),
    },
  );
};
