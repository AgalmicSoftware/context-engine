import {
  resolveMainSiteLitSessionConfig,
  resolveMainSiteLitSessionConfigSource,
} from './litSessionConfig.js';

const VALID_SBT_ADDRESS = '0x0000000000000000000000000000000000000001';
const resolveConfig = resolveMainSiteLitSessionConfig;

const buildSessionConfigWithGate = ({
  chainId,
  sbtAddresses = [VALID_SBT_ADDRESS],
  mode,
}: {
  chainId?: number;
  sbtAddresses?: string[];
  mode?: string;
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
    expect(resolveConfig({
      sessionConfig: {
        ...buildSessionConfigWithGate({ chainId: 1 }),
        networkChainId: 2,
      },
      networkChainIdFallback: 3,
    }).chainId).toBe(1);

    expect(resolveConfig({
      sessionConfig: { networkChainId: 2 },
      networkChainIdFallback: 3,
    }).chainId).toBe(2);

    expect(resolveConfig({
      sessionConfig: {},
      networkChainIdFallback: 3,
    }).chainId).toBe(3);

    expect(resolveConfig({
      sessionConfig: {},
    }).chainId).toBeNull();
  });

  it('only publishes a litNetwork label when a Chipotle worker runtime is configured', () => {
    expect(resolveConfig({
      sessionConfig: {},
    }).litNetwork).toBe('');
  });

  it('reads optional lit.userMaxPrice deployment defaults without requiring new UI fields', () => {
    expect(resolveConfig({
      sessionConfig: { lit: { userMaxPrice: '123' } },
    }).userMaxPrice).toBe('123');

    expect(resolveConfig({
      sessionConfig: { litUserMaxPrice: '456' },
    }).userMaxPrice).toBe('456');
  });

  it('builds access control conditions only when gate addresses exist', () => {
    const result = resolveConfig({
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

    const empty = resolveConfig({
      sessionConfig: {},
    });
    expect(empty.accessControlConditions).toBeNull();
  });

  it('returns default and null values when no config provided', () => {
    const result = resolveMainSiteLitSessionConfig();
    expect(result.chainId).toBeNull();
    expect(result.litNetwork).toBe('');
    expect(result.accessControlConditions).toBeNull();
    expect(result.chipotle).toBeNull();
  });

  it('surfaces Chipotle runtime config when the session has worker credentials', () => {
    const result = resolveConfig({
      sessionConfig: {
        corsWorkerUrl: 'https://worker.example.test',
        litCredentials: {
          litApiBase: 'https://api.chipotle.litprotocol.com',
          litActionCid: 'QmAction123',
          litGroupId: '7',
          litPkpId: '0xpkp123',
        },
      },
    });

    expect(result.chipotle).toEqual({
      enabled: true,
      workerUrl: 'https://worker.example.test',
      litCredentials: {
        litApiBase: 'https://api.chipotle.litprotocol.com',
        litActionCid: 'QmAction123',
        litGroupId: '7',
        litPkpId: '0xpkp123',
      },
      sessionConfig: {
        corsWorkerUrl: 'https://worker.example.test',
        litCredentials: {
          litApiBase: 'https://api.chipotle.litprotocol.com',
          litActionCid: 'QmAction123',
          litGroupId: '7',
          litPkpId: '0xpkp123',
        },
      },
    });
    expect(result.litNetwork).toBe('chipotle');
  });
});
