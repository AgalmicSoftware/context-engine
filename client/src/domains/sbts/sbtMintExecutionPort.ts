import chainGateway from '../../utilities/web3/chainGateway.js';
import type { SbtMintExecutionPort } from './sbtPorts.js';

export const sbtMintExecutionPort: SbtMintExecutionPort = {
  claim: (providerName, sbtAddress) => chainGateway.claim(providerName, sbtAddress),
  claimWithInvite: (providerName, sbtAddress, nonce, signature) =>
    chainGateway.claimWithInvite(providerName, sbtAddress, nonce, signature),
  mintWithGroupSignature: (providerName, sbtAddress, signature) =>
    chainGateway.mintWithGroupSignature(providerName, sbtAddress, signature),
};
