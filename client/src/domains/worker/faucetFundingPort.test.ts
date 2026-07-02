import { bindFaucetFundingPort } from './contractScriptsFaucetFundingPort';

describe('FaucetFundingPort', () => {
  it('routes faucet funding through call-time contractScripts lookup', async () => {
    const firstContractScripts = {
      sendTestnetFunds: jest.fn(async () => ({ txHash: '0xfirst' })),
    };
    const secondContractScripts = {
      sendTestnetFunds: jest.fn(async () => ({ txHash: '0xsecond' })),
    };
    let currentContractScripts = firstContractScripts;
    const port = bindFaucetFundingPort({
      contractScripts: () => currentContractScripts,
    });

    await expect(port.sendTestnetFunds('0xabc')).resolves.toEqual({ txHash: '0xfirst' });

    currentContractScripts = secondContractScripts;

    await expect(port.sendTestnetFunds('0xdef')).resolves.toEqual({ txHash: '0xsecond' });

    expect(firstContractScripts.sendTestnetFunds).toHaveBeenCalledWith('0xabc');
    expect(secondContractScripts.sendTestnetFunds).toHaveBeenCalledWith('0xdef');
  });
});
