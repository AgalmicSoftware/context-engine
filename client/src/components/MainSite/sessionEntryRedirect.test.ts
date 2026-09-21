import { getSessionEntryRedirect } from './sessionEntryRedirect';

describe('EDDY session entry redirect', () => {
  it.each(['/session/eddy26', '/session/eddy26/'])('expands the bare event URL %s', (path) => {
    const target = new URL(getSessionEntryRedirect(path)!, 'https://contextengine.sh');
    expect(target.pathname).toBe('/session/eddy26');
    expect(Object.fromEntries(target.searchParams)).toEqual({
      worker: 'https://ce-eddy26-d9702b0d3c41.agalmic.workers.dev/',
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
