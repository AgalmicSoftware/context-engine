import {
  asSBTsPageFeaturedProgress,
  asSBTsPageFeaturedSbt,
  asSBTsPageSessionConfig,
  buildSBTsPageCacheFeaturedCardModel,
  buildSBTsPageBooleanTogglePatch,
  buildSBTsPageFeaturedEntryModel,
  buildSBTsPageFeaturedProgressSignature,
  buildSBTsPageInitialState,
  dedupeSBTsPageAddressListCaseInsensitive,
  dedupeSBTsPageSessionSlugList,
  hasSBTsPageExplicitSessionSlug,
  hasSBTsPageAuthoritativeSessionSlug,
  hasSBTsPageOwn,
  isSBTsPageRecord,
  isSBTsPageSessionAutoFeatureEnabled,
  normalizeSBTsPageFeaturedCardImageUrl,
  normalizeSBTsPageFeaturedEntries,
  resolveSBTsPageInitialCreateGroupSessionSlug,
  resolveSBTsPageAutoFeatureBySessionSlug,
  resolveSBTsPageDisplaySessionConfig,
  resolveSBTsPageDisplaySessionLists,
  resolveSBTsPageFeaturedSbtSessionSlug,
  resolveSBTsPageReferrerSessionSlug,
  resolveSBTsPageCacheFeaturedCardLinkStyle,
} from './sbtOverviewPageHelpers';

describe('sbtOverviewPageHelpers', () => {
  it('coerces SBT overview records by shape', () => {
    expect(isSBTsPageRecord({ a: 1 })).toBe(true);
    expect(isSBTsPageRecord(null)).toBe(false);
    expect(asSBTsPageSessionConfig({ slug: 'edge' })).toEqual({ slug: 'edge' });
    expect(asSBTsPageSessionConfig('edge')).toBeNull();
    expect(asSBTsPageFeaturedProgress({ currentBlock: 1 })).toEqual({ currentBlock: 1 });
    expect(asSBTsPageFeaturedSbt({ sbtAddress: '0xA' })).toEqual({ sbtAddress: '0xA' });
  });

  it('builds SBTsPage initial state and boolean toggle patches', () => {
    const hasCachedCreateSbtForm = jest.fn(() => true);

    expect(
      resolveSBTsPageInitialCreateGroupSessionSlug({
        activeSessionSlug: 'active',
        sessionConfig: { slug: 'config' },
        sessionSlug: ' direct ',
      }),
    ).toBe('direct');
    expect(
      resolveSBTsPageInitialCreateGroupSessionSlug({
        activeSessionSlug: ' active ',
        sessionConfig: { slug: ' config ' },
        sessionSlug: '',
      }),
    ).toBe('config');
    expect(
      buildSBTsPageInitialState({
        activeSessionSlug: ' active ',
        hasCachedCreateSbtForm,
        sessionConfig: null,
        sessionSlug: '',
      }),
    ).toEqual({
      showSBTsList: false,
      showCreateGroup: true,
    });
    expect(hasCachedCreateSbtForm).toHaveBeenCalledWith({
      sessionSlug: 'active',
      migrateLegacyToSessionKey: true,
      clearInvalid: true,
    });
    expect(buildSBTsPageInitialState()).toEqual({
      showSBTsList: false,
      showCreateGroup: false,
    });
    expect(
      buildSBTsPageBooleanTogglePatch({
        state: { showSBTsList: false },
        stateKey: 'showSBTsList',
      }),
    ).toEqual({ showSBTsList: true });
    expect(
      buildSBTsPageBooleanTogglePatch({
        state: { showCreateGroup: 'open' },
        stateKey: 'showCreateGroup',
      }),
    ).toEqual({ showCreateGroup: false });
    expect(resolveSBTsPageCacheFeaturedCardLinkStyle()).toEqual({
      minWidth: '240px',
      maxWidth: '240px',
      textDecoration: 'none',
      cursor: 'pointer',
    });
  });

  it('normalizes featured card image URLs', () => {
    const txId = 'b'.repeat(43);

    expect(normalizeSBTsPageFeaturedCardImageUrl('ipfs://asset/path')).toBe('https://ipfs.io/ipfs/asset/path');
    expect(normalizeSBTsPageFeaturedCardImageUrl(txId)).toBe(`https://arweave.net/${txId}`);
    expect(normalizeSBTsPageFeaturedCardImageUrl('')).toBe('');
  });

  it('builds cache-backed featured card models', () => {
    expect(
      buildSBTsPageCacheFeaturedCardModel({
        defaultImage: '/default.png',
        effectiveSessionSlug: 'fallback',
        entry: {
          address: ' 0xABC ',
          sessionSlug: 'Edge',
          sbt: {
            sbtInfo: {
              hasPasswordMint: true,
              image: 'ipfs://asset/path',
              mintingEndTime: 200,
              name: 'Named Badge',
            },
          },
        },
        getDisplayName: (info) => (isSBTsPageRecord(info) ? info.name : ''),
        getShortAddress: (address) => `short:${address}`,
        index: 3,
        nowSeconds: 100,
        sbtLabel: 'Group',
      }),
    ).toMatchObject({
      imageUrl: 'https://ipfs.io/ipfs/asset/path',
      isMintingActive: true,
      isPasswordLocked: true,
      resolvedSessionSlug: 'Edge',
      sbtAddress: '0xABC',
      sbtKey: 'Edge:0xabc',
      sbtName: 'Named Badge',
      shortenedAddress: 'short:0xABC',
    });
    expect(
      buildSBTsPageCacheFeaturedCardModel({
        defaultImage: '/default.png',
        entry: {
          address: '',
          sbt: {
            sbtInfo: {
              mintingEndTime: 50,
            },
          },
        },
        index: 7,
        nowSeconds: 100,
        sbtLabel: 'Group',
      }),
    ).toMatchObject({
      imageUrl: '/default.png',
      isMintingActive: false,
      isPasswordLocked: false,
      resolvedSessionSlug: '',
      sbtKey: 'general:7',
      sbtName: 'Unnamed Group',
      shortenedAddress: '',
    });
  });

  it('builds featured entry models for embedded SBT cards', () => {
    expect(
      buildSBTsPageFeaturedEntryModel({
        effectiveSessionSlug: 'fallback',
        entry: {
          address: '0xABC',
          sessionSlug: 'Edge',
        },
        index: 5,
      }),
    ).toEqual({
      resolvedSessionSlug: 'Edge',
      sbtAddress: '0xABC',
      sbtKey: 'Edge:0xabc',
    });
    expect(
      buildSBTsPageFeaturedEntryModel({
        effectiveSessionSlug: 'fallback',
        entry: {},
        index: 5,
      }),
    ).toEqual({
      resolvedSessionSlug: 'fallback',
      sbtAddress: undefined,
      sbtKey: 'fallback:5',
    });
  });

  it('resolves display session configs and list fields through injected readers', () => {
    const getSessionConfigBySlug = jest.fn((slug: string) =>
      slug === 'Edge' ? { featured_SBTs_LIST: ['0xA'], ignored_SBTs_LIST: 'bad', slug } : null,
    );
    const getSessionConfigBySlugOrDefault = jest.fn(() => null);
    const getDemoSessionConfigBySlug = jest.fn((slug: string) =>
      slug === ''
        ? { featured_SBTs_LIST: ['0xDefault'], ignored_SBTs_LIST: ['0xIgnoreDefault'] }
        : { featured_SBTs_LIST: ['0xDemo'], ignored_SBTs_LIST: ['0xIgnoreDemo'], slug },
    );

    expect(
      resolveSBTsPageDisplaySessionConfig({
        getDemoSessionConfigBySlug,
        getSessionConfigBySlug,
        getSessionConfigBySlugOrDefault,
        slugIn: ' Edge ',
      }),
    ).toEqual({
      featured_SBTs_LIST: ['0xA'],
      ignored_SBTs_LIST: 'bad',
      slug: 'Edge',
    });
    expect(
      resolveSBTsPageDisplaySessionConfig({
        getDemoSessionConfigBySlug,
        getSessionConfigBySlug,
        getSessionConfigBySlugOrDefault,
        slugIn: '',
      }),
    ).toEqual({
      featured_SBTs_LIST: ['0xDefault'],
      ignored_SBTs_LIST: ['0xIgnoreDefault'],
    });
    expect(getDemoSessionConfigBySlug).toHaveBeenCalledWith('', { allowDemoFallback: true });

    expect(
      resolveSBTsPageDisplaySessionLists({
        getDemoSessionConfigBySlug,
        getSessionConfigBySlug,
        slugIn: 'missing',
      }),
    ).toEqual({
      featured_SBTs_LIST: ['0xDemo'],
      ignored_SBTs_LIST: ['0xIgnoreDemo'],
    });
    expect(
      resolveSBTsPageDisplaySessionLists({
        sessionConfig: {
          featured_SBTs_LIST: 'bad',
          ignored_SBTs_LIST: ['0xB'],
        },
      }),
    ).toEqual({
      featured_SBTs_LIST: [],
      ignored_SBTs_LIST: ['0xB'],
    });
  });

  it('deduplicates featured address and session slug lists', () => {
    expect(dedupeSBTsPageAddressListCaseInsensitive([' 0xA ', '0xa', '', '0xB'])).toEqual(['0xA', '0xB']);
    expect(dedupeSBTsPageSessionSlugList([' Edge ', 'edge', '', 'Other'])).toEqual(['Edge', 'edge', '', 'Other']);
  });

  it('builds progress signatures for deduped slugs', () => {
    expect(
      buildSBTsPageFeaturedProgressSignature(
        {
          edge: {
            currentBlock: 10,
            latestBlock: 20,
            displayCurrentBlock: 11,
            liveCurrentBlock: 12,
            lastBlock: 9,
            scanInProgress: true,
            deferred: false,
          },
        },
        ['edge', 'edge', 'missing'],
      ),
    ).toBe('edge:10:20:11:12:9:1:0|missing:idle');
  });

  it('resolves auto-feature precedence from session metadata', () => {
    expect(
      resolveSBTsPageAutoFeatureBySessionSlug({
        autoFeatureSBTsBySessionSlug: false,
        autoFeatureSBTsWithFeaturedSbtTags: true,
      }),
    ).toBe(false);
    expect(
      resolveSBTsPageAutoFeatureBySessionSlug({
        autoFeatureSBTsWithFeaturedSbtTags: false,
      }),
    ).toBe(false);
    expect(resolveSBTsPageAutoFeatureBySessionSlug(null)).toBeUndefined();
    expect(
      isSBTsPageSessionAutoFeatureEnabled({
        autoFeatureSBTsBySessionSlug: true,
        autoFeatureSBTsWithFeaturedSbtTags: false,
      }),
    ).toBe(true);
    expect(
      isSBTsPageSessionAutoFeatureEnabled({
        autoFeatureSBTsBySessionSlug: false,
      }),
    ).toBe(false);
  });

  it('resolves featured SBT session slugs by metadata authority', () => {
    expect(hasSBTsPageOwn({ sessionSlug: 'edge' }, 'sessionSlug')).toBe(true);
    expect(hasSBTsPageAuthoritativeSessionSlug({ sessionSlug: 'edge' })).toBe(true);
    expect(hasSBTsPageAuthoritativeSessionSlug({ sessionSlug: 'edge', sessionSlugExplicit: false })).toBe(false);
    expect(hasSBTsPageExplicitSessionSlug({ sessionSlug: 'edge' })).toBe(false);
    expect(hasSBTsPageExplicitSessionSlug({ sessionSlug: 'edge', sessionSlugExplicit: true })).toBe(true);
    expect(
      resolveSBTsPageFeaturedSbtSessionSlug({
        sessionSlug: 'top',
        sbtInfo: { sessionSlug: 'info', sessionSlugExplicit: true },
      }),
    ).toBe('info');
    expect(
      resolveSBTsPageFeaturedSbtSessionSlug({
        sessionSlug: 'top',
        sessionSlugExplicit: true,
        sbtInfo: { slug: 'legacy' },
      }),
    ).toBe('top');
    expect(
      resolveSBTsPageFeaturedSbtSessionSlug({
        sbtInfo: { slug: 'legacy' },
      }),
    ).toBe('legacy');
    expect(
      resolveSBTsPageFeaturedSbtSessionSlug({
        sessionSlug: 'alpha',
        sessionSlugExplicit: false,
        sbtInfo: { sessionSlug: 'alpha', sessionSlugExplicit: false },
      }),
    ).toBeNull();
    expect(
      resolveSBTsPageFeaturedSbtSessionSlug(
        {
          sbtInfo: { sessionSlug: 'legacy-compatible' },
        },
        { requireExplicitSessionSlug: true },
      ),
    ).toBeNull();
    expect(
      resolveSBTsPageFeaturedSbtSessionSlug(
        {
          sbtInfo: { slug: 'legacy' },
        },
        { requireExplicitSessionSlug: true },
      ),
    ).toBeNull();
    expect(
      resolveSBTsPageFeaturedSbtSessionSlug(
        {
          sbtInfo: { sessionSlug: 'explicit', sessionSlugExplicit: true },
        },
        { requireExplicitSessionSlug: true },
      ),
    ).toBe('explicit');
    expect(resolveSBTsPageFeaturedSbtSessionSlug(null)).toBeNull();
  });

  it('normalizes featured entries for cache-backed card lookups', () => {
    expect(
      normalizeSBTsPageFeaturedEntries([
        { address: ' 0xABC ', sessionSlug: ' Edge ' },
        { address: '', sessionSlug: 'missing' },
        null,
        { address: '0xDEF' },
      ]),
    ).toEqual([
      { address: '0xABC', lowerAddress: '0xabc', sessionSlug: 'Edge' },
      { address: '0xDEF', lowerAddress: '0xdef', sessionSlug: '' },
    ]);
    expect(normalizeSBTsPageFeaturedEntries('bad')).toEqual([]);
  });

  it('resolves session slugs from referrer paths', () => {
    expect(resolveSBTsPageReferrerSessionSlug('https://example.test/session/Edge/questions')).toBe('Edge');
    expect(resolveSBTsPageReferrerSessionSlug('/SESSION/general?x=1')).toBe('');
    expect(resolveSBTsPageReferrerSessionSlug('/questions')).toBe('');
  });
});
