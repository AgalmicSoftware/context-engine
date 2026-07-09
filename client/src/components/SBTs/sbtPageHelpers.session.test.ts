import {
  buildSbtPageDetailsPayload,
  buildSbtPageExplorerUrl,
  buildSbtPageLoadInfoRequestKey,
  buildSbtPageLoadInfoStartLogContext,
  buildSbtPageOpenMintAutoJoinUrl,
  buildSbtPageSessionSbtAddresses,
  buildSbtPageSessionSbtAddressesMemoState,
  findNestedInteractiveElement,
  getBlockExplorerBaseUrl,
  getExplicitSbtPageSessionSlug,
  hasExplicitSbtPageSessionSlugProp,
  resolveSbtPageEffectiveSessionSlug,
  resolveSbtPageSessionDisplayConfig,
  resolveSbtPageSessionDisplayLabel,
  resolveSbtPageSessionSlugFromInfo,
  resolveSbtPageSessionSbtAddressCache,
} from './sbtPageHelpers';

describe('sbtPageHelpers session helpers', () => {
  it('builds session SBT address lists and cache keys from page context', () => {
    const result = buildSbtPageSessionSbtAddresses({
      stateSbtAddress: '0x00000000000000000000000000000000000000AA',
      routeSbtAddress: '0x00000000000000000000000000000000000000bb',
      propSBTAddress: { sbtAddress: '0x00000000000000000000000000000000000000cc' },
      sessionSlug: 'Example',
      sessionConfig: {
        defaultFeaturedSBTs: [
          '0x00000000000000000000000000000000000000d1',
          '0x00000000000000000000000000000000000000AA',
          'not-an-address',
        ],
        featured_SBTs_LIST: ['0x00000000000000000000000000000000000000E2', ''],
      },
    });

    expect(result.addresses).toEqual([
      '0x00000000000000000000000000000000000000aa',
      '0x00000000000000000000000000000000000000bb',
      '0x00000000000000000000000000000000000000cc',
      '0x00000000000000000000000000000000000000d1',
      '0x00000000000000000000000000000000000000e2',
    ]);
    expect(result.cacheKey).toBe(
      [
        '0x00000000000000000000000000000000000000aa',
        '0x00000000000000000000000000000000000000bb',
        '0x00000000000000000000000000000000000000cc',
        'example',
        '0x00000000000000000000000000000000000000d1,0x00000000000000000000000000000000000000aa,not-an-address',
        '0x00000000000000000000000000000000000000e2',
      ].join('|'),
    );

    const previousAddresses = ['0x00000000000000000000000000000000000000ff'];
    const reused = resolveSbtPageSessionSbtAddressCache({
      addresses: result.addresses,
      cacheKey: result.cacheKey,
      previousAddresses,
      previousCacheKey: result.cacheKey,
    });
    expect(reused).toEqual({
      addresses: previousAddresses,
      cacheKey: result.cacheKey,
      reusedPrevious: true,
    });
    expect(reused.addresses).toBe(previousAddresses);

    const refreshed = resolveSbtPageSessionSbtAddressCache({
      addresses: result.addresses,
      cacheKey: result.cacheKey,
      previousAddresses,
      previousCacheKey: 'old-cache-key',
    });
    expect(refreshed).toEqual({
      addresses: result.addresses,
      cacheKey: result.cacheKey,
      reusedPrevious: false,
    });
    expect(refreshed.addresses).toBe(result.addresses);

    const memoState = buildSbtPageSessionSbtAddressesMemoState({
      stateSbtAddress: '0x00000000000000000000000000000000000000AA',
      routeSbtAddress: '0x00000000000000000000000000000000000000bb',
      propSBTAddress: { sbtAddress: '0x00000000000000000000000000000000000000cc' },
      sessionSlug: 'Example',
      sessionConfig: {
        defaultFeaturedSBTs: [
          '0x00000000000000000000000000000000000000d1',
          '0x00000000000000000000000000000000000000AA',
          'not-an-address',
        ],
        featured_SBTs_LIST: ['0x00000000000000000000000000000000000000E2', ''],
      },
      previousAddresses,
      previousCacheKey: result.cacheKey,
    });
    expect(memoState).toEqual({
      addresses: previousAddresses,
      cacheKey: result.cacheKey,
      reusedPrevious: true,
    });
    expect(memoState.addresses).toBe(previousAddresses);
  });

  it('builds load-SBT-info request keys from address, session, network, account, and cache revision', () => {
    expect(
      buildSbtPageLoadInfoRequestKey({
        account: '0x00000000000000000000000000000000000000Ff',
        activeSlug: ' Example Session ',
        network: { id: '11155420' },
        sbtAddressInput: [{ nope: 'x' }, { sbtAddress: '0x00000000000000000000000000000000000000Aa' }],
        sbtCacheRevision: '7',
      }),
    ).toBe(
      [
        '0x00000000000000000000000000000000000000aa',
        'Example Session',
        '11155420',
        '0x00000000000000000000000000000000000000ff',
        '7',
      ].join('|'),
    );

    expect(
      buildSbtPageLoadInfoRequestKey({
        account: null,
        activeSlug: null,
        network: { id: 'bad' },
        sbtAddressInput: null,
        sbtCacheRevision: 'bad',
      }),
    ).toBe('||0||0');
    expect(
      buildSbtPageLoadInfoStartLogContext({
        account: '0x00000000000000000000000000000000000000Ff',
        addrLower: '0x00000000000000000000000000000000000000aa',
        forceEventFetch: true,
        initialSlug: 'example',
        network: { id: 84532 },
        normalizedExplicitSlug: null,
        preferCountsOnly: false,
        sbtAddressOriginalCase: '0x00000000000000000000000000000000000000AA',
      }),
    ).toEqual({
      address: '0x00000000000000000000000000000000000000AA',
      addrLower: '0x00000000000000000000000000000000000000aa',
      explicitSlug: null,
      initialSlug: 'example',
      forceEventFetch: true,
      preferCountsOnly: false,
      account: '0x00000000000000000000000000000000000000ff',
      networkId: 84532,
    });
  });

  it('builds open-mint auto-join URLs only for ungated SBTs', () => {
    const sbtAddress = '0x00000000000000000000000000000000000000a1';
    const baseArgs = {
      basePath: '/ce/',
      origin: 'http://localhost/',
      propSBTAddress: sbtAddress,
      sbtInfo: { hasPasswordMint: false },
      sessionSlug: 'edge',
    };

    expect(buildSbtPageOpenMintAutoJoinUrl(baseArgs)).toBe(
      `http://localhost/ce/session/edge?sbt=${encodeURIComponent(sbtAddress)}&auto=1`,
    );
    expect(
      buildSbtPageOpenMintAutoJoinUrl({
        ...baseArgs,
        addressOverride: '0x00000000000000000000000000000000000000b2',
      }),
    ).toBe('http://localhost/ce/session/edge?sbt=0x00000000000000000000000000000000000000b2&auto=1');
    expect(
      buildSbtPageOpenMintAutoJoinUrl({
        ...baseArgs,
        sessionSlug: 'general',
      }),
    ).toBe(`http://localhost/ce/session?sbt=${encodeURIComponent(sbtAddress)}&auto=1`);
    expect(buildSbtPageOpenMintAutoJoinUrl({ ...baseArgs, sbtInfo: { hasPasswordMint: true } })).toBe('');
    expect(buildSbtPageOpenMintAutoJoinUrl({ ...baseArgs, hasInviteMint: true })).toBe('');
    expect(buildSbtPageOpenMintAutoJoinUrl({ ...baseArgs, hasGroupPasswordMint: true })).toBe('');
    expect(buildSbtPageOpenMintAutoJoinUrl({ ...baseArgs, groupPasswordHash: '0x123' })).toBe('');
    expect(buildSbtPageOpenMintAutoJoinUrl({ ...baseArgs, propSBTAddress: 'bad-address' })).toBe('');
    expect(buildSbtPageOpenMintAutoJoinUrl({ ...baseArgs, origin: '' })).toBe('');
  });

  it('resolves explicit SBT page session slugs from props and metadata', () => {
    expect(hasExplicitSbtPageSessionSlugProp({ sessionSlug: 'alpha' })).toBe(true);
    expect(hasExplicitSbtPageSessionSlugProp({ slug: 'beta' })).toBe(true);
    expect(hasExplicitSbtPageSessionSlugProp({})).toBe(false);
    expect(getExplicitSbtPageSessionSlug({ sessionSlug: 'alpha', slug: 'beta' })).toBe('alpha');
    expect(getExplicitSbtPageSessionSlug({ slug: 'beta' })).toBe('beta');
    expect(getExplicitSbtPageSessionSlug({})).toBeNull();
    expect(
      resolveSbtPageSessionSlugFromInfo({
        sessionSlug: 'beta',
        sessionSlugExplicit: false,
      }),
    ).toBeNull();
    expect(
      resolveSbtPageSessionSlugFromInfo({
        sessionSlug: 'beta',
        sessionSlugExplicit: true,
      }),
    ).toBe('beta');
    expect(resolveSbtPageSessionSlugFromInfo({ sessionSlug: 'beta' })).toBe('beta');
    expect(resolveSbtPageSessionSlugFromInfo({})).toBeNull();
    expect(
      resolveSbtPageEffectiveSessionSlug({
        props: { sessionSlug: 'explicit' },
        resolvedSessionSlug: 'resolved',
        sbtInfo: { sessionName: 'Demo' },
      }),
    ).toBe('explicit');
    expect(
      resolveSbtPageEffectiveSessionSlug({
        props: {},
        resolvedSessionSlug: 'resolved',
        sbtInfo: { sessionName: 'Demo' },
      }),
    ).toBe('resolved');
    expect(
      resolveSbtPageEffectiveSessionSlug({
        props: {},
        resolvedSessionSlug: null,
        sbtInfo: { sessionSlug: 'from-info' },
      }),
    ).toBe('from-info');
    expect(
      resolveSbtPageEffectiveSessionSlug({
        props: { slug: 'fallback' },
        resolvedSessionSlug: null,
        sbtInfo: {},
      }),
    ).toBe('fallback');
  });

  it('resolves SBTPage session display config and labels', () => {
    const readSessionConfig = jest.fn((slug: string) =>
      slug === 'known-session' ? { sessionName: 'Known Session' } : null,
    );
    const readDemoSessionConfig = jest.fn(() => ({ sessionName: 'Demo Session' }));

    expect(
      resolveSbtPageSessionDisplayConfig({
        getDemoSessionConfigBySlug: readDemoSessionConfig,
        getSessionConfigBySlugOrDefault: readSessionConfig,
        sessionSlugRaw: 'known-session',
      }),
    ).toEqual({ sessionName: 'Known Session' });
    expect(readSessionConfig).toHaveBeenCalledWith('known-session');
    expect(readDemoSessionConfig).not.toHaveBeenCalled();

    expect(
      resolveSbtPageSessionDisplayConfig({
        getDemoSessionConfigBySlug: readDemoSessionConfig,
        getSessionConfigBySlugOrDefault: readSessionConfig,
        sessionSlugRaw: 'missing',
      }),
    ).toEqual({ sessionName: 'Demo Session' });
    expect(readDemoSessionConfig).toHaveBeenCalledWith('missing', { allowDemoFallback: true });

    expect(
      resolveSbtPageSessionDisplayConfig({
        getSessionConfigBySlugOrDefault: () => {
          throw new Error('broken');
        },
        sessionSlugRaw: 'known-session',
      }),
    ).toBeNull();
    expect(
      resolveSbtPageSessionDisplayLabel({
        sessionConfig: { sessionName: '  Label Name  ' },
        sessionSlugRaw: 'known-session',
      }),
    ).toBe('Label Name');
    expect(
      resolveSbtPageSessionDisplayLabel({
        sessionConfig: {},
        sessionSlugRaw: 'known-session',
      }),
    ).toBe('known-session');
    expect(
      resolveSbtPageSessionDisplayLabel({
        sessionConfig: {},
        sessionSlugRaw: '',
      }),
    ).toBe('General');
  });

  it('resolves block explorer urls and nested interactive targets', () => {
    expect(
      getBlockExplorerBaseUrl({
        blockExplorers: { default: { url: 'https://explorer.example/' } },
      }),
    ).toBe('https://explorer.example');
    expect(getBlockExplorerBaseUrl(null)).toBe('');
    expect(
      buildSbtPageExplorerUrl({
        network: { blockExplorers: { default: { url: 'https://explorer.example/' } } },
        value: '0xabc',
        kind: 'address',
      }),
    ).toBe('https://explorer.example/address/0xabc');
    expect(buildSbtPageExplorerUrl({ value: '0xtx', kind: 'tx' })).toBe('https://sepolia.etherscan.io/tx/0xtx');
    expect(
      buildSbtPageDetailsPayload({
        sbtInfo: { name: 'Alpha', address: '0xOld' },
        address: '0xNew',
      }),
    ).toEqual({
      name: 'Alpha',
      address: '0xNew',
    });

    const closest = jest.fn(() => 'button-node');
    expect(findNestedInteractiveElement({ closest } as unknown as EventTarget)).toBe('button-node');
    expect(closest).toHaveBeenCalledWith('button, a, input, [role="button"]');
    expect(findNestedInteractiveElement(null)).toBeNull();
  });
});
