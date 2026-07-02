import contractScripts from '../../utilities/web3/contractScripts.js';
import type {
  SbtGroupMintAuthorizationInput,
  SbtGroupMintAuthorizationPort,
  SbtGroupPasswordHashInput,
  SbtInvitePayload,
  SbtInvitePayloadsInput,
} from './sbtPorts.js';

type SbtGroupMintAuthorizationContractScripts = {
  computeGroupPasswordHash: (
    input: SbtGroupPasswordHashInput
  ) => string;
  signGroupMintAuthorization: (
    input: SbtGroupMintAuthorizationInput
  ) => Promise<string>;
  generateInvitePayloads: (
    input: SbtInvitePayloadsInput
  ) => Promise<SbtInvitePayload[]>;
};

type BindSbtGroupMintAuthorizationPortArgs = {
  contractScripts: () => SbtGroupMintAuthorizationContractScripts;
};

export const bindSbtGroupMintAuthorizationPort = ({
  contractScripts: readContractScripts,
}: BindSbtGroupMintAuthorizationPortArgs): SbtGroupMintAuthorizationPort => ({
  computeGroupPasswordHash: (input) => (
    readContractScripts().computeGroupPasswordHash(input)
  ),
  signGroupMintAuthorization: (input) => (
    readContractScripts().signGroupMintAuthorization(input)
  ),
  generateInvitePayloads: (input) => (
    readContractScripts().generateInvitePayloads(input)
  ),
});

export const sbtGroupMintAuthorizationPort = bindSbtGroupMintAuthorizationPort({
  contractScripts: () => contractScripts,
});
