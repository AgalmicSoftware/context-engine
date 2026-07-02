import contractScripts from '../../utilities/web3/contractScripts.js';
import type {
  SbtAdminOpsPort,
  SbtGroupKeyOrConfig,
  SbtProviderRef,
  SbtTokenIdInput,
  SbtTransactionResult,
} from './sbtPorts.js';

type SbtAdminOpsContractScripts = {
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
  contractScripts: () => SbtAdminOpsContractScripts;
};

export const bindSbtAdminOpsPort = ({
  contractScripts: readContractScripts,
}: BindSbtAdminOpsPortArgs): SbtAdminOpsPort => ({
  addHashedPasswords: (providerName, sbtAddress, hashedPasswords) => (
    readContractScripts().addHashedPasswords(providerName, sbtAddress, hashedPasswords)
  ),
  burnToken: (providerName, sbtAddress, tokenId) => (
    readContractScripts().burnToken(providerName, sbtAddress, tokenId)
  ),
  claimWithPassword: (providerName, sbtAddress, password) => (
    readContractScripts().claimWithPassword(providerName, sbtAddress, password)
  ),
  isPasswordValid: (providerLike, sbtAddress, hashedPasswordBytes32, groupKeyOrCfg) => (
    readContractScripts().isPasswordValid(providerLike, sbtAddress, hashedPasswordBytes32, groupKeyOrCfg)
  ),
  startClaim: (providerName, sbtAddress, userCommit) => (
    readContractScripts().startClaim(providerName, sbtAddress, userCommit)
  ),
});

export const sbtAdminOpsPort = bindSbtAdminOpsPort({
  contractScripts: () => contractScripts,
});
