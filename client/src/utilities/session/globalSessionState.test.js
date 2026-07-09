import {
  DEFAULT_GLOBAL_SESSION_SCOPE,
  normalizeGlobalSessionSelection,
  readStoredGlobalSessionSelection,
  resolveScopedSessionSlugsFromSelection,
  writeGlobalSessionSelection,
} from './globalSessionState.js';
import { CE_SESSION_SCAN_SCOPE, CE_SESSION_SCAN_SLUGS } from '../../variables/appConfig.js';

const ORIGINAL_RUNTIME_SCOPE = globalThis.CE_SESSION_SCAN_SCOPE;
const ORIGINAL_RUNTIME_SLUGS = globalThis.CE_SESSION_SCAN_SLUGS;

describe('globalSessionState helpers', () => {
  beforeEach(() => {
    localStorage.clear();
    try {
      delete globalThis.CE_SESSION_SCAN_SCOPE;
    } catch (_) {}
    try {
      delete globalThis.CE_SESSION_SCAN_SLUGS;
    } catch (_) {}
  });

  it('derives a concrete primary session from list mode when needed without losing the full list', () => {
    expect(
      normalizeGlobalSessionSelection({
        selectedSessionScope: 'list',
        selectedSessionSlugs: ['general', 'edge', 'debate'],
      }),
    ).toEqual({
      primarySessionSlug: 'edge',
      primarySessionExplicit: false,
      activeSessionSlug: 'edge',
      selectedSessionScope: 'list',
      selectedSessionSlugs: ['', 'edge', 'debate'],
    });
  });

  it('preserves an explicit general primary session instead of re-deriving it from list scope', () => {
    expect(
      normalizeGlobalSessionSelection({
        primarySessionSlug: '',
        selectedSessionScope: 'list',
        selectedSessionSlugs: ['general', 'edge'],
      }),
    ).toEqual({
      primarySessionSlug: '',
      primarySessionExplicit: true,
      activeSessionSlug: '',
      selectedSessionScope: 'list',
      selectedSessionSlugs: ['', 'edge'],
    });
  });

  it('re-derives the primary session when list scope excludes general', () => {
    expect(
      normalizeGlobalSessionSelection({
        primarySessionSlug: '',
        selectedSessionScope: 'list',
        selectedSessionSlugs: ['edge', 'debate'],
      }),
    ).toEqual({
      primarySessionSlug: 'edge',
      primarySessionExplicit: false,
      activeSessionSlug: 'edge',
      selectedSessionScope: 'list',
      selectedSessionSlugs: ['edge', 'debate'],
    });
  });

  it('persists the canonical selection and mirrors legacy scan-scope keys', () => {
    const selection = writeGlobalSessionSelection({
      primarySessionSlug: 'debate',
      selectedSessionScope: 'list',
      selectedSessionSlugs: ['general', 'edge'],
    });

    expect(selection).toEqual({
      primarySessionSlug: 'debate',
      primarySessionExplicit: true,
      activeSessionSlug: 'debate',
      selectedSessionScope: 'list',
      selectedSessionSlugs: ['', 'edge'],
    });
    expect(readStoredGlobalSessionSelection()).toEqual(selection);
    expect(localStorage.getItem('ce:sessionScanScope')).toBe('list');
    expect(localStorage.getItem('ce:sessionScanSlugs')).toBe(JSON.stringify(['', 'edge']));
  });

  it('preserves the stored scope and selected-session list when only the primary session changes', () => {
    writeGlobalSessionSelection({
      primarySessionSlug: 'edge',
      selectedSessionScope: 'list',
      selectedSessionSlugs: ['general', 'alpha'],
    });

    const selection = writeGlobalSessionSelection({
      primarySessionSlug: 'debate',
    });

    expect(selection).toEqual({
      primarySessionSlug: 'debate',
      primarySessionExplicit: true,
      activeSessionSlug: 'debate',
      selectedSessionScope: 'list',
      selectedSessionSlugs: ['', 'alpha'],
    });
    expect(readStoredGlobalSessionSelection()).toEqual(selection);
  });

  it('preserves an explicit stored primary when only scan-scope settings change', () => {
    writeGlobalSessionSelection({
      primarySessionSlug: 'edge',
      selectedSessionScope: 'active',
      selectedSessionSlugs: [],
    });

    const selection = writeGlobalSessionSelection({
      selectedSessionScope: 'list',
      selectedSessionSlugs: ['general', 'rxc'],
    });

    expect(selection).toEqual({
      primarySessionSlug: 'edge',
      primarySessionExplicit: true,
      activeSessionSlug: 'edge',
      selectedSessionScope: 'list',
      selectedSessionSlugs: ['', 'rxc'],
    });
  });

  it('allows callers to clear an explicit primary so list scope can re-derive it', () => {
    writeGlobalSessionSelection({
      primarySessionSlug: 'edge',
      selectedSessionScope: 'active',
      selectedSessionSlugs: [],
    });

    const selection = writeGlobalSessionSelection({
      primarySessionExplicit: false,
      selectedSessionScope: 'list',
      selectedSessionSlugs: ['general', 'rxc'],
    });

    expect(selection).toEqual({
      primarySessionSlug: 'rxc',
      primarySessionExplicit: false,
      activeSessionSlug: 'rxc',
      selectedSessionScope: 'list',
      selectedSessionSlugs: ['', 'rxc'],
    });
  });

  it('mirrors the saved selection into legacy runtime scan globals', () => {
    globalThis.CE_SESSION_SCAN_SCOPE = 'active';
    globalThis.CE_SESSION_SCAN_SLUGS = ['edge'];

    const selection = writeGlobalSessionSelection({
      primarySessionSlug: 'edge',
      selectedSessionScope: 'list',
      selectedSessionSlugs: ['general', 'alpha'],
    });

    expect(globalThis.CE_SESSION_SCAN_SCOPE).toBe('list');
    expect(globalThis.CE_SESSION_SCAN_SLUGS).toEqual(selection.selectedSessionSlugs);
  });

  it('falls back to appConfig scan defaults when nothing is persisted yet', () => {
    expect(readStoredGlobalSessionSelection()).toEqual(
      expect.objectContaining({
        primarySessionExplicit: false,
        selectedSessionScope: DEFAULT_GLOBAL_SESSION_SCOPE,
        selectedSessionSlugs: normalizeGlobalSessionSelection({
          selectedSessionScope: CE_SESSION_SCAN_SCOPE,
          selectedSessionSlugs: CE_SESSION_SCAN_SLUGS,
        }).selectedSessionSlugs,
      }),
    );
  });

  it('resolves scope slugs without collapsing list mode into a single session', () => {
    expect(
      resolveScopedSessionSlugsFromSelection({
        primarySessionSlug: 'edge',
        selectedSessionScope: 'all',
        selectedSessionSlugs: ['general', 'alpha'],
      }),
    ).toEqual([]);

    expect(
      resolveScopedSessionSlugsFromSelection({
        primarySessionSlug: 'edge',
        selectedSessionScope: 'active',
        selectedSessionSlugs: ['general', 'alpha'],
      }),
    ).toEqual(['edge']);

    expect(
      resolveScopedSessionSlugsFromSelection({
        primarySessionSlug: 'edge',
        selectedSessionScope: 'general',
        selectedSessionSlugs: ['general', 'alpha'],
      }),
    ).toEqual(['']);

    expect(
      resolveScopedSessionSlugsFromSelection({
        primarySessionSlug: '',
        selectedSessionScope: 'list',
        selectedSessionSlugs: ['general', 'alpha'],
      }),
    ).toEqual(['', 'alpha']);
  });

  it('falls back to the default scope when given an invalid mode', () => {
    expect(
      normalizeGlobalSessionSelection({
        primarySessionSlug: '',
        selectedSessionScope: 'not-real',
        selectedSessionSlugs: [],
      }).selectedSessionScope,
    ).toBe(DEFAULT_GLOBAL_SESSION_SCOPE);
  });

  afterAll(() => {
    if (typeof ORIGINAL_RUNTIME_SCOPE === 'undefined') {
      try {
        delete globalThis.CE_SESSION_SCAN_SCOPE;
      } catch (_) {}
    } else {
      globalThis.CE_SESSION_SCAN_SCOPE = ORIGINAL_RUNTIME_SCOPE;
    }
    if (typeof ORIGINAL_RUNTIME_SLUGS === 'undefined') {
      try {
        delete globalThis.CE_SESSION_SCAN_SLUGS;
      } catch (_) {}
    } else {
      globalThis.CE_SESSION_SCAN_SLUGS = ORIGINAL_RUNTIME_SLUGS;
    }
  });
});
