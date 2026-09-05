import chainGateway from '../../utilities/web3/chainGateway.js';
import type { SbtAdminOpsPort } from './sbtPorts.js';

export const sbtAdminOpsPort: SbtAdminOpsPort = {
  addHashedPasswords: (providerName, sbtAddress, hashedPasswords) =>
    chainGateway.addHashedPasswords(providerName, sbtAddress, hashedPasswords),
  burnToken: (providerName, sbtAddress, tokenId) => chainGateway.burnToken(providerName, sbtAddress, tokenId),
  claimWithPassword: (providerName, sbtAddress, password) =>
    chainGateway.claimWithPassword(providerName, sbtAddress, password),
  isPasswordValid: (providerLike, sbtAddress, hashedPasswordBytes32, groupKeyOrCfg) =>
    chainGateway.isPasswordValid(providerLike, sbtAddress, hashedPasswordBytes32, groupKeyOrCfg),
  startClaim: (providerName, sbtAddress, userCommit) => chainGateway.startClaim(providerName, sbtAddress, userCommit),
};
