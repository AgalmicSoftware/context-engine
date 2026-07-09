import {
  buildSessionWizardNewSessionBannerDismissalContextKey,
  isNewSessionWizardPathname,
  normalizeSessionWizardPathname,
  readSessionWizardNewSessionBannerDismissed,
  removeHashQueryParam,
  scrubSponsoredBundleHashSecret,
  writeSessionWizardNewSessionBannerDismissed,
} from './sessionWizardRouteState';

describe('sessionWizardRouteState', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.history.replaceState({}, '', '/');
  });

  it('normalizes wizard pathnames and detects new-session routes', () => {
    expect(normalizeSessionWizardPathname(' /new/ ')).toBe('/new');
    expect(normalizeSessionWizardPathname('/session/new?foo=1')).toBe('/session/new');
    expect(isNewSessionWizardPathname('/new')).toBe(true);
    expect(isNewSessionWizardPathname('/session/new/')).toBe(true);
    expect(isNewSessionWizardPathname('/session/demo')).toBe(false);
  });

  it('reads and writes the new-session banner dismissal flag', () => {
    expect(readSessionWizardNewSessionBannerDismissed()).toBe(false);
    writeSessionWizardNewSessionBannerDismissed();
    expect(readSessionWizardNewSessionBannerDismissed()).toBe(true);
  });

  it('builds context keys for plain and sponsored new-session routes', () => {
    expect(
      buildSessionWizardNewSessionBannerDismissalContextKey({
        pathname: '/new',
      }),
    ).toBe('/new::plain');
    expect(
      buildSessionWizardNewSessionBannerDismissalContextKey({
        pathname: '/session/new',
        sponsoredBundleId: 'bundle-123',
        sponsoredBundleKey: 'secret',
      }),
    ).toBe('/session/new::sponsored::bundle-123::with-key');
    expect(
      buildSessionWizardNewSessionBannerDismissalContextKey({
        pathname: '/session/demo',
        sponsoredBundleId: 'bundle-123',
      }),
    ).toBe('');
  });

  it('removes the sponsored bundle key from hash URLs', () => {
    expect(removeHashQueryParam('#k=secret&foo=1', 'k')).toBe('#foo=1');
    expect(removeHashQueryParam('#foo=1&bar=2', 'k')).toBe('#foo=1&bar=2');
    expect(removeHashQueryParam('#plain-fragment', 'k')).toBe('#plain-fragment');
  });

  it('scrubs the sponsored bundle key from window.location.hash', () => {
    window.history.replaceState({}, '', '/new?x=1#k=secret&foo=1');
    scrubSponsoredBundleHashSecret();
    expect(window.location.pathname).toBe('/new');
    expect(window.location.search).toBe('?x=1');
    expect(window.location.hash).toBe('#foo=1');
  });
});
