import { DEFAULT_DEMO_SURFACE_MODE } from '../../variables/appConfig.js';
import {
  persistDemoSurfaceMode,
  persistPileAutoAdvanceEnabled,
  readStoredPileAutoAdvanceEnabled,
  persistTooltipsEnabled,
  normalizeTooltipsEnabled,
  readStoredDemoSurfaceMode,
  readStoredTooltipsEnabled,
} from './sessionPreferencesStorage.js';

describe('sessionPreferencesStorage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('reads and persists the demo surface mode preference', () => {
    expect(readStoredDemoSurfaceMode()).toBe(DEFAULT_DEMO_SURFACE_MODE);

    localStorage.setItem('ce:demoSurfaceMode', JSON.stringify(false));
    expect(readStoredDemoSurfaceMode()).toBe(false);

    localStorage.setItem('ce:demoSurfaceMode', JSON.stringify(null));
    expect(readStoredDemoSurfaceMode()).toBe(true);

    persistDemoSurfaceMode(false);
    expect(JSON.parse(localStorage.getItem('ce:demoSurfaceMode') || 'null')).toBe(false);

    persistDemoSurfaceMode(null);
    expect(JSON.parse(localStorage.getItem('ce:demoSurfaceMode') || 'null')).toBe(true);
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
    localStorage.setItem('ce:demoSurfaceMode', '{bad');
    localStorage.setItem('ce:tooltipsEnabled', '{bad');

    expect(readStoredDemoSurfaceMode()).toBe(DEFAULT_DEMO_SURFACE_MODE);
    expect(readStoredTooltipsEnabled()).toBe(true);
  });
});

describe('pile auto-advance storage', () => {
  afterEach(() => {
    localStorage.clear();
    jest.restoreAllMocks();
  });
  it.each([null, '{bad', 'null', '"false"', 'true'])('defaults to on for %s', (stored) => {
    localStorage.clear();
    if (stored !== null) localStorage.setItem('ce:pileAutoAdvanceEnabled', stored);
    expect(readStoredPileAutoAdvanceEnabled()).toBe(true);
  });
  it('persists an explicit opt-out and tolerates unavailable storage', () => {
    persistPileAutoAdvanceEnabled(false);
    expect(readStoredPileAutoAdvanceEnabled()).toBe(false);
    jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('unavailable');
    });
    jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('unavailable');
    });
    expect(readStoredPileAutoAdvanceEnabled()).toBe(true);
    expect(() => persistPileAutoAdvanceEnabled(false)).not.toThrow();
  });
});
