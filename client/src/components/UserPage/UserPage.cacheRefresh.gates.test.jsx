import {
  UserPage,
  checkSponsoredAccess,
  contractScriptsModule,
  makeInstance,
  createDeferred,
  REGISTRY_CACHE_KEY,
  setupUserPageCacheRefreshTestLifecycle,
} from './UserPage.cacheRefresh.testUtils';
import { buildUserPageGateAccessCacheKey, buildUserPageGatePendingKey } from './userPageHelpers';

const buildGateAccessCacheKey = (instance, { slug = '', resourceKey = '' } = {}) =>
  buildUserPageGateAccessCacheKey({
    account: instance.props.account,
    networkID: instance.props.network?.id,
    resourceKey,
    sbtCacheRevision: instance.props.sbtCacheRevision,
    slug,
  });

describe('UserPage cache refresh gate access', () => {
  setupUserPageCacheRefreshTestLifecycle();

  it('revalidates stale terminal gate access statuses after TTL', async () => {
    const account = '0x00000000000000000000000000000000000000bb';
    const instance = makeInstance({ account });
    const queueSpy = jest.spyOn(instance, 'queueCacheRefresh').mockImplementation(() => {});
    const cacheKey = buildGateAccessCacheKey(instance, {
      slug: 'edge',
      resourceKey: 'questionResponses',
    });
    instance._responseGateAccessStatusByKey.set(cacheKey, {
      status: 'granted',
      ts: Date.now() - 61 * 1000,
    });
    checkSponsoredAccess.mockResolvedValue({
      status: 'denied',
      gate: null,
      resourceKey: 'questionResponses',
    });

    instance._queueResponseGateAccessChecks(
      new Set([buildUserPageGatePendingKey({ slug: 'edge', resourceKey: 'questionResponses' })]),
    );
    await Promise.resolve();
    await Promise.resolve();

    expect(checkSponsoredAccess).toHaveBeenCalledTimes(1);
    expect(instance._responseGateAccessStatusByKey.get(cacheKey)?.status).toBe('denied');
    expect(queueSpy).toHaveBeenCalledWith({ markLoading: false });
  });

  it('retries gate access when sponsored access resolves with an error status', async () => {
    const account = '0x00000000000000000000000000000000000000bb';
    const instance = makeInstance({ account });
    const queueSpy = jest.spyOn(instance, 'queueCacheRefresh').mockImplementation(() => {});
    const retrySpy = jest.spyOn(instance, 'scheduleResponseGateRetry').mockImplementation(() => {});
    const cacheKey = buildGateAccessCacheKey(instance, {
      slug: 'edge',
      resourceKey: 'questionResponses',
    });
    checkSponsoredAccess.mockResolvedValue({
      status: 'error',
      gate: null,
      resourceKey: 'questionResponses',
    });

    instance._queueResponseGateAccessChecks(
      new Set([buildUserPageGatePendingKey({ slug: 'edge', resourceKey: 'questionResponses' })]),
    );
    await Promise.resolve();
    await Promise.resolve();

    expect(checkSponsoredAccess).toHaveBeenCalledTimes(1);
    expect(instance._responseGateAccessStatusByKey.get(cacheKey)?.status).toBe('error');
    expect(retrySpy).toHaveBeenCalledWith(30000);
    expect(queueSpy).toHaveBeenCalledWith({ markLoading: false });
  });

  it('settles rejected gate access checks as unknown without applying state directly', async () => {
    const account = '0x00000000000000000000000000000000000000bb';
    const instance = makeInstance({ account });
    const queueSpy = jest.spyOn(instance, 'queueCacheRefresh').mockImplementation(() => {});
    const retrySpy = jest.spyOn(instance, 'scheduleResponseGateRetry').mockImplementation(() => {});
    const cacheKey = buildGateAccessCacheKey(instance, {
      slug: 'edge',
      resourceKey: 'questionResponses',
    });
    checkSponsoredAccess.mockRejectedValue(new Error('gate unavailable'));

    instance._queueResponseGateAccessChecks(
      new Set([buildUserPageGatePendingKey({ slug: 'edge', resourceKey: 'questionResponses' })]),
    );
    await Promise.resolve();
    await Promise.resolve();

    expect(checkSponsoredAccess).toHaveBeenCalledTimes(1);
    expect(instance._responseGateAccessStatusByKey.get(cacheKey)?.status).toBe('unknown');
    expect(retrySpy).toHaveBeenCalledWith(30000);
    expect(queueSpy).toHaveBeenCalledWith({ markLoading: false });
    expect(instance.setState).not.toHaveBeenCalled();
  });

  it('keeps response-gate access checks strict when only a demo-session config exists', async () => {
    const priorRegistryCache = localStorage.getItem(REGISTRY_CACHE_KEY);
    localStorage.removeItem(REGISTRY_CACHE_KEY);

    const account = '0x00000000000000000000000000000000000000bb';
    const instance = makeInstance({ account });
    const queueSpy = jest.spyOn(instance, 'queueCacheRefresh').mockImplementation(() => {});
    const demoSpy = jest.spyOn(contractScriptsModule, 'getDemoSessionConfigBySlug').mockReturnValue({
      slug: 'rxc',
      sessionName: 'Weyl v. Yarvin Debate',
      sponsoredKeys: {
        questionResponses: { encrypted: true },
      },
    });
    const cacheKey = buildGateAccessCacheKey(instance, {
      slug: 'rxc',
      resourceKey: 'questionResponses',
    });
    checkSponsoredAccess.mockResolvedValue({
      status: 'denied',
      gate: null,
      resourceKey: 'questionResponses',
    });

    try {
      instance._queueResponseGateAccessChecks(
        new Set([buildUserPageGatePendingKey({ slug: 'rxc', resourceKey: 'questionResponses' })]),
      );
      await Promise.resolve();
      await Promise.resolve();

      expect(checkSponsoredAccess).toHaveBeenCalledTimes(1);
      expect(checkSponsoredAccess).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionSlug: 'rxc',
          account,
          resourceKey: 'questionResponses',
          sessionConfig: {},
        }),
      );
      expect(instance._responseGateAccessStatusByKey.get(cacheKey)?.status).toBe('denied');
      expect(queueSpy).toHaveBeenCalledWith({ markLoading: false });
      expect(demoSpy).not.toHaveBeenCalled();
    } finally {
      demoSpy.mockRestore();
      if (priorRegistryCache == null) {
        localStorage.removeItem(REGISTRY_CACHE_KEY);
      } else {
        localStorage.setItem(REGISTRY_CACHE_KEY, priorRegistryCache);
      }
    }
  });

  it('ignores stale gate access promises after a reset', async () => {
    const account = '0x00000000000000000000000000000000000000bb';
    const instance = makeInstance({ account });
    const deferred = createDeferred();
    checkSponsoredAccess.mockImplementation(() => deferred.promise);
    const queueSpy = jest.spyOn(instance, 'queueCacheRefresh').mockImplementation(() => {});
    const retrySpy = jest.spyOn(instance, 'scheduleResponseGateRetry').mockImplementation(() => {});
    const pendingKey = buildUserPageGatePendingKey({
      slug: 'edge',
      resourceKey: 'questionResponses',
    });

    instance._queueResponseGateAccessChecks(new Set([pendingKey]));
    instance._resetResponseGateAccess();
    deferred.resolve({
      status: 'unknown',
      gate: null,
      resourceKey: 'questionResponses',
    });
    await Promise.resolve();
    await Promise.resolve();

    expect(instance._responseGateAccessStatusByKey.size).toBe(0);
    expect(queueSpy).not.toHaveBeenCalled();
    expect(retrySpy).not.toHaveBeenCalled();
  });

  it('schedules a delayed refresh when unknown gate access is still within retry TTL', () => {
    jest.useFakeTimers();
    const account = '0x00000000000000000000000000000000000000bb';
    const instance = makeInstance({ account });
    const queueSpy = jest.spyOn(instance, 'queueCacheRefresh').mockImplementation(() => {});
    const pendingKey = buildUserPageGatePendingKey({
      slug: 'edge',
      resourceKey: 'questionResponses',
    });
    const cacheKey = buildGateAccessCacheKey(instance, {
      slug: 'edge',
      resourceKey: 'questionResponses',
    });

    instance._responseGateAccessStatusByKey.set(cacheKey, {
      status: 'unknown',
      ts: Date.now() - 5000,
    });

    instance._queueResponseGateAccessChecks(new Set([pendingKey]));

    expect(checkSponsoredAccess).not.toHaveBeenCalled();
    expect(queueSpy).not.toHaveBeenCalled();

    jest.advanceTimersByTime(25000);
    expect(queueSpy).toHaveBeenCalledTimes(1);
    expect(queueSpy).toHaveBeenCalledWith({ markLoading: false, bypassSignature: true });
  });

  it('keeps the nearest response-gate retry timer when later retries are requested', () => {
    jest.useFakeTimers();
    const instance = makeInstance();
    const queueSpy = jest.spyOn(instance, 'queueCacheRefresh').mockImplementation(() => {});

    instance.scheduleResponseGateRetry(30_000);
    instance.scheduleResponseGateRetry(60_000);

    jest.advanceTimersByTime(29_999);
    expect(queueSpy).not.toHaveBeenCalled();

    jest.advanceTimersByTime(1);
    expect(queueSpy).toHaveBeenCalledTimes(1);
    expect(queueSpy).toHaveBeenCalledWith({ markLoading: false, bypassSignature: true });

    jest.advanceTimersByTime(30_000);
    expect(queueSpy).toHaveBeenCalledTimes(1);
  });

  it('schedules a delayed refresh when error gate access is still within retry TTL', () => {
    jest.useFakeTimers();
    const account = '0x00000000000000000000000000000000000000bb';
    const instance = makeInstance({ account });
    const queueSpy = jest.spyOn(instance, 'queueCacheRefresh').mockImplementation(() => {});
    const pendingKey = buildUserPageGatePendingKey({
      slug: 'edge',
      resourceKey: 'questionResponses',
    });
    const cacheKey = buildGateAccessCacheKey(instance, {
      slug: 'edge',
      resourceKey: 'questionResponses',
    });

    instance._responseGateAccessStatusByKey.set(cacheKey, {
      status: 'error',
      ts: Date.now() - 5000,
    });

    instance._queueResponseGateAccessChecks(new Set([pendingKey]));

    expect(checkSponsoredAccess).not.toHaveBeenCalled();
    expect(queueSpy).not.toHaveBeenCalled();

    jest.advanceTimersByTime(25000);
    expect(queueSpy).toHaveBeenCalledTimes(1);
    expect(queueSpy).toHaveBeenCalledWith({ markLoading: false, bypassSignature: true });
  });

  it('backs off cached unresolved gate access instead of re-queueing an immediate refresh', () => {
    jest.useFakeTimers();
    const account = '0x00000000000000000000000000000000000000bb';
    const instance = makeInstance({ account });
    const queueSpy = jest.spyOn(instance, 'queueCacheRefresh').mockImplementation(() => {});
    const pendingKey = buildUserPageGatePendingKey({
      slug: 'edge',
      resourceKey: 'questionResponses',
    });
    const cacheKey = buildGateAccessCacheKey(instance, {
      slug: 'edge',
      resourceKey: 'questionResponses',
    });

    instance._responseGateAccessStatusByKey.set(cacheKey, {
      status: 'unresolved',
      ts: Date.now() - 5000,
    });

    instance._queueResponseGateAccessChecks(new Set([pendingKey]));

    expect(checkSponsoredAccess).not.toHaveBeenCalled();
    expect(queueSpy).not.toHaveBeenCalled();

    jest.advanceTimersByTime(25000);
    expect(queueSpy).toHaveBeenCalledTimes(1);
    expect(queueSpy).toHaveBeenCalledWith({ markLoading: false, bypassSignature: true });
  });

  it('settles question-response loading after deep scan uncertainty when question sources exist', () => {
    const viewAddress = '0x00000000000000000000000000000000000000aa';
    const networkID = '84532';
    const instance = makeInstance({ viewAddress });
    instance.state.hasUncertainUserData = true;
    const retrySpy = jest.spyOn(instance, 'scheduleResponseGateRetry').mockImplementation(() => {});

    const dataByNamespace = {
      surveysCache: [],
      sbtCache: [],
      userCache: [],
      questionsCache: [
        {
          slug: 'edge',
          data: {
            [networkID]: {
              questions: {
                q1: {
                  id: 'q1',
                  creator: viewAddress,
                  prompt: 'Question 1',
                  type: 'freeform',
                },
              },
              questionResponses: {},
            },
          },
        },
      ],
    };

    instance._dgHasAny = jest.fn(() => true);
    instance._dgReadAll = jest.fn((name) => dataByNamespace[name] || []);

    instance._refreshAllDataFromCache({ force: true, markLoading: true });

    expect(instance.state.questionCreationInfo).toHaveLength(1);
    expect(instance.state.questionResponseInfo).toHaveLength(0);
    expect(instance.state.loadingQuestions).toBe(false);
    expect(retrySpy).toHaveBeenCalledWith(30000);
  });
});
