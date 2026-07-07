const ENV_KEYS = [
  'REACT_APP_CE_USE_INFURA_RPC',
  'REACT_APP_CE_RPC_PROVIDER_MODE',
  'REACT_APP_CE_BASE_SEPOLIA_PAID_RPC_URL_HTTP',
  'REACT_APP_CE_BASE_SEPOLIA_PAID_RPC_URL_WSS',
  'REACT_APP_CE_OP_SEPOLIA_PAID_RPC_URL_HTTP',
  'REACT_APP_CE_OP_SEPOLIA_PAID_RPC_URL_WSS',
];

const GLOBAL_KEYS = [
  'CE_BASE_SEPOLIA_PAID_RPC_URL_HTTP',
  'CE_BASE_SEPOLIA_PAID_RPC_URL_WSS',
  'CE_OP_SEPOLIA_PAID_RPC_URL_HTTP',
  'CE_OP_SEPOLIA_PAID_RPC_URL_WSS',
  'CE_RPC_PROVIDER_MODE',
  'CE_USE_INFURA_RPC',
  'CE_PREFER_PATH_RPC',
];

const ORIGINAL_ENV = ENV_KEYS.reduce((acc, key) => {
  acc[key] = process.env[key];
  return acc;
}, {});

const clearEnv = () => {
  ENV_KEYS.forEach((key) => {
    try {
      delete process.env[key];
    } catch (_) {}
  });
};

const clearGlobals = () => {
  GLOBAL_KEYS.forEach((key) => {
    try {
      delete globalThis[key];
    } catch (_) {}
  });
};

describe('rpcProviders paid RPC selection', () => {
  beforeEach(() => {
    clearEnv();
    clearGlobals();
    jest.resetModules();
  });

  afterEach(() => {
    clearEnv();
    clearGlobals();
    jest.resetModules();
  });

  afterAll(() => {
    ENV_KEYS.forEach((key) => {
      if (typeof ORIGINAL_ENV[key] === 'undefined') {
        delete process.env[key];
        return;
      }
      process.env[key] = ORIGINAL_ENV[key];
    });
  });

  it('keeps PATH-first Base Sepolia reads while forcing OP Sepolia to the configured paid RPC in infura_only mode', () => {
    process.env.REACT_APP_CE_RPC_PROVIDER_MODE = 'infura_only';
    process.env.REACT_APP_CE_OP_SEPOLIA_PAID_RPC_URL_HTTP = 'https://op-paid.example/rpc';

    jest.isolateModules(() => {
      const { getReadProviderDiagnostics, getReadProviderForChain } = require('./rpcProviders.js');

      const baseProvider = getReadProviderForChain(84532);
      const opProvider = getReadProviderForChain(11155420);
      const opDiagnostics = getReadProviderDiagnostics(11155420);

      expect(baseProvider?.__CE_RPC_META).toEqual(
        expect.objectContaining({
          chainId: 84532,
          providerMode: 'infura_only',
          infuraOnlyForChain: false,
          preferPath: true,
        }),
      );
      expect(opProvider?.__CE_RPC_META).toEqual(
        expect.objectContaining({
          chainId: 11155420,
          providerMode: 'infura_only',
          infuraOnlyForChain: true,
          preferPath: false,
        }),
      );

      const opUrls = Array.isArray(opProvider?.providerConfigs)
        ? opProvider.providerConfigs.map((cfg) => cfg?.provider?.connection?.url).filter(Boolean)
        : [];
      expect(opUrls).toEqual(['https://op-paid.example/rpc']);
      expect(opDiagnostics).toEqual(
        expect.objectContaining({
          chainId: 11155420,
          providerMode: 'infura_only',
          infuraOnlyForChain: true,
          configuredPaidRpcUrl: 'https://op-paid.example/rpc',
          includesConfiguredPaidRpc: true,
          urls: ['https://op-paid.example/rpc'],
        }),
      );
    });
  });

  it('does not route OP Sepolia reads through the configured paid RPC in fallback mode by default', () => {
    process.env.REACT_APP_CE_RPC_PROVIDER_MODE = 'fallback';
    process.env.REACT_APP_CE_USE_INFURA_RPC = 'false';
    process.env.REACT_APP_CE_OP_SEPOLIA_PAID_RPC_URL_HTTP = 'https://op-paid.example/rpc';

    jest.isolateModules(() => {
      const { getReadProviderDiagnostics } = require('./rpcProviders.js');

      const opDiagnostics = getReadProviderDiagnostics(11155420);

      expect(opDiagnostics).toEqual(
        expect.objectContaining({
          chainId: 11155420,
          providerMode: 'fallback',
          infuraOnlyForChain: false,
          configuredPaidRpcUrl: 'https://op-paid.example/rpc',
          includesConfiguredPaidRpc: false,
        }),
      );
      expect(opDiagnostics.urls[0]).toBe('https://op-sepolia-testnet.api.pocket.network');
    });
  });
});
