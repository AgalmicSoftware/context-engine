import {
  isSbtSelectorForcedDebugEnabled,
  readBoolishDebugFlag,
  resolveSbtSelectorUpdateEffects,
  resolveSbtSelectorUpdateSignals,
  SBT_SELECTOR_DEBUG_QUERY_KEY,
  SBT_SELECTOR_DEBUG_STORAGE_KEY,
  shouldAutoSearchOtherSbtSelectorSessions,
} from './sbtSelectorRuntimeHelpers';

describe('sbtSelectorRuntimeHelpers', () => {
  it('reads boolish debug flags', () => {
    expect(readBoolishDebugFlag(true)).toBe(true);
    expect(readBoolishDebugFlag(false)).toBe(false);
    expect(readBoolishDebugFlag(null)).toBe(false);
    expect(readBoolishDebugFlag('1')).toBe(true);
    expect(readBoolishDebugFlag(' TRUE ')).toBe(true);
    expect(readBoolishDebugFlag('yes')).toBe(true);
    expect(readBoolishDebugFlag('on')).toBe(true);
    expect(readBoolishDebugFlag('off')).toBe(false);
  });

  it('reads selector debug and auto-search runtime flags defensively', () => {
    const inactiveStorage = { getItem: jest.fn(() => null) };
    const debugStorage = {
      getItem: jest.fn((key: string) => (key === SBT_SELECTOR_DEBUG_STORAGE_KEY ? 'yes' : null)),
    };

    expect(
      isSbtSelectorForcedDebugEnabled({
        runtimeGlobal: { CE_SBT_SELECTOR_DEBUG: true },
        windowRef: null,
        localStorageRef: inactiveStorage,
        sessionStorageRef: inactiveStorage,
      }),
    ).toBe(true);
    expect(
      isSbtSelectorForcedDebugEnabled({
        runtimeGlobal: {},
        windowRef: { location: { search: `?${SBT_SELECTOR_DEBUG_QUERY_KEY}=on` } },
        localStorageRef: inactiveStorage,
        sessionStorageRef: inactiveStorage,
      }),
    ).toBe(true);
    expect(
      isSbtSelectorForcedDebugEnabled({
        runtimeGlobal: {},
        windowRef: null,
        localStorageRef: debugStorage,
        sessionStorageRef: inactiveStorage,
      }),
    ).toBe(true);
    expect(
      isSbtSelectorForcedDebugEnabled({
        runtimeGlobal: {},
        windowRef: null,
        localStorageRef: inactiveStorage,
        sessionStorageRef: debugStorage,
      }),
    ).toBe(true);
    expect(
      isSbtSelectorForcedDebugEnabled({
        runtimeGlobal: {},
        windowRef: null,
        localStorageRef: inactiveStorage,
        sessionStorageRef: inactiveStorage,
      }),
    ).toBe(false);
    expect(
      shouldAutoSearchOtherSbtSelectorSessions(
        {
          CE_SBT_SELECTOR_AUTO_SEARCH_OTHER_SESSIONS: 'on',
        },
        false,
      ),
    ).toBe(true);
    expect(
      shouldAutoSearchOtherSbtSelectorSessions(
        {
          CE_SBT_SELECTOR_AUTO_SEARCH_OTHER_SESSIONS: 'off',
        },
        true,
      ),
    ).toBe(false);
    expect(shouldAutoSearchOtherSbtSelectorSessions({}, true)).toBe(true);
  });

  it('resolves update signals and effects from scoped selector inputs', () => {
    const sharedLightUniverse = () => null;
    const selectedSBTs = [{ address: '0x00000000000000000000000000000000000000aa' }];

    expect(
      resolveSbtSelectorUpdateSignals({
        prevNetwork: { chainId: '10' },
        nextNetwork: { chainId: 11155420 },
        prevChainId: '10',
        nextChainId: 11155420,
        prevSessionConfig: { sessionSlug: 'alpha', networkChainId: 10 },
        nextSessionConfig: { sessionSlug: 'alpha', networkChainId: 11155420 },
        prevSbtCacheRevision: 1,
        nextSbtCacheRevision: 2,
        prevPropSessionSlug: 'alpha',
        nextPropSessionSlug: 'beta',
        prevSourceSessionSlug: 'alpha',
        nextSourceSessionSlug: 'beta',
        prevSelectedSBTs: selectedSBTs,
        nextSelectedSBTs: [{ address: selectedSBTs[0].address }],
        prevDiscoveryOverrideSignature: 'alpha',
        nextDiscoveryOverrideSignature: 'beta',
        prevEnsureLightSbtUniverse: null,
        nextEnsureLightSbtUniverse: sharedLightUniverse,
      }),
    ).toEqual({
      cacheChanged: true,
      chainIdChanged: true,
      discoveryOverrideChanged: true,
      networkChanged: true,
      selectedSbtPropsChanged: true,
      sessionConfigChanged: true,
      sharedLightUniverseFnChanged: true,
      slugPropChanged: true,
      sourceGroupChanged: true,
      universeScopeChanged: true,
    });
    expect(
      resolveSbtSelectorUpdateSignals({
        prevNetwork: { chainId: '10' },
        nextNetwork: { id: 10 },
        prevChainId: '10',
        nextChainId: 10,
        prevSessionConfig: { sessionSlug: 'alpha', networkChainId: 10 },
        nextSessionConfig: { sessionSlug: 'alpha', networkChainId: 10 },
        prevSbtCacheRevision: 2,
        nextSbtCacheRevision: 2,
        prevPropSessionSlug: 'alpha',
        nextPropSessionSlug: 'alpha',
        prevSourceSessionSlug: 'alpha',
        nextSourceSessionSlug: 'alpha',
        prevSelectedSBTs: selectedSBTs,
        nextSelectedSBTs: selectedSBTs,
        prevDiscoveryOverrideSignature: 'alpha',
        nextDiscoveryOverrideSignature: 'alpha',
        prevEnsureLightSbtUniverse: sharedLightUniverse,
        nextEnsureLightSbtUniverse: sharedLightUniverse,
      }).universeScopeChanged,
    ).toBe(false);

    expect(
      resolveSbtSelectorUpdateEffects({
        cacheChanged: true,
      }),
    ).toEqual({
      shouldEnsureUniverse: false,
      shouldHydrateSelectedNames: true,
      shouldKickoffSharedLightUniverse: false,
      shouldLoadOptions: true,
      shouldWarmRegistryCache: false,
    });
    expect(
      resolveSbtSelectorUpdateEffects({
        hasSharedLightUniverse: true,
        selectedSbtPropsChanged: true,
        sessionConfigChanged: true,
        sharedLightUniverseFnChanged: true,
        shouldWarmRegistryCache: true,
      }),
    ).toEqual({
      shouldEnsureUniverse: true,
      shouldHydrateSelectedNames: true,
      shouldKickoffSharedLightUniverse: true,
      shouldLoadOptions: true,
      shouldWarmRegistryCache: true,
    });
    expect(
      resolveSbtSelectorUpdateEffects({
        hasSharedLightUniverse: false,
        sharedLightUniverseFnChanged: true,
      }).shouldKickoffSharedLightUniverse,
    ).toBe(false);
  });
});
