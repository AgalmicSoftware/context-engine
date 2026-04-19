import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';

const mockListArweaveTransactionsByTags = jest.fn();
const mockResolveDocLibraryProvider = jest.fn();
const mockResolveArweaveGraphqlUrl = jest.fn();

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
  buildSbtAccessControlConditions: jest.fn(),
  getGlobalLitHooks: jest.fn(() => null),
  litStorage: {
    buildLitArweaveUrl: (txId) => `https://lit.example/${txId}`,
    downloadEncryptedArweaveData: jest.fn(),
    decodeLitPayloadToText: jest.fn(),
    decodeLitPayloadToBlob: jest.fn(),
  },
  resolveLitChain: jest.fn(() => 'ethereum'),
}));

jest.mock('../../utilities/arweave/arweaveScripts.js', () => ({
  arweaveScripts: {
    buildArweaveGatewayUrl: (txId, gateway = 'https://arweave.net') => `${gateway}/${txId}`,
    downloadDataFromArweave: jest.fn(),
  },
}));

const DocumentLibraryPanel = require('./DocumentLibraryPanel.jsx').default;
const TEST_SESSION_CONFIG = {
  docLibrary: {
    provider: 'arweave',
    arweave: {
      graphqlUrl: 'https://arweave.example/graphql',
    },
  },
};

describe('DocumentLibraryPanel photo docs', () => {
  let originalCreateObjectURL;
  let originalRevokeObjectURL;

  beforeEach(() => {
    jest.clearAllMocks();
    mockResolveDocLibraryProvider.mockReturnValue('arweave');
    mockResolveArweaveGraphqlUrl.mockReturnValue('https://arweave.example/graphql');
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
