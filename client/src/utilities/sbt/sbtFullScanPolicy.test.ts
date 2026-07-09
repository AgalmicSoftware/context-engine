import { normalizeSbtFullScanPolicy, readSbtFullScanPolicy, writeSbtFullScanPolicy } from './sbtFullScanPolicy.js';

describe('sbtFullScanPolicy helpers', () => {
  beforeEach(() => {
    try {
      window.history.replaceState({}, '', '/');
    } catch (_) {}
    try {
      localStorage.removeItem('ce:sbtFullScanPolicy');
    } catch (_) {}
    try {
      delete (globalThis as Record<string, unknown>).CE_SBT_FULL_SCAN_POLICY;
    } catch (_) {}
  });

  it('normalizes bad inputs to "auto"', () => {
    expect(normalizeSbtFullScanPolicy(null)).toBe('auto');
    expect(normalizeSbtFullScanPolicy(undefined)).toBe('auto');
    expect(normalizeSbtFullScanPolicy('')).toBe('auto');
    expect(normalizeSbtFullScanPolicy('weird')).toBe('auto');

    expect(normalizeSbtFullScanPolicy('MANUAL')).toBe('manual');
    expect(normalizeSbtFullScanPolicy(' sbts ')).toBe('sbts');
    expect(normalizeSbtFullScanPolicy('Auto')).toBe('auto');
  });

  it('prefers URL param over localStorage and globalThis', () => {
    localStorage.setItem('ce:sbtFullScanPolicy', 'manual');
    (globalThis as Record<string, unknown>).CE_SBT_FULL_SCAN_POLICY = 'sbts';

    window.history.replaceState({}, '', '/?ceSbtFullScanPolicy=auto');
    expect(readSbtFullScanPolicy()).toBe('auto');

    // Even invalid URL params win, clamping to "auto".
    window.history.replaceState({}, '', '/?ceSbtFullScanPolicy=not-valid');
    expect(readSbtFullScanPolicy()).toBe('auto');
  });

  it('falls back to localStorage then globalThis', () => {
    (globalThis as Record<string, unknown>).CE_SBT_FULL_SCAN_POLICY = 'manual';
    expect(readSbtFullScanPolicy()).toBe('manual');

    localStorage.setItem('ce:sbtFullScanPolicy', 'sbts');
    expect(readSbtFullScanPolicy()).toBe('sbts');

    // localStorage still wins, even when invalid.
    localStorage.setItem('ce:sbtFullScanPolicy', 'not-valid');
    expect(readSbtFullScanPolicy()).toBe('auto');
  });

  it('writeSbtFullScanPolicy writes localStorage and globalThis without reload', () => {
    expect(writeSbtFullScanPolicy('sbts')).toBe('sbts');
    expect(localStorage.getItem('ce:sbtFullScanPolicy')).toBe('sbts');
    expect((globalThis as Record<string, unknown>).CE_SBT_FULL_SCAN_POLICY).toBe('sbts');
  });
});
