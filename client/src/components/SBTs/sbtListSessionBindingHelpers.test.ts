import {
  hasSbtListAuthoritativeSessionSlug,
  hasSbtListExplicitNoSessionAssociation,
  hasSbtListMetadataSessionSlugField,
  hasSbtListMissingOrEmptySessionSlug,
  hasSbtListOwn,
  resolveSbtListConcreteSessionBindingSlug,
  resolveSbtListItemSessionSlug,
} from './sbtListSessionBindingHelpers';
import { SBT_LIST_NO_SESSION_UNIVERSE_SLUG } from './sbtListSessionUniverseHelpers';

describe('sbtListSessionBindingHelpers', () => {
  it('resolves SBT session metadata authority flags', () => {
    expect(hasSbtListOwn({ sessionSlug: 'alpha' }, 'sessionSlug')).toBe(true);
    expect(hasSbtListAuthoritativeSessionSlug({ sessionSlug: 'alpha' })).toBe(true);
    expect(hasSbtListAuthoritativeSessionSlug({ sessionSlug: 'alpha', sessionSlugExplicit: false })).toBe(false);
    expect(hasSbtListMetadataSessionSlugField({ sbtInfo: { sessionSlug: 'info' } })).toBe(true);
    expect(hasSbtListMetadataSessionSlugField({ sessionSlug: 'top' })).toBe(true);
    expect(
      hasSbtListExplicitNoSessionAssociation({
        sessionSlug: 'top',
        sbtInfo: { sessionSlug: '', sessionSlugExplicit: true },
      }),
    ).toBe(true);
    expect(hasSbtListMissingOrEmptySessionSlug({ sbtInfo: {} })).toBe(true);
    expect(hasSbtListMissingOrEmptySessionSlug({ sbtInfo: { sessionSlug: 'alpha' } })).toBe(false);
  });

  it('resolves concrete and display SBT session slugs by metadata precedence', () => {
    const getSessionSlugByName = jest.fn((sessionName: string) => (sessionName === 'Legacy Alpha' ? 'alpha' : null));

    expect(
      resolveSbtListConcreteSessionBindingSlug(
        {
          sbtInfo: { sessionSlug: 'beta', sessionSlugExplicit: true },
          sessionName: 'Legacy Alpha',
        },
        { getSessionSlugByName },
      ),
    ).toBe('beta');
    expect(
      resolveSbtListConcreteSessionBindingSlug(
        {
          sbtInfo: { slug: 'legacyslug' },
        },
        { getSessionSlugByName },
      ),
    ).toBe('legacyslug');
    expect(
      resolveSbtListConcreteSessionBindingSlug(
        {
          sbtInfo: { sessionSlug: 'Inferred', sessionSlugExplicit: false },
          sessionName: 'Legacy Alpha',
        },
        { getSessionSlugByName },
      ),
    ).toBeNull();
    expect(
      resolveSbtListConcreteSessionBindingSlug(
        {
          sessionName: 'Legacy Alpha',
        },
        { getSessionSlugByName },
      ),
    ).toBe('alpha');

    expect(
      resolveSbtListItemSessionSlug(
        {
          __sourceSessionSlug: 'source',
          sbtInfo: { sessionSlug: 'inferred', sessionSlugExplicit: false },
        },
        {
          allSessionsMode: false,
          listSlug: 'fallback',
        },
      ),
    ).toBe('source');
    expect(
      resolveSbtListItemSessionSlug(
        {
          sbtInfo: { sessionSlug: '', sessionSlugExplicit: true },
        },
        {
          allSessionsMode: true,
          isListModeScopeEnabled: true,
          resolveConcreteSessionBindingSlug: () => '',
        },
      ),
    ).toBe(SBT_LIST_NO_SESSION_UNIVERSE_SLUG);
    expect(
      resolveSbtListItemSessionSlug(
        {
          sbtInfo: { sessionSlug: 'beta', sessionSlugExplicit: true },
        },
        {
          allSessionsMode: true,
          isListModeScopeEnabled: true,
          resolveConcreteSessionBindingSlug: () => 'beta',
        },
      ),
    ).toBe('beta');
    expect(
      resolveSbtListItemSessionSlug(
        {
          slug: 'demo',
          sbtInfo: { name: 'Discovered Demo SBT' },
        },
        {
          allSessionsMode: true,
          isListModeScopeEnabled: true,
          resolveConcreteSessionBindingSlug: () => null,
        },
      ),
    ).toBe(SBT_LIST_NO_SESSION_UNIVERSE_SLUG);
    expect(
      resolveSbtListItemSessionSlug(
        {
          sessionSlug: '',
          sessionSlugExplicit: true,
          slug: 'demo',
          sbtInfo: { name: 'Explicit No Session SBT' },
        },
        {
          allSessionsMode: true,
          isListModeScopeEnabled: true,
          resolveConcreteSessionBindingSlug: () => null,
        },
      ),
    ).toBe(SBT_LIST_NO_SESSION_UNIVERSE_SLUG);
    expect(
      resolveSbtListItemSessionSlug(
        {},
        {
          allSessionsMode: false,
          listSlug: 'fallback',
        },
      ),
    ).toBe('fallback');
  });
});
