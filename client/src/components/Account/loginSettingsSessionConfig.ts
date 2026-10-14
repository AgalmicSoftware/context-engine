import { readKnownSessionCatalog } from '../../utilities/session/sessionCatalog';
import {
  fetchWorkerCanonicalSessionBootstrap,
  parseSessionWorkerDiscoveryOrigin,
  parseSessionWorkerDiscoveryQuery,
  resolveWorkerCanonicalSessionIdHex,
} from '../../utilities/session/sessionWorkerDiscovery';
import {
  getVerifiedWorkerCanonicalSessionBootstrap,
  markWorkerCanonicalSessionBootstrapVerified,
  upsertWorkerCanonicalSessionBootstrap,
} from '../../utilities/session/sessionWorkerConfigCache';

type Config = Record<string, unknown>;

export const resolveLoginSettingsSessionConfig = async (slug: string, config: Config): Promise<Config> => {
  if (!config.workerCanonicalCleanRoute && !config.__unresolved && Object.keys(config).length) return config;
  const entry = readKnownSessionCatalog().find((item) => item.slug === slug);
  const origin =
    config.workerCanonicalCleanRoute && config.corsWorkerUrl
      ? parseSessionWorkerDiscoveryOrigin(config.corsWorkerUrl)
      : entry?.kind === 'centralized'
        ? parseSessionWorkerDiscoveryQuery(new URL(entry.href, window.location.origin).search)
        : '';
  if (!origin) return config;
  const expectedId = resolveWorkerCanonicalSessionIdHex(config);
  const checkIdentity = (sessionId: string) => {
    if (expectedId && expectedId !== sessionId)
      throw new Error('Session Worker identity does not match the directory.');
  };
  const cached = getVerifiedWorkerCanonicalSessionBootstrap({ slug, workerOrigin: origin });
  if (cached) {
    checkIdentity(resolveWorkerCanonicalSessionIdHex(cached));
    return cached;
  }

  // Directory records locate the Worker but cannot establish sponsorship or
  // access. Validate its full config and keep the existing identity pin intact.
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const bootstrap = await fetchWorkerCanonicalSessionBootstrap({
      sessionSlug: slug,
      workerQueryValue: origin,
      signal: controller.signal,
    });
    checkIdentity(bootstrap.sessionId);
    const identity = { slug, sessionIdHex: bootstrap.sessionId, workerOrigin: origin };
    const result = upsertWorkerCanonicalSessionBootstrap({
      ...identity,
      configRevision: bootstrap.configRevision,
      config: bootstrap.config,
      allowRepin: false,
    });
    if (result.status !== 'cached' || !markWorkerCanonicalSessionBootstrapVerified(identity)) {
      throw new Error('Session Worker identity could not be verified. Open the session to review it.');
    }
    return bootstrap.config;
  } finally {
    clearTimeout(timeout);
  }
};
