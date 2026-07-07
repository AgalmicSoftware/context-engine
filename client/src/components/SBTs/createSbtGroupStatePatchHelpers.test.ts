import {
  buildCreateSbtAccountDistributionSyncPatch,
  buildCreateSbtAccountDistributionSyncStatePatch,
  buildCreateSbtBooleanTogglePatch,
  buildCreateSbtCountdownTickPatch,
  buildCreateSbtDeferredUploadFallbackPatch,
  buildCreateSbtDistributionFieldPatch,
  buildCreateSbtInputChangePatch,
  buildCreateSbtMetadataLockSelectionPatch,
  buildCreateSbtMintSuccessPatch,
  buildCreateSbtNetworkChangePatch,
  buildCreateSbtPredictedAddressBusyPatch,
  normalizeComparableAddress,
} from './createSbtGroupStatePatchHelpers';

describe('createSbtGroupStatePatchHelpers', () => {
  it('builds local CreateSBT state patches without mutating source state', () => {
    expect(
      buildCreateSbtBooleanTogglePatch({
        state: { showJson: false },
        stateKey: 'showJson',
      }),
    ).toEqual({ showJson: true });
    expect(buildCreateSbtPredictedAddressBusyPatch()).toEqual({
      predictedAddressBusy: true,
      predictedAddressStatus: 'Calculating address…',
    });
    expect(
      buildCreateSbtMintSuccessPatch({
        passwordList: 'bad',
        sbtAddress: '0xabc',
      }),
    ).toEqual({
      sbtMinted: true,
      sbtAddress: '0xabc',
      currentStep: 3,
      passwordList: [],
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
      buildCreateSbtCountdownTickPatch({
        state: { countdown: 1, countdownActive: true },
      }),
    ).toEqual({ countdown: 0, countdownActive: false });
  });

  it('builds distribution and field patches from normalized inputs', () => {
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
  });

  it('syncs account-owned admin fields and metadata lock selections', () => {
    expect(normalizeComparableAddress(' 0xABC ')).toBe('0xabc');
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
    expect(
      buildCreateSbtMetadataLockSelectionPatch({
        fieldKey: 'tags',
        metadataLockGateIds: {
          name: ['gate-a'],
          description: [],
          tags: [],
          documentURLs: [],
          image: [],
        },
        openLockKey: 'tags-lock',
        selectedGateIds: ['gate-b', 'missing'],
        validGateIds: ['gate-a', 'gate-b'],
      }),
    ).toEqual({
      metadataLockGateIds: {
        name: ['gate-a'],
        description: [],
        tags: ['gate-b'],
        documentURLs: [],
        image: [],
      },
      openLockKey: 'tags-lock',
    });
  });
});
