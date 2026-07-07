import {
  checkSponsoredAccess,
  getDefaultSponsoredGate,
  primeSponsoredAccessCheck,
  readCachedSponsoredAccess,
  resolveSponsoredGateForResource,
  resolveSponsoredGateStateForResource,
} from './sponsoredAccess.js';
import contractScripts from './contractScripts.js';

jest.mock('./contractScripts.js', () => ({
  __esModule: true,
  default: {
    userHasSBT: jest.fn(),
  },
}));

const createDeferred = () => {
  let resolve;
  const promise = new Promise((nextResolve) => {
    resolve = nextResolve;
  });
  return { promise, resolve };
};

describe('sponsoredAccess on-chain precedence', () => {
  const onChainSbt = '0x0000000000000000000000000000000000000101';
  const legacySbt = '0x0000000000000000000000000000000000000202';

  it('prefers on-chain gate snapshots over metadata gates', () => {
    const cfg = {
      sponsored: {
        defaultGateId: 'legacy-default',
        gates: {
          'legacy-default': { sbtAddresses: [legacySbt], mode: 'all', chainId: 84532 },
        },
      },
      __registry: {
        gateAuthority: 'onchain',
        gatesByResource: {
          default: {
            lookupStatus: 'ok',
            sbtAddresses: [onChainSbt],
            mode: 'any',
            chainId: 84532,
          },
        },
      },
    };

    const gate = getDefaultSponsoredGate(cfg);
    expect(gate?.sbtAddress).toBe(onChainSbt);
    expect(gate?.mode).toBe('any');
  });

  it('treats empty on-chain gates as explicit open access (no metadata fallback)', () => {
    const cfg = {
      sponsored: {
        defaultGateId: 'legacy-default',
        gates: {
          'legacy-default': { sbtAddresses: [legacySbt], mode: 'all', chainId: 84532 },
        },
      },
      __registry: {
        gateAuthority: 'onchain',
        gatesByResource: {
          default: {
            lookupStatus: 'ok',
            sbtAddresses: [],
            mode: 'any',
            chainId: 84532,
          },
        },
      },
    };

    expect(getDefaultSponsoredGate(cfg)).toBeNull();
  });

  it('does not use metadata fallback when on-chain gate authority is unavailable', () => {
    const cfg = {
      sponsored: {
        defaultGateId: 'legacy-default',
        gates: {
          'legacy-default': { sbtAddresses: [legacySbt], mode: 'all', chainId: 84532 },
        },
      },
      __registry: {
        gateAuthority: 'unknown',
      },
    };

    const gate = resolveSponsoredGateForResource(cfg, 'default');
    expect(gate).toBeNull();
  });

  it('falls back to the default on-chain gate for sponsored RPC when no resource gate is set', () => {
    const cfg = {
      __registry: {
        gateAuthority: 'onchain',
        gatesByResource: {
          default: {
            lookupStatus: 'ok',
            sbtAddresses: [onChainSbt],
            mode: 'all',
            chainId: 84532,
          },
          rpc: {
            lookupStatus: 'ok',
            sbtAddresses: [],
            mode: 'any',
            chainId: 84532,
          },
        },
      },
    };

    const state = resolveSponsoredGateStateForResource(cfg, 'rpc');

    expect(state.status).toBe('restricted');
    expect(state.resourceKey).toBe('rpc');
    expect(state.gate?.sbtAddress).toBe(onChainSbt);
    expect(state.gate?.mode).toBe('all');
  });

  it('does not apply the default-gate fallback to non-RPC resources', () => {
    const cfg = {
      __registry: {
        gateAuthority: 'onchain',
        gatesByResource: {
          default: {
            lookupStatus: 'ok',
            sbtAddresses: [onChainSbt],
            mode: 'all',
            chainId: 84532,
          },
          arweave: {
            lookupStatus: 'ok',
            sbtAddresses: [],
            mode: 'any',
            chainId: 84532,
          },
        },
      },
    };

    const state = resolveSponsoredGateStateForResource(cfg, 'arweave');

    expect(state.status).toBe('open');
    expect(state.gate).toBeNull();
  });
});

describe('sponsoredAccess cache behavior', () => {
  const gateSbt = '0x0000000000000000000000000000000000000A11';
  const cfg = {
    __registry: {
      gateAuthority: 'onchain',
      gatesByResource: {
        default: {
          lookupStatus: 'ok',
          sbtAddresses: [gateSbt],
          mode: 'any',
          chainId: 84532,
        },
      },
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('reuses cached access verdict within hit TTL', async () => {
    contractScripts.userHasSBT.mockResolvedValue(true);
    const nowSpy = jest.spyOn(Date, 'now');
    try {
      nowSpy.mockReturnValue(10_000);
      const first = await checkSponsoredAccess({
        sessionConfig: cfg,
        sessionSlug: 'edge',
        account: '0x00000000000000000000000000000000000000a1',
        resourceKey: 'default',
      });
      expect(first.status).toBe('granted');
      expect(contractScripts.userHasSBT).toHaveBeenCalledTimes(1);

      nowSpy.mockReturnValue(39_000);
      const second = await checkSponsoredAccess({
        sessionConfig: cfg,
        sessionSlug: 'edge',
        account: '0x00000000000000000000000000000000000000a1',
        resourceKey: 'default',
      });
      expect(second.status).toBe('granted');
      expect(contractScripts.userHasSBT).toHaveBeenCalledTimes(1);
    } finally {
      nowSpy.mockRestore();
    }
  });

  it('rechecks access after hit TTL expires', async () => {
    contractScripts.userHasSBT.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    const nowSpy = jest.spyOn(Date, 'now');
    try {
      nowSpy.mockReturnValue(100_000);
      const first = await checkSponsoredAccess({
        sessionConfig: cfg,
        sessionSlug: 'edge',
        account: '0x00000000000000000000000000000000000000a2',
        resourceKey: 'default',
      });
      expect(first.status).toBe('granted');
      expect(contractScripts.userHasSBT).toHaveBeenCalledTimes(1);

      nowSpy.mockReturnValue(131_500);
      const second = await checkSponsoredAccess({
        sessionConfig: cfg,
        sessionSlug: 'edge',
        account: '0x00000000000000000000000000000000000000a2',
        resourceKey: 'default',
      });
      expect(second.status).toBe('denied');
      expect(contractScripts.userHasSBT).toHaveBeenCalledTimes(2);
    } finally {
      nowSpy.mockRestore();
    }
  });

  it('starts hit TTL from post-check completion time', async () => {
    let now = 1_000;
    const nowSpy = jest.spyOn(Date, 'now').mockImplementation(() => now);
    contractScripts.userHasSBT.mockImplementation(async () => {
      now = 40_500;
      return true;
    });
    try {
      const first = await checkSponsoredAccess({
        sessionConfig: cfg,
        sessionSlug: 'edge',
        account: '0x00000000000000000000000000000000000000a3',
        resourceKey: 'default',
      });
      expect(first.status).toBe('granted');
      expect(contractScripts.userHasSBT).toHaveBeenCalledTimes(1);

      now = 40_600;
      const second = await checkSponsoredAccess({
        sessionConfig: cfg,
        sessionSlug: 'edge',
        account: '0x00000000000000000000000000000000000000a3',
        resourceKey: 'default',
      });
      expect(second.status).toBe('granted');
      expect(contractScripts.userHasSBT).toHaveBeenCalledTimes(1);
    } finally {
      nowSpy.mockRestore();
    }
  });

  it('dedupes concurrent direct and primed access checks into one SBT lookup', async () => {
    let resolveLookup;
    const lookup = new Promise((resolve) => {
      resolveLookup = resolve;
    });
    contractScripts.userHasSBT.mockImplementation(() => lookup);

    const args = {
      sessionConfig: cfg,
      sessionSlug: 'edge',
      account: '0x00000000000000000000000000000000000000a7',
      resourceKey: 'default',
    };

    const direct = checkSponsoredAccess(args);
    const primed = primeSponsoredAccessCheck(args);

    expect(contractScripts.userHasSBT).toHaveBeenCalledTimes(1);

    resolveLookup(true);
    const [directResult, primedResult] = await Promise.all([direct, primed]);

    expect(directResult.status).toBe('granted');
    expect(primedResult.status).toBe('granted');
    expect(contractScripts.userHasSBT).toHaveBeenCalledTimes(1);
  });

  it('returns unresolved for timed-out inflight access checks while suppressing duplicate retries within the hit TTL', async () => {
    jest.useFakeTimers();
    let now = 0;
    const nowSpy = jest.spyOn(Date, 'now').mockImplementation(() => now);
    const neverResolvingLookup = new Promise(() => {});
    contractScripts.userHasSBT.mockImplementationOnce(() => neverResolvingLookup).mockResolvedValueOnce(true);

    const args = {
      sessionConfig: cfg,
      sessionSlug: 'edge-timeout',
      account: '0x00000000000000000000000000000000000000a8',
      resourceKey: 'default',
    };

    try {
      const first = checkSponsoredAccess(args);

      expect(contractScripts.userHasSBT).toHaveBeenCalledTimes(1);

      now = 30_000;
      jest.advanceTimersByTime(30_000);
      await expect(first).resolves.toEqual(
        expect.objectContaining({
          status: 'unresolved',
          resourceKey: 'default',
        }),
      );
      expect(readCachedSponsoredAccess(args)).toEqual(
        expect.objectContaining({
          status: 'unresolved',
          resourceKey: 'default',
        }),
      );

      const second = await checkSponsoredAccess(args);

      expect(second.status).toBe('unresolved');
      expect(contractScripts.userHasSBT).toHaveBeenCalledTimes(1);

      now = 60_001;
      jest.advanceTimersByTime(30_001);
      await expect(checkSponsoredAccess(args)).resolves.toEqual(
        expect.objectContaining({
          status: 'granted',
          resourceKey: 'default',
        }),
      );
      expect(contractScripts.userHasSBT).toHaveBeenCalledTimes(2);
    } finally {
      nowSpy.mockRestore();
      jest.useRealTimers();
    }
  });

  it('ignores late results from a timed-out access check after a newer verdict is cached', async () => {
    jest.useFakeTimers();
    let now = 0;
    const nowSpy = jest.spyOn(Date, 'now').mockImplementation(() => now);
    const firstLookup = createDeferred();
    const secondLookup = createDeferred();
    contractScripts.userHasSBT
      .mockImplementationOnce(() => firstLookup.promise)
      .mockImplementationOnce(() => secondLookup.promise);

    const args = {
      sessionConfig: cfg,
      sessionSlug: 'edge-late-resolve',
      account: '0x00000000000000000000000000000000000000a9',
      resourceKey: 'default',
    };

    try {
      const first = checkSponsoredAccess(args);

      expect(contractScripts.userHasSBT).toHaveBeenCalledTimes(1);

      now = 30_000;
      jest.advanceTimersByTime(30_000);
      await expect(first).resolves.toEqual(
        expect.objectContaining({
          status: 'unresolved',
          resourceKey: 'default',
        }),
      );
      expect(readCachedSponsoredAccess(args)).toEqual(
        expect.objectContaining({
          status: 'unresolved',
          resourceKey: 'default',
        }),
      );

      now = 60_001;
      jest.advanceTimersByTime(30_001);
      const second = checkSponsoredAccess(args);

      expect(contractScripts.userHasSBT).toHaveBeenCalledTimes(2);

      secondLookup.resolve(false);
      await expect(second).resolves.toEqual(
        expect.objectContaining({
          status: 'denied',
          resourceKey: 'default',
        }),
      );
      expect(readCachedSponsoredAccess(args)).toEqual(
        expect.objectContaining({
          status: 'denied',
          resourceKey: 'default',
        }),
      );

      firstLookup.resolve(true);
      await Promise.resolve();
      await Promise.resolve();

      expect(readCachedSponsoredAccess(args)).toEqual(
        expect.objectContaining({
          status: 'denied',
          resourceKey: 'default',
        }),
      );
    } finally {
      nowSpy.mockRestore();
      jest.useRealTimers();
    }
  });

  it('evicts oldest cached entries beyond max cache size', async () => {
    contractScripts.userHasSBT.mockResolvedValue(true);
    const nowSpy = jest.spyOn(Date, 'now');
    try {
      nowSpy.mockReturnValue(250_000);
      const firstAccount = '0x0000000000000000000000000000000000000b00';
      await checkSponsoredAccess({
        sessionConfig: cfg,
        sessionSlug: 'edge',
        account: firstAccount,
        resourceKey: 'default',
      });
      expect(contractScripts.userHasSBT).toHaveBeenCalledTimes(1);

      for (let i = 1; i <= 500; i += 1) {
        const account = `0x${String(i).padStart(40, '0')}`;
        // eslint-disable-next-line no-await-in-loop
        await checkSponsoredAccess({
          sessionConfig: cfg,
          sessionSlug: 'edge',
          account,
          resourceKey: 'default',
        });
      }
      expect(contractScripts.userHasSBT).toHaveBeenCalledTimes(501);

      await checkSponsoredAccess({
        sessionConfig: cfg,
        sessionSlug: 'edge',
        account: firstAccount,
        resourceKey: 'default',
      });
      expect(contractScripts.userHasSBT).toHaveBeenCalledTimes(502);
    } finally {
      nowSpy.mockRestore();
    }
  });
});

describe('sponsoredAccess unavailable gate handling', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('does not treat unavailable on-chain gate authority as open sponsorship', async () => {
    const result = await checkSponsoredAccess({
      sessionConfig: {
        __registry: {
          gateAuthority: 'unknown',
        },
      },
      sessionSlug: 'edge',
      account: '0x00000000000000000000000000000000000000a4',
      resourceKey: 'default',
    });

    expect(result.status).toBe('unknown');
    expect(contractScripts.userHasSBT).not.toHaveBeenCalled();
  });

  it('does not treat unresolved gate lookups as open sponsorship', async () => {
    const result = await checkSponsoredAccess({
      sessionConfig: {
        __registry: {
          gateAuthority: 'onchain',
          gatesByResource: {
            default: {
              lookupStatus: 'error',
              sbtAddresses: ['0x0000000000000000000000000000000000000A11'],
            },
          },
        },
      },
      sessionSlug: 'edge',
      account: '0x00000000000000000000000000000000000000a5',
      resourceKey: 'default',
    });

    expect(result.status).toBe('unknown');
    expect(contractScripts.userHasSBT).not.toHaveBeenCalled();
  });

  it('returns an explicit error status when the gate check throws', async () => {
    const debugSpy = jest.spyOn(console, 'debug').mockImplementation(() => {});
    contractScripts.userHasSBT.mockRejectedValue(new Error('rpc down'));

    const result = await checkSponsoredAccess({
      sessionConfig: {
        __registry: {
          gateAuthority: 'onchain',
          gatesByResource: {
            default: {
              lookupStatus: 'ok',
              sbtAddresses: ['0x0000000000000000000000000000000000000A11'],
              mode: 'any',
              chainId: 84532,
            },
          },
        },
      },
      sessionSlug: 'edge',
      account: '0x00000000000000000000000000000000000000a6',
      resourceKey: 'default',
    });

    expect(result).toEqual(
      expect.objectContaining({
        status: 'error',
        error: 'rpc down',
        resourceKey: 'default',
      }),
    );
    expect(debugSpy).not.toHaveBeenCalled();
  });
});
