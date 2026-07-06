import {
  getLegacyEthBalance,
  getNativeBalance,
  hasLegacyEthBalanceReader,
  hasNativeBalanceReader,
} from './sessionBalanceReaders';
import contractScripts from '../../utilities/web3/contractScripts.js';

jest.mock('../../utilities/web3/contractScripts.js', () => ({
  __esModule: true,
  default: {},
}));

const mockContractScriptsDefault = contractScripts as {
  getETHBalance?: jest.Mock;
  getNativeBalance?: jest.Mock;
};

describe('session balance readers', () => {
  beforeEach(() => {
    delete mockContractScriptsDefault.getETHBalance;
    delete mockContractScriptsDefault.getNativeBalance;
  });

  it('returns null when native and legacy balance readers are unavailable', async () => {
    expect(hasNativeBalanceReader()).toBe(false);
    expect(hasLegacyEthBalanceReader()).toBe(false);

    await expect(getNativeBalance('0xabc', 'demo')).resolves.toBeNull();
    await expect(getLegacyEthBalance('0xabc', 'demo')).resolves.toBeNull();
  });

  it('forwards balance reads to the late-bound contract runtime methods', async () => {
    const nativeBalance = { gte: jest.fn(() => true) };
    const legacyBalance = { gte: jest.fn(() => false) };
    mockContractScriptsDefault.getNativeBalance = jest.fn(async () => nativeBalance);
    mockContractScriptsDefault.getETHBalance = jest.fn(async () => legacyBalance);

    expect(hasNativeBalanceReader()).toBe(true);
    expect(hasLegacyEthBalanceReader()).toBe(true);
    await expect(getNativeBalance('0xabc', 'demo')).resolves.toBe(nativeBalance);
    await expect(getLegacyEthBalance('0xdef', 'edge')).resolves.toBe(legacyBalance);
    expect(mockContractScriptsDefault.getNativeBalance).toHaveBeenCalledWith('0xabc', 'demo');
    expect(mockContractScriptsDefault.getETHBalance).toHaveBeenCalledWith('0xdef', 'edge');
  });
});
