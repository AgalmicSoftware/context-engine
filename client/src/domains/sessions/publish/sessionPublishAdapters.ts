import { arweaveClient as defaultArweaveClient } from '../../../utilities/arweave/arweaveClient.js';
import * as defaultPublishUploadAuth from '../../../utilities/arweave/publishUploadAuth.js';
import * as defaultSponsoredBundles from '../../../utilities/arweave/sponsoredBundles.js';
import * as defaultSessionRegistry from '../../../utilities/web3/sessionRegistry.js';
import * as defaultSbtFactoryReceipt from '../../../utilities/web3/sbtFactoryReceipt.js';
import * as defaultWorkerAuth from '../../../utilities/worker/workerAuth.js';
import { sbtMetadataReadsPort as defaultSbtMetadataReadsPort } from '../../sbts/sbtMetadataReadsPort.js';
import type { ethers } from 'ethers';
import type { SbtProviderRef } from '../../sbts/sbtPorts.js';

type PublishRecord = Record<string, unknown>;

export type ArweaveUploadInput = {
  data: unknown;
  format: string;
  options?: PublishRecord;
};

export type ArweaveGatewayUrlInput = {
  txId: string;
};

export type ResolvePublishArweaveUploadOptions = typeof defaultPublishUploadAuth.resolvePublishArweaveUploadOptions;

export type RegistryContractInput = {
  chainId: unknown;
  providerLike?: ethers.providers.Provider | null;
  options?: { bootstrapRpc?: boolean };
};

export type RegistryRefreshInput = {
  fetchArgs: PublishRecord;
};

export const sessionRegistryPublishAdapter = {
  registerSession: (registerArgs: PublishRecord) => defaultSessionRegistry.registerSessionOnChain(registerArgs),
  getRegistryContract: ({ chainId, providerLike, options }: RegistryContractInput) =>
    defaultSessionRegistry.sessionRegistryUtils.getRegistryContract(chainId, providerLike, options),
  fetchSessionFromRegistry: (fetchArgs: PublishRecord) =>
    defaultSessionRegistry.sessionRegistryUtils.fetchSessionFromRegistry(fetchArgs),
  upsertSessionRegistryCache: (cacheArgs: PublishRecord) =>
    defaultSessionRegistry.sessionRegistryUtils.upsertSessionRegistryCache(cacheArgs),
  refreshRegistryCache: async ({ fetchArgs }: RegistryRefreshInput) => {
    const config = await defaultSessionRegistry.sessionRegistryUtils.fetchSessionFromRegistry(fetchArgs);
    if (config) {
      defaultSessionRegistry.sessionRegistryUtils.upsertSessionRegistryCache({ config });
    }
    return config || null;
  },
  normalizeSlug: (value: unknown) => defaultSessionRegistry.sessionRegistryUtils.normalizeSlug(value),
  formatSessionId: (value: unknown) => defaultSessionRegistry.sessionRegistryUtils.formatSessionId(value),
  normalizeSessionIdHex: (value: unknown) => defaultSessionRegistry.sessionRegistryUtils.normalizeSessionIdHex(value),
  toRegistrySlug: (value: unknown) => defaultSessionRegistry.sessionRegistryUtils.toRegistrySlug(value),
};

export type WorkerAuthPublishModule = {
  normalizeWorkerUrl: (value: unknown) => string;
  buildSignedBootstrapAdminAuth: (input: WorkerBootstrapAdminAuthInput) => Promise<PublishRecord>;
  buildSignedAdminActionAuth: (input: WorkerAdminActionAuthInput) => Promise<PublishRecord>;
};

export type BindWorkerAuthPublishAdapterArgs = {
  workerAuth: () => WorkerAuthPublishModule;
};

export type WorkerBootstrapAdminAuthInput = {
  slug?: string;
  workerUrl?: string;
  statement?: string;
  context?: PublishRecord;
  nonce?: string;
};

export type WorkerAdminActionAuthInput = {
  action?: string;
  slug?: string;
  sessionId?: string;
  sessionAuthorityMode?: string;
  body?: PublishRecord;
  workerUrl?: string;
  context?: PublishRecord;
  nonce?: string;
};

export const bindWorkerAuthPublishAdapter = ({ workerAuth: readWorkerAuth }: BindWorkerAuthPublishAdapterArgs) => ({
  normalizeWorkerUrl: (value: unknown) => readWorkerAuth().normalizeWorkerUrl(value),
  buildSignedBootstrapAdminAuth: (input: WorkerBootstrapAdminAuthInput) =>
    readWorkerAuth().buildSignedBootstrapAdminAuth(input),
  buildSignedAdminActionAuth: (input: WorkerAdminActionAuthInput) => readWorkerAuth().buildSignedAdminActionAuth(input),
});

export type SbtMetadataReadInput = {
  providerName: SbtProviderRef;
  sbtAddress: string;
  groupKeyOrCfg?: unknown;
};

export const arweavePublishAdapter = {
  uploadDataToArweave: ({ data, format, options }: ArweaveUploadInput) =>
    defaultArweaveClient.uploadDataToArweave(data, format, options),
  buildArweaveGatewayUrl: ({ txId }: ArweaveGatewayUrlInput) => defaultArweaveClient.buildArweaveGatewayUrl(txId),
  resolveUploadOptions: (input: Parameters<ResolvePublishArweaveUploadOptions>[0]) =>
    defaultPublishUploadAuth.resolvePublishArweaveUploadOptions(input),
};

export const workerAuthPublishAdapter = bindWorkerAuthPublishAdapter({
  workerAuth: () => defaultWorkerAuth,
});

export const sponsoredBundlePublishAdapter = {
  normalizeSparseSponsoredBundlePayload: (input: unknown) =>
    defaultSponsoredBundles.normalizeSparseSponsoredBundlePayload(input),
  hasSponsoredBundleFields: (input: PublishRecord) => defaultSponsoredBundles.hasSponsoredBundleFields(input),
};

export const sbtFactoryReceiptPublishAdapter = {
  resolveSbtAddressFromFactoryReceipt: ({ receipt }: { receipt: unknown }) =>
    defaultSbtFactoryReceipt.resolveSbtAddressFromFactoryReceipt(receipt),
};

export const sessionPublishSbtMetadataAdapter = {
  getSbtMetadata: ({ providerName, sbtAddress, groupKeyOrCfg }: SbtMetadataReadInput) =>
    defaultSbtMetadataReadsPort.getSbtMetadata(providerName, sbtAddress, groupKeyOrCfg),
};
