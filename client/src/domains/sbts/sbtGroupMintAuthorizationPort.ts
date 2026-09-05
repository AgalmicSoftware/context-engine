import chainGateway from '../../utilities/web3/chainGateway.js';
import type { SbtGroupMintAuthorizationPort } from './sbtPorts.js';

export const sbtGroupMintAuthorizationPort: SbtGroupMintAuthorizationPort = {
  computeGroupPasswordHash: (input) => chainGateway.computeGroupPasswordHash(input),
  signGroupMintAuthorization: (input) => chainGateway.signGroupMintAuthorization(input),
  generateInvitePayloads: (input) => chainGateway.generateInvitePayloads(input),
};
