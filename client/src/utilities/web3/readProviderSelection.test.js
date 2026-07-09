import { readInjectedProviderChainId, shouldUseInjectedReadProviderForChain } from './readProviderSelection.js';

describe('readInjectedProviderChainId', () => {
  it('parses hex and decimal injected chain id fields', () => {
    expect(readInjectedProviderChainId({ chainId: '0x7a69' })).toBe(31337);
    expect(readInjectedProviderChainId({ networkVersion: '31337' })).toBe(31337);
    expect(readInjectedProviderChainId({ chainId: 84532 })).toBe(84532);
  });

  it('returns null when no usable injected chain id is present', () => {
    expect(readInjectedProviderChainId({})).toBeNull();
    expect(readInjectedProviderChainId(null)).toBeNull();
    expect(readInjectedProviderChainId({ chainId: 'not-a-chain' })).toBeNull();
  });
});

describe('shouldUseInjectedReadProviderForChain', () => {
  it('allows the injected provider only when both target and wallet are on 31337', () => {
    expect(
      shouldUseInjectedReadProviderForChain({
        targetChainId: 31337,
        injectedProvider: { chainId: '0x7a69' },
      }),
    ).toBe(true);

    expect(
      shouldUseInjectedReadProviderForChain({
        targetChainId: 31337,
        injectedProvider: { networkVersion: '31337' },
      }),
    ).toBe(true);
  });

  it('falls back to the configured RPC when the wallet is on a different chain', () => {
    expect(
      shouldUseInjectedReadProviderForChain({
        targetChainId: 31337,
        injectedProvider: { chainId: '0x14a34' },
      }),
    ).toBe(false);

    expect(
      shouldUseInjectedReadProviderForChain({
        targetChainId: 31337,
        injectedProvider: {},
      }),
    ).toBe(false);

    expect(
      shouldUseInjectedReadProviderForChain({
        targetChainId: 84532,
        injectedProvider: { chainId: '0x7a69' },
      }),
    ).toBe(false);
  });
});
