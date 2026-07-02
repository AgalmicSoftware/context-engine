import contractScripts from '../../utilities/web3/contractScripts.js';

type FaucetFundingContractScripts = {
  sendTestnetFunds: (recipientAddress: string) => Promise<unknown>;
};

export type FaucetFundingPort = {
  sendTestnetFunds: (recipientAddress: string) => Promise<unknown>;
};

type BindFaucetFundingPortArgs = {
  contractScripts: () => FaucetFundingContractScripts;
};

export const bindFaucetFundingPort = ({
  contractScripts: readContractScripts,
}: BindFaucetFundingPortArgs): FaucetFundingPort => ({
  sendTestnetFunds: (recipientAddress) => (
    readContractScripts().sendTestnetFunds(recipientAddress)
  ),
});

export const faucetFundingPort = bindFaucetFundingPort({
  contractScripts: () => contractScripts,
});
