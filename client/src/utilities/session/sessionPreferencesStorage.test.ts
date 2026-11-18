import {
  persistTooltipsEnabled,
  normalizeTooltipsEnabled,
  readStoredTooltipsEnabled,
} from './sessionPreferencesStorage.js';

describe('sessionPreferencesStorage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('reads and persists the tooltip preference', () => {
    expect(readStoredTooltipsEnabled()).toBe(true);

    localStorage.setItem('ce:tooltipsEnabled', JSON.stringify(false));
    expect(readStoredTooltipsEnabled()).toBe(false);

    localStorage.setItem('ce:tooltipsEnabled', JSON.stringify('false'));
    expect(readStoredTooltipsEnabled()).toBe(true);

    localStorage.setItem('ce:tooltipsEnabled', JSON.stringify(null));
    expect(readStoredTooltipsEnabled()).toBe(true);

    persistTooltipsEnabled(true);
    expect(JSON.parse(localStorage.getItem('ce:tooltipsEnabled') || 'null')).toBe(true);
  });

  it('normalizes tooltip preference input to booleans', () => {
    expect(normalizeTooltipsEnabled(false)).toBe(false);
    expect(normalizeTooltipsEnabled(true)).toBe(true);
    expect(normalizeTooltipsEnabled('false')).toBe(true);
    expect(normalizeTooltipsEnabled(null)).toBe(true);
  });

  it('falls back when stored JSON is malformed', () => {
    localStorage.setItem('ce:tooltipsEnabled', '{bad');

    expect(readStoredTooltipsEnabled()).toBe(true);
  });
});
