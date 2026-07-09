import {
  buildScopedSbtIgnoreKey,
  hasAuthoritativeSessionSlug,
  hasOwn,
  pickNormalizedSessionSlug,
  pickOptionalNormalizedSessionSlug,
  resolveAuthoritativeSbtSessionBindingSlug,
  resolveConcreteSbtSessionBindingSlug,
  resolveDeclaredSbtSessionSlug,
  resolveSbtDetailLinkSessionSlug,
} from './sbtSelectorSessionBindingHelpers';

describe('sbtSelectorSessionBindingHelpers', () => {
  it('normalizes selector slugs and scoped ignore keys', () => {
    expect(pickNormalizedSessionSlug(null, undefined, 'Alpha')).toBe('Alpha');
    expect(pickNormalizedSessionSlug(null, 'General', 'Alpha')).toBe('');
    expect(pickNormalizedSessionSlug(null, undefined)).toBe('');
    expect(pickOptionalNormalizedSessionSlug(undefined, null)).toBeNull();
    expect(pickOptionalNormalizedSessionSlug('General')).toBe('');
    expect(buildScopedSbtIgnoreKey({ slug: 'Alpha', address: ' 0xABC ' })).toBe('Alpha|0xabc');
    expect(buildScopedSbtIgnoreKey({ slug: 'General', address: '0xABC' })).toBe('|0xabc');
    expect(buildScopedSbtIgnoreKey({ slug: 'Alpha', address: '' })).toBe('');
    expect(hasOwn({ present: undefined }, 'present')).toBe(true);
    expect(hasOwn(Object.create({ inherited: true }), 'inherited')).toBe(false);
    expect(hasOwn(null, 'missing')).toBe(false);
  });

  it('resolves authoritative, declared, and concrete SBT session bindings', () => {
    expect(hasAuthoritativeSessionSlug({ sessionSlug: 'Alpha' })).toBe(true);
    expect(hasAuthoritativeSessionSlug({ sessionSlug: 'Alpha', sessionSlugExplicit: true })).toBe(true);
    expect(hasAuthoritativeSessionSlug({ sessionSlug: 'Alpha', sessionSlugExplicit: false })).toBe(false);
    expect(hasAuthoritativeSessionSlug({ slug: 'Alpha' })).toBe(false);

    expect(
      resolveAuthoritativeSbtSessionBindingSlug({
        sbtInfo: { sessionSlug: 'Alpha', sessionSlugExplicit: true },
      }),
    ).toBe('Alpha');
    expect(resolveAuthoritativeSbtSessionBindingSlug({ sessionSlug: 'Beta' })).toBe('Beta');
    expect(resolveAuthoritativeSbtSessionBindingSlug({ sbtInfo: { slug: 'Legacy' } })).toBe('Legacy');
    expect(
      resolveAuthoritativeSbtSessionBindingSlug({
        sessionSlug: 'Inferred',
        sessionSlugExplicit: false,
      }),
    ).toBeNull();

    expect(
      resolveDeclaredSbtSessionSlug({
        sbtInfo: { sessionSlug: 'Declared' },
        sessionSlug: 'Fallback',
      }),
    ).toBe('Declared');
    expect(resolveDeclaredSbtSessionSlug({ sessionSlug: 'Fallback' })).toBe('Fallback');
    expect(resolveDeclaredSbtSessionSlug({})).toBeNull();
    expect(
      resolveConcreteSbtSessionBindingSlug({
        sessionSlug: 'Concrete',
        sessionSlugExplicit: true,
      }),
    ).toBe('Concrete');
    expect(
      resolveConcreteSbtSessionBindingSlug({
        sessionSlug: 'Inferred',
        sessionSlugExplicit: false,
      }),
    ).toBeNull();
  });

  it('resolves SBT detail link session slug precedence', () => {
    expect(
      resolveSbtDetailLinkSessionSlug({
        sbt: {
          sessionBindingSlug: 'Binding',
          sbtInfo: { sessionSlug: 'Info', sessionSlugExplicit: true },
          sessionSlug: 'Selected',
        },
        fallbackSlug: 'Fallback',
      }),
    ).toBe('Binding');
    expect(
      resolveSbtDetailLinkSessionSlug({
        sbt: {
          sbtInfo: { sessionSlug: 'Info', sessionSlugExplicit: true },
          sessionSlug: 'Selected',
        },
        fallbackSlug: 'Fallback',
      }),
    ).toBe('Info');
    expect(
      resolveSbtDetailLinkSessionSlug({
        sbt: { sessionSlug: 'Selected', sessionSlugExplicit: true },
        fallbackSlug: 'Fallback',
      }),
    ).toBe('Selected');
    expect(
      resolveSbtDetailLinkSessionSlug({
        sbt: { sessionSlug: 'Selected', sessionSlugExplicit: false },
        fallbackSlug: 'Fallback',
      }),
    ).toBe('Selected');
    expect(
      resolveSbtDetailLinkSessionSlug({
        sbt: {},
        fallbackSlug: 'Fallback',
      }),
    ).toBe('Fallback');
  });
});
