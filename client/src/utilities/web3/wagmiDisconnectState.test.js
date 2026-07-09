import {
  USER_DISCONNECTED_STORAGE_KEY,
  wasUserExplicitlyDisconnected,
  markUserExplicitlyDisconnected,
  clearUserExplicitlyDisconnected,
} from './wagmiDisconnectState.js';

describe('wagmiDisconnectState', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns false when the disconnect flag is absent', () => {
    expect(wasUserExplicitlyDisconnected(localStorage)).toBe(false);
  });

  it('marks and reads the explicit disconnect flag', () => {
    markUserExplicitlyDisconnected(localStorage);

    expect(localStorage.getItem(USER_DISCONNECTED_STORAGE_KEY)).toBe('true');
    expect(wasUserExplicitlyDisconnected(localStorage)).toBe(true);
  });

  it('clears the explicit disconnect flag', () => {
    localStorage.setItem(USER_DISCONNECTED_STORAGE_KEY, 'true');

    clearUserExplicitlyDisconnected(localStorage);

    expect(localStorage.getItem(USER_DISCONNECTED_STORAGE_KEY)).toBeNull();
    expect(wasUserExplicitlyDisconnected(localStorage)).toBe(false);
  });

  it('returns safe defaults when window.localStorage getter throws', () => {
    const localStorageGetterSpy = jest.spyOn(window, 'localStorage', 'get').mockImplementation(() => {
      throw new Error('localStorage unavailable');
    });

    try {
      expect(() => wasUserExplicitlyDisconnected()).not.toThrow();
      expect(wasUserExplicitlyDisconnected()).toBe(false);
      expect(() => markUserExplicitlyDisconnected()).not.toThrow();
      expect(() => clearUserExplicitlyDisconnected()).not.toThrow();
    } finally {
      localStorageGetterSpy.mockRestore();
    }
  });
});
