import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';

import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';

const mockBuildSbtAccessControlConditions = jest.fn();
const mockGetGlobalLitHooks = jest.fn();
const mockListArweaveTransactionsByTags = jest.fn();
const mockResolveDocLibraryProvider = jest.fn();
const mockResolveArweaveGraphqlUrl = jest.fn();
const mockResolveDocUploadsGate = jest.fn();
const mockUploadDocLibraryFile = jest.fn();
const mockUploadDocLibraryUrlRecord = jest.fn();
const mockSBTSelector = jest.fn();

const createDeferred = <T,>() => {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: any) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

jest.mock('../../utilities/logging.js', () => ({
  createLogger: () => ({
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }),
}));

jest.mock('../../utilities/docLibrary/arweaveGraphql.js', () => ({
  listArweaveTransactionsByTags: (...args: any[]) => mockListArweaveTransactionsByTags(...args),
}));

jest.mock('../../utilities/docLibrary/config.js', () => ({
  resolveDocLibraryProvider: (...args: any[]) => mockResolveDocLibraryProvider(...args),
  resolveArweaveGraphqlUrl: (...args: any[]) => mockResolveArweaveGraphqlUrl(...args),
}));

jest.mock('../../utilities/crypto/litProtocol.js', () => ({
  buildSbtAccessControlConditions: (...args: any[]) => mockBuildSbtAccessControlConditions(...args),
  getGlobalLitHooks: (...args: any[]) => mockGetGlobalLitHooks(...args),
  litStorage: {
    buildLitArweaveUrl: (txId: string) => `https://lit.example.test/${txId}`,
    downloadEncryptedArweaveData: jest.fn(),
    decodeLitPayloadToText: jest.fn(),
    decodeLitPayloadToBlob: jest.fn(),
  },
  resolveLitChain: jest.fn(() => 'ethereum'),
}));

jest.mock('../../utilities/arweave/arweaveScripts.js', () => ({
  arweaveScripts: {
    buildArweaveGatewayUrl: (txId: string, gateway = 'https://arweave.example.test') => `${gateway}/${txId}`,
    downloadDataFromArweave: jest.fn(),
  },
}));

jest.mock('../../utilities/docLibrary/uploads.js', () => ({
  resolveDocUploadsGate: (...args: any[]) => mockResolveDocUploadsGate(...args),
  uploadDocLibraryFile: (...args: any[]) => mockUploadDocLibraryFile(...args),
  uploadDocLibraryUrlRecord: (...args: any[]) => mockUploadDocLibraryUrlRecord(...args),
}));

jest.mock('../SBTs/SBTSelector', () => ({
  __esModule: true,
  default: (props: any) => {
    mockSBTSelector(props);
    return (
      <div data-testid="mock-sbt-selector">
        <button type="button" onClick={() => props.onAddSBT?.({
          address: '0x00000000000000000000000000000000000000aa',
          name: 'Mock Selected SBT',
          chainId: 84532,
        })}
        >
          Add mock selected SBT
        </button>
        <button
          type="button"
          onClick={() => props.onRemoveSBT?.('0x00000000000000000000000000000000000000aa')}
        >
          Remove mock selected SBT
        </button>
        <div>
          {(props.selectedSBTs || []).map((sbt: any) => (
            <span key={sbt.address}>{sbt.name || sbt.address}</span>
          ))}
        </div>
      </div>
    );
  },
}));

const DocumentLibraryPanel = require('./DocumentLibraryPanel').default as React.ComponentType<any>;
const TEST_SESSION_CONFIG = {
  docLibrary: {
    provider: 'arweave',
    arweave: {
      graphqlUrl: 'https://arweave.example.test/graphql',
    },
  },
};

describe('DocumentLibraryPanel photo docs', () => {
  let originalCreateObjectURL: typeof URL.createObjectURL;
  let originalRevokeObjectURL: typeof URL.revokeObjectURL;

  beforeEach(() => {
    jest.clearAllMocks();
    mockResolveDocLibraryProvider.mockReturnValue('arweave');
    mockResolveArweaveGraphqlUrl.mockReturnValue('https://arweave.example.test/graphql');
    mockResolveDocUploadsGate.mockReturnValue({
      gate: null,
      lookupStatus: '',
      sbtAddresses: [],
      chainId: null,
      mode: 'any',
      hasRecipients: false,
    });
    mockBuildSbtAccessControlConditions.mockReturnValue([{ contractAddress: '0xgate' }]);
    mockGetGlobalLitHooks.mockReturnValue(null);
    mockUploadDocLibraryFile.mockResolvedValue({
      txId: 'Z'.repeat(43),
      tagMap: {},
      data: { size: 6, type: 'text/plain' },
    });
    mockUploadDocLibraryUrlRecord.mockResolvedValue({
      txId: 'Y'.repeat(43),
      tagMap: {},
      data: { size: null, type: 'application/json' },
    });
    mockListArweaveTransactionsByTags.mockResolvedValue([]);
    global.fetch = jest.fn() as any;
    originalCreateObjectURL = URL.createObjectURL;
    originalRevokeObjectURL = URL.revokeObjectURL;
    URL.createObjectURL = jest.fn(() => 'blob:doc-library-image-preview');
    URL.revokeObjectURL = jest.fn();
  });

  afterEach(() => {
    delete (global as any).fetch;
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
    window.history.replaceState({}, '', '/');
  });

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
      />
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
      />
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
      />
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
      expect(mockReadSessionStorageBlob).toHaveBeenCalledWith(expect.objectContaining({
        storageRef: expect.objectContaining({ backend: 'cloudflare', id: 'cf_old_context' }),
      }));
    });
    expect(screen.getByTestId(E2E_TESTIDS.DOC_VIEWER)).toBeInTheDocument();

    rerender(
      <DocumentLibraryPanel
        {...panelProps}
        account="0x456"
        sessionSlug="edge-b"
        sessionIdHex={`0x${'8'.repeat(32)}`}
      />
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
      />
    );

    const preview = await screen.findByTestId(E2E_TESTIDS.DOC_ROW_IMAGE_PREVIEW);
    const image = preview.querySelector('img');
    expect(image).toBeTruthy();
    expect(image?.getAttribute('src')).toBe(`https://arweave.example.test/${'D'.repeat(43)}`);
  });

  it('loads encrypted image thumbnails when scoped Lit hooks become available after render', async () => {
    const litStorage = require('../../utilities/crypto/litProtocol.js').litStorage;
    const getKey = jest.fn(async () => ({ ciphertext: 'ciphertext', dataToEncryptHash: 'hash' }));
    litStorage.downloadEncryptedArweaveData.mockResolvedValue({
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
    expect(litStorage.downloadEncryptedArweaveData).toHaveBeenCalledWith(expect.objectContaining({
      lit: { getKey },
    }));
    expect(image?.getAttribute('src')).toBe('blob:doc-library-image-preview');
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
      />
    );

    expect(await screen.findByText('Cloud policy note')).toBeInTheDocument();
    expect(mockListSessionStorageRefs).toHaveBeenCalledWith(expect.objectContaining({
      sessionSlug: 'edge',
      resource: 'docsContext',
    }));

    fireEvent.click(screen.getByTestId(E2E_TESTIDS.DOC_ROW_VIEW));

    await waitFor(() => {
      expect(mockReadSessionStorageBlob).toHaveBeenCalledWith(expect.objectContaining({
        storageRef: expect.objectContaining({ backend: 'cloudflare', id: 'cf_docopaque1' }),
      }));
    });
    expect(await screen.findByTestId(E2E_TESTIDS.DOC_VIEWER_TEXT)).toHaveTextContent('cloud text');
    expect(JSON.stringify(mockReadSessionStorageBlob.mock.calls[0][0].storageRef)).not.toMatch(/bucket|account|token|secret|r2:\/\//i);
  });

  it('auto-opens Cloudflare viewer links through session storage refs', async () => {
    mockReadSessionStorageBlob.mockResolvedValueOnce({
      headers: { get: (name: string) => (name.toLowerCase() === 'content-type' ? 'text/plain' : null) },
      blob: async () => ({ type: 'text/plain', text: async () => 'cloud auto text' }),
    });
    window.history.replaceState(
      {},
      '',
      '/session/edge/docs?keep=1&__ceDocRef=cf_docopaque1&__ceDocStorage=cloudflare&__ceDocKind=file&__ceDocName=Cloud%20auto'
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
      />
    );

    await waitFor(() => {
      expect(mockReadSessionStorageBlob).toHaveBeenCalledWith(expect.objectContaining({
        storageRef: expect.objectContaining({ backend: 'cloudflare', id: 'cf_docopaque1' }),
      }));
    });
    expect(await screen.findByTestId(E2E_TESTIDS.DOC_VIEWER_TEXT)).toHaveTextContent('cloud auto text');
    expect(window.location.search).toBe('?keep=1');
  });

  it('waits for Lit hooks before auto-opening encrypted viewer links', async () => {
    const litStorage = require('../../utilities/crypto/litProtocol.js').litStorage;
    const txId = 'F'.repeat(43);
    const getKey = jest.fn(async () => ({ ciphertext: 'ciphertext', dataToEncryptHash: 'hash' }));
    litStorage.downloadEncryptedArweaveData.mockResolvedValueOnce({
      payload: { name: 'Encrypted auto', mime: 'text/plain', text: 'lit auto text' },
    });
    litStorage.decodeLitPayloadToText.mockReturnValueOnce('lit auto text');
    window.history.replaceState(
      {},
      '',
      `/session/edge/docs?__ceDocTx=${txId}&__ceDocStorage=lit-arweave&__ceDocKind=file&__ceDocName=Encrypted%20auto`
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

    const { rerender } = render(<DocumentLibraryPanel {...panelProps} />);

    await Promise.resolve();
    expect(litStorage.downloadEncryptedArweaveData).not.toHaveBeenCalled();
    expect(window.location.search).toContain('__ceDocTx=');

    rerender(<DocumentLibraryPanel {...panelProps} litHooks={{ getKey }} />);

    await waitFor(() => {
      expect(litStorage.downloadEncryptedArweaveData).toHaveBeenCalledWith(expect.objectContaining({
        url: `https://lit.example.test/${txId}`,
        providerLike: {},
        account: '0x123',
        lit: { getKey },
      }));
    });
    expect(await screen.findByTestId(E2E_TESTIDS.DOC_VIEWER_TEXT)).toHaveTextContent('lit auto text');
    expect(window.location.search).toBe('');
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
      />
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
    fireEvent.click(screen.getByTestId(E2E_TESTIDS.DOC_UPLOAD_FILE_BUTTON));

    await waitFor(() => {
      expect(mockUploadDocLibraryFile).toHaveBeenCalledWith(expect.objectContaining({
        file,
        encryption: expect.objectContaining({
          enabled: true,
          saveKey,
          accessControlConditions: [{ contractAddress: '0xgate' }],
        }),
        tags: expect.arrayContaining([
          expect.objectContaining({ name: 'CE-DocStorage', value: 'lit-arweave' }),
        ]),
      }));
    });
  });

  it('can render the browse list without upload controls', async () => {
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
      />
    );

    await waitFor(() => {
      expect(mockListArweaveTransactionsByTags).toHaveBeenCalled();
    });
    expect(screen.queryByTestId(E2E_TESTIDS.DOC_UPLOAD_FILE_INPUT)).not.toBeInTheDocument();
    expect(screen.queryByTestId(E2E_TESTIDS.DOC_URL_INPUT)).not.toBeInTheDocument();
  });
});
