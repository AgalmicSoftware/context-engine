import {
  React,
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
  E2E_TESTIDS,
  mockListArweaveTransactionsByTags,
  mockResolveDocLibraryProvider,
  mockListSessionStorageRefs,
  mockReadSessionStorageBlob,
  createDeferred,
  DocumentLibraryPanel,
  TEST_SESSION_CONFIG,
  setupDocumentLibraryPanelTestLifecycle,
} from './DocumentLibraryPanel.testUtils';

describe('DocumentLibraryPanel viewer race guards', () => {
  setupDocumentLibraryPanelTestLifecycle();

  it('keeps image documents previewable and downloadable in the viewer', async () => {
    const imageBlob = new Blob([new Uint8Array([137, 80, 78, 71])], { type: 'image/png' });
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      blob: async () => imageBlob,
      headers: {
        get: (name: string) => (name === 'content-type' ? 'image/png' : null),
      },
    });
    mockListArweaveTransactionsByTags.mockResolvedValueOnce([
      {
        cursor: 'cursor-c',
        txId: 'C'.repeat(43),
        owner: 'owner',
        tags: [],
        tagMap: {
          'CE-DocStorage': 'arweave',
          'CE-DocKind': 'file',
          'CE-DocName': 'policy-note.png',
          'CE-DocMime': 'image/png',
        },
        data: { size: 4, type: 'image/png' },
        block: { height: 1, timestamp: 1710000002 },
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
        sessionIdHex={`0x${'2'.repeat(32)}`}
      />,
    );

    const viewButton = await screen.findByTestId(E2E_TESTIDS.DOC_ROW_VIEW);
    fireEvent.click(viewButton);

    await waitFor(() => {
      expect(global.fetch as jest.Mock).toHaveBeenCalled();
      expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    });
    expect(await screen.findByTestId(E2E_TESTIDS.DOC_VIEWER_IMAGE)).toBeInTheDocument();
    expect(screen.getByTestId(E2E_TESTIDS.DOC_VIEWER_DOWNLOAD)).toBeInTheDocument();
  });

  it('keeps late document open requests from replacing the current viewer', async () => {
    const slowTxId = 'S'.repeat(43);
    const fastTxId = 'F'.repeat(43);
    const slowFetch = createDeferred<any>();
    (global.fetch as jest.Mock).mockImplementation((url: string) => {
      if (String(url).includes(slowTxId)) return slowFetch.promise;
      if (String(url).includes(fastTxId)) {
        return Promise.resolve({
          ok: true,
          blob: async () => ({ type: 'text/plain', text: async () => 'fast document' }),
          headers: { get: (name: string) => (name === 'content-type' ? 'text/plain' : null) },
        });
      }
      return Promise.reject(new Error(`Unexpected fetch: ${url}`));
    });
    mockListArweaveTransactionsByTags.mockResolvedValueOnce([
      {
        cursor: 'cursor-slow',
        txId: slowTxId,
        owner: 'owner',
        tags: [],
        tagMap: {
          'CE-DocStorage': 'arweave',
          'CE-DocKind': 'file',
          'CE-DocName': 'slow.txt',
          'CE-DocMime': 'text/plain',
        },
        data: { size: 4, type: 'text/plain' },
        block: { height: 1, timestamp: 1710000002 },
      },
      {
        cursor: 'cursor-fast',
        txId: fastTxId,
        owner: 'owner',
        tags: [],
        tagMap: {
          'CE-DocStorage': 'arweave',
          'CE-DocKind': 'file',
          'CE-DocName': 'fast.txt',
          'CE-DocMime': 'text/plain',
        },
        data: { size: 4, type: 'text/plain' },
        block: { height: 2, timestamp: 1710000003 },
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
        sessionIdHex={`0x${'2'.repeat(32)}`}
      />,
    );

    const rows = await screen.findAllByTestId(E2E_TESTIDS.DOC_ROW);
    const slowRow = rows.find((row) => row.getAttribute('data-ce-doc-txid') === slowTxId);
    const fastRow = rows.find((row) => row.getAttribute('data-ce-doc-txid') === fastTxId);
    if (!slowRow || !fastRow) throw new Error('Expected slow and fast document rows.');

    fireEvent.click(within(slowRow).getByTestId(E2E_TESTIDS.DOC_ROW_VIEW));
    fireEvent.click(within(fastRow).getByTestId(E2E_TESTIDS.DOC_ROW_VIEW));

    expect(await screen.findByTestId(E2E_TESTIDS.DOC_VIEWER_TEXT)).toHaveTextContent('fast document');

    slowFetch.resolve({
      ok: true,
      blob: async () => ({ type: 'text/plain', text: async () => 'slow document' }),
      headers: { get: (name: string) => (name === 'content-type' ? 'text/plain' : null) },
    });

    await waitFor(() => {
      expect(screen.getByTestId(E2E_TESTIDS.DOC_VIEWER_TEXT)).toHaveTextContent('fast document');
    });
    expect(screen.getByTestId(E2E_TESTIDS.DOC_VIEWER_TEXT)).not.toHaveTextContent('slow document');
  });

  it('cancels in-flight document open requests when the panel unmounts', async () => {
    const slowTxId = 'U'.repeat(43);
    const slowFetch = createDeferred<any>();
    const blobReader = jest.fn(async () => new Blob([new Uint8Array([137, 80, 78, 71])], { type: 'image/png' }));
    (global.fetch as jest.Mock).mockImplementation((url: string) => {
      if (String(url).includes(slowTxId)) return slowFetch.promise;
      return Promise.reject(new Error(`Unexpected fetch: ${url}`));
    });
    mockListArweaveTransactionsByTags.mockResolvedValueOnce([
      {
        cursor: 'cursor-unmount',
        txId: slowTxId,
        owner: 'owner',
        tags: [],
        tagMap: {
          'CE-DocStorage': 'arweave',
          'CE-DocKind': 'file',
          'CE-DocName': 'unmount.png',
          'CE-DocMime': 'image/png',
        },
        data: { size: 4, type: 'image/png' },
        block: { height: 1, timestamp: 1710000004 },
      },
    ]);

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
        sessionIdHex={`0x${'2'.repeat(32)}`}
      />,
    );

    fireEvent.click(await screen.findByTestId(E2E_TESTIDS.DOC_ROW_VIEW));
    unmount();
    slowFetch.resolve({
      ok: true,
      blob: blobReader,
      headers: { get: (name: string) => (name === 'content-type' ? 'image/png' : null) },
    });

    await waitFor(() => {
      expect(global.fetch as jest.Mock).toHaveBeenCalled();
    });
    await Promise.resolve();

    expect(blobReader).not.toHaveBeenCalled();
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });

  it('ignores in-flight document open requests after the panel context changes', async () => {
    mockResolveDocLibraryProvider.mockReturnValue('cloudflare');
    const slowRead = createDeferred<any>();
    mockListSessionStorageRefs.mockResolvedValueOnce([
      {
        storageRef: {
          backend: 'cloudflare',
          id: 'cf_old_context',
          uri: '/storage/read?id=cf_old_context',
          contentType: 'text/plain',
          resource: 'docsContext',
        },
        metadata: {
          size: 16,
          tags: [
            { name: 'CE-DocKind', value: 'file' },
            { name: 'CE-DocName', value: 'Old context note' },
          ],
        },
      },
    ]);
    mockReadSessionStorageBlob.mockReturnValueOnce(slowRead.promise);
    const panelProps = {
      provider: {},
      network: { id: 84532 },
      account: '0x123',
      loginComplete: true,
      toggleLoginModal: jest.fn(),
      sessionSlug: 'edge-a',
      sessionConfig: { storageProfile: { backend: 'cloudflare' } },
      mode: 'session',
      sessionIdHex: `0x${'7'.repeat(32)}`,
    };

    const { rerender } = render(<DocumentLibraryPanel {...panelProps} />);

    expect(await screen.findByText('Old context note')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId(E2E_TESTIDS.DOC_ROW_VIEW));
    await waitFor(() => {
      expect(mockReadSessionStorageBlob).toHaveBeenCalledWith(
        expect.objectContaining({
          storageRef: expect.objectContaining({ backend: 'cloudflare', id: 'cf_old_context' }),
        }),
      );
    });
    expect(screen.getByTestId(E2E_TESTIDS.DOC_VIEWER)).toBeInTheDocument();

    rerender(
      <DocumentLibraryPanel
        {...panelProps}
        account="0x456"
        sessionSlug="edge-b"
        sessionIdHex={`0x${'8'.repeat(32)}`}
      />,
    );
    await waitFor(() => {
      expect(screen.queryByTestId(E2E_TESTIDS.DOC_VIEWER)).not.toBeInTheDocument();
    });

    slowRead.resolve({
      headers: { get: (name: string) => (name.toLowerCase() === 'content-type' ? 'text/plain' : null) },
      blob: async () => ({ type: 'text/plain', text: async () => 'old context text' }),
    });
    await Promise.resolve();
    await Promise.resolve();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(screen.queryByText('old context text')).not.toBeInTheDocument();
  });

  it('ignores in-flight document open requests after a same-slug session id refresh', async () => {
    mockResolveDocLibraryProvider.mockReturnValue('cloudflare');
    const slowRead = createDeferred<any>();
    mockListSessionStorageRefs
      .mockResolvedValueOnce([
        {
          storageRef: {
            backend: 'cloudflare',
            id: 'cf_old_session_id',
            uri: '/storage/read?id=cf_old_session_id',
            contentType: 'text/plain',
            resource: 'docsContext',
          },
          metadata: {
            size: 16,
            tags: [
              { name: 'CE-DocKind', value: 'file' },
              { name: 'CE-DocName', value: 'Old session id note' },
            ],
          },
        },
      ])
      .mockResolvedValueOnce([]);
    mockReadSessionStorageBlob.mockReturnValueOnce(slowRead.promise);
    const panelProps = {
      provider: {},
      network: { id: 84532 },
      account: '0x123',
      loginComplete: true,
      toggleLoginModal: jest.fn(),
      sessionSlug: 'edge',
      sessionConfig: { storageProfile: { backend: 'cloudflare' } },
      mode: 'session',
      sessionIdHex: `0x${'7'.repeat(32)}`,
    };

    const { rerender } = render(<DocumentLibraryPanel {...panelProps} />);

    expect(await screen.findByText('Old session id note')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId(E2E_TESTIDS.DOC_ROW_VIEW));
    await waitFor(() => {
      expect(mockReadSessionStorageBlob).toHaveBeenCalledWith(
        expect.objectContaining({
          storageRef: expect.objectContaining({ backend: 'cloudflare', id: 'cf_old_session_id' }),
        }),
      );
    });

    rerender(<DocumentLibraryPanel {...panelProps} sessionIdHex={`0x${'8'.repeat(32)}`} />);
    await act(async () => {
      slowRead.resolve({
        headers: { get: (name: string) => (name.toLowerCase() === 'content-type' ? 'text/plain' : null) },
        blob: async () => ({ type: 'text/plain', text: async () => 'old session id text' }),
      });
      await Promise.resolve();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(screen.queryByText('old session id text')).not.toBeInTheDocument();
  });

  it('ignores in-flight document open requests resolved immediately after a context rerender', async () => {
    mockResolveDocLibraryProvider.mockReturnValue('cloudflare');
    const slowRead = createDeferred<any>();
    mockListSessionStorageRefs
      .mockResolvedValueOnce([
        {
          storageRef: {
            backend: 'cloudflare',
            id: 'cf_render_context',
            uri: '/storage/read?id=cf_render_context',
            contentType: 'text/plain',
            resource: 'docsContext',
          },
          metadata: {
            size: 17,
            tags: [
              { name: 'CE-DocKind', value: 'file' },
              { name: 'CE-DocName', value: 'Render context note' },
            ],
          },
        },
      ])
      .mockResolvedValueOnce([]);
    mockReadSessionStorageBlob.mockReturnValueOnce(slowRead.promise);
    const panelProps = {
      provider: {},
      network: { id: 84532 },
      account: '0x123',
      loginComplete: true,
      toggleLoginModal: jest.fn(),
      sessionSlug: 'edge-a',
      sessionConfig: { storageProfile: { backend: 'cloudflare' } },
      mode: 'session',
      sessionIdHex: `0x${'7'.repeat(32)}`,
    };

    const { rerender } = render(<DocumentLibraryPanel {...panelProps} />);

    expect(await screen.findByText('Render context note')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId(E2E_TESTIDS.DOC_ROW_VIEW));
    await waitFor(() => {
      expect(mockReadSessionStorageBlob).toHaveBeenCalledWith(
        expect.objectContaining({
          storageRef: expect.objectContaining({ backend: 'cloudflare', id: 'cf_render_context' }),
        }),
      );
    });

    rerender(
      <DocumentLibraryPanel
        {...panelProps}
        account="0x456"
        sessionSlug="edge-b"
        sessionIdHex={`0x${'8'.repeat(32)}`}
      />,
    );
    await act(async () => {
      slowRead.resolve({
        headers: { get: (name: string) => (name.toLowerCase() === 'content-type' ? 'text/plain' : null) },
        blob: async () => ({ type: 'text/plain', text: async () => 'render stale text' }),
      });
      await Promise.resolve();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(screen.queryByText('render stale text')).not.toBeInTheDocument();
  });

  it('ignores in-flight document open requests after the storage config changes', async () => {
    mockResolveDocLibraryProvider.mockImplementation((config: any) => config?.storageProfile?.backend || 'arweave');
    const slowRead = createDeferred<any>();
    mockListSessionStorageRefs.mockResolvedValueOnce([
      {
        storageRef: {
          backend: 'cloudflare',
          id: 'cf_storage_context',
          uri: '/storage/read?id=cf_storage_context',
          contentType: 'text/plain',
          resource: 'docsContext',
        },
        metadata: {
          size: 18,
          tags: [
            { name: 'CE-DocKind', value: 'file' },
            { name: 'CE-DocName', value: 'Old storage note' },
          ],
        },
      },
    ]);
    mockReadSessionStorageBlob.mockReturnValueOnce(slowRead.promise);
    const panelProps = {
      provider: {},
      network: { id: 84532 },
      account: '0x123',
      loginComplete: true,
      toggleLoginModal: jest.fn(),
      sessionSlug: 'edge',
      sessionConfig: { storageProfile: { backend: 'cloudflare', namespace: 'old-docs' } },
      mode: 'session',
      sessionIdHex: `0x${'7'.repeat(32)}`,
    };

    const { rerender } = render(<DocumentLibraryPanel {...panelProps} />);

    expect(await screen.findByText('Old storage note')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId(E2E_TESTIDS.DOC_ROW_VIEW));
    await waitFor(() => {
      expect(mockReadSessionStorageBlob).toHaveBeenCalledWith(
        expect.objectContaining({
          storageRef: expect.objectContaining({ backend: 'cloudflare', id: 'cf_storage_context' }),
        }),
      );
    });
    expect(screen.getByTestId(E2E_TESTIDS.DOC_VIEWER)).toBeInTheDocument();

    rerender(
      <DocumentLibraryPanel
        {...panelProps}
        sessionConfig={{ storageProfile: { backend: 'cloudflare', namespace: 'next-docs' } }}
      />,
    );
    await waitFor(() => {
      expect(screen.queryByTestId(E2E_TESTIDS.DOC_VIEWER)).not.toBeInTheDocument();
    });

    slowRead.resolve({
      headers: { get: (name: string) => (name.toLowerCase() === 'content-type' ? 'text/plain' : null) },
      blob: async () => ({ type: 'text/plain', text: async () => 'old storage text' }),
    });
    await Promise.resolve();
    await Promise.resolve();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(screen.queryByText('old storage text')).not.toBeInTheDocument();
  });
});
