import store from '../../store';
import { readActiveSessionSlugForScope, shouldBypassSessionScopeWindow } from './sessionScopeWindow.js';

jest.mock('../../store', () => ({
  __esModule: true,
  default: {
    getState: jest.fn(),
  },
}));

jest.mock('../logging.js', () => ({
  createLogger: () => ({
    info: jest.fn(),
    warn: jest.fn(),
  }),
}));

describe('sessionScopeWindow', () => {
  const mockedStore = store as unknown as { getState: jest.Mock };
  const originalPublicUrl = process.env.PUBLIC_URL;

  beforeEach(() => {
    mockedStore.getState.mockReset();
    window.history.replaceState({}, '', '/');
    if (typeof originalPublicUrl === 'undefined') {
      delete process.env.PUBLIC_URL;
    } else {
      process.env.PUBLIC_URL = originalPublicUrl;
    }
  });

  it('resolves active session scope from store, route path, and query hints', () => {
    mockedStore.getState.mockReturnValue({
      sessionState: {
        activeSessionSlug: 'edge',
      },
    });
    expect(readActiveSessionSlugForScope()).toEqual({
      activeSlug: 'edge',
      activeSlugFromRoute: false,
    });

    window.history.replaceState({}, '', '/session/rxc');
    expect(readActiveSessionSlugForScope()).toEqual({
      activeSlug: 'rxc',
      activeSlugFromRoute: true,
    });

    window.history.replaceState({}, '', '/surveys?session=alpha');
    expect(readActiveSessionSlugForScope()).toEqual({
      activeSlug: 'alpha',
      activeSlugFromRoute: true,
    });
  });

  it('strips PUBLIC_URL before resolving the active session route slug', () => {
    process.env.PUBLIC_URL = '/ce/';
    mockedStore.getState.mockReturnValue({
      sessionState: {
        activeSessionSlug: 'general',
      },
    });
    window.history.replaceState({}, '', '/ce/session/edge');

    expect(readActiveSessionSlugForScope()).toEqual({
      activeSlug: 'edge',
      activeSlugFromRoute: true,
    });
  });

  it('honors explicit session scan-scope bypass flags', () => {
    expect(shouldBypassSessionScopeWindow({ __ignoreSessionScanScope: true })).toBe(true);
    expect(shouldBypassSessionScopeWindow({}, { __ignoreSessionScanScope: true })).toBe(true);
    expect(shouldBypassSessionScopeWindow({}, {})).toBe(false);
  });
});
