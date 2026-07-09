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
  mockResolveDocLibraryProvider,
  mockUploadDocLibraryFile,
  mockListSessionStorageRefs,
  mockReadSessionStorageBlob,
  createDeferred,
  DocumentLibraryPanel,
  TEST_SESSION_CONFIG,
  setupDocumentLibraryPanelTestLifecycle,
} from './DocumentLibraryPanel.testUtils';

describe('DocumentLibraryPanel thumbnails and storage providers', () => {
  setupDocumentLibraryPanelTestLifecycle();

  it('renders image thumbnails directly in the document list', async () => {
    mockListArweaveTransactionsByTags.mockResolvedValueOnce([
      {
        cursor: 'cursor-d',
        txId: 'D'.repeat(43),
        owner: 'owner',
        tags: [],
        tagMap: {
          'CE-DocStorage': 'arweave',
          'CE-DocKind': 'file',
          'CE-DocName': 'briefing-board.png',
          'CE-DocMime': 'image/png',
        },
        data: { size: 4, type: 'image/png' },
        block: { height: 1, timestamp: 1710000003 },
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
        sessionIdHex={`0x${'4'.repeat(32)}`}
      />,
    );

    const preview = await screen.findByTestId(E2E_TESTIDS.DOC_ROW_IMAGE_PREVIEW);
    const image = preview.querySelector('img');
    expect(image).toBeTruthy();
    expect(image?.getAttribute('src')).toBe(`https://arweave.example.test/${'D'.repeat(43)}`);
  });

  it('loads encrypted image thumbnails when scoped Lit hooks become available after render', async () => {
    const litStorage = require('../../utilities/crypto/litProtocol.js').litStorage;
    const getKey = jest.fn(async () => ({ ciphertext: 'ciphertext', dataToEncryptHash: 'hash' }));
    const pendingUnscopedPreview = createDeferred<{
      payload: { ciphertext: string; dataToEncryptHash: string };
    }>();
    litStorage.downloadEncryptedArweaveData.mockReturnValueOnce(pendingUnscopedPreview.promise).mockResolvedValueOnce({
      payload: { ciphertext: 'ciphertext', dataToEncryptHash: 'hash' },
    });
    litStorage.decodeLitPayloadToBlob.mockReturnValue(
      new Blob([new Uint8Array([137, 80, 78, 71])], { type: 'image/png' }),
    );
    mockListArweaveTransactionsByTags.mockResolvedValue([
      {
        cursor: 'cursor-e',
        txId: 'E'.repeat(43),
        owner: 'owner',
        tags: [],
        tagMap: {
          'CE-DocStorage': 'lit-arweave',
          'CE-DocKind': 'file',
          'CE-DocName': 'encrypted-board.png',
          'CE-DocMime': 'image/png',
        },
        data: { size: 4, type: 'image/png' },
        block: { height: 1, timestamp: 1710000004 },
      },
    ]);

    const panelProps = {
      provider: {},
      network: { id: 84532 },
      account: '0x123',
      loginComplete: true,
      toggleLoginModal: jest.fn(),
      sessionSlug: 'edge',
      sessionConfig: TEST_SESSION_CONFIG,
      mode: 'session',
      sessionIdHex: `0x${'9'.repeat(32)}`,
    };
    const { rerender } = render(<DocumentLibraryPanel {...panelProps} />);

    await screen.findByText('encrypted-board.png');
    expect(screen.queryByTestId(E2E_TESTIDS.DOC_ROW_IMAGE_PREVIEW)).not.toBeInTheDocument();

    rerender(<DocumentLibraryPanel {...panelProps} litHooks={{ getKey }} />);

    const preview = await screen.findByTestId(E2E_TESTIDS.DOC_ROW_IMAGE_PREVIEW);
    const image = preview.querySelector('img');
    expect(litStorage.downloadEncryptedArweaveData).toHaveBeenCalledWith(
      expect.objectContaining({
        lit: { getKey },
      }),
    );
    expect(image?.getAttribute('src')).toBe('blob:doc-library-image-preview');
    await act(async () => {
      pendingUnscopedPreview.resolve({ payload: { ciphertext: 'ciphertext', dataToEncryptHash: 'hash' } });
      await pendingUnscopedPreview.promise;
    });
  });

  it('lists and opens Cloudflare session docs through storage refs', async () => {
    mockResolveDocLibraryProvider.mockReturnValue('cloudflare');
    mockListSessionStorageRefs.mockResolvedValueOnce([
      {
        storageRef: {
          backend: 'cloudflare',
          id: 'cf_docopaque1',
          uri: '/storage/read?id=cf_docopaque1',
          contentType: 'text/plain',
          resource: 'docsContext',
        },
        metadata: {
          size: 12,
          tags: [
            { name: 'CE-DocKind', value: 'file' },
            { name: 'CE-DocName', value: 'Cloud policy note' },
          ],
        },
      },
    ]);
    mockReadSessionStorageBlob.mockResolvedValueOnce({
      headers: { get: (name: string) => (name.toLowerCase() === 'content-type' ? 'text/plain' : null) },
      blob: async () => ({ type: 'text/plain', text: async () => 'cloud text' }),
    });

    render(
      <DocumentLibraryPanel
        provider={{}}
        network={{ id: 84532 }}
        account="0x123"
        loginComplete
        toggleLoginModal={jest.fn()}
        sessionSlug="edge"
        sessionConfig={{ storageProfile: { backend: 'cloudflare' } }}
        mode="session"
        sessionIdHex={`0x${'7'.repeat(32)}`}
      />,
    );

    expect(await screen.findByText('Cloud policy note')).toBeInTheDocument();
    expect(mockListSessionStorageRefs).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionSlug: 'edge',
        resource: 'docsContext',
      }),
    );

    fireEvent.click(screen.getByTestId(E2E_TESTIDS.DOC_ROW_VIEW));

    await waitFor(() => {
      expect(mockReadSessionStorageBlob).toHaveBeenCalledWith(
        expect.objectContaining({
          storageRef: expect.objectContaining({ backend: 'cloudflare', id: 'cf_docopaque1' }),
        }),
      );
    });
    expect(await screen.findByTestId(E2E_TESTIDS.DOC_VIEWER_TEXT)).toHaveTextContent('cloud text');
    expect(JSON.stringify(mockReadSessionStorageBlob.mock.calls[0][0].storageRef)).not.toMatch(
      /bucket|account|token|secret|r2:\/\//i,
    );
  });

  it('auto-opens Cloudflare viewer links through session storage refs', async () => {
    mockReadSessionStorageBlob.mockResolvedValueOnce({
      headers: { get: (name: string) => (name.toLowerCase() === 'content-type' ? 'text/plain' : null) },
      blob: async () => ({ type: 'text/plain', text: async () => 'cloud auto text' }),
    });
    window.history.replaceState(
      {},
      '',
      '/session/edge/docs?keep=1&__ceDocRef=cf_docopaque1&__ceDocStorage=cloudflare&__ceDocKind=file&__ceDocName=Cloud%20auto',
    );

    render(
      <DocumentLibraryPanel
        provider={{}}
        network={{ id: 84532 }}
        account="0x123"
        loginComplete
        toggleLoginModal={jest.fn()}
        sessionSlug="edge"
        sessionConfig={{ storageProfile: { backend: 'cloudflare' } }}
        mode="session"
        sessionIdHex={`0x${'7'.repeat(32)}`}
      />,
    );

    await waitFor(() => {
      expect(mockReadSessionStorageBlob).toHaveBeenCalledWith(
        expect.objectContaining({
          storageRef: expect.objectContaining({ backend: 'cloudflare', id: 'cf_docopaque1' }),
        }),
      );
    });
    expect(await screen.findByTestId(E2E_TESTIDS.DOC_VIEWER_TEXT)).toHaveTextContent('cloud auto text');
    expect(window.location.search).toBe('?keep=1');
  });

  it('auto-opens encrypted viewer links without requiring Lit getKey hooks', async () => {
    const litStorage = require('../../utilities/crypto/litProtocol.js').litStorage;
    const txId = 'F'.repeat(43);
    litStorage.downloadEncryptedArweaveData.mockResolvedValueOnce({
      payload: { name: 'Encrypted auto', mime: 'text/plain', text: 'lit auto text' },
    });
    litStorage.decodeLitPayloadToText.mockReturnValueOnce('lit auto text');
    window.history.replaceState(
      {},
      '',
      `/session/edge/docs?__ceDocTx=${txId}&__ceDocStorage=lit-arweave&__ceDocKind=file&__ceDocName=Encrypted%20auto`,
    );

    const panelProps = {
      provider: {},
      network: { id: 84532 },
      account: '0x123',
      loginComplete: true,
      toggleLoginModal: jest.fn(),
      sessionSlug: 'edge',
      sessionConfig: TEST_SESSION_CONFIG,
      mode: 'session',
      sessionIdHex: `0x${'8'.repeat(32)}`,
    };

    await act(async () => {
      render(<DocumentLibraryPanel {...panelProps} />);
      await Promise.resolve();
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(litStorage.downloadEncryptedArweaveData).toHaveBeenCalledWith(
        expect.objectContaining({
          url: `https://lit.example.test/${txId}`,
          providerLike: {},
          account: '0x123',
        }),
      );
    });
    expect(litStorage.downloadEncryptedArweaveData.mock.calls[0][0]).not.toHaveProperty('lit');
    expect(await screen.findByTestId(E2E_TESTIDS.DOC_VIEWER_TEXT)).toHaveTextContent('lit auto text');
    expect(window.location.search).toBe('');
  });

  it('allows Cloudflare session file uploads before sessionIdHex resolves', async () => {
    mockResolveDocLibraryProvider.mockReturnValue('cloudflare');
    mockUploadDocLibraryFile.mockResolvedValueOnce({
      txId: 'cf_pending_session',
      storageRef: {
        backend: 'cloudflare',
        id: 'cf_pending_session',
        resource: 'docsContext',
      },
      tagMap: {
        'CE-DocStorage': 'cloudflare',
        'CE-DocName': 'cloudflare-upload.txt',
      },
      data: { size: 5, type: 'text/plain' },
    });

    render(
      <DocumentLibraryPanel
        provider={{}}
        network={{ id: 84532 }}
        account="0x123"
        loginComplete
        toggleLoginModal={jest.fn()}
        sessionSlug="edge"
        sessionConfig={{ storageProfile: { backend: 'cloudflare' } }}
        mode="session"
      />,
    );

    const file = new File(['cloud'], 'cloudflare-upload.txt', { type: 'text/plain' });
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
          sessionSlug: 'edge',
          sessionConfig: { storageProfile: { backend: 'cloudflare' } },
          tags: expect.arrayContaining([expect.objectContaining({ name: 'CE-DocStorage', value: 'cloudflare' })]),
        }),
      );
    });
    expect(screen.queryByText('Session ID is unavailable; cannot upload session docs.')).not.toBeInTheDocument();
  });

  it('requires encrypted uploads for lit-arweave session document storage', async () => {
    mockResolveDocLibraryProvider.mockReturnValue('lit-arweave');
    const saveKey = jest.fn(async () => ({ ciphertext: 'ciphertext', dataToEncryptHash: 'hash' }));
    mockGetGlobalLitHooks.mockReturnValue({ saveKey });

    render(
      <DocumentLibraryPanel
        provider={{}}
        network={{ id: 84532 }}
        account="0x123"
        loginComplete
        toggleLoginModal={jest.fn()}
        sessionSlug="edge"
        sessionConfig={{
          ...TEST_SESSION_CONFIG,
          storageProfile: { backend: 'lit-arweave' },
        }}
        mode="session"
        sessionIdHex={`0x${'8'.repeat(32)}`}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId(E2E_TESTIDS.DOC_LOCK_TOGGLE)).toHaveAttribute('data-ce-locked', 'true');
      expect(screen.getByTestId(E2E_TESTIDS.DOC_LOCK_TOGGLE)).toBeDisabled();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Add mock selected SBT' }));
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
      expect(mockUploadDocLibraryFile).toHaveBeenCalledWith(
        expect.objectContaining({
          file,
          encryption: expect.objectContaining({
            enabled: true,
            saveKey,
            accessControlConditions: [{ contractAddress: '0xgate' }],
          }),
          tags: expect.arrayContaining([expect.objectContaining({ name: 'CE-DocStorage', value: 'lit-arweave' })]),
        }),
      );
    });
  });

  it('can render the browse list without upload controls', async () => {
    await act(async () => {
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
          showUploadControls={false}
        />,
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(mockListArweaveTransactionsByTags).toHaveBeenCalled();
    });
    expect(screen.queryByTestId(E2E_TESTIDS.DOC_UPLOAD_FILE_INPUT)).not.toBeInTheDocument();
    expect(screen.queryByTestId(E2E_TESTIDS.DOC_URL_INPUT)).not.toBeInTheDocument();
  });
});
