import {
  buildSbtPageClaimCountdownCompletePatch,
  buildSbtPageClaimCountdownTickPatch,
  buildSbtPageDetailsPayload,
  buildSbtPageExplorerUrl,
  getBlockExplorerBaseUrl,
  resolveSbtChainId,
  resolveSbtPageActiveBlockTimeMs,
  resolveSbtPageActiveChainId,
  resolveSbtPageCountdownDisplaySeconds,
  resolveSbtPageRecoveryCacheChainId,
} from './sbtPageChainRuntimeHelpers';

describe('sbtPageChainRuntimeHelpers', () => {
  it('resolves chain ids and block timing for SBT page runtime state', () => {
    expect(resolveSbtChainId({ chainID: '84532' })).toBe(84532);
    expect(resolveSbtChainId([{ chainId: 0 }, { chainId: 10 }])).toBe(10);
    expect(resolveSbtChainId('bad')).toBeNull();
    expect(
      resolveSbtPageActiveChainId({
        stateNetwork: { id: 11155420 },
        propNetwork: { id: 84532 },
      }),
    ).toBe(11155420);
    expect(
      resolveSbtPageActiveChainId({
        sbtInfo: { chainID: '84532' },
      }),
    ).toBe(84532);
    expect(
      resolveSbtPageActiveChainId({
        getSessionChainId: () => 10,
        sessionSlug: 'alpha',
      }),
    ).toBe(10);
    expect(
      resolveSbtPageRecoveryCacheChainId({
        propSBTAddress: [{ chainID: 84532 }],
        stateNetwork: { id: 10 },
      }),
    ).toBe(84532);
    expect(
      resolveSbtPageActiveBlockTimeMs({
        activeChainId: 11155420,
        getChainBlockTimeMs: (chainId) => (chainId === 11155420 ? 2000 : 1000),
        multiplier: 1.5,
      }),
    ).toBe(3000);
  });

  it('builds explorer URLs, details payloads, and countdown patches', () => {
    expect(
      getBlockExplorerBaseUrl({
        blockExplorers: { default: { url: 'https://explorer.example/' } },
      }),
    ).toBe('https://explorer.example');
    expect(getBlockExplorerBaseUrl(null)).toBe('');
    expect(
      buildSbtPageExplorerUrl({
        network: { blockExplorers: { default: { url: 'https://explorer.example/' } } },
        value: '0xabc',
      }),
    ).toBe('https://explorer.example/address/0xabc');
    expect(buildSbtPageExplorerUrl({ value: '0xtx', kind: 'tx' })).toBe('https://sepolia.etherscan.io/tx/0xtx');
    expect(
      buildSbtPageDetailsPayload({
        sbtInfo: { name: 'Group' },
        address: '0xabc',
      }),
    ).toEqual({
      name: 'Group',
      address: '0xabc',
    });
    expect(resolveSbtPageCountdownDisplaySeconds(4999)).toBe(5);
    expect(resolveSbtPageCountdownDisplaySeconds(-1)).toBe(0);
    expect(
      buildSbtPageClaimCountdownTickPatch({
        remainingMs: 4999,
      }),
    ).toEqual({ claimCountdown: 5 });
    expect(
      buildSbtPageClaimCountdownCompletePatch({
        waitMs: 5000,
      }),
    ).toEqual({ mintStep: 2, claimCountdown: 5 });
  });
});
