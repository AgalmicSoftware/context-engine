import {
  buildSessionPublishEffectQueue,
  createInitialSessionPublishState,
  getNextSessionPublishEffect,
  sessionPublishReducer,
  type SessionPublishAction,
  type SessionPublishPlan,
} from './sessionPublishReducer';

const publishPlan = (overrides: SessionPublishPlan = {}): SessionPublishPlan => ({
  persistWorkerConfig: false,
  uploadMetadata: true,
  registerSession: true,
  refreshRegistryCache: true,
  ...overrides,
});

const reduceActions = (actions: SessionPublishAction[]) =>
  actions.reduce(sessionPublishReducer, createInitialSessionPublishState({ status: 'editing' }));

describe('sessionPublishReducer', () => {
  it('keeps the publish reducer queue free of navigation effects', () => {
    expect(
      buildSessionPublishEffectQueue(
        publishPlan({
          autoDeployWorker: true,
          deployPendingSbts: true,
        }),
      ),
    ).toEqual([
      'checkRequirements',
      'deployWorker',
      'deployPendingSbts',
      'uploadMetadata',
      'registerSession',
      'refreshRegistryCache',
    ]);
  });

  it('models the normal upload, register, refresh, and published flow', () => {
    const state = reduceActions([
      { type: 'beginPublish', plan: publishPlan() },
      { type: 'effectSucceeded', effect: 'checkRequirements' },
      { type: 'effectSucceeded', effect: 'uploadMetadata', result: { metadataUri: 'ar://metadata' } },
      { type: 'effectSucceeded', effect: 'registerSession' },
      { type: 'effectSucceeded', effect: 'refreshRegistryCache' },
    ]);

    expect(state).toEqual(
      expect.objectContaining({
        status: 'published',
        currentEffect: null,
        metadataUri: 'ar://metadata',
        attempt: 1,
        cancelled: false,
      }),
    );
    expect(state.completed).toEqual(
      expect.objectContaining({
        checkRequirements: true,
        uploadMetadata: true,
        registerSession: true,
        refreshRegistryCache: true,
      }),
    );
  });

  it('publishes worker-canonical sessions through verified config persistence only', () => {
    const plan = publishPlan({
      persistWorkerConfig: true,
      uploadMetadata: false,
      registerSession: false,
      refreshRegistryCache: false,
    });

    expect(buildSessionPublishEffectQueue(plan)).toEqual(['checkRequirements', 'persistWorkerConfig']);

    const first = sessionPublishReducer(createInitialSessionPublishState({ status: 'editing' }), {
      type: 'beginPublish',
      plan,
    });
    const afterRequirements = sessionPublishReducer(first, {
      type: 'effectSucceeded',
      effect: 'checkRequirements',
    });
    const published = sessionPublishReducer(afterRequirements, {
      type: 'effectSucceeded',
      effect: 'persistWorkerConfig',
      result: { workerUrl: 'https://worker.example.test' },
    });

    expect(afterRequirements).toEqual(
      expect.objectContaining({
        status: 'persistingWorkerConfig',
        currentEffect: 'persistWorkerConfig',
      }),
    );
    expect(published).toEqual(
      expect.objectContaining({
        status: 'published',
        currentEffect: null,
        workerUrl: 'https://worker.example.test',
      }),
    );
    expect(published.completed).toEqual({
      checkRequirements: true,
      persistWorkerConfig: true,
    });
  });

  it('creates queued Worker Groups only after config verification and tracks retryable progress', () => {
    const plan = publishPlan({
      persistWorkerConfig: true,
      createWorkerGroups: true,
      uploadMetadata: false,
      registerSession: false,
      refreshRegistryCache: false,
    });
    expect(buildSessionPublishEffectQueue(plan)).toEqual([
      'checkRequirements',
      'persistWorkerConfig',
      'createWorkerGroups',
    ]);

    const afterRequirements = reduceActions([
      { type: 'beginPublish', plan },
      { type: 'effectSucceeded', effect: 'checkRequirements' },
    ]);
    const afterConfig = sessionPublishReducer(afterRequirements, {
      type: 'effectSucceeded',
      effect: 'persistWorkerConfig',
      result: { workerUrl: 'https://worker.example.test' },
    });
    expect(afterConfig).toEqual(
      expect.objectContaining({ status: 'creatingWorkerGroups', currentEffect: 'createWorkerGroups' }),
    );

    const published = sessionPublishReducer(afterConfig, {
      type: 'effectSucceeded',
      effect: 'createWorkerGroups',
      result: { createdWorkerGroupCount: 2 },
    });
    expect(published).toEqual(
      expect.objectContaining({ status: 'published', createdWorkerGroupCount: 2 }),
    );
  });

  it('preserves decentralized upload, registration, and registry refresh ordering', () => {
    expect(buildSessionPublishEffectQueue(publishPlan())).toEqual([
      'checkRequirements',
      'uploadMetadata',
      'registerSession',
      'refreshRegistryCache',
    ]);
  });

  it('orders sponsored auto-deploy before metadata upload and registration', () => {
    const first = sessionPublishReducer(createInitialSessionPublishState({ status: 'editing' }), {
      type: 'beginPublish',
      plan: publishPlan({ autoDeployWorker: true }),
    });
    const afterRequirements = sessionPublishReducer(first, {
      type: 'effectSucceeded',
      effect: 'checkRequirements',
    });
    const afterWorker = sessionPublishReducer(afterRequirements, {
      type: 'effectSucceeded',
      effect: 'deployWorker',
      result: { workerUrl: 'https://worker.example.test' },
    });

    expect(first).toEqual(
      expect.objectContaining({
        status: 'checkingRequirements',
        currentEffect: 'checkRequirements',
      }),
    );
    expect(afterRequirements).toEqual(
      expect.objectContaining({
        status: 'deployingWorker',
        currentEffect: 'deployWorker',
      }),
    );
    expect(afterWorker).toEqual(
      expect.objectContaining({
        status: 'uploadingMetadata',
        currentEffect: 'uploadMetadata',
        workerUrl: 'https://worker.example.test',
      }),
    );
  });

  it('captures hosted-bundle deploy fallback as a recoverable retry plan', () => {
    const failed = reduceActions([
      {
        type: 'beginPublish',
        plan: publishPlan({ autoDeployWorker: true }),
      },
      { type: 'effectSucceeded', effect: 'checkRequirements' },
      {
        type: 'effectFailed',
        effect: 'deployWorker',
        message: 'failed to fetch bundle',
        recoverable: true,
        retryPlan: publishPlan({ autoDeployWorker: false }),
      },
    ]);

    expect(failed).toEqual(
      expect.objectContaining({
        status: 'failedRecoverable',
        currentEffect: null,
        error: expect.objectContaining({
          effect: 'deployWorker',
          message: 'failed to fetch bundle',
          recoverable: true,
        }),
      }),
    );

    const retry = sessionPublishReducer(failed, { type: 'retry' });
    const afterRequirements = sessionPublishReducer(retry, {
      type: 'effectSucceeded',
      effect: 'checkRequirements',
    });
    expect(afterRequirements).toEqual(
      expect.objectContaining({
        status: 'uploadingMetadata',
        currentEffect: 'uploadMetadata',
      }),
    );
  });

  it('stops before registration when pending SBT deployment fails', () => {
    const failed = reduceActions([
      {
        type: 'beginPublish',
        plan: publishPlan({ deployPendingSbts: true }),
      },
      { type: 'effectSucceeded', effect: 'checkRequirements' },
      {
        type: 'effectFailed',
        effect: 'deployPendingSbts',
        message: 'pending SBT deploy failed',
        recoverable: true,
      },
    ]);

    expect(failed.status).toBe('failedRecoverable');
    expect(failed.currentEffect).toBeNull();
    expect(failed.completed.registerSession).toBeUndefined();
    expect(getNextSessionPublishEffect(failed.plan, failed.completed)).toBe('deployPendingSbts');
  });

  it('keeps uploaded metadata when duplicate registration fails', () => {
    const failed = reduceActions([
      { type: 'beginPublish', plan: publishPlan() },
      { type: 'effectSucceeded', effect: 'checkRequirements' },
      { type: 'effectSucceeded', effect: 'uploadMetadata', result: { metadataUri: 'ar://metadata' } },
      {
        type: 'effectFailed',
        effect: 'registerSession',
        message: 'Session slug already exists on-chain: duplicate',
        recoverable: true,
      },
    ]);

    expect(failed).toEqual(
      expect.objectContaining({
        status: 'failedRecoverable',
        metadataUri: 'ar://metadata',
        error: expect.objectContaining({
          effect: 'registerSession',
        }),
      }),
    );
    expect(failed.completed.uploadMetadata).toBe(true);
    expect(failed.completed.registerSession).toBeUndefined();
  });

  it('retries recoverable registration failures without rerunning completed upload', () => {
    const failed = reduceActions([
      { type: 'beginPublish', plan: publishPlan() },
      { type: 'effectSucceeded', effect: 'checkRequirements' },
      { type: 'effectSucceeded', effect: 'uploadMetadata', result: { metadataUri: 'ar://metadata' } },
      {
        type: 'effectFailed',
        effect: 'registerSession',
        message: 'Session slug already exists on-chain: duplicate',
        recoverable: true,
      },
    ]);
    const retry = sessionPublishReducer(failed, { type: 'retry' });
    const afterRequirements = sessionPublishReducer(retry, {
      type: 'effectSucceeded',
      effect: 'checkRequirements',
    });

    expect(retry).toEqual(
      expect.objectContaining({
        status: 'checkingRequirements',
        currentEffect: 'checkRequirements',
        attempt: 2,
      }),
    );
    expect(afterRequirements).toEqual(
      expect.objectContaining({
        status: 'registeringOnChain',
        currentEffect: 'registerSession',
        metadataUri: 'ar://metadata',
      }),
    );
  });

  it('cancels the active effect queue and ignores late completions', () => {
    const active = reduceActions([
      { type: 'beginPublish', plan: publishPlan({ autoDeployWorker: true }) },
      { type: 'effectSucceeded', effect: 'checkRequirements' },
    ]);
    const cancelled = sessionPublishReducer(active, { type: 'cancel' });
    const lateCompletion = sessionPublishReducer(cancelled, {
      type: 'effectSucceeded',
      effect: 'deployWorker',
      result: { workerUrl: 'https://late-worker.example.test' },
    });

    expect(cancelled).toEqual(
      expect.objectContaining({
        status: 'editing',
        currentEffect: null,
        cancelled: true,
      }),
    );
    expect(lateCompletion).toBe(cancelled);
    expect(getNextSessionPublishEffect(cancelled.plan, cancelled.completed)).toBe('deployWorker');
  });
});
