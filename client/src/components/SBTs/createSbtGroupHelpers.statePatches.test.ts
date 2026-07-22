import {
  buildCreateSbtActiveClassName,
  buildCreateSbtActionLinkClassName,
  buildCreateSbtBookmarkedSbtsSetPatch,
  buildCreateSbtBooleanTogglePatch,
  buildCreateSbtCollapseHeaderClassName,
  buildCreateSbtCollapseTogglePatch,
  buildCreateSbtCopiedLinkIndexPatch,
  buildCreateSbtCopySuccessPatch,
  buildCreateSbtCountdownStartPatch,
  buildCreateSbtCountdownTickPatch,
  buildCreateSbtDeferredSaveCompletePatch,
  buildCreateSbtDeferredUploadFallbackPatch,
  buildCreateSbtDistributionFieldPatch,
  buildCreateSbtEditResetPatch,
  buildCreateSbtErrorPatch,
  buildCreateSbtExportFormatPatch,
  buildCreateSbtGroupHashPatch,
  buildCreateSbtImageChooserStatusPatch,
  buildCreateSbtImageFileClearPatch,
  buildCreateSbtImageFilePatch,
  buildCreateSbtImageLoadErrorPatch,
  buildCreateSbtImageLoadReadyPatch,
  buildCreateSbtImageResetPatch,
  buildCreateSbtImageUploadMethodPatch,
  buildCreateSbtInitialState,
  buildCreateSbtInlineFieldLockClassName,
  buildCreateSbtInputChangePatch,
  buildCreateSbtInviteLinksBackupPatch,
  buildCreateSbtMetadataLockFallbackPatch,
  buildCreateSbtMetadataLockGateIdsPatch,
  buildCreateSbtMintResetFailurePatch,
  buildCreateSbtMintStartPatch,
  buildCreateSbtMintSuccessPatch,
  buildCreateSbtMintValidationFailurePatch,
  buildCreateSbtNetworkChangePatch,
  buildCreateSbtNumInviteLinksPatch,
  buildCreateSbtOpenLockKeyPatch,
  buildCreateSbtPasswordListPatch,
  buildCreateSbtPredictedAddressBusyPatch,
  buildCreateSbtPredictedAddressPatch,
  buildCreateSbtSelectedImageFilePatch,
  buildCreateSbtShareableUrlPatch,
  buildCreateSbtSymbolPatch,
  buildCreateSbtTokenInfoMetaCardClassName,
  resolveCreateSbtActionIconStyle,
  resolveCreateSbtCollapseHeaderDisplayState,
  resolveCreateSbtFailureIconStyle,
  resolveCreateSbtHiddenQrDisplayState,
  resolveCreateSbtShareableTooltipIconStyle,
  resolveCreateSbtTooltipIconStyle,
} from './createSbtGroupHelpers';

describe('createSbtGroupHelpers state patch helpers', () => {
  it('builds CreateSBT initial state around reset defaults and constructor-only fields', () => {
    const deferredCreate2SaltBuilder = jest.fn(() => 'draft/initial-salt');
    const initialState = buildCreateSbtInitialState({
      account: '0xAdmin',
      authoringChain: { chainId: 11155420, chain: { id: 11155420, name: 'OP Sepolia' } },
      deferredCreate2SaltBuilder,
      deferredDeploy: true,
    });

    expect(deferredCreate2SaltBuilder).toHaveBeenCalledTimes(1);
    expect(initialState).toEqual(
      expect.objectContaining({
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
      }),
    );
    expect(initialState.bookmarkedSbtsSet).toEqual(new Set());

    deferredCreate2SaltBuilder.mockClear();
    expect(
      buildCreateSbtInitialState({
        deferredCreate2SaltBuilder,
        deferredDeploy: false,
      }),
    ).toEqual(
      expect.objectContaining({
        deferredCreate2Salt: '',
        mintOptionsCollapsed: true,
        distributionOptionsCollapsed: true,
      }),
    );
    expect(deferredCreate2SaltBuilder).not.toHaveBeenCalled();
    expect(
      buildCreateSbtCollapseTogglePatch({
        section: 'mintOptionsCollapsed',
        state: { mintOptionsCollapsed: true },
      }),
    ).toEqual({ mintOptionsCollapsed: false });
    expect(
      buildCreateSbtCollapseTogglePatch({
        section: 'distributionOptionsCollapsed',
        state: { distributionOptionsCollapsed: 1 },
      }),
    ).toEqual({ distributionOptionsCollapsed: false });
    expect(
      buildCreateSbtCollapseTogglePatch({
        section: 'tokenInfoCollapsed',
        state: null,
      }),
    ).toEqual({ tokenInfoCollapsed: true });
    expect(
      resolveCreateSbtCollapseHeaderDisplayState({
        isCollapsed: true,
        title: 'Token Info',
      }),
    ).toEqual({
      ariaExpanded: false,
      ariaLabel: 'Expand Token Info',
      shouldRenderCollapsedTitle: true,
      shouldRenderClosedIcon: true,
      shouldRenderOpenIcon: false,
      shouldUseOpenClass: false,
    });
    expect(
      resolveCreateSbtCollapseHeaderDisplayState({
        isCollapsed: false,
        title: 'Token Info',
      }),
    ).toEqual({
      ariaExpanded: true,
      ariaLabel: 'Collapse Token Info',
      shouldRenderCollapsedTitle: false,
      shouldRenderClosedIcon: false,
      shouldRenderOpenIcon: true,
      shouldUseOpenClass: true,
    });
    expect(
      buildCreateSbtCollapseHeaderClassName({
        baseClassName: 'section-header',
        openClassName: 'section-header-open',
        shouldUseOpenClass: false,
      }),
    ).toBe('section-header');
    expect(
      buildCreateSbtCollapseHeaderClassName({
        baseClassName: 'section-header',
        openClassName: 'section-header-open',
        shouldUseOpenClass: true,
      }),
    ).toBe('section-header section-header-open');
    expect(
      buildCreateSbtActiveClassName({
        activeClassName: 'active-option',
        baseClassNames: 'option-card',
        shouldUseActiveClass: false,
      }),
    ).toBe('option-card');
    expect(
      buildCreateSbtActiveClassName({
        activeClassName: 'setting-row-active',
        baseClassNames: ['setting-row', 'setting-toggle-row'],
        shouldUseActiveClass: true,
      }),
    ).toBe('setting-row setting-toggle-row setting-row-active');
    expect(
      buildCreateSbtActionLinkClassName({
        actionClassName: 'action-btn',
        linkClassName: 'action-link',
      }),
    ).toBe('action-btn action-link');
    expect(
      buildCreateSbtInlineFieldLockClassName({
        baseClassName: 'field-lock',
        inlineClassName: 'field-lock-inline',
      }),
    ).toBe('field-lock field-lock-inline');
    expect(
      buildCreateSbtTokenInfoMetaCardClassName({
        fieldSectionClassName: 'field-section',
        metaCardClassName: 'token-meta-card',
      }),
    ).toBe('field-section token-meta-card');
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
    expect(
      buildCreateSbtBooleanTogglePatch({
        state: { showJson: false },
        stateKey: 'showJson',
      }),
    ).toEqual({ showJson: true });
    expect(
      buildCreateSbtBooleanTogglePatch({
        state: { showJson: 'open' },
        stateKey: 'showJson',
      }),
    ).toEqual({ showJson: false });
    expect(
      buildCreateSbtCopySuccessPatch({
        stateKey: 'copyIdSuccess',
      }),
    ).toEqual({ copyIdSuccess: true });
    expect(
      buildCreateSbtCopySuccessPatch({
        stateKey: 'copyJsonSuccess',
        copied: false,
      }),
    ).toEqual({ copyJsonSuccess: false });
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
    expect(
      buildCreateSbtPredictedAddressPatch({
        predictedAddress: '0xabc',
        predictedAddressStatus: '',
        predictedAddressBusy: false,
      }),
    ).toEqual({
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
    expect(
      buildCreateSbtMintSuccessPatch({
        passwordList: ['one'],
        sbtAddress: '0xabc',
      }),
    ).toEqual({
      sbtMinted: true,
      sbtAddress: '0xabc',
      currentStep: 3,
      passwordList: ['one'],
    });
    expect(
      buildCreateSbtMintSuccessPatch({
        passwordList: 'bad',
      }),
    ).toEqual({
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
      encryptedRecoveryEnabled: false,
      encryptedRecoveryStatus: 'idle',
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
      encryptedRecoveryEnabled: false,
      encryptedRecoveryStatus: 'idle',
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
    expect(
      buildCreateSbtMetadataLockFallbackPatch({
        fallbackGateIds: ['gate-b'],
        fieldKey: 'name',
        lockKey: 'name-lock',
        metadataLockGateIds: {
          description: ['gate-a'],
          invalid: ['gate-z'],
        },
      }),
    ).toEqual({
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
    expect(
      buildCreateSbtInviteLinksBackupPatch({
        sbtInviteLinks: ['link'],
        sbtInviteBackupDate: '2026-05-05',
      }),
    ).toEqual({
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
    expect(
      buildCreateSbtImageUploadMethodPatch({
        useImageUrl: true,
      }),
    ).toEqual({
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
    expect(
      buildCreateSbtImageFilePatch({
        clearLockedAsset: true,
        file: imageFile,
      }),
    ).toEqual({
      sbtImageFile: imageFile,
      imageLoadError: false,
      lockedImageAsset: null,
    });
    expect(
      buildCreateSbtImageLoadErrorPatch({
        clearLockedAsset: true,
      }),
    ).toEqual({
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
    expect(
      buildCreateSbtInputChangePatch({
        name: 'sbtName',
        value: 'Alpha group',
      }),
    ).toEqual({
      sbtName: 'Alpha group',
    });
    expect(
      buildCreateSbtInputChangePatch({
        name: 'sbtImageUrl',
        value: 'https://example.test/badge.png',
      }),
    ).toEqual({
      sbtImageUrl: 'https://example.test/badge.png',
      lockedImageAsset: null,
      imageChooserStatusText: '',
      imageChooserStatusTone: 'default',
    });
    expect(buildCreateSbtImageFileClearPatch({ clearLockedAsset: true })).toEqual({
      sbtImageFile: null,
      lockedImageAsset: null,
    });
    expect(
      buildCreateSbtSelectedImageFilePatch({
        file: imageFile,
        statusText: 'Ready',
        statusTone: 'loading',
      }),
    ).toEqual({
      useImageUrl: false,
      sbtImageFile: imageFile,
      sbtImageUrl: '',
      imageLoadError: false,
      imageChooserStatusText: 'Ready',
      imageChooserStatusTone: 'loading',
      lockedImageAsset: null,
    });
    expect(
      buildCreateSbtSelectedImageFilePatch({
        file: imageFile,
        sbtImageUrl: 'https://example.test/badge.png',
        useImageUrl: true,
      }),
    ).toEqual({
      useImageUrl: true,
      sbtImageFile: imageFile,
      sbtImageUrl: 'https://example.test/badge.png',
      imageLoadError: false,
      imageChooserStatusText: '',
      imageChooserStatusTone: 'default',
      lockedImageAsset: null,
    });
    expect(
      buildCreateSbtImageChooserStatusPatch({
        statusText: 'Loading preview...',
        statusTone: 'loading',
      }),
    ).toEqual({
      imageChooserStatusText: 'Loading preview...',
      imageChooserStatusTone: 'loading',
    });
    expect(buildCreateSbtImageChooserStatusPatch()).toEqual({
      imageChooserStatusText: '',
      imageChooserStatusTone: 'default',
    });
    expect(
      buildCreateSbtCountdownTickPatch({
        state: { countdown: 2, countdownActive: true },
      }),
    ).toEqual({ countdown: 1 });
    expect(
      buildCreateSbtCountdownTickPatch({
        state: { countdown: 1, countdownActive: true },
      }),
    ).toEqual({ countdown: 0, countdownActive: false });
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
    expect(
      buildCreateSbtDistributionFieldPatch({
        fieldKey: 'burnAuth',
        fieldValue: 1,
        state: { sbtDistribution: { isLimited: true } },
      }),
    ).toEqual({
      sbtDistribution: {
        isLimited: true,
        burnAuth: 1,
      },
    });
    expect(
      buildCreateSbtDistributionFieldPatch({
        fieldKey: 'mintingEndTime',
        fieldValue: '2026-01-01T00:00:00.000Z',
        state: null,
      }),
    ).toEqual({
      sbtDistribution: {
        mintingEndTime: '2026-01-01T00:00:00.000Z',
      },
    });
    expect(
      buildCreateSbtNetworkChangePatch({
        chain: { id: 11155420, name: 'OP Sepolia' },
        currentDistribution: { burnAuth: 1, network: { id: 84532 } },
        network: 11155420,
      }),
    ).toEqual({
      network: 11155420,
      sbtDistribution: {
        burnAuth: 1,
        network: { id: 11155420, name: 'OP Sepolia' },
      },
    });
  });
});
