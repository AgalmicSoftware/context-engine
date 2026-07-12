import {
  clearCachedSessionWorkerConfig,
  getCachedSessionWorkerConfig,
  getSessionWorkerConfigReplicaState,
  getVerifiedWorkerCanonicalSessionBootstrap,
  getWorkerCanonicalSessionBootstrap,
  markWorkerCanonicalSessionBootstrapVerified,
  overlayCachedSessionWorkerConfig,
  readSessionWorkerConfigCache,
  upsertCachedSessionWorkerConfig,
  upsertWorkerCanonicalSessionBootstrap,
} from './sessionWorkerConfigCache.js';

describe('sessionWorkerConfigCache', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('pins worker-canonical bootstrap config under a chain-zero session identity without touching registry cache', () => {
    const registrySentinel = JSON.stringify({ sessions: { registered: { slug: 'registered' } } });
    localStorage.setItem('dg:sessionRegistryCache:v1', registrySentinel);
    const config = {
      slug: 'cloud-session',
      sessionId: '0x00112233445566778899aabbccddeeff',
      configRevision: 'revision-1',
      corsWorkerUrl: 'https://worker.example',
      sessionModeProfile: {
        authority: { mode: 'worker_canonical' },
        storage: { mode: 'worker_kv' },
        encryption: { mode: 'worker_envelope' },
      },
    };

    const result = upsertWorkerCanonicalSessionBootstrap({
      slug: config.slug,
      sessionIdHex: config.sessionId,
      workerOrigin: config.corsWorkerUrl,
      configRevision: config.configRevision,
      config,
    });

    expect(result).toMatchObject({
      status: 'cached',
      cacheKey: 'session:0:0x00112233445566778899aabbccddeeff',
      workerOrigin: 'https://worker.example',
    });
    expect(readSessionWorkerConfigCache().bySession[result.cacheKey]).toMatchObject({
      slug: 'cloud-session',
      sessionIdHex: '0x00112233445566778899aabbccddeeff',
      registryChainId: 0,
      workerOrigin: 'https://worker.example',
      configRevision: 'revision-1',
      authorityMode: 'worker_canonical',
      canonicalConfig: config,
    });
    expect(localStorage.getItem('dg:sessionRegistryCache:v1')).toBe(registrySentinel);
  });

  it('reloads a worker-canonical chain-zero entry and requires the pinned origin', () => {
    const config = {
      slug: 'cloud-session',
      sessionId: '0x00112233445566778899aabbccddeeff',
      corsWorkerUrl: 'https://worker.example',
      sessionModeProfile: { authority: { mode: 'worker_canonical' } },
    };
    upsertWorkerCanonicalSessionBootstrap({
      slug: config.slug,
      sessionIdHex: config.sessionId,
      workerOrigin: config.corsWorkerUrl,
      config,
    });

    expect(readSessionWorkerConfigCache().bySession).toHaveProperty('session:0:0x00112233445566778899aabbccddeeff');
    expect(getWorkerCanonicalSessionBootstrap({ slug: config.slug, workerOrigin: 'https://worker.example' })).toEqual(
      config,
    );
    expect(
      getVerifiedWorkerCanonicalSessionBootstrap({ slug: config.slug, workerOrigin: 'https://worker.example' }),
    ).toBeNull();
    expect(
      markWorkerCanonicalSessionBootstrapVerified({
        slug: config.slug,
        sessionIdHex: config.sessionId,
        workerOrigin: 'https://worker.example',
      }),
    ).toBe(true);
    expect(
      getVerifiedWorkerCanonicalSessionBootstrap({ slug: config.slug, workerOrigin: 'https://worker.example' }),
    ).toEqual(config);
    expect(getWorkerCanonicalSessionBootstrap({ slug: config.slug, workerOrigin: 'https://other.example' })).toBeNull();
  });

  it('requires an explicit TOFU re-pin before replacing a slug with a different worker identity', () => {
    const firstConfig = {
      slug: 'cloud-session',
      sessionId: '0x00112233445566778899aabbccddeeff',
      corsWorkerUrl: 'https://first.example',
      sessionModeProfile: { authority: { mode: 'worker_canonical' } },
    };
    const replacementConfig = {
      ...firstConfig,
      sessionId: '0xffeeddccbbaa99887766554433221100',
      corsWorkerUrl: 'https://replacement.example',
    };
    upsertWorkerCanonicalSessionBootstrap({
      slug: firstConfig.slug,
      sessionIdHex: firstConfig.sessionId,
      workerOrigin: firstConfig.corsWorkerUrl,
      config: firstConfig,
    });

    const conflict = upsertWorkerCanonicalSessionBootstrap({
      slug: replacementConfig.slug,
      sessionIdHex: replacementConfig.sessionId,
      workerOrigin: replacementConfig.corsWorkerUrl,
      config: replacementConfig,
    });
    expect(conflict).toMatchObject({
      status: 'conflict',
      existingWorkerOrigin: 'https://first.example',
      workerOrigin: 'https://replacement.example',
    });
    expect(
      getWorkerCanonicalSessionBootstrap({ slug: firstConfig.slug, workerOrigin: firstConfig.corsWorkerUrl }),
    ).toEqual(firstConfig);

    expect(
      upsertWorkerCanonicalSessionBootstrap({
        slug: replacementConfig.slug,
        sessionIdHex: replacementConfig.sessionId,
        workerOrigin: replacementConfig.corsWorkerUrl,
        config: replacementConfig,
        allowRepin: true,
      }).status,
    ).toBe('cached');
    expect(
      getWorkerCanonicalSessionBootstrap({
        slug: replacementConfig.slug,
        workerOrigin: replacementConfig.corsWorkerUrl,
      }),
    ).toEqual(replacementConfig);
    expect(
      getWorkerCanonicalSessionBootstrap({ slug: firstConfig.slug, workerOrigin: firstConfig.corsWorkerUrl }),
    ).toBeNull();
  });

  it('returns an empty normalized store when no cache exists', () => {
    expect(readSessionWorkerConfigCache()).toEqual({ v: 3, bySession: {}, slugIndex: {} });
    expect(getCachedSessionWorkerConfig('edge')).toBeNull();
  });

  it('normalizes and stores worker config entries by canonical session slug', () => {
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(1700000000000);
    upsertCachedSessionWorkerConfig({
      slug: ' general ',
      config: {
        corsWorkerUrl: ' https://worker.example ',
        allowOrigins: ' https://a.example,\nhttps://b.example ',
        rpcUrl: ' https://rpc.example ',
      },
    });
    nowSpy.mockRestore();

    expect(getCachedSessionWorkerConfig('general')).toEqual({
      corsWorkerUrl: 'https://worker.example',
      allowOrigins: ['https://a.example', 'https://b.example'],
      rpcEndpoint: 'https://rpc.example',
    });
    expect(readSessionWorkerConfigCache()).toEqual({
      v: 3,
      bySession: {
        'slug:': {
          config: {
            corsWorkerUrl: 'https://worker.example',
            allowOrigins: ['https://a.example', 'https://b.example'],
            limits: {},
            rpcEndpoint: 'https://rpc.example',
          },
          cachedAtMs: 1700000000000,
          writeNonce: 1,
          slug: '',
          sessionIdHex: '',
          registryChainId: null,
          fieldPresence: {
            allowOrigins: true,
            limits: false,
            rpcEndpoint: true,
            embeddedDeployHelperEnabled: false,
          },
        },
      },
      slugIndex: {
        '': 'slug:',
      },
    });
  });

  it('drops invalid/empty worker config payloads and clears existing entries', () => {
    upsertCachedSessionWorkerConfig({
      slug: 'edge',
      config: {
        corsWorkerUrl: 'https://worker.example',
      },
    });
    expect(getCachedSessionWorkerConfig('edge')).toEqual(
      expect.objectContaining({
        corsWorkerUrl: 'https://worker.example',
      }),
    );

    upsertCachedSessionWorkerConfig({
      slug: 'edge',
      config: { sessionName: 'not-a-worker-config' },
    });
    expect(getCachedSessionWorkerConfig('edge')).toBeNull();
  });

  it('clears a stored entry by slug', () => {
    upsertCachedSessionWorkerConfig({
      slug: 'edge',
      config: {
        corsWorkerUrl: 'https://worker.example',
      },
    });

    clearCachedSessionWorkerConfig('edge');
    expect(getCachedSessionWorkerConfig('edge')).toBeNull();
  });

  it('falls back to a unique slug-keyed cache entry when a later lookup has authoritative identity', () => {
    upsertCachedSessionWorkerConfig({
      slug: 'edge',
      config: {
        corsWorkerUrl: 'https://worker.example',
        allowOrigins: ['https://existing.example'],
        limits: { perWalletPerDay: 3 },
        rpcEndpoint: 'https://rpc.example',
      },
    });

    expect(
      getCachedSessionWorkerConfig({
        slug: 'edge',
        sessionConfig: {
          slug: 'edge',
          __registry: {
            sessionIdHex: '0xabc',
            registryChainId: 84532,
          },
        },
      }),
    ).toEqual({
      corsWorkerUrl: 'https://worker.example',
      allowOrigins: ['https://existing.example'],
      limits: { perWalletPerDay: 3 },
      rpcEndpoint: 'https://rpc.example',
    });
  });

  it('overlays a fresher cached worker config onto an existing session config without dropping non-worker fields', () => {
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(1700000000000);
    upsertCachedSessionWorkerConfig({
      slug: 'edge',
      config: {
        corsWorkerUrl: 'https://worker.example',
        allowOrigins: ['https://app.example'],
      },
    });
    nowSpy.mockRestore();

    expect(
      overlayCachedSessionWorkerConfig({
        slug: 'edge',
        sessionConfig: {
          slug: 'edge',
          sessionName: 'Edge Session',
          corsWorkerUrl: 'https://registry-mirror.example',
          __registry: {
            updatedAt: 1699999999,
          },
        },
      }),
    ).toEqual({
      slug: 'edge',
      sessionName: 'Edge Session',
      corsWorkerUrl: 'https://worker.example',
      __registry: {
        updatedAt: 1699999999,
      },
      allowOrigins: ['https://app.example'],
    });
  });

  it('preserves cached public Lit credentials so worker-mediated hooks can initialize after deploy', () => {
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(1700000000000);
    upsertCachedSessionWorkerConfig({
      slug: 'edge',
      config: {
        corsWorkerUrl: 'https://worker.example',
        litCredentials: {
          litApiBase: 'https://api.chipotle.litprotocol.com',
          litGroupId: '7',
          litPkpId: '0xpkp123',
          litActionCid: 'QmAction123',
          litUsageApiKey: 'secret-usage-key',
        },
      },
    });
    nowSpy.mockRestore();

    expect(getCachedSessionWorkerConfig('edge')).toEqual({
      corsWorkerUrl: 'https://worker.example',
      litCredentials: {
        litApiBase: 'https://api.chipotle.litprotocol.com',
        litGroupId: '7',
        litPkpId: '0xpkp123',
        litActionCid: 'QmAction123',
      },
    });
    expect(
      overlayCachedSessionWorkerConfig({
        slug: 'edge',
        sessionConfig: {
          slug: 'edge',
          sessionName: 'Edge Session',
          __registry: {
            updatedAt: 1699999999,
          },
        },
      }),
    ).toEqual({
      slug: 'edge',
      sessionName: 'Edge Session',
      corsWorkerUrl: 'https://worker.example',
      litCredentials: {
        litApiBase: 'https://api.chipotle.litprotocol.com',
        litGroupId: '7',
        litPkpId: '0xpkp123',
        litActionCid: 'QmAction123',
      },
      __registry: {
        updatedAt: 1699999999,
      },
    });
  });

  it('preserves embedded deploy-helper flags in cached worker config payloads', () => {
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(1700000000000);
    upsertCachedSessionWorkerConfig({
      slug: 'edge',
      config: {
        embeddedDeployHelperEnabled: false,
      },
    });
    nowSpy.mockRestore();

    expect(getCachedSessionWorkerConfig('edge')).toEqual({
      corsWorkerUrl: '',
      embeddedDeployHelperEnabled: false,
    });
    expect(readSessionWorkerConfigCache()).toEqual({
      v: 3,
      bySession: {
        'slug:edge': {
          config: {
            corsWorkerUrl: '',
            allowOrigins: [],
            limits: {},
            rpcEndpoint: '',
            embeddedDeployHelperEnabled: false,
          },
          cachedAtMs: 1700000000000,
          writeNonce: 1,
          slug: 'edge',
          sessionIdHex: '',
          registryChainId: null,
          fieldPresence: {
            allowOrigins: false,
            limits: false,
            rpcEndpoint: false,
            embeddedDeployHelperEnabled: true,
          },
        },
      },
      slugIndex: {
        edge: 'slug:edge',
      },
    });
  });

  it('overlays cached embedded deploy-helper flags onto fresher registry replicas', () => {
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(1700000000000);
    upsertCachedSessionWorkerConfig({
      slug: 'edge',
      config: {
        corsWorkerUrl: 'https://worker.example',
        embeddedDeployHelperEnabled: false,
      },
    });
    nowSpy.mockRestore();

    expect(
      overlayCachedSessionWorkerConfig({
        slug: 'edge',
        sessionConfig: {
          slug: 'edge',
          sessionName: 'Edge Session',
          corsWorkerUrl: 'https://registry-mirror.example',
          embeddedDeployHelperEnabled: true,
          __registry: {
            updatedAt: 1699999999,
          },
        },
      }),
    ).toEqual({
      slug: 'edge',
      sessionName: 'Edge Session',
      corsWorkerUrl: 'https://worker.example',
      embeddedDeployHelperEnabled: false,
      __registry: {
        updatedAt: 1699999999,
      },
    });
  });

  it('rebuilds an applied replica when the cached worker config timestamp changes', () => {
    const nowSpy = jest.spyOn(Date, 'now');
    const baseConfig = {
      slug: 'edge',
      sessionName: 'Edge Session',
      corsWorkerUrl: '',
      __registry: {
        updatedAt: 1699999999,
      },
    };

    nowSpy.mockReturnValue(1700000000000);
    upsertCachedSessionWorkerConfig({
      slug: 'edge',
      config: {
        corsWorkerUrl: 'https://worker-a.example',
      },
    });

    const appliedReplica = overlayCachedSessionWorkerConfig({
      slug: 'edge',
      sessionConfig: baseConfig,
    });

    nowSpy.mockReturnValue(1700000001000);
    upsertCachedSessionWorkerConfig({
      slug: 'edge',
      config: {
        corsWorkerUrl: 'https://worker-b.example',
      },
    });
    nowSpy.mockRestore();

    expect(
      overlayCachedSessionWorkerConfig({
        slug: 'edge',
        sessionConfig: appliedReplica,
      }),
    ).toEqual({
      slug: 'edge',
      sessionName: 'Edge Session',
      corsWorkerUrl: 'https://worker-b.example',
      __registry: {
        updatedAt: 1699999999,
      },
    });
  });

  it('rebuilds an applied replica when the cache is rewritten in the same millisecond', () => {
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(1700000000000);
    const baseConfig = {
      slug: 'edge',
      sessionName: 'Edge Session',
      corsWorkerUrl: '',
      __registry: {
        updatedAt: 1699999999,
      },
    };

    upsertCachedSessionWorkerConfig({
      slug: 'edge',
      config: {
        corsWorkerUrl: 'https://worker-a.example',
      },
    });

    const appliedReplica = overlayCachedSessionWorkerConfig({
      slug: 'edge',
      sessionConfig: baseConfig,
    });

    upsertCachedSessionWorkerConfig({
      slug: 'edge',
      config: {
        corsWorkerUrl: 'https://worker-b.example',
      },
    });
    nowSpy.mockRestore();

    expect(
      overlayCachedSessionWorkerConfig({
        slug: 'edge',
        sessionConfig: appliedReplica,
      }),
    ).toEqual({
      slug: 'edge',
      sessionName: 'Edge Session',
      corsWorkerUrl: 'https://worker-b.example',
      __registry: {
        updatedAt: 1699999999,
      },
    });
  });

  it('drops an applied replica when the cached worker config is cleared', () => {
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(1700000000000);
    const baseConfig = {
      slug: 'edge',
      sessionName: 'Edge Session',
      corsWorkerUrl: '',
      __registry: {
        updatedAt: 1699999999,
      },
    };

    upsertCachedSessionWorkerConfig({
      slug: 'edge',
      config: {
        corsWorkerUrl: 'https://worker-a.example',
        allowOrigins: ['https://app.example'],
      },
    });
    nowSpy.mockRestore();

    const appliedReplica = overlayCachedSessionWorkerConfig({
      slug: 'edge',
      sessionConfig: baseConfig,
    });

    clearCachedSessionWorkerConfig('edge');

    expect(
      overlayCachedSessionWorkerConfig({
        slug: 'edge',
        sessionConfig: appliedReplica,
      }),
    ).toEqual(baseConfig);
  });

  it('does not let legacy untimestamped cache entries override a populated registry mirror', () => {
    localStorage.setItem(
      'ce:sessionWorkerConfigCache:v1',
      JSON.stringify({
        v: 1,
        bySession: {
          edge: {
            corsWorkerUrl: 'https://worker-kv-cache.example',
          },
        },
      }),
    );

    expect(
      overlayCachedSessionWorkerConfig({
        slug: 'edge',
        sessionConfig: {
          slug: 'edge',
          sessionName: 'Edge Session',
          corsWorkerUrl: 'https://registry-mirror.example',
          __registry: {
            updatedAt: 1700000001,
          },
        },
      }),
    ).toEqual({
      slug: 'edge',
      sessionName: 'Edge Session',
      corsWorkerUrl: 'https://registry-mirror.example',
      __registry: {
        updatedAt: 1700000001,
      },
    });
  });

  it('treats compatibility workerUrl aliases as authoritative registry mirrors for freshness checks', () => {
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(1700000000000);
    upsertCachedSessionWorkerConfig({
      slug: 'edge',
      config: {
        corsWorkerUrl: 'https://worker-kv-cache.example',
      },
    });
    nowSpy.mockRestore();

    expect(
      overlayCachedSessionWorkerConfig({
        slug: 'edge',
        sessionConfig: {
          slug: 'edge',
          sessionName: 'Edge Session',
          workerUrl: 'https://registry-compat.example',
          __registry: {
            updatedAt: 1700000001,
          },
        },
      }),
    ).toEqual({
      slug: 'edge',
      sessionName: 'Edge Session',
      workerUrl: 'https://registry-compat.example',
      __registry: {
        updatedAt: 1700000001,
      },
    });
  });

  it('still uses legacy cache entries when the registry mirror is missing', () => {
    localStorage.setItem(
      'ce:sessionWorkerConfigCache:v1',
      JSON.stringify({
        v: 1,
        bySession: {
          edge: {
            corsWorkerUrl: 'https://worker-kv-cache.example',
          },
        },
      }),
    );

    expect(
      overlayCachedSessionWorkerConfig({
        slug: 'edge',
        sessionConfig: {
          slug: 'edge',
          sessionName: 'Edge Session',
          corsWorkerUrl: '',
          __registry: {
            updatedAt: 1700000001,
          },
        },
      }),
    ).toEqual({
      slug: 'edge',
      sessionName: 'Edge Session',
      corsWorkerUrl: 'https://worker-kv-cache.example',
      __registry: {
        updatedAt: 1700000001,
      },
    });
  });

  it('isolates same-slug cache replicas by authoritative session identity', () => {
    const nowSpy = jest.spyOn(Date, 'now');
    nowSpy.mockReturnValue(1700000000000);
    upsertCachedSessionWorkerConfig({
      slug: 'edge',
      sessionConfig: {
        slug: 'edge',
        __registry: {
          sessionIdHex: '0x00000000000000000000000000000001',
          registryChainId: 84532,
        },
      },
      config: {
        corsWorkerUrl: 'https://worker-a.example',
      },
    });
    nowSpy.mockReturnValue(1700000001000);
    upsertCachedSessionWorkerConfig({
      slug: 'edge',
      sessionConfig: {
        slug: 'edge',
        __registry: {
          sessionIdHex: '0x00000000000000000000000000000002',
          registryChainId: 84531,
        },
      },
      config: {
        corsWorkerUrl: 'https://worker-b.example',
      },
    });
    nowSpy.mockRestore();

    expect(
      overlayCachedSessionWorkerConfig({
        slug: 'edge',
        sessionConfig: {
          slug: 'edge',
          corsWorkerUrl: '',
          __registry: {
            sessionIdHex: '0x00000000000000000000000000000001',
            registryChainId: 84532,
            updatedAt: 1699999999,
          },
        },
      }),
    ).toEqual({
      slug: 'edge',
      corsWorkerUrl: 'https://worker-a.example',
      __registry: {
        sessionIdHex: '0x00000000000000000000000000000001',
        registryChainId: 84532,
        updatedAt: 1699999999,
      },
    });

    expect(
      overlayCachedSessionWorkerConfig({
        slug: 'edge',
        sessionConfig: {
          slug: 'edge',
          corsWorkerUrl: '',
          __registry: {
            sessionIdHex: '0x00000000000000000000000000000002',
            registryChainId: 84531,
            updatedAt: 1699999999,
          },
        },
      }),
    ).toEqual({
      slug: 'edge',
      corsWorkerUrl: 'https://worker-b.example',
      __registry: {
        sessionIdHex: '0x00000000000000000000000000000002',
        registryChainId: 84531,
        updatedAt: 1699999999,
      },
    });
  });

  it('fails closed for slug-only lookups when multiple authoritative records share a slug', () => {
    const nowSpy = jest.spyOn(Date, 'now');
    nowSpy.mockReturnValue(1700000000000);
    upsertCachedSessionWorkerConfig({
      slug: 'edge',
      sessionConfig: {
        slug: 'edge',
        __registry: {
          sessionIdHex: '0x00000000000000000000000000000001',
          registryChainId: 84532,
        },
      },
      config: {
        corsWorkerUrl: 'https://worker-a.example',
      },
    });
    nowSpy.mockReturnValue(1700000001000);
    upsertCachedSessionWorkerConfig({
      slug: 'edge',
      sessionConfig: {
        slug: 'edge',
        __registry: {
          sessionIdHex: '0x00000000000000000000000000000002',
          registryChainId: 84531,
        },
      },
      config: {
        corsWorkerUrl: 'https://worker-b.example',
      },
    });
    nowSpy.mockRestore();

    expect(readSessionWorkerConfigCache()).toEqual(
      expect.objectContaining({
        slugIndex: expect.objectContaining({
          edge: null,
        }),
      }),
    );
    expect(getCachedSessionWorkerConfig('edge')).toBeNull();
  });

  it('fails closed for slug-only lookups when registry cache points at one of several same-slug records', () => {
    const nowSpy = jest.spyOn(Date, 'now');
    nowSpy.mockReturnValue(1700000000000);
    upsertCachedSessionWorkerConfig({
      slug: 'edge',
      sessionConfig: {
        slug: 'edge',
        __registry: {
          sessionIdHex: '0x00000000000000000000000000000001',
          registryChainId: 84532,
        },
      },
      config: {
        corsWorkerUrl: 'https://worker-a.example',
      },
    });
    nowSpy.mockReturnValue(1700000001000);
    upsertCachedSessionWorkerConfig({
      slug: 'edge',
      sessionConfig: {
        slug: 'edge',
        __registry: {
          sessionIdHex: '0x00000000000000000000000000000002',
          registryChainId: 84531,
        },
      },
      config: {
        corsWorkerUrl: 'https://worker-b.example',
      },
    });
    nowSpy.mockRestore();

    localStorage.setItem(
      'dg:sessionRegistryCache:v1',
      JSON.stringify({
        sessions: {
          edge: {
            slug: 'edge',
            __registry: {
              sessionIdHex: '0x00000000000000000000000000000001',
              registryChainId: 84532,
            },
          },
        },
      }),
    );

    expect(readSessionWorkerConfigCache()).toEqual(
      expect.objectContaining({
        slugIndex: expect.objectContaining({
          edge: null,
        }),
      }),
    );
    expect(getCachedSessionWorkerConfig('edge')).toBeNull();
  });

  it('prefers explicitly provided session identity over slug registry fallback during cache writes', () => {
    localStorage.setItem(
      'dg:sessionRegistryCache:v1',
      JSON.stringify({
        sessions: {
          edge: {
            slug: 'edge',
            __registry: {
              sessionIdHex: '0x00000000000000000000000000000001',
              registryChainId: 84532,
            },
          },
        },
      }),
    );

    upsertCachedSessionWorkerConfig({
      slug: 'edge',
      sessionIdHex: '0x00000000000000000000000000000002',
      registryChainId: 84531,
      config: {
        corsWorkerUrl: 'https://worker-explicit.example',
      },
    });

    expect(
      overlayCachedSessionWorkerConfig({
        slug: 'edge',
        sessionConfig: {
          slug: 'edge',
          corsWorkerUrl: '',
          __registry: {
            sessionIdHex: '0x00000000000000000000000000000002',
            registryChainId: 84531,
            updatedAt: 1699999999,
          },
        },
      }),
    ).toEqual({
      slug: 'edge',
      corsWorkerUrl: 'https://worker-explicit.example',
      __registry: {
        sessionIdHex: '0x00000000000000000000000000000002',
        registryChainId: 84531,
        updatedAt: 1699999999,
      },
    });

    expect(
      overlayCachedSessionWorkerConfig({
        slug: 'edge',
        sessionConfig: {
          slug: 'edge',
          corsWorkerUrl: '',
          __registry: {
            sessionIdHex: '0x00000000000000000000000000000001',
            registryChainId: 84532,
            updatedAt: 1699999999,
          },
        },
      }),
    ).toEqual({
      slug: 'edge',
      corsWorkerUrl: '',
      __registry: {
        sessionIdHex: '0x00000000000000000000000000000001',
        registryChainId: 84532,
        updatedAt: 1699999999,
      },
    });
  });

  it('ignores encrypted worker URL envelopes when deciding whether cache bridging should apply', () => {
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(1700000000000);
    upsertCachedSessionWorkerConfig({
      slug: 'edge',
      config: {
        corsWorkerUrl: 'https://worker-cache.example',
      },
    });
    nowSpy.mockRestore();

    expect(
      getSessionWorkerConfigReplicaState({
        slug: 'edge',
        sessionConfig: {
          slug: 'edge',
          corsWorkerUrl: {
            ciphertext: 'abc',
            iv: 'def',
            aad: {},
          },
          __registry: {
            updatedAt: 1700000001,
          },
        },
      }),
    ).toEqual(
      expect.objectContaining({
        cacheApplied: true,
        cachedConfig: expect.objectContaining({
          corsWorkerUrl: 'https://worker-cache.example',
        }),
        sessionConfig: expect.objectContaining({
          slug: 'edge',
          corsWorkerUrl: 'https://worker-cache.example',
          __registry: {
            updatedAt: 1700000001,
          },
        }),
      }),
    );
  });

  it('clears stale allowOrigins when the cached worker config explicitly removes them', () => {
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(1700000000000);
    upsertCachedSessionWorkerConfig({
      slug: 'edge',
      config: {
        corsWorkerUrl: 'https://worker.example',
        allowOrigins: [],
      },
    });
    nowSpy.mockRestore();

    expect(
      overlayCachedSessionWorkerConfig({
        slug: 'edge',
        sessionConfig: {
          slug: 'edge',
          corsWorkerUrl: 'https://registry-mirror.example',
          allowOrigins: ['https://stale.example'],
          __registry: {
            updatedAt: 1699999999,
          },
        },
      }),
    ).toEqual({
      slug: 'edge',
      corsWorkerUrl: 'https://worker.example',
      allowOrigins: [],
      __registry: {
        updatedAt: 1699999999,
      },
    });
  });

  it('clears stale limits when the cached worker config explicitly removes them', () => {
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(1700000000000);
    upsertCachedSessionWorkerConfig({
      slug: 'edge',
      config: {
        corsWorkerUrl: 'https://worker.example',
        limits: {},
      },
    });
    nowSpy.mockRestore();

    expect(
      overlayCachedSessionWorkerConfig({
        slug: 'edge',
        sessionConfig: {
          slug: 'edge',
          corsWorkerUrl: 'https://registry-mirror.example',
          limits: {
            perWalletPerDay: 5,
          },
          __registry: {
            updatedAt: 1699999999,
          },
        },
      }),
    ).toEqual({
      slug: 'edge',
      corsWorkerUrl: 'https://worker.example',
      limits: {},
      __registry: {
        updatedAt: 1699999999,
      },
    });
  });

  it('clears stale rpc endpoints when the cached worker config explicitly removes them', () => {
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(1700000000000);
    upsertCachedSessionWorkerConfig({
      slug: 'edge',
      config: {
        corsWorkerUrl: 'https://worker.example',
        rpcEndpoint: '',
      },
    });
    nowSpy.mockRestore();

    expect(
      overlayCachedSessionWorkerConfig({
        slug: 'edge',
        sessionConfig: {
          slug: 'edge',
          corsWorkerUrl: 'https://registry-mirror.example',
          rpcEndpoint: 'https://stale-rpc.example',
          rpcUrl: 'https://stale-rpc.example',
          __registry: {
            updatedAt: 1699999999,
          },
        },
      }),
    ).toEqual({
      slug: 'edge',
      corsWorkerUrl: 'https://worker.example',
      rpcEndpoint: '',
      rpcUrl: '',
      __registry: {
        updatedAt: 1699999999,
      },
    });
  });
});
