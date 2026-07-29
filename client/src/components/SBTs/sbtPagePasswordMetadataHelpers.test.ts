import {
  applySbtPageHistorySummaryFallback,
  appendSbtPageBookmark,
  appendSbtPageTransactionHash,
  buildSessionRoutePath,
  buildSbtPageDirectMetadataContext,
  collectAutoMintPairsFromSearchParams,
  decodeSbtPageJsonDataUri,
  buildSbtPageAddressListSignatureMemoState,
  buildSbtPageAddressChangeResetMintUiPatch,
  buildSbtPageAddressOccurrenceMap,
  buildSbtPageAdminInviteSuccessPatch,
  buildSbtPageAutoMintCleanPath,
  buildSbtPageBookmarkedPatch,
  buildSbtPageBooleanTogglePatch,
  buildSbtPageBurnFailurePatch,
  buildSbtPageBurnPendingPatch,
  buildSbtPageBurnSearchInputPatch,
  buildSbtPageBurnSearchResultPatch,
  buildSbtPageBurnSuccessPatch,
  buildSbtPageCachedPasswordsPatch,
  buildSbtPageClaimCountdownCompletePatch,
  buildSbtPageClaimCountdownTickPatch,
  buildSbtPageCopiedAddressPatch,
  buildSbtPageCopiedErrorPatch,
  buildSbtPageDetailsPayload,
  buildSbtPageDocModalContentPatch,
  buildSbtPageDocModalErrorPatch,
  buildSbtPageDocModalOpenPatch,
  buildSbtPageDocModalResetPatch,
  buildSbtPageEncryptedEnvelopeDecryptKey,
  buildSbtPageEncryptedEnvelopeFingerprint,
  buildSbtPageErrorPatch,
  buildSbtPageExportFormatPatch,
  buildSbtPageExplorerUrl,
  buildSbtPageHolderListSignature,
  buildSbtPageInitialState,
  buildSbtPageIncludePreviousPasswordsPatch,
  buildSbtPageNetworkUpdatePatch,
  buildSbtPageLoadInfoLoadingStartPatch,
  buildSbtPageLoadInfoRequestKey,
  buildSbtPageLoadInfoStartLogContext,
  buildSbtPageIntervalIdPatch,
  buildSbtPageLoadingMintersBurnersPatch,
  buildSbtPageLogScanProgressPatch,
  buildSbtPageLocalBurnSuccessPatch,
  buildSbtPageLocalMintSuccessPatch,
  buildSbtPageModalFilteredMintedUsersPatch,
  buildSbtPageMintFailurePatch,
  buildSbtPageMintedModalInitialFilterPatch,
  buildSbtPageMintedModalVisibilityPatch,
  buildSbtPageMintCountdownPatch,
  buildSbtPageMintPendingPatch,
  buildSbtPageMintSuccessPatch,
  buildSbtPageMiniPasswordInputPatch,
  buildSbtPageNextFilteredHolderRows,
  buildSbtPageNetHoldersMemoState,
  buildSbtPageOpenMintAutoJoinUrl,
  buildSbtPagePasswordExportFile,
  buildSbtPagePasswordExportRows,
  buildSbtPagePasswordInviteLink,
  buildSbtPagePasswordInputValuePatch,
  buildSbtPageMintPasswordClearPatch,
  buildSbtPageMintPasswordPrefillPatch,
  buildSbtPagePasswordClaimStartSuccessPatch,
  buildSbtPagePasswordGenerationCountPatch,
  buildSbtPagePasswordMintInputPatch,
  buildSbtPageAccountDerivedStatePatch,
  buildSbtPagePrimaryMetadataStatePatch,
  buildSbtPageRefreshOptions,
  buildSbtPageRelevantInfoPatch,
  buildSbtPageResolvedSessionSlugPatch,
  buildSbtPageSbtInfoPatch,
  buildSbtPageSessionSbtAddresses,
  buildSbtPageSessionSbtAddressesMemoState,
  coerceSbtPageEpochSeconds,
  coerceSbtPageStringArrayValue,
  computeSbtPageNetCounts,
  computeSbtPageNetHoldersList,
  deriveSbtPageCacheNetKey,
  decodeSbtPageInviteInput,
  encodeSbtPageGroupPasswordForUrl,
  expandSbtPageAddressListFromCountMap,
  findSbtPageCachedEntryAcrossGroups,
  findNestedInteractiveElement,
  generateSbtPageRandomPasswords,
  getBlockExplorerBaseUrl,
  getCurrentSbtAddressInfo,
  getDisplayImageFallbackCandidateCount,
  getDisplayImageRenderState,
  getDisplayImageUrlCandidates,
  getErrorMessage,
  getExplicitSbtPageSessionSlug,
  getNextDisplayImageFallbackState,
  hasSbtPageAutoMintFlag,
  hasExplicitSbtPageSessionSlugProp,
  isRecord,
  isSbtPageImageLikeUri,
  mergeSbtPageBurnEvidenceIntoPreservedHolderState,
  normalizeSbtPageLoadInfoOptions,
  normalizeSbtInviteCode,
  normalizeSbtPageCanonicalMetadataHref,
  normalizeSbtPageHistorySummary,
  needsSbtPageDirectMetadataHydration,
  needsSbtPageTokenUriFields,
  readSbtPageCacheBySlug,
  readSbtPageQueuedOrStoredLocalStorageJson,
  serializeSbtPageLocalStorageJsonWrite,
  resolveSbtPageLocalStorageJsonWriteDecision,
  resolveSbtPageEffectiveSessionSlug,
  resolveSbtPageMetadataHydrationMode,
  resolveSbtPageMiniActionFailureState,
  resolveSbtPageMiniMintFlowDisplayState,
  resolveSbtPageMiniMintState,
  resolveSbtPageOwnerLookupFallbackDecision,
  resolveSbtPageOwnerLookupTokenCount,
  resolveSbtPagePasswordExportControlsState,
  resolveSbtPagePasswordExportSelection,
  resolveSbtPagePasswordInventoryDisplayState,
  resolveSbtPageCachedGroupPasswordHash,
  resolveSbtPageGroupPasswordMintState,
  resolveSbtPageSessionSlugFromInfo,
  resolveSbtPageActiveBlockTimeMs,
  resolveSbtPageActiveChainId,
  resolveSbtPageAddressLinkState,
  resolveSbtPageChainMetadataReadNeeds,
  resolveSbtPageCopyableErrorText,
  resolveSbtPageCountdownDisplaySeconds,
  resolveSbtPageRecoveryCacheChainId,
  resolveSbtPageSessionSbtAddressCache,
  resolveSbtPageMintEndDisplayState,
  resolveSbtPageShouldRefreshCounts,
  resolveSbtPageUrlAutoMintIntent,
  resolveSbtPageUserAdminStatus,
  resolveSbtPageSessionDisplayConfig,
  resolveSbtPageSessionDisplayLabel,
  resolveSbtAddress,
  resolveSbtAddressString,
  resolveSbtChainId,
  resolveDisplayImageHref,
  resolveSbtPageTokenMetadataHref,
  sanitizeSbtPageMintedTokensOverride,
  shouldRunSbtPagePropListAutoMint,
  shouldRunSbtPagePropPasswordAutoMint,
  normalizeSbtPageCountMap,
  toStringList,
} from './sbtPageHelpers';

type ArweaveRuntimeGlobals = typeof globalThis & {
  CE_ARWEAVE_AR_IO_URL?: unknown;
  CE_ARWEAVE_DIRECT_TO_AR_IO?: unknown;
  CE_ARWEAVE_GATEWAY_URL?: unknown;
  CE_ARWEAVE_GATEWAYS?: unknown;
};

// SBT page helper coverage for password export, token metadata, display images, holder maps, and auto-mint helpers.
describe('sbtPage password and metadata helpers', () => {
  const arweaveGlobals = globalThis as ArweaveRuntimeGlobals;
  const originalArweaveGlobals = {
    CE_ARWEAVE_AR_IO_URL: arweaveGlobals.CE_ARWEAVE_AR_IO_URL,
    CE_ARWEAVE_DIRECT_TO_AR_IO: arweaveGlobals.CE_ARWEAVE_DIRECT_TO_AR_IO,
    CE_ARWEAVE_GATEWAY_URL: arweaveGlobals.CE_ARWEAVE_GATEWAY_URL,
    CE_ARWEAVE_GATEWAYS: arweaveGlobals.CE_ARWEAVE_GATEWAYS,
  };

  afterEach(() => {
    arweaveGlobals.CE_ARWEAVE_AR_IO_URL = originalArweaveGlobals.CE_ARWEAVE_AR_IO_URL;
    arweaveGlobals.CE_ARWEAVE_DIRECT_TO_AR_IO = originalArweaveGlobals.CE_ARWEAVE_DIRECT_TO_AR_IO;
    arweaveGlobals.CE_ARWEAVE_GATEWAY_URL = originalArweaveGlobals.CE_ARWEAVE_GATEWAY_URL;
    arweaveGlobals.CE_ARWEAVE_GATEWAYS = originalArweaveGlobals.CE_ARWEAVE_GATEWAYS;
  });

  it('resolves password export selection from cached and generated codes', () => {
    expect(
      resolveSbtPagePasswordExportSelection({
        cachedPasswords: ['cached-one'],
        adminGeneratedPasswords: [],
        includePreviousPasswords: false,
      }),
    ).toMatchObject({
      onlyCachedPasswords: true,
      effectiveIncludePreviousPasswords: true,
      passwordsToExport: ['cached-one'],
    });
    expect(
      resolveSbtPagePasswordExportSelection({
        cachedPasswords: ['cached-one'],
        adminGeneratedPasswords: ['admin-one'],
        includePreviousPasswords: false,
      }).passwordsToExport,
    ).toEqual(['admin-one']);
    expect(
      resolveSbtPagePasswordExportSelection({
        cachedPasswords: ['cached-one'],
        adminGeneratedPasswords: ['admin-one'],
        includePreviousPasswords: true,
      }).passwordsToExport,
    ).toEqual(['cached-one', 'admin-one']);
    expect(
      resolveSbtPagePasswordExportSelection({
        cachedPasswords: 'bad',
        adminGeneratedPasswords: [2, null, 'admin-two'],
      }).adminGeneratedPasswordList,
    ).toEqual(['2', '', 'admin-two']);
    expect(
      resolveSbtPagePasswordExportControlsState({
        adminGeneratedPasswordList: ['admin-one'],
        effectiveIncludePreviousPasswords: true,
        onlyCachedPasswords: false,
      }),
    ).toEqual({
      effectiveIncludePreviousPasswordsChecked: true,
      renderIncludePreviousCheckbox: true,
      showCachedPasswordsIncludedNote: false,
    });
    expect(
      resolveSbtPagePasswordExportControlsState({
        adminGeneratedPasswordList: [],
        effectiveIncludePreviousPasswords: true,
        onlyCachedPasswords: true,
      }),
    ).toEqual({
      effectiveIncludePreviousPasswordsChecked: true,
      renderIncludePreviousCheckbox: false,
      showCachedPasswordsIncludedNote: true,
    });
    expect(
      resolveSbtPagePasswordExportControlsState({
        adminGeneratedPasswordList: [],
        effectiveIncludePreviousPasswords: false,
        onlyCachedPasswords: false,
      }),
    ).toEqual({
      effectiveIncludePreviousPasswordsChecked: false,
      renderIncludePreviousCheckbox: false,
      showCachedPasswordsIncludedNote: false,
    });
    expect(
      resolveSbtPagePasswordInventoryDisplayState({
        combinedPasswords: ['cached-one'],
        showNoMoreInvites: false,
        showPasswordGen: true,
      }),
    ).toEqual({
      shouldRenderGeneratedPasswordList: true,
      shouldRenderNoMoreInvitesEmptyState: false,
      shouldRenderPasswordGenerationSection: true,
      shouldRenderPreviousPasswordsSection: false,
    });
    expect(
      resolveSbtPagePasswordInventoryDisplayState({
        combinedPasswords: ['cached-one'],
        showNoMoreInvites: true,
        showPasswordGen: false,
      }),
    ).toEqual({
      shouldRenderGeneratedPasswordList: false,
      shouldRenderNoMoreInvitesEmptyState: false,
      shouldRenderPasswordGenerationSection: false,
      shouldRenderPreviousPasswordsSection: true,
    });
    expect(
      resolveSbtPagePasswordInventoryDisplayState({
        combinedPasswords: [],
        showNoMoreInvites: true,
        showPasswordGen: false,
      }),
    ).toEqual({
      shouldRenderGeneratedPasswordList: false,
      shouldRenderNoMoreInvitesEmptyState: true,
      shouldRenderPasswordGenerationSection: false,
      shouldRenderPreviousPasswordsSection: false,
    });
  });

  it('builds password export rows and files', () => {
    const encodeGroupPassword = (code: string) => `enc:${code}`;

    expect(
      encodeSbtPageGroupPasswordForUrl(' One Two ', {
        normalizeGroupPasswordInput: (raw) =>
          String(raw || '')
            .trim()
            .toLowerCase(),
        encodeGroupPasswordForUrl: (raw) => `encoded:${raw}`,
      }),
    ).toBe('encoded:one two');
    expect(
      buildSbtPagePasswordInviteLink({
        baseUrl: 'https://app.example',
        code: 'one two',
        demoPath: '/s/alpha',
        encodeGroupPassword,
        isInvite: true,
        sbtAddr: '0xabc',
        sbtBasePathValue: '/sbt',
      }),
    ).toBe('https://app.example/s/alpha?auto=1&sbt=0xabc');
    expect(
      buildSbtPagePasswordInviteLink({
        baseUrl: 'https://app.example',
        code: 'pw1',
        isInvite: false,
        sbtAddr: '0xdef',
        sbtBasePathValue: '/sbt',
      }),
    ).toBe('https://app.example/sbt/0xdef');

    const inviteRows = buildSbtPagePasswordExportRows({
      baseUrl: 'https://app.example',
      codeLabel: 'groupPassword',
      demoPath: '/s/alpha',
      encodeGroupPassword,
      isInvite: true,
      passwordsToExport: ['one two'],
      sbtAddr: '0xabc',
      sbtBasePathValue: '/sbt',
    });

    expect(inviteRows).toEqual([
      {
        groupPassword: 'one two',
        inviteLink: 'https://app.example/s/alpha?auto=1&sbt=0xabc',
      },
    ]);

    const passwordRows = buildSbtPagePasswordExportRows({
      baseUrl: 'https://app.example',
      codeLabel: 'password',
      isInvite: false,
      passwordsToExport: ['pw1'],
      sbtAddr: '0xdef',
      sbtBasePathValue: '/sbt',
    });
    expect(passwordRows).toEqual([
      {
        password: 'pw1',
        inviteLink: 'https://app.example/sbt/0xdef',
      },
    ]);

    expect(
      buildSbtPagePasswordExportFile({
        codeLabel: 'password',
        date: '2026-05-05',
        fileLabel: 'passwords',
        format: 'csv',
        rows: passwordRows,
        sbtSymbolOrName: 'ALPHA',
      }),
    ).toEqual({
      content: 'index,password,inviteLink\n0,pw1,https://app.example/sbt/0xdef',
      fileName: 'ALPHA_passwords_2026-05-05.csv',
      mimeType: 'text/csv',
    });

    expect(
      buildSbtPagePasswordExportFile({
        codeLabel: 'groupPassword',
        date: '2026-05-05',
        fileLabel: 'group-passwords',
        format: 'json',
        rows: inviteRows,
        sbtSymbolOrName: 'ALPHA',
      }),
    ).toMatchObject({
      content: JSON.stringify(inviteRows, null, 2),
      fileName: 'ALPHA_group-passwords_2026-05-05.json',
      mimeType: 'application/json',
    });

    expect(buildSbtPagePasswordExportFile({ format: 'txt' })).toBeNull();
  });

  it('generates unique 16-byte hex passwords using injected random sources', () => {
    let browserCall = 0;
    const browserPasswords = generateSbtPageRandomPasswords({
      count: 2,
      getRandomValues: (arr) => {
        arr.fill(browserCall === 0 ? 1 : 2);
        browserCall += 1;
        return arr;
      },
      randomBytes: () => {
        throw new Error('fallback should not be used');
      },
    });

    expect(browserPasswords).toEqual(['01010101010101010101010101010101', '02020202020202020202020202020202']);

    let fallbackCall = 0;
    expect(
      generateSbtPageRandomPasswords({
        count: 2,
        getRandomValues: null,
        randomBytes: () => {
          fallbackCall += 1;
          return new Uint8Array(16).fill(fallbackCall === 1 ? 3 : 4);
        },
      }),
    ).toEqual(['03030303030303030303030303030303', '04040404040404040404040404040404']);

    expect(
      generateSbtPageRandomPasswords({
        count: 'bad',
        randomBytes: () => new Uint8Array(16),
      }),
    ).toEqual([]);
  });

  it('decodes JSON data URIs and detects image-like URIs', () => {
    expect(
      decodeSbtPageJsonDataUri(`data:application/json,${encodeURIComponent(JSON.stringify({ name: 'Badge' }))}`),
    ).toEqual({ name: 'Badge' });
    expect(
      decodeSbtPageJsonDataUri(
        `data:application/json;base64,${Buffer.from(JSON.stringify({ name: 'Encoded' })).toString('base64')}`,
      ),
    ).toEqual({ name: 'Encoded' });
    expect(decodeSbtPageJsonDataUri('data:application/json,not-json')).toBeNull();
    expect(decodeSbtPageJsonDataUri('https://example.test/metadata.json')).toBeNull();

    expect(isSbtPageImageLikeUri('data:image/png;base64,abc')).toBe(true);
    expect(isSbtPageImageLikeUri('https://example.test/image.PNG')).toBe(true);
    expect(isSbtPageImageLikeUri('https://example.test/render?format=webp')).toBe(true);
    expect(isSbtPageImageLikeUri('https://example.test/metadata.json')).toBe(false);
    expect(isSbtPageImageLikeUri('not a url')).toBe(false);
  });

  it('normalizes token metadata links while rejecting images and data URIs', () => {
    const txId = 'Sng0VG2vetgNPITw5mtvt6om-fBCNu3KI5GZAYeEttY';
    arweaveGlobals.CE_ARWEAVE_DIRECT_TO_AR_IO = true;
    arweaveGlobals.CE_ARWEAVE_AR_IO_URL = 'https://ar-io.dev';

    expect(normalizeSbtPageCanonicalMetadataHref(`ar://${txId}`)).toBe(`https://ar-io.dev/${txId}`);
    expect(normalizeSbtPageCanonicalMetadataHref('data:application/json,%7B%7D')).toBe('');
    expect(normalizeSbtPageCanonicalMetadataHref('https://cdn.example.test/preview.png')).toBe('');
    expect(normalizeSbtPageCanonicalMetadataHref('https://example.test/metadata.json')).toBe(
      'https://example.test/metadata.json',
    );
  });

  it('resolves embedded token metadata links by SBT-specific field precedence', () => {
    const sbtTxId = 'GfaX7MhJndTePSYdECj8VJmFQ5m2KDtDMU8fHgUTw24';
    const sessionTxId = 'ue3Ek_Mh1ypNvvCaGlfrntt_8HxJ9CDiwDlG06uoTpY';
    arweaveGlobals.CE_ARWEAVE_DIRECT_TO_AR_IO = true;
    arweaveGlobals.CE_ARWEAVE_AR_IO_URL = 'https://ar-io.dev';
    const dataUriPayload = Buffer.from(
      JSON.stringify({
        tokenURI: `ar://${sbtTxId}`,
        metadataUri: `ar://${sessionTxId}`,
        uri: 'https://cdn.example.test/banner.webp',
      }),
      'utf8',
    ).toString('base64');

    const href = resolveSbtPageTokenMetadataHref(`data:application/json;base64,${dataUriPayload}`);

    expect(href).toBe(`https://ar-io.dev/${sbtTxId}`);
    expect(href).not.toContain(sessionTxId);
  });

  it('uses later embedded metadata fields when earlier token fields are image-like', () => {
    const txId = '4kpvO6qf-tN4l0R9vQh-Sz6ekU2xq9j5qM4R1X3vZkA';
    const dataUriPayload = Buffer.from(
      JSON.stringify({
        tokenURI: 'https://cdn.example.test/also-image.jpg',
        uri: 'https://cdn.example.test/banner.webp',
        metadataUri: `ar://${txId}`,
      }),
      'utf8',
    ).toString('base64');

    const href = resolveSbtPageTokenMetadataHref(`data:application/json;base64,${dataUriPayload}`);

    expect(href).toContain(txId);
    expect(href).not.toContain('also-image.jpg');
    expect(
      resolveSbtPageTokenMetadataHref(
        `data:application/json,${encodeURIComponent(
          JSON.stringify({
            tokenURI: 'https://cdn.example.test/also-image.jpg',
            uri: 'https://cdn.example.test/banner.webp',
          }),
        )}`,
      ),
    ).toBe('');
  });

  it('builds display image candidates and falls back to the default image', () => {
    const defaultImage = '/static/default-sbt.png';
    const imageUrl = 'https://example.test/badge.png';

    expect(getDisplayImageUrlCandidates({ image: imageUrl })).toEqual([imageUrl]);
    expect(resolveDisplayImageHref({ image: imageUrl }, defaultImage)).toBe(imageUrl);
    expect(resolveDisplayImageHref({ image: '' }, defaultImage)).toBe(defaultImage);
    expect(getDisplayImageRenderState({ image: '' }, {}, defaultImage)).toEqual({
      sourceKey: '',
      candidates: [],
      activeIndex: 0,
      src: defaultImage,
      canRetry: false,
    });
  });

  it('resolves on-chain metadata read needs without changing fast-path guards', () => {
    const zeroAddress = '0x0000000000000000000000000000000000000000';
    const completeInfo = {
      admin: '0x1111111111111111111111111111111111111111',
      burnAuth: 1,
      hasPasswordMint: false,
      maxTokens: '25',
      mintingEndTime: 0,
    };

    expect(resolveSbtPageChainMetadataReadNeeds({ info: completeInfo, zeroAddress })).toEqual({
      needAdmin: false,
      needBurn: false,
      needEnd: false,
      needHasPw: false,
      needMax: false,
      shouldRead: false,
    });
    expect(
      resolveSbtPageChainMetadataReadNeeds({
        info: { ...completeInfo, burnAuthNeedsOnChainRefresh: true },
        zeroAddress,
      }).needBurn,
    ).toBe(true);
    expect(
      resolveSbtPageChainMetadataReadNeeds({
        info: { ...completeInfo, admin: zeroAddress },
        zeroAddress,
      }).needAdmin,
    ).toBe(true);
    expect(
      resolveSbtPageChainMetadataReadNeeds({
        info: { ...completeInfo, maxTokens: null, mintingEndTime: undefined, hasPasswordMint: undefined },
        zeroAddress,
      }),
    ).toMatchObject({
      needEnd: true,
      needHasPw: true,
      needMax: true,
      shouldRead: true,
    });
  });

  it('falls back to the default image after the AR.IO-only image candidate fails', () => {
    const txId = 'DqYBh1qm9GvaTOGkF5R7abnLoB3OPiXNNBcTsYPtlRc';
    arweaveGlobals.CE_ARWEAVE_DIRECT_TO_AR_IO = true;
    arweaveGlobals.CE_ARWEAVE_AR_IO_URL = 'https://ar-io.dev';

    const image = `ar://${txId}`;
    const firstState = getDisplayImageRenderState({ image }, {}, '/default.png');
    expect(firstState.sourceKey).toBe(image);
    expect(firstState.activeIndex).toBe(0);
    expect(firstState.src).toBe(`https://ar-io.dev/${txId}`);
    expect(firstState.canRetry).toBe(true);
    expect(firstState.candidates).toEqual([`https://ar-io.dev/${txId}`]);

    const fallbackState = getDisplayImageRenderState(
      { image },
      {
        displayImageFallbackKey: image,
        displayImageFallbackIndex: 1,
      },
      '/default.png',
    );
    expect(fallbackState.activeIndex).toBe(1);
    expect(fallbackState.src).toBe('/default.png');

    const defaultFallbackState = getDisplayImageRenderState(
      { image },
      {
        displayImageFallbackKey: image,
        displayImageFallbackIndex: 2,
      },
      '/default.png',
    );
    expect(defaultFallbackState.activeIndex).toBe(2);
    expect(defaultFallbackState.src).toBe('/default.png');
    expect(defaultFallbackState.canRetry).toBe(false);

    const staleFallbackState = getDisplayImageRenderState(
      { image },
      {
        displayImageFallbackKey: 'https://example.test/old.png',
        displayImageFallbackIndex: 1,
      },
      '/default.png',
    );
    expect(staleFallbackState.activeIndex).toBe(0);
    expect(staleFallbackState.src).toBe(`https://ar-io.dev/${txId}`);
  });

  it('builds the next display image fallback state only from the active failed candidate', () => {
    expect(getDisplayImageFallbackCandidateCount(['a', 'b'])).toBe(2);
    expect(getDisplayImageFallbackCandidateCount('bad')).toBe(0);
    expect(getNextDisplayImageFallbackState({ sourceKey: 'image-a', activeIndex: 0, maxIndex: 2 }, {})).toEqual({
      displayImageFallbackKey: 'image-a',
      displayImageFallbackIndex: 1,
    });
    expect(
      getNextDisplayImageFallbackState(
        { sourceKey: 'image-a', activeIndex: 1, maxIndex: 2 },
        { displayImageFallbackKey: 'image-a', displayImageFallbackIndex: 1 },
      ),
    ).toEqual({
      displayImageFallbackKey: 'image-a',
      displayImageFallbackIndex: 2,
    });
    expect(
      getNextDisplayImageFallbackState(
        { sourceKey: 'image-a', activeIndex: 1, maxIndex: 2 },
        { displayImageFallbackKey: 'image-a', displayImageFallbackIndex: 0 },
      ),
    ).toBeNull();
  });

  it('builds holder occurrence maps, net counts, holder lists, and signatures', () => {
    expect(Array.from(buildSbtPageAddressOccurrenceMap(['0xA', '0xa', '', null]).entries())).toEqual([['0xa', 2]]);
    expect(Array.from(computeSbtPageNetCounts(['0xA', '0xB'], ['0xa']).entries())).toEqual([
      ['0xa', 0],
      ['0xb', 1],
    ]);
    expect(computeSbtPageNetHoldersList(['0xA', '0xB', '0xA'], ['0xa'])).toEqual(['0xa', '0xb']);
    expect(buildSbtPageHolderListSignature(['0xA', '0xB'])).toBe(buildSbtPageHolderListSignature(['0xa', '0xb']));
    expect(buildSbtPageHolderListSignature(['0xA', '0xB'])).not.toBe(buildSbtPageHolderListSignature(['0xB', '0xA']));
    const list = ['0xA', '0xB'];
    const firstMemoState = buildSbtPageAddressListSignatureMemoState({ list });
    expect(firstMemoState.signature).toBe(buildSbtPageHolderListSignature(list));
    const buildSignature = jest.fn(() => 'unused');
    const reusedMemoState = buildSbtPageAddressListSignatureMemoState({
      buildAddressListSignature: buildSignature,
      list,
      memo: firstMemoState.memo,
    });
    expect(reusedMemoState).toEqual(firstMemoState);
    expect(buildSignature).not.toHaveBeenCalled();
    expect(
      buildSbtPageAddressListSignatureMemoState({
        buildAddressListSignature: () => '',
        list: ['0xC'],
      }).signature,
    ).toBe('1:0');
    const minted = ['0xA', '0xB', '0xA'];
    const burned = ['0xa'];
    const firstNetState = buildSbtPageNetHoldersMemoState({
      burnedAddresses: burned,
      mintedAddresses: minted,
    });
    expect(firstNetState.netHolders).toEqual(['0xa', '0xb']);
    const computeNetHolders = jest.fn(() => ['unused']);
    const sameRefNetState = buildSbtPageNetHoldersMemoState({
      burnedAddresses: burned,
      computeNetHoldersList: computeNetHolders,
      memo: firstNetState.memo,
      mintedAddresses: minted,
    });
    expect(sameRefNetState).toEqual(firstNetState);
    expect(computeNetHolders).not.toHaveBeenCalled();
    const sameSignatureNetState = buildSbtPageNetHoldersMemoState({
      burnedAddresses: [...burned],
      computeNetHoldersList: computeNetHolders,
      memo: firstNetState.memo,
      mintedAddresses: [...minted],
    });
    expect(sameSignatureNetState.netHolders).toEqual(firstNetState.netHolders);
    expect(computeNetHolders).not.toHaveBeenCalled();
    expect(
      buildSbtPageModalFilteredMintedUsersPatch({
        filtered: [],
        isHolderScanActive: true,
        state: {
          filteredMintedUsers: ['0xA'],
          loadingMintedFilter: true,
        },
      }),
    ).toEqual({ loadingMintedFilter: false });
    expect(
      buildSbtPageModalFilteredMintedUsersPatch({
        buildAddressListSignature: () => 'next',
        filtered: ['0xB'],
        state: {
          filteredMintedUsersSignature: 'prev',
          loadingMintedFilter: true,
        },
      }),
    ).toEqual({
      filteredMintedUsers: ['0xB'],
      filteredMintedUsersSignature: 'next',
      loadingMintedFilter: false,
    });
    expect(
      buildSbtPageModalFilteredMintedUsersPatch({
        buildAddressListSignature: () => 'same',
        filtered: ['0xC'],
        state: {
          filteredMintedUsersSignature: 'same',
          loadingMintedFilter: false,
        },
      }),
    ).toBeNull();
  });

  it('normalizes minted-token overrides and count-map address expansion', () => {
    expect(sanitizeSbtPageMintedTokensOverride(3)).toBe('3');
    expect(sanitizeSbtPageMintedTokensOverride('4')).toBe('4');
    expect(sanitizeSbtPageMintedTokensOverride(-1)).toBeNull();
    expect(sanitizeSbtPageMintedTokensOverride(1.5)).toBeNull();
    expect(normalizeSbtPageCountMap({ '0xA': 2.9, '0xB': '1', '0xC': 0 })).toEqual({
      '0xa': 2,
      '0xb': 1,
    });
    expect(expandSbtPageAddressListFromCountMap({ '0xA': 2, '0xB': 1 })).toEqual(['0xa', '0xa', '0xb']);
    expect(expandSbtPageAddressListFromCountMap({}, ['0xFALLBACK'])).toEqual(['0xfallback']);
    expect(expandSbtPageAddressListFromCountMap(null, ['0xFALLBACK'])).toEqual(['0xfallback']);
  });

  it('normalizes invite codes and auto-mint query pairs', () => {
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
    expect(hasSbtPageAutoMintFlag('?sbt=0xA&auto=1')).toBe(true);
    expect(hasSbtPageAutoMintFlag('sbt1=0xA&auto1=1')).toBe(true);
    expect(hasSbtPageAutoMintFlag('sbt=0xA&auto=0')).toBe(false);
    expect(
      buildSbtPageAutoMintCleanPath('https://example.test/sbt/0xA?auto=1&sbt=0xA&gp=secret&keep=yes#section'),
    ).toBe('/sbt/0xA?keep=yes');
    expect(buildSbtPageAutoMintCleanPath('https://example.test/sbt/0xA?auto1=1&sbt1=0xA&gp1=secret&keep=yes')).toBe(
      '/sbt/0xA?keep=yes',
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
        searchRaw: '?sbt=0x00000000000000000000000000000000000000aa&gp=secret&auto=1',
        state,
      }),
    ).toEqual({
      currentSbtAddress: propsIn.SBTAddress,
      targetInvite: null,
      targetPassword: 'secret',
      targetCode: 'secret',
      shouldAttemptAuto: true,
      autoKey: 'autoMint:unknown-chain:general:0x00000000000000000000000000000000000000aa:success',
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
        searchRaw: '?sbt=0x00000000000000000000000000000000000000aa&gp=secret&auto=1',
        sessionStorageRef: { getItem: () => 'done' },
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

  it('builds next filtered holder rows while preserving narrowed filters', () => {
    expect(
      buildSbtPageNextFilteredHolderRows({
        prevFilteredRows: ['0xA', '0xB'],
        prevNetHolders: ['0xA', '0xB'],
        nextNetHolders: ['0xC'],
        replaceRows: true,
      }),
    ).toEqual(['0xc']);
    expect(
      buildSbtPageNextFilteredHolderRows({
        prevFilteredRows: ['0xA'],
        prevNetHolders: ['0xA', '0xB'],
        nextNetHolders: ['0xA', '0xC'],
        replaceRows: true,
      }),
    ).toEqual(['0xa']);
  });

  it('merges new burn evidence into preserved holder state', () => {
    expect(
      mergeSbtPageBurnEvidenceIntoPreservedHolderState(['0xA', '0xA', '0xB'], ['0xB'], ['0xA', '0xB'], ['0xA', '0xB']),
    ).toEqual({
      mintedAddresses: ['0xa', '0xa', '0xb'],
      burnedAddresses: ['0xb', '0xa'],
      burnDiscovered: true,
    });
    expect(mergeSbtPageBurnEvidenceIntoPreservedHolderState(['0xA'], [], ['0xA'], []).burnDiscovered).toBe(false);
  });

  it('normalizes load-SBT-info options from booleans and option records', () => {
    expect(normalizeSbtPageLoadInfoOptions(true)).toEqual({
      forceEventFetch: true,
      preferCountsOnly: false,
    });
    expect(normalizeSbtPageLoadInfoOptions({ force: true, countsOnly: true })).toEqual({
      forceEventFetch: true,
      preferCountsOnly: true,
    });
    expect(normalizeSbtPageLoadInfoOptions({ forceEventFetch: true, preferCountsOnly: false })).toEqual({
      forceEventFetch: true,
      preferCountsOnly: false,
    });
    expect(normalizeSbtPageLoadInfoOptions(['bad'])).toEqual({
      forceEventFetch: false,
      preferCountsOnly: false,
    });
  });
});
