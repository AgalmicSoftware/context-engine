import { checkSponsoredAccess } from '../../utilities/web3/sponsoredAccess.js';
import { refreshSessionRegistryFieldsCache } from '../../utilities/web3/sessionRegistry.js';
import { resolveSessionCapabilityProjection } from '../../utilities/session/sessionCapabilityProjection';
import { readWorkerResourcePresence, type WorkerResourcePresence } from '../../utilities/worker/workerResourcePresence';

type RegistrySessionReference = {
  registryChainId?: unknown;
  sessionIdHex?: unknown;
};

type SponsoredAccessSessionConfig = Record<string, unknown> & {
  networkChainId?: unknown;
  chainId?: unknown;
  sessionId?: unknown;
  __registry?: RegistrySessionReference | null;
};

const isSponsoredAccessSessionConfig = (value: unknown): value is SponsoredAccessSessionConfig =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export type LoginSettingsSponsoredAccessResult = {
  accessMap: Record<'ai' | 'arweave' | 'rpc' | 'txGas', unknown>;
  workerResourcePresence: WorkerResourcePresence | null;
};

const SPONSORED_RESOURCE_KEYS = ['ai', 'arweave', 'rpc', 'txGas'] as const;
type SponsoredResourceKey = (typeof SPONSORED_RESOURCE_KEYS)[number];

const isSponsoredResourceKey = (value: string): value is SponsoredResourceKey =>
  SPONSORED_RESOURCE_KEYS.includes(value as SponsoredResourceKey);

export const loadLoginSettingsSponsoredAccess = async ({
  slug,
  sessionConfig,
  account,
  providerLike,
  includeWorkerResourcePresence = true,
}: {
  slug: string;
  sessionConfig: SponsoredAccessSessionConfig;
  account: string;
  providerLike?: unknown;
  fallbackChainId?: unknown;
  includeWorkerResourcePresence?: boolean;
}): Promise<LoginSettingsSponsoredAccessResult> => {
  let cfg = sessionConfig || {};
  let capabilities = resolveSessionCapabilityProjection(cfg);
  const chainId = Number(capabilities.chainId || 0);
  if (slug && chainId && capabilities.isRegistryCanonical) {
    try {
      const refreshed = await refreshSessionRegistryFieldsCache({
        chainId,
        slug,
        sessionId: cfg.sessionId || cfg.__registry?.sessionIdHex || null,
        providerLike: providerLike || null,
      });
      if (isSponsoredAccessSessionConfig(refreshed)) {
        cfg = refreshed;
        capabilities = resolveSessionCapabilityProjection(cfg);
      }
    } catch {
      // Preserve the existing registry snapshot when a targeted refresh is unavailable.
    }
  }

  const resourceKeys = capabilities.settingsResourceKeys.filter(isSponsoredResourceKey);
  const canReadWorkerPresence =
    includeWorkerResourcePresence && (capabilities.profileValid || capabilities.source === 'legacy_registry');
  const workerChainId = Number(capabilities.chainId || 0);
  const [results, workerResourcePresence] = await Promise.all([
    Promise.all(
      resourceKeys.map((resourceKey) =>
        checkSponsoredAccess({ sessionConfig: cfg, sessionSlug: slug, account, resourceKey }),
      ),
    ),
    canReadWorkerPresence
      ? readWorkerResourcePresence({
          sessionConfig: cfg,
          sessionSlug: slug,
          context: { account, providerLike: providerLike || null, chainId: workerChainId || null },
        })
      : Promise.resolve(null),
  ]);
  const accessMap: LoginSettingsSponsoredAccessResult['accessMap'] = {
    ai: null,
    arweave: null,
    rpc: null,
    txGas: null,
  };
  resourceKeys.forEach((resourceKey, index) => {
    accessMap[resourceKey] = results[index];
  });

  return {
    accessMap,
    workerResourcePresence,
  };
};
