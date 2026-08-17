import { createContractHelperMethods } from './contractHelpers.js';
import { __test__contractBlockCache } from '../cache/contractBlockCache.js';
import { defaultStrictAllowDemoFallback } from '../worker/workerSessionResolution.js';
import {
  SPONSORED_BOOTSTRAP_FUNDING_CONTEXT_KEY,
  clearSponsoredBootstrapFundingContext,
  readSponsoredBootstrapFundingContext,
  writeSponsoredBootstrapFundingContext,
} from '../session/sponsoredBootstrapFunding.js';

describe('contractHelpers sendTestnetFunds', () => {
  beforeEach(() => {
    sessionStorage.clear();
    clearSponsoredBootstrapFundingContext();
  });

  it('forwards optional faucet proof fields to the authenticated worker request', async () => {
    const fetchWorkerWithAuth = jest.fn(async () => ({
      ok: true,
      json: async () => ({ ok: true, txHash: '0xproof123' }),
    }));
    const getCorsProxyUrlOrThrow = jest.fn(async () => 'https://worker.example.com/base/');
    const helper = createContractHelperMethods({
      resolveSession: jest.fn(() => ({ slug: 'alpha', networkChainId: 84532 })),
      latestBlockCache: {},
      gasPriceCache: {},
      BLOCK_CACHE_MS: 1000,
      getReadProviderForGroup: jest.fn(),
      shouldLog: jest.fn(() => false),
      rpcLog: jest.fn(),
      callWithRetry: jest.fn(),
      MAX_CACHE_SIZE: 50,
      isLogsRangeTooLargeError: jest.fn(() => false),
      contractsLog: { warn: jest.fn(), log: jest.fn() },
      getReadProviderForChain: jest.fn(),
      normalizeSessionSlug: jest.fn((value) => value),
      shouldBypassSessionScopeWindow: jest.fn(() => false),
      getScopeDecisionForSlug: jest.fn(() => null),
      logScopeWindowSkipOnce: jest.fn(),
      parsePositiveBlockNumber: jest.fn(() => null),
      resolveSessionStartFromRegistry: jest.fn(() => null),
      DEFAULT_CHAIN_ID: 84532,
      store: {
        getState: () => ({
          profile: {
            account: '0x1111111111111111111111111111111111111111',
            provider: 'wagmi',
            network: { id: 84532 },
          },
          sessionState: { activeSessionSlug: 'alpha' },
        }),
      },
      getSessionConfigBySlug: jest.fn(() => ({ slug: 'alpha', networkChainId: 84532 })),
      getCorsProxyUrlOrThrow,
      fetchWorkerWithAuth,
    });

    const recipientAddress = '0x1111111111111111111111111111111111111111';
    const requestOptions = {
      amountEth: '0.0000001',
      sbtAddress: '0x2222222222222222222222222222222222222222',
      hashedPassword: `0x${'ab'.repeat(32)}`,
      signature: `0x${'cd'.repeat(65)}`,
    };

    const result = await helper.sendTestnetFunds(recipientAddress, 'alpha', requestOptions);
    const [workerUrl, init, authContext] = fetchWorkerWithAuth.mock.calls[0];
    const corsProxyOpts = getCorsProxyUrlOrThrow.mock.calls[0][0];

    expect(getCorsProxyUrlOrThrow).toHaveBeenCalledTimes(1);
    expect(corsProxyOpts).toEqual(
      expect.objectContaining({
        sessionSlug: 'alpha',
        allowDemoFallback: defaultStrictAllowDemoFallback(),
      }),
    );
    expect(workerUrl).toBe('https://worker.example.com/base');
    expect(JSON.parse(init.body)).toEqual({
      action: 'request_test_eth',
      to: recipientAddress,
      amountEth: '0.0000001',
      sbtAddress: '0x2222222222222222222222222222222222222222',
      hashedPassword: `0x${'ab'.repeat(32)}`,
      signature: `0x${'cd'.repeat(65)}`,
    });
    expect(authContext).toEqual(
      expect.objectContaining({
        sessionConfig: { slug: 'alpha', networkChainId: 84532 },
        sessionSlug: 'alpha',
        workerUrl: 'https://worker.example.com/base',
        allowDemoFallback: defaultStrictAllowDemoFallback(),
      }),
    );
    expect(result).toEqual({ ok: true, txHash: '0xproof123' });
  });

  it('preserves unknown non-general slugs for strict faucet worker resolution', async () => {
    const fetchWorkerWithAuth = jest.fn(async () => ({
      ok: true,
      json: async () => ({ ok: true, txHash: '0xstrict123' }),
    }));
    const getCorsProxyUrlOrThrow = jest.fn(async () => 'https://worker.example.com/base/');
    const helper = createContractHelperMethods({
      resolveSession: jest.fn(() => ({ slug: '', networkChainId: 84532 })),
      latestBlockCache: {},
      gasPriceCache: {},
      BLOCK_CACHE_MS: 1000,
      getReadProviderForGroup: jest.fn(),
      shouldLog: jest.fn(() => false),
      rpcLog: jest.fn(),
      callWithRetry: jest.fn(),
      MAX_CACHE_SIZE: 50,
      isLogsRangeTooLargeError: jest.fn(() => false),
      contractsLog: { warn: jest.fn(), log: jest.fn() },
      getReadProviderForChain: jest.fn(),
      normalizeSessionSlug: jest.fn((value) => value),
      shouldBypassSessionScopeWindow: jest.fn(() => false),
      getScopeDecisionForSlug: jest.fn(() => null),
      logScopeWindowSkipOnce: jest.fn(),
      parsePositiveBlockNumber: jest.fn(() => null),
      resolveSessionStartFromRegistry: jest.fn(() => null),
      DEFAULT_CHAIN_ID: 84532,
      store: {
        getState: () => ({
          profile: {
            account: '0x1111111111111111111111111111111111111111',
            provider: 'wagmi',
            network: { id: 84532 },
          },
          sessionState: { activeSessionSlug: 'missing-session' },
        }),
      },
      getSessionConfigBySlug: jest.fn(() => null),
      getCorsProxyUrlOrThrow,
      fetchWorkerWithAuth,
    });

    const recipientAddress = '0x1111111111111111111111111111111111111111';
    await helper.sendTestnetFunds(recipientAddress, 'missing-session');

    expect(getCorsProxyUrlOrThrow).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionSlug: 'missing-session',
        sessionConfig: null,
        allowDemoFallback: defaultStrictAllowDemoFallback(),
      }),
    );
    expect(fetchWorkerWithAuth).toHaveBeenCalledWith(
      'https://worker.example.com/base',
      expect.any(Object),
      expect.objectContaining({
        sessionSlug: 'missing-session',
        workerUrl: 'https://worker.example.com/base',
        allowDemoFallback: defaultStrictAllowDemoFallback(),
      }),
    );
  });

  it('uses explicit auth context overrides when the live wallet outpaces Redux', async () => {
    const fetchWorkerWithAuth = jest.fn(async () => ({
      ok: true,
      json: async () => ({ ok: true, txHash: '0xcontext123' }),
    }));
    const getCorsProxyUrlOrThrow = jest.fn(async () => 'https://worker.example.com/base/');
    const helper = createContractHelperMethods({
      resolveSession: jest.fn(() => ({ slug: 'alpha', networkChainId: 84532 })),
      latestBlockCache: {},
      gasPriceCache: {},
      BLOCK_CACHE_MS: 1000,
      getReadProviderForGroup: jest.fn(),
      shouldLog: jest.fn(() => false),
      rpcLog: jest.fn(),
      callWithRetry: jest.fn(),
      MAX_CACHE_SIZE: 50,
      isLogsRangeTooLargeError: jest.fn(() => false),
      contractsLog: { warn: jest.fn(), log: jest.fn() },
      getReadProviderForChain: jest.fn(),
      normalizeSessionSlug: jest.fn((value) => value),
      shouldBypassSessionScopeWindow: jest.fn(() => false),
      getScopeDecisionForSlug: jest.fn(() => null),
      logScopeWindowSkipOnce: jest.fn(),
      parsePositiveBlockNumber: jest.fn(() => null),
      resolveSessionStartFromRegistry: jest.fn(() => null),
      DEFAULT_CHAIN_ID: 84532,
      store: {
        getState: () => ({
          profile: {
            account: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
            provider: 'wagmi',
            network: { id: 84532 },
          },
          sessionState: { activeSessionSlug: 'alpha' },
        }),
      },
      getSessionConfigBySlug: jest.fn(() => ({ slug: 'alpha', networkChainId: 84532 })),
      getCorsProxyUrlOrThrow,
      fetchWorkerWithAuth,
    });

    const recipientAddress = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
    await helper.sendTestnetFunds(recipientAddress, 'alpha', {
      context: {
        account: recipientAddress,
        providerLike: 'wagmi',
        chainId: 84532,
      },
    });

    expect(getCorsProxyUrlOrThrow).toHaveBeenCalledWith(
      expect.objectContaining({
        context: expect.objectContaining({
          account: recipientAddress,
          providerLike: 'wagmi',
          chainId: 84532,
        }),
      }),
    );
    expect(fetchWorkerWithAuth).toHaveBeenCalledWith(
      'https://worker.example.com/base',
      expect.any(Object),
      expect.objectContaining({
        context: expect.objectContaining({
          account: recipientAddress,
          providerLike: 'wagmi',
          chainId: 84532,
        }),
      }),
    );
  });

  it('uses the session chain for faucet auth when the wallet is on a different network', async () => {
    const fetchWorkerWithAuth = jest.fn(async () => ({
      ok: true,
      json: async () => ({ ok: true, txHash: '0xop123' }),
    }));
    const getCorsProxyUrlOrThrow = jest.fn(async () => 'https://worker.example.com/base/');
    const helper = createContractHelperMethods({
      resolveSession: jest.fn(() => ({ slug: 'demo-1', networkChainId: 11155420 })),
      latestBlockCache: {},
      gasPriceCache: {},
      BLOCK_CACHE_MS: 1000,
      getReadProviderForGroup: jest.fn(),
      shouldLog: jest.fn(() => false),
      rpcLog: jest.fn(),
      callWithRetry: jest.fn(),
      MAX_CACHE_SIZE: 50,
      isLogsRangeTooLargeError: jest.fn(() => false),
      contractsLog: { warn: jest.fn(), log: jest.fn() },
      getReadProviderForChain: jest.fn(),
      normalizeSessionSlug: jest.fn((value) => value),
      shouldBypassSessionScopeWindow: jest.fn(() => false),
      getScopeDecisionForSlug: jest.fn(() => null),
      logScopeWindowSkipOnce: jest.fn(),
      parsePositiveBlockNumber: jest.fn(() => null),
      resolveSessionStartFromRegistry: jest.fn(() => null),
      DEFAULT_CHAIN_ID: 11155420,
      store: {
        getState: () => ({
          profile: {
            account: '0x1111111111111111111111111111111111111111',
            provider: 'wagmi',
            network: { id: 84532, chainId: 84532 },
          },
          sessionState: { activeSessionSlug: 'demo-1' },
        }),
      },
      getSessionConfigBySlug: jest.fn(() => ({
        slug: 'demo-1',
        networkChainId: 11155420,
      })),
      getCorsProxyUrlOrThrow,
      fetchWorkerWithAuth,
    });

    const recipientAddress = '0x1111111111111111111111111111111111111111';
    await helper.sendTestnetFunds(recipientAddress, 'demo-1');

    expect(getCorsProxyUrlOrThrow).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionSlug: 'demo-1',
        context: expect.objectContaining({
          chainId: 11155420,
        }),
      }),
    );
    expect(fetchWorkerWithAuth).toHaveBeenCalledWith(
      'https://worker.example.com/base',
      expect.any(Object),
      expect.objectContaining({
        sessionSlug: 'demo-1',
        context: expect.objectContaining({
          chainId: 11155420,
        }),
      }),
    );
  });

  it('refreshes session registry fields once when faucet worker URL resolution sees a stale cache', async () => {
    const staleConfig = {
      slug: 'demo-1',
      networkChainId: 11155420,
      __registry: { registryChainId: 11155420 },
    };
    const refreshedConfig = {
      ...staleConfig,
      corsWorkerUrl: 'https://demo-worker.example',
      sponsoredKeys: { faucet: true },
    };
    const fetchWorkerWithAuth = jest.fn(async () => ({
      ok: true,
      json: async () => ({ ok: true, txHash: '0xrefreshed123' }),
    }));
    const refreshSessionRegistryFieldsCache = jest.fn(async () => refreshedConfig);
    const getCorsProxyUrlOrThrow = jest
      .fn()
      .mockRejectedValueOnce(new Error('Worker URL is not configured.'))
      .mockResolvedValueOnce('https://demo-worker.example/');
    const getSessionConfigBySlug = jest.fn(() => staleConfig);
    const helper = createContractHelperMethods({
      resolveSession: jest.fn(() => staleConfig),
      latestBlockCache: {},
      gasPriceCache: {},
      BLOCK_CACHE_MS: 1000,
      getReadProviderForGroup: jest.fn(),
      shouldLog: jest.fn(() => false),
      rpcLog: jest.fn(),
      callWithRetry: jest.fn(),
      MAX_CACHE_SIZE: 50,
      isLogsRangeTooLargeError: jest.fn(() => false),
      contractsLog: { warn: jest.fn(), log: jest.fn() },
      getReadProviderForChain: jest.fn(),
      normalizeSessionSlug: jest.fn((value) => value),
      shouldBypassSessionScopeWindow: jest.fn(() => false),
      getScopeDecisionForSlug: jest.fn(() => null),
      logScopeWindowSkipOnce: jest.fn(),
      parsePositiveBlockNumber: jest.fn(() => null),
      resolveSessionStartFromRegistry: jest.fn(() => null),
      DEFAULT_CHAIN_ID: 11155420,
      store: {
        getState: () => ({
          profile: {
            account: '0x1111111111111111111111111111111111111111',
            provider: 'wagmi',
            network: { id: 84532, chainId: 84532 },
          },
          sessionState: { activeSessionSlug: 'demo-1' },
        }),
      },
      getSessionConfigBySlug,
      refreshSessionRegistryFieldsCache,
      getCorsProxyUrlOrThrow,
      fetchWorkerWithAuth,
    });

    const recipientAddress = '0x1111111111111111111111111111111111111111';
    const result = await helper.sendTestnetFunds(recipientAddress, 'demo-1');

    expect(refreshSessionRegistryFieldsCache).toHaveBeenCalledTimes(1);
    expect(refreshSessionRegistryFieldsCache).toHaveBeenCalledWith(
      expect.objectContaining({
        chainId: 11155420,
        slug: 'demo-1',
        providerLike: 'wagmi',
      }),
    );
    expect(getCorsProxyUrlOrThrow).toHaveBeenCalledTimes(2);
    expect(getCorsProxyUrlOrThrow).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        sessionSlug: 'demo-1',
        sessionConfig: staleConfig,
      }),
    );
    expect(getCorsProxyUrlOrThrow).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        sessionSlug: 'demo-1',
        sessionConfig: refreshedConfig,
      }),
    );
    expect(fetchWorkerWithAuth).toHaveBeenCalledWith(
      'https://demo-worker.example',
      expect.any(Object),
      expect.objectContaining({
        sessionConfig: refreshedConfig,
        sessionSlug: 'demo-1',
        workerUrl: 'https://demo-worker.example',
      }),
    );
    expect(result).toEqual({ ok: true, txHash: '0xrefreshed123' });
  });

  it('retries testnet funding against the sponsored source session when the requested session is not deployable yet', async () => {
    writeSponsoredBootstrapFundingContext({
      sessionSlug: 'source-session',
      workerUrl: 'https://source-worker.example',
      targetSessionSlug: '',
    });

    const fetchWorkerWithAuth = jest.fn(async () => ({
      ok: true,
      json: async () => ({ ok: true, txHash: '0xbootstrap123' }),
    }));
    const getCorsProxyUrlOrThrow = jest.fn(async () => {
      throw new Error('Worker URL unavailable for requested session');
    });
    const helper = createContractHelperMethods({
      resolveSession: jest.fn(() => ({ slug: '', networkChainId: 84532 })),
      latestBlockCache: {},
      gasPriceCache: {},
      BLOCK_CACHE_MS: 1000,
      getReadProviderForGroup: jest.fn(),
      shouldLog: jest.fn(() => false),
      rpcLog: jest.fn(),
      callWithRetry: jest.fn(),
      MAX_CACHE_SIZE: 50,
      isLogsRangeTooLargeError: jest.fn(() => false),
      contractsLog: { warn: jest.fn(), log: jest.fn() },
      getReadProviderForChain: jest.fn(),
      normalizeSessionSlug: jest.fn((value) => value),
      shouldBypassSessionScopeWindow: jest.fn(() => false),
      getScopeDecisionForSlug: jest.fn(() => null),
      logScopeWindowSkipOnce: jest.fn(),
      parsePositiveBlockNumber: jest.fn(() => null),
      resolveSessionStartFromRegistry: jest.fn(() => null),
      DEFAULT_CHAIN_ID: 84532,
      store: {
        getState: () => ({
          profile: {
            account: '0x1111111111111111111111111111111111111111',
            provider: 'wagmi',
            network: { id: 84532 },
          },
          sessionState: { activeSessionSlug: '' },
        }),
      },
      getSessionConfigBySlug: jest.fn((slug) =>
        slug === 'source-session' ? { slug: 'source-session', networkChainId: 84532 } : null,
      ),
      getCorsProxyUrlOrThrow,
      fetchWorkerWithAuth,
    });

    const recipientAddress = '0x1111111111111111111111111111111111111111';
    const result = await helper.sendTestnetFunds(recipientAddress, '');

    expect(getCorsProxyUrlOrThrow).toHaveBeenCalledTimes(1);
    expect(fetchWorkerWithAuth).toHaveBeenCalledWith(
      'https://source-worker.example',
      expect.any(Object),
      expect.objectContaining({
        sessionSlug: 'source-session',
        workerUrl: 'https://source-worker.example',
        allowDemoFallback: defaultStrictAllowDemoFallback(),
      }),
    );
    expect(result).toEqual({ ok: true, txHash: '0xbootstrap123' });
  });

  it('redeems a one-time sponsored faucet grant before falling back to authenticated source-session funding', async () => {
    writeSponsoredBootstrapFundingContext({
      sessionSlug: 'source-session',
      workerUrl: 'https://source-worker.example',
      targetSessionSlug: '',
      faucetGrantToken: 'faucet-grant-1',
    });

    const fetchWorkerWithAuth = jest.fn(async () => ({
      ok: true,
      json: async () => ({ ok: true, txHash: '0xshould-not-be-used' }),
    }));
    const fetchImpl = jest.fn(async () => ({
      ok: true,
      json: async () => ({ ok: true, txHash: '0xbootstrap-faucet-grant' }),
    }));
    const getCorsProxyUrlOrThrow = jest.fn(async () => {
      throw new Error('Worker URL unavailable for requested session');
    });
    const helper = createContractHelperMethods({
      resolveSession: jest.fn(() => ({ slug: '', networkChainId: 84532 })),
      latestBlockCache: {},
      gasPriceCache: {},
      BLOCK_CACHE_MS: 1000,
      getReadProviderForGroup: jest.fn(),
      shouldLog: jest.fn(() => false),
      rpcLog: jest.fn(),
      callWithRetry: jest.fn(),
      MAX_CACHE_SIZE: 50,
      isLogsRangeTooLargeError: jest.fn(() => false),
      contractsLog: { warn: jest.fn(), log: jest.fn() },
      getReadProviderForChain: jest.fn(),
      normalizeSessionSlug: jest.fn((value) => value),
      shouldBypassSessionScopeWindow: jest.fn(() => false),
      getScopeDecisionForSlug: jest.fn(() => null),
      logScopeWindowSkipOnce: jest.fn(),
      parsePositiveBlockNumber: jest.fn(() => null),
      resolveSessionStartFromRegistry: jest.fn(() => null),
      DEFAULT_CHAIN_ID: 84532,
      store: {
        getState: () => ({
          profile: {
            account: '0x1111111111111111111111111111111111111111',
            provider: 'wagmi',
            network: { id: 84532 },
          },
          sessionState: { activeSessionSlug: '' },
        }),
      },
      getSessionConfigBySlug: jest.fn(() => null),
      getCorsProxyUrlOrThrow,
      fetchWorkerWithAuth,
      fetchImpl,
    });

    const recipientAddress = '0x1111111111111111111111111111111111111111';
    const result = await helper.sendTestnetFunds(recipientAddress, '');

    expect(fetchImpl).toHaveBeenCalledWith('https://source-worker.example/sponsored/redeem-faucet', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        faucetGrantToken: 'faucet-grant-1',
        to: recipientAddress,
      }),
    });
    expect(fetchWorkerWithAuth).not.toHaveBeenCalled();
    expect(result).toEqual({ ok: true, txHash: '0xbootstrap-faucet-grant' });
  });

  it('does not reuse sponsored bootstrap funding context for a different target session', async () => {
    writeSponsoredBootstrapFundingContext({
      sessionSlug: 'source-session',
      workerUrl: 'https://source-worker.example',
      targetSessionSlug: 'sponsored-target',
    });

    const fetchWorkerWithAuth = jest.fn(async () => ({
      ok: true,
      json: async () => ({ ok: true, txHash: '0xshould-not-fallback' }),
    }));
    const getCorsProxyUrlOrThrow = jest.fn(async () => {
      throw new Error('Worker URL unavailable for requested session');
    });
    const helper = createContractHelperMethods({
      resolveSession: jest.fn(() => ({ slug: 'different-session', networkChainId: 84532 })),
      latestBlockCache: {},
      gasPriceCache: {},
      BLOCK_CACHE_MS: 1000,
      getReadProviderForGroup: jest.fn(),
      shouldLog: jest.fn(() => false),
      rpcLog: jest.fn(),
      callWithRetry: jest.fn(),
      MAX_CACHE_SIZE: 50,
      isLogsRangeTooLargeError: jest.fn(() => false),
      contractsLog: { warn: jest.fn(), log: jest.fn() },
      getReadProviderForChain: jest.fn(),
      normalizeSessionSlug: jest.fn((value) => value),
      shouldBypassSessionScopeWindow: jest.fn(() => false),
      getScopeDecisionForSlug: jest.fn(() => null),
      logScopeWindowSkipOnce: jest.fn(),
      parsePositiveBlockNumber: jest.fn(() => null),
      resolveSessionStartFromRegistry: jest.fn(() => null),
      DEFAULT_CHAIN_ID: 84532,
      store: {
        getState: () => ({
          profile: {
            account: '0x1111111111111111111111111111111111111111',
            provider: 'wagmi',
            network: { id: 84532 },
          },
          sessionState: { activeSessionSlug: 'different-session' },
        }),
      },
      getSessionConfigBySlug: jest.fn(() => ({ slug: 'different-session', networkChainId: 84532 })),
      getCorsProxyUrlOrThrow,
      fetchWorkerWithAuth,
    });

    const recipientAddress = '0x1111111111111111111111111111111111111111';
    await expect(helper.sendTestnetFunds(recipientAddress, 'different-session')).rejects.toThrow(
      'Failed to request test ETH: Worker URL unavailable for requested session',
    );

    expect(fetchWorkerWithAuth).not.toHaveBeenCalled();
    expect(getCorsProxyUrlOrThrow).toHaveBeenCalledTimes(1);
  });

  it('does not retry sponsored bootstrap funding on non-deployability worker failures', async () => {
    writeSponsoredBootstrapFundingContext({
      sessionSlug: 'source-session',
      workerUrl: 'https://source-worker.example',
      targetSessionSlug: 'sponsored-target',
    });

    const fetchWorkerWithAuth = jest.fn(async () => ({
      ok: false,
      status: 429,
      json: async () => ({ error: 'Too many requests' }),
    }));
    const getCorsProxyUrlOrThrow = jest.fn(async () => 'https://target-worker.example');
    const helper = createContractHelperMethods({
      resolveSession: jest.fn(() => ({ slug: 'sponsored-target', networkChainId: 84532 })),
      latestBlockCache: {},
      gasPriceCache: {},
      BLOCK_CACHE_MS: 1000,
      getReadProviderForGroup: jest.fn(),
      shouldLog: jest.fn(() => false),
      rpcLog: jest.fn(),
      callWithRetry: jest.fn(),
      MAX_CACHE_SIZE: 50,
      isLogsRangeTooLargeError: jest.fn(() => false),
      contractsLog: { warn: jest.fn(), log: jest.fn() },
      getReadProviderForChain: jest.fn(),
      normalizeSessionSlug: jest.fn((value) => value),
      shouldBypassSessionScopeWindow: jest.fn(() => false),
      getScopeDecisionForSlug: jest.fn(() => null),
      logScopeWindowSkipOnce: jest.fn(),
      parsePositiveBlockNumber: jest.fn(() => null),
      resolveSessionStartFromRegistry: jest.fn(() => null),
      DEFAULT_CHAIN_ID: 84532,
      store: {
        getState: () => ({
          profile: {
            account: '0x1111111111111111111111111111111111111111',
            provider: 'wagmi',
            network: { id: 84532 },
          },
          sessionState: { activeSessionSlug: 'sponsored-target' },
        }),
      },
      getSessionConfigBySlug: jest.fn((slug) =>
        slug === 'sponsored-target'
          ? { slug: 'sponsored-target', networkChainId: 84532 }
          : { slug: 'source-session', networkChainId: 84532 },
      ),
      getCorsProxyUrlOrThrow,
      fetchWorkerWithAuth,
    });

    const recipientAddress = '0x1111111111111111111111111111111111111111';
    await expect(helper.sendTestnetFunds(recipientAddress, 'sponsored-target')).rejects.toThrow(
      'Failed to request test ETH: Too many requests',
    );

    expect(fetchWorkerWithAuth).toHaveBeenCalledTimes(1);
    expect(fetchWorkerWithAuth).toHaveBeenCalledWith(
      'https://target-worker.example',
      expect.any(Object),
      expect.objectContaining({
        sessionSlug: 'sponsored-target',
        workerUrl: 'https://target-worker.example',
      }),
    );
  });

  it('preserves faucet failure metadata when the worker rejects a self-funding request', async () => {
    const fetchWorkerWithAuth = jest.fn(async () => ({
      ok: false,
      status: 403,
      json: async () => ({
        error: 'Access denied: txGas gate failed for this wallet.',
        reason: 'txgas-gate-denied',
        details: [{ rpcUrl: 'masked:https://rpc.example', error: 'down' }],
      }),
    }));
    const getCorsProxyUrlOrThrow = jest.fn(async () => 'https://target-worker.example');
    const helper = createContractHelperMethods({
      resolveSession: jest.fn(() => ({ slug: 'sponsored-target', networkChainId: 84532 })),
      latestBlockCache: {},
      gasPriceCache: {},
      BLOCK_CACHE_MS: 1000,
      getReadProviderForGroup: jest.fn(),
      shouldLog: jest.fn(() => false),
      rpcLog: jest.fn(),
      callWithRetry: jest.fn(),
      MAX_CACHE_SIZE: 50,
      isLogsRangeTooLargeError: jest.fn(() => false),
      contractsLog: { warn: jest.fn(), log: jest.fn() },
      getReadProviderForChain: jest.fn(),
      normalizeSessionSlug: jest.fn((value) => value),
      shouldBypassSessionScopeWindow: jest.fn(() => false),
      getScopeDecisionForSlug: jest.fn(() => null),
      logScopeWindowSkipOnce: jest.fn(),
      parsePositiveBlockNumber: jest.fn(() => null),
      resolveSessionStartFromRegistry: jest.fn(() => null),
      DEFAULT_CHAIN_ID: 84532,
      store: {
        getState: () => ({
          profile: {
            account: '0x1111111111111111111111111111111111111111',
            provider: 'wagmi',
            network: { id: 84532 },
          },
          sessionState: { activeSessionSlug: 'sponsored-target' },
        }),
      },
      getSessionConfigBySlug: jest.fn(() => ({ slug: 'sponsored-target', networkChainId: 84532 })),
      getCorsProxyUrlOrThrow,
      fetchWorkerWithAuth,
    });

    let failure = null;
    try {
      await helper.sendTestnetFunds('0x1111111111111111111111111111111111111111', 'sponsored-target');
    } catch (error) {
      failure = error;
    }

    expect(failure).toBeTruthy();
    expect(failure.message).toBe('Failed to request test ETH: Access denied: txGas gate failed for this wallet.');
    expect(failure.status).toBe(403);
    expect(failure.reason).toBe('txgas-gate-denied');
    expect(failure.details).toEqual([{ rpcUrl: 'masked:https://rpc.example', error: 'down' }]);
  });

  it('retries sponsored bootstrap funding when the deployed worker is missing a local faucet key', async () => {
    writeSponsoredBootstrapFundingContext({
      sessionSlug: 'source-session',
      workerUrl: 'https://source-worker.example',
      targetSessionSlug: 'sponsored-target',
      faucetGrantToken: 'faucet-grant-1',
    });

    const fetchWorkerWithAuth = jest.fn(async () => ({
      ok: false,
      status: 401,
      json: async () => ({ error: 'Server misconfigured: faucetPrivateKey is missing.' }),
    }));
    const fetchImpl = jest.fn(async () => ({
      ok: true,
      json: async () => ({ ok: true, txHash: '0xbootstrap-faucet-grant' }),
    }));
    const getCorsProxyUrlOrThrow = jest.fn(async () => 'https://target-worker.example');
    const helper = createContractHelperMethods({
      resolveSession: jest.fn(() => ({ slug: 'sponsored-target', networkChainId: 84532 })),
      latestBlockCache: {},
      gasPriceCache: {},
      BLOCK_CACHE_MS: 1000,
      getReadProviderForGroup: jest.fn(),
      shouldLog: jest.fn(() => false),
      rpcLog: jest.fn(),
      callWithRetry: jest.fn(),
      MAX_CACHE_SIZE: 50,
      isLogsRangeTooLargeError: jest.fn(() => false),
      contractsLog: { warn: jest.fn(), log: jest.fn() },
      getReadProviderForChain: jest.fn(),
      normalizeSessionSlug: jest.fn((value) => value),
      shouldBypassSessionScopeWindow: jest.fn(() => false),
      getScopeDecisionForSlug: jest.fn(() => null),
      logScopeWindowSkipOnce: jest.fn(),
      parsePositiveBlockNumber: jest.fn(() => null),
      resolveSessionStartFromRegistry: jest.fn(() => null),
      DEFAULT_CHAIN_ID: 84532,
      store: {
        getState: () => ({
          profile: {
            account: '0x1111111111111111111111111111111111111111',
            provider: 'wagmi',
            network: { id: 84532 },
          },
          sessionState: { activeSessionSlug: 'sponsored-target' },
        }),
      },
      getSessionConfigBySlug: jest.fn((slug) =>
        slug === 'sponsored-target'
          ? { slug: 'sponsored-target', networkChainId: 84532 }
          : { slug: 'source-session', networkChainId: 84532 },
      ),
      getCorsProxyUrlOrThrow,
      fetchWorkerWithAuth,
      fetchImpl,
    });

    const recipientAddress = '0x1111111111111111111111111111111111111111';
    const result = await helper.sendTestnetFunds(recipientAddress, 'sponsored-target');

    expect(fetchWorkerWithAuth).toHaveBeenCalledTimes(1);
    expect(fetchWorkerWithAuth).toHaveBeenCalledWith(
      'https://target-worker.example',
      expect.any(Object),
      expect.objectContaining({
        sessionSlug: 'sponsored-target',
        workerUrl: 'https://target-worker.example',
      }),
    );
    expect(fetchImpl).toHaveBeenCalledWith('https://source-worker.example/sponsored/redeem-faucet', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        faucetGrantToken: 'faucet-grant-1',
        to: recipientAddress,
      }),
    });
    expect(readSponsoredBootstrapFundingContext()).toEqual({
      sessionSlug: 'source-session',
      workerUrl: 'https://source-worker.example',
      targetSessionSlug: 'sponsored-target',
    });
    expect(sessionStorage.getItem(SPONSORED_BOOTSTRAP_FUNDING_CONTEXT_KEY)).toBeNull();
    expect(result).toEqual({ ok: true, txHash: '0xbootstrap-faucet-grant' });
  });

  it('consumes one-time sponsored faucet grants instead of reusing them on later missing-key retries', async () => {
    writeSponsoredBootstrapFundingContext({
      sessionSlug: 'source-session',
      workerUrl: 'https://source-worker.example',
      targetSessionSlug: 'sponsored-target',
      faucetGrantToken: 'faucet-grant-1',
    });

    const fetchWorkerWithAuth = jest
      .fn()
      .mockImplementationOnce(async () => ({
        ok: false,
        status: 401,
        json: async () => ({ error: 'Server misconfigured: faucetPrivateKey is missing.' }),
      }))
      .mockImplementationOnce(async () => ({
        ok: false,
        status: 401,
        json: async () => ({ error: 'Server misconfigured: faucetPrivateKey is missing.' }),
      }));
    const fetchImpl = jest.fn(async () => ({
      ok: true,
      json: async () => ({ ok: true, txHash: '0xbootstrap-faucet-grant' }),
    }));
    const getCorsProxyUrlOrThrow = jest.fn(async () => 'https://target-worker.example');
    const helper = createContractHelperMethods({
      resolveSession: jest.fn(() => ({ slug: 'sponsored-target', networkChainId: 84532 })),
      latestBlockCache: {},
      gasPriceCache: {},
      BLOCK_CACHE_MS: 1000,
      getReadProviderForGroup: jest.fn(),
      shouldLog: jest.fn(() => false),
      rpcLog: jest.fn(),
      callWithRetry: jest.fn(),
      MAX_CACHE_SIZE: 50,
      isLogsRangeTooLargeError: jest.fn(() => false),
      contractsLog: { warn: jest.fn(), log: jest.fn() },
      getReadProviderForChain: jest.fn(),
      normalizeSessionSlug: jest.fn((value) => value),
      shouldBypassSessionScopeWindow: jest.fn(() => false),
      getScopeDecisionForSlug: jest.fn(() => null),
      logScopeWindowSkipOnce: jest.fn(),
      parsePositiveBlockNumber: jest.fn(() => null),
      resolveSessionStartFromRegistry: jest.fn(() => null),
      DEFAULT_CHAIN_ID: 84532,
      store: {
        getState: () => ({
          profile: {
            account: '0x1111111111111111111111111111111111111111',
            provider: 'wagmi',
            network: { id: 84532 },
          },
          sessionState: { activeSessionSlug: 'sponsored-target' },
        }),
      },
      getSessionConfigBySlug: jest.fn((slug) =>
        slug === 'sponsored-target'
          ? { slug: 'sponsored-target', networkChainId: 84532 }
          : { slug: 'source-session', networkChainId: 84532 },
      ),
      getCorsProxyUrlOrThrow,
      fetchWorkerWithAuth,
      fetchImpl,
    });

    const recipientAddress = '0x1111111111111111111111111111111111111111';
    const firstResult = await helper.sendTestnetFunds(recipientAddress, 'sponsored-target');

    expect(firstResult).toEqual({ ok: true, txHash: '0xbootstrap-faucet-grant' });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(readSponsoredBootstrapFundingContext()).toEqual({
      sessionSlug: 'source-session',
      workerUrl: 'https://source-worker.example',
      targetSessionSlug: 'sponsored-target',
    });
    expect(sessionStorage.getItem(SPONSORED_BOOTSTRAP_FUNDING_CONTEXT_KEY)).toBeNull();

    await expect(helper.sendTestnetFunds(recipientAddress, 'sponsored-target')).rejects.toThrow(
      'Failed to request test ETH: Server misconfigured: faucetPrivateKey is missing.',
    );
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});

describe('contractHelpers session-aware cache keys', () => {
  const makeReadHelper = () => {
    const alphaProvider = {
      getBlockNumber: jest.fn(async () => 101),
      getGasPrice: jest.fn(async () => '11'),
      __CE_RPC_META: {
        providerMode: 'fallback',
        providerLabel: 'path',
        preferredUrls: ['https://alpha-rpc.example'],
      },
    };
    const betaProvider = {
      getBlockNumber: jest.fn(async () => 202),
      getGasPrice: jest.fn(async () => '22'),
      __CE_RPC_META: {
        providerMode: 'fallback',
        providerLabel: 'path',
        preferredUrls: ['https://beta-rpc.example'],
      },
    };
    const getReadProviderForGroup = jest.fn((groupKeyOrCfg) =>
      groupKeyOrCfg === 'beta' ? betaProvider : alphaProvider,
    );
    const helper = createContractHelperMethods({
      resolveSession: jest.fn((groupKeyOrCfg) => ({
        slug: groupKeyOrCfg || 'general',
        networkChainId: 84532,
      })),
      latestBlockCache: {},
      gasPriceCache: {},
      BLOCK_CACHE_MS: 1000,
      getReadProviderForGroup,
      shouldLog: jest.fn(() => false),
      rpcLog: jest.fn(),
      callWithRetry: jest.fn((fn) => fn()),
      MAX_CACHE_SIZE: 50,
      isLogsRangeTooLargeError: jest.fn(() => false),
      contractsLog: { warn: jest.fn(), log: jest.fn() },
      getReadProviderForChain: jest.fn(),
      normalizeSessionSlug: jest.fn((value) => value),
      shouldBypassSessionScopeWindow: jest.fn(() => false),
      getScopeDecisionForSlug: jest.fn(() => null),
      logScopeWindowSkipOnce: jest.fn(),
      parsePositiveBlockNumber: jest.fn(() => null),
      resolveSessionStartFromRegistry: jest.fn(() => null),
      DEFAULT_CHAIN_ID: 84532,
      store: { getState: () => ({}) },
      getSessionConfigBySlug: jest.fn(() => null),
      getCorsProxyUrlOrThrow: jest.fn(),
      fetchWorkerWithAuth: jest.fn(),
    });
    return {
      helper,
      alphaProvider,
      betaProvider,
      getReadProviderForGroup,
    };
  };

  it('does not share latest-block cache across same-chain sessions with different provider scopes', async () => {
    const { helper, alphaProvider, betaProvider } = makeReadHelper();

    const alphaBlock = await helper.getLatestBlockNumber('none', 'alpha');
    const betaBlock = await helper.getLatestBlockNumber('none', 'beta');

    expect(alphaBlock).toBe(101);
    expect(betaBlock).toBe(202);
    expect(alphaProvider.getBlockNumber).toHaveBeenCalledTimes(1);
    expect(betaProvider.getBlockNumber).toHaveBeenCalledTimes(1);
  });

  it('does not share gas-price cache across same-chain sessions with different provider scopes', async () => {
    const { helper, alphaProvider, betaProvider } = makeReadHelper();

    const alphaGas = await helper.getGasPrice('alpha');
    const betaGas = await helper.getGasPrice('beta');

    expect(alphaGas).toBe('11');
    expect(betaGas).toBe('22');
    expect(alphaProvider.getGasPrice).toHaveBeenCalledTimes(1);
    expect(betaProvider.getGasPrice).toHaveBeenCalledTimes(1);
  });
});

describe('contractHelpers resolved cfg pass-through', () => {
  it('uses opts._resolvedCfg for block windows without re-resolving the session', async () => {
    const resolveSession = jest.fn(() => {
      throw new Error('resolveSession should be skipped when _resolvedCfg is provided');
    });
    const helper = createContractHelperMethods({
      resolveSession,
      latestBlockCache: {},
      gasPriceCache: {},
      BLOCK_CACHE_MS: 1000,
      getReadProviderForGroup: jest.fn(() => ({
        getBlockNumber: jest.fn(async () => 4321),
      })),
      shouldLog: jest.fn(() => false),
      rpcLog: jest.fn(),
      callWithRetry: jest.fn((fn) => fn()),
      MAX_CACHE_SIZE: 50,
      isLogsRangeTooLargeError: jest.fn(() => false),
      contractsLog: { warn: jest.fn(), log: jest.fn() },
      getReadProviderForChain: jest.fn(),
      normalizeSessionSlug: jest.fn((value) => value),
      shouldBypassSessionScopeWindow: jest.fn(() => false),
      getScopeDecisionForSlug: jest.fn(() => ({ allowed: true })),
      logScopeWindowSkipOnce: jest.fn(),
      parsePositiveBlockNumber: jest.fn((value) => {
        const numberValue = Number(value || 0);
        return Number.isFinite(numberValue) && numberValue > 0 ? numberValue : null;
      }),
      resolveSessionStartFromRegistry: jest.fn(() => null),
      DEFAULT_CHAIN_ID: 84532,
      store: { getState: () => ({}) },
      getSessionConfigBySlug: jest.fn(() => null),
      getCorsProxyUrlOrThrow: jest.fn(),
      fetchWorkerWithAuth: jest.fn(),
    });

    const resolvedCfg = {
      slug: 'alpha',
      networkChainId: 84532,
      blockLimits: {
        start: 120,
        end: null,
      },
      contracts: {},
    };

    const result = await helper.getRelevantBlockWindowForFilter('missing-session', {
      _resolvedCfg: resolvedCfg,
    });

    expect(result).toEqual({ fromBlock: 120, toBlock: 4321 });
    expect(resolveSession).not.toHaveBeenCalled();
  });
});

describe('contractHelpers getBlockWithCaching', () => {
  const buildHelper = ({ maxEntries = 50, ttlMs = 1000 } = {}) => {
    const callWithRetry = jest.fn((fn) => fn());
    const helper = createContractHelperMethods({
      resolveSession: jest.fn(() => ({ slug: 'alpha', networkChainId: 84532 })),
      latestBlockCache: {},
      gasPriceCache: {},
      BLOCK_CACHE_MS: ttlMs,
      getReadProviderForGroup: jest.fn(),
      shouldLog: jest.fn(() => false),
      rpcLog: jest.fn(),
      callWithRetry,
      MAX_CACHE_SIZE: maxEntries,
      isLogsRangeTooLargeError: jest.fn(() => false),
      contractsLog: { warn: jest.fn(), log: jest.fn() },
      getReadProviderForChain: jest.fn(),
      normalizeSessionSlug: jest.fn((value) => value),
      shouldBypassSessionScopeWindow: jest.fn(() => false),
      getScopeDecisionForSlug: jest.fn(() => null),
      logScopeWindowSkipOnce: jest.fn(),
      parsePositiveBlockNumber: jest.fn(() => null),
      resolveSessionStartFromRegistry: jest.fn(() => null),
      DEFAULT_CHAIN_ID: 84532,
      store: { getState: () => ({}) },
      getSessionConfigBySlug: jest.fn(() => null),
      getCorsProxyUrlOrThrow: jest.fn(),
      fetchWorkerWithAuth: jest.fn(),
    });
    return { helper, callWithRetry };
  };

  afterEach(() => {
    __test__contractBlockCache.clear();
    jest.restoreAllMocks();
  });

  it('caches same-chain block lookups without caller-owned cache state', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(1000);
    const provider = {
      getBlock: jest.fn(async (blockNumber) => ({ number: Number(blockNumber), hash: `0x${blockNumber}` })),
    };
    const { helper, callWithRetry } = buildHelper();

    const first = await helper.getBlockWithCaching(provider, 123, 'none', '84532');
    const second = await helper.getBlockWithCaching(provider, 123, 'none', '84532');

    expect(second).toBe(first);
    expect(provider.getBlock).toHaveBeenCalledTimes(1);
    expect(callWithRetry).toHaveBeenCalledTimes(1);
  });

  it('does not share block cache entries across chain keys', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(1000);
    const provider = {
      getBlock: jest.fn(async (blockNumber) => ({ number: Number(blockNumber), hash: `0x${blockNumber}` })),
    };
    const { helper } = buildHelper();

    await helper.getBlockWithCaching(provider, 123, 'none', '84532');
    await helper.getBlockWithCaching(provider, 123, 'none', '11155420');

    expect(provider.getBlock).toHaveBeenCalledTimes(2);
  });

  it('evicts the oldest cached block when the cache reaches its size limit', async () => {
    let now = 1000;
    jest.spyOn(Date, 'now').mockImplementation(() => now);
    const provider = {
      getBlock: jest.fn(async (blockNumber) => ({ number: Number(blockNumber), hash: `0x${blockNumber}` })),
    };
    const { helper } = buildHelper({ maxEntries: 2, ttlMs: 1000 });

    await helper.getBlockWithCaching(provider, 1, 'none', '84532');
    now += 10;
    await helper.getBlockWithCaching(provider, 2, 'none', '84532');
    now += 10;
    await helper.getBlockWithCaching(provider, 3, 'none', '84532');
    now += 10;
    await helper.getBlockWithCaching(provider, 1, 'none', '84532');

    expect(provider.getBlock).toHaveBeenCalledTimes(4);
    expect(provider.getBlock.mock.calls.map(([blockNumber]) => blockNumber)).toEqual([1, 2, 3, 1]);
  });
});
