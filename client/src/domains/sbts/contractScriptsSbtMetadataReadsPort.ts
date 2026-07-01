import contractScripts from '../../utilities/web3/contractScripts.js';
import type {
  SbtGroupKeyOrConfig,
  SbtMetadataReadsPort,
  SbtMetadataRecord,
  SbtReadOptions,
} from './sbtPorts.js';

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
};

type BindSbtMetadataReadsPortArgs = {
  contractScripts: () => SbtMetadataReadsContractScripts;
};

export const bindSbtMetadataReadsPort = ({
  contractScripts: readContractScripts,
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
});

export const sbtMetadataReadsPort = bindSbtMetadataReadsPort({
  contractScripts: () => contractScripts,
});
