export {
  normalizeArweaveUrl,
} from '../arweave/arweaveUrls.js';
export {
  buildSponsoredBundlePlaintext,
  generateSponsoredBundleSecret,
  hasSponsoredBundleFields,
} from '../arweave/sponsoredBundles.js';
import {
  uploadSponsoredBundle as uploadSponsoredBundleImpl,
} from '../arweave/sponsoredBundles.js';
export {
  fetchSessionFromRegistry,
  loadSessionRegistryCache,
  SESSION_REGISTRY_CACHE_UPDATED_EVENT,
  upsertSessionRegistryCache,
} from '../web3/sessionRegistry.js';
import {
  sessionRegistryStore,
  sessionRegistryUtils,
} from '../web3/sessionRegistry.js';
import {
  corsProxyUtils,
} from '../worker/corsProxy.js';
export {
  buildSignedAdminActionAuth,
} from '../worker/workerAuth.js';
import {
  buildSignedBootstrapAdminAuth as buildSignedBootstrapAdminAuthImpl,
} from '../worker/workerAuth.js';
export {
  normalizeWorkerUrl,
} from '../worker/workerUrl.js';

export const getAllSessionRegistryEntries = (): unknown[] => (
  sessionRegistryStore.getAllSessionEntries()
);

export const normalizeSessionIdHex = (value: unknown): string => (
  sessionRegistryUtils.normalizeSessionIdHex(value)
);

export const resolveCorsProxyUrl = (...args: Parameters<typeof corsProxyUtils.resolveCorsProxyUrl>): Promise<{
  url?: unknown;
} | null | undefined> => (
  corsProxyUtils.resolveCorsProxyUrl(...args)
);

type SponsorBootstrapAdminAuthContext = {
  account?: unknown;
  chainId?: unknown;
  provider?: unknown;
  providerLike?: unknown;
};

type SponsorBootstrapAdminAuthInput = {
  slug?: unknown;
  workerUrl?: unknown;
  context?: SponsorBootstrapAdminAuthContext;
  statement?: string;
  nonce?: unknown;
};

type SponsorBootstrapAdminAuthResult = {
  address: string;
  message: string;
  signature: string;
  sessionSlug: string;
};

export const buildSignedBootstrapAdminAuth = (
  input: SponsorBootstrapAdminAuthInput = {},
): Promise<SponsorBootstrapAdminAuthResult> => (
  buildSignedBootstrapAdminAuthImpl(input)
);

export type SponsorUploadSponsoredBundleInput = Parameters<typeof uploadSponsoredBundleImpl>[0];
export type SponsorUploadSponsoredBundleResult = Awaited<ReturnType<typeof uploadSponsoredBundleImpl>>;

export const uploadSponsoredBundle = (
  input: SponsorUploadSponsoredBundleInput = {},
): Promise<SponsorUploadSponsoredBundleResult> => (
  uploadSponsoredBundleImpl(input)
);
