import {
  React,
  act,
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
      />,
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
      />,
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
      />,
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
      expect(mockBuildSbtAccessControlConditions).toHaveBeenCalledWith(
        expect.objectContaining({
          sbtAddresses: ['0x00000000000000000000000000000000000000aa'],
          chainId: 84532,
          mode: 'all',
        }),
      );
      expect(mockUploadDocLibraryFile).toHaveBeenCalledWith(
        expect.objectContaining({
          file,
          encryption: expect.objectContaining({
            enabled: true,
            accessControlConditions: [{ contractAddress: '0xgate' }],
            chainId: 84532,
          }),
        }),
      );
    });
  });

  it('resets custom gate mode after the document context changes', async () => {
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

    const baseProps = {
      provider: {},
      network: { id: 84532 },
      account: '0x123',
      loginComplete: true,
      toggleLoginModal: jest.fn(),
      sessionConfig: TEST_SESSION_CONFIG,
      mode: 'session',
    };
    const { rerender } = render(
      <DocumentLibraryPanel {...baseProps} sessionSlug="edge-a" sessionIdHex={`0x${'5'.repeat(32)}`} />,
    );

    fireEvent.click(screen.getByTestId(E2E_TESTIDS.DOC_AUDIENCE_CUSTOM));
    fireEvent.click(screen.getByRole('button', { name: 'Add mock selected SBT' }));
    fireEvent.click(screen.getByTestId(E2E_TESTIDS.DOC_CUSTOM_MODE_ALL));

    rerender(<DocumentLibraryPanel {...baseProps} sessionSlug="edge-b" sessionIdHex={`0x${'6'.repeat(32)}`} />);

    fireEvent.click(screen.getByTestId(E2E_TESTIDS.DOC_AUDIENCE_CUSTOM));
    fireEvent.click(screen.getByRole('button', { name: 'Add mock selected SBT' }));
    mockBuildSbtAccessControlConditions.mockClear();

    const file = new File(['secret'], 'reset-secret.txt', { type: 'text/plain' });
    fireEvent.change(screen.getByTestId(E2E_TESTIDS.DOC_UPLOAD_FILE_INPUT), {
      target: { files: [file] },
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId(E2E_TESTIDS.DOC_UPLOAD_FILE_BUTTON));
      await Promise.resolve();
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(mockBuildSbtAccessControlConditions).toHaveBeenCalledWith(
        expect.objectContaining({
          sbtAddresses: ['0x00000000000000000000000000000000000000aa'],
          chainId: 84532,
          mode: 'any',
        }),
      );
      expect(mockUploadDocLibraryFile).toHaveBeenCalledWith(expect.objectContaining({ file }));
    });
  });

  it('blocks encrypted custom-audience uploads when access conditions cannot be built', async () => {
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
    mockBuildSbtAccessControlConditions.mockReturnValue(null);

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
        sessionIdHex={`0x${'7'.repeat(32)}`}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId(E2E_TESTIDS.DOC_LOCK_TOGGLE)).toHaveAttribute('data-ce-locked', 'true');
    });
    fireEvent.click(screen.getByTestId(E2E_TESTIDS.DOC_AUDIENCE_CUSTOM));

    const file = new File(['secret'], 'secret.txt', { type: 'text/plain' });
    fireEvent.change(screen.getByTestId(E2E_TESTIDS.DOC_UPLOAD_FILE_INPUT), {
      target: { files: [file] },
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId(E2E_TESTIDS.DOC_UPLOAD_FILE_BUTTON));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(await screen.findByText('Add at least one SBT address to encrypt.')).toBeInTheDocument();
    expect(mockUploadDocLibraryFile).not.toHaveBeenCalled();
  });

  it('omits plaintext file metadata tags from encrypted uploads', async () => {
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
        sessionIdHex={`0x${'8'.repeat(32)}`}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId(E2E_TESTIDS.DOC_LOCK_TOGGLE)).toHaveAttribute('data-ce-locked', 'true');
    });

    const file = new File(['confidential contents'], 'secret-plan.txt', { type: 'text/plain' });
    fireEvent.change(screen.getByTestId(E2E_TESTIDS.DOC_UPLOAD_FILE_INPUT), {
      target: { files: [file] },
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId(E2E_TESTIDS.DOC_UPLOAD_FILE_BUTTON));
      await Promise.resolve();
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(mockUploadDocLibraryFile).toHaveBeenCalledTimes(1);
    });
    const uploadArgs = mockUploadDocLibraryFile.mock.calls[0][0];
    const tags = uploadArgs.tags || [];
    expect(tags).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'CE-DocStorage', value: 'lit-arweave' }),
        expect.objectContaining({ name: 'CE-DocKind', value: 'file' }),
      ]),
    );
    expect(tags.map((tag: { name: string }) => tag.name)).not.toEqual(
      expect.arrayContaining(['CE-DocName', 'CE-DocMime', 'CE-DocSize']),
    );
    expect(JSON.stringify(tags)).not.toContain('secret-plan');
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
    mockGetUnsupportedLitContractAccessControlError.mockImplementation(() => {
      throw new Error('OP Sepolia session-gate uploads should stay on the scoped Lit path.');
    });
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
      />,
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
      expect(mockUploadDocLibraryFile).toHaveBeenCalledWith(
        expect.objectContaining({
          file,
          encryption: expect.objectContaining({
            enabled: true,
            chainId: 11155420,
            saveKey: scopedSaveKey,
          }),
        }),
      );
    });
  });
});
