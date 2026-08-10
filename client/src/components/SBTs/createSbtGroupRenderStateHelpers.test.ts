import {
  buildCreateSbtProgressIndicatorState,
  buildCreateSbtProgressStepClassName,
  buildCreateSbtRenderState,
  resolveCreateSbtActionDisplayState,
  resolveCreateSbtBookmarkActionDisplayState,
  resolveCreateSbtClearFormButtonState,
  resolveCreateSbtCopyActionDisplayState,
  resolveCreateSbtInfoDisplayState,
  resolveCreateSbtMintOptionsDisplayState,
  resolveCreateSbtPrimaryActionLabel,
  resolveCreateSbtPrimaryButtonState,
  resolveCreateSbtSuccessDisplayState,
} from './createSbtGroupRenderStateHelpers';

describe('createSbtGroupRenderStateHelpers', () => {
  it('builds CreateSBT render state without touching form controls', () => {
    expect(
      resolveCreateSbtInfoDisplayState({
        documentURLs: ['https://docs.example/a'],
        imageSelectedGateIds: ['gate-image'],
        nameSelectedGateIds: ['gate-name'],
        tags: ['alpha'],
      }),
    ).toEqual({
      shouldRenderDocumentUrlList: true,
      shouldRenderImageLockHelp: true,
      shouldRenderNameLockHelp: true,
      shouldRenderTagPills: true,
    });
    expect(
      resolveCreateSbtInfoDisplayState({
        documentURLs: [],
        imageSelectedGateIds: [],
        nameSelectedGateIds: [],
        tags: [],
      }),
    ).toEqual({
      shouldRenderDocumentUrlList: false,
      shouldRenderImageLockHelp: false,
      shouldRenderNameLockHelp: false,
      shouldRenderTagPills: false,
    });
    expect(
      resolveCreateSbtMintOptionsDisplayState({
        hideNetworkSelector: false,
        isLimited: true,
        isTimeLimited: true,
        predictableAddressActive: true,
        predictedAddressBusy: true,
      }),
    ).toEqual({
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
    expect(
      resolveCreateSbtMintOptionsDisplayState({
        hideNetworkSelector: true,
        predictableAddressActive: false,
        predictedAddressBusy: true,
      }),
    ).toEqual({
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
    expect(
      resolveCreateSbtActionDisplayState({
        currentStep: 2,
        distributionOption: 'groupPassword',
        mintingFailed: true,
        sbtMinted: true,
        startedMinting: true,
      }),
    ).toEqual({
      shouldRenderGroupPasswordInput: true,
      shouldRenderMintingFailureIcon: true,
      shouldRenderProgressIndicator: true,
      shouldRenderStartFreshButton: true,
    });
    expect(
      resolveCreateSbtActionDisplayState({
        currentStep: 0,
        distributionOption: 'anyoneCanMint',
        mintingFailed: true,
      }),
    ).toEqual({
      shouldRenderGroupPasswordInput: false,
      shouldRenderMintingFailureIcon: false,
      shouldRenderProgressIndicator: false,
      shouldRenderStartFreshButton: false,
    });
    expect(
      buildCreateSbtRenderState({
        distributionConfigs: [
          { label: 'Open', value: 'anyoneCanMint' },
          { label: 'Password', value: 'groupPassword' },
        ],
        distributionOption: 'groupPassword',
      }),
    ).toEqual({
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
    expect(
      buildCreateSbtRenderState({
        create2Salt: ' salt ',
        deferredDeployMode: true,
        deferredSurfaceBg: '#11182c',
        distributionConfigs: [{ value: 'anyoneCanMint' }],
        distributionOption: 'anyoneCanMint',
        documentUrl: ' https://example.test/doc ',
        imageSelectedGateIds: ['gate-image'],
        normalizeDocumentUrlDraft: (value) => [String(value || '').trim()],
        sbtName: ' Badge ',
      }),
    ).toMatchObject({
      createActionLabel: 'Add to Session',
      headerTitle: 'Add to Session',
      isDirty: true,
      predictableAddressLocked: true,
      rootSurfaceStyle: { '--ce-create-group-surface-bg': '#11182c' },
    });
    expect(
      buildCreateSbtRenderState({
        distributionOption: 'hasPasswords',
        isLimited: true,
      }),
    ).toMatchObject({
      isLimitedWithPasswords: true,
      isPasswordDistribution: true,
    });
    expect(
      resolveCreateSbtPrimaryActionLabel({
        createActionLabel: 'Add to Session',
        currentStep: 0,
      }),
    ).toBe('Add to Session');
    expect(resolveCreateSbtPrimaryActionLabel({ currentStep: 1 })).toBe('Uploading Image...');
    expect(resolveCreateSbtPrimaryActionLabel({ currentStep: 2 })).toBe('Uploading URI...');
    expect(
      resolveCreateSbtPrimaryActionLabel({
        currentStep: 3,
        mintingLabel: 'Minting',
      }),
    ).toBe('Minting...');
    expect(
      resolveCreateSbtPrimaryActionLabel({
        currentStep: 3,
        deferredDeployMode: true,
      }),
    ).toBe('Saving Draft...');
    expect(
      resolveCreateSbtPrimaryActionLabel({
        createActionLabel: 'Create',
        currentStep: 4,
      }),
    ).toBe('Create');
    expect(
      resolveCreateSbtPrimaryActionLabel({
        mintedLabel: 'Created',
        sbtMinted: true,
      }),
    ).toBe('Created!');
    expect(
      resolveCreateSbtPrimaryButtonState({
        sbtMinted: false,
        startedMinting: false,
      }),
    ).toEqual({
      disabled: false,
    });
    expect(
      resolveCreateSbtPrimaryButtonState({
        sbtMinted: true,
        startedMinting: false,
      }),
    ).toEqual({
      disabled: true,
    });
    expect(
      resolveCreateSbtPrimaryButtonState({
        sbtMinted: false,
        startedMinting: true,
      }),
    ).toEqual({
      disabled: true,
    });
    expect(
      resolveCreateSbtClearFormButtonState({
        isDirty: true,
        sbtMinted: false,
      }),
    ).toEqual({
      shouldShowClearFormButton: true,
    });
    expect(
      resolveCreateSbtClearFormButtonState({
        isDirty: false,
        sbtMinted: false,
      }),
    ).toEqual({
      shouldShowClearFormButton: false,
    });
    expect(
      resolveCreateSbtClearFormButtonState({
        isDirty: true,
        sbtMinted: true,
      }),
    ).toEqual({
      shouldShowClearFormButton: false,
    });
    expect(
      resolveCreateSbtCopyActionDisplayState({
        copied: false,
        defaultLabel: 'Copy ID',
      }),
    ).toEqual({
      label: 'Copy ID',
      shouldRenderCopiedIcon: false,
      shouldRenderDefaultIcon: true,
    });
    expect(
      resolveCreateSbtCopyActionDisplayState({
        copied: true,
        copiedLabel: 'Copied!',
        defaultLabel: 'Copy ID',
      }),
    ).toEqual({
      label: 'Copied!',
      shouldRenderCopiedIcon: true,
      shouldRenderDefaultIcon: false,
    });
    expect(
      resolveCreateSbtBookmarkActionDisplayState({
        bookmarkedSbtsSet: new Set(['0xabc']),
        sbtAddress: '0xAbC',
      }),
    ).toEqual({
      iconStyle: { color: 'var(--ce-status-warning-text)' },
      isBookmarked: true,
    });
    expect(
      resolveCreateSbtBookmarkActionDisplayState({
        bookmarkedSbtsSet: new Set(['0xdef']),
        sbtAddress: '0xabc',
      }),
    ).toEqual({
      iconStyle: { color: undefined },
      isBookmarked: false,
    });
    expect(
      buildCreateSbtProgressIndicatorState({
        currentStep: 0,
        sbtMinted: false,
      }),
    ).toEqual({
      imageUploadStep: { completed: false, iconState: 'attention', spin: false },
      tokenUriUploadStep: { completed: false, iconState: 'attention', spin: false },
      mintStep: { completed: false, iconState: 'attention', spin: false },
    });
    expect(
      buildCreateSbtProgressIndicatorState({
        currentStep: 2,
        sbtMinted: false,
      }),
    ).toEqual({
      imageUploadStep: { completed: true, iconState: 'check', spin: false },
      tokenUriUploadStep: { completed: true, iconState: 'spinner', spin: true },
      mintStep: { completed: false, iconState: 'attention', spin: false },
    });
    expect(
      buildCreateSbtProgressIndicatorState({
        currentStep: 3,
        sbtMinted: false,
      }),
    ).toMatchObject({
      mintStep: { completed: true, iconState: 'spinner', spin: true },
    });
    expect(
      buildCreateSbtProgressIndicatorState({
        currentStep: 3,
        sbtMinted: true,
      }),
    ).toMatchObject({
      mintStep: { completed: true, iconState: 'check', spin: false },
    });
    expect(
      buildCreateSbtProgressStepClassName({
        completed: false,
        completedClassName: 'step-completed',
        pendingClassName: 'step',
      }),
    ).toBe('step');
    expect(
      buildCreateSbtProgressStepClassName({
        completed: true,
        completedClassName: 'step-completed',
        pendingClassName: 'step',
      }),
    ).toBe('step-completed');
    expect(
      resolveCreateSbtSuccessDisplayState({
        distributionOption: 'anyoneCanMint',
        openMintAutoJoinUrl: 'https://example.test/join',
        passwordList: ['recovery-code'],
        sbtMinted: true,
        showJson: true,
        startedMinting: true,
        tokenURI: 'ar://token',
      }),
    ).toEqual({
      shouldRenderContractAddress: true,
      shouldRenderGroupPasswordAutoJoin: false,
      shouldRenderInviteLinks: false,
      shouldRenderJsonPanel: true,
      shouldRenderOpenMintAutoJoin: true,
      shouldRenderPasswordRecovery: true,
      shouldRenderSuccessPanel: true,
      shouldRenderTokenUriLink: true,
    });
    expect(
      resolveCreateSbtSuccessDisplayState({
        distributionOption: 'hasPasswords',
        passwordList: ['recovery-code'],
        sbtInviteLinks: ['invite-link'],
        sbtMinted: true,
      }),
    ).toMatchObject({
      shouldRenderInviteLinks: true,
      shouldRenderPasswordRecovery: false,
      shouldRenderSuccessPanel: true,
    });
    expect(
      resolveCreateSbtSuccessDisplayState({
        distributionOption: 'groupPassword',
        sbtMinted: false,
        startedMinting: false,
      }),
    ).toMatchObject({
      shouldRenderContractAddress: false,
      shouldRenderGroupPasswordAutoJoin: true,
      shouldRenderJsonPanel: false,
      shouldRenderSuccessPanel: false,
    });
    expect(
      buildCreateSbtRenderState({
        distributionConfigs: 'bad',
        distributionOption: 'anyoneCanMint',
        normalizeDocumentUrlDraft: () => '',
      }),
    ).toMatchObject({
      distributionOptions: [],
      isDirty: false,
      isLimitedWithPasswords: false,
      isPasswordDistribution: false,
      predictableAddressLocked: false,
    });
  });
});
