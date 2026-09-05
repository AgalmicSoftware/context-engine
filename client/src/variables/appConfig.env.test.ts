export {};

const processEnv = process.env as Record<string, string | undefined>;
const runtimeGlobals = globalThis as Record<string, unknown>;

const ENV_KEYS = [
  'REACT_APP_DEFAULT_AUTO_REQUEST_TESTNET_FUNDS',
  'REACT_APP_CE_DEMO_SURFACE_MODE_DEFAULT',
  'REACT_APP_CE_ENABLE_WALLETCONNECT_FALLBACK',
  'REACT_APP_ENABLE_CE_LOGO_ANIMATION',
  'REACT_APP_CE_SESSION_SCAN_SCOPE',
  'REACT_APP_CE_SESSION_SCAN_SLUGS',
  'REACT_APP_CE_FIRST_VISIT_ROOT_REDIRECT_ENABLED',
  'REACT_APP_CE_ABOUT_POSTS_ENABLED',
  'REACT_APP_CE_USER_PROFILE_SCAN_ALL_SESSIONS',
  'REACT_APP_CE_USER_PROFILE_SCAN_ALL_SESSIONS_SBTS',
  'REACT_APP_CE_USER_PROFILE_SCAN_ALL_SESSIONS_SURVEYS',
  'REACT_APP_CE_USER_PROFILE_SCAN_ALL_SESSIONS_QUESTIONS',
  'REACT_APP_CE_PROFILE_SCAN_SBT_BURST_SIZE',
  'REACT_APP_CE_SBT_INSTANCE_LISTENERS_MODE',
  'REACT_APP_SHOW_DEMO_SESSIONS',
  'REACT_APP_CE_DEMO_SESSION_SLUGS',
  'REACT_APP_POLIS_DEMO_DATA_AUTOLOAD_SLUGS',
  'REACT_APP_USE_ONCHAIN_SESSION_REGISTRY',
  'REACT_APP_CE_SESSION_SCAN_RESOLVE_DEMO_SESSION_ALIASES',
  'REACT_APP_SERVER',
  'REACT_APP_ARWEAVE_GATEWAY_URL',
  'REACT_APP_CE_ARWEAVE_DIRECT_TO_AR_IO',
  'REACT_APP_CE_ARWEAVE_PREFLIGHT_SESSION_METADATA',
  'REACT_APP_CE_ARWEAVE_PREFLIGHT_SBT_METADATA',
  'REACT_APP_CE_ARWEAVE_PREFLIGHT_RESPONSE_PAYLOADS',
  'REACT_APP_DEFAULT_CHAIN_ID',
  'REACT_APP_TESTNET_AUTO_SEND_THRESHOLD_ETH',
  'REACT_APP_CE_SHARED_WORKER_URL',
  'REACT_APP_CE_DEFAULT_EMBEDDED_DEPLOY_HELPER_ENABLED',
];

const RUNTIME_GLOBAL_KEYS = [
  'CE_RPC_TESTING_MODE',
  'CE_USE_INFURA_RPC',
  'CE_RPC_PROVIDER_MODE',
  'CE_PREFER_PATH_RPC',
  'CE_GETLOGS_MAX_CONCURRENCY',
  'CE_GETLOGS_MAX_RETRIES',
  'CE_SESSION_SCAN_SCOPE',
  'CE_SESSION_SCAN_SLUGS',
  'CE_FIRST_VISIT_ROOT_REDIRECT_ENABLED',
  'CE_USER_PROFILE_SCAN_ALL_SESSIONS',
  'CE_USER_PROFILE_SCAN_ALL_SESSIONS_SBTS',
  'CE_USER_PROFILE_SCAN_ALL_SESSIONS_SURVEYS',
  'CE_USER_PROFILE_SCAN_ALL_SESSIONS_QUESTIONS',
  'CE_PROFILE_SCAN_SBT_BURST_SIZE',
  'CE_PROFILE_SCAN_SBT_TIMEOUT_MS',
  'CE_PROFILE_SCAN_ACTIVITY_TIMEOUT_MS',
  'CE_PROFILE_SCAN_REGISTRY_TIMEOUT_MS',
  'CE_PROFILE_SCAN_COLD_DIAG',
  'CE_SBT_SYNC_BAR_RESEARCH_BLOCK_STEP',
  'CE_SBT_INSTANCE_LISTENERS_MODE',
  'CE_SBT_FULL_SCAN_POLICY',
  'SHOW_DEMO_SESSIONS',
  'CE_RPC_VERBOSE_ERRORS',
  'CE_RPC_LOG_PROVIDER_SUCCESS',
  'ENABLE_TARGETED_SBT_METADATA_LOOKUP',
  'CE_SESSION_SCAN_RESOLVE_DEMO_SESSION_ALIASES',
  'CE_ARWEAVE_DIRECT_TO_AR_IO',
  'CE_ARWEAVE_AR_IO_URL',
  'CE_ARWEAVE_PREFLIGHT_SESSION_METADATA',
  'CE_ARWEAVE_PREFLIGHT_SBT_METADATA',
  'CE_ARWEAVE_PREFLIGHT_RESPONSE_PAYLOADS',
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

const clearRuntimeGlobals = () => {
  RUNTIME_GLOBAL_KEYS.forEach((key) => {
    try {
      delete runtimeGlobals[key];
    } catch (_) {}
  });
};

describe('appConfig env-backed config', () => {
  beforeEach(() => {
    clearEnv();
    clearRuntimeGlobals();
    jest.resetModules();
  });

  afterEach(() => {
    clearEnv();
    clearRuntimeGlobals();
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

  it('reads REACT_APP_* overrides across strings, booleans, numbers, and lists', () => {
    process.env.REACT_APP_DEFAULT_AUTO_REQUEST_TESTNET_FUNDS = 'false';
    process.env.REACT_APP_CE_ENABLE_WALLETCONNECT_FALLBACK = 'true';
    process.env.REACT_APP_ENABLE_CE_LOGO_ANIMATION = 'false';
    process.env.REACT_APP_CE_SESSION_SCAN_SCOPE = 'general';
    process.env.REACT_APP_CE_SESSION_SCAN_SLUGS = 'alpha,beta';
    process.env.REACT_APP_CE_FIRST_VISIT_ROOT_REDIRECT_ENABLED = 'false';
    process.env.REACT_APP_CE_ABOUT_POSTS_ENABLED = 'false';
    process.env.REACT_APP_CE_USER_PROFILE_SCAN_ALL_SESSIONS = 'true';
    process.env.REACT_APP_CE_USER_PROFILE_SCAN_ALL_SESSIONS_SBTS = 'false';
    process.env.REACT_APP_CE_USER_PROFILE_SCAN_ALL_SESSIONS_SURVEYS = 'false';
    process.env.REACT_APP_CE_USER_PROFILE_SCAN_ALL_SESSIONS_QUESTIONS = 'true';
    process.env.REACT_APP_CE_PROFILE_SCAN_SBT_BURST_SIZE = '9';
    process.env.REACT_APP_CE_SBT_INSTANCE_LISTENERS_MODE = 'on';
    process.env.REACT_APP_SHOW_DEMO_SESSIONS = 'true';
    process.env.REACT_APP_CE_DEMO_SESSION_SLUGS = 'demo-1,demo-3,demo-2,demo';
    process.env.REACT_APP_POLIS_DEMO_DATA_AUTOLOAD_SLUGS = 'demo,edge';
    process.env.REACT_APP_USE_ONCHAIN_SESSION_REGISTRY = 'false';
    process.env.REACT_APP_SERVER = 'https://api.example.test';
    process.env.REACT_APP_ARWEAVE_GATEWAY_URL = 'https://gateway.example.test';
    process.env.REACT_APP_CE_ARWEAVE_DIRECT_TO_AR_IO = 'false';
    process.env.REACT_APP_CE_ARWEAVE_PREFLIGHT_SESSION_METADATA = 'true';
    process.env.REACT_APP_CE_ARWEAVE_PREFLIGHT_SBT_METADATA = 'true';
    process.env.REACT_APP_CE_ARWEAVE_PREFLIGHT_RESPONSE_PAYLOADS = 'false';
    process.env.REACT_APP_DEFAULT_CHAIN_ID = '31337';
    process.env.REACT_APP_TESTNET_AUTO_SEND_THRESHOLD_ETH = '0.005';
    process.env.REACT_APP_CE_SHARED_WORKER_URL = 'https://shared.example.test/';
    process.env.REACT_APP_CE_DEFAULT_EMBEDDED_DEPLOY_HELPER_ENABLED = 'false';

    jest.isolateModules(() => {
      const config = require('./appConfig.js');

      expect(config.DEFAULT_AUTO_REQUEST_TESTNET_FUNDS).toBe(false);
      expect(config.CE_ENABLE_WALLETCONNECT_FALLBACK).toBe(true);
      expect(config.ENABLE_CE_LOGO_ANIMATION).toBe(false);
      expect(config.CE_SESSION_SCAN_SCOPE).toBe('general');
      expect(config.CE_SESSION_SCAN_SLUGS).toEqual(['alpha', 'beta']);
      expect(config.CE_FIRST_VISIT_ROOT_REDIRECT_ENABLED).toBe(false);
      expect(config.CE_ABOUT_POSTS_ENABLED).toBe(false);
      expect(config.CE_USER_PROFILE_SCAN_ALL_SESSIONS).toBe(true);
      expect(config.CE_USER_PROFILE_SCAN_ALL_SESSIONS_SBTS).toBe(false);
      expect(config.CE_USER_PROFILE_SCAN_ALL_SESSIONS_SURVEYS).toBe(false);
      expect(config.CE_USER_PROFILE_SCAN_ALL_SESSIONS_QUESTIONS).toBe(true);
      expect(config.CE_PROFILE_SCAN_SBT_BURST_SIZE).toBe(9);
      expect(config.CE_SBT_INSTANCE_LISTENERS_MODE).toBe('on');
      expect(config.SHOW_DEMO_SESSIONS).toBe(true);
      expect(config.CE_DEMO_SESSION_SLUGS).toEqual(['demo-1', 'demo-3', 'demo-2', 'demo']);
      expect(config.POLIS_DEMO_DATA_AUTOLOAD_SLUGS).toEqual(['demo', 'edge']);
      expect(config.USE_ONCHAIN_SESSION_REGISTRY).toBe(false);
      expect(config.CE_SESSION_SCAN_RESOLVE_DEMO_SESSION_ALIASES).toBe(true);
      expect(config.SERVER).toBe('https://api.example.test');
      expect(config.ARWEAVE_GATEWAY_URL).toBe('https://gateway.example.test');
      expect(config.CE_ARWEAVE_DIRECT_TO_AR_IO).toBe(false);
      expect(config.CE_ARWEAVE_PREFLIGHT_SESSION_METADATA).toBe(true);
      expect(config.CE_ARWEAVE_PREFLIGHT_SBT_METADATA).toBe(true);
      expect(config.CE_ARWEAVE_PREFLIGHT_RESPONSE_PAYLOADS).toBe(false);
      expect(config.DEFAULT_CHAIN_ID).toBe(31337);
      expect(config.TESTNET_AUTO_SEND_THRESHOLD_ETH).toBe('0.005');
      expect(config.CLOUDFLARE_CORS_WORKER_URL).toBe('https://shared.example.test/');
      expect(config.CE_DEFAULT_EMBEDDED_DEPLOY_HELPER_ENABLED).toBe(false);
    });
  });

  it('lets explicit env overrides win over derived fallback logic', () => {
    process.env.REACT_APP_USE_ONCHAIN_SESSION_REGISTRY = 'false';
    process.env.REACT_APP_CE_SESSION_SCAN_RESOLVE_DEMO_SESSION_ALIASES = 'false';

    jest.isolateModules(() => {
      const config = require('./appConfig.js');
      expect(config.CE_SESSION_SCAN_RESOLVE_DEMO_SESSION_ALIASES).toBe(false);
    });
  });

  it.each([
    [undefined, false],
    ['false', false],
    ['true', true],
    ['wat', false],
  ])('reads REACT_APP_CE_DEMO_SURFACE_MODE_DEFAULT=%p as %p', (value, expected) => {
    if (typeof value === 'undefined') {
      delete process.env.REACT_APP_CE_DEMO_SURFACE_MODE_DEFAULT;
    } else {
      process.env.REACT_APP_CE_DEMO_SURFACE_MODE_DEFAULT = value;
    }

    jest.isolateModules(() => {
      const config = require('./appConfig.js');
      expect(config.DEFAULT_DEMO_SURFACE_MODE).toBe(expected);
    });
  });

  it('keeps the repo-default session scan scope and slug list when env overrides are absent', () => {
    jest.isolateModules(() => {
      const config = require('./appConfig.js');

      expect(config.DEFAULT_CHAIN_ID).toBe(11155420);
      expect(config.CE_SESSION_SCAN_SCOPE).toBe('list');
      expect(config.CE_SESSION_SCAN_SLUGS).toEqual(['demo-sh']);
      expect(config.CE_DEMO_SESSION_SLUGS).toEqual(['demo-sh', 'demo-1', 'demo-3', 'demo-2', 'demo']);
      expect(config.POLIS_DEMO_DATA_AUTOLOAD_SLUGS).toEqual(['demo-sh', 'demo-1', 'demo-3', 'demo-2', 'demo']);
      expect(config.CE_ARWEAVE_DIRECT_TO_AR_IO).toBe(true);
      expect(config.CE_ARWEAVE_PREFLIGHT_SESSION_METADATA).toBe(false);
      expect(config.CE_ARWEAVE_PREFLIGHT_SBT_METADATA).toBe(false);
      expect(config.CE_ARWEAVE_PREFLIGHT_RESPONSE_PAYLOADS).toBe(true);
      expect(config.CE_ENABLE_WALLETCONNECT_FALLBACK).toBe(false);
      expect(config.CE_ABOUT_POSTS_ENABLED).toBe(true);
    });
  });
});
