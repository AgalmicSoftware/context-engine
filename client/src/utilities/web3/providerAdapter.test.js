import {
  addWalletChain,
  normalizeWalletError,
  resolveInjectedProvider,
  resolveReadProvider,
  resolveSignerProvider,
  switchWalletChain,
} from './providerAdapter.js';

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

    expect(result).toEqual(expect.objectContaining({
      ok: false,
      status: 'read-provider-unavailable',
      error: 'configured RPC unavailable',
    }));
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

    expect(resolveSignerProvider({
      providerName: 'surprise-wallet',
      injectedProvider,
    })).toEqual(expect.objectContaining({
      ok: false,
      status: 'unknown-provider',
    }));
  });

  it('resolves passkey EOA signer providers through the adapter factory', () => {
    const passkeyProvider = { isPasskeyEoa: true };

    expect(resolveSignerProvider({
      providerName: 'passkey_eoa',
      passkeyProviderFactory: () => passkeyProvider,
    })).toEqual({
      ok: true,
      provider: passkeyProvider,
      source: 'passkey-eoa',
    });
  });

  it('normalizes user-rejected wallet errors', () => {
    expect(normalizeWalletError({ code: 4001, message: 'User rejected the request.' }))
      .toEqual(expect.objectContaining({
        ok: false,
        status: 'user-rejected',
        error: 'Wallet request was cancelled.',
      }));
  });

  it('switches wallet chains with an injected provider request', async () => {
    const injectedProvider = { request: jest.fn().mockResolvedValue(null) };
    const chain = { id: 11155420, name: 'OP Sepolia' };

    await expect(switchWalletChain({ chain, injectedProvider })).resolves.toEqual(expect.objectContaining({
      ok: true,
      status: 'switched',
      provider: injectedProvider,
    }));
    expect(injectedProvider.request).toHaveBeenCalledWith({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: '0xaa37dc' }],
    });
  });

  it('normalizes rejected injected JSON-RPC requests without issuing fallback requests', async () => {
    const injectedProvider = {
      request: jest.fn().mockRejectedValue({ code: -32000, message: 'transport offline' }),
    };
    const chain = { id: 11155420, name: 'OP Sepolia' };

    await expect(switchWalletChain({ chain, injectedProvider })).resolves.toEqual(
      expect.objectContaining({
        ok: false,
        status: 'wallet-error',
        error: 'transport offline',
      })
    );
    expect(injectedProvider.request).toHaveBeenCalledTimes(1);
    expect(injectedProvider.request).toHaveBeenCalledWith({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: '0xaa37dc' }],
    });
  });

  it('switches wallet chains when the chain input exposes chainId but no id', async () => {
    const injectedProvider = { request: jest.fn().mockResolvedValue(null) };
    const chain = { chainId: 11155420, name: 'OP Sepolia' };

    await expect(switchWalletChain({ chain, injectedProvider })).resolves.toEqual(expect.objectContaining({
      ok: true,
      status: 'switched',
      provider: injectedProvider,
    }));
    expect(injectedProvider.request).toHaveBeenCalledWith({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: '0xaa37dc' }],
    });
  });

  it('adds wallet chains when switch reports an unknown chain', async () => {
    const injectedProvider = {
      request: jest.fn()
        .mockRejectedValueOnce({ code: 4902, message: 'Unrecognized chain ID' })
        .mockResolvedValueOnce(null),
    };
    const chain = {
      id: 11155420,
      name: 'OP Sepolia',
      nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
      rpcUrls: { default: { http: ['https://rpc.example'] } },
      blockExplorers: { default: { url: 'https://explorer.example' } },
    };

    await expect(switchWalletChain({ chain, injectedProvider })).resolves.toEqual(expect.objectContaining({
      ok: true,
      status: 'added',
    }));
    expect(injectedProvider.request).toHaveBeenNthCalledWith(2, {
      method: 'wallet_addEthereumChain',
      params: [{
        chainId: '0xaa37dc',
        chainName: 'OP Sepolia',
        nativeCurrency: chain.nativeCurrency,
        rpcUrls: ['https://rpc.example'],
        blockExplorerUrls: ['https://explorer.example'],
      }],
    });
  });

  it('adds wallet chains when the chain input exposes chainId but no id', async () => {
    const injectedProvider = { request: jest.fn().mockResolvedValue(null) };
    const chain = {
      chainId: 11155420,
      name: 'OP Sepolia',
      nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
      rpcUrls: { default: { http: ['https://rpc.example'] } },
      blockExplorers: { default: { url: 'https://explorer.example' } },
    };

    await expect(addWalletChain({ chain, injectedProvider })).resolves.toEqual(expect.objectContaining({
      ok: true,
      status: 'added',
    }));
    expect(injectedProvider.request).toHaveBeenCalledWith({
      method: 'wallet_addEthereumChain',
      params: [{
        chainId: '0xaa37dc',
        chainName: 'OP Sepolia',
        nativeCurrency: chain.nativeCurrency,
        rpcUrls: ['https://rpc.example'],
        blockExplorerUrls: ['https://explorer.example'],
      }],
    });
  });

  it('returns missing-provider status for add chain without an injected provider', async () => {
    await expect(addWalletChain({ chain: { id: 11155420 }, injectedProvider: null }))
      .resolves.toEqual(expect.objectContaining({
        ok: false,
        status: 'missing-provider',
      }));
  });
});
