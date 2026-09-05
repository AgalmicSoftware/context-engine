import chainGateway from '../../utilities/web3/chainGateway.js';

export type FaucetFundingPort = {
  sendTestnetFunds: (recipientAddress: string) => Promise<unknown>;
};

export const faucetFundingPort: FaucetFundingPort = {
  sendTestnetFunds: (recipientAddress) => chainGateway.sendTestnetFunds(recipientAddress),
};
