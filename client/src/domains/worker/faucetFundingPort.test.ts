import { bindFaucetFundingPort } from './faucetFundingPort';

describe('FaucetFundingPort', () => {
  it('routes faucet funding through call-time chainGateway lookup', async () => {
    const firstChainGateway = {
      sendTestnetFunds: jest.fn(async () => ({ txHash: '0xfirst' })),
    };
    const secondChainGateway = {
      sendTestnetFunds: jest.fn(async () => ({ txHash: '0xsecond' })),
    };
    let currentChainGateway = firstChainGateway;
    const port = bindFaucetFundingPort({
      chainGateway: () => currentChainGateway,
    });

    await expect(port.sendTestnetFunds('0xabc')).resolves.toEqual({ txHash: '0xfirst' });

    currentChainGateway = secondChainGateway;

    await expect(port.sendTestnetFunds('0xdef')).resolves.toEqual({ txHash: '0xsecond' });

    expect(firstChainGateway.sendTestnetFunds).toHaveBeenCalledWith('0xabc');
    expect(secondChainGateway.sendTestnetFunds).toHaveBeenCalledWith('0xdef');
  });
});
