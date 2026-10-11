import {
  buildCommunitySessionCatalog,
  classifyCommunitySession,
  countCommunitySessions,
  filterCommunitySessions,
  createCommunitySessionFilters,
  isCommunitySessionDateUnavailable,
} from './communitySessionStats';

const centralized = {
  slug: 'cloud',
  sessionName: 'Cloud session',
  corsWorkerUrl: 'https://session.example',
  sessionModeProfile: { authority: { mode: 'worker_canonical' } },
};
const decentralized = {
  slug: 'chain',
  sessionName: 'Chain session',
  sessionModeProfile: { authority: { mode: 'evm_registry_canonical' } },
};

describe('Community session directory', () => {
  it('counts each known authority type and leaves missing authority unspecified', () => {
    const catalog = buildCommunitySessionCatalog({
      entries: [
        ['cloud', centralized],
        ['chain', decentralized],
        ['unknown', { slug: 'unknown', corsWorkerUrl: 'https://session.example' }],
      ],
    });
    expect(countCommunitySessions(catalog)).toEqual({ total: 3, centralized: 1, decentralized: 1, unknown: 1 });
    expect(catalog.map(({ name }) => name)).toEqual(['Chain session', 'Cloud session', 'unknown']);
  });

  it('does not mistake a Worker proxy or wallet support for canonical authority', () => {
    expect(
      classifyCommunitySession({
        ...decentralized,
        corsWorkerUrl: 'https://session.example',
      }),
    ).toBe('decentralized');
    expect(
      classifyCommunitySession({
        ...centralized,
        networkChainId: 11155420,
        contracts: { surveys: { address: '0x1111111111111111111111111111111111111111' } },
      }),
    ).toBe('centralized');
    expect(
      classifyCommunitySession({
        networkChainId: 11155420,
        __registry: { sessionId: '0x00112233445566778899aabbccddeeff', registryChainId: 11155420 },
      }),
    ).toBe('decentralized');
  });

  it('deduplicates canonical slugs and prefers configured routes over stale cached Workers', () => {
    const catalog = buildCommunitySessionCatalog({
      entries: [
        ['general', { ...decentralized, slug: '' }],
        ['', { ...decentralized, slug: '' }],
        ['chain', decentralized],
      ],
      workerRecords: [
        {
          authorityMode: 'worker_canonical',
          slug: 'chain',
          canonicalConfig: { ...centralized, slug: 'chain' },
          workerOrigin: 'https://stale.example',
        },
      ],
    });
    expect(catalog).toHaveLength(2);
    expect(catalog.find(({ slug }) => slug === '')?.href).toBe('/session/general');
    expect(catalog.find(({ slug }) => slug === 'chain')).toMatchObject({
      kind: 'decentralized',
      href: '/session/chain',
    });
  });

  it('includes previously discovered Worker sessions with the origin in their session link', () => {
    const catalog = buildCommunitySessionCatalog({
      workerRecords: [
        {
          authorityMode: 'worker_canonical',
          slug: 'cloud',
          canonicalConfig: centralized,
          workerOrigin: 'https://session.example',
        },
        { slug: 'proxy-only', config: { corsWorkerUrl: 'https://proxy.example' } },
      ],
    });
    expect(catalog).toEqual([
      expect.objectContaining({
        slug: 'cloud',
        name: 'Cloud session',
        kind: 'centralized',
        href: '/session/cloud?worker=https%3A%2F%2Fsession.example',
      }),
    ]);
  });

  it('omits unresolved configs and reserved slugs without inventing a General session', () => {
    expect(
      buildCommunitySessionCatalog({
        entries: [
          ['missing', null],
          ['pending', { __unresolved: true }],
          ['__proto__', { slug: '__proto__' }],
        ],
      }),
    ).toEqual([]);
    expect(countCommunitySessions([])).toEqual({ total: 0, centralized: 0, decentralized: 0, unknown: 0 });
  });

  it('does not pass malformed discovery URLs into links', () => {
    const [session] = buildCommunitySessionCatalog({
      entries: [['cloud', { ...centralized, corsWorkerUrl: 'javascript:alert(1)' }]],
    });
    expect(session.href).toBe('/session/cloud');
  });

  it('reads creation, activity, and admins from the canonical authority without using cache refresh times', () => {
    const catalog = buildCommunitySessionCatalog({
      entries: [
        [
          'chain',
          {
            ...decentralized,
            adminAddress: '0xwrong',
            createdAt: '2020-01-01',
            __registry: {
              adminAddress: '0x1111111111111111111111111111111111111111',
              createdAt: 1767225600,
              updatedAt: 1767398400,
            },
          },
        ],
        [
          'cloud',
          {
            ...centralized,
            adminAddresses: ['0x2222222222222222222222222222222222222222'],
            createdAt: '2026-02-01T00:00:00Z',
            updatedAt: '2026-02-03T12:00:00Z',
            cachedAtMs: 1999999999999,
          },
        ],
        ['unknown', { slug: 'unknown', cachedAtMs: 1999999999999, createdAt: 'invalid', updatedAt: -1 }],
      ],
    });
    expect(catalog.find(({ slug }) => slug === 'chain')).toMatchObject({
      createdAt: 1767225600000,
      lastActivityAt: 1767398400000,
      adminAddresses: ['0x1111111111111111111111111111111111111111'],
    });
    expect(catalog.find(({ slug }) => slug === 'cloud')).toMatchObject({
      createdAt: Date.parse('2026-02-01T00:00:00Z'),
      lastActivityAt: Date.parse('2026-02-03T12:00:00Z'),
      adminAddresses: ['0x2222222222222222222222222222222222222222'],
    });
    expect(catalog.find(({ slug }) => slug === 'unknown')).toMatchObject({
      createdAt: null,
      lastActivityAt: null,
      adminAddresses: [],
    });
  });

  it('combines authority, inclusive calendar dates, and case-insensitive admin filters', () => {
    const catalog = buildCommunitySessionCatalog({
      entries: [
        [
          'cloud',
          {
            ...centralized,
            adminAddress: '0xaabb111111111111111111111111111111111111',
            createdAt: new Date(2026, 1, 1, 0).getTime(),
            updatedAt: new Date(2026, 1, 3, 23, 59, 59).getTime(),
          },
        ],
        ['chain', { ...decentralized, __registry: { createdAt: new Date(2026, 1, 1).getTime() } }],
        ['unknown', { slug: 'unknown' }],
      ],
    });
    const defaults = createCommunitySessionFilters();
    expect(filterCommunitySessions(catalog, defaults)).toHaveLength(3);
    expect(
      filterCommunitySessions(catalog, {
        ...defaults,
        kind: 'centralized',
        createdFrom: '2026-02-01',
        createdTo: '2026-02-01',
        activityFrom: '2026-02-03',
        activityTo: '2026-02-03',
        adminAddress: ' 0xAABB ',
      }).map(({ slug }) => slug),
    ).toEqual(['cloud']);
    // Dated rows outside the bounds drop out; the undated row stays (see below).
    const slugsFor = (filters: typeof defaults) => filterCommunitySessions(catalog, filters).map(({ slug }) => slug);
    expect(slugsFor({ ...defaults, createdFrom: '2026-02-02' })).toEqual(['unknown']);
    expect(slugsFor({ ...defaults, activityTo: '2026-01-31' })).toEqual(['unknown']);
    expect(slugsFor({ ...defaults, createdFrom: '2026-02-03', createdTo: '2026-02-01' })).toEqual(['unknown']);
    expect(filterCommunitySessions(catalog, { ...defaults, kind: 'decentralized' }).map(({ slug }) => slug)).toEqual([
      'chain',
    ]);
  });

  it('keeps undated Worker sessions under date bounds and marks them date unavailable', () => {
    const catalog = buildCommunitySessionCatalog({
      entries: [
        ['cloud', centralized],
        ['chain', { ...decentralized, __registry: { createdAt: new Date(2026, 1, 1).getTime() } }],
      ],
    });
    const defaults = createCommunitySessionFilters();
    const bounded = { ...defaults, createdFrom: '2026-03-01' };
    const rows = filterCommunitySessions(catalog, bounded);

    expect(rows.map(({ slug }) => slug)).toEqual(['cloud']);
    expect(countCommunitySessions(rows)).toMatchObject({ centralized: 1, decentralized: 0 });
    expect(isCommunitySessionDateUnavailable(rows[0], bounded)).toBe(true);
    expect(isCommunitySessionDateUnavailable(rows[0], { ...defaults, kind: 'centralized' })).toBe(false);
    const chain = catalog.find(({ slug }) => slug === 'chain')!;
    // The registry session's activity date falls back to its creation date.
    expect(isCommunitySessionDateUnavailable(chain, { ...defaults, createdTo: '2026-03-01' })).toBe(false);
    expect(isCommunitySessionDateUnavailable(chain, { ...defaults, activityFrom: '2026-01-01' })).toBe(false);
  });
});
