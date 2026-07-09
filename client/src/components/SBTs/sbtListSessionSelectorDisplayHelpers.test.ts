import {
  buildSbtListSessionRouteHref,
  buildSbtListSessionSelectorOptions,
  resolveSbtListSessionSelectorSummarySlugs,
} from './sbtListSessionSelectorDisplayHelpers';
import { SBT_LIST_NO_SESSION_UNIVERSE_SLUG } from './sbtListSessionUniverseHelpers';

describe('sbtListSessionSelectorDisplayHelpers', () => {
  it('builds session route hrefs from registry ids, slugs, and general fallback', () => {
    expect(
      buildSbtListSessionRouteHref({
        getSessionConfig: () => ({
          __registry: {
            sessionIdHex: '0xabc123',
          },
        }),
        publicBasePath: '/app',
        slug: 'alpha',
      }),
    ).toBe('/app/session/0xabc123');

    expect(
      buildSbtListSessionRouteHref({
        publicBasePath: '/app',
        slug: 'alpha session',
      }),
    ).toBe('/app/session/alpha%20session');

    expect(
      buildSbtListSessionRouteHref({
        publicBasePath: '',
        slug: '',
      }),
    ).toBe('/session');

    expect(
      buildSbtListSessionRouteHref({
        publicBasePath: '/app',
        slug: SBT_LIST_NO_SESSION_UNIVERSE_SLUG,
      }),
    ).toBe('');
  });

  it('builds selector chip options from display state without event callbacks', () => {
    const options = buildSbtListSessionSelectorOptions({
      activeSessionSlug: 'alpha',
      buildSessionRouteHref: (slug) => (slug ? `/session/${slug}` : '/session'),
      chipLoadingStatusBySlug: {
        beta: {
          chipRemainingText: '10 blocks',
          hasLatest: true,
          progressPct: 50,
        },
      },
      chipProgressVisibilityBySlug: {
        beta: true,
      },
      displayedSessionUniverseSlugs: ['alpha', 'beta', ''],
      isListModeScopeEnabled: false,
      labelForSessionSlug: (slug) => (slug ? `Session ${slug}` : 'General'),
      sessionChipStateBySlug: {
        alpha: { isLoaded: true },
        beta: { isLoaded: false },
      },
    });

    expect(options).toEqual([
      expect.objectContaining({
        active: true,
        chipTestId: 'session-chip-alpha',
        general: false,
        href: '/session/alpha',
        key: 'alpha',
        label: 'Session alpha',
        loaded: true,
        rowTestId: 'session-chip-row-alpha',
        selected: true,
        showOpen: true,
        showProgress: false,
        slug: 'alpha',
      }),
      expect.objectContaining({
        active: false,
        href: '/session/beta',
        indeterminate: false,
        label: 'Session beta',
        loaded: false,
        progressText: '10 blocks',
        selected: false,
        showProgress: true,
        slug: 'beta',
      }),
      expect.objectContaining({
        active: false,
        general: true,
        href: '/session',
        key: 'general',
        label: 'General',
        openTestId: 'session-chip-open-general',
        selected: false,
        slug: '',
      }),
    ]);
  });

  it('uses selected-scope selection and summary slugs for list mode', () => {
    expect(
      buildSbtListSessionSelectorOptions({
        activeSessionSlug: 'alpha',
        displayedSessionUniverseSlugs: ['alpha', 'beta'],
        isListModeScopeEnabled: true,
        selectedSessionUniverseSlugs: new Set(['beta']),
      }),
    ).toEqual([
      expect.objectContaining({
        active: false,
        selected: false,
        slug: 'alpha',
      }),
      expect.objectContaining({
        active: false,
        selected: true,
        slug: 'beta',
      }),
    ]);

    expect(
      resolveSbtListSessionSelectorSummarySlugs({
        isListModeScopeEnabled: true,
        listSlug: 'alpha',
        selectedSessionUniverseSlugs: ['beta', 'gamma'],
      }),
    ).toEqual(['beta', 'gamma']);

    expect(
      resolveSbtListSessionSelectorSummarySlugs({
        isListModeScopeEnabled: false,
        listSlug: 'alpha',
        selectedSessionUniverseSlugs: ['beta', 'gamma'],
      }),
    ).toEqual(['alpha']);
  });
});
