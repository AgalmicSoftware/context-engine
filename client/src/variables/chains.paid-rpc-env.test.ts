export {};

const processEnv = process.env as Record<string, string | undefined>;
const runtimeGlobals = globalThis as Record<string, unknown>;

const ENV_KEYS = [
  'REACT_APP_CE_USE_INFURA_RPC',
  'REACT_APP_CE_RPC_PROVIDER_MODE',
  'REACT_APP_CE_BASE_SEPOLIA_PAID_RPC_URL_HTTP',
  'REACT_APP_CE_BASE_SEPOLIA_PAID_RPC_URL_WSS',
  'REACT_APP_CE_OP_SEPOLIA_PAID_RPC_URL_HTTP',
  'REACT_APP_CE_OP_SEPOLIA_PAID_RPC_URL_WSS',
];

const GLOBAL_KEYS = [
  'CE_USE_INFURA_RPC',
  'CE_RPC_PROVIDER_MODE',
  'CE_BASE_SEPOLIA_PAID_RPC_URL_HTTP',
  'CE_BASE_SEPOLIA_PAID_RPC_URL_WSS',
  'CE_OP_SEPOLIA_PAID_RPC_URL_HTTP',
  'CE_OP_SEPOLIA_PAID_RPC_URL_WSS',
];

const ORIGINAL_ENV = ENV_KEYS.reduce<Record<string, string | undefined>>((acc, key) => {
  acc[key] = processEnv[key];
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
      delete runtimeGlobals[key];
    } catch (_) {}
  });
};

describe('chains paid RPC env wiring', () => {
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
      processEnv[key] = ORIGINAL_ENV[key];
    });
  });

  it('prepends configured paid RPC URLs for Base Sepolia and OP Sepolia when the env toggle is enabled', () => {
    process.env.REACT_APP_CE_USE_INFURA_RPC = 'true';
    process.env.REACT_APP_CE_BASE_SEPOLIA_PAID_RPC_URL_HTTP = 'https://base-paid.example/rpc';
    process.env.REACT_APP_CE_OP_SEPOLIA_PAID_RPC_URL_HTTP = 'https://op-paid.example/rpc';

    jest.isolateModules(() => {
      const { baseSepolia, optimismSepolia, getConfiguredPaidRpcHttpUrl } = require('./chains.js');

      expect(getConfiguredPaidRpcHttpUrl(84532)).toBe('https://base-paid.example/rpc');
      expect(getConfiguredPaidRpcHttpUrl(11155420)).toBe('https://op-paid.example/rpc');
      expect(baseSepolia.rpcUrls?.public?.http).toContain('https://base-paid.example/rpc');
      expect(baseSepolia.rpcUrls?.default?.http).toContain('https://base-paid.example/rpc');
      expect(optimismSepolia.rpcUrls?.public?.http).toContain('https://op-paid.example/rpc');
      expect(optimismSepolia.rpcUrls?.default?.http).toContain('https://op-paid.example/rpc');
    });
  });

  it('limits infura_only mode to the chain that has a configured paid RPC URL', () => {
    process.env.REACT_APP_CE_RPC_PROVIDER_MODE = 'infura_only';
    process.env.REACT_APP_CE_OP_SEPOLIA_PAID_RPC_URL_HTTP = 'https://op-only.example/rpc';

    jest.isolateModules(() => {
      const { baseSepolia, optimismSepolia, getPreferredPathRpcUrl } = require('./chains.js');

      expect(getPreferredPathRpcUrl(84532)).toBe('https://base-sepolia-testnet.api.pocket.network');
      expect(baseSepolia.rpcUrls?.public?.http?.[0]).toBe('https://base-sepolia-testnet.api.pocket.network');
      expect(baseSepolia.rpcUrls?.public?.http).not.toContain('https://op-only.example/rpc');

      expect(getPreferredPathRpcUrl(11155420)).toBe('');
      expect(optimismSepolia.rpcUrls?.public?.http).toEqual(['https://op-only.example/rpc']);
      expect(optimismSepolia.rpcUrls?.default?.http).toEqual(['https://op-only.example/rpc']);
    });
  });
});
