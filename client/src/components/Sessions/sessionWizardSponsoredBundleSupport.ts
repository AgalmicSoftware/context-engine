import { normalizeSparseSponsoredBundlePayload } from '../../utilities/arweave/sponsoredBundles.js';
import { upsertCachedSessionWorkerConfig } from '../../utilities/session/sessionWorkerConfigCache.js';
import { normalizeWorkerUrl as normalizeWorkerAuthUrl } from '../../utilities/worker/workerAuth.js';
import { toStr } from '../../utilities/shared/primitives.js';
import { shouldCacheSessionWorkerConfigAfterDeploy } from './sessionWizardWorkerState';
import type { AnyRecord, WorkerSecretsLike } from '../shellTypes';

type SponsoredBundleLike = AnyRecord & {
  meta?: AnyRecord;
};
type SponsoredBundleInput = SponsoredBundleLike | null | undefined;

export const resolveSponsoredBundleBootstrapWorkerUrl = (bundle: SponsoredBundleInput = {}): string =>
  normalizeWorkerAuthUrl(toStr(bundle?.bootstrapWorkerUrl || bundle?.meta?.sourceWorkerUrl || '').trim());

export const buildSponsoredBundleAppliedStatusMessage = (sponsoredBundle: SponsoredBundleInput = {}): string => {
  const normalizedBundle = normalizeSparseSponsoredBundlePayload(sponsoredBundle) as SponsoredBundleLike;
  const appliedLabels = [];
  if (toStr(normalizedBundle?.openaiKey).trim()) appliedLabels.push('OpenAI key');
  if (toStr(normalizedBundle?.arweaveJwk).trim()) appliedLabels.push('Arweave wallet');
  if (toStr(normalizedBundle?.faucetPrivateKey).trim() || toStr(normalizedBundle?.faucetGrantToken).trim()) {
    appliedLabels.push('faucet funding');
  }
  if (toStr(normalizedBundle?.customRpcUrl).trim()) appliedLabels.push('RPC URL');
  if (
    toStr(normalizedBundle?.litApiBase).trim() ||
    toStr(normalizedBundle?.litGroupId).trim() ||
    toStr(normalizedBundle?.litPkpId).trim() ||
    toStr(normalizedBundle?.litActionCid).trim()
  ) {
    appliedLabels.push('Lit Chipotle config');
  }
  if (toStr(normalizedBundle?.litAccountApiKey).trim()) appliedLabels.push('Lit API key');
  if (toStr(normalizedBundle?.litUsageApiKey).trim()) appliedLabels.push('Lit usage key');
  if (toStr(normalizedBundle?.deployGrantToken).trim()) appliedLabels.push('deploy access');
  return appliedLabels.length
    ? `Sponsored resources applied: ${appliedLabels.join(', ')}.`
    : 'Sponsored resources applied.';
};

export const resolveSponsoredBundleAdvancedFieldNotices = ({
  sponsoredBundle = {},
  workerSecrets = {},
  deployForm = {},
}: {
  sponsoredBundle?: SponsoredBundleInput;
  workerSecrets?: WorkerSecretsLike | AnyRecord;
  deployForm?: AnyRecord;
} = {}) => {
  const normalizedBundle = normalizeSparseSponsoredBundlePayload(sponsoredBundle) as SponsoredBundleLike;
  const sponsoredFaucetPrivateKey = toStr(normalizedBundle?.faucetPrivateKey || '').trim();
  const sponsoredFaucetGrantToken = toStr(normalizedBundle?.faucetGrantToken || '').trim();
  const currentFaucetPrivateKey = toStr(workerSecrets?.faucetPrivateKey || '').trim();
  return {
    showSponsoredFaucetNotice:
      !!(sponsoredFaucetPrivateKey || sponsoredFaucetGrantToken) &&
      (sponsoredFaucetPrivateKey ? currentFaucetPrivateKey === sponsoredFaucetPrivateKey : !currentFaucetPrivateKey),
    showSponsoredDeployAccessNotice:
      !!toStr(normalizedBundle?.deployGrantToken || '').trim() && !toStr(deployForm?.apiToken || '').trim(),
  };
};

export const cacheSessionWorkerConfigAfterDeploy = ({
  deployStatusCode,
  deployPartial,
  configSyncStatus,
  workerUrl,
  slug,
  sessionIdHex,
  registryChainId,
  config,
}: {
  deployStatusCode?: unknown;
  deployPartial?: unknown;
  configSyncStatus?: AnyRecord | null;
  workerUrl?: unknown;
  slug?: unknown;
  sessionIdHex?: unknown;
  registryChainId?: unknown;
  config?: AnyRecord | null;
} = {}) => {
  if (
    !shouldCacheSessionWorkerConfigAfterDeploy({
      deployStatusCode,
      deployPartial,
      configSyncStatus,
      workerUrl,
    })
  ) {
    return false;
  }
  upsertCachedSessionWorkerConfig({
    slug,
    sessionIdHex,
    registryChainId,
    config,
  });
  return true;
};
