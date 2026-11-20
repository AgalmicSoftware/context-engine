import { keepUserPageSessionEntries } from './userPageAnalysisContentHelpers';

describe('keepUserPageSessionEntries', () => {
  const entries = [
    { id: 'a', slug: 'rxc-ra-2', sessionSlug: 'rxc-ra-2' },
    { id: 'b', slug: 'private-session', sessionSlug: 'private-session' },
    { id: 'c', slug: 'RXC-RA-2' },
    { id: 'd', slug: '' },
    { id: 'e' },
    { id: 'f', slug: null, sessionSlug: undefined },
    { id: 'g', slug: 'private-session', sessionSlug: 'rxc-ra-2' },
  ];
  const ids = (slug: unknown) => keepUserPageSessionEntries<{ id: string }>(entries, slug).map(({ id }) => id);

  it("keeps the named session's entries, read as the app reads a session's name", () => {
    // An entry's own session name counts before the name of the store it was read from.
    expect(ids('rxc-ra-2')).toEqual(['a', 'g']);
    expect(ids(' rxc-ra-2 ')).toEqual(['a', 'g']);
    expect(ids('private-session')).toEqual(['b']);
  });

  it('keeps only the default session, whose name is empty, for a page with no session of its own', () => {
    expect(ids('')).toEqual(['d']);
    expect(ids(undefined)).toEqual(['d']);
  });

  it('leaves out an entry that names no session, and anything that is not a list', () => {
    expect(ids('rxc-ra-2')).not.toContain('e');
    expect(ids('rxc-ra-2')).not.toContain('f');
    expect(keepUserPageSessionEntries(null, 'rxc-ra-2')).toEqual([]);
    expect(keepUserPageSessionEntries('rxc-ra-2', 'rxc-ra-2')).toEqual([]);
  });
});
