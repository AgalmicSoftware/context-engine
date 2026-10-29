import { ethers } from 'ethers';
import { __test__contractScriptsSbtHistory } from './chainGateway.js';
import { createContractScriptsSbtMintMethods } from './contractScripts.sbtMintMethods';

describe('contractScripts SBT history helpers', () => {
  const { normalizeHistorySummaryCount, normalizeSbtHistorySummary, deriveSbtHistorySummaryFromCounts } =
    __test__contractScriptsSbtHistory;

  it('normalizes numeric summary counts from strings and BigNumbers', () => {
    expect(normalizeHistorySummaryCount('0007')).toBe('7');
    expect(normalizeHistorySummaryCount(0)).toBe('0');
    expect(normalizeHistorySummaryCount(ethers.BigNumber.from('12'))).toBe('12');
    expect(normalizeHistorySummaryCount('not-a-count')).toBeNull();
  });

  it('accepts both object and tuple-like summary payloads', () => {
    expect(
      normalizeSbtHistorySummary({
        totalMinted: '4',
        totalBurned: '1',
        activeSupply: '3',
        currentHolderCount: '2',
        historicalHolderCount: '3',
      }),
    ).toEqual({
      totalMinted: '4',
      totalBurned: '1',
      activeSupply: '3',
      currentHolderCount: '2',
      historicalHolderCount: '3',
    });

    expect(normalizeSbtHistorySummary([ethers.BigNumber.from('4'), ethers.BigNumber.from('1'), '3', '2', '3'])).toEqual(
      {
        totalMinted: '4',
        totalBurned: '1',
        activeSupply: '3',
        currentHolderCount: '2',
        historicalHolderCount: '3',
      },
    );
  });

  it('derives active supply and holder counts from minted and burned totals', () => {
    expect(
      deriveSbtHistorySummaryFromCounts({
        mintedCountByAddress: {
          '0xaaa': 2,
          '0xbbb': 1,
          '0xccc': 3,
        },
        burnedCountByAddress: {
          '0xaaa': 1,
          '0xbbb': 1,
          '0xccc': 5,
        },
        mintedEventCount: 6,
        burnedEventCount: 7,
      }),
    ).toEqual({
      totalMinted: '6',
      totalBurned: '7',
      activeSupply: '1',
      currentHolderCount: '1',
      historicalHolderCount: '3',
    });
  });
});

describe('SBT history summary chain isolation', () => {
  const address = '0x00000000000000000000000000000000000000a1';
  const summary = {
    totalMinted: '4',
    totalBurned: '1',
    activeSupply: '3',
    currentHolderCount: '2',
    historicalHolderCount: '3',
  };
  const setup = (readFails) => {
    const sessionProvider = { chainId: 1 };
    const walletProvider = { chainId: 2, request: jest.fn() };
    const sessionRead = readFails
      ? jest.fn().mockRejectedValue(new Error('Session RPC unavailable'))
      : jest.fn().mockResolvedValue(summary);
    const walletRead = jest.fn().mockResolvedValue({ ...summary, totalMinted: '999' });
    const Web3Provider = jest.fn(() => walletProvider);
    const methods = createContractScriptsSbtMintMethods({
      ethers: {
        ...ethers,
        providers: { ...ethers.providers, Web3Provider },
        Contract: jest.fn((_address, _abi, provider) => ({
          getHistorySummary: provider === sessionProvider ? sessionRead : walletRead,
        })),
      },
      getLocalAwareReadProviderForGroup: jest.fn(() => sessionProvider),
      callWithRetry: (call) => call(),
      normalizeSbtHistorySummary: __test__contractScriptsSbtHistory.normalizeSbtHistorySummary,
      inviteLog: { warn: jest.fn() },
    });
    return { methods, walletProvider, walletRead, sessionRead, Web3Provider };
  };

  it.each(['none', 'metamask'])(
    'never substitutes wallet-chain counts when the session read fails (%s)',
    async (providerName) => {
      const { methods, walletProvider, walletRead, Web3Provider } = setup(true);
      const previous = window.ethereum;
      window.ethereum = walletProvider;
      try {
        await expect(methods.getSbtHistorySummary(providerName, address, { networkChainId: 1 })).resolves.toBeNull();
        expect(Web3Provider).not.toHaveBeenCalled();
        expect(walletRead).not.toHaveBeenCalled();
        expect(walletProvider.request).not.toHaveBeenCalled();
      } finally {
        window.ethereum = previous;
      }
    },
  );

  it('returns a working session-chain summary unchanged', async () => {
    const { methods, sessionRead, Web3Provider } = setup(false);
    await expect(methods.getSbtHistorySummary('none', address, { networkChainId: 1 })).resolves.toEqual(summary);
    expect(sessionRead).toHaveBeenCalledTimes(1);
    expect(Web3Provider).not.toHaveBeenCalled();
  });
});
