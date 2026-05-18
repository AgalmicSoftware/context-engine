import { DEFAULT_DEMO_SURFACE_MODE } from '../../variables/appConfig.js';
import {
  persistDemoSurfaceMode,
  persistTooltipsEnabled,
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

    persistTooltipsEnabled(true);
    expect(JSON.parse(localStorage.getItem('ce:tooltipsEnabled') || 'null')).toBe(true);
  });

  it('falls back when stored JSON is malformed', () => {
    localStorage.setItem('ce:demoSurfaceMode', '{bad');
    localStorage.setItem('ce:tooltipsEnabled', '{bad');

    expect(readStoredDemoSurfaceMode()).toBe(DEFAULT_DEMO_SURFACE_MODE);
    expect(readStoredTooltipsEnabled()).toBe(true);
  });
});
