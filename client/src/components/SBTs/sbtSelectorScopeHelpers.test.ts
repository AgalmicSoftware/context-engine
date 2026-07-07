import {
  buildSbtSelectorAutoSearchSessionOptions,
  buildSbtSelectorGroupOptions,
  buildSbtSelectorListScopeTargetSlugSet,
  getNormalizedDiscoveryOverride,
  normalizeDiscoverySlugs,
  resolveDirectSbtSelectorTargetSlugs,
  resolvePropSessionSlug,
  resolveSbtSelectorDisplayLookupSessionConfig,
  resolveSbtSelectorEffectiveSessionSlug,
  resolveSbtSelectorScopeMode,
  resolveSbtSelectorTargetSlugs,
  shouldUsePropsSbtSelectorSessionConfigForSlug,
  shouldWarmSbtSelectorRegistryCacheForTargets,
} from './sbtSelectorScopeHelpers';

describe('sbtSelectorScopeHelpers', () => {
  it('normalizes prop session slugs and discovery slug lists', () => {
    expect(resolvePropSessionSlug({ sessionSlug: 'Alpha', activeSessionSlug: 'Beta' })).toBe('Alpha');
    expect(resolvePropSessionSlug({ activeSessionSlug: 'Beta' })).toBe('Beta');
    expect(resolvePropSessionSlug({ sessionSlug: 'General', activeSessionSlug: 'Beta' })).toBe('');
    expect(
      resolveSbtSelectorEffectiveSessionSlug({
        groupOverride: true,
        sourceSessionSlug: 'source',
      }),
    ).toBe('source');
    expect(normalizeDiscoverySlugs(['Alpha', 'Alpha', 'General', null], { allowEmpty: true })).toEqual(['Alpha', '']);
    expect(normalizeDiscoverySlugs(['Alpha', 'General', null], { allowEmpty: false })).toEqual(['Alpha']);
    expect(
      Array.from(
        buildSbtSelectorListScopeTargetSlugSet({
          fallbackSlug: 'Fallback',
          scopeMode: 'list',
          targetSlugs: [],
        }) || [],
      ),
    ).toEqual(['Fallback']);
  });

  it('resolves direct and effective target slugs', () => {
    const normalizeSlugs = (slugs: unknown, options = {}) => normalizeDiscoverySlugs(slugs, options);
    expect(
      resolveDirectSbtSelectorTargetSlugs({
        explicitOverride: ['Override'],
        normalizeDiscoverySlugs: normalizeSlugs,
        propSessionSlug: 'Active',
      }),
    ).toEqual(['Override']);
    expect(
      resolveDirectSbtSelectorTargetSlugs({
        normalizeDiscoverySlugs: normalizeSlugs,
        propSessionSlug: 'Active',
        readSessionScanScope: () => 'general',
      }),
    ).toEqual(['']);
    expect(
      resolveDirectSbtSelectorTargetSlugs({
        getAllSessionSlugs: () => ['A', 'B'],
        normalizeDiscoverySlugs: normalizeSlugs,
        readSessionScanScope: () => 'all',
      }),
    ).toEqual(['A', 'B']);
    expect(
      resolveSbtSelectorTargetSlugs({
        groupOverride: true,
        sourceSessionSlug: 'Source',
      }),
    ).toEqual(['Source']);
    expect(
      resolveSbtSelectorTargetSlugs({
        slugOverride: 'Override',
      }),
    ).toEqual(['Override']);
  });

  it('resolves registry warming and props config usage', () => {
    expect(
      shouldWarmSbtSelectorRegistryCacheForTargets({
        targetSlugs: [],
      }),
    ).toBe(true);
    expect(
      shouldWarmSbtSelectorRegistryCacheForTargets({
        targetSlugs: ['a', 'b'],
        shouldUsePropsSessionConfigForSlug: (slug) => slug === 'a',
      }),
    ).toBe(true);
    expect(
      shouldWarmSbtSelectorRegistryCacheForTargets({
        targetSlugs: ['a'],
        shouldUsePropsSessionConfigForSlug: () => true,
      }),
    ).toBe(false);
    expect(
      shouldUsePropsSbtSelectorSessionConfigForSlug({
        effectiveSessionSlug: 'alpha',
        sessionConfig: { slug: 'alpha' },
        slugIn: 'alpha',
      }),
    ).toBe(true);
    expect(
      shouldUsePropsSbtSelectorSessionConfigForSlug({
        effectiveSessionSlug: 'alpha',
        sessionConfig: { slug: 'beta' },
        slugIn: 'gamma',
      }),
    ).toBe(false);
  });

  it('resolves display lookup, scope mode, and group options', () => {
    const strict = { slug: 'strict' };
    const demo = { slug: 'demo' };
    expect(
      resolveSbtSelectorDisplayLookupSessionConfig({
        getSessionConfigBySlugOrDefault: () => strict,
        sessionSlug: 'alpha',
      }),
    ).toBe(strict);
    expect(
      resolveSbtSelectorDisplayLookupSessionConfig({
        allowDemoSessionFallback: true,
        getDemoSessionConfigBySlug: () => demo,
        getSessionConfigBySlugOrDefault: () => ({ __unresolved: true }),
        sessionSlug: 'alpha',
      }),
    ).toBe(demo);
    expect(getNormalizedDiscoveryOverride({ discoverySessionSlugs: ['Alpha', 'Alpha'] })).toEqual(['Alpha']);
    expect(
      resolveSbtSelectorScopeMode({
        discoveryOverride: ['Alpha'],
        readSessionScanScope: () => 'all',
      }),
    ).toBe('explicit');
    expect(
      buildSbtSelectorGroupOptions({
        slugs: ['a'],
        getSessionLabel: (slug) => `Label ${slug}`,
      }),
    ).toEqual([{ value: 'a', label: 'Label a' }]);
    expect(
      buildSbtSelectorAutoSearchSessionOptions({
        autoSearchOtherSessions: true,
        directlyInvokedTargetSlugs: ['a'],
        enableGroupSelect: true,
        groupOptions: [
          { value: 'a', label: 'A' },
          { value: 'b', label: 'B' },
        ],
      }),
    ).toEqual([{ value: 'b', label: 'B' }]);
  });
});
