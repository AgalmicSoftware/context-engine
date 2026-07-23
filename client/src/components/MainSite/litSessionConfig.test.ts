import { resolveMainSiteLitSessionConfig, resolveMainSiteLitSessionConfigSource } from './litSessionConfig.js';

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
    expect(
      resolveConfig({
        sessionConfig: {},
      }).litNetwork,
    ).toBe('');
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
    const sessionConfig = {
      ...buildLegacyRegistryIdentity(),
      corsWorkerUrl: 'https://worker.example.test',
      litCredentials: {
        litApiBase: 'https://api.chipotle.litprotocol.com',
        litActionCid: 'QmAction123',
        litGroupId: '7',
        litPkpId: '0xpkp123',
      },
    };
    const result = resolveConfig({ sessionConfig });

    expect(result.chipotle).toEqual({
      enabled: true,
      workerUrl: 'https://worker.example.test',
      litCredentials: {
        litApiBase: 'https://api.chipotle.litprotocol.com',
        litActionCid: 'QmAction123',
        litGroupId: '7',
        litPkpId: '0xpkp123',
      },
      sessionConfig,
    });
    expect(result.litNetwork).toBe('chipotle');
  });

  it('surfaces a worker-mediated Chipotle runtime from a worker URL and default gate without mirrored credentials', () => {
    const sessionConfig = {
      ...buildSessionConfigWithGate({ chainId: 84532 }),
      corsWorkerUrl: 'https://worker.example.test',
      lit: { network: 'chipotle' },
    };

    const result = resolveConfig({ sessionConfig });

    expect(result.chipotle).toEqual({
      enabled: true,
      workerUrl: 'https://worker.example.test',
      litCredentials: {},
      sessionConfig,
    });
    expect(result.litNetwork).toBe('chipotle');
    expect(result.accessControlConditions).toEqual(expect.any(Array));
  });

  it('derives a descriptor-free Chipotle runtime from a validated worker-canonical Lit profile', () => {
    const sessionModeProfile = buildWorkerCanonicalLitProfile();
    const sessionConfig = {
      slug: 'worker-lit-session',
      corsWorkerUrl: 'https://worker.example.test',
      sessionModeProfile,
    };

    const result = resolveConfig({ sessionConfig });

    expect(result.chipotle).toEqual({
      enabled: true,
      workerUrl: 'https://worker.example.test',
      litCredentials: {},
      sessionConfig,
    });
    expect(result.chainId).toBe(11155420);
    expect(result.litNetwork).toBe('chipotle');
    expect(result.accessControlConditions).toBeNull();
    expect(sessionConfig).not.toHaveProperty('lit');
    expect(sessionConfig).not.toHaveProperty('litCredentials');
    expect(sessionConfig).not.toHaveProperty('rpcUrl');
    expect(sessionConfig).not.toHaveProperty('rpcUrlsByChainId');
  });

  it('does not infer Chipotle from non-Lit or untrusted worker profiles', () => {
    const workerEnvelopeProfile = cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE);
    const wrongAuthorityProfile = buildWorkerCanonicalLitProfile();
    wrongAuthorityProfile.authority.mode = 'evm_registry_canonical';
    const malformedProfile = {
      authority: { mode: 'worker_canonical' },
      storage: { backend: 'cloudflare' },
      encryption: { mode: 'lit' },
      evm: { registryChainId: 11155420 },
    };

    [workerEnvelopeProfile, wrongAuthorityProfile, malformedProfile].forEach((sessionModeProfile) => {
      expect(
        resolveConfig({
          sessionConfig: {
            corsWorkerUrl: 'https://worker.example.test',
            sessionModeProfile,
          },
        }).chipotle,
      ).toBeNull();
    });
  });

  it('does not let stale legacy Lit hints escalate a valid pure Worker profile', () => {
    const sessionModeProfile = cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE);
    const result = resolveConfig({
      sessionConfig: {
        ...buildSessionConfigWithGate({ chainId: 84532 }),
        corsWorkerUrl: 'https://worker.example.test',
        lit: { network: 'chipotle', userMaxPrice: '999' },
        litCredentials: {
          litApiBase: 'https://api.chipotle.litprotocol.com',
          litActionCid: 'QmStaleAction',
          litPkpId: '0xstale',
        },
        litNetwork: 'chipotle',
        networkChainId: 84532,
        sessionModeProfile,
      },
      networkChainIdFallback: 11155420,
    });

    expect(result).toEqual({
      gate: null,
      chainId: null,
      litNetwork: '',
      userMaxPrice: '',
      litChain: '',
      gateAddresses: [],
      accessControlConditions: null,
      chipotle: null,
    });
  });

  it('does not let stale Lit hints or a fallback chain escalate a missing session profile', () => {
    const result = resolveConfig({
      sessionConfig: {
        corsWorkerUrl: 'https://worker.example.test',
        lit: { network: 'chipotle', userMaxPrice: '999' },
        litCredentials: {
          litApiBase: 'https://api.chipotle.litprotocol.com',
          litActionCid: 'QmStaleAction',
          litPkpId: '0xstale',
        },
        litNetwork: 'chipotle',
        networkChainId: 84532,
      },
      networkChainIdFallback: 11155420,
    });

    expect(result).toEqual({
      gate: null,
      chainId: null,
      litNetwork: '',
      userMaxPrice: '',
      litChain: '',
      gateAddresses: [],
      accessControlConditions: null,
      chipotle: null,
    });
  });

  it('uses the primary encryption gate when the default resource is open', () => {
    const sessionConfig = {
      corsWorkerUrl: 'https://worker.example.test',
      encryption: {
        primaryGateId: 'questionResponses',
      },
      __registry: {
        chainId: 84532,
        gateAuthority: 'onchain',
        gatesByResource: {
          default: {
            lookupStatus: 'ok',
            sbtAddresses: [],
            chainId: 84532,
            mode: 'any',
          },
          questionResponses: {
            lookupStatus: 'ok',
            sbtAddresses: [VALID_SBT_ADDRESS],
            chainId: 84532,
            mode: 'any',
          },
        },
        sessionIdHex: LEGACY_SESSION_ID,
      },
    };

    const result = resolveConfig({ sessionConfig });

    expect(result.chipotle).toEqual(
      expect.objectContaining({
        enabled: true,
        workerUrl: 'https://worker.example.test',
      }),
    );
    expect(result.gateAddresses).toEqual([VALID_SBT_ADDRESS]);
    expect(result.accessControlConditions).toEqual([
      expect.objectContaining({
        contractAddress: VALID_SBT_ADDRESS,
      }),
    ]);
  });

  it('prefers the primary encryption gate over a gated default resource', () => {
    const defaultSbtAddress = '0x0000000000000000000000000000000000000002';
    const sessionConfig = {
      corsWorkerUrl: 'https://worker.example.test',
      encryption: {
        primaryGateId: 'questionResponses',
      },
      __registry: {
        chainId: 84532,
        gateAuthority: 'onchain',
        gatesByResource: {
          default: {
            lookupStatus: 'ok',
            sbtAddresses: [defaultSbtAddress],
            chainId: 84532,
            mode: 'any',
          },
          questionResponses: {
            lookupStatus: 'ok',
            sbtAddresses: [VALID_SBT_ADDRESS],
            chainId: 84532,
            mode: 'any',
          },
        },
        sessionIdHex: LEGACY_SESSION_ID,
      },
    };

    const result = resolveConfig({ sessionConfig });

    expect(result.gateAddresses).toEqual([VALID_SBT_ADDRESS]);
    expect(result.accessControlConditions).toEqual([
      expect.objectContaining({
        contractAddress: VALID_SBT_ADDRESS,
      }),
    ]);
  });

  it('prefers registry-backed session config when resolving Lit hook config sources', () => {
    const staticConfig = {
      corsWorkerUrl: 'https://static-worker.example.test',
    };
    const registryConfig = {
      corsWorkerUrl: 'https://registry-worker.example.test',
      litCredentials: {
        litApiBase: 'https://api.chipotle.litprotocol.com',
        litActionCid: 'QmAction123',
        litGroupId: '7',
        litPkpId: '0xpkp123',
      },
    };

    expect(
      resolveMainSiteLitSessionConfigSource({
        slug: 'dynamic-session',
        resolveRegistryConfigBySlug: (slug) => (slug === 'dynamic-session' ? registryConfig : null),
        resolveStaticConfigBySlug: () => staticConfig,
      }),
    ).toBe(registryConfig);
  });
});
