import { ethers } from 'ethers';
import { getReadProviderForGroup } from './rpcProviders.js';

jest.mock('../logging.js', () => ({
  __mockRpcLogger: {
    log: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    isEnabled: jest.fn(() => false),
  },
  createLogger: jest.fn((category) => {
    const { __mockRpcLogger } = jest.requireMock('../logging.js');
    if (category === 'rpc') return __mockRpcLogger;
    return {
      log: jest.fn(),
      info: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      isEnabled: jest.fn(() => false),
    };
  }),
  shouldLog: jest.fn(() => false),
}));

const { __mockRpcLogger: mockRpcLogger } = jest.requireMock('../logging.js');

const PATH_DEFAULT_OP_SEPOLIA = 'https://op-sepolia-testnet.api.pocket.network';

const buildGroupCfg = () => ({
  slug: 'path-fallback-log-test',
  networkChainId: 11155420,
  contracts: {
    sbtFactory: {
      address: '0x00000000000000000000000000000000000000aa',
      chainId: 11155420,
    },
    surveys: {
      address: '0x00000000000000000000000000000000000000ab',
      chainId: 11155420,
    },
  },
  rpc: {
    provider: 'path',
    providers: {
      path: {
        rpcUrl: PATH_DEFAULT_OP_SEPOLIA,
      },
    },
  },
});

describe('rpcProviders PATH fallback logging', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    try {
      globalThis.CE_PREFER_PATH_RPC = true;
    } catch (_) {}
  });

  afterEach(() => {
    jest.restoreAllMocks();
    try {
      delete globalThis.CE_PREFER_PATH_RPC;
    } catch (_) {}
  });

  it('logs PATH transport fallback failures as warnings instead of errors', async () => {
    const performSpy = jest.spyOn(ethers.providers.JsonRpcProvider.prototype, 'perform').mockRejectedValue(
      Object.assign(new Error('bad response'), {
        code: 'SERVER_ERROR',
        status: 500,
      }),
    );

    const provider = getReadProviderForGroup(buildGroupCfg());
    const pathProvider = provider?.providerConfigs?.[0]?.provider;

    await expect(pathProvider.perform('getLogs', {})).rejects.toThrow('bad response');

    expect(mockRpcLogger.warn).toHaveBeenCalledWith(
      'PATH RPC failed; falling back',
      expect.objectContaining({
        url: PATH_DEFAULT_OP_SEPOLIA,
        code: 'SERVER_ERROR',
        chainId: 11155420,
        method: 'getLogs',
      }),
    );
    expect(mockRpcLogger.error).not.toHaveBeenCalled();

    performSpy.mockRestore();
  });

  it('honors skipGlobalPreferred for historical log scans', () => {
    const provider = getReadProviderForGroup(buildGroupCfg(), {
      contractKey: 'sbtFactory',
      skipGlobalPreferred: true,
    });
    const urls = (provider?.providerConfigs || []).map((entry) => entry?.provider?.connection?.url).filter(Boolean);

    expect(urls[0]).not.toBe(PATH_DEFAULT_OP_SEPOLIA);
    expect(urls).not.toContain(PATH_DEFAULT_OP_SEPOLIA);
  });
});
