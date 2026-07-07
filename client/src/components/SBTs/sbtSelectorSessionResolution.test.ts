import {
  resolveSbtSelectorSelectedSessionContext,
  resolveSbtSelectorSelectedSessionSlug,
} from './sbtSelectorSessionResolution.js';

describe('sbtSelectorSessionResolution', () => {
  it('prefers a resolved session slug from sessionName without alias collapsing', () => {
    const resolveSessionSlugByName = jest.fn((name: string) => (name === 'Weyl v. Yarvin Debate' ? 'debate' : null));

    expect(
      resolveSbtSelectorSelectedSessionSlug({
        sessionName: 'Weyl v. Yarvin Debate',
        sessionSlug: 'edge',
        activeSessionSlug: 'alpha',
        resolveSessionSlugByName,
      }),
    ).toBe('debate');
  });

  it('falls back from unresolved sessionName to explicit session slug, then active session slug', () => {
    const resolveSessionSlugByName = jest.fn(() => null);

    expect(
      resolveSbtSelectorSelectedSessionSlug({
        sessionName: 'Unknown Session',
        sessionSlug: ' DEBATE ',
        activeSessionSlug: 'alpha',
        resolveSessionSlugByName,
      }),
    ).toBe('DEBATE');

    expect(
      resolveSbtSelectorSelectedSessionSlug({
        sessionName: 'Unknown Session',
        sessionSlug: '',
        activeSessionSlug: 'General',
        resolveSessionSlugByName,
      }),
    ).toBe('');
  });

  it('returns normalized session context fields for selected SBT payloads', () => {
    expect(
      resolveSbtSelectorSelectedSessionContext({
        sessionName: ' Context Engine ',
        activeSessionSlug: 'edge',
        resolveSessionSlugByName: (name: string) => (name.trim() === 'Context Engine' ? '' : null),
      }),
    ).toEqual({
      sessionName: 'Context Engine',
      sessionSlug: '',
    });
  });
});
