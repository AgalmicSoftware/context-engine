import contractScripts from '../../utilities/web3/contractScripts.js';
import type {
  SbtGroupKeyOrConfig,
  SbtHistorySummary,
  SbtOwnershipReadsPort,
  SbtProviderRef,
  SbtTokenIdInput,
} from './sbtPorts.js';

type SbtOwnershipReadsContractScripts = {
  getOwnerByTokenId: (
    providerName: SbtProviderRef,
    sbtAddress: string,
    tokenId: SbtTokenIdInput,
    groupKeyOrCfg?: SbtGroupKeyOrConfig
  ) => Promise<string | null>;
  getSBTTokenIdByOwner: (
    providerName: SbtProviderRef,
    sbtAddress: string,
    ownerAddress: string,
    groupKeyOrCfg?: SbtGroupKeyOrConfig
  ) => Promise<string | null>;
  getSbtHistorySummary: (
    providerName: SbtProviderRef,
    sbtAddress: string,
    groupKeyOrCfg?: SbtGroupKeyOrConfig
  ) => Promise<SbtHistorySummary | null>;
};

type BindSbtOwnershipReadsPortArgs = {
  contractScripts: () => SbtOwnershipReadsContractScripts;
};

export const bindSbtOwnershipReadsPort = ({
  contractScripts: readContractScripts,
}: BindSbtOwnershipReadsPortArgs): SbtOwnershipReadsPort => ({
  getOwnerByTokenId: (providerName, sbtAddress, tokenId, groupKeyOrCfg) => (
    readContractScripts().getOwnerByTokenId(providerName, sbtAddress, tokenId, groupKeyOrCfg)
  ),
  getSBTTokenIdByOwner: (providerName, sbtAddress, ownerAddress, groupKeyOrCfg) => (
    readContractScripts().getSBTTokenIdByOwner(providerName, sbtAddress, ownerAddress, groupKeyOrCfg)
  ),
  getSbtHistorySummary: (providerName, sbtAddress, groupKeyOrCfg) => (
    readContractScripts().getSbtHistorySummary(providerName, sbtAddress, groupKeyOrCfg)
  ),
});

export const sbtOwnershipReadsPort = bindSbtOwnershipReadsPort({
  contractScripts: () => contractScripts,
});
