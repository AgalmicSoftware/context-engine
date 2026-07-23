import {
  SbtOptionsLoadCoordinator,
  queueChangedSbtOptionsRequest,
  settleSbtOptionsLoad,
} from './sbtSelectorOptionsLoadRuntime';

const createDeferred = () => {
  let resolve!: (value?: unknown) => void;
  const promise = new Promise((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
};

describe('sbtSelectorOptionsLoadRuntime', () => {
  it('invalidates and clears request A before queueing request B', async () => {
    const deferredA = createDeferred();
    const coordinator = new SbtOptionsLoadCoordinator();
    const guardA = coordinator.begin('request-a', 'session-a');
    const host = {
      _inflightSbtOptionsRequestSig: 'request-a',
      _isMounted: true,
      _lastSbtOptionsRequestSig: '',
      _loadSbtOptionsInflight: deferredA.promise,
      _pendingSbtOptionsForceReload: false,
      _pendingSbtOptionsReload: false,
      _sbtOptionsLoadCoordinator: coordinator,
      applySbtOptions: jest.fn(),
      getDisplayLookupSessionConfig: jest.fn(),
      loadSBTOptions: jest.fn(),
      props: {},
      setState: jest.fn(),
      shouldUsePropsSessionConfigForSlug: jest.fn(() => false),
      state: { loadingOptions: true },
    };

    expect(
      queueChangedSbtOptionsRequest(host, {
        forceReload: false,
        requestSig: 'request-b',
        scopeMode: 'single',
        slug: 'session-b',
        targetSlugs: ['session-b'],
      }),
    ).toBe(deferredA.promise);
    expect(coordinator.isCurrent(guardA, () => true)).toBe(false);
    expect(host.applySbtOptions).toHaveBeenCalledWith(
      expect.objectContaining({
        sbtList: {},
        fallbackSlug: 'session-b',
        loadingOptions: true,
        targetSlugs: ['session-b'],
      }),
    );

    const settlement = settleSbtOptionsLoad(host, {
      buildLoadingPatch: () => ({ loadingOptions: false }),
      isCurrent: () => coordinator.isCurrent(guardA, () => true),
      onError: jest.fn(),
      requestSig: 'request-a',
      run: deferredA.promise,
    });
    deferredA.resolve();
    await settlement;

    expect(host._lastSbtOptionsRequestSig).toBe('');
    expect(host.loadSBTOptions).toHaveBeenCalledWith({ force: false });
  });
});
