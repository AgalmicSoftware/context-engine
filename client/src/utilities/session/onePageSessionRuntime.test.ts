import {
  getLegacyEthBalance,
  getNativeBalance,
  hasLegacyEthBalanceReader,
  hasNativeBalanceReader,
} from './onePageSessionRuntime.js';

jest.mock('../web3/contractScripts.js', () => ({
  __esModule: true,
  default: {},
  getAllSessionSlugs: jest.fn(() => []),
}));

describe('onePageSessionRuntime balance readers', () => {
  it('returns null when native and legacy balance readers are unavailable', async () => {
    expect(hasNativeBalanceReader()).toBe(false);
    expect(hasLegacyEthBalanceReader()).toBe(false);

    await expect(getNativeBalance('0xabc', 'demo')).resolves.toBeNull();
    await expect(getLegacyEthBalance('0xabc', 'demo')).resolves.toBeNull();
  });
});
