import chainGateway from '../../utilities/web3/chainGateway.js';
import type {
  SbtGroupKeyOrConfig,
  SbtHistorySummary,
  SbtOwnershipReadsPort,
  SbtProviderRef,
  SbtTokenIdInput,
} from './sbtPorts.js';

type SbtOwnershipReadsChainGateway = {
  getOwnerByTokenId: (
    providerName: SbtProviderRef,
    sbtAddress: string,
    tokenId: SbtTokenIdInput,
    groupKeyOrCfg?: SbtGroupKeyOrConfig,
  ) => Promise<string | null>;
  getSBTTokenIdByOwner: (
    providerName: SbtProviderRef,
    sbtAddress: string,
    ownerAddress: string,
    groupKeyOrCfg?: SbtGroupKeyOrConfig,
  ) => Promise<string | null>;
  getSbtHistorySummary: (
    providerName: SbtProviderRef,
    sbtAddress: string,
    groupKeyOrCfg?: SbtGroupKeyOrConfig,
  ) => Promise<SbtHistorySummary | null>;
};

type BindSbtOwnershipReadsPortArgs = {
  chainGateway: () => SbtOwnershipReadsChainGateway;
};

export const bindSbtOwnershipReadsPort = ({
  chainGateway: readChainGateway,
}: BindSbtOwnershipReadsPortArgs): SbtOwnershipReadsPort => ({
  getOwnerByTokenId: (providerName, sbtAddress, tokenId, groupKeyOrCfg) =>
    readChainGateway().getOwnerByTokenId(providerName, sbtAddress, tokenId, groupKeyOrCfg),
  getSBTTokenIdByOwner: (providerName, sbtAddress, ownerAddress, groupKeyOrCfg) =>
    readChainGateway().getSBTTokenIdByOwner(providerName, sbtAddress, ownerAddress, groupKeyOrCfg),
  getSbtHistorySummary: (providerName, sbtAddress, groupKeyOrCfg) =>
    readChainGateway().getSbtHistorySummary(providerName, sbtAddress, groupKeyOrCfg),
});

export const sbtOwnershipReadsPort = bindSbtOwnershipReadsPort({
  chainGateway: () => chainGateway,
});
