import { arweaveClient as defaultArweaveClient } from '../../../utilities/arweave/arweaveClient.js';
import { resolvePublishArweaveUploadOptions as defaultResolvePublishArweaveUploadOptions } from '../../../utilities/arweave/publishUploadAuth.js';
import * as defaultSponsoredBundles from '../../../utilities/arweave/sponsoredBundles.js';
import * as defaultSessionRegistry from '../../../utilities/web3/sessionRegistry.js';
import * as defaultSbtFactoryReceipt from '../../../utilities/web3/sbtFactoryReceipt.js';
import * as defaultWorkerAuth from '../../../utilities/worker/workerAuth.js';
import { sbtMetadataReadsPort as defaultSbtMetadataReadsPort } from '../../sbts/sbtMetadataReadsPort.js';
import type { ethers } from 'ethers';
import type { SbtMetadataReadsPort, SbtProviderRef } from '../../sbts/sbtPorts.js';

type PublishRecord = Record<string, unknown>;

export type ArweavePublishScripts = {
  uploadDataToArweave: (data: unknown, format: string, options?: PublishRecord) => Promise<string | undefined>;
  buildArweaveGatewayUrl: (txId: string) => string;
};

export type ArweaveUploadInput = {
  data: unknown;
  format: string;
  options?: PublishRecord;
};

export type ArweaveGatewayUrlInput = {
  txId: string;
};

export type ResolvePublishArweaveUploadOptions = typeof defaultResolvePublishArweaveUploadOptions;

export type BindArweavePublishAdapterArgs = {
  arweaveClient: () => ArweavePublishScripts;
  resolveUploadOptions?: ResolvePublishArweaveUploadOptions;
};

export const bindArweavePublishAdapter = ({
  arweaveClient: readArweaveClient,
  resolveUploadOptions = defaultResolvePublishArweaveUploadOptions,
}: BindArweavePublishAdapterArgs) => ({
  uploadDataToArweave: ({ data, format, options }: ArweaveUploadInput) =>
    readArweaveScripts().uploadDataToArweave(data, format, options),
  buildArweaveGatewayUrl: ({ txId }: ArweaveGatewayUrlInput) => readArweaveScripts().buildArweaveGatewayUrl(txId),
  resolveUploadOptions: (input: Parameters<ResolvePublishArweaveUploadOptions>[0]) => resolveUploadOptions(input),
});

export type SessionRegistryPublishUtils = {
  getRegistryContract: (
    chainId: unknown,
    providerLike?: ethers.providers.Provider | null,
    options?: { bootstrapRpc?: boolean },
  ) => unknown;
  fetchSessionFromRegistry: (input: PublishRecord) => Promise<PublishRecord | null | undefined>;
  upsertSessionRegistryCache: (input: PublishRecord) => unknown;
  normalizeSlug: (value: unknown) => string;
  formatSessionId: (value: unknown) => string;
  normalizeSessionIdHex: (value: unknown) => string;
  toRegistrySlug: (value: unknown) => string;
};

export type SessionRegistryPublishModule = {
  registerSessionOnChain: (input: PublishRecord) => Promise<PublishRecord | null | undefined>;
  sessionRegistryUtils: SessionRegistryPublishUtils;
};

export type RegistryContractInput = {
  chainId: unknown;
  providerLike?: ethers.providers.Provider | null;
  options?: { bootstrapRpc?: boolean };
};

export type RegistryRefreshInput = {
  fetchArgs: PublishRecord;
};

export type BindSessionRegistryPublishAdapterArgs = {
  sessionRegistry: () => SessionRegistryPublishModule;
};

export const bindSessionRegistryPublishAdapter = ({
  sessionRegistry: readSessionRegistry,
}: BindSessionRegistryPublishAdapterArgs) => ({
  registerSession: (registerArgs: PublishRecord) => readSessionRegistry().registerSessionOnChain(registerArgs),
  getRegistryContract: ({ chainId, providerLike, options }: RegistryContractInput) =>
    readSessionRegistry().sessionRegistryUtils.getRegistryContract(chainId, providerLike, options),
  fetchSessionFromRegistry: (fetchArgs: PublishRecord) =>
    readSessionRegistry().sessionRegistryUtils.fetchSessionFromRegistry(fetchArgs),
  upsertSessionRegistryCache: (cacheArgs: PublishRecord) =>
    readSessionRegistry().sessionRegistryUtils.upsertSessionRegistryCache(cacheArgs),
  refreshRegistryCache: async ({ fetchArgs }: RegistryRefreshInput) => {
    const config = await readSessionRegistry().sessionRegistryUtils.fetchSessionFromRegistry(fetchArgs);
    if (config) {
      readSessionRegistry().sessionRegistryUtils.upsertSessionRegistryCache({ config });
    }
    return config || null;
  },
  normalizeSlug: (value: unknown) => readSessionRegistry().sessionRegistryUtils.normalizeSlug(value),
  formatSessionId: (value: unknown) => readSessionRegistry().sessionRegistryUtils.formatSessionId(value),
  normalizeSessionIdHex: (value: unknown) => readSessionRegistry().sessionRegistryUtils.normalizeSessionIdHex(value),
  toRegistrySlug: (value: unknown) => readSessionRegistry().sessionRegistryUtils.toRegistrySlug(value),
});

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

export type SponsoredBundlePublishModule = {
  normalizeSparseSponsoredBundlePayload: (input: unknown) => PublishRecord;
  hasSponsoredBundleFields: (input: PublishRecord) => boolean;
};

export type BindSponsoredBundlePublishAdapterArgs = {
  sponsoredBundles: () => SponsoredBundlePublishModule;
};

export const bindSponsoredBundlePublishAdapter = ({
  sponsoredBundles: readSponsoredBundles,
}: BindSponsoredBundlePublishAdapterArgs) => ({
  normalizeSparseSponsoredBundlePayload: (input: unknown) =>
    readSponsoredBundles().normalizeSparseSponsoredBundlePayload(input),
  hasSponsoredBundleFields: (input: PublishRecord) => readSponsoredBundles().hasSponsoredBundleFields(input),
});

export type SbtFactoryReceiptModule = {
  resolveSbtAddressFromFactoryReceipt: (receipt: unknown) => string;
};

export type BindSbtFactoryReceiptPublishAdapterArgs = {
  sbtFactoryReceipt: () => SbtFactoryReceiptModule;
};

export const bindSbtFactoryReceiptPublishAdapter = ({
  sbtFactoryReceipt: readSbtFactoryReceipt,
}: BindSbtFactoryReceiptPublishAdapterArgs) => ({
  resolveSbtAddressFromFactoryReceipt: ({ receipt }: { receipt: unknown }) =>
    readSbtFactoryReceipt().resolveSbtAddressFromFactoryReceipt(receipt),
});

export type SbtMetadataReadInput = {
  providerName: SbtProviderRef;
  sbtAddress: string;
  groupKeyOrCfg?: unknown;
};

export type BindSessionPublishSbtMetadataAdapterArgs = {
  metadataReadsPort: () => SbtMetadataReadsPort;
};

export const bindSessionPublishSbtMetadataAdapter = ({
  metadataReadsPort: readMetadataReadsPort,
}: BindSessionPublishSbtMetadataAdapterArgs) => ({
  getSbtMetadata: ({ providerName, sbtAddress, groupKeyOrCfg }: SbtMetadataReadInput) =>
    readMetadataReadsPort().getSbtMetadata(providerName, sbtAddress, groupKeyOrCfg),
});

export const arweavePublishAdapter = bindArweavePublishAdapter({
  arweaveClient: () => defaultArweaveClient,
});

export const sessionRegistryPublishAdapter = bindSessionRegistryPublishAdapter({
  sessionRegistry: () => defaultSessionRegistry,
});

export const workerAuthPublishAdapter = bindWorkerAuthPublishAdapter({
  workerAuth: () => defaultWorkerAuth,
});

export const sponsoredBundlePublishAdapter = bindSponsoredBundlePublishAdapter({
  sponsoredBundles: () => defaultSponsoredBundles,
});

export const sbtFactoryReceiptPublishAdapter = bindSbtFactoryReceiptPublishAdapter({
  sbtFactoryReceipt: () => defaultSbtFactoryReceipt,
});

export const sessionPublishSbtMetadataAdapter = bindSessionPublishSbtMetadataAdapter({
  metadataReadsPort: () => defaultSbtMetadataReadsPort,
});
