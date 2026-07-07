import chainGateway from '../../utilities/web3/chainGateway.js';

type FaucetFundingChainGateway = {
  sendTestnetFunds: (recipientAddress: string) => Promise<unknown>;
};

export type FaucetFundingPort = {
  sendTestnetFunds: (recipientAddress: string) => Promise<unknown>;
};

type BindFaucetFundingPortArgs = {
  chainGateway: () => FaucetFundingChainGateway;
};

export const bindFaucetFundingPort = ({
  chainGateway: readChainGateway,
}: BindFaucetFundingPortArgs): FaucetFundingPort => ({
  sendTestnetFunds: (recipientAddress) => readChainGateway().sendTestnetFunds(recipientAddress),
});

export const faucetFundingPort = bindFaucetFundingPort({
  chainGateway: () => chainGateway,
});
