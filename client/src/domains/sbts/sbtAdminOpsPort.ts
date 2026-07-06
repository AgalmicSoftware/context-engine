import chainGateway from '../../utilities/web3/contractScripts.js';
import type {
  SbtAdminOpsPort,
  SbtGroupKeyOrConfig,
  SbtProviderRef,
  SbtTokenIdInput,
  SbtTransactionResult,
} from './sbtPorts.js';

type SbtAdminOpsChainGateway = {
  addHashedPasswords: (
    providerName: SbtProviderRef,
    sbtAddress: string,
    hashedPasswords: string[]
  ) => Promise<SbtTransactionResult>;
  burnToken: (
    providerName: SbtProviderRef,
    sbtAddress: string,
    tokenId: SbtTokenIdInput
  ) => Promise<SbtTransactionResult>;
  claimWithPassword: (
    providerName: SbtProviderRef,
    sbtAddress: string,
    password: string
  ) => Promise<SbtTransactionResult>;
  isPasswordValid: (
    providerLike: SbtProviderRef,
    sbtAddress: string,
    hashedPasswordBytes32: string,
    groupKeyOrCfg?: SbtGroupKeyOrConfig
  ) => Promise<boolean>;
  startClaim: (
    providerName: SbtProviderRef,
    sbtAddress: string,
    userCommit: string
  ) => Promise<SbtTransactionResult>;
};

type BindSbtAdminOpsPortArgs = {
  chainGateway: () => SbtAdminOpsChainGateway;
};

export const bindSbtAdminOpsPort = ({
  chainGateway: readChainGateway,
}: BindSbtAdminOpsPortArgs): SbtAdminOpsPort => ({
  addHashedPasswords: (providerName, sbtAddress, hashedPasswords) => (
    readChainGateway().addHashedPasswords(providerName, sbtAddress, hashedPasswords)
  ),
  burnToken: (providerName, sbtAddress, tokenId) => (
    readChainGateway().burnToken(providerName, sbtAddress, tokenId)
  ),
  claimWithPassword: (providerName, sbtAddress, password) => (
    readChainGateway().claimWithPassword(providerName, sbtAddress, password)
  ),
  isPasswordValid: (providerLike, sbtAddress, hashedPasswordBytes32, groupKeyOrCfg) => (
    readChainGateway().isPasswordValid(providerLike, sbtAddress, hashedPasswordBytes32, groupKeyOrCfg)
  ),
  startClaim: (providerName, sbtAddress, userCommit) => (
    readChainGateway().startClaim(providerName, sbtAddress, userCommit)
  ),
});

export const sbtAdminOpsPort = bindSbtAdminOpsPort({
  chainGateway: () => chainGateway,
});
