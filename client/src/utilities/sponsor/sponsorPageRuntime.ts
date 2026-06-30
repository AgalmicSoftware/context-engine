export {
  normalizeArweaveUrl,
} from '../arweave/arweaveUrls.js';
export {
  buildSponsoredBundlePlaintext,
  generateSponsoredBundleSecret,
  hasSponsoredBundleFields,
  uploadSponsoredBundle,
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
  buildSignedBootstrapAdminAuth,
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
