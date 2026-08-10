import {
  resolveInjectedProvider,
  resolveReadProvider,
  resolveSignerProvider,
} from './providerAdapter.js';
import * as providerAdapterModule from './providerAdapter.js';

it('exports only live provider resolution responsibilities', () => {
  expect(providerAdapterModule).not.toHaveProperty('normalizeWalletError');
  expect(providerAdapterModule).not.toHaveProperty('addWalletChain');
  expect(providerAdapterModule).not.toHaveProperty('switchWalletChain');
});

describe('providerAdapter', () => {
  it('resolves injected providers without reaching into globals when provided', () => {
    const injectedProvider = { request: jest.fn() };

    expect(resolveInjectedProvider(injectedProvider)).toEqual({
      ok: true,
      provider: injectedProvider,
      source: 'injected-wallet',
    });
  });

  it('does not silently fall back to injected wallet for read providers by default', () => {
    const injectedProvider = { request: jest.fn() };
    const result = resolveReadProvider({
      chainId: 11155420,
      injectedProvider,
      readProviderFactory: () => {
        throw new Error('configured RPC unavailable');
      },
    });

    expect(result).toEqual(
      expect.objectContaining({
        ok: false,
        status: 'read-provider-unavailable',
        error: 'configured RPC unavailable',
      }),
    );
  });

  it('allows injected read fallback only when the caller opts in', () => {
    const injectedProvider = { request: jest.fn() };
    const result = resolveReadProvider({
      chainId: 11155420,
      injectedProvider,
      allowInjectedReadFallback: true,
      readProviderFactory: () => {
        throw new Error('configured RPC unavailable');
      },
    });

    expect(result).toEqual({
      ok: true,
      provider: injectedProvider,
      source: 'injected-wallet',
    });
  });

  it('keeps unknown signer providers from silently using injected wallet', () => {
    const injectedProvider = { request: jest.fn() };

    expect(
      resolveSignerProvider({
        providerName: 'surprise-wallet',
        injectedProvider,
        allowInjectedSignerFallback: true,
      }),
    ).toEqual(
      expect.objectContaining({
        ok: false,
        status: 'unknown-provider',
      }),
    );
  });

  it('allows explicit injected signer provider selection', () => {
    const injectedProvider = { request: jest.fn() };

    expect(
      resolveSignerProvider({
        providerName: 'injected',
        injectedProvider,
      }),
    ).toEqual({
      ok: true,
      provider: injectedProvider,
      source: 'injected-wallet',
    });
  });

  it('resolves passkey EOA signer providers through the adapter factory', () => {
    const passkeyProvider = { isPasskeyEoa: true };

    expect(
      resolveSignerProvider({
        providerName: 'passkey_eoa',
        passkeyProviderFactory: () => passkeyProvider,
      }),
    ).toEqual({
      ok: true,
      provider: passkeyProvider,
      source: 'passkey-eoa',
    });
  });

});
