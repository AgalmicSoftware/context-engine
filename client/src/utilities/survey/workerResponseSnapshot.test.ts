import { cloneSessionModePreset, SESSION_MODE_PRESET_IDS } from '../session/sessionModeProfile';
import { type WorkerCanonicalResponseRow } from './workerResponseHydration';
import { hydrateWorkerCanonicalResponses, resolveWorkerResponseHydrationRun } from './workerResponseHydrationRuntime';

const sessionConfig = {
  slug: 'snapshot',
  sessionId: `0x${'4'.repeat(32)}`,
  corsWorkerUrl: 'https://snapshot-worker.example.test',
  sessionModeProfile: cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE),
};

it('publishes a settled partial snapshot only after its response blobs have finished loading', async () => {
  let cache: unknown = {};
  const status = () =>
    (cache as { worker: { workerResponseHydrationStatus?: string } }).worker.workerResponseHydrationStatus;
  const markReady = jest.fn();
  const run = resolveWorkerResponseHydrationRun({ sessionConfig, sessionSlug: sessionConfig.slug })!;
  for (const partial of [true, false]) {
    let finish: (rows: WorkerCanonicalResponseRow[]) => void = () => {};
    let didStart: () => void = () => {};
    const started = new Promise<void>((resolve) => {
      didStart = resolve;
    });
    const hydration = hydrateWorkerCanonicalResponses({
      sessionSlug: sessionConfig.slug,
      sessionConfig,
      run,
      getAccount: () => '',
      getProviderLike: () => null,
      getCurrentSessionConfig: () => sessionConfig,
      shouldAbort: () => false,
      markLoading: jest.fn(),
      markReady,
      loadWorkerResponses: async ({ onPartial }) => {
        if (partial) onPartial?.();
        return new Promise((resolve) => {
          finish = resolve;
          didStart();
        });
      },
      updateQuestionsCacheAtomic: async (update) => {
        cache = update(cache);
        return true;
      },
      updateUserCacheAtomic: async () => true,
      createPersistenceError: (message) => new Error(message),
    });
    await started;
    expect(status()).toBe('loading');
    finish([]);
    await hydration;
    expect(status()).toBe(partial ? 'partial' : 'complete');
    expect(markReady).toHaveBeenLastCalledWith(partial);
  }
});
