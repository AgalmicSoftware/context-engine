import { cloneSessionModePreset, SESSION_MODE_PRESET_IDS } from '../../utilities/session/sessionModeProfile';
import { initializeMainSiteWorkerCanonicalCaches } from './mainSiteWorkerCanonicalCacheRuntime';

const makeHost = () => {
  const calls: string[] = [];
  return {
    calls,
    host: {
      initializeQuestionCacheForGroup: jest.fn(async (_slug: string, _opts?: Record<string, unknown>) => {
        calls.push('questions');
      }),
      initializeSbtCacheForGroup: jest.fn(async (_slug: string, _opts?: Record<string, unknown>) => {
        calls.push('sbt');
      }),
      initializeSurveyCacheForGroup: jest.fn(async (_slug: string, _opts?: Record<string, unknown>) => {
        calls.push('surveys');
      }),
      fetchQuestionResponsesChunkedForGroup: jest.fn(async (_slug: string, _opts?: Record<string, unknown>) => {
        calls.push('responses');
      }),
      setReadinessStateIfChanged: jest.fn((patch: Record<string, unknown>, _callback?: () => void) => {
        if (patch.isSBTCacheReady) calls.push('sbt-ready');
        if (patch.isSurveyCacheReady) calls.push('surveys-ready');
      }),
      checkAllCachesReady: jest.fn(),
      startSbtEventListenerForGroup: jest.fn((_slug: string) => {
        calls.push('sbt-listener');
      }),
    },
  };
};

const makeWorkerConfig = () => ({
  slug: 'worker-session',
  sessionId: '0x00112233445566778899aabbccddeeff',
  corsWorkerUrl: 'https://worker.example.com',
  sessionModeProfile: cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE),
});

describe('mainSiteWorkerCanonicalCacheRuntime', () => {
  it('hydrates pure Worker caches without any chain or SBT work', async () => {
    const { host, calls } = makeHost();

    await expect(
      initializeMainSiteWorkerCanonicalCaches({
        host,
        sessionConfig: makeWorkerConfig(),
        sessionSlug: 'worker-session',
      }),
    ).resolves.toBe(true);

    expect(calls).toEqual(['questions', 'sbt-ready', 'responses', 'surveys', 'surveys-ready']);
    expect(host.initializeSbtCacheForGroup).not.toHaveBeenCalled();
    expect(host.startSbtEventListenerForGroup).not.toHaveBeenCalled();
  });

  it('checks aggregate readiness after React commits the final cache-ready state', async () => {
    const { host } = makeHost();
    const committedReadiness: Record<string, unknown> = {};
    const queuedCommits: Array<() => void> = [];
    host.setReadinessStateIfChanged.mockImplementation(
      (patch: Record<string, unknown>, callback?: () => void) => {
        queuedCommits.push(() => {
          Object.assign(committedReadiness, patch);
          callback?.();
        });
      },
    );
    host.checkAllCachesReady.mockImplementation(() => {
      expect(committedReadiness).toMatchObject({
        isSBTCacheReady: true,
        isSurveyCacheReady: true,
      });
    });

    await expect(
      initializeMainSiteWorkerCanonicalCaches({
        host,
        sessionConfig: makeWorkerConfig(),
        sessionSlug: 'worker-session',
      }),
    ).resolves.toBe(true);

    expect(host.checkAllCachesReady).not.toHaveBeenCalled();
    queuedCommits.forEach((commit) => commit());
    expect(host.checkAllCachesReady).toHaveBeenCalledTimes(1);
  });

  it('does not check aggregate readiness from a stale final-state callback', async () => {
    const { host } = makeHost();
    let current = true;
    let finalCallback: (() => void) | undefined;
    host.setReadinessStateIfChanged.mockImplementation(
      (patch: Record<string, unknown>, callback?: () => void) => {
        if (patch.isSurveyCacheReady) finalCallback = callback;
      },
    );

    await initializeMainSiteWorkerCanonicalCaches({
      host,
      sessionConfig: makeWorkerConfig(),
      sessionSlug: 'worker-session',
      isCurrent: () => current,
    });
    current = false;
    finalCallback?.();

    expect(host.checkAllCachesReady).not.toHaveBeenCalled();
  });

  it('hydrates Worker metadata while keeping hybrid SBT work explicitly separate', async () => {
    const { host, calls } = makeHost();
    const config = makeWorkerConfig();
    const hybridProfile = cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE);
    hybridProfile.preset = SESSION_MODE_PRESET_IDS.CUSTOM;
    hybridProfile.authorization.mechanisms = [...hybridProfile.authorization.mechanisms, 'sbt_onchain'];
    hybridProfile.evm.registryChainId = 11155420;
    hybridProfile.encryption.accessConditions = {
      match: 'any',
      conditions: [
        {
          kind: 'sbt_onchain',
          chainId: 11155420,
          contract: '0x1111111111111111111111111111111111111111',
          anyOrAll: 'any',
        },
      ],
    };
    config.sessionModeProfile = hybridProfile;

    await expect(
      initializeMainSiteWorkerCanonicalCaches({
        host,
        sessionConfig: config,
        sessionSlug: 'worker-session',
      }),
    ).resolves.toBe(true);

    expect(calls).toEqual(['questions', 'sbt', 'sbt-ready', 'sbt-listener', 'responses', 'surveys', 'surveys-ready']);
    expect(host.initializeSbtCacheForGroup).toHaveBeenCalledWith('worker-session', { mode: 'partial' });
  });

  it('does not infer an SBT scan from a Worker/Lit hybrid chain dependency', async () => {
    const { host, calls } = makeHost();
    const config = makeWorkerConfig();
    const litProfile = cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE);
    litProfile.preset = SESSION_MODE_PRESET_IDS.CUSTOM;
    litProfile.encryption = { mode: 'lit' };
    litProfile.storage.payloadAccessControl = {
      ...(litProfile.storage.payloadAccessControl || {}),
      encryption: 'lit',
    };
    litProfile.evm.registryChainId = 11155420;
    config.sessionModeProfile = litProfile;

    await expect(
      initializeMainSiteWorkerCanonicalCaches({
        host,
        sessionConfig: config,
        sessionSlug: 'worker-session',
      }),
    ).resolves.toBe(true);

    expect(calls).toEqual(['questions', 'sbt-ready', 'responses', 'surveys', 'surveys-ready']);
    expect(host.initializeSbtCacheForGroup).not.toHaveBeenCalled();
    expect(host.startSbtEventListenerForGroup).not.toHaveBeenCalled();
  });

  it('does not run cache work for invalid or non-Worker profiles', async () => {
    const { host, calls } = makeHost();

    await expect(
      initializeMainSiteWorkerCanonicalCaches({
        host,
        sessionConfig: {
          slug: 'invalid',
          sessionModeProfile: { profileVersion: 1 },
        },
        sessionSlug: 'invalid',
      }),
    ).resolves.toBe(false);

    expect(calls).toEqual([]);
  });

  it('stops a stale run before later cache families are touched', async () => {
    const { host, calls } = makeHost();
    let current = true;
    host.initializeQuestionCacheForGroup.mockImplementationOnce(async () => {
      calls.push('questions');
      current = false;
    });

    await expect(
      initializeMainSiteWorkerCanonicalCaches({
        host,
        sessionConfig: makeWorkerConfig(),
        sessionSlug: 'worker-session',
        isCurrent: () => current,
      }),
    ).resolves.toBe(true);

    expect(calls).toEqual(['questions']);
  });
});
