import { resolveMainSiteLitSessionConfig } from './litSessionConfig.js';

const VALID_SBT_ADDRESS = '0x0000000000000000000000000000000000000001';

const buildSessionConfigWithGate = ({
  chainId,
  sbtAddresses = [VALID_SBT_ADDRESS],
  mode,
} = {}) => ({
  __registry: {
    gateAuthority: 'onchain',
    gatesByResource: {
      default: {
        lookupStatus: 'ok',
        sbtAddresses,
        chainId,
        mode,
      },
    },
  },
});

describe('litSessionConfig', () => {
  it('resolves chainId from gate first, then config, then fallback', () => {
    expect(resolveMainSiteLitSessionConfig({
      sessionConfig: {
        ...buildSessionConfigWithGate({ chainId: 1 }),
        networkChainId: 2,
      },
      networkChainIdFallback: 3,
    }).chainId).toBe(1);

    expect(resolveMainSiteLitSessionConfig({
      sessionConfig: { networkChainId: 2 },
      networkChainIdFallback: 3,
    }).chainId).toBe(2);

    expect(resolveMainSiteLitSessionConfig({
      sessionConfig: {},
      networkChainIdFallback: 3,
    }).chainId).toBe(3);

    expect(resolveMainSiteLitSessionConfig({
      sessionConfig: {},
    }).chainId).toBeNull();
  });

  it('resolves litNetwork from config with naga-dev default', () => {
    expect(resolveMainSiteLitSessionConfig({
      sessionConfig: { lit: { network: 'custom-net' } },
    }).litNetwork).toBe('custom-net');

    expect(resolveMainSiteLitSessionConfig({
      sessionConfig: { litNetwork: 'legacy-net' },
    }).litNetwork).toBe('legacy-net');

    expect(resolveMainSiteLitSessionConfig({
      sessionConfig: {},
    }).litNetwork).toBe('naga-dev');
  });

  it('reads optional lit.userMaxPrice deployment defaults without requiring new UI fields', () => {
    expect(resolveMainSiteLitSessionConfig({
      sessionConfig: { lit: { userMaxPrice: '123' } },
    }).userMaxPrice).toBe('123');

    expect(resolveMainSiteLitSessionConfig({
      sessionConfig: { litUserMaxPrice: '456' },
    }).userMaxPrice).toBe('456');
  });

  it('builds access control conditions only when gate addresses exist', () => {
    const result = resolveMainSiteLitSessionConfig({
      sessionConfig: buildSessionConfigWithGate({ chainId: 84532 }),
    });
    expect(result.accessControlConditions).toEqual([
      {
        contractAddress: VALID_SBT_ADDRESS,
        standardContractType: 'ERC721',
        chain: 'baseSepolia',
        method: 'balanceOf',
        parameters: [':userAddress'],
        returnValueTest: { comparator: '>', value: '0' },
      },
    ]);

    const empty = resolveMainSiteLitSessionConfig({
      sessionConfig: {},
    });
    expect(empty.accessControlConditions).toBeNull();
  });

  it('returns default and null values when no config provided', () => {
    const result = resolveMainSiteLitSessionConfig();
    expect(result.chainId).toBeNull();
    expect(result.litNetwork).toBe('naga-dev');
    expect(result.accessControlConditions).toBeNull();
  });
});
