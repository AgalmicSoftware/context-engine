import {
  asCreateSbtGateBoundary,
  buildCreateSbtAccountDistributionSyncPatch,
  buildCreateSbtAccountDistributionSyncStatePatch,
  buildCreateSbtActiveClassName,
  buildCreateSbtActionLinkClassName,
  buildCreateSbtResourceKeyByGateId,
  buildCreateSbtScopedLockGateId,
  buildCreateSbtBookmarkedSbtsSetPatch,
  buildCreateSbtBooleanTogglePatch,
  buildCreateSbtCollapseHeaderClassName,
  buildCreateSbtCollapseTogglePatch,
  buildCreateSbtCopiedLinkIndexPatch,
  buildCreateSbtCopySuccessPatch,
  buildCreateSbtCountdownTickPatch,
  buildCreateSbtCountdownStartPatch,
  buildCreateSbtDeferredSaveCompletePatch,
  buildCreateSbtDeferredUploadFallbackPatch,
  buildCreateSbtDistributionFieldPatch,
  buildCreateSbtEditResetPatch,
  buildCreateSbtErrorPatch,
  buildEffectiveCreateSbtDocumentUrls,
  buildCreateSbtExportFormatPatch,
  buildCreateSbtGroupHashPatch,
  buildCreateSbtGroupPasswordPredictableEntryPatch,
  buildCreateSbtGroupPasswordPredictableExitPatch,
  buildCreateSbtOpenLockKeyPatch,
  buildCreateSbtImageFileClearPatch,
  buildCreateSbtImageFilePatch,
  buildCreateSbtImageChooserStatusPatch,
  buildCreateSbtImageLoadErrorPatch,
  buildCreateSbtImageLoadReadyPatch,
  buildCreateSbtImageResetPatch,
  buildCreateSbtImageUploadMethodPatch,
  buildCreateSbtInlineFieldLockClassName,
  buildCreateSbtInputChangePatch,
  buildCreateSbtSelectedImageFilePatch,
  buildCreateSbtInitialState,
  buildCreateSbtInviteLinksBackupPatch,
  buildCreateSbtNetworkChangePatch,
  buildCreateSbtMetadataLockFallbackPatch,
  buildCreateSbtMetadataLockGateIdsPatch,
  buildCreateSbtMintResetFailurePatch,
  buildCreateSbtMintStartPatch,
  buildCreateSbtMintSuccessPatch,
  buildCreateSbtMintValidationFailurePatch,
  buildCreateSbtNumInviteLinksPatch,
  buildCreateSbtPasswordListPatch,
  buildCreateSbtPredictedAddressBusyPatch,
  buildCreateSbtPredictedAddressPatch,
  buildCreateSbtAuthoringChainSyncPatch,
  buildCreateSbtAuthoringChainSyncStatePatch,
  buildCreateSbtResetFormState,
  buildCreateSbtShareableUrlPatch,
  buildCreateSbtRestoredCollapseState,
  buildCreateSbtRestoredDistributionState,
  buildCreateSbtRestoredScalarState,
  buildCreateSbtSymbolPatch,
  buildCreateSbtTokenInfoMetaCardClassName,
  createEmptyMetadataLockGateIds,
  getConfiguredContractAddress,
  getCreateSbtObjectEntries,
  getCreateSbtRecipientAccessControlConditions,
  hasUsableCreateSbtFactoryForChain,
  isPlainObject,
  normalizeComparableAddress,
  normalizeGateIds,
  normalizeGateText,
  normalizePositiveChainId,
  resolveCreateSbtActionIconStyle,
  resolveCreateSbtCachedDistributionChainId,
  resolveCreateSbtCollapseHeaderDisplayState,
  resolveCreateSbtFailureIconStyle,
  resolveCreateSbtHiddenQrDisplayState,
  resolveCreateSbtLockAudienceSessionName,
  resolveCreateSbtRestoredDeferredCreate2Salt,
  resolveCreateSbtMemoizedImageDataUrl,
  resolveCreateSbtRestoredPredictableAddressEnabled,
  resolveCreateSbtShareableTooltipIconStyle,
  resolveCreateSbtTooltipIconStyle,
  stableGateColor,
} from './createSbtGroupHelpers';

describe('createSbtGroupHelpers', () => {
  it('normalizes chain ids, addresses, gate ids, and gate text', () => {
    expect(normalizePositiveChainId('84532')).toBe(84532);
    expect(normalizePositiveChainId(0)).toBeNull();
    expect(normalizePositiveChainId(Number.NaN)).toBeNull();
    expect(resolveCreateSbtCachedDistributionChainId({ network: { id: '11155420' } })).toBe(11155420);
    expect(resolveCreateSbtCachedDistributionChainId({ network: { chainId: 84532 } })).toBe(84532);
    expect(resolveCreateSbtCachedDistributionChainId({ network: '10' })).toBe(10);
    expect(resolveCreateSbtCachedDistributionChainId({ network: 'bad' })).toBeNull();
    expect(buildCreateSbtAuthoringChainSyncPatch({
      currentDistributionNetwork: { id: 11155420, name: 'OP Sepolia' },
      currentNetwork: 11155420,
      syncedAuthoringChain: { chainId: 11155420, chain: { id: 11155420, name: 'OP Sepolia' } },
    })).toBeNull();
    expect(buildCreateSbtAuthoringChainSyncPatch({
      currentDistributionNetwork: { id: 84532, name: 'Base Sepolia' },
      currentNetwork: 84532,
      syncedAuthoringChain: { chainId: 11155420, chain: { id: 11155420, name: 'OP Sepolia' } },
    })).toEqual({
      network: 11155420,
      sbtDistributionNetwork: { id: 11155420, name: 'OP Sepolia' },
    });
    expect(buildCreateSbtAuthoringChainSyncPatch({
      currentDistributionNetwork: { id: 11155420, name: 'Legacy Name' },
      currentNetwork: 11155420,
      syncedAuthoringChain: { chainId: 11155420, chain: { id: 11155420, name: 'OP Sepolia' } },
    })).toEqual({
      network: 11155420,
      sbtDistributionNetwork: { id: 11155420, name: 'OP Sepolia' },
    });
    expect(buildCreateSbtAuthoringChainSyncStatePatch({
      currentDistribution: {
        burnAdmin: '0xAdmin',
        network: { id: 84532, name: 'Base Sepolia' },
      },
      syncPatch: {
        network: 11155420,
        sbtDistributionNetwork: { id: 11155420, name: 'OP Sepolia' },
      },
    })).toEqual({
      network: 11155420,
      sbtDistribution: {
        burnAdmin: '0xAdmin',
        network: { id: 11155420, name: 'OP Sepolia' },
      },
    });
    expect(buildCreateSbtAuthoringChainSyncStatePatch()).toBeNull();
    const restoredDistribution = buildCreateSbtRestoredDistributionState({
      currentDistribution: {
        limitedNumber: 3,
        mintingEndTime: 'old',
        option: 'open',
      },
      distributionPayload: {
        mintingEndTime: '2026-01-01T00:00:00.000Z',
        network: 'cached-network',
        option: 'groupPassword',
      },
      restoredAuthoringChain: {
        chain: { id: 84532, name: 'OP Sepolia' },
      },
    });
    expect(restoredDistribution).toMatchObject({
      limitedNumber: 3,
      network: { id: 84532, name: 'OP Sepolia' },
      option: 'groupPassword',
    });
    expect(restoredDistribution.mintingEndTime).toEqual(new Date('2026-01-01T00:00:00.000Z'));
    expect(buildCreateSbtRestoredDistributionState({
      currentDistribution: { option: 'open' },
      distributionPayload: {},
      restoredAuthoringChain: { chain: 'not connected' },
    })).toMatchObject({
      mintingEndTime: null,
      network: 'not connected',
      option: 'open',
    });
    expect(resolveCreateSbtRestoredDeferredCreate2Salt(' salt-a ', 'fallback')).toBe(' salt-a ');
    expect(resolveCreateSbtRestoredDeferredCreate2Salt('   ', 'fallback')).toBe('fallback');
    expect(resolveCreateSbtRestoredPredictableAddressEnabled(false, true)).toBe(false);
    expect(resolveCreateSbtRestoredPredictableAddressEnabled(null, true)).toBe(true);
    expect(buildCreateSbtGroupPasswordPredictableExitPatch({
      autoCreate2SaltForGroupPassword: true,
      nextDistributionOption: 'open',
      prevDistributionOption: 'groupPassword',
    })).toEqual({
      create2Salt: '',
      predictableAddressEnabled: false,
    });
    expect(buildCreateSbtGroupPasswordPredictableExitPatch({
      autoCreate2SaltForGroupPassword: false,
      nextDistributionOption: 'open',
      prevDistributionOption: 'groupPassword',
    })).toBeNull();
    expect(buildCreateSbtGroupPasswordPredictableEntryPatch({
      autoSalt: 'salt-a',
      nextDistributionOption: 'groupPassword',
      prevDistributionOption: 'open',
    })).toEqual({
      create2Salt: 'salt-a',
      predictableAddressEnabled: true,
    });
    expect(buildCreateSbtGroupPasswordPredictableEntryPatch({
      autoSalt: 'salt-a',
      isPredictableAddressEnabled: true,
      nextDistributionOption: 'groupPassword',
      prevDistributionOption: 'open',
    })).toBeNull();
    expect(buildCreateSbtGroupPasswordPredictableEntryPatch({
      autoSalt: '',
      nextDistributionOption: 'groupPassword',
      prevDistributionOption: 'open',
    })).toBeNull();
    expect(buildCreateSbtRestoredScalarState({
      currentExportFormat: 'csv',
      currentNumInviteLinks: 5,
      parsed: {
        autoAppliedDefaultTags: ['Default'],
        create2Salt: 'salt-a',
        dismissedDefaultTags: 'bad',
        documentIDHashes: 'hash-a',
        documentURLs: ['https://docs.example/a'],
        exportFormat: 'json',
        groupPassword: 'group-pass',
        numInviteLinks: 0,
        sbtDescription: 'Description',
        sbtImageUrl: 'https://image.example/a.png',
        sbtName: 'Name',
        useImageUrl: 1,
      },
    })).toEqual({
      autoAppliedDefaultTags: ['Default'],
      create2Salt: 'salt-a',
      dismissedDefaultTags: [],
      documentIDHashes: 'hash-a',
      documentURLs: ['https://docs.example/a'],
      exportFormat: 'json',
      groupPassword: 'group-pass',
      numInviteLinks: 0,
      sbtDescription: 'Description',
      sbtImageUrl: 'https://image.example/a.png',
      sbtName: 'Name',
      useImageUrl: true,
    });
    expect(buildCreateSbtRestoredScalarState({
      currentExportFormat: 'csv',
      currentNumInviteLinks: 5,
      parsed: {
        documentURLs: 'bad',
        exportFormat: '',
        numInviteLinks: 'bad',
      },
    })).toMatchObject({
      documentURLs: [],
      exportFormat: 'csv',
      numInviteLinks: 5,
      useImageUrl: false,
    });
    expect(buildCreateSbtRestoredCollapseState({
      currentDistributionOptionsCollapsed: true,
      currentMintOptionsCollapsed: true,
      shouldExpandSections: false,
    })).toEqual({
      tokenInfoCollapsed: false,
      mintOptionsCollapsed: true,
      distributionOptionsCollapsed: true,
    });
    expect(buildCreateSbtRestoredCollapseState({
      currentDistributionOptionsCollapsed: true,
      currentMintOptionsCollapsed: true,
      shouldExpandSections: true,
    })).toEqual({
      tokenInfoCollapsed: false,
      mintOptionsCollapsed: false,
      distributionOptionsCollapsed: false,
    });
    const imageFile = { name: 'badge.png' };
    expect(resolveCreateSbtMemoizedImageDataUrl({
      imageFile,
      memoizedImageDataUrl: 'data:image/png;base64,abc',
      memoizedImageFileRef: imageFile,
    })).toBe('data:image/png;base64,abc');
    expect(resolveCreateSbtMemoizedImageDataUrl({
      imageFile,
      memoizedImageDataUrl: 'data:image/png;base64,abc',
      memoizedImageFileRef: { name: 'badge.png' },
    })).toBeNull();
    expect(resolveCreateSbtMemoizedImageDataUrl({
      imageFile,
      memoizedImageDataUrl: '',
      memoizedImageFileRef: imageFile,
    })).toBeNull();
    expect(normalizeComparableAddress(' 0xABC ')).toBe('0xabc');
    expect(normalizeGateIds([' a ', '', null, 'b'])).toEqual(['a', 'b']);
    expect(normalizeGateIds(' c ')).toEqual(['c']);
    expect(normalizeGateIds({})).toEqual([]);
    expect(normalizeGateText(' label ')).toBe('label');
    expect(normalizeGateText({})).toBe('');
  });

  it('builds account sync patches for owned distribution admin fields', () => {
    expect(buildCreateSbtAccountDistributionSyncPatch({
      currentDistribution: {
        burnAdmin: '',
        adminAddress: ' 0xOld ',
      },
      nextAccount: ' 0xNew ',
      prevAccount: '0xold',
    })).toEqual({
      burnAdmin: '0xNew',
      adminAddress: '0xNew',
    });
    expect(buildCreateSbtAccountDistributionSyncPatch({
      currentDistribution: {
        burnAdmin: '0xCustom',
        adminAddress: '0xOld',
      },
      nextAccount: '0xNew',
      prevAccount: '0xOld',
    })).toEqual({
      adminAddress: '0xNew',
    });
    expect(buildCreateSbtAccountDistributionSyncPatch({
      currentDistribution: {
        burnAdmin: '0xCustom',
        adminAddress: '0xOther',
      },
      nextAccount: '0xNew',
      prevAccount: '0xOld',
    })).toBeNull();
    expect(buildCreateSbtAccountDistributionSyncPatch({
      currentDistribution: {},
      nextAccount: '0xSame',
      prevAccount: '0xsame',
    })).toBeNull();
    expect(buildCreateSbtAccountDistributionSyncStatePatch({
      currentDistribution: {
        burnAdmin: '0xOld',
        distributionOption: 'groupPassword',
      },
      syncPatch: {
        burnAdmin: '0xNew',
        adminAddress: '0xNew',
      },
    })).toEqual({
      sbtDistribution: {
        burnAdmin: '0xNew',
        adminAddress: '0xNew',
        distributionOption: 'groupPassword',
      },
    });
    expect(buildCreateSbtAccountDistributionSyncStatePatch()).toBeNull();
  });

  it('resolves lock audience labels and scoped gate ids', () => {
    expect(resolveCreateSbtLockAudienceSessionName({ sessionName: ' Alpha Session ', slug: 'alpha' })).toBe('Alpha Session');
    expect(resolveCreateSbtLockAudienceSessionName({ slug: 'alpha' })).toBe('alpha');
    expect(resolveCreateSbtLockAudienceSessionName({})).toBe('session');
    expect(buildCreateSbtScopedLockGateId(' Alpha ', ' gate-a ')).toBe('session:Alpha::gate-a');
    expect(buildCreateSbtScopedLockGateId('', 'gate-a')).toBe('session:general::gate-a');
    expect(buildCreateSbtScopedLockGateId('alpha', '')).toBe('');
  });

  it('maps sponsored gate ids back to resource keys', () => {
    const map = buildCreateSbtResourceKeyByGateId({
      sponsored: {
        resources: {
          ai: { gateId: 'gate-ai' },
          arweave: { gateIds: ['gate-ar', 'gate-ai'] },
        },
      },
      __registry: {
        gateAuthority: 'onchain',
        gatesByResource: {
          default: {
            lookupStatus: 'ok',
            gateId: 'gate-default',
            sbtAddress: '0x0000000000000000000000000000000000000001',
          },
        },
      },
    });

    expect(map).toEqual({
      'gate-ai': 'ai',
      'gate-ar': 'arweave',
      'gate-default': 'default',
    });
  });

  it('resolves plain-object contract addresses and stable gate colors', () => {
    expect(isPlainObject({ a: 1 })).toBe(true);
    expect(isPlainObject([])).toBe(false);
    expect(asCreateSbtGateBoundary({ id: 'gate-a' })).toEqual({ id: 'gate-a' });
    expect(asCreateSbtGateBoundary([])).toEqual({});
    expect(getCreateSbtObjectEntries({ a: 1 })).toEqual([['a', 1]]);
    expect(getCreateSbtObjectEntries(null)).toEqual([]);
    expect(getCreateSbtRecipientAccessControlConditions({
      accessControlConditions: [{ contractAddress: '0xA' }],
    })).toEqual([{ contractAddress: '0xA' }]);
    expect(getCreateSbtRecipientAccessControlConditions({ accessControlConditions: 'bad' })).toEqual([]);
    expect(getConfiguredContractAddress({ address: ' 0xSBT ' })).toBe('0xSBT');
    expect(getConfiguredContractAddress({})).toBe('');
    expect(hasUsableCreateSbtFactoryForChain({
      chainId: 11155420,
      getSessionContractsForChain: (chainId) => (
        chainId === 11155420
          ? { sbtFactory: { address: ' 0xFactory ' } }
          : {}
      ),
    })).toBe(true);
    expect(hasUsableCreateSbtFactoryForChain({
      chainId: 84532,
      getSessionContractsForChain: () => ({ sbtFactory: { address: ' ' } }),
    })).toBe(false);
    expect(hasUsableCreateSbtFactoryForChain({
      chainId: 10,
      getSessionContractsForChain: () => null,
    })).toBe(false);
    expect(stableGateColor('gate-a')).toBe(stableGateColor('gate-a'));
    expect(stableGateColor('gate-a')).not.toBe('');
  });

  it('builds CreateSBT reset form state with deferred salt injection', () => {
    const deferredCreate2SaltBuilder = jest.fn(() => 'draft/test-salt');
    const resetState = buildCreateSbtResetFormState({
      account: '0xAdmin',
      authoringChain: { chainId: 84532, chain: { id: 84532, name: 'Base Sepolia' } },
      deferredCreate2SaltBuilder,
      deferredDeploy: true,
    });

    expect(deferredCreate2SaltBuilder).toHaveBeenCalledTimes(1);
    expect(resetState).toEqual(expect.objectContaining({
      sbtName: '',
      sbtDescription: '',
      sbtImageFile: null,
      sbtDistribution: expect.objectContaining({
        adminAddress: '0xAdmin',
        burnAdmin: '0xAdmin',
        network: { id: 84532, name: 'Base Sepolia' },
      }),
      metadataLockGateIds: createEmptyMetadataLockGateIds(),
      deferredCreate2Salt: 'draft/test-salt',
      predictableAddressEnabled: true,
      network: 84532,
      imageChooserStatusText: '',
      imageChooserStatusTone: 'default',
    }));

    deferredCreate2SaltBuilder.mockClear();
    expect(buildCreateSbtResetFormState({
      deferredCreate2SaltBuilder,
      deferredDeploy: false,
    })).toEqual(expect.objectContaining({
      deferredCreate2Salt: '',
      predictableAddressEnabled: false,
      network: '',
    }));
    expect(deferredCreate2SaltBuilder).not.toHaveBeenCalled();
  });

  it('builds CreateSBT initial state around reset defaults and constructor-only fields', () => {
    const deferredCreate2SaltBuilder = jest.fn(() => 'draft/initial-salt');
    const initialState = buildCreateSbtInitialState({
      account: '0xAdmin',
      authoringChain: { chainId: 11155420, chain: { id: 11155420, name: 'OP Sepolia' } },
      deferredCreate2SaltBuilder,
      deferredDeploy: true,
    });

    expect(deferredCreate2SaltBuilder).toHaveBeenCalledTimes(1);
    expect(initialState).toEqual(expect.objectContaining({
      sbtName: '',
      sbtCodes: [],
      groupSubmitted: false,
      groupHash: '',
      sbtDistribution: expect.objectContaining({
        adminAddress: '0xAdmin',
        network: { id: 11155420, name: 'OP Sepolia' },
      }),
      deferredCreate2Salt: 'draft/initial-salt',
      predictableAddressEnabled: true,
      mintOptionsCollapsed: false,
      distributionOptionsCollapsed: false,
      numInviteLinks: 10,
      exportFormat: 'json',
      countdown: 12,
      documentIDHashes: '',
      arweaveTxId: '',
      copyJsonSuccess: false,
      copyLinkSuccess: false,
      copyIdSuccess: false,
    }));
    expect(initialState.bookmarkedSbtsSet).toEqual(new Set());

    deferredCreate2SaltBuilder.mockClear();
    expect(buildCreateSbtInitialState({
      deferredCreate2SaltBuilder,
      deferredDeploy: false,
    })).toEqual(expect.objectContaining({
      deferredCreate2Salt: '',
      mintOptionsCollapsed: true,
      distributionOptionsCollapsed: true,
    }));
    expect(deferredCreate2SaltBuilder).not.toHaveBeenCalled();
    expect(buildCreateSbtCollapseTogglePatch({
      section: 'mintOptionsCollapsed',
      state: { mintOptionsCollapsed: true },
    })).toEqual({ mintOptionsCollapsed: false });
    expect(buildCreateSbtCollapseTogglePatch({
      section: 'distributionOptionsCollapsed',
      state: { distributionOptionsCollapsed: 1 },
    })).toEqual({ distributionOptionsCollapsed: false });
    expect(buildCreateSbtCollapseTogglePatch({
      section: 'tokenInfoCollapsed',
      state: null,
    })).toEqual({ tokenInfoCollapsed: true });
    expect(resolveCreateSbtCollapseHeaderDisplayState({
      isCollapsed: true,
      title: 'Token Info',
    })).toEqual({
      ariaExpanded: false,
      ariaLabel: 'Expand Token Info',
      shouldRenderCollapsedTitle: true,
      shouldRenderClosedIcon: true,
      shouldRenderOpenIcon: false,
      shouldUseOpenClass: false,
    });
    expect(resolveCreateSbtCollapseHeaderDisplayState({
      isCollapsed: false,
      title: 'Token Info',
    })).toEqual({
      ariaExpanded: true,
      ariaLabel: 'Collapse Token Info',
      shouldRenderCollapsedTitle: false,
      shouldRenderClosedIcon: false,
      shouldRenderOpenIcon: true,
      shouldUseOpenClass: true,
    });
    expect(buildCreateSbtCollapseHeaderClassName({
      baseClassName: 'section-header',
      openClassName: 'section-header-open',
      shouldUseOpenClass: false,
    })).toBe('section-header');
    expect(buildCreateSbtCollapseHeaderClassName({
      baseClassName: 'section-header',
      openClassName: 'section-header-open',
      shouldUseOpenClass: true,
    })).toBe('section-header section-header-open');
    expect(buildCreateSbtActiveClassName({
      activeClassName: 'active-option',
      baseClassNames: 'option-card',
      shouldUseActiveClass: false,
    })).toBe('option-card');
    expect(buildCreateSbtActiveClassName({
      activeClassName: 'setting-row-active',
      baseClassNames: ['setting-row', 'setting-toggle-row'],
      shouldUseActiveClass: true,
    })).toBe('setting-row setting-toggle-row setting-row-active');
    expect(buildCreateSbtActionLinkClassName({
      actionClassName: 'action-btn',
      linkClassName: 'action-link',
    })).toBe('action-btn action-link');
    expect(buildCreateSbtInlineFieldLockClassName({
      baseClassName: 'field-lock',
      inlineClassName: 'field-lock-inline',
    })).toBe('field-lock field-lock-inline');
    expect(buildCreateSbtTokenInfoMetaCardClassName({
      fieldSectionClassName: 'field-section',
      metaCardClassName: 'token-meta-card',
    })).toBe('field-section token-meta-card');
    expect(resolveCreateSbtTooltipIconStyle()).toEqual({ opacity: 0.5 });
    expect(resolveCreateSbtActionIconStyle()).toEqual({ marginRight: '5px' });
    expect(resolveCreateSbtFailureIconStyle()).toEqual({ color: 'red' });
    expect(resolveCreateSbtShareableTooltipIconStyle()).toEqual({
      opacity: 0.5,
      marginLeft: '8px',
      fontSize: '0.8em',
    });
    expect(resolveCreateSbtHiddenQrDisplayState()).toEqual({
      hiddenStyle: {
        position: 'absolute',
        opacity: 0,
        pointerEvents: 'none',
        zIndex: -1,
        width: '1px',
        height: '1px',
        overflow: 'hidden',
      },
    });
    expect(buildCreateSbtBooleanTogglePatch({
      state: { showJson: false },
      stateKey: 'showJson',
    })).toEqual({ showJson: true });
    expect(buildCreateSbtBooleanTogglePatch({
      state: { showJson: 'open' },
      stateKey: 'showJson',
    })).toEqual({ showJson: false });
    expect(buildCreateSbtCopySuccessPatch({
      stateKey: 'copyIdSuccess',
    })).toEqual({ copyIdSuccess: true });
    expect(buildCreateSbtCopySuccessPatch({
      stateKey: 'copyJsonSuccess',
      copied: false,
    })).toEqual({ copyJsonSuccess: false });
    expect(buildCreateSbtCopiedLinkIndexPatch({ index: 2 })).toEqual({
      copiedLinkIndex: 2,
    });
    expect(buildCreateSbtCopiedLinkIndexPatch()).toEqual({
      copiedLinkIndex: null,
    });
    expect(buildCreateSbtOpenLockKeyPatch({ lockKey: 'name' })).toEqual({
      openLockKey: 'name',
    });
    expect(buildCreateSbtOpenLockKeyPatch({ lockKey: null })).toEqual({
      openLockKey: '',
    });
    expect(buildCreateSbtGroupHashPatch({ groupHash: '0xabc' })).toEqual({
      groupHash: '0xabc',
    });
    expect(buildCreateSbtGroupHashPatch({ groupHash: null })).toEqual({
      groupHash: '',
    });
    const passwordList = ['pw1', 'pw2'];
    expect(buildCreateSbtPasswordListPatch({ passwordList })).toEqual({
      passwordList,
    });
    expect(buildCreateSbtPasswordListPatch({ passwordList: 'bad' })).toEqual({
      passwordList: [],
    });
    const bookmarkedSbtsSet = new Set(['0xabc']);
    expect(buildCreateSbtBookmarkedSbtsSetPatch({ bookmarkedSbtsSet })).toEqual({
      bookmarkedSbtsSet,
    });
    expect(buildCreateSbtBookmarkedSbtsSetPatch({ bookmarkedSbtsSet: 'bad' }).bookmarkedSbtsSet.size).toBe(0);
    expect(buildCreateSbtPredictedAddressBusyPatch()).toEqual({
      predictedAddressBusy: true,
      predictedAddressStatus: 'Calculating address…',
    });
    expect(buildCreateSbtPredictedAddressPatch({
      predictedAddress: '0xabc',
      predictedAddressStatus: '',
      predictedAddressBusy: false,
    })).toEqual({
      predictedAddress: '0xabc',
      predictedAddressStatus: '',
      predictedAddressBusy: false,
    });
    expect(buildCreateSbtMintResetFailurePatch({ error: 'Failed' })).toEqual({
      mintingFailed: true,
      startedMinting: false,
      currentStep: 0,
      error: 'Failed',
    });
    expect(buildCreateSbtMintValidationFailurePatch({ error: 'Required' })).toEqual({
      mintingFailed: true,
      error: 'Required',
    });
    expect(buildCreateSbtMintSuccessPatch({
      passwordList: ['one'],
      sbtAddress: '0xabc',
    })).toEqual({
      sbtMinted: true,
      sbtAddress: '0xabc',
      currentStep: 3,
      passwordList: ['one'],
    });
    expect(buildCreateSbtMintSuccessPatch({
      passwordList: 'bad',
    })).toEqual({
      sbtMinted: true,
      sbtAddress: '',
      currentStep: 3,
      passwordList: [],
    });
    expect(buildCreateSbtEditResetPatch()).toEqual({
      sbtMinted: false,
      sbtAddress: '',
      currentStep: 0,
      startedMinting: false,
      mintingFailed: false,
      error: '',
      imageUploaded: false,
      tokenUriUploaded: false,
    });
    expect(buildCreateSbtEditResetPatch({ resetUploadState: false })).toEqual({
      sbtMinted: false,
      sbtAddress: '',
      currentStep: 0,
      startedMinting: false,
      mintingFailed: false,
      error: '',
    });
    expect(buildCreateSbtErrorPatch({ error: 'Plain' })).toEqual({
      error: 'Plain',
    });
    expect(buildCreateSbtMintStartPatch()).toEqual({
      startedMinting: true,
      mintingFailed: false,
      error: '',
    });
    const metadataLockGateIds = { name: ['gate-a'] };
    expect(buildCreateSbtMetadataLockGateIdsPatch({ metadataLockGateIds })).toEqual({
      metadataLockGateIds,
    });
    expect(buildCreateSbtMetadataLockFallbackPatch({
      fallbackGateIds: ['gate-b'],
      fieldKey: 'name',
      lockKey: 'name-lock',
      metadataLockGateIds: {
        description: ['gate-a'],
        invalid: ['gate-z'],
      },
    })).toEqual({
      metadataLockGateIds: {
        description: ['gate-a'],
        documentURLs: [],
        image: [],
        name: ['gate-b'],
        tags: [],
      },
      openLockKey: 'name-lock',
    });
    expect(buildCreateSbtCountdownStartPatch()).toEqual({
      countdownActive: true,
      countdown: 12,
    });
    expect(buildCreateSbtSymbolPatch({ sbtSymbol: 'CE-SBT-1' })).toEqual({
      sbtSymbol: 'CE-SBT-1',
    });
    expect(buildCreateSbtShareableUrlPatch({ autoJoinUrl: '/s/alpha' })).toEqual({
      shareableUrl: '/s/alpha',
      autoJoinUrl: '/s/alpha',
    });
    expect(buildCreateSbtInviteLinksBackupPatch({
      sbtInviteLinks: ['link'],
      sbtInviteBackupDate: '2026-05-05',
    })).toEqual({
      sbtInviteLinks: ['link'],
      sbtInviteBackupDate: '2026-05-05',
    });
    expect(buildCreateSbtNumInviteLinksPatch({ numInviteLinks: 7 })).toEqual({
      numInviteLinks: 7,
    });
    expect(buildCreateSbtNumInviteLinksPatch({ numInviteLinks: undefined })).toEqual({
      numInviteLinks: '',
    });
    expect(buildCreateSbtExportFormatPatch({ exportFormat: 'csv' })).toEqual({
      exportFormat: 'csv',
    });
    expect(buildCreateSbtExportFormatPatch({ exportFormat: null })).toEqual({
      exportFormat: '',
    });
    expect(buildCreateSbtImageUploadMethodPatch({
      useImageUrl: true,
    })).toEqual({
      useImageUrl: true,
      sbtImageFile: null,
      sbtImageUrl: '',
      imageLoadError: false,
      imageChooserStatusText: '',
      imageChooserStatusTone: 'default',
      lockedImageAsset: null,
    });
    expect(buildCreateSbtImageResetPatch()).toEqual({
      useImageUrl: false,
      sbtImageFile: null,
      sbtImageUrl: '',
      imageLoadError: false,
      imageChooserStatusText: '',
      imageChooserStatusTone: 'default',
      lockedImageAsset: null,
    });
    const imageFile = { name: 'badge.png' };
    expect(buildCreateSbtImageFilePatch({
      clearLockedAsset: true,
      file: imageFile,
    })).toEqual({
      sbtImageFile: imageFile,
      imageLoadError: false,
      lockedImageAsset: null,
    });
    expect(buildCreateSbtImageLoadErrorPatch({
      clearLockedAsset: true,
    })).toEqual({
      imageLoadError: true,
      sbtImageFile: null,
      lockedImageAsset: null,
    });
    expect(buildCreateSbtImageLoadErrorPatch({ clearFile: false })).toEqual({
      imageLoadError: true,
    });
    expect(buildCreateSbtImageLoadReadyPatch()).toEqual({
      imageLoadError: false,
    });
    expect(buildCreateSbtInputChangePatch({
      name: 'sbtName',
      value: 'Alpha group',
    })).toEqual({
      sbtName: 'Alpha group',
    });
    expect(buildCreateSbtInputChangePatch({
      name: 'sbtImageUrl',
      value: 'https://example.test/badge.png',
    })).toEqual({
      sbtImageUrl: 'https://example.test/badge.png',
      lockedImageAsset: null,
      imageChooserStatusText: '',
      imageChooserStatusTone: 'default',
    });
    expect(buildCreateSbtImageFileClearPatch({ clearLockedAsset: true })).toEqual({
      sbtImageFile: null,
      lockedImageAsset: null,
    });
    expect(buildCreateSbtSelectedImageFilePatch({
      file: imageFile,
      statusText: 'Ready',
      statusTone: 'loading',
    })).toEqual({
      useImageUrl: false,
      sbtImageFile: imageFile,
      sbtImageUrl: '',
      imageLoadError: false,
      imageChooserStatusText: 'Ready',
      imageChooserStatusTone: 'loading',
      lockedImageAsset: null,
    });
    expect(buildCreateSbtSelectedImageFilePatch({
      file: imageFile,
      sbtImageUrl: 'https://example.test/badge.png',
      useImageUrl: true,
    })).toEqual({
      useImageUrl: true,
      sbtImageFile: imageFile,
      sbtImageUrl: 'https://example.test/badge.png',
      imageLoadError: false,
      imageChooserStatusText: '',
      imageChooserStatusTone: 'default',
      lockedImageAsset: null,
    });
    expect(buildCreateSbtImageChooserStatusPatch({
      statusText: 'Loading preview...',
      statusTone: 'loading',
    })).toEqual({
      imageChooserStatusText: 'Loading preview...',
      imageChooserStatusTone: 'loading',
    });
    expect(buildCreateSbtImageChooserStatusPatch()).toEqual({
      imageChooserStatusText: '',
      imageChooserStatusTone: 'default',
    });
    expect(buildCreateSbtCountdownTickPatch({
      state: { countdown: 2, countdownActive: true },
    })).toEqual({ countdown: 1 });
    expect(buildCreateSbtCountdownTickPatch({
      state: { countdown: 1, countdownActive: true },
    })).toEqual({ countdown: 0, countdownActive: false });
    expect(buildCreateSbtDeferredSaveCompletePatch()).toEqual({
      startedMinting: false,
      mintingFailed: false,
      currentStep: 0,
      error: '',
    });
    expect(buildCreateSbtDeferredUploadFallbackPatch()).toEqual({
      tokenURI: '',
      tokenUriUploaded: false,
      startedMinting: false,
      mintingFailed: false,
      currentStep: 0,
      error: '',
    });
    expect(buildCreateSbtDistributionFieldPatch({
      fieldKey: 'burnAuth',
      fieldValue: 1,
      state: { sbtDistribution: { isLimited: true } },
    })).toEqual({
      sbtDistribution: {
        isLimited: true,
        burnAuth: 1,
      },
    });
    expect(buildCreateSbtDistributionFieldPatch({
      fieldKey: 'mintingEndTime',
      fieldValue: '2026-01-01T00:00:00.000Z',
      state: null,
    })).toEqual({
      sbtDistribution: {
        mintingEndTime: '2026-01-01T00:00:00.000Z',
      },
    });
    expect(buildCreateSbtNetworkChangePatch({
      chain: { id: 11155420, name: 'OP Sepolia' },
      currentDistribution: { burnAuth: 1, network: { id: 84532 } },
      network: 11155420,
    })).toEqual({
      network: 11155420,
      sbtDistribution: {
        burnAuth: 1,
        network: { id: 11155420, name: 'OP Sepolia' },
      },
    });
  });
});
