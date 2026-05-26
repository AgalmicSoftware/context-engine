import {
  buildBookmarksRoutePath,
  buildSettingsSessionHref,
  formatSettingsSessionSlug,
  normalizeSettingsSessionSlug,
} from './loginSettingsRouteHelpers';

describe('loginSettingsRouteHelpers', () => {
  const originalPublicUrl = process.env.PUBLIC_URL;

  afterEach(() => {
    process.env.PUBLIC_URL = originalPublicUrl;
  });

  it('normalizes settings session slugs without changing general-session handling', () => {
    expect(normalizeSettingsSessionSlug(' General ')).toBe('');
    expect(normalizeSettingsSessionSlug(' Edge Session ')).toBe('edge session');
    expect(formatSettingsSessionSlug('general')).toBe('general');
    expect(formatSettingsSessionSlug(' Edge Session ')).toBe('edge session');
  });

  it('builds settings route hrefs with base-path and encoding behavior preserved', () => {
    process.env.PUBLIC_URL = '/ce/';

    expect(buildSettingsSessionHref('general')).toBe('/ce/session');
    expect(buildSettingsSessionHref(' Edge Session ')).toBe('/ce/session/edge%20session');
    expect(buildBookmarksRoutePath()).toBe('/ce/bookmarks');
  });
});
