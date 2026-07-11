import { checkSponsoredAccess } from '../../utilities/web3/sponsoredAccess.js';
import { refreshSessionRegistryFieldsCache } from '../../utilities/web3/sessionRegistry.js';
import {
  readWorkerResourcePresence,
  type WorkerResourcePresence,
} from '../../utilities/worker/workerResourcePresence';

type UnknownRecord = Record<string, any>;

export type LoginSettingsSponsoredAccessResult = {
  accessMap: Record<'ai' | 'arweave' | 'rpc' | 'txGas', unknown>;
  workerResourcePresence: WorkerResourcePresence | null;
};

export const loadLoginSettingsSponsoredAccess = async ({
  slug,
  sessionConfig,
  account,
  providerLike,
  fallbackChainId,
  includeWorkerResourcePresence = true,
}: {
  slug: string;
  sessionConfig: UnknownRecord;
  account: string;
  providerLike?: unknown;
  fallbackChainId?: unknown;
  includeWorkerResourcePresence?: boolean;
}): Promise<LoginSettingsSponsoredAccessResult> => {
  let cfg = sessionConfig || {};
  const chainId = Number(
    cfg.networkChainId || cfg.chainId || cfg.__registry?.registryChainId || fallbackChainId || 0,
  );
  if (slug && chainId) {
    try {
      const refreshed = await refreshSessionRegistryFieldsCache({
        chainId,
        slug,
        sessionId: cfg.sessionId || cfg.__registry?.sessionIdHex || null,
        providerLike: providerLike || null,
      });
      if (refreshed) cfg = refreshed;
    } catch {
      // Preserve the existing registry snapshot when a targeted refresh is unavailable.
    }
  }

  const resourceKeys = ['ai', 'arweave', 'rpc', 'txGas'] as const;
  const [results, workerResourcePresence] = await Promise.all([
    Promise.all(
      resourceKeys.map((resourceKey) =>
        checkSponsoredAccess({ sessionConfig: cfg, sessionSlug: slug, account, resourceKey }),
      ),
    ),
    includeWorkerResourcePresence
      ? readWorkerResourcePresence({
          sessionConfig: cfg,
          sessionSlug: slug,
          context: { account, providerLike: providerLike || null, chainId: chainId || null },
        })
      : Promise.resolve(null),
  ]);

  return {
    accessMap: { ai: results[0], arweave: results[1], rpc: results[2], txGas: results[3] },
    workerResourcePresence,
  };
};
