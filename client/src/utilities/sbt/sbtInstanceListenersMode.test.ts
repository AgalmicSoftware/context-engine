import {
  normalizeSbtInstanceListenersMode,
  readSbtInstanceListenersMode,
  writeSbtInstanceListenersMode,
} from './sbtInstanceListenersMode.js';

describe('sbtInstanceListenersMode helpers', () => {
  beforeEach(() => {
    try {
      window.history.replaceState({}, '', '/');
    } catch (_) {}
    try {
      localStorage.removeItem('ce:sbtInstanceListenersMode');
    } catch (_) {}
    try {
      delete (globalThis as Record<string, unknown>).CE_SBT_INSTANCE_LISTENERS_MODE;
    } catch (_) {}
  });

  it('normalizes bad inputs to "auto"', () => {
    expect(normalizeSbtInstanceListenersMode(null)).toBe('auto');
    expect(normalizeSbtInstanceListenersMode(undefined)).toBe('auto');
    expect(normalizeSbtInstanceListenersMode('')).toBe('auto');
    expect(normalizeSbtInstanceListenersMode('weird')).toBe('auto');

    expect(normalizeSbtInstanceListenersMode('ON')).toBe('on');
    expect(normalizeSbtInstanceListenersMode(' off ')).toBe('off');
    expect(normalizeSbtInstanceListenersMode('Auto')).toBe('auto');
  });

  it('prefers URL param over localStorage and globalThis', () => {
    localStorage.setItem('ce:sbtInstanceListenersMode', 'off');
    (globalThis as Record<string, unknown>).CE_SBT_INSTANCE_LISTENERS_MODE = 'on';

    window.history.replaceState({}, '', '/?ceSbtInstanceListenersMode=auto');
    expect(readSbtInstanceListenersMode()).toBe('auto');

    // Even invalid URL params win, clamping to "auto".
    window.history.replaceState({}, '', '/?ceSbtInstanceListenersMode=not-valid');
    expect(readSbtInstanceListenersMode()).toBe('auto');
  });

  it('falls back to localStorage then globalThis', () => {
    (globalThis as Record<string, unknown>).CE_SBT_INSTANCE_LISTENERS_MODE = 'off';
    expect(readSbtInstanceListenersMode()).toBe('off');

    localStorage.setItem('ce:sbtInstanceListenersMode', 'on');
    expect(readSbtInstanceListenersMode()).toBe('on');

    // localStorage still wins, even when invalid.
    localStorage.setItem('ce:sbtInstanceListenersMode', 'not-valid');
    expect(readSbtInstanceListenersMode()).toBe('auto');
  });

  it('writeSbtInstanceListenersMode writes localStorage and globalThis without reload', () => {
    expect(writeSbtInstanceListenersMode('off')).toBe('off');
    expect(localStorage.getItem('ce:sbtInstanceListenersMode')).toBe('off');
    expect((globalThis as Record<string, unknown>).CE_SBT_INSTANCE_LISTENERS_MODE).toBe('off');
  });
});
