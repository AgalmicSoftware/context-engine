import {
  React,
  fireEvent,
  render,
  screen,
  waitFor,
  E2E_TESTIDS,
  mockBuildSbtAccessControlConditions,
  mockGetGlobalLitHooks,
  mockGetUnsupportedLitContractAccessControlError,
  mockListArweaveTransactionsByTags,
  mockResolveDocUploadsGate,
  mockUploadDocLibraryFile,
  DocumentLibraryPanel,
  TEST_SESSION_CONFIG,
  setupDocumentLibraryPanelTestLifecycle,
} from './DocumentLibraryPanel.testUtils';

describe('DocumentLibraryPanel photo docs and upload audience', () => {
  setupDocumentLibraryPanelTestLifecycle();

  it('labels saved photo docs and paired photo analysis sidecars in the browse list', async () => {
    mockListArweaveTransactionsByTags.mockResolvedValueOnce([
      {
        cursor: 'cursor-a',
        txId: 'A'.repeat(43),
        owner: 'owner',
        tags: [],
        tagMap: {
          'CE-DocStorage': 'lit-arweave',
          'CE-DocKind': 'file',
          'CE-DocRole': 'photo-analysis',
        },
        data: { size: null, type: 'application/json' },
        block: { height: 1, timestamp: 1710000000 },
      },
      {
        cursor: 'cursor-b',
        txId: 'B'.repeat(43),
        owner: 'owner',
        tags: [],
        tagMap: {
          'CE-DocStorage': 'lit-arweave',
          'CE-DocKind': 'file',
          'CE-DocRole': 'photo',
        },
        data: { size: null, type: 'application/json' },
        block: { height: 1, timestamp: 1710000001 },
      },
    ]);

    render(
      <DocumentLibraryPanel
        provider={{}}
        network={{ id: 84532 }}
        account="0x123"
        loginComplete
        toggleLoginModal={jest.fn()}
        sessionSlug="edge"
        sessionConfig={TEST_SESSION_CONFIG}
        mode="session"
        sessionIdHex={`0x${'1'.repeat(32)}`}
      />
    );

    expect(await screen.findAllByTestId(E2E_TESTIDS.DOC_ROW)).toHaveLength(2);
    expect(screen.getByText('photo analysis')).toBeInTheDocument();
    expect(screen.getByText('photo')).toBeInTheDocument();
  });

  it('renders an embedded SBT selector for custom session audiences without chain or secondary-association helpers', async () => {
    mockResolveDocUploadsGate.mockReturnValue({
      gate: { sbtAddresses: ['0x00000000000000000000000000000000000000bb'], chainId: 84532, mode: 0 },
      lookupStatus: 'ok',
      sbtAddresses: ['0x00000000000000000000000000000000000000bb'],
      chainId: 84532,
      mode: 'any',
      hasRecipients: true,
    });

    render(
      <DocumentLibraryPanel
        provider={{}}
        network={{ id: 84532 }}
        account="0x123"
        loginComplete
        toggleLoginModal={jest.fn()}
        sessionSlug="edge"
        sessionConfig={TEST_SESSION_CONFIG}
        mode="session"
        sessionIdHex={`0x${'4'.repeat(32)}`}
      />
    );

    expect(screen.queryByText(/Chain:/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId(E2E_TESTIDS.DOC_AUDIENCE_CUSTOM));

    expect(await screen.findByTestId(E2E_TESTIDS.DOC_CUSTOM_SBT_SELECTOR)).toBeInTheDocument();
    expect(screen.getByTestId('mock-sbt-selector')).toBeInTheDocument();
    expect(screen.queryByTestId(E2E_TESTIDS.DOC_CUSTOM_SBT_INPUT)).not.toBeInTheDocument();
    expect(screen.queryByTestId(E2E_TESTIDS.DOC_CUSTOM_SBT_ADD)).not.toBeInTheDocument();
    expect(screen.queryByText('Copy from session gate')).not.toBeInTheDocument();
    expect(screen.queryByText('Add current SBT')).not.toBeInTheDocument();
    expect(screen.queryByText(/Also associate with SBT group/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Chain:/i)).not.toBeInTheDocument();
  });

  it('uses the selected custom SBTs for encrypted session uploads', async () => {
    mockResolveDocUploadsGate.mockReturnValue({
      gate: { sbtAddresses: ['0x00000000000000000000000000000000000000bb'], chainId: 84532, mode: 0 },
      lookupStatus: 'ok',
      sbtAddresses: ['0x00000000000000000000000000000000000000bb'],
      chainId: 84532,
      mode: 'any',
      hasRecipients: true,
    });
    mockGetGlobalLitHooks.mockReturnValue({
      saveKey: jest.fn(async () => ({ ciphertext: 'ciphertext', dataToEncryptHash: 'hash' })),
    });

    render(
      <DocumentLibraryPanel
        provider={{}}
        network={{ id: 84532 }}
        account="0x123"
        loginComplete
        toggleLoginModal={jest.fn()}
        sessionSlug="edge"
        sessionConfig={TEST_SESSION_CONFIG}
        mode="session"
        sessionIdHex={`0x${'5'.repeat(32)}`}
      />
    );

    fireEvent.click(screen.getByTestId(E2E_TESTIDS.DOC_AUDIENCE_CUSTOM));
    fireEvent.click(screen.getByRole('button', { name: 'Add mock selected SBT' }));
    fireEvent.click(screen.getByTestId(E2E_TESTIDS.DOC_CUSTOM_MODE_ALL));

    expect(screen.getByText('Mock Selected SBT')).toBeInTheDocument();

    const file = new File(['secret'], 'secret.txt', { type: 'text/plain' });
    fireEvent.change(screen.getByTestId(E2E_TESTIDS.DOC_UPLOAD_FILE_INPUT), {
      target: { files: [file] },
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId(E2E_TESTIDS.DOC_UPLOAD_FILE_BUTTON));
      await Promise.resolve();
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(mockBuildSbtAccessControlConditions).toHaveBeenCalledWith(expect.objectContaining({
        sbtAddresses: ['0x00000000000000000000000000000000000000aa'],
        chainId: 84532,
        mode: 'all',
      }));
      expect(mockUploadDocLibraryFile).toHaveBeenCalledWith(expect.objectContaining({
        file,
        encryption: expect.objectContaining({
          enabled: true,
          accessControlConditions: [{ contractAddress: '0xgate' }],
          chainId: 84532,
        }),
      }));
    });
  });

  it('uses scoped Lit hooks for OP Sepolia session-gate uploads when Chipotle credentials stay server-side', async () => {
    mockResolveDocUploadsGate.mockReturnValue({
      gate: { sbtAddresses: ['0x00000000000000000000000000000000000000bb'], chainId: 11155420, mode: 0 },
      lookupStatus: 'ok',
      sbtAddresses: ['0x00000000000000000000000000000000000000bb'],
      chainId: 11155420,
      mode: 'any',
      hasRecipients: true,
    });
    mockGetUnsupportedLitContractAccessControlError.mockReturnValue(
      'Lit does not currently support OP Sepolia for SBT-gated encryption.',
    );
    const scopedSaveKey = jest.fn(async () => ({ ciphertext: 'ciphertext', dataToEncryptHash: 'hash' }));

    render(
      <DocumentLibraryPanel
        provider={{}}
        network={{ id: 11155420 }}
        account="0x123"
        litHooks={{ saveKey: scopedSaveKey }}
        loginComplete
        toggleLoginModal={jest.fn()}
        sessionSlug="edge"
        sessionConfig={{
          ...TEST_SESSION_CONFIG,
          corsWorkerUrl: 'https://worker.example.test',
        }}
        mode="session"
        sessionIdHex={`0x${'6'.repeat(32)}`}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId(E2E_TESTIDS.DOC_LOCK_TOGGLE)).toHaveAttribute('data-ce-locked', 'true');
    });

    const file = new File(['secret'], 'secret.txt', { type: 'text/plain' });
    fireEvent.change(screen.getByTestId(E2E_TESTIDS.DOC_UPLOAD_FILE_INPUT), {
      target: { files: [file] },
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId(E2E_TESTIDS.DOC_UPLOAD_FILE_BUTTON));
      await Promise.resolve();
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(mockUploadDocLibraryFile).toHaveBeenCalledWith(expect.objectContaining({
        file,
        encryption: expect.objectContaining({
          enabled: true,
          chainId: 11155420,
          saveKey: scopedSaveKey,
        }),
      }));
    });
  });
});
