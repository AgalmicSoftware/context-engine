import chainGateway from '../../utilities/web3/chainGateway.js';
import type {
  SbtGroupMintAuthorizationInput,
  SbtGroupMintAuthorizationPort,
  SbtGroupPasswordHashInput,
  SbtInvitePayload,
  SbtInvitePayloadsInput,
} from './sbtPorts.js';

type SbtGroupMintAuthorizationChainGateway = {
  computeGroupPasswordHash: (input: SbtGroupPasswordHashInput) => string;
  signGroupMintAuthorization: (input: SbtGroupMintAuthorizationInput) => Promise<string>;
  generateInvitePayloads: (input: SbtInvitePayloadsInput) => Promise<SbtInvitePayload[]>;
};

type BindSbtGroupMintAuthorizationPortArgs = {
  chainGateway: () => SbtGroupMintAuthorizationChainGateway;
};

export const bindSbtGroupMintAuthorizationPort = ({
  chainGateway: readChainGateway,
}: BindSbtGroupMintAuthorizationPortArgs): SbtGroupMintAuthorizationPort => ({
  computeGroupPasswordHash: (input) => readChainGateway().computeGroupPasswordHash(input),
  signGroupMintAuthorization: (input) => readChainGateway().signGroupMintAuthorization(input),
  generateInvitePayloads: (input) => readChainGateway().generateInvitePayloads(input),
});

export const sbtGroupMintAuthorizationPort = bindSbtGroupMintAuthorizationPort({
  chainGateway: () => chainGateway,
});
