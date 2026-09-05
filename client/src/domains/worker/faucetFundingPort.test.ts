import chainGateway from '../../utilities/web3/chainGateway.js';
import { faucetFundingPort } from './faucetFundingPort';

describe('FaucetFundingPort', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('routes faucet funding through call-time chainGateway property lookup', async () => {
    const sendTestnetFunds = jest
      .spyOn(chainGateway, 'sendTestnetFunds')
      .mockResolvedValueOnce({ txHash: '0xfirst' })
      .mockResolvedValueOnce({ txHash: '0xsecond' });

    await expect(faucetFundingPort.sendTestnetFunds('0xabc')).resolves.toEqual({ txHash: '0xfirst' });
    await expect(faucetFundingPort.sendTestnetFunds('0xdef')).resolves.toEqual({ txHash: '0xsecond' });

    expect(sendTestnetFunds).toHaveBeenNthCalledWith(1, '0xabc');
    expect(sendTestnetFunds).toHaveBeenNthCalledWith(2, '0xdef');
  });
});
