import {
  buildFeaturedEntrySignature,
  buildSessionConfigSig,
  buildSessionSlugSignature,
  buildSharedLightUniverseKickoffSignature,
  buildSbtLookupKey,
  buildSbtOptionsRequestSignature,
  buildSbtSelectorDiscoverySessionRef,
  buildSbtSelectorLogContext,
  buildSbtSelectorMetadataLookupConfig,
  buildTargetSlugChainSignature,
  getNormalizedNetworkChainValue,
  isUnresolvedSessionConfig,
  normalizeAddressListForSig,
  normalizeChainValue,
  normalizeSessionSlugListForSig,
  resolveSbtSelectorSessionLabel,
  resolveSbtSelectorSessionNetworkId,
  shouldDiscoverSbtForSessionConfig,
} from './sbtSelectorSessionRuntimeHelpers';
import { cloneSessionModePreset, SESSION_MODE_PRESET_IDS } from '../../utilities/session/sessionModeProfile';

describe('sbtSelectorSessionRuntimeHelpers', () => {
  it('normalizes signature lists, chain values, and lookup keys', () => {
    expect(normalizeAddressListForSig([' 0xB ', '0xa', '0xA', ''])).toEqual(['0xa', '0xb']);
    expect(normalizeSessionSlugListForSig([' Edge ', 'Edge', ''])).toEqual(['Edge', '']);
    expect(buildSessionSlugSignature(['a', 'b'])).toBe('a,b');
    expect(buildSharedLightUniverseKickoffSignature(['Beta', 'Alpha', 'Alpha', 'General'])).toBe('3:,Alpha,Beta');
    expect(
      buildSbtSelectorLogContext({
        effectiveSessionSlug: ' Edge Session ',
        extra: { scopeMode: 'targeted' },
        id: ' selector-a ',
        label: 'Selector A',
      }),
    ).toEqual({
      selectorId: 'selector-a',
      effectiveSessionSlug: 'Edge Session',
      scopeMode: 'targeted',
    });
    expect(
      buildSbtSelectorLogContext({
        effectiveSessionSlug: '',
        label: '  ',
      })?.selectorId,
    ).toBe('unnamed-selector');
    expect(
      buildTargetSlugChainSignature(['Alpha', 'General', 'Alpha'], (slug) => (slug ? `${slug.length}` : '11155420')),
    ).toBe('Alpha:5|:11155420');
    expect(normalizeChainValue('84532')).toBe(84532);
    expect(normalizeChainValue(0)).toBeNull();
    expect(buildSbtLookupKey({ address: ' 0xABC ', chainId: '84532' })).toBe('84532:0xabc');
    expect(buildSbtLookupKey({ address: '0xABC' })).toBe('0xabc');
    expect(buildSbtLookupKey({ address: '' })).toBe('');
    expect(getNormalizedNetworkChainValue({ chainId: '10' })).toBe(10);
    expect(getNormalizedNetworkChainValue(null)).toBeNull();
  });

  it('resolves selector chains only from validated SBT-capable sessions', () => {
    const pureWorker = cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE);
    const workerSbt = cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE);
    workerSbt.preset = SESSION_MODE_PRESET_IDS.CUSTOM;
    workerSbt.evm.registryChainId = 11155420;
    workerSbt.encryption.accessConditions = {
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
    const registry = cloneSessionModePreset(SESSION_MODE_PRESET_IDS.TRUSTLESS_PUBLIC_DECENTRALIZED);
    const baseArgs = {
      defaultFallbackChainId: 11155420,
      directChainId: 84532,
      getNormalizedNetworkChainValue: () => 10,
      getSessionChainId: () => 420,
      network: { id: 5 },
      slug: 'Alpha',
    };

    expect(
      resolveSbtSelectorSessionNetworkId({
        ...baseArgs,
        propsSessionConfig: { networkChainId: '999' },
        shouldUsePropsSessionConfig: true,
      }),
    ).toBe(999);
    expect(
      resolveSbtSelectorSessionNetworkId({
        ...baseArgs,
        displayLookupSessionConfig: { networkChainId: 777 },
        getSessionChainId: () => null,
      }),
    ).toBe(777);
    expect(
      resolveSbtSelectorSessionNetworkId({
        ...baseArgs,
        displayLookupSessionConfig: { __registry: { chainId: 778 } },
        getSessionChainId: () => null,
      }),
    ).toBe(778);
    expect(
      resolveSbtSelectorSessionNetworkId({
        ...baseArgs,
        displayLookupSessionConfig: { contracts: { sbtFactory: { chainId: 779 } } },
        getSessionChainId: () => null,
      }),
    ).toBe(779);
    expect(
      resolveSbtSelectorSessionNetworkId({
        ...baseArgs,
        getSessionChainId: () => null,
        directChainId: '',
      }),
    ).toBe(10);
    expect(
      resolveSbtSelectorSessionNetworkId({
        defaultFallbackChainId: 11155420,
        getNormalizedNetworkChainValue: () => null,
        getSessionChainId: () => null,
      }),
    ).toBe(11155420);
  });

  it('builds selector metadata lookup config and display labels', () => {
    expect(
      buildSbtSelectorMetadataLookupConfig({
        baseConfig: {
          sessionName: 'Base',
          contracts: { sbtFactory: { address: '0xBase' } },
          __registry: { source: 'base' },
        },
        chainId: 84532,
        propsConfig: {
          sessionName: 'Props',
          contracts: { surveys: { address: '0xSurvey' } },
        },
        sessionSlug: 'Alpha',
        shouldUsePropsConfig: true,
      }),
    ).toEqual({
      sessionName: 'Props',
      slug: 'Alpha',
      networkChainId: 84532,
      contracts: {
        sbtFactory: { address: '0xBase' },
        surveys: { address: '0xSurvey' },
      },
      __registry: { source: 'base', chainId: 84532 },
    });
    expect(
      buildSbtSelectorMetadataLookupConfig({
        baseConfig: {
          networkChainId: 10,
          __registry: { chainId: 10 },
        },
        propsConfig: {
          networkChainId: 84532,
        },
        sessionSlug: null,
        shouldUsePropsConfig: false,
      }),
    ).toEqual({
      slug: '',
      networkChainId: 10,
      contracts: {},
      __registry: { chainId: 10 },
    });
    expect(
      buildSbtSelectorDiscoverySessionRef({
        metadataLookupConfig: { sessionName: 'Base', slug: 'Old' },
        sessionSlug: 'Alpha',
      }),
    ).toEqual({ sessionName: 'Base', slug: 'Alpha' });
    expect(
      buildSbtSelectorDiscoverySessionRef({
        metadataLookupConfig: null,
        sessionSlug: null,
      }),
    ).toEqual({ slug: '' });
    expect(
      resolveSbtSelectorSessionLabel({
        sessionConfig: { sessionName: 'Alpha Session' },
        sessionSlug: 'alpha',
      }),
    ).toBe('Alpha Session (alpha)');
    expect(
      resolveSbtSelectorSessionLabel({
        sessionConfig: { sessionName: 'alpha' },
        sessionSlug: 'alpha',
      }),
    ).toBe('alpha');
    expect(
      resolveSbtSelectorSessionLabel({
        sessionConfig: {},
        sessionSlug: '',
      }),
    ).toBe('General');
  });

  it('builds stable selector request signatures and unresolved flags', () => {
    const sessionConfigSig = buildSessionConfigSig({
      slug: 'alpha',
      contracts: { sbtFactory: { address: ' 0xF00 ', chainId: '84532' } },
      blockLimits: { start: '10', end: '20' },
    });
    expect(sessionConfigSig).toBe('alpha|0xf00|84532|10|20');
    expect(
      buildFeaturedEntrySignature([{ slug: 'alpha', address: ' 0xB ' }, { slug: 'General', address: '' }, null]),
    ).toBe('alpha:0xb');
    expect(
      buildSbtOptionsRequestSignature({
        slug: 'alpha',
        cacheRevision: 3,
        sessionConfigSig,
        targetSlugChainSig: 'alpha:84532',
        featuredEntries: [{ slug: 'alpha', address: '0xB' }],
        ignoredFromConfig: ['0xC', '0xc'],
      }),
    ).toBe('alpha|3|alpha|0xf00|84532|10|20|alpha:84532|alpha:0xb|0xc');
    expect(isUnresolvedSessionConfig({ __unresolved: true })).toBe(true);
    expect(isUnresolvedSessionConfig({ __unresolved: false })).toBe(false);
    expect(isUnresolvedSessionConfig(null)).toBe(false);
  });
});
