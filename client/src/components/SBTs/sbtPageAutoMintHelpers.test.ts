import {
  buildLegacySbtRouteCredentialCleanPath,
  buildSbtPageAutoMintStorageKey,
  buildSbtPageAutoMintCleanPath,
  clearLegacySbtRouteCredential,
  collectAutoMintPairsFromSearchParams,
  decodeSbtPageInviteInput,
  hasSbtPageAutoMintFlag,
  normalizeSbtInviteCode,
  resolveLegacySbtRouteCredential,
  resolveSbtPageUrlAutoMintIntent,
  sanitizeSbtPageMintedTokensOverride,
  shouldRunSbtPagePropListAutoMint,
  shouldRunSbtPagePropPasswordAutoMint,
} from './sbtPageAutoMintHelpers';

describe('sbtPageAutoMintHelpers', () => {
  afterEach(() => {
    clearLegacySbtRouteCredential('0xabc');
  });

  it('keeps legacy path credentials in memory while producing an identity-only path', () => {
    expect(resolveLegacySbtRouteCredential({ sbtAddress: '0xAbC', routeCredential: 'claim-secret' })).toBe(
      'claim-secret',
    );
    expect(resolveLegacySbtRouteCredential({ sbtAddress: '0xabc' })).toBe('claim-secret');
    expect(
      buildLegacySbtRouteCredentialCleanPath('https://app.example/ce/sbt/0xabc/claim-secret?session=alpha#claim'),
    ).toBe('/ce/sbt/0xabc?session=alpha#claim');

    clearLegacySbtRouteCredential('0xABC');
    expect(resolveLegacySbtRouteCredential({ sbtAddress: '0xabc' })).toBeNull();
  });

  it('normalizes minted-token overrides', () => {
    expect(sanitizeSbtPageMintedTokensOverride(3)).toBe('3');
    expect(sanitizeSbtPageMintedTokensOverride('4')).toBe('4');
    expect(sanitizeSbtPageMintedTokensOverride(-1)).toBeNull();
    expect(sanitizeSbtPageMintedTokensOverride(1.5)).toBeNull();
    expect(sanitizeSbtPageMintedTokensOverride(null)).toBeNull();
  });

  it('normalizes invite inputs and decodes invite payloads', () => {
    expect(normalizeSbtInviteCode(' inv:abc ')).toBe('abc');
    expect(normalizeSbtInviteCode('INV: abc ')).toBe('abc');
    expect(normalizeSbtInviteCode('invite:def')).toBe('def');
    expect(normalizeSbtInviteCode(' raw ')).toBe('raw');
    expect(normalizeSbtInviteCode('')).toBe('');

    const decodeInvite = jest.fn((code: string) => (code === 'abc' ? { nonce: 'nonce-1', signature: 'sig-1' } : null));
    expect(decodeSbtPageInviteInput(' inv:abc ', decodeInvite)).toEqual({
      inviteCode: 'abc',
      nonce: 'nonce-1',
      signature: 'sig-1',
    });
    expect(decodeInvite).toHaveBeenCalledWith('abc');
    expect(decodeSbtPageInviteInput('', decodeInvite)).toBeNull();
    expect(decodeSbtPageInviteInput('raw', decodeInvite)).toBeNull();
  });

  it('collects legacy and scoped auto-mint query pairs', () => {
    expect(collectAutoMintPairsFromSearchParams('sbt=0xA&gp=secret&auto=1')).toEqual({
      globalAuto: true,
      pairs: [{ sbt: '0xA', gp: 'secret', inv: null, auto: true }],
    });
    expect(collectAutoMintPairsFromSearchParams('sbt1=0xA&gp1=a&auto1=1&sbt2=0xB&inv2=b')).toEqual({
      globalAuto: false,
      pairs: [
        { sbt: '0xA', gp: 'a', inv: null, auto: true },
        { sbt: '0xB', gp: null, inv: 'b', auto: false },
      ],
    });
  });

  it('detects and cleans auto-mint URL parameters', () => {
    expect(hasSbtPageAutoMintFlag('?sbt=0xA&auto=1')).toBe(true);
    expect(hasSbtPageAutoMintFlag('sbt1=0xA&auto1=1')).toBe(true);
    expect(hasSbtPageAutoMintFlag('sbt=0xA&auto=0')).toBe(false);
    expect(
      buildSbtPageAutoMintCleanPath('https://example.test/sbt/0xA?auto=1&sbt=0xA&gp=secret&keep=yes#section'),
    ).toBe('/sbt/0xA?keep=yes');
    expect(buildSbtPageAutoMintCleanPath('https://example.test/sbt/0xA?auto1=1&sbt1=0xA&gp1=secret&keep=yes')).toBe(
      '/sbt/0xA?keep=yes',
    );
    expect(buildSbtPageAutoMintCleanPath('https://example.test/sbt/0xA?sbt=0xA&gp=secret&inv=invite&keep=yes')).toBe(
      '/sbt/0xA?sbt=0xA&keep=yes',
    );
    expect(buildSbtPageAutoMintCleanPath('https://example.test/sbt/0xA?keep=yes')).toBeNull();
  });

  it('resolves URL auto-mint intent from scoped and legacy query params', () => {
    const propsIn = {
      SBTAddress: '0x00000000000000000000000000000000000000AA',
      loginComplete: true,
    };
    const state = { userHasSBT: false, mintingStatus: 'idle' };

    expect(
      resolveSbtPageUrlAutoMintIntent({
        propsIn,
        chainId: 84532,
        sessionSlug: 'edge',
        searchRaw: '?sbt=0x00000000000000000000000000000000000000aa&gp=secret&auto=1',
        state,
      }),
    ).toEqual({
      currentSbtAddress: propsIn.SBTAddress,
      targetInvite: null,
      targetPassword: 'secret',
      targetCode: 'secret',
      shouldAttemptAuto: true,
      autoKey: 'autoMint:84532:edge:0x00000000000000000000000000000000000000aa:success',
    });
    expect(
      resolveSbtPageUrlAutoMintIntent({
        propsIn,
        searchRaw: '?inv=invite-code&auto=1',
        state,
      })?.targetInvite,
    ).toBe('invite-code');
    expect(
      resolveSbtPageUrlAutoMintIntent({
        propsIn,
        searchRaw: '?sbt=0x00000000000000000000000000000000000000bb&gp=secret&auto=1',
        state,
      })?.shouldAttemptAuto,
    ).toBe(false);
    expect(
      resolveSbtPageUrlAutoMintIntent({
        propsIn,
        chainId: 84532,
        sessionSlug: 'edge',
        searchRaw: '?sbt=0x00000000000000000000000000000000000000aa&gp=secret&auto=1',
        sessionStorageRef: {
          getItem: (key) =>
            key === 'autoMint:84532:edge:0x00000000000000000000000000000000000000aa:success' ? 'done' : null,
        },
        state,
      })?.shouldAttemptAuto,
    ).toBe(false);
    expect(
      resolveSbtPageUrlAutoMintIntent({
        propsIn: { ...propsIn, loginComplete: false },
        searchRaw: '?sbt=0x00000000000000000000000000000000000000aa&gp=secret&auto=1',
        state,
      })?.shouldAttemptAuto,
    ).toBe(false);
    expect(
      resolveSbtPageUrlAutoMintIntent({
        propsIn: {},
        searchRaw: '?auto=1',
        state,
      }),
    ).toBeNull();
  });

  it('scopes URL auto-mint completion by chain, session, and SBT address', () => {
    const sbtAddress = '0x00000000000000000000000000000000000000aa';
    const doneKey = buildSbtPageAutoMintStorageKey({
      chainId: 84532,
      sessionSlug: 'edge',
      sbtAddress,
    });
    const state = { userHasSBT: false, mintingStatus: 'idle' };
    const searchRaw = `?sbt=${sbtAddress}&auto=1`;
    const sessionStorageRef = {
      getItem: (key: string) => (key === doneKey ? 'done' : null),
    };

    expect(doneKey).toBe('autoMint:84532:edge:0x00000000000000000000000000000000000000aa:success');
    expect(
      resolveSbtPageUrlAutoMintIntent({
        propsIn: { SBTAddress: sbtAddress, loginComplete: true },
        chainId: 84532,
        sessionSlug: 'edge',
        searchRaw,
        sessionStorageRef,
        state,
      })?.shouldAttemptAuto,
    ).toBe(false);
    expect(
      resolveSbtPageUrlAutoMintIntent({
        propsIn: { SBTAddress: sbtAddress, loginComplete: true },
        chainId: 84532,
        sessionSlug: 'beta',
        searchRaw,
        sessionStorageRef,
        state,
      })?.shouldAttemptAuto,
    ).toBe(true);
    expect(
      resolveSbtPageUrlAutoMintIntent({
        propsIn: { SBTAddress: sbtAddress, loginComplete: true },
        chainId: 8453,
        sessionSlug: 'edge',
        searchRaw,
        sessionStorageRef,
        state,
      })?.shouldAttemptAuto,
    ).toBe(true);
  });

  it('preserves array SBTAddress resolution for URL auto-mint intent', () => {
    expect(
      resolveSbtPageUrlAutoMintIntent({
        propsIn: {
          SBTAddress: [{ sbtAddress: '0x00000000000000000000000000000000000000AA' }],
          loginComplete: true,
        },
        searchRaw: '?sbt=0x00000000000000000000000000000000000000aa&auto=1',
        state: { userHasSBT: false, mintingStatus: 'idle' },
      }),
    ).toEqual(
      expect.objectContaining({
        currentSbtAddress: '0x00000000000000000000000000000000000000AA',
        shouldAttemptAuto: true,
      }),
    );
  });

  it('resolves prop-driven auto-mint gates', () => {
    expect(
      shouldRunSbtPagePropPasswordAutoMint({
        autoMintingMode: true,
        mintingStatus: 'idle',
        sbtInfo: { address: '0xSBT' },
        sbtMintPassword: 'secret',
        userHasSBT: false,
      }),
    ).toBe(true);
    expect(
      shouldRunSbtPagePropPasswordAutoMint({
        autoMintingMode: true,
        mintingStatus: 'pending',
        sbtInfo: { address: '0xSBT' },
        sbtMintPassword: 'secret',
        userHasSBT: false,
      }),
    ).toBe(false);
    expect(
      shouldRunSbtPagePropPasswordAutoMint({
        autoMintingMode: true,
        mintingStatus: 'idle',
        sbtInfo: { address: '0xSBT' },
        sbtMintPassword: ['secret'],
        userHasSBT: false,
      }),
    ).toBe(false);
    expect(
      shouldRunSbtPagePropPasswordAutoMint({
        autoMintingMode: true,
        mintingStatus: 'idle',
        sbtInfo: null,
        sbtMintPassword: 'secret',
        userHasSBT: false,
      }),
    ).toBe(false);
    expect(
      shouldRunSbtPagePropListAutoMint({
        autoMintingMode: true,
        hasAttemptedListMint: false,
        loginComplete: true,
        sbtMintPassword: ['one', 'two'],
      }),
    ).toBe(true);
    expect(
      shouldRunSbtPagePropListAutoMint({
        autoMintingMode: true,
        hasAttemptedListMint: true,
        loginComplete: true,
        sbtMintPassword: ['one', 'two'],
      }),
    ).toBe(false);
    expect(
      shouldRunSbtPagePropListAutoMint({
        autoMintingMode: true,
        hasAttemptedListMint: false,
        loginComplete: true,
        sbtMintPassword: 'one',
      }),
    ).toBe(false);
  });
});
