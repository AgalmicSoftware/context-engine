import {
  SESSION_MODE_PRESET_IDS,
  cloneSessionModePreset,
  compileSessionModeProfile,
  type SessionModeProfile,
} from '../../utilities/session/sessionModeProfile';
import {
  React,
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  E2E_TESTIDS,
  mockGetGlobalLitHooks,
  mockListArweaveTransactionsByTags,
  mockListSessionStorageRefs,
  mockResolveDocLibraryProvider,
  mockSBTSelector,
  mockUploadDocLibraryFile,
  DocumentLibraryPanel,
  setupDocumentLibraryPanelTestLifecycle,
} from './DocumentLibraryPanel.testUtils';

const buildSessionConfig = (profile: SessionModeProfile) => ({
  slug: 'worker-docs',
  corsWorkerUrl: 'https://worker-docs.example.test',
  sessionModeProfile: profile,
  storageProfile: compileSessionModeProfile(profile).storageProfile,
});

const buildPureWorkerProfile = (encryptionMode: 'none' | 'worker_envelope'): SessionModeProfile => {
  const profile = cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE);
  if (encryptionMode === 'none') {
    profile.preset = SESSION_MODE_PRESET_IDS.CUSTOM;
    profile.encryption = { mode: 'none' };
    profile.storage.payloadAccessControl = { gate: 'none', encryption: 'none' };
  }
  return profile;
};

const buildWorkerLitProfile = (): SessionModeProfile => {
  const profile = cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE);
  profile.preset = SESSION_MODE_PRESET_IDS.CUSTOM;
  profile.evm.registryChainId = 11155420;
  profile.encryption = { mode: 'lit' };
  profile.storage.payloadAccessControl = {
    ...profile.storage.payloadAccessControl!,
    encryption: 'lit',
  };
  return profile;
};

const buildWorkerSbtProfile = (): SessionModeProfile => {
  const profile = cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE);
  profile.preset = SESSION_MODE_PRESET_IDS.CUSTOM;
  profile.evm.registryChainId = 11155420;
  profile.encryption.accessConditions = {
    match: 'all',
    conditions: [
      { kind: 'worker_role', role: 'reviewer' },
      {
        kind: 'sbt_onchain',
        chainId: 11155420,
        contract: '0x00000000000000000000000000000000000000aa',
        anyOrAll: 'any',
      },
    ],
  };
  return profile;
};

describe('DocumentLibraryPanel session capability controls', () => {
  setupDocumentLibraryPanelTestLifecycle();

  it.each(['worker_envelope', 'none'] as const)(
    'keeps pure Worker %s sessions on Worker storage without mounting Lit, SBT, or chain controls',
    async (encryptionMode) => {
      const sessionConfig = buildSessionConfig(buildPureWorkerProfile(encryptionMode));
      mockResolveDocLibraryProvider.mockReturnValue('arweave');

      render(
        <DocumentLibraryPanel
          provider={{ staleWalletProvider: true }}
          network={{ id: 84532 }}
          account="0x123"
          loginComplete
          sessionSlug="worker-docs"
          sessionConfig={sessionConfig}
          mode="session"
        />,
      );

      await waitFor(() => expect(mockListSessionStorageRefs).toHaveBeenCalledTimes(1));
      expect(mockListSessionStorageRefs).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionSlug: 'worker-docs',
          context: expect.objectContaining({ chainId: null }),
          resource: 'docsContext',
        }),
      );
      expect(mockListArweaveTransactionsByTags).not.toHaveBeenCalled();
      expect(screen.queryByTestId(E2E_TESTIDS.DOC_LOCK_TOGGLE)).not.toBeInTheDocument();
      expect(screen.queryByTestId(E2E_TESTIDS.DOC_AUDIENCE_SESSION_GATE)).not.toBeInTheDocument();
      expect(screen.queryByTestId(E2E_TESTIDS.DOC_AUDIENCE_CUSTOM)).not.toBeInTheDocument();
      expect(screen.queryByTestId(E2E_TESTIDS.DOC_CUSTOM_SBT_SELECTOR)).not.toBeInTheDocument();
      expect(mockSBTSelector).not.toHaveBeenCalled();
      expect(mockGetGlobalLitHooks).not.toHaveBeenCalled();

      const file = new File(['worker document'], 'worker.txt', { type: 'text/plain' });
      fireEvent.change(screen.getByTestId(E2E_TESTIDS.DOC_UPLOAD_FILE_INPUT), {
        target: { files: [file] },
      });
      await act(async () => {
        fireEvent.click(screen.getByTestId(E2E_TESTIDS.DOC_UPLOAD_FILE_BUTTON));
        await Promise.resolve();
        await Promise.resolve();
      });

      await waitFor(() => {
        expect(mockUploadDocLibraryFile).toHaveBeenCalledWith(
          expect.objectContaining({
            file,
            sessionConfig,
            chainId: null,
            tags: expect.arrayContaining([expect.objectContaining({ name: 'CE-DocStorage', value: 'cloudflare' })]),
          }),
        );
      });
      expect(mockUploadDocLibraryFile.mock.calls[0][0]).not.toHaveProperty('encryption');
      expect(mockGetGlobalLitHooks).not.toHaveBeenCalled();
    },
  );

  it.each([
    ['missing profile', { slug: 'worker-docs', corsWorkerUrl: 'https://worker-docs.example.test' }],
    [
      'invalid profile',
      (() => {
        const profile = buildPureWorkerProfile('worker_envelope');
        profile.storage.backend = 'arweave';
        return {
          slug: 'worker-docs',
          corsWorkerUrl: 'https://worker-docs.example.test',
          sessionModeProfile: profile,
          storageProfile: { backend: 'cloudflare' },
        };
      })(),
    ],
  ])('fails closed on chain and Lit document controls for a %s', async (_label, sessionConfig) => {
    mockResolveDocLibraryProvider.mockReturnValue('cloudflare');

    render(
      <DocumentLibraryPanel
        provider={{ staleWalletProvider: true }}
        network={{ id: 84532 }}
        account="0x123"
        loginComplete
        sessionSlug="worker-docs"
        sessionConfig={sessionConfig}
        mode="session"
      />,
    );

    await waitFor(() => expect(mockListSessionStorageRefs).toHaveBeenCalledTimes(1));
    expect(mockListSessionStorageRefs).toHaveBeenCalledWith(
      expect.objectContaining({
        context: expect.objectContaining({ chainId: null }),
      }),
    );
    expect(screen.queryByTestId(E2E_TESTIDS.DOC_LOCK_TOGGLE)).not.toBeInTheDocument();
    expect(screen.queryByTestId(E2E_TESTIDS.DOC_CUSTOM_SBT_SELECTOR)).not.toBeInTheDocument();
    expect(mockSBTSelector).not.toHaveBeenCalled();
    expect(mockGetGlobalLitHooks).not.toHaveBeenCalled();
  });

  it('keeps a Worker-Lit hybrid on Worker storage without exposing SBT audiences', async () => {
    const profile = buildWorkerLitProfile();
    const sessionConfig = buildSessionConfig(profile);
    mockResolveDocLibraryProvider.mockReturnValue('arweave');

    render(
      <DocumentLibraryPanel
        provider={{}}
        network={{ id: profile.evm.registryChainId }}
        account="0x123"
        loginComplete
        sessionSlug="worker-docs"
        sessionConfig={sessionConfig}
        mode="session"
        sessionIdHex={`0x${'1'.repeat(32)}`}
      />,
    );

    await waitFor(() => expect(mockListSessionStorageRefs).toHaveBeenCalledTimes(1));
    expect(mockListSessionStorageRefs).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionSlug: 'worker-docs',
        context: expect.objectContaining({ chainId: null }),
        resource: 'docsContext',
      }),
    );
    expect(mockListArweaveTransactionsByTags).not.toHaveBeenCalled();
    expect(
      screen.getByText(
        'Lit-encrypted Cloudflare document uploads are not available yet. Upload is disabled for this profile; existing documents remain readable.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByTestId(E2E_TESTIDS.DOC_LOCK_TOGGLE)).not.toBeInTheDocument();
    expect(screen.queryByTestId(E2E_TESTIDS.DOC_AUDIENCE_SESSION_GATE)).not.toBeInTheDocument();
    expect(screen.queryByTestId(E2E_TESTIDS.DOC_AUDIENCE_CUSTOM)).not.toBeInTheDocument();
    expect(screen.queryByTestId(E2E_TESTIDS.DOC_CUSTOM_SBT_SELECTOR)).not.toBeInTheDocument();
    expect(mockSBTSelector).not.toHaveBeenCalled();

    fireEvent.change(screen.getByTestId(E2E_TESTIDS.DOC_UPLOAD_FILE_INPUT), {
      target: { files: [new File(['blocked'], 'blocked.txt', { type: 'text/plain' })] },
    });
    expect(screen.getByTestId(E2E_TESTIDS.DOC_UPLOAD_FILE_BUTTON)).toBeDisabled();
    expect(mockUploadDocLibraryFile).not.toHaveBeenCalled();
  });

  it('keeps Worker-SBT document uploads Worker-native without offering Lit controls', async () => {
    const profile = buildWorkerSbtProfile();
    const sessionConfig = buildSessionConfig(profile);
    mockResolveDocLibraryProvider.mockReturnValue('arweave');

    render(
      <DocumentLibraryPanel
        provider={{}}
        network={{ id: profile.evm.registryChainId }}
        account="0x123"
        loginComplete
        sessionSlug="worker-docs"
        sessionConfig={sessionConfig}
        mode="session"
        sessionIdHex={`0x${'1'.repeat(32)}`}
      />,
    );

    await waitFor(() => expect(mockListSessionStorageRefs).toHaveBeenCalledTimes(1));
    expect(mockListArweaveTransactionsByTags).not.toHaveBeenCalled();
    expect(
      screen.getByText(
        'Advanced SBT access gates do not enable Lit encryption for Worker-stored documents. Uploads use Worker-enforced access.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByTestId(E2E_TESTIDS.DOC_LOCK_TOGGLE)).not.toBeInTheDocument();
    expect(screen.queryByTestId(E2E_TESTIDS.DOC_AUDIENCE_CUSTOM)).not.toBeInTheDocument();
    expect(mockSBTSelector).not.toHaveBeenCalled();

    const file = new File(['worker sbt document'], 'worker-sbt.txt', { type: 'text/plain' });
    fireEvent.change(screen.getByTestId(E2E_TESTIDS.DOC_UPLOAD_FILE_INPUT), {
      target: { files: [file] },
    });
    fireEvent.click(screen.getByTestId(E2E_TESTIDS.DOC_UPLOAD_FILE_BUTTON));

    await waitFor(() =>
      expect(mockUploadDocLibraryFile).toHaveBeenCalledWith(
        expect.objectContaining({
          file,
          chainId: null,
          tags: expect.arrayContaining([expect.objectContaining({ name: 'CE-DocStorage', value: 'cloudflare' })]),
        }),
      ),
    );
    expect(mockUploadDocLibraryFile.mock.calls[0][0]).not.toHaveProperty('encryption');
  });

  it('preserves Lit-backed SBT audience controls for registry sessions', async () => {
    const profile = cloneSessionModePreset(SESSION_MODE_PRESET_IDS.TRUSTLESS_PUBLIC_DECENTRALIZED);
    const sessionConfig = buildSessionConfig(profile);
    mockResolveDocLibraryProvider.mockReturnValue('arweave');

    render(
      <DocumentLibraryPanel
        provider={{}}
        network={{ id: profile.evm.registryChainId }}
        account="0x123"
        loginComplete
        sessionSlug="worker-docs"
        sessionConfig={sessionConfig}
        mode="session"
        sessionIdHex={`0x${'1'.repeat(32)}`}
      />,
    );

    await waitFor(() => expect(mockListArweaveTransactionsByTags).toHaveBeenCalledTimes(1));
    expect(mockListSessionStorageRefs).not.toHaveBeenCalled();

    const lockToggle = screen.getByTestId(E2E_TESTIDS.DOC_LOCK_TOGGLE);
    expect(lockToggle).toBeInTheDocument();
    if (lockToggle.getAttribute('data-ce-locked') !== 'true') fireEvent.click(lockToggle);
    fireEvent.click(await screen.findByTestId(E2E_TESTIDS.DOC_AUDIENCE_CUSTOM));

    expect(await screen.findByTestId(E2E_TESTIDS.DOC_CUSTOM_SBT_SELECTOR)).toBeInTheDocument();
    expect(mockSBTSelector).toHaveBeenCalledWith(
      expect.objectContaining({
        network: expect.objectContaining({ id: profile.evm.registryChainId }),
      }),
    );
  });
});
