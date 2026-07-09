import chainGateway from '../../utilities/web3/chainGateway.js';
import type { SbtMintExecutionPort, SbtProviderRef, SbtTransactionResult } from './sbtPorts.js';

type SbtMintExecutionChainGateway = {
  claim: (providerName: SbtProviderRef, sbtAddress: string) => Promise<SbtTransactionResult>;
  claimWithInvite: (
    providerName: SbtProviderRef,
    sbtAddress: string,
    nonce: string | number,
    signature: string,
  ) => Promise<SbtTransactionResult>;
  mintWithGroupSignature: (
    providerName: SbtProviderRef,
    sbtAddress: string,
    signature: string,
  ) => Promise<SbtTransactionResult>;
};

type BindSbtMintExecutionPortArgs = {
  chainGateway: () => SbtMintExecutionChainGateway;
};

export const bindSbtMintExecutionPort = ({
  chainGateway: readChainGateway,
}: BindSbtMintExecutionPortArgs): SbtMintExecutionPort => ({
  claim: (providerName, sbtAddress) => readChainGateway().claim(providerName, sbtAddress),
  claimWithInvite: (providerName, sbtAddress, nonce, signature) =>
    readChainGateway().claimWithInvite(providerName, sbtAddress, nonce, signature),
  mintWithGroupSignature: (providerName, sbtAddress, signature) =>
    readChainGateway().mintWithGroupSignature(providerName, sbtAddress, signature),
});

export const sbtMintExecutionPort = bindSbtMintExecutionPort({
  chainGateway: () => chainGateway,
});
