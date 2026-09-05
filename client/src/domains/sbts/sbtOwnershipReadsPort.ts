import chainGateway from '../../utilities/web3/chainGateway.js';
import type { SbtOwnershipReadsPort } from './sbtPorts.js';

export const sbtOwnershipReadsPort: SbtOwnershipReadsPort = {
  getOwnerByTokenId: (providerName, sbtAddress, tokenId, groupKeyOrCfg) =>
    chainGateway.getOwnerByTokenId(providerName, sbtAddress, tokenId, groupKeyOrCfg),
  getSBTTokenIdByOwner: (providerName, sbtAddress, ownerAddress, groupKeyOrCfg) =>
    chainGateway.getSBTTokenIdByOwner(providerName, sbtAddress, ownerAddress, groupKeyOrCfg),
  getSbtHistorySummary: (providerName, sbtAddress, groupKeyOrCfg) =>
    chainGateway.getSbtHistorySummary(providerName, sbtAddress, groupKeyOrCfg),
};
