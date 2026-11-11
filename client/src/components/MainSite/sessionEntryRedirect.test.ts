import { KNOWN_SESSIONS } from '../../utilities/session/knownSessionsFile';
import { getSessionAtlasRedirect, getSessionEntryRedirect } from './sessionEntryRedirect';

describe('EDDY session entry redirect', () => {
  it.each(['/rxc-test', '/rxc-ra-test-5', '/rxc-ra-test-6/'])('adds no short link for %s', (path) => {
    expect(getSessionEntryRedirect(path)).toBeNull();
  });

  it.each(['/session/eddy26', '/session/eddy26/'])('expands the bare event URL %s', (path) => {
    const target = new URL(getSessionEntryRedirect(path)!, 'https://contextengine.sh');
    expect(target.pathname).toBe('/session/eddy26');
    expect(Object.fromEntries(target.searchParams)).toEqual({
      worker: KNOWN_SESSIONS.eddy26.worker,
      joinGroup: 'eddy-2026',
      mode: 'interview',
    });
    expect(getSessionEntryRedirect(target.pathname, target.search, target.hash)).toBeNull();
  });

  it.each([
    ['?worker=https%3A%2F%2Fworker.example', ''],
    ['?mode=interview', ''],
    ['?view=results', ''],
    ['', '#results'],
    ['', '#prefill=packet'],
  ])('preserves explicit navigation intent (%s%s)', (search, hash) => {
    expect(getSessionEntryRedirect('/session/eddy26', search, hash)).toBeNull();
  });

  it.each(['/session/eddy26/questions/results', '/session/eddy26/docs', '/session/eddy-2026-test'])(
    'leaves other routes unchanged: %s',
    (path) => expect(getSessionEntryRedirect(path)).toBeNull(),
  );
});

describe('session atlas links', () => {
  it('opens a session atlas on its session page, at the node named, with its Worker', () => {
    const target = new URL(
      getSessionAtlasRedirect('/atlas/atlas_k1_00000001%3Ab1t2', '?session=salon&worker=https%3A%2F%2Fce-salon.dev')!,
      'https://contextengine.sh',
    );
    expect(target.pathname).toBe('/session/salon');
    expect(Object.fromEntries(target.searchParams)).toEqual({
      worker: 'https://ce-salon.dev',
      atlas: 'atlas_k1_00000001:b1t2',
    });
    expect(getSessionAtlasRedirect('/atlas', '?session=salon')).toBe('/session/salon?atlas=1');
  });

  it('keeps a node whose percent-encoding is broken as written, still under the session page', () => {
    const target = new URL(getSessionAtlasRedirect('/atlas/%E0%A4%A', '?session=salon')!, 'https://contextengine.sh');
    expect(target.origin).toBe('https://contextengine.sh');
    expect(target.pathname).toBe('/session/salon');
    expect(target.searchParams.get('atlas')).toBe('%E0%A4%A');
    // A slug cannot leave the session path.
    expect(new URL(getSessionAtlasRedirect('/atlas', '?session=../admin')!, 'https://contextengine.sh').pathname).toBe(
      '/session/..%2Fadmin',
    );
  });

  it('leaves the demo atlas and unrelated paths alone', () => {
    expect(getSessionAtlasRedirect('/atlas', '')).toBeNull();
    expect(getSessionAtlasRedirect('/atlas/0x11', '?demo=1&returnTo=%2Fsu%2FFranklin')).toBeNull();
    expect(getSessionAtlasRedirect('/atlasx', '?session=salon')).toBeNull();
    expect(getSessionAtlasRedirect('/atlas/a/b', '?session=salon')).toBeNull();
  });
});
