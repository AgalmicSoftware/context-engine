import { resolveMainSiteLitSessionConfig, resolveMainSiteLitSessionConfigSource } from './litSessionConfig.js';
import {
  SESSION_MODE_PRESET_IDS,
  cloneSessionModePreset,
  type SessionModeProfile,
} from '../../utilities/session/sessionModeProfile';

const VALID_SBT_ADDRESS = '0x0000000000000000000000000000000000000001';
const LEGACY_SESSION_ID = '0x00112233445566778899aabbccddeeff';
const resolveConfig = resolveMainSiteLitSessionConfig;

const buildLegacyRegistryIdentity = (chainId = 84532) => ({
  networkChainId: chainId,
  __registry: {
    chainId,
    sessionIdHex: LEGACY_SESSION_ID,
  },
});

const buildWorkerCanonicalLitProfile = (): SessionModeProfile => {
  const profile = cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE);
  profile.preset = SESSION_MODE_PRESET_IDS.CUSTOM;
  profile.encryption = { mode: 'lit' };
  profile.evm.registryChainId = 11155420;
  profile.storage.payloadAccessControl!.encryption = 'lit';
  return profile;
};

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
    chainId: chainId || 84532,
    gateAuthority: 'onchain',
    gatesByResource: {
      default: {
        lookupStatus: 'ok',
        sbtAddresses,
        chainId,
        mode,
      },
    },
    sessionIdHex: LEGACY_SESSION_ID,
  },
});

describe('litSessionConfig', () => {
  it('resolves chainId from a strong legacy gate or config without trusting a missing-profile fallback', () => {
    expect(
      resolveConfig({
        sessionConfig: {
          ...buildSessionConfigWithGate({ chainId: 1 }),
          networkChainId: 2,
        },
        networkChainIdFallback: 3,
      }).chainId,
    ).toBe(1);

    expect(
      resolveConfig({
        sessionConfig: buildLegacyRegistryIdentity(2),
        networkChainIdFallback: 3,
      }).chainId,
    ).toBe(2);

    expect(
      resolveConfig({
        sessionConfig: {},
        networkChainIdFallback: 3,
      }).chainId,
    ).toBeNull();

    expect(
      resolveConfig({
        sessionConfig: {},
      }).chainId,
    ).toBeNull();
  });

  it('only publishes a litNetwork label when a Chipotle worker runtime is configured', () => {
    expect(resolveConfig({
      sessionConfig: {},
    }).litNetwork).toBe('');
  });

  it('reads optional lit.userMaxPrice deployment defaults without requiring new UI fields', () => {
    expect(
      resolveConfig({
        sessionConfig: { ...buildLegacyRegistryIdentity(), lit: { userMaxPrice: '123' } },
      }).userMaxPrice,
    ).toBe('123');

    expect(
      resolveConfig({
        sessionConfig: { ...buildLegacyRegistryIdentity(), litUserMaxPrice: '456' },
      }).userMaxPrice,
    ).toBe('456');
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
