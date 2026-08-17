import { getNativeBalance, hasNativeBalanceReader } from './sessionBalanceReaders';
import contractScripts from '../../utilities/web3/chainGateway.js';

jest.mock('../../utilities/web3/chainGateway.js', () => ({
  __esModule: true,
  default: {},
}));

const mockContractScriptsDefault = contractScripts as {
  getNativeBalance?: jest.Mock;
};

describe('session balance readers', () => {
  beforeEach(() => {
    delete mockContractScriptsDefault.getNativeBalance;
  });

  it('returns null when the native balance reader is unavailable', async () => {
    expect(hasNativeBalanceReader()).toBe(false);

    await expect(getNativeBalance('0xabc', 'demo')).resolves.toBeNull();
  });

  it('forwards balance reads to the late-bound native runtime method', async () => {
    const nativeBalance = { gte: jest.fn(() => true) };
    mockContractScriptsDefault.getNativeBalance = jest.fn(async () => nativeBalance);

    expect(hasNativeBalanceReader()).toBe(true);
    await expect(getNativeBalance('0xabc', 'demo')).resolves.toBe(nativeBalance);
    expect(mockContractScriptsDefault.getNativeBalance).toHaveBeenCalledWith('0xabc', 'demo');
  });
});
