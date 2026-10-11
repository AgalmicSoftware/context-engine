import { cloneSessionModePreset } from '../../utilities/session/sessionModeProfile';
import type { AppShell } from './AppShell';
import { initializeMainSiteWorkerCanonicalCachesForGroup } from './mainSiteCapabilityHostRuntime';

const WORKER_CONFIG = {
  slug: 'worker-init',
  sessionId: `0x${'44'.repeat(16)}`,
  sessionIdHex: `0x${'44'.repeat(16)}`,
  corsWorkerUrl: 'https://worker-init.example/',
  storageProfile: {
    backend: 'cloudflare',
    resources: { questions: 'active', surveys: 'active', responses: 'active' },
    payloadAccessControl: { gate: 'none', encryption: 'none' },
  },
  sessionModeProfile: {
    ...cloneSessionModePreset('fast_cheap_cloudflare'),
    preset: 'custom',
    storage: { backend: 'cloudflare', payloadAccessControl: { gate: 'none', encryption: 'none' } },
    encryption: { mode: 'none' },
  },
};

const createHost = (loadResponses: () => Promise<void>) => {
  const state: Record<string, unknown> = { isResponsesCacheReady: false };
  const host = {
    state,
    getCacheSessionCfg: () => WORKER_CONFIG,
    startCacheReinitRun: () => 1,
    isCacheReinitRunActive: () => true,
    setReadinessStateIfChanged: jest.fn((patch: Record<string, unknown>, callback?: () => void) => {
      Object.assign(state, patch);
      callback?.();
    }),
    checkAllCachesReady: jest.fn(),
    initializeQuestionCacheForGroup: jest.fn(async () => {}),
    initializeSbtCacheForGroup: jest.fn(async () => {}),
    initializeSurveyCacheForGroup: jest.fn(async () => {}),
    startSbtEventListenerForGroup: jest.fn(),
    fetchQuestionResponsesChunkedForGroup: jest.fn(loadResponses),
  };
  return host;
};

describe('initializeMainSiteWorkerCanonicalCachesForGroup', () => {
  it('leaves saved answers unready with error flags when the Worker response load fails', async () => {
    const host = createHost(async () => {
      throw new Error('Response listing failed');
    });
    const logError = jest.fn();

    await initializeMainSiteWorkerCanonicalCachesForGroup(
      host as unknown as AppShell,
      'worker-init',
      { resetReadiness: true },
      logError,
    );

    expect(logError).toHaveBeenCalled();
    expect(host.state).toMatchObject({
      isQuestionCacheReady: true,
      isSurveyCacheReady: true,
      isSBTCacheReady: true,
      isResponsesCacheReady: false,
      questionCacheInitializationError: true,
      surveyCacheInitializationError: true,
    });
  });
});
