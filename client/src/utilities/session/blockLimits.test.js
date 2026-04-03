import { normalizeBlockLimitsForConfig } from './blockLimits.js';

describe('normalizeBlockLimitsForConfig', () => {
  test('returns null for missing/invalid start', () => {
    expect(normalizeBlockLimitsForConfig(null)).toBeNull();
    expect(normalizeBlockLimitsForConfig({})).toBeNull();
    expect(normalizeBlockLimitsForConfig({ start: 0, end: 10 })).toBeNull();
    expect(normalizeBlockLimitsForConfig({ start: -1, end: 10 })).toBeNull();
    expect(normalizeBlockLimitsForConfig({ start: 'abc', end: 10 })).toBeNull();
  });

  test('normalizes valid start/end values', () => {
    expect(normalizeBlockLimitsForConfig({ start: '1234', end: '1300' })).toEqual({
      start: 1234,
      end: 1300,
    });
  });

  test('drops invalid end and keeps start', () => {
    expect(normalizeBlockLimitsForConfig({ start: 5000, end: '' })).toEqual({
      start: 5000,
      end: null,
    });
    expect(normalizeBlockLimitsForConfig({ start: 5000, end: 4999 })).toEqual({
      start: 5000,
      end: null,
    });
    expect(normalizeBlockLimitsForConfig({ start: 5000, end: 'bad' })).toEqual({
      start: 5000,
      end: null,
    });
  });

  test('falls back to the provided latest block when start is missing', () => {
    expect(normalizeBlockLimitsForConfig({}, 8200000)).toEqual({
      start: 8200000,
      end: null,
    });
    expect(normalizeBlockLimitsForConfig({ start: '', end: 8200500 }, 8200000)).toEqual({
      start: 8200000,
      end: 8200500,
    });
  });
});
