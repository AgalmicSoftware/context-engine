import contractScripts from '../../utilities/web3/contractScripts.js';
import type {
  SbtMintExecutionPort,
  SbtTransactionResult,
} from './sbtPorts.js';

type SbtMintExecutionContractScripts = {
  claim: (
    providerName: string,
    sbtAddress: string
  ) => Promise<SbtTransactionResult>;
  claimWithInvite: (
    providerName: string,
    sbtAddress: string,
    nonce: string | number,
    signature: string
  ) => Promise<SbtTransactionResult>;
  mintWithGroupSignature: (
    providerName: string,
    sbtAddress: string,
    signature: string
  ) => Promise<SbtTransactionResult>;
};

type BindSbtMintExecutionPortArgs = {
  contractScripts: () => SbtMintExecutionContractScripts;
};

export const bindSbtMintExecutionPort = ({
  contractScripts: readContractScripts,
}: BindSbtMintExecutionPortArgs): SbtMintExecutionPort => ({
  claim: (providerName, sbtAddress) => (
    readContractScripts().claim(providerName, sbtAddress)
  ),
  claimWithInvite: (providerName, sbtAddress, nonce, signature) => (
    readContractScripts().claimWithInvite(providerName, sbtAddress, nonce, signature)
  ),
  mintWithGroupSignature: (providerName, sbtAddress, signature) => (
    readContractScripts().mintWithGroupSignature(providerName, sbtAddress, signature)
  ),
});

export const sbtMintExecutionPort = bindSbtMintExecutionPort({
  contractScripts: () => contractScripts,
});
