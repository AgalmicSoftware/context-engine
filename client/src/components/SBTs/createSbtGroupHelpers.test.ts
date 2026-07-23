import {
  asCreateSbtGateBoundary,
  buildCreateSbtAccountDistributionSyncPatch,
  buildCreateSbtAccountDistributionSyncStatePatch,
  buildCreateSbtResourceKeyByGateId,
  buildCreateSbtScopedLockGateId,
  buildEffectiveCreateSbtDocumentUrls,
  buildCreateSbtGroupPasswordPredictableEntryPatch,
  buildCreateSbtGroupPasswordPredictableExitPatch,
  buildCreateSbtAuthoringChainSyncPatch,
  buildCreateSbtAuthoringChainSyncStatePatch,
  buildCreateSbtResetFormState,
  buildCreateSbtRestoredCollapseState,
  buildCreateSbtRestoredDistributionState,
  buildCreateSbtRestoredScalarState,
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
  resolveCreateSbtCachedDistributionChainId,
  resolveCreateSbtLockAudienceSessionName,
  resolveCreateSbtRestoredDeferredCreate2Salt,
  resolveCreateSbtMemoizedImageDataUrl,
  resolveCreateSbtRestoredPredictableAddressEnabled,
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
    expect(
      buildCreateSbtAuthoringChainSyncPatch({
        currentDistributionNetwork: { id: 11155420, name: 'OP Sepolia' },
        currentNetwork: 11155420,
        syncedAuthoringChain: { chainId: 11155420, chain: { id: 11155420, name: 'OP Sepolia' } },
      }),
    ).toBeNull();
    expect(
      buildCreateSbtAuthoringChainSyncPatch({
        currentDistributionNetwork: { id: 84532, name: 'Base Sepolia' },
        currentNetwork: 84532,
        syncedAuthoringChain: { chainId: 11155420, chain: { id: 11155420, name: 'OP Sepolia' } },
      }),
    ).toEqual({
      network: 11155420,
      sbtDistributionNetwork: { id: 11155420, name: 'OP Sepolia' },
    });
    expect(
      buildCreateSbtAuthoringChainSyncPatch({
        currentDistributionNetwork: { id: 11155420, name: 'Legacy Name' },
        currentNetwork: 11155420,
        syncedAuthoringChain: { chainId: 11155420, chain: { id: 11155420, name: 'OP Sepolia' } },
      }),
    ).toEqual({
      network: 11155420,
      sbtDistributionNetwork: { id: 11155420, name: 'OP Sepolia' },
    });
    expect(
      buildCreateSbtAuthoringChainSyncStatePatch({
        currentDistribution: {
          burnAdmin: '0xAdmin',
          network: { id: 84532, name: 'Base Sepolia' },
        },
        syncPatch: {
          network: 11155420,
          sbtDistributionNetwork: { id: 11155420, name: 'OP Sepolia' },
        },
      }),
    ).toEqual({
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
    expect(
      buildCreateSbtRestoredDistributionState({
        currentDistribution: { option: 'open' },
        distributionPayload: {},
        restoredAuthoringChain: { chain: 'not connected' },
      }),
    ).toMatchObject({
      mintingEndTime: null,
      network: 'not connected',
      option: 'open',
    });
    expect(resolveCreateSbtRestoredDeferredCreate2Salt(' salt-a ', 'fallback')).toBe(' salt-a ');
    expect(resolveCreateSbtRestoredDeferredCreate2Salt('   ', 'fallback')).toBe('fallback');
    expect(resolveCreateSbtRestoredPredictableAddressEnabled(false, true)).toBe(false);
    expect(resolveCreateSbtRestoredPredictableAddressEnabled(null, true)).toBe(true);
    expect(
      buildCreateSbtGroupPasswordPredictableExitPatch({
        autoCreate2SaltForGroupPassword: true,
        nextDistributionOption: 'open',
        prevDistributionOption: 'groupPassword',
      }),
    ).toEqual({
      create2Salt: '',
      predictableAddressEnabled: false,
    });
    expect(
      buildCreateSbtGroupPasswordPredictableExitPatch({
        autoCreate2SaltForGroupPassword: false,
        nextDistributionOption: 'open',
        prevDistributionOption: 'groupPassword',
      }),
    ).toBeNull();
    expect(
      buildCreateSbtGroupPasswordPredictableEntryPatch({
        autoSalt: 'salt-a',
        nextDistributionOption: 'groupPassword',
        prevDistributionOption: 'open',
      }),
    ).toEqual({
      create2Salt: 'salt-a',
      predictableAddressEnabled: true,
    });
    expect(
      buildCreateSbtGroupPasswordPredictableEntryPatch({
        autoSalt: 'salt-a',
        isPredictableAddressEnabled: true,
        nextDistributionOption: 'groupPassword',
        prevDistributionOption: 'open',
      }),
    ).toBeNull();
    expect(
      buildCreateSbtGroupPasswordPredictableEntryPatch({
        autoSalt: '',
        nextDistributionOption: 'groupPassword',
        prevDistributionOption: 'open',
      }),
    ).toBeNull();
    expect(
      buildCreateSbtRestoredScalarState({
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
      }),
    ).toEqual({
      autoAppliedDefaultTags: ['Default'],
      create2Salt: 'salt-a',
      dismissedDefaultTags: [],
      documentIDHashes: 'hash-a',
      documentURLs: ['https://docs.example/a'],
      exportFormat: 'json',
      groupPassword: '',
      numInviteLinks: 0,
      sbtDescription: 'Description',
      sbtImageUrl: 'https://image.example/a.png',
      sbtName: 'Name',
      useImageUrl: true,
    });
    expect(
      buildCreateSbtRestoredScalarState({
        currentExportFormat: 'csv',
        currentNumInviteLinks: 5,
        parsed: {
          documentURLs: 'bad',
          exportFormat: '',
          numInviteLinks: 'bad',
        },
      }),
    ).toMatchObject({
      documentURLs: [],
      exportFormat: 'csv',
      numInviteLinks: 5,
      useImageUrl: false,
    });
    expect(
      buildCreateSbtRestoredCollapseState({
        currentDistributionOptionsCollapsed: true,
        currentMintOptionsCollapsed: true,
        shouldExpandSections: false,
      }),
    ).toEqual({
      tokenInfoCollapsed: false,
      mintOptionsCollapsed: true,
      distributionOptionsCollapsed: true,
    });
    expect(
      buildCreateSbtRestoredCollapseState({
        currentDistributionOptionsCollapsed: true,
        currentMintOptionsCollapsed: true,
        shouldExpandSections: true,
      }),
    ).toEqual({
      tokenInfoCollapsed: false,
      mintOptionsCollapsed: false,
      distributionOptionsCollapsed: false,
    });
    const imageFile = { name: 'badge.png' };
    expect(
      resolveCreateSbtMemoizedImageDataUrl({
        imageFile,
        memoizedImageDataUrl: 'data:image/png;base64,abc',
        memoizedImageFileRef: imageFile,
      }),
    ).toBe('data:image/png;base64,abc');
    expect(
      resolveCreateSbtMemoizedImageDataUrl({
        imageFile,
        memoizedImageDataUrl: 'data:image/png;base64,abc',
        memoizedImageFileRef: { name: 'badge.png' },
      }),
    ).toBeNull();
    expect(
      resolveCreateSbtMemoizedImageDataUrl({
        imageFile,
        memoizedImageDataUrl: '',
        memoizedImageFileRef: imageFile,
      }),
    ).toBeNull();
    expect(normalizeComparableAddress(' 0xABC ')).toBe('0xabc');
    expect(normalizeGateIds([' a ', '', null, 'b'])).toEqual(['a', 'b']);
    expect(normalizeGateIds(' c ')).toEqual(['c']);
    expect(normalizeGateIds({})).toEqual([]);
    expect(normalizeGateText(' label ')).toBe('label');
    expect(normalizeGateText({})).toBe('');
  });

  it('builds account sync patches for owned distribution admin fields', () => {
    expect(
      buildCreateSbtAccountDistributionSyncPatch({
        currentDistribution: {
          burnAdmin: '',
          adminAddress: ' 0xOld ',
        },
        nextAccount: ' 0xNew ',
        prevAccount: '0xold',
      }),
    ).toEqual({
      burnAdmin: '0xNew',
      adminAddress: '0xNew',
    });
    expect(
      buildCreateSbtAccountDistributionSyncPatch({
        currentDistribution: {
          burnAdmin: '0xCustom',
          adminAddress: '0xOld',
        },
        nextAccount: '0xNew',
        prevAccount: '0xOld',
      }),
    ).toEqual({
      adminAddress: '0xNew',
    });
    expect(
      buildCreateSbtAccountDistributionSyncPatch({
        currentDistribution: {
          burnAdmin: '0xCustom',
          adminAddress: '0xOther',
        },
        nextAccount: '0xNew',
        prevAccount: '0xOld',
      }),
    ).toBeNull();
    expect(
      buildCreateSbtAccountDistributionSyncPatch({
        currentDistribution: {},
        nextAccount: '0xSame',
        prevAccount: '0xsame',
      }),
    ).toBeNull();
    expect(
      buildCreateSbtAccountDistributionSyncStatePatch({
        currentDistribution: {
          burnAdmin: '0xOld',
          distributionOption: 'groupPassword',
        },
        syncPatch: {
          burnAdmin: '0xNew',
          adminAddress: '0xNew',
        },
      }),
    ).toEqual({
      sbtDistribution: {
        burnAdmin: '0xNew',
        adminAddress: '0xNew',
        distributionOption: 'groupPassword',
      },
    });
    expect(buildCreateSbtAccountDistributionSyncStatePatch()).toBeNull();
  });

  it('resolves lock audience labels and scoped gate ids', () => {
    expect(resolveCreateSbtLockAudienceSessionName({ sessionName: ' Alpha Session ', slug: 'alpha' })).toBe(
      'Alpha Session',
    );
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
    expect(
      getCreateSbtRecipientAccessControlConditions({
        accessControlConditions: [{ contractAddress: '0xA' }],
      }),
    ).toEqual([{ contractAddress: '0xA' }]);
    expect(getCreateSbtRecipientAccessControlConditions({ accessControlConditions: 'bad' })).toEqual([]);
    expect(getConfiguredContractAddress({ address: ' 0xSBT ' })).toBe('0xSBT');
    expect(getConfiguredContractAddress({})).toBe('');
    expect(
      hasUsableCreateSbtFactoryForChain({
        chainId: 11155420,
        getSessionContractsForChain: (chainId) =>
          chainId === 11155420 ? { sbtFactory: { address: ' 0xFactory ' } } : {},
      }),
    ).toBe(true);
    expect(
      hasUsableCreateSbtFactoryForChain({
        chainId: 84532,
        getSessionContractsForChain: () => ({ sbtFactory: { address: ' ' } }),
      }),
    ).toBe(false);
    expect(
      hasUsableCreateSbtFactoryForChain({
        chainId: 10,
        getSessionContractsForChain: () => null,
      }),
    ).toBe(false);
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
    expect(resetState).toEqual(
      expect.objectContaining({
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
      }),
    );

    deferredCreate2SaltBuilder.mockClear();
    expect(
      buildCreateSbtResetFormState({
        deferredCreate2SaltBuilder,
        deferredDeploy: false,
      }),
    ).toEqual(
      expect.objectContaining({
        deferredCreate2Salt: '',
        predictableAddressEnabled: false,
        network: '',
      }),
    );
    expect(deferredCreate2SaltBuilder).not.toHaveBeenCalled();
  });
});
