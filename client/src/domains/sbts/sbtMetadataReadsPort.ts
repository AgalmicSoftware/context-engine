import { ethers } from 'ethers';
import chainGateway from '../../utilities/web3/contractScripts.js';
import type {
  SbtGroupKeyOrConfig,
  SbtMetadataReadsPort,
  SbtMetadataRecord,
  SbtOnChainConfig,
  SbtOnChainConfigFields,
  SbtProviderRef,
  SbtReadOptions,
} from './sbtPorts.js';

const SBT_ON_CHAIN_CONFIG_ABI = [
  'function maxTokens() view returns (uint256)',
  'function collectionBurnAuth() view returns (uint8)',
  'function mintingEndTime() view returns (uint256)',
  'function hasPasswordMint() view returns (bool)',
  'function admin() view returns (address)',
  'function owner() view returns (address)',
];

type SbtOnChainConfigContract = {
  maxTokens: () => Promise<unknown>;
  collectionBurnAuth: () => Promise<unknown>;
  mintingEndTime: () => Promise<unknown>;
  hasPasswordMint: () => Promise<unknown>;
  admin: () => Promise<unknown>;
  owner: () => Promise<unknown>;
};

type CreateSbtOnChainConfigContract = (
  sbtAddress: string,
  abi: string[],
  provider: ethers.providers.Provider,
) => SbtOnChainConfigContract;

type SbtMetadataReadsChainGateway = {
  getSbtMetadata: (
    providerName: SbtProviderRef,
    sbtAddress: string,
    groupKeyOrCfg?: SbtGroupKeyOrConfig,
  ) => Promise<SbtMetadataRecord | null | undefined>;
  getMintedTokens: (
    providerName: SbtProviderRef,
    sbtAddress: string,
    groupKeyOrCfg?: SbtGroupKeyOrConfig,
    options?: SbtReadOptions,
  ) => Promise<unknown>;
  getGroupPasswordHash: (
    providerName: SbtProviderRef,
    sbtAddress: string,
    groupKeyOrCfg?: SbtGroupKeyOrConfig,
    options?: SbtReadOptions,
  ) => Promise<string | null>;
  getSbtCreationBlockByAddress: (
    providerName: SbtProviderRef,
    sbtAddress: string,
    groupKeyOrCfg?: SbtGroupKeyOrConfig,
    options?: SbtReadOptions,
  ) => Promise<number | null>;
  getReadProviderForGroup?: (
    groupKeyOrCfg?: SbtGroupKeyOrConfig,
    options?: { contractKey?: string },
  ) => ethers.providers.Provider;
};

type BindSbtMetadataReadsPortArgs = {
  chainGateway: () => SbtMetadataReadsChainGateway;
  createOnChainConfigContract?: CreateSbtOnChainConfigContract;
};

type ResolvedSbtOnChainConfigFields = Required<SbtOnChainConfigFields>;

const createEthersSbtOnChainConfigContract: CreateSbtOnChainConfigContract = (sbtAddress, abi, provider) => {
  const contract = new ethers.Contract(sbtAddress, abi, provider);
  return {
    maxTokens: () => contract.maxTokens(),
    collectionBurnAuth: () => contract.collectionBurnAuth(),
    mintingEndTime: () => contract.mintingEndTime(),
    hasPasswordMint: () => contract.hasPasswordMint(),
    admin: () => contract.admin(),
    owner: () => contract.owner(),
  };
};

const withSoftReadTimeout = <T>(
  task: Promise<T>,
  fallbackValue: T | null = null,
  timeoutMs: number = 750,
): Promise<T | null> =>
  new Promise((resolve) => {
    let settled = false;
    let timer: ReturnType<typeof setTimeout>;
    const finish = (value: T | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(value);
    };
    timer = setTimeout(() => finish(fallbackValue), timeoutMs);
    task.then((value) => finish(value)).catch(() => finish(fallbackValue));
  });

const resolveSbtOnChainConfigFields = (fields?: SbtOnChainConfigFields): ResolvedSbtOnChainConfigFields => {
  if (!fields) {
    return {
      maxTokens: true,
      collectionBurnAuth: true,
      mintingEndTime: true,
      hasPasswordMint: true,
      adminAndOwner: true,
    };
  }
  return {
    maxTokens: !!fields.maxTokens,
    collectionBurnAuth: !!fields.collectionBurnAuth,
    mintingEndTime: !!fields.mintingEndTime,
    hasPasswordMint: !!fields.hasPasswordMint,
    adminAndOwner: !!fields.adminAndOwner,
  };
};

export const bindSbtMetadataReadsPort = ({
  chainGateway: readChainGateway,
  createOnChainConfigContract = createEthersSbtOnChainConfigContract,
}: BindSbtMetadataReadsPortArgs): SbtMetadataReadsPort => ({
  getSbtMetadata: (providerName, sbtAddress, groupKeyOrCfg) =>
    readChainGateway().getSbtMetadata(providerName, sbtAddress, groupKeyOrCfg),
  getMintedTokens: (providerName, sbtAddress, groupKeyOrCfg, options) =>
    readChainGateway().getMintedTokens(providerName, sbtAddress, groupKeyOrCfg, options),
  getGroupPasswordHash: (providerName, sbtAddress, groupKeyOrCfg, options) =>
    readChainGateway().getGroupPasswordHash(providerName, sbtAddress, groupKeyOrCfg, options),
  getSbtCreationBlockByAddress: (providerName, sbtAddress, groupKeyOrCfg, options) =>
    options === undefined
      ? readChainGateway().getSbtCreationBlockByAddress(providerName, sbtAddress, groupKeyOrCfg)
      : readChainGateway().getSbtCreationBlockByAddress(providerName, sbtAddress, groupKeyOrCfg, options),
  getSbtOnChainConfig: async (_providerName, sbtAddress, groupKeyOrCfg, fields) => {
    const scripts = readChainGateway();
    const provider = scripts.getReadProviderForGroup?.(groupKeyOrCfg, {
      contractKey: 'sbtFactory',
    });
    if (!provider) {
      throw new Error('Unable to resolve read provider for SBT on-chain config.');
    }
    const contract = createOnChainConfigContract(sbtAddress, SBT_ON_CHAIN_CONFIG_ABI, provider);
    const requested = resolveSbtOnChainConfigFields(fields);
    const [maxTokens, collectionBurnAuth, mintingEndTime, hasPasswordMint, admin, owner] = await Promise.all([
      requested.maxTokens ? withSoftReadTimeout(contract.maxTokens()) : Promise.resolve(null),
      requested.collectionBurnAuth ? withSoftReadTimeout(contract.collectionBurnAuth()) : Promise.resolve(null),
      requested.mintingEndTime ? withSoftReadTimeout(contract.mintingEndTime()) : Promise.resolve(null),
      requested.hasPasswordMint ? withSoftReadTimeout(contract.hasPasswordMint()) : Promise.resolve(null),
      requested.adminAndOwner ? withSoftReadTimeout(contract.admin()) : Promise.resolve(null),
      requested.adminAndOwner ? withSoftReadTimeout(contract.owner()) : Promise.resolve(null),
    ]);
    return {
      maxTokens,
      collectionBurnAuth,
      mintingEndTime,
      hasPasswordMint,
      admin,
      owner,
    };
  },
});

export const sbtMetadataReadsPort = bindSbtMetadataReadsPort({
  chainGateway: () => chainGateway,
});
