import {
  filterSessionUniverseEntriesByDemoVisibility,
  getCustomDemoSessionEntries,
  mergeSessionUniverseEntriesBySlug,
  resolveSessionUniverseEntrySlug,
} from './sbtSessionUniverse.js';

describe('sbtSessionUniverse', () => {
  const demoSessionMap = {
    general: { slug: '', sessionName: 'Context Engine' },
    legacyReading: { slug: 'reading-group', sessionName: 'Reading Group' },
    rxc: { slug: 'rxc', sessionName: 'Weyl v. Yarvin Debate' },
    legacyEdge: { slug: 'legacy-edge', sessionName: 'Edge 2025' },
    test: { slug: 'test', sessionName: 'test' },
    customUniverseSession: { slug: 'custom-universe-session', sessionName: 'Custom Universe Session' },
  };

  it('resolves demo entry keys through canonical demo-session aliases when cfg.slug is missing', () => {
    expect(
      resolveSessionUniverseEntrySlug(['legacyReading', { sessionName: 'Reading Group' }], { demoSessionMap }),
    ).toBe('reading-group');

    expect(
      resolveSessionUniverseEntrySlug(['customUniverseSession', { sessionName: 'Custom Universe Session' }], {
        demoSessionMap,
      }),
    ).toBe('custom-universe-session');
  });

  it('hides baseline demo placeholders by canonical slug even when fallback entries only expose alias keys', () => {
    const entries = [
      ['general', {}],
      ['legacyReading', {}],
      ['legacyEdge', {}],
      ['alpha', { slug: 'alpha' }],
      ['customUniverseSession', {}],
    ];

    expect(filterSessionUniverseEntriesByDemoVisibility(entries, false, { demoSessionMap })).toEqual([
      ['general', {}],
      ['legacyReading', {}],
      ['legacyEdge', {}],
      ['alpha', { slug: 'alpha' }],
      ['customUniverseSession', {}],
    ]);
  });

  it('keeps only non-baseline demo universe entries when registry-backed universe mode is active', () => {
    expect(
      getCustomDemoSessionEntries(
        {
          general: { slug: '' },
          legacyReading: { slug: 'reading-group' },
          legacyEdge: { slug: 'legacy-edge' },
          customUniverseSession: { slug: 'custom-universe-session' },
        },
        { baselineDemoUniverseSlugs: new Set(['', 'reading-group', 'legacy-edge']) },
      ),
    ).toEqual([['customUniverseSession', { slug: 'custom-universe-session' }]]);
  });

  it('dedupes registry and demo universe entries by canonical slug', () => {
    const merged = mergeSessionUniverseEntriesBySlug(
      [[['custom-universe-session', { sessionName: 'Registry Custom Session' }]], [['customUniverseSession', {}]]],
      { demoSessionMap },
    );

    expect(merged).toEqual([['custom-universe-session', { sessionName: 'Registry Custom Session' }]]);
  });
});
