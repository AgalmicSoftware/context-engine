import {
  buildAtlasNodeRoute,
  buildPublicRoute,
  buildPublicUrlPath,
  readPublicUrlBasePath,
  readSafeInternalReturnTo,
  readWindowLocationPath,
  stripPublicUrlBasePath,
} from './publicUrl.js';

describe('readPublicUrlBasePath', () => {
  it('returns an empty string when process is unavailable', () => {
    expect(readPublicUrlBasePath(undefined)).toBe('');
  });

  it('normalizes trailing slashes from path-like PUBLIC_URL values', () => {
    expect(readPublicUrlBasePath({ env: { PUBLIC_URL: '/ce/' } })).toBe('/ce');
  });

  it('extracts only the pathname from absolute PUBLIC_URL values', () => {
    expect(readPublicUrlBasePath({ env: { PUBLIC_URL: 'https://ce.example.com/base/' } })).toBe('/base');
  });
});

describe('buildPublicUrlPath', () => {
  it('prefixes relative paths with the configured PUBLIC_URL base path', () => {
    expect(buildPublicUrlPath('/new', { env: { PUBLIC_URL: '/ce/' } })).toBe('/ce/new');
  });

  it('leaves relative paths unchanged when PUBLIC_URL is unset', () => {
    expect(buildPublicUrlPath('/new', { env: {} })).toBe('/new');
  });
});

describe('buildPublicRoute', () => {
  it('returns the configured base path when no pathname is provided', () => {
    expect(buildPublicRoute('', { env: { PUBLIC_URL: '/ce/' } })).toBe('/ce');
  });

  it('falls back to the site root when no pathname or PUBLIC_URL is provided', () => {
    expect(buildPublicRoute('', { env: {} })).toBe('/');
  });
});

describe('stripPublicUrlBasePath', () => {
  it('removes the configured base path while preserving query strings and hashes', () => {
    const proc = { env: { PUBLIC_URL: '/ce/' } };

    expect(stripPublicUrlBasePath('/ce/session/edge?tab=1#top', proc)).toBe('/session/edge?tab=1#top');
    expect(stripPublicUrlBasePath('/ce', proc)).toBe('/');
    expect(stripPublicUrlBasePath('/session/edge', proc)).toBe('/session/edge');
  });
});

describe('readWindowLocationPath', () => {
  it('combines pathname, search, and hash from the current location', () => {
    expect(
      readWindowLocationPath({
        location: {
          pathname: '/ce/su/Franklin',
          search: '?tab=atlas',
          hash: '#positions',
        },
      }),
    ).toBe('/ce/su/Franklin?tab=atlas#positions');
  });
});

describe('buildAtlasNodeRoute', () => {
  it('builds demo atlas node routes with a return target under PUBLIC_URL', () => {
    expect(
      buildAtlasNodeRoute('0xabc', { demo: true, returnTo: '/ce/su/Franklin' }, { env: { PUBLIC_URL: '/ce/' } }),
    ).toBe('/ce/atlas/0xabc?demo=1&returnTo=%2Fce%2Fsu%2FFranklin');
  });
});

describe('readSafeInternalReturnTo', () => {
  it('accepts same-origin relative app paths', () => {
    expect(
      readSafeInternalReturnTo('/ce/su/Franklin?tab=atlas#positions', {
        location: { origin: 'https://ce.example' },
      }),
    ).toBe('/ce/su/Franklin?tab=atlas#positions');
  });

  it('rejects external return targets', () => {
    expect(
      readSafeInternalReturnTo('https://evil.example/phish', {
        location: { origin: 'https://ce.example' },
      }),
    ).toBe('');
  });
});
