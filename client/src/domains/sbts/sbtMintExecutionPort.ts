import chainGateway from '../../utilities/web3/chainGateway.js';
import type { SbtMintExecutionPort } from './sbtPorts.js';

// Callers note each confirmed SBT so Worker tokens issued before it can gain
// the scopes its gates now grant.
export { noteWorkerAccessChanged } from '../../utilities/worker/workerAuth.js';

export const sbtMintExecutionPort: SbtMintExecutionPort = {
  claim: (providerName, sbtAddress, expectedChainId) => chainGateway.claim(providerName, sbtAddress, expectedChainId),
  claimWithInvite: (providerName, sbtAddress, nonce, signature, expectedChainId) =>
    chainGateway.claimWithInvite(providerName, sbtAddress, nonce, signature, expectedChainId),
  mintWithGroupSignature: (providerName, sbtAddress, signature, expectedChainId) =>
    chainGateway.mintWithGroupSignature(providerName, sbtAddress, signature, expectedChainId),
};
