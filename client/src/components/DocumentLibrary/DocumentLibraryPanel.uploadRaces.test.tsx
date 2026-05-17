import {
  React,
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  E2E_TESTIDS,
  mockListArweaveTransactionsByTags,
  mockResolveDocLibraryProvider,
  mockUploadDocLibraryFile,
  mockUploadDocLibraryUrlRecord,
  mockListSessionStorageRefs,
  createDeferred,
  getDocumentLibraryStateUpdateWarnings,
  DocumentLibraryPanel,
  TEST_SESSION_CONFIG,
  setupDocumentLibraryPanelTestLifecycle,
} from './DocumentLibraryPanel.testUtils';

describe('DocumentLibraryPanel upload and list race guards', () => {
  setupDocumentLibraryPanelTestLifecycle();

  it('does not prepend completed uploads after the panel context changes', async () => {
    const slowUpload = createDeferred<any>();
    mockUploadDocLibraryFile.mockReturnValueOnce(slowUpload.promise);
    const panelProps = {
      provider: {},
      network: { id: 84532 },
      account: '0x123',
      loginComplete: true,
      toggleLoginModal: jest.fn(),
      sessionSlug: 'edge-a',
      sessionConfig: TEST_SESSION_CONFIG,
      mode: 'session',
      sessionIdHex: `0x${'a'.repeat(32)}`,
    };

    const { rerender } = render(<DocumentLibraryPanel {...panelProps} />);

    const file = new File(['old context'], 'old-context.txt', { type: 'text/plain' });
    fireEvent.change(screen.getByTestId(E2E_TESTIDS.DOC_UPLOAD_FILE_INPUT), {
      target: { files: [file] },
    });
    fireEvent.click(screen.getByTestId(E2E_TESTIDS.DOC_UPLOAD_FILE_BUTTON));

    await waitFor(() => {
      expect(mockUploadDocLibraryFile).toHaveBeenCalledWith(expect.objectContaining({
        file,
        sessionSlug: 'edge-a',
      }));
    });

    rerender(
      <DocumentLibraryPanel
        {...panelProps}
        sessionSlug="edge-b"
        sessionIdHex={`0x${'b'.repeat(32)}`}
      />
    );

    await act(async () => {
      slowUpload.resolve({
        txId: 'O'.repeat(43),
        tagMap: {
          'CE-DocStorage': 'arweave',
          'CE-DocKind': 'file',
          'CE-DocName': 'old-context.txt',
        },
        data: { size: 11, type: 'text/plain' },
      });
      await slowUpload.promise;
    });

    await Promise.resolve();
    await Promise.resolve();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(screen.queryByText('old-context.txt')).not.toBeInTheDocument();
  });

  it('does not prepend completed uploads after a same-slug session id refresh', async () => {
    const slowUpload = createDeferred<any>();
    mockUploadDocLibraryFile.mockReturnValueOnce(slowUpload.promise);
    const panelProps = {
      provider: {},
      network: { id: 84532 },
      account: '0x123',
      loginComplete: true,
      toggleLoginModal: jest.fn(),
      sessionSlug: 'edge',
      sessionConfig: TEST_SESSION_CONFIG,
      mode: 'session',
      sessionIdHex: `0x${'1'.repeat(32)}`,
    };

    const { rerender } = render(<DocumentLibraryPanel {...panelProps} />);

    const file = new File(['old session'], 'old-session.txt', { type: 'text/plain' });
    fireEvent.change(screen.getByTestId(E2E_TESTIDS.DOC_UPLOAD_FILE_INPUT), {
      target: { files: [file] },
    });
    fireEvent.click(screen.getByTestId(E2E_TESTIDS.DOC_UPLOAD_FILE_BUTTON));

    await waitFor(() => {
      expect(mockUploadDocLibraryFile).toHaveBeenCalledWith(expect.objectContaining({
        file,
        tags: expect.arrayContaining([
          expect.objectContaining({ name: 'CE-SessionId', value: `0x${'1'.repeat(32)}` }),
        ]),
      }));
    });

    rerender(
      <DocumentLibraryPanel
        {...panelProps}
        sessionIdHex={`0x${'2'.repeat(32)}`}
      />
    );

    await act(async () => {
      slowUpload.resolve({
        txId: 'I'.repeat(43),
        tagMap: {
          'CE-DocStorage': 'arweave',
          'CE-DocKind': 'file',
          'CE-DocName': 'old-session.txt',
          'CE-SessionId': `0x${'1'.repeat(32)}`,
        },
        data: { size: 11, type: 'text/plain' },
      });
      await slowUpload.promise;
      await Promise.resolve();
    });

    expect(screen.queryByText('old-session.txt')).not.toBeInTheDocument();
  });

  it('does not prepend completed uploads after the storage config changes', async () => {
    mockResolveDocLibraryProvider.mockImplementation((config: any) => (
      config?.storageProfile?.backend || config?.docLibrary?.provider || 'arweave'
    ));
    const slowUpload = createDeferred<any>();
    mockUploadDocLibraryFile.mockReturnValueOnce(slowUpload.promise);
    const panelProps = {
      provider: {},
      network: { id: 84532 },
      account: '0x123',
      loginComplete: true,
      toggleLoginModal: jest.fn(),
      sessionSlug: 'edge',
      sessionConfig: TEST_SESSION_CONFIG,
      mode: 'session',
      sessionIdHex: `0x${'e'.repeat(32)}`,
    };

    const { rerender } = render(<DocumentLibraryPanel {...panelProps} />);

    const file = new File(['old storage'], 'old-storage.txt', { type: 'text/plain' });
    fireEvent.change(screen.getByTestId(E2E_TESTIDS.DOC_UPLOAD_FILE_INPUT), {
      target: { files: [file] },
    });
    fireEvent.click(screen.getByTestId(E2E_TESTIDS.DOC_UPLOAD_FILE_BUTTON));

    await waitFor(() => {
      expect(mockUploadDocLibraryFile).toHaveBeenCalledWith(expect.objectContaining({
        file,
        sessionSlug: 'edge',
      }));
    });

    rerender(
      <DocumentLibraryPanel
        {...panelProps}
        sessionConfig={{ storageProfile: { backend: 'cloudflare', namespace: 'next-docs' } }}
      />
    );

    await act(async () => {
      slowUpload.resolve({
        txId: 'W'.repeat(43),
        tagMap: {
          'CE-DocStorage': 'arweave',
          'CE-DocKind': 'file',
          'CE-DocName': 'old-storage.txt',
        },
        data: { size: 11, type: 'text/plain' },
      });
      await slowUpload.promise;
    });

    await Promise.resolve();
    await Promise.resolve();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(screen.queryByText('old-storage.txt')).not.toBeInTheDocument();
  });

  it('does not apply document list completions after unmount', async () => {
    const slowList = createDeferred<any[]>();
    mockListArweaveTransactionsByTags.mockReturnValueOnce(slowList.promise);
    const { unmount } = render(
      <DocumentLibraryPanel
        provider={{}}
        network={{ id: 84532 }}
        account="0x123"
        loginComplete
        toggleLoginModal={jest.fn()}
        sessionSlug="edge"
        sessionConfig={TEST_SESSION_CONFIG}
        mode="session"
        sessionIdHex={`0x${'c'.repeat(32)}`}
      />
    );

    await waitFor(() => {
      expect(mockListArweaveTransactionsByTags).toHaveBeenCalled();
    });

    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      unmount();
      slowList.resolve([
        {
          cursor: 'cursor-unmounted',
          txId: 'U'.repeat(43),
          owner: 'owner',
          tags: [],
          tagMap: {
            'CE-DocStorage': 'arweave',
            'CE-DocKind': 'file',
            'CE-DocName': 'unmounted-list.txt',
          },
          data: { size: 11, type: 'text/plain' },
        },
      ]);

      await Promise.resolve();
      await Promise.resolve();
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(getDocumentLibraryStateUpdateWarnings(consoleErrorSpy)).toEqual([]);
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });

  it('does not apply stale Cloudflare list completions after an immediate context rerender', async () => {
    mockResolveDocLibraryProvider.mockReturnValue('cloudflare');
    const slowList = createDeferred<any[]>();
    mockListSessionStorageRefs
      .mockReturnValueOnce(slowList.promise)
      .mockResolvedValueOnce([]);
    const panelProps = {
      provider: {},
      network: { id: 84532 },
      account: '0x123',
      loginComplete: true,
      toggleLoginModal: jest.fn(),
      sessionSlug: 'edge-a',
      sessionConfig: { storageProfile: { backend: 'cloudflare' } },
      mode: 'session',
      sessionIdHex: `0x${'a'.repeat(32)}`,
    };

    const { rerender } = render(<DocumentLibraryPanel {...panelProps} />);
    await waitFor(() => {
      expect(mockListSessionStorageRefs).toHaveBeenCalledWith(expect.objectContaining({
        sessionSlug: 'edge-a',
      }));
    });

    rerender(
      <DocumentLibraryPanel
        {...panelProps}
        sessionSlug="edge-b"
        sessionIdHex={`0x${'b'.repeat(32)}`}
      />
    );
    await act(async () => {
      slowList.resolve([
        {
          storageRef: {
            backend: 'cloudflare',
            id: 'cf_stale_list',
            uri: '/storage/read?id=cf_stale_list',
            contentType: 'text/plain',
            resource: 'docsContext',
          },
          metadata: {
            size: 15,
            tags: [
              { name: 'CE-DocKind', value: 'file' },
              { name: 'CE-DocName', value: 'Stale list note' },
            ],
          },
        },
      ]);
      await Promise.resolve();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(screen.queryByText('Stale list note')).not.toBeInTheDocument();
  });

  it('does not apply upload completions after unmount', async () => {
    const slowUpload = createDeferred<any>();
    mockUploadDocLibraryFile.mockReturnValueOnce(slowUpload.promise);
    const { unmount } = render(
      <DocumentLibraryPanel
        provider={{}}
        network={{ id: 84532 }}
        account="0x123"
        loginComplete
        toggleLoginModal={jest.fn()}
        sessionSlug="edge"
        sessionConfig={TEST_SESSION_CONFIG}
        mode="session"
        sessionIdHex={`0x${'d'.repeat(32)}`}
      />
    );

    const file = new File(['unmounted'], 'unmounted-upload.txt', { type: 'text/plain' });
    fireEvent.change(screen.getByTestId(E2E_TESTIDS.DOC_UPLOAD_FILE_INPUT), {
      target: { files: [file] },
    });
    fireEvent.click(screen.getByTestId(E2E_TESTIDS.DOC_UPLOAD_FILE_BUTTON));

    await waitFor(() => {
      expect(mockUploadDocLibraryFile).toHaveBeenCalledWith(expect.objectContaining({
        file,
        sessionSlug: 'edge',
      }));
    });

    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      unmount();
      slowUpload.resolve({
        txId: 'V'.repeat(43),
        tagMap: {
          'CE-DocStorage': 'arweave',
          'CE-DocKind': 'file',
          'CE-DocName': 'unmounted-upload.txt',
        },
        data: { size: 9, type: 'text/plain' },
      });

      await Promise.resolve();
      await Promise.resolve();
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(getDocumentLibraryStateUpdateWarnings(consoleErrorSpy)).toEqual([]);
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });

  it('does not clear a newer selected file when an earlier upload completes', async () => {
    const slowUpload = createDeferred<any>();
    mockUploadDocLibraryFile.mockReturnValueOnce(slowUpload.promise);
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
        sessionIdHex={`0x${'d'.repeat(32)}`}
      />
    );

    const firstFile = new File(['first'], 'first-upload.txt', { type: 'text/plain' });
    const nextFile = new File(['next'], 'next-upload.txt', { type: 'text/plain' });
    const fileInput = screen.getByTestId(E2E_TESTIDS.DOC_UPLOAD_FILE_INPUT);
    fireEvent.change(fileInput, {
      target: { files: [firstFile] },
    });
    fireEvent.click(screen.getByTestId(E2E_TESTIDS.DOC_UPLOAD_FILE_BUTTON));

    await waitFor(() => {
      expect(mockUploadDocLibraryFile).toHaveBeenCalledWith(expect.objectContaining({
        file: firstFile,
      }));
    });

    fireEvent.change(fileInput, {
      target: { files: [nextFile] },
    });

    await act(async () => {
      slowUpload.resolve({
        txId: 'N'.repeat(43),
        tagMap: {
          'CE-DocStorage': 'arweave',
          'CE-DocKind': 'file',
          'CE-DocName': 'first-upload.txt',
        },
        data: { size: 5, type: 'text/plain' },
      });
      await slowUpload.promise;
      await Promise.resolve();
    });

    expect(screen.getByTestId(E2E_TESTIDS.DOC_UPLOAD_FILE_BUTTON)).not.toBeDisabled();
  });

  it('does not clear newer URL fields when an earlier URL upload completes', async () => {
    const slowUpload = createDeferred<any>();
    mockUploadDocLibraryUrlRecord.mockReturnValueOnce(slowUpload.promise);
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
        sessionIdHex={`0x${'e'.repeat(32)}`}
      />
    );

    fireEvent.change(screen.getByTestId(E2E_TESTIDS.DOC_URL_INPUT), {
      target: { value: 'https://docs.example.test/first' },
    });
    fireEvent.change(screen.getByTestId(E2E_TESTIDS.DOC_URL_TITLE_INPUT), {
      target: { value: 'First link' },
    });
    fireEvent.click(screen.getByTestId(E2E_TESTIDS.DOC_URL_ADD_BUTTON));

    await waitFor(() => {
      expect(mockUploadDocLibraryUrlRecord).toHaveBeenCalledWith(expect.objectContaining({
        url: 'https://docs.example.test/first',
        title: 'First link',
      }));
    });

    fireEvent.change(screen.getByTestId(E2E_TESTIDS.DOC_URL_INPUT), {
      target: { value: 'https://docs.example.test/next' },
    });
    fireEvent.change(screen.getByTestId(E2E_TESTIDS.DOC_URL_TITLE_INPUT), {
      target: { value: 'Next link' },
    });

    await act(async () => {
      slowUpload.resolve({
        txId: 'L'.repeat(43),
        tagMap: {
          'CE-DocStorage': 'arweave',
          'CE-DocKind': 'link',
          'CE-DocName': 'First link',
        },
        data: { size: null, type: 'application/json' },
      });
      await slowUpload.promise;
      await Promise.resolve();
    });

    expect(screen.getByTestId(E2E_TESTIDS.DOC_URL_INPUT)).toHaveValue('https://docs.example.test/next');
    expect(screen.getByTestId(E2E_TESTIDS.DOC_URL_TITLE_INPUT)).toHaveValue('Next link');
  });
});
