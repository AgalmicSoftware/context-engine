import {
  baseSepolia,
  chainHttpRpcNoPath,
  chainRegistry,
  getChainBlockTimeMs,
  getDefaultHttpRpc,
  isLocalDevLoopbackHost,
  getSessionContractsForChain,
  getSessionRegistryAddress,
  getSessionRegistryChainIds,
  optimismSepolia,
} from './chains.js';
import localContracts from './local-contracts.json';
import rpcDefaults from './rpcDefaults.js';

const { getPathRpcUrl } = rpcDefaults;

const BASE_SEPOLIA_PUBLIC_RPC_URLS = Object.freeze([
  'https://base-sepolia-rpc.publicnode.com', // intentional: production RPC fallback snapshot
  'https://base-sepolia.publicnode.com', // intentional: production RPC fallback snapshot
  'https://base-sepolia.blockscout.com/api/eth-rpc', // intentional: production RPC fallback snapshot
  'https://base-sepolia.gateway.tenderly.co', // intentional: production RPC fallback snapshot
  'https://base-sepolia.drpc.org', // intentional: production RPC fallback snapshot
  'https://sepolia.base.org', // intentional: production RPC fallback snapshot
]);
const OP_SEPOLIA_PUBLIC_RPC_URLS = Object.freeze([
  'https://sepolia.optimism.io', // intentional: production RPC fallback snapshot
]);

const withoutLeadingOptionalRpcUrls = (urls, optionalUrls = []) => {
  const remaining = [...(Array.isArray(urls) ? urls : [])];
  optionalUrls.forEach((optionalUrl) => {
    if (optionalUrl && remaining[0] === optionalUrl) {
      remaining.shift();
    }
  });
  return remaining;
};

describe('chains RPC defaults', () => {
  const prevIncludeLocalRegistry = globalThis.CE_INCLUDE_LOCAL_SESSION_REGISTRY;
  const configuredPaidBaseSepoliaRpcUrl = String(process.env.REACT_APP_CE_BASE_SEPOLIA_PAID_RPC_URL_HTTP || '').trim();
  const configuredPaidOpSepoliaRpcUrl = String(process.env.REACT_APP_CE_OP_SEPOLIA_PAID_RPC_URL_HTTP || '').trim();

  beforeEach(() => {
    delete globalThis.CE_INCLUDE_LOCAL_SESSION_REGISTRY;
  });

  afterEach(() => {
    if (typeof prevIncludeLocalRegistry === 'undefined') {
      delete globalThis.CE_INCLUDE_LOCAL_SESSION_REGISTRY;
      return;
    }
    globalThis.CE_INCLUDE_LOCAL_SESSION_REGISTRY = prevIncludeLocalRegistry;
  });

  it('keeps Base Sepolia PATH-first while retaining public non-base.org fallbacks', () => {
    const publicUrls = baseSepolia.rpcUrls?.public?.http || [];
    const defaultUrls = baseSepolia.rpcUrls?.default?.http || [];

    expect(publicUrls[0]).toBe(getPathRpcUrl(84532));
    expect(defaultUrls[0]).toBe(getPathRpcUrl(84532));
    if (configuredPaidBaseSepoliaRpcUrl) {
      expect(publicUrls).toContain(configuredPaidBaseSepoliaRpcUrl);
      expect(defaultUrls).toContain(configuredPaidBaseSepoliaRpcUrl);
    } else {
      expect(publicUrls.some((url) => /infura\.io/i.test(String(url || '')))).toBe(false);
      expect(defaultUrls.some((url) => /infura\.io/i.test(String(url || '')))).toBe(false);
    }
    BASE_SEPOLIA_PUBLIC_RPC_URLS.filter((url) => !/base\.org$/i.test(String(url || ''))).forEach((url) => {
      expect(publicUrls).toContain(url);
      expect(defaultUrls).toContain(url);
    });
    expect(publicUrls.some((url) => /blockpi\.network/i.test(String(url || '')))).toBe(false);
    expect(defaultUrls.some((url) => /blockpi\.network/i.test(String(url || '')))).toBe(false);
  });

  it('ships Base Sepolia public fallback URLs in the expected production order', () => {
    const optionalPrefixUrls = [getPathRpcUrl(84532), configuredPaidBaseSepoliaRpcUrl];

    expect(withoutLeadingOptionalRpcUrls(baseSepolia.rpcUrls?.public?.http, optionalPrefixUrls)).toEqual(
      BASE_SEPOLIA_PUBLIC_RPC_URLS,
    );
    expect(withoutLeadingOptionalRpcUrls(baseSepolia.rpcUrls?.default?.http, optionalPrefixUrls)).toEqual(
      BASE_SEPOLIA_PUBLIC_RPC_URLS,
    );
  });

  it('ships OP Sepolia public fallback URLs in the expected production order', () => {
    const optionalPrefixUrls = [getPathRpcUrl(11155420), configuredPaidOpSepoliaRpcUrl];

    expect(withoutLeadingOptionalRpcUrls(optimismSepolia.rpcUrls?.public?.http, optionalPrefixUrls)).toEqual(
      OP_SEPOLIA_PUBLIC_RPC_URLS,
    );
    expect(withoutLeadingOptionalRpcUrls(optimismSepolia.rpcUrls?.default?.http, optionalPrefixUrls)).toEqual(
      OP_SEPOLIA_PUBLIC_RPC_URLS,
    );
  });

  it('uses the official OP Sepolia RPC before rate-limited fallback gateways', () => {
    const url = getDefaultHttpRpc(11155420, { allowPath: false });
    expect(url).toBe(OP_SEPOLIA_PUBLIC_RPC_URLS[0]);
    expect(url).toBe('https://sepolia.optimism.io');
    expect(chainHttpRpcNoPath(optimismSepolia)).toBe(url);
  });

  it('returns a non-sepolia.base.org fallback URL when PATH is disabled', () => {
    const url = getDefaultHttpRpc(84532, { allowPath: false });
    expect(typeof url).toBe('string');
    expect(url).toBeTruthy();
    expect(url).not.toBe(getPathRpcUrl(84532));
    expect(url).not.toContain('pocket.network');
    expect(url).not.toBe(BASE_SEPOLIA_PUBLIC_RPC_URLS.find((entry) => /base\.org$/i.test(String(entry || ''))));
  });

  it('returns a non-PATH wallet RPC URL for PATH-first chains', () => {
    const url = chainHttpRpcNoPath(baseSepolia);

    expect(url).toBe(getDefaultHttpRpc(84532, { allowPath: false }));
    expect(url).toBeTruthy();
    expect(url).not.toBe(getPathRpcUrl(84532));
    expect(url).not.toContain('pocket.network');
  });

  it('defines a positive numeric blockTime for every chain in chainRegistry', () => {
    Object.values(chainRegistry).forEach((chain) => {
      expect(typeof chain?.blockTime).toBe('number');
      expect(Number.isFinite(chain?.blockTime)).toBe(true);
      expect(chain.blockTime).toBeGreaterThan(0);
    });
  });

  it('returns expected per-chain blockTime values and fallback defaults', () => {
    expect(getChainBlockTimeMs(84532)).toBe(5000);
    expect(getChainBlockTimeMs(8453)).toBe(2000);
    expect(getChainBlockTimeMs(10)).toBe(2000);
    expect(getChainBlockTimeMs(11155420)).toBe(2000);
    expect(getChainBlockTimeMs(42161)).toBe(250);
    expect(getChainBlockTimeMs(421614)).toBe(250);
    expect(getChainBlockTimeMs(1)).toBe(12000);
    expect(getChainBlockTimeMs(137)).toBe(2000);
    expect(getChainBlockTimeMs(56)).toBe(750);
    expect(getChainBlockTimeMs(42220)).toBe(5000);
    expect(getChainBlockTimeMs(747474)).toBe(2000);
    expect(getChainBlockTimeMs(31337)).toBe(1000);
    expect(getChainBlockTimeMs(999999)).toBe(12000);
    expect(getChainBlockTimeMs(null)).toBe(12000);
  });

  it('defines an explicit OP Sepolia fallback gas price for write helpers', () => {
    expect(optimismSepolia.defaultGasPriceGwei).toBe('3');
  });

  it('hides generated local contract defaults from direct 31337 lookups unless explicitly enabled', () => {
    const localChainId = Number(localContracts?.chainId || 0);
    expect(localChainId).toBe(31337);

    globalThis.CE_INCLUDE_LOCAL_SESSION_REGISTRY = false;
    expect(getSessionRegistryAddress(localChainId)).toBe('');
    expect(getSessionContractsForChain(localChainId)).toEqual({});
  });

  it('returns generated local contract defaults for direct 31337 lookups when explicitly enabled', () => {
    const localChainId = Number(localContracts?.chainId || 0);

    globalThis.CE_INCLUDE_LOCAL_SESSION_REGISTRY = true;
    expect(getSessionRegistryAddress(localChainId)).toBe(localContracts.SessionRegistry);
    expect(getSessionContractsForChain(localChainId)).toEqual(
      expect.objectContaining({
        surveys: localContracts.Surveys,
        sbtFactory: localContracts.SBTFactory,
      }),
    );
  });

  it('keeps generated local contracts out of the default registry scan list unless explicitly enabled', () => {
    const localChainId = Number(localContracts?.chainId || 0);

    globalThis.CE_INCLUDE_LOCAL_SESSION_REGISTRY = false;
    expect(getSessionRegistryChainIds()).not.toContain(localChainId);

    globalThis.CE_INCLUDE_LOCAL_SESSION_REGISTRY = true;
    expect(getSessionRegistryChainIds()).toContain(localChainId);
  });

  it('treats IPv4 and IPv6 loopback hosts as local dev registry contexts', () => {
    expect(isLocalDevLoopbackHost('127.0.0.1')).toBe(true);
    expect(isLocalDevLoopbackHost('0.0.0.0')).toBe(true);
    expect(isLocalDevLoopbackHost('localhost')).toBe(true);
    expect(isLocalDevLoopbackHost('::1')).toBe(true);
    expect(isLocalDevLoopbackHost('[::1]')).toBe(true);
    expect(isLocalDevLoopbackHost('ce.example.test')).toBe(false);
  });

  it('exposes the checked-in OP Sepolia contract defaults', () => {
    expect(getSessionRegistryAddress(11155420)).toBe('0xDcB1731984E9F75c6a061c38dD8b67d18De4C0c1');
    expect(getSessionContractsForChain(11155420)).toEqual({
      surveys: '0x59664B9dA510a33F2edB7E14Cf0c2749bf506B8A',
      sbtFactory: '0x8CBeE1EE46603b446b499cb32F63fa9860a50478',
    });
  });
});
