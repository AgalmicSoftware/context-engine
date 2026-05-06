import { replaceRouteResponderQueryParam } from './urlUtils';

const VALID_RESPONDER = '0x1234567890abcdef1234567890abcdef12345678';
const mutableEnv = process.env as Record<string, string | undefined>;
const originalPublicUrl = mutableEnv.PUBLIC_URL;

const restorePublicUrl = (): void => {
  if (typeof originalPublicUrl === 'undefined') {
    delete mutableEnv.PUBLIC_URL;
  } else {
    mutableEnv.PUBLIC_URL = originalPublicUrl;
  }
};

describe('replaceRouteResponderQueryParam', () => {
  beforeEach(() => {
    delete mutableEnv.PUBLIC_URL;
    window.history.replaceState({}, '', '/survey/original?foo=1#details');
  });

  afterEach(() => {
    restorePublicUrl();
    window.history.replaceState({}, '', '/');
  });

  it('updates the responder query param for valid responder addresses', () => {
    replaceRouteResponderQueryParam('/survey/survey-1', VALID_RESPONDER, '?foo=1');

    expect(window.location.pathname).toBe('/survey/survey-1');
    expect(window.location.search).toBe(`?foo=1&responder=${VALID_RESPONDER}`);
    expect(window.location.hash).toBe('#details');
  });

  it('does not update the route for invalid responder addresses', () => {
    replaceRouteResponderQueryParam('/survey/survey-1', 'not-an-address', '?foo=1');

    expect(window.location.pathname).toBe('/survey/original');
    expect(window.location.search).toBe('?foo=1');
    expect(window.location.hash).toBe('#details');
  });

  it('keeps responder route rewrites under PUBLIC_URL subpaths', () => {
    mutableEnv.PUBLIC_URL = '/ce/';

    replaceRouteResponderQueryParam('/question/question-1', VALID_RESPONDER, '');

    expect(window.location.pathname).toBe('/ce/question/question-1');
    expect(window.location.search).toBe(`?responder=${VALID_RESPONDER}`);
  });
});
