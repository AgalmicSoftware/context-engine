import {
  DEFAULT_SESSION_SCAN_MAX_BLOCK_RANGE,
  getAllowedSessionSlugs,
  isSessionSlugAllowedByScope,
  normalizeSessionScanSlug,
  normalizeSessionScanScope,
  normalizeSessionScanSlugs,
  readSessionScanMaxBlockRange,
  readSessionScanScope,
  readSessionScanSlugs,
  resolveValidatedSessionScanWindow,
  writeSessionScanScope,
  writeSessionScanSlugs,
} from './sessionScanScope.js';
import { CE_SESSION_SCAN_SCOPE } from '../../variables/appConfig.js';

const ORIGINAL_SESSION_SCAN_MAX_BLOCK_RANGE = process.env.REACT_APP_SESSION_SCAN_MAX_BLOCK_RANGE;

describe('sessionScanScope helpers', () => {
  beforeEach(() => {
    try {
      window.history.replaceState({}, '', '/');
    } catch (_) {}
    try {
      localStorage.removeItem('ce:sessionScanScope');
    } catch (_) {}
    try {
      localStorage.removeItem('ce:sessionScanSlugs');
    } catch (_) {}
    try {
      delete globalThis.CE_SESSION_SCAN_SCOPE;
    } catch (_) {}
    try {
      delete globalThis.CE_SESSION_SCAN_SLUGS;
    } catch (_) {}
    try {
      delete globalThis.CE_SESSION_SCAN_RESOLVE_DEMO_SESSION_ALIASES;
    } catch (_) {}
    try {
      delete process.env.REACT_APP_SESSION_SCAN_MAX_BLOCK_RANGE;
    } catch (_) {}
  });

  afterAll(() => {
    if (typeof ORIGINAL_SESSION_SCAN_MAX_BLOCK_RANGE === 'undefined') {
      delete process.env.REACT_APP_SESSION_SCAN_MAX_BLOCK_RANGE;
      return;
    }
    process.env.REACT_APP_SESSION_SCAN_MAX_BLOCK_RANGE = ORIGINAL_SESSION_SCAN_MAX_BLOCK_RANGE;
  });

  it('normalizes bad scope inputs to "active"', () => {
    expect(normalizeSessionScanScope(null)).toBe('active');
    expect(normalizeSessionScanScope(undefined)).toBe('active');
    expect(normalizeSessionScanScope('')).toBe('active');
    expect(normalizeSessionScanScope('weird')).toBe('active');

    expect(normalizeSessionScanScope('ACTIVE')).toBe('active');
    expect(normalizeSessionScanScope(' general ')).toBe('general');
    expect(normalizeSessionScanScope(' list ')).toBe('list');
    expect(normalizeSessionScanScope('All')).toBe('all');
  });

  it('normalizes single session slugs (general alias and empty handling)', () => {
    expect(normalizeSessionScanSlug('general')).toBe('');
    expect(normalizeSessionScanSlug(' GeNeRaL!!! ')).toBe('');
    expect(normalizeSessionScanSlug(' debate ')).toBe('debate');
    expect(normalizeSessionScanSlug('')).toBe('');
    expect(normalizeSessionScanSlug('', { allowEmpty: false })).toBeNull();
    expect(normalizeSessionScanSlug(' TeSt-112 ')).toBe('TeSt-112');
    expect(normalizeSessionScanSlug(' TeSt-112!?_A ')).toBe('TeSt-112!?_A');
  });

  it('normalizes worker host/url entries to session slugs', () => {
    const workerHost = 'test-3-worker-022226.account-subdomain.workers.dev'; // intentional: real URL — tests allowlist enforcement
    expect(normalizeSessionScanSlug(workerHost)).toBe('test-3');
    expect(normalizeSessionScanSlug(`https://${workerHost}/health`)).toBe('test-3');
    expect(normalizeSessionScanSlugs([workerHost, `https://${workerHost}`])).toEqual(['test-3']);
  });

  it('normalizes session slug lists (csv/array, dedupe, general alias)', () => {
    expect(normalizeSessionScanSlugs('general, alpha,ALPHA,,beta')).toEqual(['', 'alpha', 'ALPHA', 'beta']);
    expect(normalizeSessionScanSlugs([' general ', 'alpha', '', 'ALPHA', 'beta'])).toEqual([
      '',
      'alpha',
      'ALPHA',
      'beta',
    ]);
    expect(normalizeSessionScanSlugs('debate,rxc')).toEqual(['debate', 'rxc']);
    expect(normalizeSessionScanSlugs(['test-10, test-12', 'test-12'])).toEqual(['test-10', 'test-12']);
    expect(normalizeSessionScanSlugs('')).toEqual([]);
    expect(normalizeSessionScanSlugs(' , , ')).toEqual([]);
  });

  it('keeps exact non-alias scan slugs distinct', () => {
    expect(normalizeSessionScanSlugs(['Team A!', 'teama'])).toEqual(['Team A!', 'teama']);
  });

  it('resolves the shipped general demo aliases in list mode when enabled', () => {
    globalThis.CE_SESSION_SCAN_RESOLVE_DEMO_SESSION_ALIASES = true;
    expect(normalizeSessionScanSlugs(['general', 'Context Engine', 'general'])).toEqual(['']);
  });

  it('keeps unknown aliases literal when demoSessions alias resolution is disabled', () => {
    globalThis.CE_SESSION_SCAN_RESOLVE_DEMO_SESSION_ALIASES = false;
    expect(normalizeSessionScanSlugs(['Context Engine'])).toEqual(['Context Engine']);
  });

  it('prefers URL param over localStorage and globalThis', () => {
    localStorage.setItem('ce:sessionScanScope', 'general');
    globalThis.CE_SESSION_SCAN_SCOPE = 'all';

    window.history.replaceState({}, '', '/?ceSessionScanScope=active');
    expect(readSessionScanScope()).toBe('active');

    // Even invalid URL params win, clamping to the fail-closed default.
    window.history.replaceState({}, '', '/?ceSessionScanScope=not-valid');
    expect(readSessionScanScope()).toBe('active');
  });

  it('falls back to localStorage then globalThis', () => {
    globalThis.CE_SESSION_SCAN_SCOPE = 'general';
    expect(readSessionScanScope()).toBe('general');

    localStorage.setItem('ce:sessionScanScope', 'active');
    expect(readSessionScanScope()).toBe('active');

    // localStorage still wins, even when invalid.
    localStorage.setItem('ce:sessionScanScope', 'not-valid');
    expect(readSessionScanScope()).toBe('active');
  });

  it('defaults readSessionScanScope to the appConfig repo default when no override is set', () => {
    expect(readSessionScanScope()).toBe(CE_SESSION_SCAN_SCOPE);
  });

  it('writeSessionScanScope writes localStorage and globalThis without reload', () => {
    expect(writeSessionScanScope('active')).toBe('active');
    expect(localStorage.getItem('ce:sessionScanScope')).toBe('active');
    expect(globalThis.CE_SESSION_SCAN_SCOPE).toBe('active');
  });

  it('readSessionScanSlugs prefers URL param over localStorage and globalThis', () => {
    localStorage.setItem('ce:sessionScanSlugs', 'alpha,beta');
    globalThis.CE_SESSION_SCAN_SLUGS = ['gamma'];

    window.history.replaceState({}, '', '/?ceSessionScanSlugs=general,delta');
    expect(readSessionScanSlugs()).toEqual(['', 'delta']);
  });

  it('readSessionScanSlugs falls back to localStorage then globalThis', () => {
    globalThis.CE_SESSION_SCAN_SLUGS = ['gamma'];
    expect(readSessionScanSlugs()).toEqual(['gamma']);

    localStorage.setItem('ce:sessionScanSlugs', JSON.stringify(['general', 'alpha', 'ALPHA']));
    expect(readSessionScanSlugs()).toEqual(['', 'alpha', 'ALPHA']);
  });

  it('readSessionScanSlugs resolves demoSessions aliases from stored list values', () => {
    globalThis.CE_SESSION_SCAN_RESOLVE_DEMO_SESSION_ALIASES = true;
    localStorage.setItem('ce:sessionScanSlugs', JSON.stringify(['Context Engine', 'general']));
    expect(readSessionScanSlugs()).toEqual(['']);
  });

  it('writeSessionScanSlugs writes localStorage and globalThis without reload', () => {
    expect(writeSessionScanSlugs(['general', 'Alpha', 'alpha'])).toEqual(['', 'Alpha', 'alpha']);
    expect(localStorage.getItem('ce:sessionScanSlugs')).toBe(JSON.stringify(['', 'Alpha', 'alpha']));
    expect(globalThis.CE_SESSION_SCAN_SLUGS).toEqual(['', 'Alpha', 'alpha']);
  });

  it('getAllowedSessionSlugs is strict in list mode (no implicit general fallback)', () => {
    expect(getAllowedSessionSlugs('list', ['test-112'], '')).toEqual(['test-112']);
    expect(getAllowedSessionSlugs('list', ['general', 'test-112'], 'focus-999')).toEqual(['', 'test-112']);
    expect(getAllowedSessionSlugs('list', ['', 'test-112'], 'focus-999')).toEqual(['', 'test-112']);
    expect(getAllowedSessionSlugs('list', [], 'test-112')).toEqual([]);
    expect(getAllowedSessionSlugs('general', ['test-112'], 'test-112')).toEqual(['']);
    expect(getAllowedSessionSlugs('active', ['test-112'], 'TeSt-112')).toEqual(['TeSt-112']);
  });

  it('isSessionSlugAllowedByScope enforces list allowlists', () => {
    const opts = { scope: 'list', list: ['test-112'], activeSlug: '' };
    expect(isSessionSlugAllowedByScope('test-112', opts)).toBe(true);
    expect(isSessionSlugAllowedByScope('', opts)).toBe(false);
    expect(isSessionSlugAllowedByScope('general', opts)).toBe(false);
  });

  it('isSessionSlugAllowedByScope honors explicit general entries in list mode', () => {
    const opts = { scope: 'list', list: ['general', 'test-112'], activeSlug: 'focus-999' };
    expect(isSessionSlugAllowedByScope('', opts)).toBe(true);
    expect(isSessionSlugAllowedByScope('general', opts)).toBe(true);
    expect(isSessionSlugAllowedByScope('test-112', opts)).toBe(true);
    expect(isSessionSlugAllowedByScope('alpha', opts)).toBe(false);
  });

  it('list mode allows the active non-general slug even when not in list', () => {
    const opts = { scope: 'list', list: ['test-112'], activeSlug: 'focus-999' };
    expect(isSessionSlugAllowedByScope('focus-999', opts)).toBe(true);
    expect(isSessionSlugAllowedByScope('test-112', opts)).toBe(true);
    expect(isSessionSlugAllowedByScope('', opts)).toBe(false);
    expect(isSessionSlugAllowedByScope('other-777', opts)).toBe(false);
  });

  it('general mode allows explicit active non-general slug', () => {
    const opts = { scope: 'general', list: ['test-112'], activeSlug: 'focus-999', activeSlugFromRoute: true };
    expect(isSessionSlugAllowedByScope('focus-999', opts)).toBe(true);
    expect(isSessionSlugAllowedByScope('', opts)).toBe(true);
  });

  it('general mode blocks stale active non-general slug outside session routes', () => {
    const opts = { scope: 'general', list: ['test-112'], activeSlug: 'focus-999', activeSlugFromRoute: false };
    expect(isSessionSlugAllowedByScope('focus-999', opts)).toBe(false);
    expect(isSessionSlugAllowedByScope('', opts)).toBe(true);
  });

  it('general mode rejects non-active non-general slugs', () => {
    const opts = { scope: 'general', list: ['test-112'], activeSlug: 'focus-999', activeSlugFromRoute: true };
    expect(isSessionSlugAllowedByScope('test-112', opts)).toBe(false);
    expect(isSessionSlugAllowedByScope('other-777', opts)).toBe(false);
  });

  it('validates block windows and caps oversized scans', () => {
    const result = resolveValidatedSessionScanWindow({
      slug: 'edge',
      blockLimits: { start: 100, end: 999999 },
      resolvedWindow: { fromBlock: 100, toBlock: 999999 },
      maxBlockRange: 10000,
    });
    expect(result.ok).toBe(true);
    expect(result.fromBlock).toBe(100);
    expect(result.toBlock).toBe(10099);
    expect(result.wasCapped).toBe(true);
    expect(result.maxBlockRange).toBe(10000);
  });

  it('treats missing/nullable blockLimits.end as open-ended and falls back to resolvedWindow.toBlock', () => {
    const openEnded = resolveValidatedSessionScanWindow({
      slug: '',
      blockLimits: { start: 10, end: null },
      resolvedWindow: { fromBlock: 10, toBlock: 20 },
    });
    expect(openEnded.ok).toBe(true);
    expect(openEnded.fromBlock).toBe(10);
    expect(openEnded.requestedToBlock).toBe(20);
    expect(openEnded.toBlock).toBe(20);
    expect(openEnded.wasCapped).toBe(false);
  });

  it('falls back to resolvedWindow.fromBlock when blockLimits.start is missing', () => {
    const missingStart = resolveValidatedSessionScanWindow({
      slug: '',
      blockLimits: { end: 20 },
      resolvedWindow: { fromBlock: 10, toBlock: 20 },
    });
    expect(missingStart.ok).toBe(true);
    expect(missingStart.fromBlock).toBe(10);
    expect(missingStart.toBlock).toBe(20);
  });

  it('rejects scans when both blockLimits.start and resolvedWindow.fromBlock are missing', () => {
    const missingStartEverywhere = resolveValidatedSessionScanWindow({
      slug: '',
      blockLimits: { end: 20 },
      resolvedWindow: { toBlock: 20 },
    });
    expect(missingStartEverywhere.ok).toBe(false);
    expect(missingStartEverywhere.code).toBe('invalid_block_limits');
  });

  it('rejects inverted block limits before scan starts', () => {
    const inverted = resolveValidatedSessionScanWindow({
      slug: 'edge',
      blockLimits: { start: 30, end: 10 },
      resolvedWindow: { fromBlock: 30, toBlock: 30 },
    });
    expect(inverted.ok).toBe(false);
    expect(inverted.code).toBe('invalid_block_limits');
  });

  it('uses the default max scan range constant when no override is provided', () => {
    const result = resolveValidatedSessionScanWindow({
      slug: 'edge',
      blockLimits: { start: 1, end: 1000000 },
      resolvedWindow: { fromBlock: 1, toBlock: 1000000 },
    });
    expect(result.ok).toBe(true);
    expect(result.toBlock).toBe(DEFAULT_SESSION_SCAN_MAX_BLOCK_RANGE);
    expect(result.maxBlockRange).toBe(DEFAULT_SESSION_SCAN_MAX_BLOCK_RANGE);
  });

  it('reads REACT_APP_SESSION_SCAN_MAX_BLOCK_RANGE when provided', () => {
    process.env.REACT_APP_SESSION_SCAN_MAX_BLOCK_RANGE = '75000';

    expect(readSessionScanMaxBlockRange()).toBe(75000);

    const result = resolveValidatedSessionScanWindow({
      slug: 'edge',
      blockLimits: { start: 1, end: 1000000 },
      resolvedWindow: { fromBlock: 1, toBlock: 1000000 },
    });

    expect(result.ok).toBe(true);
    expect(result.toBlock).toBe(75000);
    expect(result.maxBlockRange).toBe(75000);
  });
});
