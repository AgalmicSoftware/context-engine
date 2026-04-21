import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

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
  listArweaveTransactionsByTags: (...args) => mockListArweaveTransactionsByTags(...args),
}));

jest.mock('../../utilities/docLibrary/config.js', () => ({
  resolveDocLibraryProvider: (...args) => mockResolveDocLibraryProvider(...args),
  resolveArweaveGraphqlUrl: (...args) => mockResolveArweaveGraphqlUrl(...args),
}));

jest.mock('../../utilities/crypto/litProtocol.js', () => ({
  buildSbtAccessControlConditions: (...args) => mockBuildSbtAccessControlConditions(...args),
  getGlobalLitHooks: (...args) => mockGetGlobalLitHooks(...args),
  litStorage: {
    buildLitArweaveUrl: (txId) => `https://lit.example.test/${txId}`,
    downloadEncryptedArweaveData: jest.fn(),
    decodeLitPayloadToText: jest.fn(),
    decodeLitPayloadToBlob: jest.fn(),
  },
  resolveLitChain: jest.fn(() => 'ethereum'),
}));

jest.mock('../../utilities/arweave/arweaveScripts.js', () => ({
  arweaveScripts: {
    buildArweaveGatewayUrl: (txId, gateway = 'https://arweave.example.test') => `${gateway}/${txId}`,
    downloadDataFromArweave: jest.fn(),
  },
}));

jest.mock('../../utilities/docLibrary/uploads.js', () => ({
  resolveDocUploadsGate: (...args) => mockResolveDocUploadsGate(...args),
  uploadDocLibraryFile: (...args) => mockUploadDocLibraryFile(...args),
  uploadDocLibraryUrlRecord: (...args) => mockUploadDocLibraryUrlRecord(...args),
}));

jest.mock('../SBTs/SBTSelector.jsx', () => ({
  __esModule: true,
  default: (props) => {
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
          {(props.selectedSBTs || []).map((sbt) => (
            <span key={sbt.address}>{sbt.name || sbt.address}</span>
          ))}
        </div>
      </div>
    );
  },
}));

const DocumentLibraryPanel = require('./DocumentLibraryPanel.jsx').default;
const TEST_SESSION_CONFIG = {
  docLibrary: {
    provider: 'arweave',
    arweave: {
      graphqlUrl: 'https://arweave.example.test/graphql',
    },
  },
};

describe('DocumentLibraryPanel photo docs', () => {
  let originalCreateObjectURL;
  let originalRevokeObjectURL;

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
    global.fetch = jest.fn();
    originalCreateObjectURL = URL.createObjectURL;
    originalRevokeObjectURL = URL.revokeObjectURL;
    URL.createObjectURL = jest.fn(() => 'blob:doc-library-image-preview');
    URL.revokeObjectURL = jest.fn();
  });

  afterEach(() => {
    delete global.fetch;
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
    fireEvent.click(screen.getByTestId(E2E_TESTIDS.DOC_UPLOAD_FILE_BUTTON));

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

  it('keeps image documents previewable and downloadable in the viewer', async () => {
    const imageBlob = new Blob([new Uint8Array([137, 80, 78, 71])], { type: 'image/png' });
    global.fetch.mockResolvedValue({
      ok: true,
      blob: async () => imageBlob,
      headers: {
        get: (name) => (name === 'content-type' ? 'image/png' : null),
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
      expect(global.fetch).toHaveBeenCalled();
      expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    });
    expect(await screen.findByTestId(E2E_TESTIDS.DOC_VIEWER_IMAGE)).toBeInTheDocument();
    expect(screen.getByTestId(E2E_TESTIDS.DOC_VIEWER_DOWNLOAD)).toBeInTheDocument();
  });
});
