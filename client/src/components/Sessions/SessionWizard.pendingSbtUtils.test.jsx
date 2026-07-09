import {
  buildPublishedPendingSbtLinks,
  buildSbtDetailPath,
  deploySessionWizardPendingSbtDraft,
  ethers,
  finalizeSessionWizardPendingSbtDraft,
  mockCreateSBT,
  mockPendingSbtAddress,
  mockSecondPendingSbtAddress,
  mockSelectorSourceFactory,
  mockSelectorSourceStartBlock,
  persistSessionWizardSbtRecoveryCodes,
  promotePendingSbtSelectionsAfterDeploy,
  resetSessionWizardWorkerPanelTestState,
  resolveSessionWizardSelectorSourceConfig,
  TEST_ADMIN_ADDRESS,
} from './SessionWizard.workerPanel.testUtils';

describe('SessionWizard pending SBT utilities', () => {
  beforeEach(resetSessionWizardWorkerPanelTestState);

  it('promotes pending SBT selections to deployed entries before pending-draft cleanup', () => {
    const promoted = promotePendingSbtSelectionsAfterDeploy({
      selections: [
        {
          address: mockPendingSbtAddress,
          name: 'Pending SBT (Pending)',
          pending: true,
          metadataPreview: { phase: 'pending' },
        },
      ],
      deployedDrafts: [
        {
          predictedAddress: mockPendingSbtAddress,
          deployedAddress: mockPendingSbtAddress,
          displayName: 'Pending SBT',
          metadataPreview: { phase: 'deployed' },
          deployed: true,
        },
      ],
    });

    expect(promoted).toEqual([
      {
        address: mockPendingSbtAddress,
        name: 'Pending SBT',
        metadataPreview: { phase: 'deployed' },
      },
    ]);
  });

  it('builds published inline SBT links from newly deployed and resumed pending drafts', () => {
    expect(
      buildPublishedPendingSbtLinks({
        deployedDrafts: [
          {
            predictedAddress: mockPendingSbtAddress,
            deployedAddress: mockPendingSbtAddress,
            displayName: 'Newly Deployed Group',
            deployed: true,
          },
        ],
        pendingDraftSnapshot: [
          {
            predictedAddress: mockPendingSbtAddress,
            deployedAddress: mockPendingSbtAddress,
            displayName: 'Newly Deployed Group',
            deployed: true,
          },
          {
            predictedAddress: mockSecondPendingSbtAddress,
            deployedAddress: mockSecondPendingSbtAddress,
            deployed: true,
          },
        ],
        sessionSlug: 'writers-room',
      }),
    ).toEqual([
      {
        address: mockPendingSbtAddress,
        label: 'Newly Deployed Group',
        href: buildSbtDetailPath(mockPendingSbtAddress, 'writers-room'),
      },
      {
        address: mockSecondPendingSbtAddress,
        label: mockSecondPendingSbtAddress,
        href: buildSbtDetailPath(mockSecondPendingSbtAddress, 'writers-room'),
      },
    ]);
  });

  it('persists published pending SBT recovery codes to the scoped recovery store', () => {
    const writeRecoveryCodes = jest.fn(() => ({ ok: true, status: 'ok' }));

    const result = persistSessionWizardSbtRecoveryCodes({
      finalizedDraft: {
        hasPasswordMintOnChain: true,
        passwordList: ['claim-code-1'],
        groupPassword: '',
        usesInviteCodes: false,
      },
      sbtAddress: mockPendingSbtAddress,
      sessionConfigForDeploy: {
        networkChainId: 84532,
      },
      writeRecoveryCodes,
    });

    expect(result).toEqual({ ok: true, status: 'ok' });
    expect(writeRecoveryCodes).toHaveBeenCalledWith({
      chainId: 84532,
      sbtAddress: mockPendingSbtAddress,
      passwords: ['claim-code-1'],
      mode: 'replace',
    });
    expect(localStorage.getItem('createdSBTs')).toBeNull();
  });

  it('finalizes pending-upload SBT drafts before deterministic deploy during publish', async () => {
    const finalizeDeferredDraftUpload = jest.fn(async () => ({
      tokenURI: 'ar://finalized-pending-sbt',
      metadataPreview: { name: 'Pending SBT' },
      authoringPayload: { sbtName: 'Pending SBT', _sessionSlug: 'publish-test' },
    }));
    mockCreateSBT.mockResolvedValue({
      events: [
        {
          event: 'SBTCreatedDeterministic',
          args: { sbtAddress: mockPendingSbtAddress },
        },
      ],
      transactionHash: '0xdeploy-pending-sbt',
    });

    const pendingDraft = {
      id: 'pending-sbt-1',
      predictedAddress: mockPendingSbtAddress,
      displayName: 'Pending SBT',
      contractName: 'Pending SBT',
      symbol: 'CE-SBT-PEND',
      create2Salt: 'draft/test',
      limitedNumber: 0,
      adminAddress: '0xCreator',
      mintingEndTimeUnix: 0,
      hasPasswordMintOnChain: false,
      burnAuthEnum: 0,
      hashedPasswords: [],
      tokenURI: '',
      metadataUploadStatus: 'pending-upload',
      finalGroupPasswordHash: ethers.constants.HashZero,
      createOptions: { useConfiguredDeterministic: true, initializeGroupPasswordHash: false },
      authoringPayload: { sbtName: 'Pending SBT', _sessionSlug: 'publish-test' },
      passwordList: [],
      groupPassword: '',
      usesInviteCodes: false,
    };

    const finalizedDraft = await finalizeSessionWizardPendingSbtDraft({
      draftEntry: pendingDraft,
      workerUrlOverride: 'https://deployed.example.test',
      createSbtComponentProps: {
        account: TEST_ADMIN_ADDRESS,
        sessionConfigOverride: {
          slug: 'publish-test',
        },
      },
      finalizeDeferredDraftUpload,
    });
    const finalizePendingDraftMock = jest.fn(async () => finalizedDraft);

    const result = await deploySessionWizardPendingSbtDraft({
      sbtDraft: pendingDraft,
      providerLike: 'mock-provider',
      sessionConfigForDeploy: {
        slug: 'publish-test',
        contracts: {},
      },
      finalizePendingDraft: finalizePendingDraftMock,
      createSBT: mockCreateSBT,
    });

    expect(finalizeDeferredDraftUpload).toHaveBeenCalledWith(
      expect.objectContaining({
        authoringPayload: pendingDraft.authoringPayload,
        componentProps: expect.objectContaining({
          account: TEST_ADMIN_ADDRESS,
          sessionConfigOverride: expect.objectContaining({
            slug: 'publish-test',
          }),
        }),
      }),
    );
    expect(finalizePendingDraftMock.mock.invocationCallOrder[0]).toBeLessThan(
      mockCreateSBT.mock.invocationCallOrder[0],
    );
    expect(result.finalizedDraft.tokenURI).toBe('ar://finalized-pending-sbt');
    expect(mockCreateSBT).toHaveBeenCalledWith(
      'mock-provider',
      'Pending SBT',
      'CE-SBT-PEND',
      0,
      '0xCreator',
      0,
      false,
      0,
      [],
      'ar://finalized-pending-sbt',
      ethers.constants.HashZero,
      {
        slug: 'publish-test',
        contracts: {},
      },
      'draft/test',
      { useConfiguredDeterministic: true, initializeGroupPasswordHash: false },
    );
    expect(result.finalizedDraft).toEqual(
      expect.objectContaining({
        tokenURI: 'ar://finalized-pending-sbt',
        metadataUploadStatus: 'ready',
      }),
    );
  });

  it('resolves demo selector discovery from the source session config instead of the auto-seeded draft block window', () => {
    const latestBlock = 39316304;
    const selectorConfig = resolveSessionWizardSelectorSourceConfig({
      activeSessionSlug: 'demo',
      registryChainId: 84532,
      draftNetworkChainId: 84532,
      network: { id: 84532 },
      normalizeSlug: (value = '') =>
        String(value || '')
          .trim()
          .toLowerCase(),
      resolveStrictConfig: (slug = '') => {
        const normalized = String(slug || '')
          .trim()
          .toLowerCase();
        if (normalized && normalized !== 'general') return null;
        return {
          slug: '',
          sessionName: 'Context Engine',
          networkChainId: 84532,
          contracts: {
            sbtFactory: {
              address: mockSelectorSourceFactory,
              chainId: 84532,
            },
          },
          blockLimits: {
            start: mockSelectorSourceStartBlock,
            end: null,
          },
        };
      },
      resolveDisplayConfig: () => null,
    });

    expect(selectorConfig).toEqual(
      expect.objectContaining({
        slug: 'demo',
        networkChainId: 84532,
        contracts: expect.objectContaining({
          sbtFactory: expect.objectContaining({
            address: mockSelectorSourceFactory,
            chainId: 84532,
          }),
        }),
        blockLimits: expect.objectContaining({
          start: mockSelectorSourceStartBlock,
        }),
      }),
    );
    expect(selectorConfig?.blockLimits?.start).not.toBe(latestBlock);
  });
});
