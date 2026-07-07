import {
  CreateSBTGroup,
  contractScripts,
  REGISTRY_CACHE_KEY,
  makeInstance,
  setupCreateSBTGroupTestLifecycle,
} from './CreateSBTGroup.testUtils';

describe('CreateSBTGroup scoped lock routing', () => {
  setupCreateSBTGroupTestLifecycle();

  it('unions scoped lock gates from provided SBT list session sources without colliding duplicate gate ids', () => {
    const instance = makeInstance({
      network: { id: 84532, name: 'Base Sepolia' },
      sessionSlug: 'alpha',
      lockGatePreferredSessionSlug: 'beta',
      lockGateSessionSources: [
        {
          sessionSlug: 'alpha',
          sessionConfig: {
            slug: 'alpha',
            sessionName: 'Alpha',
            networkChainId: 84532,
            sponsored: {
              defaultGateId: 'default_gate',
              gates: {
                default_gate: {
                  label: 'Alpha Gate',
                  sbtAddresses: ['0x1111111111111111111111111111111111111111'],
                  chainId: 84532,
                  litChain: 'baseSepolia',
                },
              },
            },
            lit: {
              defaultGateId: 'default_gate',
            },
          },
        },
        {
          sessionSlug: 'beta',
          sessionConfig: {
            slug: 'beta',
            sessionName: 'Beta',
            networkChainId: 84532,
            sponsored: {
              defaultGateId: 'default_gate',
              gates: {
                default_gate: {
                  label: 'Beta Gate',
                  sbtAddresses: ['0x2222222222222222222222222222222222222222'],
                  chainId: 84532,
                  litChain: 'baseSepolia',
                },
              },
            },
            lit: {
              defaultGateId: 'default_gate',
            },
          },
        },
      ],
    });
    instance.getSelectedAuthoringChainId = jest.fn(() => 84532);
    instance.getSelectedAuthoringChain = jest.fn(() => ({ id: 84532, name: 'Base Sepolia' }));

    const { gateOptions, gateMap, defaultGateId } = instance.resolveLockGateOptions();
    const alphaGate = gateOptions.find((gate) => gate.label === 'Alpha');
    const betaGate = gateOptions.find((gate) => gate.label === 'Beta');

    expect(gateOptions).toHaveLength(2);
    expect(new Set(gateOptions.map((gate) => gate.id)).size).toBe(2);
    expect(alphaGate).toEqual(
      expect.objectContaining({
        id: expect.stringMatching(/^session:alpha::default_gate$/),
        sourceGateId: 'default_gate',
        sourceSessionSlug: 'alpha',
        sbtAddress: '0x1111111111111111111111111111111111111111',
      }),
    );
    expect(betaGate).toEqual(
      expect.objectContaining({
        id: expect.stringMatching(/^session:beta::default_gate$/),
        sourceGateId: 'default_gate',
        sourceSessionSlug: 'beta',
        sbtAddress: '0x2222222222222222222222222222222222222222',
      }),
    );
    expect(defaultGateId).toBe(betaGate.id);
    expect(gateMap[alphaGate.id]).toEqual(
      expect.objectContaining({
        sourceSessionSlug: 'alpha',
      }),
    );
    expect(gateMap[betaGate.id]).toEqual(
      expect.objectContaining({
        sourceSessionSlug: 'beta',
      }),
    );

    instance.state = {
      ...instance.state,
      sbtDescription: 'Hidden details',
      metadataLockGateIds: {
        ...instance.state.metadataLockGateIds,
        description: [betaGate.id],
      },
    };

    const preview = instance.buildMetadataPreview();

    expect(preview.encryptedFieldGates).toEqual(
      expect.objectContaining({
        description: betaGate.id,
      }),
    );
    expect(preview.encryption).toEqual(
      expect.objectContaining({
        enabled: true,
        defaultGateId: betaGate.id,
        gateIds: [betaGate.id],
        gates: [
          expect.objectContaining({
            gateId: betaGate.id,
            sbtAddress: '0x2222222222222222222222222222222222222222',
          }),
        ],
      }),
    );
  });

  it('keeps unresolved non-general lock readers strict even when the general session is authoritative', () => {
    const priorRegistryCache = localStorage.getItem(REGISTRY_CACHE_KEY);
    localStorage.setItem(
      REGISTRY_CACHE_KEY,
      JSON.stringify({
        sessions: {
          '': {
            slug: '',
            sessionName: 'Registry General',
            networkChainId: 84532,
            sponsored: {
              defaultGateId: 'general_gate',
              gates: {
                general_gate: {
                  label: 'General Gate',
                  sbtAddresses: ['0x1111111111111111111111111111111111111111'],
                  chainId: 84532,
                  litChain: 'baseSepolia',
                },
              },
            },
            lit: {
              defaultGateId: 'general_gate',
            },
            __registry: {
              gateAuthority: 'onchain',
              gatesByResource: {
                default: {
                  gateId: 'general_gate',
                  sbtAddresses: ['0x1111111111111111111111111111111111111111'],
                  lookupStatus: 'ok',
                  chainId: 84532,
                },
              },
            },
          },
        },
      }),
    );

    try {
      const instance = makeInstance({
        network: { id: 84532, name: 'Base Sepolia' },
        sessionSlug: 'missing-session',
      });

      const resolved = instance.getSessionConfigForNetwork();
      const { gateOptions, defaultGateId } = instance.resolveLockGateOptions();

      expect(resolved).toBe('missing-session');
      expect(defaultGateId).toBe('');
      expect(gateOptions).toEqual([]);
    } finally {
      if (priorRegistryCache == null) {
        localStorage.removeItem(REGISTRY_CACHE_KEY);
      } else {
        localStorage.setItem(REGISTRY_CACHE_KEY, priorRegistryCache);
      }
    }
  });

  it('passes unresolved non-general slugs through mint routing instead of inheriting general', async () => {
    const priorRegistryCache = localStorage.getItem(REGISTRY_CACHE_KEY);
    localStorage.setItem(
      REGISTRY_CACHE_KEY,
      JSON.stringify({
        sessions: {
          '': {
            slug: '',
            sessionName: 'Registry General',
            networkChainId: 84532,
            contracts: {
              sbtFactory: {
                address: '0x9999999999999999999999999999999999999999',
                chainId: 84532,
              },
            },
          },
        },
      }),
    );

    const instance = makeInstance({
      provider: 'mock-provider',
      account: '0xCreator',
      loginComplete: true,
      network: { id: 84532, name: 'Base Sepolia' },
      sessionSlug: 'missing-session',
    });
    instance.state = {
      ...instance.state,
      sbtName: 'Strict Group',
      tokenURI: 'ar://metadata',
      sbtDistribution: {
        ...instance.state.sbtDistribution,
        burnAuth: 'AdminOnly',
        distributionOption: 'anyoneCanMint',
      },
    };

    const countSpy = jest.spyOn(contractScripts, 'countSBTCreated').mockResolvedValue(0);
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const createSpy = jest
      .spyOn(contractScripts, 'createSBT')
      .mockRejectedValue(new Error('Missing SBT factory for missing-session'));

    try {
      await instance.mintSBT();

      expect(countSpy).toHaveBeenCalledWith('mock-provider', 'missing-session');
      expect(createSpy).toHaveBeenCalledWith(
        'mock-provider',
        'Strict Group',
        'CE-SBT-1',
        0,
        '0xCreator',
        0,
        false,
        0,
        [],
        'ar://metadata',
        expect.anything(),
        'missing-session',
        '',
        {},
      );
      expect(instance.state.mintingFailed).toBe(true);
      expect(instance.state.error).toContain('missing-session');
    } finally {
      consoleSpy.mockRestore();
      if (priorRegistryCache == null) {
        localStorage.removeItem(REGISTRY_CACHE_KEY);
      } else {
        localStorage.setItem(REGISTRY_CACHE_KEY, priorRegistryCache);
      }
    }
  });
});
