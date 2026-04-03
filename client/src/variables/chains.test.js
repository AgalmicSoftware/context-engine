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

const {
  getPathRpcUrl,
  getPublicRpcUrls,
} = rpcDefaults;

describe('chains RPC defaults', () => {
  const prevIncludeLocalRegistry = globalThis.CE_INCLUDE_LOCAL_SESSION_REGISTRY;
  const configuredPaidBaseSepoliaRpcUrl = String(process.env.REACT_APP_CE_BASE_SEPOLIA_PAID_RPC_URL_HTTP || '').trim();
  const BASE_SEPOLIA_PUBLIC_RPC_URLS = Object.freeze(getPublicRpcUrls(84532));
  const OP_SEPOLIA_PUBLIC_RPC_URLS = Object.freeze(getPublicRpcUrls(11155420));

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
    expect(publicUrls).toContain('https://base-sepolia-rpc.publicnode.com');
    expect(defaultUrls).toContain('https://base-sepolia-rpc.publicnode.com');
    expect(publicUrls).toContain('https://base-sepolia.drpc.org');
    expect(defaultUrls).toContain('https://base-sepolia.drpc.org');
    expect(publicUrls).toContain('https://base-sepolia.gateway.tenderly.co');
    expect(defaultUrls).toContain('https://base-sepolia.gateway.tenderly.co');
    expect(publicUrls).toContain('https://base-sepolia.blockscout.com/api/eth-rpc');
    expect(defaultUrls).toContain('https://base-sepolia.blockscout.com/api/eth-rpc');
    expect(publicUrls).not.toContain('https://base-sepolia.blockpi.network/v1/rpc/public');
    expect(defaultUrls).not.toContain('https://base-sepolia.blockpi.network/v1/rpc/public');
  });

  it('sources Base Sepolia public fallback URLs from the shared rpc defaults manifest', () => {
    expect(BASE_SEPOLIA_PUBLIC_RPC_URLS).toEqual([
      'https://base-sepolia-rpc.publicnode.com',
      'https://base-sepolia.publicnode.com',
      'https://base-sepolia.blockscout.com/api/eth-rpc',
      'https://base-sepolia.gateway.tenderly.co',
      'https://base-sepolia.drpc.org',
      'https://sepolia.base.org',
    ]);
    expect(baseSepolia.rpcUrls?.public?.http).toEqual(expect.arrayContaining(BASE_SEPOLIA_PUBLIC_RPC_URLS));
    expect(baseSepolia.rpcUrls?.default?.http).toEqual(expect.arrayContaining(BASE_SEPOLIA_PUBLIC_RPC_URLS));
  });

  it('sources OP Sepolia public fallback URLs from the shared rpc defaults manifest', () => {
    expect(OP_SEPOLIA_PUBLIC_RPC_URLS).toEqual([
      'https://sepolia.optimism.io',
      'https://optimism-sepolia.publicnode.com',
      'https://optimism-sepolia-rpc.publicnode.com',
      'https://optimism-sepolia.gateway.tenderly.co',
      'https://optimism-sepolia.drpc.org',
    ]);
    expect(optimismSepolia.rpcUrls?.public?.http).toEqual(expect.arrayContaining(OP_SEPOLIA_PUBLIC_RPC_URLS));
    expect(optimismSepolia.rpcUrls?.default?.http).toEqual(expect.arrayContaining(OP_SEPOLIA_PUBLIC_RPC_URLS));
  });

  it('returns a non-sepolia.base.org fallback URL when PATH is disabled', () => {
    const url = getDefaultHttpRpc(84532, { allowPath: false });
    expect(typeof url).toBe('string');
    expect(url).toBeTruthy();
    expect(url).not.toBe(getPathRpcUrl(84532));
    expect(url).not.toContain('pocket.network');
    expect(url).not.toBe('https://sepolia.base.org');
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
    expect(getSessionContractsForChain(localChainId)).toEqual(expect.objectContaining({
      surveys: localContracts.Surveys,
      sbtFactory: localContracts.SBTFactory,
    }));
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
    expect(isLocalDevLoopbackHost('ce.example.com')).toBe(false);
  });

  it('exposes the checked-in OP Sepolia contract defaults', () => {
    expect(getSessionRegistryAddress(11155420)).toBe('0xDcB1731984E9F75c6a061c38dD8b67d18De4C0c1');
    expect(getSessionContractsForChain(11155420)).toEqual({
      surveys: '0x59664B9dA510a33F2edB7E14Cf0c2749bf506B8A',
      sbtFactory: '0x8CBeE1EE46603b446b499cb32F63fa9860a50478',
    });
  });
});
