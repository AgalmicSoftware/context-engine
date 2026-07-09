import {
  resolveQuestionFilterEffectiveSlug,
  resolveQuestionFilterSessionContext,
} from './questionFilterSessionResolution.js';

describe('questionFilterSessionResolution', () => {
  it('canonicalizes the general alias from explicit route slugs', () => {
    expect(
      resolveQuestionFilterEffectiveSlug({
        pathname: '/session/GeNeRal',
        activeSessionSlug: 'edge',
        sessionSlug: 'alpha',
      }),
    ).toBe('');
  });

  it('keeps active session precedence over props while treating active general aliases as empty', () => {
    expect(
      resolveQuestionFilterEffectiveSlug({
        pathname: '',
        activeSessionSlug: 'edge',
        sessionSlug: 'rxc',
      }),
    ).toBe('edge');

    expect(
      resolveQuestionFilterEffectiveSlug({
        pathname: '',
        activeSessionSlug: 'general',
        sessionSlug: 'rxc',
      }),
    ).toBe('rxc');
  });

  it('does not silently resolve unknown non-general slugs to general config', () => {
    const resolveBySlug = jest.fn((slug: string) => {
      if (slug === '') return { slug: '', sessionName: 'General' };
      return null;
    });

    const resolved = resolveQuestionFilterSessionContext({
      pathname: '',
      sessionSlug: 'missing-session-slug',
      resolveBySlug,
    });

    expect(resolved.sessionSlug).toBe('missing-session-slug');
    expect(resolved.sessionConfig).toBeNull();
    expect(resolved.error).toBe('Session config not found for "missing-session-slug".');
    expect(resolveBySlug).toHaveBeenCalledWith('missing-session-slug');
  });
});
