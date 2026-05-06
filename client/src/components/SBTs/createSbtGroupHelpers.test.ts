import {
  areMetadataLockGateMapsEqual,
  areStringArraysEqual,
  asCreateSbtGateBoundary,
  resolveCreateSbtActionDisplayState,
  buildCreateSbtAccountDistributionSyncPatch,
  buildCreateSbtAccountDistributionSyncStatePatch,
  buildCreateSbtActiveClassName,
  buildCreateSbtActionLinkClassName,
  buildCreateSbtResourceKeyByGateId,
  buildCreateSbtScopedLockGateId,
  buildCreateSbtAutoCreate2SaltSource,
  buildCreateSbtBookmarkedSbtsSetPatch,
  buildCreateSbtBooleanTogglePatch,
  buildCreateSbtCollapseHeaderClassName,
  buildCreateSbtCollapseTogglePatch,
  buildCreateSbtCopiedLinkIndexPatch,
  buildCreateSbtCopySuccessPatch,
  buildCreateSbtCountdownTickPatch,
  buildCreateSbtCountdownStartPatch,
  buildCreateSbtCurrentTagInputPatch,
  buildCreateSbtDeferredDraftCreate2Salt,
  buildCreateSbtDeferredSaveCompletePatch,
  buildCreateSbtDeferredUploadFallbackPatch,
  buildCreateSbtDeterministicSymbol,
  buildCreateSbtDistributionFieldPatch,
  buildCreateSbtDocumentUrlAdditionPatch,
  buildCreateSbtDocumentUrlRemovalPatch,
  buildCreateSbtDocumentIdHashList,
  buildCreateSbtDefaultDistributionState,
  buildCreateSbtEditResetPatch,
  buildCreateSbtErrorPatch,
  buildCreateSbtAutoJoinUrl,
  buildEffectiveCreateSbtDocumentUrls,
  buildCreateSbtExportFormatPatch,
  buildCreateSbtGroupHashPatch,
  buildCreateSbtGroupPasswordPredictableEntryPatch,
  buildCreateSbtGroupPasswordPredictableExitPatch,
  buildCreateSbtOpenLockKeyPatch,
  buildCreateSbtEncryptedImageAsset,
  buildCreateSbtFieldAccessDescriptor,
  buildCreateSbtFormCachePayload,
  buildCreateSbtImageFileClearPatch,
  buildCreateSbtImageFilePatch,
  buildCreateSbtImageChooserStatusPatch,
  buildCreateSbtImageLoadErrorPatch,
  buildCreateSbtImageLoadReadyPatch,
  buildCreateSbtImageResetPatch,
  buildCreateSbtImageUploadMethodPatch,
  buildCreateSbtImagePreviewState,
  buildCreateSbtInlineFieldLockClassName,
  buildCreateSbtInputChangePatch,
  buildCreateSbtSelectedImageFilePatch,
  buildCreateSbtInitialState,
  buildCreateSbtInviteLinksBackupPatch,
  buildCreateSbtMetadataEncryption,
  buildCreateSbtInviteLinks,
  buildCreateSbtJsonPreviewData,
  buildCreateSbtNetworkChangePatch,
  buildCreateSbtMetadataLockSelectionState,
  buildCreateSbtMetadataLockFallbackPatch,
  buildCreateSbtMetadataLockGateIdsPatch,
  buildCreateSbtMetadataLockSelectionPatch,
  buildCreateSbtMetadataPreviewTagList,
  buildCreateSbtMintResetFailurePatch,
  buildCreateSbtMintStartPatch,
  buildCreateSbtMintSuccessPatch,
  buildCreateSbtMintValidationFailurePatch,
  buildCreateSbtGateOptionsFromConfig,
  buildCreateSbtGateOptionsFromSessionSources,
  buildCreateSbtNumInviteLinksPatch,
  buildCreateSbtGateObjectsAndRecipients,
  buildCreateSbtRecipientAccessControlState,
  buildCreateSbtAuthoringContractRefs,
  buildCreateSbtPasswordExportFile,
  buildCreateSbtPasswordListPatch,
  buildCreateSbtPredictedAddressBusyPatch,
  buildCreateSbtPredictedAddressPatch,
  buildCreateSbtProgressIndicatorState,
  buildCreateSbtProgressStepClassName,
  buildCreateSbtAuthoringChainSyncPatch,
  buildCreateSbtAuthoringChainSyncStatePatch,
  buildCreateSbtPreviewEncryptedImageAsset,
  buildCreateSbtPredictableDeploySignature,
  buildCreateSbtRelevantDefaultTagSyncPatch,
  buildCreateSbtRelevantDefaultTagSyncState,
  buildCreateSbtRenderState,
  buildCreateSbtResetFormState,
  buildCreateSbtShareableUrlPatch,
  buildCreateSbtRestoredCollapseState,
  buildCreateSbtRestoredDistributionState,
  buildCreateSbtRestoredScalarState,
  buildCreateSbtTagAdditionState,
  buildCreateSbtTagRemovalState,
  buildCreateSbtSymbolPatch,
  buildCreateSbtTokenInfoMetaCardClassName,
  buildCreateSbtTokenTagList,
  buildSessionRoutePath,
  buildUniqueTagList,
  contractRefMatchesChain,
  createEmptyMetadataLockGateIds,
  getErrorMessage,
  getCanonicalCreateSbtMetadataImageUrl,
  getConfiguredContractAddress,
  getCreateSbtBurnAuthEnum,
  getCreateSbtObjectEntries,
  getCreateSbtRecipientAccessControlConditions,
  getCreateSbtValidGateIds,
  getFetchableCreateSbtImageUrl,
  getMetadataFieldLockGateIds,
  generateCreateSbtInviteNonces,
  generateCreateSbtRandomHexString,
  hasUsableCreateSbtFactoryForChain,
  isPlainObject,
  METADATA_LOCK_FIELDS,
  normalizeAddressList,
  normalizeComparableAddress,
  normalizeGateIds,
  normalizeGateText,
  normalizeCreateSbtMetadataLockGateIdsForValidGates,
  normalizeMetadataLockGateIds,
  normalizePositiveChainId,
  normalizeCreateSbtDocumentUrlDraft,
  normalizeCreateSbtRestoredTags,
  normalizeCreateSbtLitGateChainIdFallback,
  normalizeSessionContractRef,
  parseDefaultSbtTags,
  removeCreateSbtDocumentUrlAtIndex,
  resolveCreateSbtAuthoringChainState,
  resolveCreateSbtActionIconStyle,
  resolveCreateSbtAuthoringChainOptions,
  resolveCreateSbtBookmarkActionDisplayState,
  resolveCreateSbtCachedDistributionChainId,
  resolveCreateSbtClearFormButtonState,
  resolveCreateSbtCollapseHeaderDisplayState,
  resolveCreateSbtCopyActionDisplayState,
  resolveCreateSbtDocumentUrlInputState,
  resolveCreateSbtErrorBannerState,
  resolveCreateSbtFailureIconStyle,
  resolveCreateSbtPreferredAuthoringChainId,
  resolveCreateSbtHiddenQrDisplayState,
  resolveCreateSbtEncryptedFieldGateValue,
  resolveCreateSbtInfoDisplayState,
  resolveCreateSbtInviteCodeList,
  resolveCreateSbtLockAudienceSessionName,
  resolveCreateSbtRestoredDeferredCreate2Salt,
  resolveCreateSbtMemoizedImageDataUrl,
  resolveCreateSbtMetadataFieldGateIds,
  resolveCreateSbtLitGateChainId,
  resolveCreateSbtMetadataImageSource,
  resolveCreateSbtMetadataSessionSlug,
  resolveCreateSbtMintOptionsDisplayState,
  resolveCreateSbtPasswordGenerationCount,
  resolveCreateSbtPrimaryActionLabel,
  resolveCreateSbtPredictedAddressCacheHit,
  resolveCreateSbtPredictablePasswordListDecision,
  resolveCreateSbtPredictableDeployBaseState,
  resolveCreateSbtOpenMintAutoJoinUrl,
  resolveCreateSbtPredictableAddressActive,
  resolveCreateSbtPrimaryButtonState,
  resolveCreateSbtPredictedAddressDisplayText,
  resolveCreateSbtLegacyDescriptionLockGateIds,
  resolveCreateSbtRestoredMetadataLockGateIds,
  resolveCreateSbtRestoredPredictableAddressEnabled,
  resolveCreateSbtEffectiveSessionSlug,
  resolveCreateSbtShareableTooltipIconStyle,
  resolveCreateSbtSuccessDisplayState,
  resolveCreateSbtTagInputState,
  resolveCreateSbtTooltipIconStyle,
  requireCreateSbtRecipientsForGateSelection,
  sanitizeCreateSbtGateForMetadata,
  selectPreferredChainId,
  shouldFallbackCreateSbtDeferredDraftUpload,
  shouldHideCreateSbtNetworkSelector,
  stableGateColor,
  writeCreateSbtEncryptedFieldGate,
} from './createSbtGroupHelpers';

describe('createSbtGroupHelpers', () => {
  it('normalizes errors and route paths', () => {
    const errorBannerStyle = {
      margin: '10px 0 16px',
      padding: '10px 12px',
      border: '1px solid #dc3545',
      background: '#ffecec',
      color: '#a4000f',
      borderRadius: '6px',
      fontWeight: 600,
    };
    expect(getErrorMessage(new Error('boom'), 'fallback')).toBe('boom');
    expect(getErrorMessage({ message: 'plain' }, 'fallback')).toBe('plain');
    expect(getErrorMessage('', 'fallback')).toBe('fallback');
    expect(resolveCreateSbtErrorBannerState({ error: ' Failure ' })).toEqual({
      errorMessage: ' Failure ',
      shouldRenderErrorBanner: true,
      style: errorBannerStyle,
    });
    expect(resolveCreateSbtErrorBannerState({ error: '   ' })).toEqual({
      errorMessage: '   ',
      shouldRenderErrorBanner: false,
      style: errorBannerStyle,
    });
    expect(resolveCreateSbtErrorBannerState({ error: 0 })).toEqual({
      errorMessage: '0',
      shouldRenderErrorBanner: false,
      style: errorBannerStyle,
    });
    expect(shouldFallbackCreateSbtDeferredDraftUpload(new Error('Worker URL is missing'))).toBe(true);
    expect(shouldFallbackCreateSbtDeferredDraftUpload(new Error('invalid address.'))).toBe(true);
    expect(shouldFallbackCreateSbtDeferredDraftUpload(new Error('hard failure'))).toBe(false);
    expect(shouldFallbackCreateSbtDeferredDraftUpload('')).toBe(false);
    expect(shouldHideCreateSbtNetworkSelector({ hideNetworkSelector: true })).toBe(true);
    expect(shouldHideCreateSbtNetworkSelector({ deferredDeploy: true })).toBe(true);
    expect(shouldHideCreateSbtNetworkSelector({ hideNetworkSelector: 0, deferredDeploy: '' })).toBe(false);
    expect(buildSessionRoutePath(' Edge Session ', '/base/')).toBe('/base/session/Edge%20Session');
    expect(buildSessionRoutePath('', '/base/')).toBe('/base/session');
    expect(buildCreateSbtAutoJoinUrl({
      origin: 'https://context.example/',
      basePath: '/app/',
      sessionSlug: ' Edge Session ',
      sbtAddress: '0x000000000000000000000000000000000000000A',
    })).toBe('https://context.example/app/session/Edge%20Session?sbt=0x000000000000000000000000000000000000000A&auto=1');
    expect(buildCreateSbtAutoJoinUrl({
      origin: 'https://context.example',
      sessionSlug: '',
      sbtAddress: '0xA B',
    })).toBe('https://context.example/session?sbt=0xA%20B&auto=1');
    expect(buildCreateSbtAutoJoinUrl({
      origin: '',
      sbtAddress: '0xA',
    })).toBe('');
    const buildSessionAutoJoinUrl = jest.fn(() => 'built-url');
    expect(resolveCreateSbtOpenMintAutoJoinUrl({
      autoJoinUrl: 'cached-url',
      buildSessionAutoJoinUrl,
      distributionOption: 'anyoneCanMint',
      sbtAddress: '0xA',
    })).toBe('cached-url');
    expect(buildSessionAutoJoinUrl).not.toHaveBeenCalled();
    expect(resolveCreateSbtOpenMintAutoJoinUrl({
      buildSessionAutoJoinUrl,
      distributionOption: 'anyoneCanMint',
      sbtAddress: '0xA',
    })).toBe('built-url');
    expect(buildSessionAutoJoinUrl).toHaveBeenCalledWith('0xA');
    expect(resolveCreateSbtOpenMintAutoJoinUrl({
      buildSessionAutoJoinUrl,
      distributionOption: 'groupPassword',
      sbtAddress: '0xA',
    })).toBe('');
    expect(buildCreateSbtAutoCreate2SaltSource({
      sessionSlug: ' Edge ',
      sbtName: ' Deferred Group! ',
      groupHash: '0xabcdef',
    })).toBe('Edge/deferred-group');
    expect(buildCreateSbtAutoCreate2SaltSource({
      sessionSlug: '',
      sbtName: '',
      groupHash: '0xabcdef1234567890',
    })).toBe('general/group-abcdef1234');
    expect(buildCreateSbtAutoCreate2SaltSource({
      sessionSlug: 'General',
      sbtName: '',
      groupHash: '',
    })).toBe('general/group-draft');
    expect(buildCreateSbtDeterministicSymbol({
      saltSource: 'edge/group',
      digest: (value) => `0xabcdef123456-${value}`,
    })).toBe('CE-SBT-ABCDEF');
    expect(buildCreateSbtDeterministicSymbol({
      saltSource: '',
      digest: (value) => (value === 'context-engine-sbt' ? '0x123456' : ''),
    })).toBe('CE-SBT-123456');
    expect(resolveCreateSbtPredictedAddressDisplayText({
      predictedAddress: ' 0xabc ',
    })).toBe('0xabc');
    expect(resolveCreateSbtPredictedAddressDisplayText({
      predictedAddressBusy: true,
    })).toBe('Pending…');
    expect(resolveCreateSbtPredictedAddressDisplayText({
      unavailableReason: 'Enter a group name to preview the address.',
    })).toBe('Pending group name…');
    expect(resolveCreateSbtPredictedAddressDisplayText({
      unavailableReason: 'Connect a wallet to preview the address.',
      walletLowerLabel: 'wallet',
    })).toBe('Pending admin account…');
    expect(resolveCreateSbtPredictedAddressDisplayText({
      unavailableReason: 'Other reason',
    })).toBe('Pending…');
    expect(resolveCreateSbtPredictableAddressActive({
      deferredDeployMode: true,
    })).toBe(true);
    expect(resolveCreateSbtPredictableAddressActive({
      predictableAddressEnabled: true,
    })).toBe(true);
    expect(resolveCreateSbtPredictableAddressActive({
      create2Salt: ' salt ',
    })).toBe(true);
    expect(resolveCreateSbtPredictableAddressActive({
      create2Salt: ' ',
      deferredDeployMode: false,
      predictableAddressEnabled: false,
    })).toBe(false);
    expect(resolveCreateSbtPredictableDeployBaseState({
      sbtName: ' Alpha Group ',
      burnAdmin: ' 0xAdmin ',
      isLimited: true,
      limitedNumber: '3.8',
    })).toEqual({
      adminAddress: '0xAdmin',
      limitedCount: 3,
      sbtNameTrimmed: 'Alpha Group',
      unavailableReason: '',
    });
    expect(resolveCreateSbtPredictableDeployBaseState({
      account: '0xAccount',
      sbtName: '',
    }).unavailableReason).toBe('Enter a group name to preview the address.');
    expect(resolveCreateSbtPredictableDeployBaseState({
      sbtName: 'Alpha',
      walletLowerLabel: 'wallet',
    }).unavailableReason).toBe('Connect a wallet to preview the address.');
    expect(resolveCreateSbtPredictableDeployBaseState({
      account: '0xAccount',
      isLimited: true,
      limitedNumber: 'bad',
      sbtName: 'Alpha',
    }).unavailableReason).toBe('Set a positive mint limit to preview the address.');
    expect(resolveCreateSbtPredictedAddressCacheHit({
      allowCached: true,
      cachedShapeSignature: 'shape-a',
      predictedAddress: ' 0xCached ',
      predictionSignature: 'shape-a',
    })).toEqual({
      predictedAddress: '0xCached',
      predictionSignature: 'shape-a',
    });
    expect(resolveCreateSbtPredictedAddressCacheHit({
      allowCached: false,
      cachedShapeSignature: 'shape-a',
      predictedAddress: '0xCached',
      predictionSignature: 'shape-a',
    })).toBeNull();
    expect(resolveCreateSbtPredictedAddressCacheHit({
      allowCached: true,
      cachedShapeSignature: 'shape-b',
      predictedAddress: '0xCached',
      predictionSignature: 'shape-a',
    })).toBeNull();
    expect(resolveCreateSbtPredictedAddressCacheHit({
      allowCached: true,
      cachedShapeSignature: 'shape-a',
      predictedAddress: ' ',
      predictionSignature: 'shape-a',
    })).toBeNull();
    expect(JSON.parse(buildCreateSbtPredictableDeploySignature({
      predictionShape: {
        contractName: ' Alpha ',
        symbol: ' ALP ',
        limitedNumber: '3',
        adminAddress: ' 0xADMIN ',
        mintingEndTimeUnix: '1700000000',
        mintModeOnChain: 2,
        hasPasswordMintOnChain: true,
        burnAuthEnum: '1',
        hashedPasswords: ['0xhash'],
        create2Salt: ' salt ',
        initializeGroupPasswordHash: true,
        groupCfg: {
          contracts: {
            sbtFactory: {
              address: ' 0xF00 ',
              chainId: '84532',
            },
          },
        },
      },
      network: { id: 10 },
      selectedAuthoringChainId: 11155420,
    }))).toEqual({
      contractName: 'Alpha',
      symbol: 'ALP',
      limitedNumber: 3,
      adminAddress: '0xadmin',
      mintingEndTimeUnix: 1700000000,
      mintModeOnChain: 2,
      hasPasswordMintOnChain: true,
      burnAuthEnum: 1,
      hashedPasswords: ['0xhash'],
      create2Salt: 'salt',
      initializeGroupPasswordHash: true,
      sbtFactoryAddress: '0xf00',
      networkChainId: 84532,
    });
    expect(JSON.parse(buildCreateSbtPredictableDeploySignature({
      predictionShape: { groupCfg: {}, hashedPasswords: 'bad' },
      network: { chainId: 84532 },
      selectedAuthoringChainId: '',
    }))).toMatchObject({
      hashedPasswords: [],
      networkChainId: 84532,
    });
    expect(buildCreateSbtPredictableDeploySignature({
      predictionShape: null,
    })).toBe('');
    expect(resolveCreateSbtEffectiveSessionSlug({ props: { sessionSlug: 'prop-slug' } })).toBe('prop-slug');
    expect(resolveCreateSbtEffectiveSessionSlug({ props: { slug: 'legacy-prop' } })).toBe('legacy-prop');
    expect(resolveCreateSbtEffectiveSessionSlug({ pathname: '/demo/demo-slug/new' })).toBe('demo-slug');
    expect(resolveCreateSbtEffectiveSessionSlug({ pathname: '/sbts/session-slug/new' })).toBe('session-slug');
    expect(resolveCreateSbtEffectiveSessionSlug({ pathname: '/sbts/new' })).toBe('');
    expect(resolveCreateSbtMetadataSessionSlug({
      effectiveSessionSlug: ' Effective ',
      sessionConfigSlug: 'fallback',
    })).toBe('Effective');
    expect(resolveCreateSbtMetadataSessionSlug({
      sessionConfigSlug: ' fallback ',
    })).toBe('fallback');
    expect(resolveCreateSbtMetadataSessionSlug({
      deferredDeployMode: false,
    })).toBe('');
    expect(() => resolveCreateSbtMetadataSessionSlug({
      deferredDeployMode: true,
      sbtLabel: 'Group',
    })).toThrow('Set the session URL before adding this Group to the session.');
  });

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

  it('selects the preferred chain from candidates and optional allowed ids', () => {
    expect(selectPreferredChainId(['bad', 10, 84532], [84532])).toBe(84532);
    expect(selectPreferredChainId([0, '11155420'], [])).toBe(11155420);
    expect(selectPreferredChainId([], [84532])).toBeNull();
  });

  it('resolves authoring chain state from options, registry fallback, and empty ids', () => {
    const getChainByIdMock = jest.fn((chainId) => (
      chainId === 11155420 ? { id: chainId, name: 'OP Sepolia' } : null
    ));

    expect(resolveCreateSbtAuthoringChainState({
      chainId: 84532,
      chainOptions: [{ id: 84532, name: 'Base Sepolia' }],
      getChainById: getChainByIdMock,
    })).toEqual({
      chainId: 84532,
      chain: { id: 84532, name: 'Base Sepolia' },
    });

    expect(resolveCreateSbtAuthoringChainState({
      chainId: 11155420,
      chainOptions: [],
      getChainById: getChainByIdMock,
    })).toEqual({
      chainId: 11155420,
      chain: { id: 11155420, name: 'OP Sepolia' },
    });

    expect(resolveCreateSbtAuthoringChainState({
      chainId: null,
      chainOptions: [{ id: 84532, name: 'Base Sepolia' }],
      getChainById: getChainByIdMock,
    })).toEqual({
      chainId: null,
      chain: 'not connected',
    });
    expect(getChainByIdMock).toHaveBeenCalledWith(0);
    expect(buildCreateSbtDefaultDistributionState({
      account: '0xAdmin',
      authoringChain: { chainId: 84532, chain: { id: 84532, name: 'Base Sepolia' } },
    })).toEqual({
      isLimited: false,
      limitedNumber: 0,
      hasAdmin: false,
      adminAddress: '0xAdmin',
      isRevocable: false,
      isTimeLimited: false,
      mintingEndTime: null,
      distributionOption: 'anyoneCanMint',
      burnAuth: 'AdminOnly',
      burnAdmin: '0xAdmin',
      network: { id: 84532, name: 'Base Sepolia' },
      unlisted: false,
    });
    expect(buildCreateSbtDefaultDistributionState({
      account: '',
      authoringChain: { chainId: null, chain: 'not connected' },
    }).network).toBe('not connected');
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

  it('normalizes Lit gate chain id fallbacks', () => {
    expect(normalizeCreateSbtLitGateChainIdFallback(84532)).toBe(84532);
    expect(normalizeCreateSbtLitGateChainIdFallback(' 11155420 ')).toBe('11155420');
    expect(normalizeCreateSbtLitGateChainIdFallback('  ')).toBeNull();
    expect(normalizeCreateSbtLitGateChainIdFallback({})).toBeNull();
    expect(resolveCreateSbtLitGateChainId('10', '84532')).toBe(10);
    expect(resolveCreateSbtLitGateChainId('', '84532')).toBe(84532);
    expect(resolveCreateSbtLitGateChainId('', 'not-number')).toBe('not-number');
  });

  it('sanitizes metadata lock gates without leaking raw gate fields', () => {
    const sanitized = sanitizeCreateSbtGateForMetadata({
      gateId: ' gate-a ',
      label: ' Alpha Gate ',
      badgeLabel: ' Badge ',
      secondaryLabel: ' Secondary ',
      resourceKey: ' ai ',
      color: '',
      mode: 'all',
      sbtAddresses: [' 0xA ', '0xa'],
      sbtAddress: '0xB',
      chainId: '84532',
      extraRawField: 'hidden',
    });

    expect(sanitized).toEqual({
      type: 'sbt',
      gateId: 'gate-a',
      id: 'gate-a',
      label: 'Alpha Gate',
      displayLabel: 'Alpha Gate',
      badgeLabel: 'Badge',
      secondaryLabel: 'Secondary',
      resourceKey: 'ai',
      color: stableGateColor('gate-a'),
      mode: 'all',
      requireAll: true,
      sbtAddresses: ['0xA', '0xB'],
      sbtAddress: '0xA',
      chainId: 84532,
      litChain: 'baseSepolia',
    });
    expect(sanitizeCreateSbtGateForMetadata({ gateId: 'gate-a' })).toBeNull();
    expect(sanitizeCreateSbtGateForMetadata({ sbtAddress: '0xA' })).toBeNull();
  });

  it('builds resolved metadata lock gates and deduped Lit recipients', () => {
    const addressA = '0x00000000000000000000000000000000000000aa';
    const addressB = '0x00000000000000000000000000000000000000bb';

    const result = buildCreateSbtGateObjectsAndRecipients({
      chainIdFallback: 84532,
      gateIds: ['gate-b', 'missing', 'gate-a', 'gate-duplicate'],
      gateMap: {
        'gate-a': {
          label: 'Alpha',
          sbtAddresses: [addressA, addressA.toUpperCase()],
          sbtAddress: addressB,
          mode: 'all',
        },
        'gate-b': {
          name: 'Beta',
          color: '#123456',
          sbtAddress: addressB,
          chainId: '11155420',
        },
        'gate-duplicate': {
          label: 'Alpha Copy',
          sbtAddress: addressB,
          chainId: '11155420',
        },
        skipped: { label: 'Skipped' },
      },
    });

    expect(result.gates.map((gate) => gate.gateId)).toEqual(['gate-b', 'gate-a', 'gate-duplicate']);
    expect(result.gates[0]).toMatchObject({
      gateId: 'gate-b',
      id: 'gate-b',
      label: 'Beta',
      color: '#123456',
      sbtAddresses: [addressB],
      sbtAddress: addressB,
      chainId: 11155420,
      litChain: 'optimismSepolia',
      mode: 'any',
      type: 'sbt',
    });
    expect(result.gates[1]).toMatchObject({
      gateId: 'gate-a',
      label: 'Alpha',
      sbtAddresses: [addressA, addressB],
      chainId: 84532,
      litChain: 'baseSepolia',
      mode: 'all',
    });
    expect(result.recipients).toHaveLength(2);
    expect(result.recipients[0]).toMatchObject({
      chain: 'optimismSepolia',
      accessControlConditions: [
        {
          contractAddress: addressB,
          chain: 'optimismSepolia',
          method: 'balanceOf',
        },
      ],
    });
    expect(result.recipients[1].accessControlConditions).toEqual([
      expect.objectContaining({ contractAddress: addressA, chain: 'baseSepolia' }),
      { operator: 'and' },
      expect.objectContaining({ contractAddress: addressB, chain: 'baseSepolia' }),
    ]);
  });

  it('requires Lit recipients when metadata lock gates are selected', () => {
    expect(() => requireCreateSbtRecipientsForGateSelection({
      gateIds: ['gate-1'],
      recipients: [],
      scopeLabel: 'content',
      gateLowerLabel: 'access rule',
      gatesLowerLabel: 'access rules',
    })).toThrow('Selected lock access rule (gate-1) for content do not resolve to valid Lit recipients.');

    expect(() => requireCreateSbtRecipientsForGateSelection({
      gateIds: ['gate-1', 'gate-2'],
      recipients: [],
      scopeLabel: 'image',
      gateLowerLabel: 'access rule',
      gatesLowerLabel: 'access rules',
    })).toThrow('Selected lock access rules (gate-1, gate-2) for image do not resolve to valid Lit recipients.');

    expect(() => requireCreateSbtRecipientsForGateSelection({
      gateIds: [],
      recipients: [],
    })).not.toThrow();
    expect(() => requireCreateSbtRecipientsForGateSelection({
      gateIds: ['gate-1'],
      recipients: [{ accessControlConditions: [] }],
    })).not.toThrow();
  });

  it('merges recipient access control conditions while preserving primary fallback fields', () => {
    const conditionA = { contractAddress: '0x00000000000000000000000000000000000000aa' };
    const conditionB = { contractAddress: '0x00000000000000000000000000000000000000bb' };

    expect(buildCreateSbtRecipientAccessControlState({
      recipients: [
        { accessControlConditions: [conditionA], chain: 'baseSepolia' },
        { accessControlConditions: 'bad', chain: 'ignored' },
        { accessControlConditions: [conditionB], chain: 'optimismSepolia' },
      ],
    })).toEqual({
      combinedAccessControlConditions: [
        conditionA,
        { operator: 'or' },
        conditionB,
      ],
      primaryAccessControlConditions: [conditionA],
      primaryChain: 'baseSepolia',
      primaryRecipient: {
        accessControlConditions: [conditionA],
        chain: 'baseSepolia',
      },
    });

    expect(buildCreateSbtRecipientAccessControlState({
      recipients: [
        'bad',
        { accessControlConditions: [conditionB], chain: 'optimismSepolia' },
      ],
    })).toEqual({
      combinedAccessControlConditions: [conditionB],
      primaryAccessControlConditions: undefined,
      primaryChain: null,
      primaryRecipient: {},
    });
  });

  it('builds encrypted image asset metadata from upload results and preview masks', () => {
    expect(buildCreateSbtEncryptedImageAsset({
      uploadResult: { txId: '  arweaveTx123  ' },
    })).toEqual({
      storage: 'lit-arweave',
      txId: 'arweaveTx123',
    });
    expect(buildCreateSbtEncryptedImageAsset({
      uploadResult: { txId: '   ' },
    })).toBeNull();
    expect(buildCreateSbtEncryptedImageAsset()).toBeNull();
    expect(buildCreateSbtPreviewEncryptedImageAsset('[encrypted]')).toEqual({
      storage: 'lit-arweave',
      txId: '[encrypted]',
    });
  });

  it('builds field access descriptors from selected lock gates', () => {
    const descriptor = buildCreateSbtFieldAccessDescriptor({
      chainIdFallback: 84532,
      gateIds: ['missing', 'gate-a', 'gate-b'],
      gateMap: {
        'gate-a': {
          gateId: 'gate-a',
          label: 'Alpha',
          sbtAddresses: [
            '0x00000000000000000000000000000000000000aa',
            '0x00000000000000000000000000000000000000aa',
          ],
        },
        'gate-b': {
          gateId: 'gate-b',
          label: 'Beta',
          sbtAddress: '0x00000000000000000000000000000000000000bb',
          chainId: '11155420',
        },
      },
    });

    expect(descriptor).toMatchObject({
      type: 'sbt',
      gateIds: ['gate-a', 'gate-b'],
      sbtAddresses: [
        '0x00000000000000000000000000000000000000aa',
        '0x00000000000000000000000000000000000000bb',
      ],
      sbtAddress: '0x00000000000000000000000000000000000000aa',
      chainId: 84532,
      litChain: 'baseSepolia',
    });
    expect(descriptor?.gates.map((gate) => gate.gateId)).toEqual(['gate-a', 'gate-b']);
    expect(buildCreateSbtFieldAccessDescriptor({
      gateIds: ['missing'],
      gateMap: { 'gate-a': { gateId: 'gate-a', sbtAddress: '0xA' } },
    })).toBeNull();
    expect(buildCreateSbtFieldAccessDescriptor({
      gateIds: ['gate-a'],
      gateMap: { 'gate-a': { gateId: 'gate-a' } },
    })).toBeNull();
  });

  it('builds metadata encryption envelopes from selected field gates', () => {
    const gateMap = {
      'gate-a': {
        gateId: 'gate-a',
        label: 'Alpha',
        sbtAddress: '0x00000000000000000000000000000000000000aa',
      },
      'gate-b': {
        gateId: 'gate-b',
        label: 'Beta',
        sbtAddress: '0x00000000000000000000000000000000000000bb',
      },
    };

    const payload = buildCreateSbtMetadataEncryption({
      chainIdFallback: 84532,
      defaultGateId: 'gate-b',
      encryptedFieldGates: {
        name: 'gate-a',
        description: ['gate-a', 'gate-b'],
        tags: ['missing'],
      },
      gateMap,
    });

    expect(payload.encryptedFieldGates).toEqual({
      name: 'gate-a',
      description: ['gate-a', 'gate-b'],
    });
    expect(payload.encryption).toMatchObject({
      enabled: true,
      status: 'lit-v1',
      defaultGateId: 'gate-b',
      gateIds: ['gate-a', 'gate-b'],
      targets: {
        name: true,
        description: true,
      },
    });
    expect(payload.encryption?.gates.map((gate) => gate.gateId)).toEqual(['gate-a', 'gate-b']);
    expect(buildCreateSbtMetadataEncryption({
      encryptedFieldGates: { name: ['missing'] },
      gateMap,
    })).toEqual({
      encryptedFieldGates: null,
      encryption: null,
    });
  });

  it('builds metadata gate options from explicit gates and canonical defaults', () => {
    const explicit = buildCreateSbtGateOptionsFromConfig({
      chainIdFallback: 84532,
      defaultGateId: 'gate-b',
      encryptionGates: [
        {
          id: 'gate-a',
          resourceKey: 'ai',
          sbtAddress: '0xA',
          mode: 'any',
        },
        {
          gateId: 'gate-b',
          secondaryLabel: 'surveyResponses',
          sbtAddresses: ['0xB', '0xC'],
          requireAll: true,
          chainId: 11155420,
        },
      ],
      sessionConfig: { sessionName: 'Alpha Session' },
    });

    expect(Object.keys(explicit.gateMap)).toEqual(['gate-a', 'gate-b']);
    expect(explicit.defaultGateId).toBe('gate-b');
    expect(explicit.gateOptions).toEqual([
      expect.objectContaining({
        id: 'gate-b',
        label: 'Alpha Session',
        secondaryLabel: '',
        sbtAddresses: ['0xB', '0xC'],
        requireAll: true,
        chainId: 11155420,
      }),
    ]);
    expect(explicit.gateMap['gate-b'].secondaryLabel).toBe('survey');

    const configuredDefault = buildCreateSbtGateOptionsFromConfig({
      chainIdFallback: 84532,
      sessionConfig: {
        slug: 'beta',
        sponsored: {
          defaultGateId: 'gate-default',
          gates: {
            'gate-ai': {
              gateId: 'gate-ai',
              resourceKey: 'ai',
              sbtAddress: '0xA',
            },
            'gate-default': {
              gateId: 'gate-default',
              resourceKey: 'default',
              sbtAddress: '0xD',
            },
          },
        },
      },
    });

    expect(configuredDefault.defaultGateId).toBe('gate-default');
    expect(configuredDefault.gateOptions).toEqual([
      expect.objectContaining({
        id: 'gate-default',
        label: 'beta',
        sbtAddress: '0xD',
      }),
    ]);
  });

  it('builds scoped metadata gate options from session sources', () => {
    const scoped = buildCreateSbtGateOptionsFromSessionSources({
      preferredSessionSlug: 'beta',
      chainIdFallback: 84532,
      sessionSources: [
        {
          sessionSlug: 'alpha',
          sessionConfig: { slug: 'alpha', sessionName: 'Alpha Session', networkChainId: 84532 },
          encryptionGates: [
            { gateId: 'gate-a', sbtAddress: '0xA', resourceKey: 'default' },
          ],
        },
        {
          sessionSlug: 'beta',
          sessionConfig: { slug: 'beta', sessionName: 'Beta Session', networkChainId: 11155420 },
          encryptionGates: [
            { gateId: 'gate-b', sbtAddresses: ['0xB', '0xC'], mode: 'all' },
          ],
        },
      ],
    });

    expect(scoped.defaultGateId).toBe('session:beta::gate-b');
    expect(scoped.gateOptions.map((gate) => gate.id)).toEqual([
      'session:alpha::gate-a',
      'session:beta::gate-b',
    ]);
    expect(scoped.gateMap['session:beta::gate-b']).toEqual(expect.objectContaining({
      sourceGateId: 'gate-b',
      sourceSessionSlug: 'beta',
      label: 'Beta Session',
      requireAll: true,
      sbtAddresses: ['0xB', '0xC'],
      chainId: 11155420,
    }));
    expect(buildCreateSbtGateOptionsFromSessionSources({
      sessionSources: [null, { sessionConfig: null }],
    })).toEqual({
      gateMap: {},
      gateOptions: [],
      defaultGateId: '',
    });
  });

  it('filters authoring chain options to chains with SBT factories', () => {
    const hasUsableSbtFactoryForChain = jest.fn((chainId) => chainId === 11155420);

    expect(resolveCreateSbtAuthoringChainOptions({
      getSessionRegistryChains: () => [
        { id: 84532, name: 'Base Sepolia' },
        null,
        { id: 11155420, name: 'OP Sepolia' },
        { name: 'Missing id' },
      ],
      hasUsableSbtFactoryForChain,
    })).toEqual([{ id: 11155420, name: 'OP Sepolia' }]);
    expect(hasUsableSbtFactoryForChain).toHaveBeenCalledWith(84532);
    expect(hasUsableSbtFactoryForChain).toHaveBeenCalledWith(11155420);
    expect(resolveCreateSbtAuthoringChainOptions({
      getSessionRegistryChains: () => null,
      hasUsableSbtFactoryForChain,
    })).toEqual([]);
  });

  it('resolves preferred authoring chain ids before wallet fallback', () => {
    expect(resolveCreateSbtPreferredAuthoringChainId({
      availableChainIds: [84532, 11155420],
      network: { id: 10, chainId: 84532 },
      resolvedSessionConfig: { networkChainId: 11155420 },
      selectedChainId: 84532,
      sessionConfigOverride: { networkChainId: 10 },
    })).toBe(84532);

    expect(resolveCreateSbtPreferredAuthoringChainId({
      availableChainIds: [84532, 11155420],
      network: { id: 11155420 },
      resolvedSessionConfig: { networkChainId: 84532 },
      selectedChainId: 10,
      sessionConfigOverride: null,
    })).toBe(84532);

    expect(resolveCreateSbtPreferredAuthoringChainId({
      availableChainIds: [11155420],
      network: { chainId: 11155420 },
      selectedChainId: '',
      sessionConfigOverride: null,
      resolvedSessionConfig: null,
    })).toBe(11155420);
  });

  it('normalizes session contract refs and compares chain matches', () => {
    expect(normalizeSessionContractRef({ address: ' 0xSBT ', chainID: '84532' })).toEqual({
      address: '0xSBT',
      chainId: 84532,
    });
    expect(normalizeSessionContractRef({ chain: 10 })).toEqual({ chainId: 10 });
    expect(normalizeSessionContractRef(null, 11155420)).toEqual({ chainId: 11155420 });
    expect(normalizeSessionContractRef({})).toBeNull();
    expect(contractRefMatchesChain({ address: '0xA', chainId: 84532 }, 84532)).toBe(true);
    expect(contractRefMatchesChain({ address: '0xA', chainId: 10 }, 84532)).toBe(false);
    expect(contractRefMatchesChain({ address: '0xA' }, 84532)).toBe(true);
    expect(contractRefMatchesChain({}, 84532)).toBe(false);
  });

  it('builds authoring contract refs for the selected chain', () => {
    const getSessionContractsForChain = jest.fn((chainId) => (
      chainId === 11155420
        ? {
            sbtFactory: { address: '0xOPFactory', chainId: 11155420 },
            surveys: { address: '0xOPSurveys', chainId: 11155420 },
            registry: { address: '0xOPRegistry' },
          }
        : {
            sbtFactory: { address: '0xBaseFactory', chainId: 84532 },
            surveys: { address: '0xBaseSurveys', chainId: 84532 },
          }
    ));
    const resolveSessionContractRef = jest.fn(({ contractKey }) => ({
      address: contractKey === 'surveys' ? '0xAliasSurveys' : '',
      chainId: 11155420,
    }));

    expect(buildCreateSbtAuthoringContractRefs({ networkId: '' })).toEqual({});
    expect(buildCreateSbtAuthoringContractRefs({
      getSessionContractsForChain,
      networkId: 84532,
      sessionConfig: {
        networkChainId: 84532,
        contracts: {
          custom: { address: '0xCustomBase', chainId: 84532 },
        },
      },
    })).toMatchObject({
      custom: { address: '0xCustomBase', chainId: 84532 },
      sbtFactory: { address: '0xBaseFactory', chainId: 84532 },
    });

    expect(buildCreateSbtAuthoringContractRefs({
      getSessionContractsForChain,
      networkId: 11155420,
      resolveSessionContractRef,
      sessionConfig: {
        networkChainId: 84532,
        contracts: {
          sbtFactory: { address: '0xStaleBaseFactory', chainId: 84532 },
          custom: { address: '0xStaleCustom', chainId: 84532 },
        },
      },
    })).toEqual({
      sbtFactory: { address: '0xOPFactory', chainId: 11155420 },
      custom: { address: '0xStaleCustom', chainId: 84532 },
      surveys: { address: '0xOPSurveys', chainId: 11155420 },
      registry: { address: '0xOPRegistry', chainId: 11155420 },
    });
    expect(resolveSessionContractRef).toHaveBeenCalledWith({
      contractKey: 'surveys',
      sessionConfig: expect.objectContaining({ networkChainId: 84532 }),
    });
  });

  it('deduplicates address lists case-insensitively', () => {
    expect(normalizeAddressList([' 0xA ', '0xa', '0xB', '', null])).toEqual(['0xA', '0xB']);
  });

  it('deduplicates tag lists case-insensitively while preserving first casing', () => {
    expect(buildUniqueTagList([' Alpha ', 'alpha', 'Beta', '', null, ' beta '])).toEqual(['Alpha', 'Beta']);
    expect(buildUniqueTagList('bad')).toEqual([]);
    expect(parseDefaultSbtTags(' alpha, beta ,,Gamma ')).toEqual(['alpha', 'beta', 'Gamma']);
    expect(parseDefaultSbtTags('  ')).toEqual([]);
    expect(parseDefaultSbtTags(['alpha'])).toEqual([]);
    expect(normalizeCreateSbtRestoredTags([' Alpha ', '', null])).toEqual([' Alpha ', '', null]);
    expect(normalizeCreateSbtRestoredTags(' alpha, beta ,,Gamma ')).toEqual(['alpha', 'beta', 'Gamma']);
    expect(normalizeCreateSbtRestoredTags(null)).toEqual([]);
    expect(buildCreateSbtTokenTagList(['Alpha', '', '  ', 'Beta'])).toEqual(['Alpha', 'Beta']);
    expect(buildCreateSbtMetadataPreviewTagList(['Alpha', '', '  ', 'Beta', 7])).toEqual(['Alpha', 'Beta', 7]);
    expect(buildCreateSbtMetadataPreviewTagList('bad')).toEqual([]);
    expect(buildCreateSbtCurrentTagInputPatch({ value: 'Alpha' })).toEqual({
      currentTagInput: 'Alpha',
    });
    expect(buildCreateSbtCurrentTagInputPatch({ value: null })).toEqual({
      currentTagInput: '',
    });
    expect(buildCreateSbtDocumentIdHashList(' hash-a, hash-b ,, ')).toEqual(['hash-a', 'hash-b', '', '']);
    expect(buildCreateSbtDocumentIdHashList('  ')).toEqual([]);
  });

  it('builds tag addition state while clearing matching default tag bookkeeping', () => {
    expect(resolveCreateSbtTagInputState({
      currentTagInput: ' Alpha ',
    })).toEqual({
      shouldShowAddTagButton: true,
    });
    expect(resolveCreateSbtTagInputState({
      currentTagInput: '   ',
    })).toEqual({
      shouldShowAddTagButton: false,
    });
    expect(buildCreateSbtTagAdditionState({
      autoAppliedDefaultTags: ['Auto', 'Keep'],
      dismissedDefaultTags: ['auto', 'Other'],
      tagValue: ' Auto ',
      tags: ['Manual'],
    })).toEqual({
      autoAppliedDefaultTags: ['Keep'],
      currentTagInput: '',
      dismissedDefaultTags: ['Other'],
      showTagsInput: true,
      tags: ['Manual', 'Auto'],
    });
    expect(buildCreateSbtTagAdditionState({
      autoAppliedDefaultTags: 'bad',
      dismissedDefaultTags: null,
      tagValue: 'Solo',
      tags: 'bad',
    })).toEqual({
      autoAppliedDefaultTags: [],
      currentTagInput: '',
      dismissedDefaultTags: [],
      showTagsInput: true,
      tags: ['Solo'],
    });
  });

  it('builds tag removal state with default-tag dismissal bookkeeping', () => {
    expect(buildCreateSbtTagRemovalState({
      autoAppliedDefaultTags: ['Auto', 'Keep'],
      defaultTags: ['Auto', 'Other'],
      dismissedDefaultTags: ['Existing'],
      indexToRemove: 1,
      removedTag: 'Auto',
      tags: ['Manual', 'Auto', 'Keep'],
    })).toEqual({
      autoAppliedDefaultTags: ['Keep'],
      dismissedDefaultTags: ['Existing', 'Auto'],
      tags: ['Manual', 'Keep'],
    });
    expect(buildCreateSbtTagRemovalState({
      autoAppliedDefaultTags: ['Auto'],
      defaultTags: ['Default'],
      dismissedDefaultTags: ['Existing'],
      indexToRemove: 'bad',
      removedTag: 'Missing',
      tags: ['Manual', 'Auto'],
    })).toEqual({
      autoAppliedDefaultTags: ['Auto'],
      dismissedDefaultTags: ['Existing'],
      tags: ['Manual', 'Auto'],
    });
  });

  it('builds relevant default tag sync state', () => {
    expect(buildCreateSbtRelevantDefaultTagSyncState({
      autoAppliedDefaultTags: [],
      currentShowTagsInput: false,
      dismissedDefaultTags: [],
      relevantDefaults: ['debate', 'governance', 'debate'],
      tags: [],
    })).toEqual({
      autoAppliedDefaultTags: ['debate', 'governance'],
      dismissedDefaultTags: [],
      shouldUpdate: true,
      showTagsInput: true,
      tags: ['debate', 'governance'],
    });

    expect(buildCreateSbtRelevantDefaultTagSyncState({
      autoAppliedDefaultTags: ['debate', 'governance'],
      currentShowTagsInput: true,
      dismissedDefaultTags: ['debate'],
      relevantDefaults: ['debate', 'governance'],
      tags: ['Manual', 'debate', 'governance'],
    })).toEqual({
      autoAppliedDefaultTags: ['governance'],
      dismissedDefaultTags: ['debate'],
      shouldUpdate: true,
      showTagsInput: true,
      tags: ['Manual', 'governance'],
    });

    expect(buildCreateSbtRelevantDefaultTagSyncState({
      autoAppliedDefaultTags: ['Auto'],
      currentShowTagsInput: true,
      dismissedDefaultTags: ['Dismissed'],
      relevantDefaults: ['Auto'],
      resetDismissed: true,
      tags: ['Auto'],
    })).toEqual({
      autoAppliedDefaultTags: ['Auto'],
      dismissedDefaultTags: [],
      shouldUpdate: true,
      showTagsInput: true,
      tags: ['Auto'],
    });

    expect(buildCreateSbtRelevantDefaultTagSyncState({
      autoAppliedDefaultTags: ['Auto'],
      currentShowTagsInput: true,
      dismissedDefaultTags: [],
      relevantDefaults: ['Auto'],
      tags: ['Auto'],
    }).shouldUpdate).toBe(false);
    expect(buildCreateSbtRelevantDefaultTagSyncPatch({
      autoAppliedDefaultTags: ['Auto'],
      dismissedDefaultTags: ['Dismissed'],
      showTagsInput: true,
      tags: ['Manual', 'Auto'],
    })).toEqual({
      tags: ['Manual', 'Auto'],
      autoAppliedDefaultTags: ['Auto'],
      dismissedDefaultTags: ['Dismissed'],
      showTagsInput: true,
    });
  });

  it('normalizes effective document URLs with pending draft limits', () => {
    expect(normalizeCreateSbtDocumentUrlDraft(' https://docs.example/a ')).toBe('https://docs.example/a');
    expect(buildEffectiveCreateSbtDocumentUrls({
      documentURLs: [' https://docs.example/a ', '', null, 'https://docs.example/b'],
      documentUrl: ' https://docs.example/c ',
    })).toEqual([
      'https://docs.example/a',
      'https://docs.example/b',
      'https://docs.example/c',
    ]);
    expect(buildEffectiveCreateSbtDocumentUrls({
      documentURLs: Array.from({ length: 10 }, (_, index) => `https://docs.example/${index}`),
      documentUrl: 'https://docs.example/overflow',
    })).toHaveLength(10);
    expect(buildEffectiveCreateSbtDocumentUrls({
      documentURLs: 'bad',
      documentUrl: '',
    })).toEqual([]);
    expect(resolveCreateSbtDocumentUrlInputState({
      documentURLs: ['https://docs.example/a'],
      documentUrl: ' https://docs.example/b ',
    })).toEqual({
      canAddDocumentUrl: true,
      documentUrlCount: 1,
    });
    expect(resolveCreateSbtDocumentUrlInputState({
      documentURLs: ['https://docs.example/a'],
      documentUrl: '   ',
    })).toEqual({
      canAddDocumentUrl: false,
      documentUrlCount: 1,
    });
    expect(resolveCreateSbtDocumentUrlInputState({
      documentURLs: Array.from({ length: 10 }, (_, index) => `https://docs.example/${index}`),
      documentUrl: 'https://docs.example/overflow',
    })).toEqual({
      canAddDocumentUrl: false,
      documentUrlCount: 10,
    });
    expect(buildCreateSbtDocumentUrlAdditionPatch({
      documentURLs: ['https://docs.example/a'],
      documentUrl: 'https://docs.example/b',
    })).toEqual({
      documentURLs: ['https://docs.example/a', 'https://docs.example/b'],
      documentUrl: '',
    });
    expect(buildCreateSbtDocumentUrlAdditionPatch({
      documentURLs: 'bad',
      documentUrl: 'https://docs.example/a',
    })).toEqual({
      documentURLs: ['https://docs.example/a'],
      documentUrl: '',
    });
  });

  it('removes document URLs with native splice index behavior', () => {
    expect(removeCreateSbtDocumentUrlAtIndex(['a', 'b', 'c'], 1)).toEqual(['a', 'c']);
    expect(removeCreateSbtDocumentUrlAtIndex(['a', 'b', 'c'], -1)).toEqual(['a', 'b']);
    expect(removeCreateSbtDocumentUrlAtIndex(['a', 'b', 'c'], 'bad')).toEqual(['b', 'c']);
    expect(removeCreateSbtDocumentUrlAtIndex('bad', 0)).toEqual([]);
    expect(buildCreateSbtDocumentUrlRemovalPatch({
      documentURLs: ['a', 'b', 'c'],
      index: 1,
    })).toEqual({
      documentURLs: ['a', 'c'],
    });
  });

  it('builds form cache payloads with serialized distribution and normalized fields', () => {
    const endTime = new Date('2026-01-02T03:04:05.000Z');
    const payload = buildCreateSbtFormCachePayload({
      selectedAuthoringChainId: 11155420,
      effectiveSessionSlug: 'edge-session',
      state: {
        sbtName: '  Edge SBT  ',
        sbtDescription: '  Useful group  ',
        sbtImageUrl: 'https://example.com/sbt.png',
        useImageUrl: true,
        sbtDistribution: {
          type: 'password',
          mintingEndTime: endTime,
          network: 84532,
        },
        tags: ['Alpha'],
        documentIDHashes: ['hash-a'],
        documentURLs: ['https://docs.example/a'],
        documentUrl: ' https://docs.example/pending ',
        groupPassword: 'pw',
        metadataLockGateIds: {
          name: 'gate-a',
          description: ['gate-b'],
          ignored: ['gate-c'],
        },
        predictableAddressEnabled: 'yes',
        autoAppliedDefaultTags: ['Default'],
        dismissedDefaultTags: 'bad',
        numInviteLinks: 3,
        exportFormat: 'csv',
        create2Salt: 'salt-a',
        deferredCreate2Salt: 'salt-b',
      },
    });

    expect(payload).toMatchObject({
      sbtName: 'Edge SBT',
      sbtDescription: 'Useful group',
      sbtImageUrl: 'https://example.com/sbt.png',
      useImageUrl: true,
      tags: ['Alpha'],
      documentIDHashes: ['hash-a'],
      documentURLs: ['https://docs.example/a'],
      documentUrl: 'https://docs.example/pending',
      groupPassword: 'pw',
      predictableAddressEnabled: true,
      autoAppliedDefaultTags: ['Default'],
      dismissedDefaultTags: [],
      numInviteLinks: 3,
      exportFormat: 'csv',
      create2Salt: 'salt-a',
      deferredCreate2Salt: 'salt-b',
      _sessionSlug: 'edge-session',
    });
    expect(payload.sbtDistribution).toEqual({
      type: 'password',
      mintingEndTime: '2026-01-02T03:04:05.000Z',
      network: 11155420,
    });
    expect(payload.metadataLockGateIds).toEqual({
      name: ['gate-a'],
      description: ['gate-b'],
      tags: [],
      documentURLs: [],
      image: [],
    });

    expect(buildCreateSbtFormCachePayload({
      state: { sbtName: 'Name', sbtDistribution: { mintingEndTime: '' } },
    }).sbtDistribution.network).toBe('not connected');
  });

  it('builds CreateSBT JSON preview data with normalized token URI and distribution fields', () => {
    const txId = 'DqYBh1qm9GvaTOGkF5R7abnLoB3OPiXNNBcTsYPtlRc';
    const groupPasswordPreview = buildCreateSbtJsonPreviewData({
      authoringChain: { name: 'OP Sepolia' },
      autoJoinUrl: 'https://app.example/session?sbt=0xabc',
      groupPassword: 'secret',
      network: 'Fallback Network',
      sbtAddress: '0xabc',
      sbtDistribution: {
        distributionOption: 'groupPassword',
      },
      sbtName: 'Preview SBT',
      shareableUrl: 'https://app.example/sbt/0xabc',
      tokenURI: `ar://${txId}`,
    });

    expect(groupPasswordPreview).toMatchObject({
      sbtName: 'Preview SBT',
      sbtAddress: '0xabc',
      network: 'OP Sepolia',
      distribution: 'groupPassword',
      groupPassword: 'secret',
      autoJoinUrl: 'https://app.example/session?sbt=0xabc',
      shareableUrl: 'https://app.example/sbt/0xabc',
    });
    expect(String(groupPasswordPreview.tokenURI)).toContain(txId);
    expect(String(groupPasswordPreview.tokenURI)).toMatch(/^https:\/\//);

    expect(buildCreateSbtJsonPreviewData({
      network: 'Base Sepolia',
      sbtDistribution: {
        distributionOption: 'open',
      },
      tokenURI: 'https://example.test/token.json',
    })).toEqual({
      sbtName: '',
      sbtAddress: '',
      tokenURI: 'https://example.test/token.json',
      network: 'Base Sepolia',
      distribution: 'open',
      groupPassword: undefined,
      autoJoinUrl: '',
      shareableUrl: '',
    });
  });

  it('builds CreateSBT metadata lock selection state from gate options', () => {
    expect(buildCreateSbtMetadataLockSelectionState({
      gateOptions: [
        { id: 'gate-a' },
        { id: '' },
        { id: 'gate-b' },
      ],
      metadataLockGateIds: {
        name: ['gate-a', 'missing'],
        description: 'gate-b',
        tags: ['missing'],
        documentURLs: ['gate-a', 'gate-b'],
        image: null,
      },
    })).toEqual({
      validGateIds: ['gate-a', 'gate-b'],
      nameSelectedGateIds: ['gate-a'],
      descriptionSelectedGateIds: ['gate-b'],
      tagsSelectedGateIds: [],
      docsSelectedGateIds: ['gate-a', 'gate-b'],
      imageSelectedGateIds: [],
    });
    expect(buildCreateSbtMetadataLockSelectionState({
      metadataLockGateIds: {
        name: ['gate-a'],
      },
    })).toMatchObject({
      validGateIds: [],
      nameSelectedGateIds: ['gate-a'],
    });
  });

  it('builds CreateSBT image preview status state', () => {
    const previewFile = { name: 'badge.png' };
    expect(buildCreateSbtImagePreviewState({
      sbtImageFile: previewFile,
    })).toMatchObject({
      effectiveImageStatusText: '',
      effectiveImageStatusTone: 'default',
      hasImagePreview: true,
      hasPendingImagePreview: false,
      previewFile,
      showImagePreviewError: false,
    });
    expect(buildCreateSbtImagePreviewState({
      sbtImageUrl: ' https://example.test/badge.png ',
      useImageUrl: true,
    })).toMatchObject({
      effectiveImageStatusText: 'Loading preview...',
      effectiveImageStatusTone: 'loading',
      hasImagePreview: false,
      hasPendingImagePreview: true,
      previewFile: null,
      showImagePreviewError: false,
    });
    expect(buildCreateSbtImagePreviewState({
      imageLoadError: true,
      sbtImageUrl: 'https://example.test/bad.png',
      useImageUrl: true,
    })).toMatchObject({
      effectiveImageStatusText: 'Image preview unavailable.',
      effectiveImageStatusTone: 'error',
      hasImagePreview: false,
      hasPendingImagePreview: false,
      showImagePreviewError: true,
    });
    expect(buildCreateSbtImagePreviewState({
      imageChooserStatusText: 'Custom status',
      imageChooserStatusTone: 'error',
      sbtImageUrl: 'https://example.test/badge.png',
      useImageUrl: true,
    })).toMatchObject({
      effectiveImageStatusText: 'Custom status',
      effectiveImageStatusTone: 'error',
      hasPendingImagePreview: true,
    });
  });

  it('builds CreateSBT render state without touching form controls', () => {
    expect(resolveCreateSbtInfoDisplayState({
      documentURLs: ['https://docs.example/a'],
      imageSelectedGateIds: ['gate-image'],
      nameSelectedGateIds: ['gate-name'],
      tags: ['alpha'],
    })).toEqual({
      shouldRenderDocumentUrlList: true,
      shouldRenderImageLockHelp: true,
      shouldRenderNameLockHelp: true,
      shouldRenderTagPills: true,
    });
    expect(resolveCreateSbtInfoDisplayState({
      documentURLs: [],
      imageSelectedGateIds: [],
      nameSelectedGateIds: [],
      tags: [],
    })).toEqual({
      shouldRenderDocumentUrlList: false,
      shouldRenderImageLockHelp: false,
      shouldRenderNameLockHelp: false,
      shouldRenderTagPills: false,
    });
    expect(resolveCreateSbtMintOptionsDisplayState({
      hideNetworkSelector: false,
      isLimited: true,
      isTimeLimited: true,
      predictableAddressActive: true,
      predictedAddressBusy: true,
    })).toEqual({
      shouldRenderLimitedNumberInput: true,
      shouldRenderNetworkReadonly: false,
      shouldRenderNetworkSelector: true,
      shouldRenderPredictableAddressBusy: true,
      shouldRenderPredictableAddressDetails: true,
      shouldRenderTimeLimitedInput: true,
      shouldUseLimitedOptionActiveClass: true,
      shouldUsePredictableAddressActiveClass: true,
      shouldUseTimeLimitedOptionActiveClass: true,
    });
    expect(resolveCreateSbtMintOptionsDisplayState({
      hideNetworkSelector: true,
      predictableAddressActive: false,
      predictedAddressBusy: true,
    })).toEqual({
      shouldRenderLimitedNumberInput: false,
      shouldRenderNetworkReadonly: true,
      shouldRenderNetworkSelector: false,
      shouldRenderPredictableAddressBusy: false,
      shouldRenderPredictableAddressDetails: false,
      shouldRenderTimeLimitedInput: false,
      shouldUseLimitedOptionActiveClass: false,
      shouldUsePredictableAddressActiveClass: false,
      shouldUseTimeLimitedOptionActiveClass: false,
    });
    expect(resolveCreateSbtActionDisplayState({
      currentStep: 2,
      distributionOption: 'groupPassword',
      mintingFailed: true,
      sbtMinted: true,
      startedMinting: true,
    })).toEqual({
      shouldRenderGroupPasswordInput: true,
      shouldRenderMintingFailureIcon: true,
      shouldRenderProgressIndicator: true,
      shouldRenderStartFreshButton: true,
    });
    expect(resolveCreateSbtActionDisplayState({
      currentStep: 0,
      distributionOption: 'anyoneCanMint',
      mintingFailed: true,
    })).toEqual({
      shouldRenderGroupPasswordInput: false,
      shouldRenderMintingFailureIcon: false,
      shouldRenderProgressIndicator: false,
      shouldRenderStartFreshButton: false,
    });
    expect(buildCreateSbtRenderState({
      distributionConfigs: [
        { label: 'Open', value: 'anyoneCanMint' },
        { label: 'Password', value: 'groupPassword' },
      ],
      distributionOption: 'groupPassword',
    })).toEqual({
      createActionLabel: 'Create',
      distributionOptions: [
        { label: 'Open', selected: false, shouldUseActiveClass: false, value: 'anyoneCanMint' },
        { label: 'Password', selected: true, shouldUseActiveClass: true, value: 'groupPassword' },
      ],
      headerTitle: 'Create',
      isDirty: false,
      isLimitedWithPasswords: false,
      isPasswordDistribution: true,
      predictableAddressLocked: true,
    });
    expect(buildCreateSbtRenderState({
      create2Salt: ' salt ',
      deferredDeployMode: true,
      deferredSurfaceBg: '#11182c',
      distributionConfigs: [{ value: 'anyoneCanMint' }],
      distributionOption: 'anyoneCanMint',
      documentUrl: ' https://example.test/doc ',
      imageSelectedGateIds: ['gate-image'],
      normalizeDocumentUrlDraft: (value) => [String(value || '').trim()],
      sbtName: ' Badge ',
    })).toMatchObject({
      createActionLabel: 'Add to Session',
      headerTitle: 'Add to Session',
      isDirty: true,
      predictableAddressLocked: true,
      rootSurfaceStyle: { '--ce-create-group-surface-bg': '#11182c' },
    });
    expect(buildCreateSbtRenderState({
      distributionOption: 'hasPasswords',
      isLimited: true,
    })).toMatchObject({
      isLimitedWithPasswords: true,
      isPasswordDistribution: true,
    });
    expect(resolveCreateSbtPrimaryActionLabel({
      createActionLabel: 'Add to Session',
      currentStep: 0,
    })).toBe('Add to Session');
    expect(resolveCreateSbtPrimaryActionLabel({ currentStep: 1 })).toBe('Uploading Image...');
    expect(resolveCreateSbtPrimaryActionLabel({ currentStep: 2 })).toBe('Uploading URI...');
    expect(resolveCreateSbtPrimaryActionLabel({
      currentStep: 3,
      mintingLabel: 'Minting',
    })).toBe('Minting...');
    expect(resolveCreateSbtPrimaryActionLabel({
      currentStep: 3,
      deferredDeployMode: true,
    })).toBe('Saving Draft...');
    expect(resolveCreateSbtPrimaryActionLabel({
      createActionLabel: 'Create',
      currentStep: 4,
    })).toBe('Create');
    expect(resolveCreateSbtPrimaryActionLabel({
      mintedLabel: 'Created',
      sbtMinted: true,
    })).toBe('Created!');
    expect(resolveCreateSbtPrimaryButtonState({
      sbtMinted: false,
      startedMinting: false,
    })).toEqual({
      disabled: false,
    });
    expect(resolveCreateSbtPrimaryButtonState({
      sbtMinted: true,
      startedMinting: false,
    })).toEqual({
      disabled: true,
    });
    expect(resolveCreateSbtPrimaryButtonState({
      sbtMinted: false,
      startedMinting: true,
    })).toEqual({
      disabled: true,
    });
    expect(resolveCreateSbtClearFormButtonState({
      isDirty: true,
      sbtMinted: false,
    })).toEqual({
      shouldShowClearFormButton: true,
    });
    expect(resolveCreateSbtClearFormButtonState({
      isDirty: false,
      sbtMinted: false,
    })).toEqual({
      shouldShowClearFormButton: false,
    });
    expect(resolveCreateSbtClearFormButtonState({
      isDirty: true,
      sbtMinted: true,
    })).toEqual({
      shouldShowClearFormButton: false,
    });
    expect(resolveCreateSbtCopyActionDisplayState({
      copied: false,
      defaultLabel: 'Copy ID',
    })).toEqual({
      label: 'Copy ID',
      shouldRenderCopiedIcon: false,
      shouldRenderDefaultIcon: true,
    });
    expect(resolveCreateSbtCopyActionDisplayState({
      copied: true,
      copiedLabel: 'Copied!',
      defaultLabel: 'Copy ID',
    })).toEqual({
      label: 'Copied!',
      shouldRenderCopiedIcon: true,
      shouldRenderDefaultIcon: false,
    });
    expect(resolveCreateSbtBookmarkActionDisplayState({
      bookmarkedSbtsSet: new Set(['0xabc']),
      sbtAddress: '0xAbC',
    })).toEqual({
      iconStyle: { color: '#ffe082' },
      isBookmarked: true,
    });
    expect(resolveCreateSbtBookmarkActionDisplayState({
      bookmarkedSbtsSet: new Set(['0xdef']),
      sbtAddress: '0xabc',
    })).toEqual({
      iconStyle: { color: undefined },
      isBookmarked: false,
    });
    expect(buildCreateSbtProgressIndicatorState({
      currentStep: 0,
      sbtMinted: false,
    })).toEqual({
      imageUploadStep: { completed: false, iconState: 'attention', spin: false },
      tokenUriUploadStep: { completed: false, iconState: 'attention', spin: false },
      mintStep: { completed: false, iconState: 'attention', spin: false },
    });
    expect(buildCreateSbtProgressIndicatorState({
      currentStep: 2,
      sbtMinted: false,
    })).toEqual({
      imageUploadStep: { completed: true, iconState: 'check', spin: false },
      tokenUriUploadStep: { completed: true, iconState: 'spinner', spin: true },
      mintStep: { completed: false, iconState: 'attention', spin: false },
    });
    expect(buildCreateSbtProgressIndicatorState({
      currentStep: 3,
      sbtMinted: false,
    })).toMatchObject({
      mintStep: { completed: true, iconState: 'spinner', spin: true },
    });
    expect(buildCreateSbtProgressIndicatorState({
      currentStep: 3,
      sbtMinted: true,
    })).toMatchObject({
      mintStep: { completed: true, iconState: 'check', spin: false },
    });
    expect(buildCreateSbtProgressStepClassName({
      completed: false,
      completedClassName: 'step-completed',
      pendingClassName: 'step',
    })).toBe('step');
    expect(buildCreateSbtProgressStepClassName({
      completed: true,
      completedClassName: 'step-completed',
      pendingClassName: 'step',
    })).toBe('step-completed');
    expect(resolveCreateSbtSuccessDisplayState({
      distributionOption: 'anyoneCanMint',
      openMintAutoJoinUrl: 'https://example.test/join',
      passwordList: ['recovery-code'],
      sbtMinted: true,
      showJson: true,
      startedMinting: true,
      tokenURI: 'ar://token',
    })).toEqual({
      shouldRenderContractAddress: true,
      shouldRenderGroupPasswordAutoJoin: false,
      shouldRenderInviteLinks: false,
      shouldRenderJsonPanel: true,
      shouldRenderOpenMintAutoJoin: true,
      shouldRenderPasswordRecovery: true,
      shouldRenderSuccessPanel: true,
      shouldRenderTokenUriLink: true,
    });
    expect(resolveCreateSbtSuccessDisplayState({
      distributionOption: 'hasPasswords',
      passwordList: ['recovery-code'],
      sbtInviteLinks: ['invite-link'],
      sbtMinted: true,
    })).toMatchObject({
      shouldRenderInviteLinks: true,
      shouldRenderPasswordRecovery: false,
      shouldRenderSuccessPanel: true,
    });
    expect(resolveCreateSbtSuccessDisplayState({
      distributionOption: 'groupPassword',
      sbtMinted: false,
      startedMinting: false,
    })).toMatchObject({
      shouldRenderContractAddress: false,
      shouldRenderGroupPasswordAutoJoin: true,
      shouldRenderJsonPanel: false,
      shouldRenderSuccessPanel: false,
    });
    expect(buildCreateSbtRenderState({
      distributionConfigs: 'bad',
      distributionOption: 'anyoneCanMint',
      normalizeDocumentUrlDraft: () => '',
    })).toMatchObject({
      distributionOptions: [],
      isDirty: false,
      isLimitedWithPasswords: false,
      isPasswordDistribution: false,
      predictableAddressLocked: false,
    });
  });

  it('maps burn auth labels to contract enum values', () => {
    expect(getCreateSbtBurnAuthEnum('AdminOnly')).toBe(0);
    expect(getCreateSbtBurnAuthEnum('OwnerOnly')).toBe(1);
    expect(getCreateSbtBurnAuthEnum('Both')).toBe(2);
    expect(getCreateSbtBurnAuthEnum('Neither')).toBe(3);
    expect(() => getCreateSbtBurnAuthEnum('bad')).toThrow('Unsupported burnAuth value: bad');
  });

  it('builds CreateSBT password export files', () => {
    expect(buildCreateSbtPasswordExportFile({
      autoJoinUrl: 'https://app.example/session?sbt=0xabc&auto=1',
      date: '2026-05-05',
      exportFormat: 'json',
      passwordList: ['pw1', 'pw2'],
      sbtDistribution: { isLimited: false },
      sbtInviteLinks: ['https://app.example/sbt/0xabc/pw1'],
      sbtName: 'Alpha',
      sbtSymbol: 'ALP',
    })).toEqual({
      content: JSON.stringify([
        {
          index: 0,
          password: 'pw1',
          inviteLink: 'https://app.example/sbt/0xabc/pw1',
        },
        {
          index: 1,
          password: 'pw2',
          inviteLink: 'https://app.example/session?sbt=0xabc&auto=1',
        },
      ], null, 2),
      fileName: 'ALP_Alpha_passwords_2026-05-05.json',
      mimeType: 'application/json',
    });

    expect(buildCreateSbtPasswordExportFile({
      autoJoinUrl: 'fallback',
      date: '2026-05-05',
      exportFormat: 'csv',
      passwordList: ['gp1'],
      sbtDistribution: { isLimited: true, distributionOption: 'groupPassword' },
      sbtInviteLinks: [],
      sbtName: 'Beta',
      sbtSymbol: 'BET',
    })).toEqual({
      content: 'index,groupPassword,inviteLink\n0,gp1,fallback',
      fileName: 'BET_Beta_group-passwords_2026-05-05.csv',
      mimeType: 'text/csv',
    });

    expect(buildCreateSbtPasswordExportFile({
      exportFormat: 'txt',
      passwordList: ['unused'],
    })).toEqual({
      content: '',
      fileName: '',
      mimeType: 'text/csv',
    });
  });

  it('builds CreateSBT invite links for password and group-password flows', () => {
    expect(buildCreateSbtInviteLinks({
      base: 'https://app.example',
      detailPath: '/sbt/0xabc?session=alpha',
      passwordList: ['pw 1', 'pw/2'],
    })).toEqual([
      'https://app.example/sbt/0xabc/pw%201?session=alpha',
      'https://app.example/sbt/0xabc/pw%2F2?session=alpha',
    ]);

    expect(buildCreateSbtInviteLinks({
      base: 'https://app.example',
      demoPath: '/session/alpha',
      encodeGroupPassword: (code) => `encoded:${code}`,
      isInvite: true,
      passwordList: ['group code'],
      sbtAddress: '0xABC',
    })).toEqual([
      'https://app.example/session/alpha?auto=1&sbt=0xABC&gp=encoded%3Agroup%20code',
    ]);
    expect(resolveCreateSbtInviteCodeList({
      listOverride: ['override', 0],
      passwordList: ['state'],
    })).toEqual(['override', '']);
    expect(resolveCreateSbtInviteCodeList({
      listOverride: [],
      passwordList: ['state', null],
    })).toEqual(['state', '']);
  });

  it('resolves CreateSBT password generation counts', () => {
    expect(resolveCreateSbtPasswordGenerationCount({
      numInviteLinks: 7,
      sbtDistribution: { isLimited: true, limitedNumber: 3 },
    })).toBe(3);
    expect(resolveCreateSbtPasswordGenerationCount({
      numInviteLinks: 7.8,
      sbtDistribution: { isLimited: true, limitedNumber: 0 },
    })).toBe(7);
    expect(resolveCreateSbtPasswordGenerationCount({
      numInviteLinks: 'bad',
      sbtDistribution: { isLimited: false, limitedNumber: 4 },
    })).toBe(0);
    expect(resolveCreateSbtPasswordGenerationCount({
      numInviteLinks: -2,
      sbtDistribution: null,
    })).toBe(0);
    expect(resolveCreateSbtPredictablePasswordListDecision({
      usesClaimCodes: false,
    })).toEqual({
      passwordListPatch: null,
      returnValue: [],
      shouldUpdatePasswordList: false,
    });
    expect(resolveCreateSbtPredictablePasswordListDecision({
      passwordList: ['pw1', '', 'pw2'],
      targetCount: 2,
      usesClaimCodes: true,
    })).toEqual({
      passwordListPatch: null,
      returnValue: ['pw1', 'pw2'],
      shouldUpdatePasswordList: false,
    });
    expect(resolveCreateSbtPredictablePasswordListDecision({
      generatePassword: (length) => `pw-${length}`,
      passwordList: ['pw1'],
      targetCount: 3,
      usesClaimCodes: true,
    })).toEqual({
      passwordListPatch: ['pw-32', 'pw-32', 'pw-32'],
      returnValue: null,
      shouldUpdatePasswordList: true,
    });
    expect(resolveCreateSbtPredictablePasswordListDecision({
      allowStateMutation: false,
      generatePassword: () => 'unused',
      passwordList: [],
      targetCount: 1,
      usesClaimCodes: true,
    })).toEqual({
      passwordListPatch: null,
      returnValue: null,
      shouldUpdatePasswordList: false,
    });
  });

  it('generates CreateSBT random hex strings from injected sources', () => {
    expect(generateCreateSbtRandomHexString({
      length: 5,
      getRandomValues: (arr) => {
        arr[0] = 0xab;
        arr[1] = 0xcd;
        arr[2] = 0xef;
        return arr;
      },
      randomBytes: () => {
        throw new Error('fallback should not run');
      },
    })).toBe('abcde');

    expect(generateCreateSbtRandomHexString({
      length: 4,
      randomBytes: () => [1, 2],
    })).toBe('0102');

    expect(generateCreateSbtRandomHexString({
      length: 'bad',
      randomBytes: () => [255],
    })).toBe('');
  });

  it('builds deferred draft CREATE2 salts from injected random bytes', () => {
    expect(buildCreateSbtDeferredDraftCreate2Salt({
      randomBytes: (length) => Array.from({ length }, (_, index) => index),
    })).toBe('draft/000102030405060708090a0b0c0d0e0f');

    expect(buildCreateSbtDeferredDraftCreate2Salt({
      prefix: 'pending/',
      randomBytes: () => [0xab, 0xcd, 0xef],
    })).toBe('pending/abcdef');
  });

  it('generates CreateSBT invite nonces from injected sources', () => {
    let browserCall = 0;
    expect(generateCreateSbtInviteNonces({
      bytesToNonce: (bytes) => `nonce-${Array.from(bytes)[0]}`,
      count: 2,
      getRandomValues: (arr) => {
        browserCall += 1;
        arr.fill(browserCall);
        return arr;
      },
      randomBytes: () => {
        throw new Error('fallback should not run');
      },
    })).toEqual(['nonce-1', 'nonce-2']);

    let fallbackCall = 4;
    expect(generateCreateSbtInviteNonces({
      bytesToNonce: (bytes) => `nonce-${Array.from(bytes)[0]}`,
      count: '2.9',
      randomBytes: () => {
        fallbackCall += 1;
        return new Uint8Array(12).fill(fallbackCall);
      },
    })).toEqual(['nonce-5', 'nonce-6']);

    expect(generateCreateSbtInviteNonces({
      count: 'bad',
      randomBytes: () => new Uint8Array(12).fill(9),
    })).toEqual([]);
  });

  it('normalizes CreateSBT image URLs for preview fetching and metadata', () => {
    const txId = 'a'.repeat(43);

    expect(getFetchableCreateSbtImageUrl(` ${txId} `)).toMatch(/^https?:\/\//);
    expect(getFetchableCreateSbtImageUrl('ftp://example.com/image.png')).toBe('');
    expect(getFetchableCreateSbtImageUrl('not a url')).toBe('');
    expect(getCanonicalCreateSbtMetadataImageUrl(` ${txId} `)).toBe(`ar://${txId}`);
    expect(getCanonicalCreateSbtMetadataImageUrl(`https://arweave.net/${txId}`)).toBe(`https://arweave.net/${txId}`);
    expect(getCanonicalCreateSbtMetadataImageUrl('')).toBe('');
    expect(resolveCreateSbtMetadataImageSource({
      defaultImageUrl: 'default',
      getCanonicalMetadataImageUrl: (value) => String(value || '').trim().toUpperCase(),
      sbtImageUrl: ' explicit ',
      useImageUrl: false,
    })).toBe('EXPLICIT');
    expect(resolveCreateSbtMetadataImageSource({
      defaultImageUrl: 'default',
      getCanonicalMetadataImageUrl: (value) => String(value || '').trim().toUpperCase(),
      sbtImageUrl: '',
      useImageUrl: true,
    })).toBe('DEFAULT');
    expect(resolveCreateSbtMetadataImageSource({
      defaultImageUrl: ' default ',
      getCanonicalMetadataImageUrl: (value) => String(value || '').trim().toUpperCase(),
      sbtImageUrl: '',
    })).toBe('DEFAULT');
  });

  it('compares string arrays without normalizing order', () => {
    const shared = ['a'];

    expect(areStringArraysEqual(shared, shared)).toBe(true);
    expect(areStringArraysEqual(['a', 2], ['a', '2'])).toBe(true);
    expect(areStringArraysEqual(['a', 'b'], ['b', 'a'])).toBe(false);
    expect(areStringArraysEqual(['a'], null as unknown as unknown[])).toBe(false);
  });

  it('normalizes metadata lock gate id maps by supported field', () => {
    expect(METADATA_LOCK_FIELDS).toEqual(['name', 'description', 'tags', 'documentURLs', 'image']);
    expect(createEmptyMetadataLockGateIds()).toEqual({
      name: [],
      description: [],
      tags: [],
      documentURLs: [],
      image: [],
    });
    const normalized = normalizeMetadataLockGateIds({
      name: [' gate-a ', ''],
      description: 'gate-b',
      ignored: ['gate-c'],
    });

    expect(normalized).toEqual({
      name: ['gate-a'],
      description: ['gate-b'],
      tags: [],
      documentURLs: [],
      image: [],
    });
    expect(getMetadataFieldLockGateIds(normalized, 'name')).toEqual(['gate-a']);
    expect(areMetadataLockGateMapsEqual(normalized, { ...normalized })).toBe(true);
    expect(areMetadataLockGateMapsEqual(normalized, {
      ...normalized,
      name: ['gate-other'],
    })).toBe(false);
    expect(normalizeCreateSbtMetadataLockGateIdsForValidGates({
      name: ['gate-a', 'missing'],
      description: 'gate-b',
      tags: ['missing'],
      documentURLs: ['gate-a', 'gate-b'],
      image: null,
    }, ['gate-a', 'gate-b'])).toEqual({
      name: ['gate-a'],
      description: ['gate-b'],
      tags: [],
      documentURLs: ['gate-a', 'gate-b'],
      image: [],
    });
    expect(buildCreateSbtMetadataLockSelectionPatch({
      fieldKey: 'tags',
      metadataLockGateIds: normalized,
      openLockKey: 'tags-lock',
      selectedGateIds: ['gate-b', 'missing'],
      validGateIds: ['gate-a', 'gate-b'],
    })).toEqual({
      metadataLockGateIds: {
        ...normalized,
        tags: ['gate-b'],
      },
      openLockKey: 'tags-lock',
    });
    expect(buildCreateSbtMetadataLockSelectionPatch({
      fieldKey: 'name',
      metadataLockGateIds: normalized,
      openLockKey: 'name-lock',
      selectedGateIds: ['missing'],
      validGateIds: ['gate-a'],
    })).toEqual({
      metadataLockGateIds: {
        ...normalized,
        name: [],
      },
      openLockKey: '',
    });
  });

  it('resolves metadata field gate ids against known gate options', () => {
    expect(resolveCreateSbtMetadataFieldGateIds({
      fieldKey: 'name',
      lockMap: { name: ['gate-a', 'gate-b'] },
      validGateIds: ['gate-b', 'gate-a'],
    })).toEqual(['gate-a', 'gate-b']);
    expect(resolveCreateSbtMetadataFieldGateIds({
      fieldKey: 'description',
      lockMap: { description: 'gate-a' },
      validGateIds: ['gate-a'],
    })).toEqual(['gate-a']);
    expect(resolveCreateSbtMetadataFieldGateIds({
      fieldKey: 'tags',
      lockMap: { tags: [] },
      validGateIds: [],
    })).toEqual([]);
    expect(() => resolveCreateSbtMetadataFieldGateIds({
      fieldKey: 'image',
      gatesLowerLabel: 'locks',
      lockMap: { image: ['gate-a', 'missing-gate'] },
      validGateIds: ['gate-a'],
    })).toThrow('image encryption locks could not be resolved. Please reselect the lock or configure valid locks.');
  });

  it('resolves encrypted field gate values with scalar and array shapes', () => {
    expect(resolveCreateSbtEncryptedFieldGateValue({
      selectedGateIds: ['gate-a'],
      validGateIds: ['gate-a', 'gate-b'],
    })).toBe('gate-a');
    expect(resolveCreateSbtEncryptedFieldGateValue({
      selectedGateIds: ['gate-a', 'gate-b'],
      validGateIds: ['gate-b', 'gate-a'],
    })).toEqual(['gate-a', 'gate-b']);
    expect(resolveCreateSbtEncryptedFieldGateValue({
      selectedGateIds: ['missing'],
      validGateIds: ['gate-a'],
    })).toBeNull();
    expect(resolveCreateSbtEncryptedFieldGateValue({
      selectedGateIds: ['gate-a'],
      validGateIds: [],
    })).toBe('gate-a');

    const fieldGates: Record<string, unknown> = {};
    expect(writeCreateSbtEncryptedFieldGate({
      fieldKey: 'name',
      selectedGateIds: ['gate-a'],
      target: fieldGates,
      validGateIds: ['gate-a', 'gate-b'],
    })).toBe(true);
    expect(fieldGates).toEqual({ name: 'gate-a' });
    expect(writeCreateSbtEncryptedFieldGate({
      fieldKey: 'tags',
      selectedGateIds: ['gate-a', 'gate-b'],
      target: fieldGates,
      validGateIds: ['gate-a', 'gate-b'],
    })).toBe(true);
    expect(fieldGates.tags).toEqual(['gate-a', 'gate-b']);
    expect(writeCreateSbtEncryptedFieldGate({
      fieldKey: 'image',
      selectedGateIds: ['missing'],
      target: fieldGates,
      validGateIds: ['gate-a'],
    })).toBe(false);
    expect(fieldGates.image).toBeUndefined();
  });

  it('restores metadata lock gate ids from cached and legacy payload fields', () => {
    const gateOptions = [
      { id: 'gate-a', sbtAddresses: ['0xAAA'] },
      { id: 'gate-b', sbtAddresses: ['0xBBB'] },
      { id: 'gate-c', sbtAddresses: ['0xAAA', '0xCCC'] },
      { label: 'missing id', sbtAddresses: ['0xDDD'] },
    ];

    expect(getCreateSbtValidGateIds(gateOptions)).toEqual(['gate-a', 'gate-b', 'gate-c']);
    expect(resolveCreateSbtLegacyDescriptionLockGateIds({
      parsed: { descriptionGateSBTs: [{ address: ' 0xaaa ' }, '0xBBB'] },
      gateOptions,
    })).toEqual(['gate-a', 'gate-b']);

    expect(resolveCreateSbtRestoredMetadataLockGateIds({
      parsed: {
        metadataLockGateIds: { name: ['name-gate'], description: ['cached-description'] },
        descriptionLockGateIds: ['legacy-description'],
        tagsLockGateIds: ['tags-gate'],
        docsLockGateIds: 'docs-gate',
      },
      gateOptions,
    })).toEqual({
      name: ['name-gate'],
      description: ['cached-description'],
      tags: ['tags-gate'],
      documentURLs: ['docs-gate'],
      image: [],
    });

    expect(resolveCreateSbtRestoredMetadataLockGateIds({
      parsed: {
        descriptionGateSBTs: ['0xbbb'],
      },
      gateOptions,
    }).description).toEqual(['gate-b']);
  });
});
