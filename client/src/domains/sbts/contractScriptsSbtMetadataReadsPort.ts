import { ethers } from 'ethers';
import contractScripts from '../../utilities/web3/contractScripts.js';
import type {
  SbtGroupKeyOrConfig,
  SbtMetadataReadsPort,
  SbtMetadataRecord,
  SbtOnChainConfig,
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
  provider: ethers.providers.Provider
) => SbtOnChainConfigContract;

type SbtMetadataReadsContractScripts = {
  getSbtMetadata: (
    providerName: string,
    sbtAddress: string,
    groupKeyOrCfg?: SbtGroupKeyOrConfig
  ) => Promise<SbtMetadataRecord | null | undefined>;
  getMintedTokens: (
    providerName: string,
    sbtAddress: string,
    groupKeyOrCfg?: SbtGroupKeyOrConfig,
    options?: SbtReadOptions
  ) => Promise<unknown>;
  getGroupPasswordHash: (
    providerName: string,
    sbtAddress: string,
    groupKeyOrCfg?: SbtGroupKeyOrConfig,
    options?: SbtReadOptions
  ) => Promise<string | null>;
  getReadProviderForGroup?: (
    groupKeyOrCfg?: SbtGroupKeyOrConfig,
    options?: { contractKey?: string }
  ) => ethers.providers.Provider;
};

type BindSbtMetadataReadsPortArgs = {
  contractScripts: () => SbtMetadataReadsContractScripts;
  createOnChainConfigContract?: CreateSbtOnChainConfigContract;
};

const createEthersSbtOnChainConfigContract: CreateSbtOnChainConfigContract = (
  sbtAddress,
  abi,
  provider
) => {
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
  timeoutMs: number = 750
): Promise<T | null> => new Promise((resolve) => {
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

export const bindSbtMetadataReadsPort = ({
  contractScripts: readContractScripts,
  createOnChainConfigContract = createEthersSbtOnChainConfigContract,
}: BindSbtMetadataReadsPortArgs): SbtMetadataReadsPort => ({
  getSbtMetadata: (providerName, sbtAddress, groupKeyOrCfg) => (
    readContractScripts().getSbtMetadata(providerName, sbtAddress, groupKeyOrCfg)
  ),
  getMintedTokens: (providerName, sbtAddress, groupKeyOrCfg, options) => (
    readContractScripts().getMintedTokens(providerName, sbtAddress, groupKeyOrCfg, options)
  ),
  getGroupPasswordHash: (providerName, sbtAddress, groupKeyOrCfg, options) => (
    readContractScripts().getGroupPasswordHash(providerName, sbtAddress, groupKeyOrCfg, options)
  ),
  getSbtOnChainConfig: async (_providerName, sbtAddress, groupKeyOrCfg) => {
    const scripts = readContractScripts();
    const provider = scripts.getReadProviderForGroup?.(groupKeyOrCfg, {
      contractKey: 'sbtFactory',
    });
    if (!provider) {
      throw new Error('Unable to resolve read provider for SBT on-chain config.');
    }
    const contract = createOnChainConfigContract(
      sbtAddress,
      SBT_ON_CHAIN_CONFIG_ABI,
      provider
    );
    const [
      maxTokens,
      collectionBurnAuth,
      mintingEndTime,
      hasPasswordMint,
      admin,
      owner,
    ] = await Promise.all([
      withSoftReadTimeout(contract.maxTokens()),
      withSoftReadTimeout(contract.collectionBurnAuth()),
      withSoftReadTimeout(contract.mintingEndTime()),
      withSoftReadTimeout(contract.hasPasswordMint()),
      withSoftReadTimeout(contract.admin()),
      withSoftReadTimeout(contract.owner()),
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
  contractScripts: () => contractScripts,
});
