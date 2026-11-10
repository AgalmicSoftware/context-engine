import chainGateway from '../../utilities/web3/chainGateway.js';
import type { SbtAdminOpsPort } from './sbtPorts.js';

export const sbtAdminOpsPort: SbtAdminOpsPort = {
  addHashedPasswords: (providerName, sbtAddress, hashedPasswords, expectedChainId) =>
    chainGateway.addHashedPasswords(providerName, sbtAddress, hashedPasswords, expectedChainId),
  burnToken: (providerName, sbtAddress, tokenId, expectedChainId) =>
    chainGateway.burnToken(providerName, sbtAddress, tokenId, expectedChainId),
  claimWithPassword: (providerName, sbtAddress, password, expectedChainId) =>
    chainGateway.claimWithPassword(providerName, sbtAddress, password, expectedChainId),
  isPasswordValid: (providerLike, sbtAddress, hashedPasswordBytes32, groupKeyOrCfg) =>
    chainGateway.isPasswordValid(providerLike, sbtAddress, hashedPasswordBytes32, groupKeyOrCfg),
  startClaim: (providerName, sbtAddress, userCommit, expectedChainId) =>
    chainGateway.startClaim(providerName, sbtAddress, userCommit, expectedChainId),
};
