import { normalizeRoutePath } from './routePathHelpers.js';

describe('routePathHelpers', () => {
  it('forwards the legacy DACC demo link to the about page', () => {
    expect(normalizeRoutePath('/demo/dacc')).toBe('/about');
    expect(normalizeRoutePath('/demo/dacc/')).toBe('/about');
  });

  it('keeps other legacy demo paths mapped to the session demo route', () => {
    expect(normalizeRoutePath('/demo')).toBe('/session/demo');
    expect(normalizeRoutePath('/demo/corpus-viewer')).toBe('/session/demo/corpus-viewer');
  });
});
