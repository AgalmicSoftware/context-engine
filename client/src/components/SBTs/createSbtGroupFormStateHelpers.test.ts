import { createEmptyMetadataLockGateIds } from './createSbtGroupMetadataLockHelpers';
import {
  buildCreateSbtDefaultDistributionState,
  buildCreateSbtGroupPasswordPredictableEntryPatch,
  buildCreateSbtGroupPasswordPredictableExitPatch,
  buildCreateSbtInitialState,
  buildCreateSbtResetFormState,
  buildCreateSbtRestoredCollapseState,
  buildCreateSbtRestoredDistributionState,
  buildCreateSbtRestoredScalarState,
  resolveCreateSbtRestoredDeferredCreate2Salt,
  resolveCreateSbtRestoredPredictableAddressEnabled,
} from './createSbtGroupFormStateHelpers';

describe('createSbtGroupFormStateHelpers', () => {
  it('restores cached distribution and scalar draft state', () => {
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
        chain: { id: 84532, name: 'Base Sepolia' },
      },
    });

    expect(restoredDistribution).toEqual(
      expect.objectContaining({
        limitedNumber: 3,
        option: 'groupPassword',
        network: { id: 84532, name: 'Base Sepolia' },
      }),
    );
    expect(restoredDistribution.mintingEndTime).toEqual(new Date('2026-01-01T00:00:00.000Z'));
    expect(resolveCreateSbtRestoredDeferredCreate2Salt(' salt ', 'fallback')).toBe(' salt ');
    expect(resolveCreateSbtRestoredDeferredCreate2Salt('', 'fallback')).toBe('fallback');
    expect(resolveCreateSbtRestoredPredictableAddressEnabled(false, true)).toBe(false);
    expect(resolveCreateSbtRestoredPredictableAddressEnabled(null, true)).toBe(true);
    expect(
      buildCreateSbtRestoredScalarState({
        currentExportFormat: 'csv',
        currentNumInviteLinks: 2,
        parsed: {
          sbtName: 'Group',
          useImageUrl: true,
          documentURLs: ['https://example.test/doc'],
          autoAppliedDefaultTags: ['auto'],
          dismissedDefaultTags: ['skip'],
          numInviteLinks: 4,
        },
      }),
    ).toEqual(
      expect.objectContaining({
        sbtName: 'Group',
        useImageUrl: true,
        documentURLs: ['https://example.test/doc'],
        autoAppliedDefaultTags: ['auto'],
        dismissedDefaultTags: ['skip'],
        numInviteLinks: 4,
        exportFormat: 'csv',
      }),
    );
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
  });

  it('builds default, reset, and initial form state around authoring chain defaults', () => {
    expect(
      buildCreateSbtDefaultDistributionState({
        account: '0xAdmin',
        authoringChain: { chainId: 84532, chain: { id: 84532, name: 'Base Sepolia' } },
      }),
    ).toEqual({
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
        sbtDistribution: expect.objectContaining({
          adminAddress: '0xAdmin',
          burnAdmin: '0xAdmin',
          network: { id: 84532, name: 'Base Sepolia' },
        }),
        metadataLockGateIds: createEmptyMetadataLockGateIds(),
        deferredCreate2Salt: 'draft/test-salt',
        predictableAddressEnabled: true,
        network: 84532,
      }),
    );

    deferredCreate2SaltBuilder.mockClear();
    const initialState = buildCreateSbtInitialState({
      account: '0xAdmin',
      authoringChain: { chainId: 11155420, chain: { id: 11155420, name: 'OP Sepolia' } },
      deferredCreate2SaltBuilder,
      deferredDeploy: false,
    });

    expect(deferredCreate2SaltBuilder).not.toHaveBeenCalled();
    expect(initialState).toEqual(
      expect.objectContaining({
        sbtCodes: [],
        groupSubmitted: false,
        sbtDistribution: expect.objectContaining({
          adminAddress: '0xAdmin',
          network: { id: 11155420, name: 'OP Sepolia' },
        }),
        deferredCreate2Salt: '',
        predictableAddressEnabled: false,
        mintOptionsCollapsed: true,
        distributionOptionsCollapsed: true,
        numInviteLinks: 10,
        exportFormat: 'json',
        encryptedRecoveryEnabled: false,
        encryptedRecoveryStatus: 'idle',
        countdown: 12,
        copyJsonSuccess: false,
        copyLinkSuccess: false,
        copyIdSuccess: false,
      }),
    );
    expect(initialState.bookmarkedSbtsSet).toEqual(new Set());
  });

  it('builds predictable-address patches when entering and leaving group-password mode', () => {
    expect(
      buildCreateSbtGroupPasswordPredictableEntryPatch({
        autoSalt: 'draft/group',
        isDeferredDeployMode: false,
        isPredictableAddressEnabled: false,
        nextDistributionOption: 'groupPassword',
        prevDistributionOption: 'anyoneCanMint',
      }),
    ).toEqual({
      create2Salt: 'draft/group',
      predictableAddressEnabled: true,
    });
    expect(
      buildCreateSbtGroupPasswordPredictableEntryPatch({
        autoSalt: 'draft/group',
        isDeferredDeployMode: true,
        nextDistributionOption: 'groupPassword',
        prevDistributionOption: 'anyoneCanMint',
      }),
    ).toBeNull();
    expect(
      buildCreateSbtGroupPasswordPredictableExitPatch({
        autoCreate2SaltForGroupPassword: true,
        nextDistributionOption: 'anyoneCanMint',
        prevDistributionOption: 'groupPassword',
      }),
    ).toEqual({
      create2Salt: '',
      predictableAddressEnabled: false,
    });
    expect(
      buildCreateSbtGroupPasswordPredictableExitPatch({
        autoCreate2SaltForGroupPassword: false,
        nextDistributionOption: 'anyoneCanMint',
        prevDistributionOption: 'groupPassword',
      }),
    ).toBeNull();
  });
});
