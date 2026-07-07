import {
  getExplicitSbtPageSessionSlug,
  hasExplicitSbtPageSessionSlugProp,
  resolveSbtPageEffectiveSessionSlug,
  resolveSbtPageSessionDisplayConfig,
  resolveSbtPageSessionDisplayLabel,
  resolveSbtPageSessionSlugFromInfo,
} from './sbtPageSessionDisplayHelpers';

describe('sbtPageSessionDisplayHelpers', () => {
  it('resolves explicit, metadata, and fallback session slugs in order', () => {
    expect(hasExplicitSbtPageSessionSlugProp({ sessionSlug: 'alpha' })).toBe(true);
    expect(hasExplicitSbtPageSessionSlugProp({ slug: 'beta' })).toBe(true);
    expect(hasExplicitSbtPageSessionSlugProp({})).toBe(false);
    expect(getExplicitSbtPageSessionSlug({ sessionSlug: 'alpha', slug: 'beta' })).toBe('alpha');
    expect(getExplicitSbtPageSessionSlug({ slug: 'beta' })).toBe('beta');
    expect(getExplicitSbtPageSessionSlug({})).toBeNull();
    expect(
      resolveSbtPageSessionSlugFromInfo({
        sessionSlug: 'alpha',
        sessionSlugExplicit: true,
      }),
    ).toBe('alpha');
    expect(
      resolveSbtPageSessionSlugFromInfo({
        sessionName: 'Missing Session Name',
      }),
    ).toBeNull();
    expect(
      resolveSbtPageEffectiveSessionSlug({
        props: { sessionSlug: 'PropSlug' },
        resolvedSessionSlug: 'Resolved',
        sbtInfo: { sessionSlug: 'Info', sessionSlugExplicit: true },
      }),
    ).toBe('PropSlug');
    expect(
      resolveSbtPageEffectiveSessionSlug({
        props: {},
        resolvedSessionSlug: 'Resolved',
        sbtInfo: { sessionSlug: 'Info', sessionSlugExplicit: true },
      }),
    ).toBe('Resolved');
    expect(
      resolveSbtPageEffectiveSessionSlug({
        props: {},
        resolvedSessionSlug: null,
        sbtInfo: { sessionSlug: 'Info', sessionSlugExplicit: true },
      }),
    ).toBe('Info');
  });

  it('resolves session display config and labels without changing fallback order', () => {
    const readSession = jest.fn((slug: string) => (slug === 'alpha' ? { sessionName: 'Alpha Session' } : null));
    const readDemo = jest.fn(() => ({ sessionName: 'Demo Session' }));

    expect(
      resolveSbtPageSessionDisplayConfig({
        getDemoSessionConfigBySlug: readDemo,
        getSessionConfigBySlugOrDefault: readSession,
        sessionSlugRaw: ' alpha ',
      }),
    ).toEqual({ sessionName: 'Alpha Session' });
    expect(
      resolveSbtPageSessionDisplayConfig({
        getDemoSessionConfigBySlug: readDemo,
        getSessionConfigBySlugOrDefault: readSession,
        sessionSlugRaw: 'missing',
      }),
    ).toEqual({ sessionName: 'Demo Session' });
    expect(readDemo).toHaveBeenCalledWith('missing', { allowDemoFallback: true });
    expect(
      resolveSbtPageSessionDisplayConfig({
        getSessionConfigBySlugOrDefault: () => {
          throw new Error('config unavailable');
        },
        sessionSlugRaw: 'alpha',
      }),
    ).toBeNull();
    expect(
      resolveSbtPageSessionDisplayLabel({
        sessionConfig: { sessionName: 'Alpha Session' },
        sessionSlugRaw: 'alpha',
      }),
    ).toBe('Alpha Session');
    expect(resolveSbtPageSessionDisplayLabel({ sessionSlugRaw: 'alpha' })).toBe('alpha');
    expect(resolveSbtPageSessionDisplayLabel({ sessionSlugRaw: '' })).toBe('General');
  });
});
