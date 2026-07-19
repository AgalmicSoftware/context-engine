import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';

import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';

const mockBuildSbtAccessControlConditions = jest.fn();
const mockGetGlobalLitHooks = jest.fn();
const mockGetUnsupportedLitContractAccessControlError = jest.fn();
const mockListArweaveTransactionsByTags = jest.fn();
const mockResolveDocLibraryProvider = jest.fn();
const mockResolveArweaveGraphqlUrl = jest.fn();
const mockResolveArweaveGraphqlUrls = jest.fn();
const mockResolveDocUploadsGate = jest.fn();
const mockUploadDocLibraryFile = jest.fn();
const mockUploadDocLibraryUrlRecord = jest.fn();
const mockListSessionStorageRefs = jest.fn();
const mockReadSessionStorageBlob = jest.fn();
const mockSBTSelector = jest.fn();

export const createDeferred = <T,>() => {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: any) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

export const getDocumentLibraryStateUpdateWarnings = (spy: any) =>
  spy.mock.calls.filter(([message]: any[]) => {
    const text = String(message || '');
    return text.includes('Warning: An update to DocumentLibraryPanel') || text.includes('unmounted component');
  });

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
  resolveArweaveGraphqlUrls: (...args: any[]) => mockResolveArweaveGraphqlUrls(...args),
}));

jest.mock('../../utilities/crypto/litProtocol.js', () => ({
  buildSbtAccessControlConditions: (...args: any[]) => mockBuildSbtAccessControlConditions(...args),
  getUnsupportedLitContractAccessControlError: (...args: any[]) =>
    mockGetUnsupportedLitContractAccessControlError(...args),
  getGlobalLitHooks: (...args: any[]) => mockGetGlobalLitHooks(...args),
  litStorage: {
    buildLitArweaveUrl: (txId: string) => `https://lit.example.test/${txId}`,
    downloadEncryptedArweaveData: jest.fn(),
    decodeLitPayloadToText: jest.fn(),
    decodeLitPayloadToBlob: jest.fn(),
  },
  resolveLitChain: jest.fn(() => 'ethereum'),
}));

jest.mock('../../utilities/arweave/arweaveClient.js', () => {
  const arweaveClient = {
    buildArweaveGatewayUrl: (txId: string, gateway = 'https://arweave.example.test') => `${gateway}/${txId}`,
    downloadDataFromArweave: jest.fn(),
  };
  return { arweaveClient };
});

jest.mock('../../utilities/docLibrary/uploads.js', () => ({
  resolveDocUploadsGate: (...args: any[]) => mockResolveDocUploadsGate(...args),
  uploadDocLibraryFile: (...args: any[]) => mockUploadDocLibraryFile(...args),
  uploadDocLibraryUrlRecord: (...args: any[]) => mockUploadDocLibraryUrlRecord(...args),
}));

jest.mock('../../utilities/storage/storageClient.js', () => ({
  listSessionStorageRefsPage: async (...args: any[]) => {
    const result = await mockListSessionStorageRefs(...args);
    return Array.isArray(result) ? { items: result, cursor: null, listComplete: true } : result;
  },
  readSessionStorageBlob: (...args: any[]) => mockReadSessionStorageBlob(...args),
}));

jest.mock('../SBTs/SBTSelector', () => ({
  __esModule: true,
  default: (props: any) => {
    mockSBTSelector(props);
    return (
      <div data-testid="mock-sbt-selector">
        <button
          type="button"
          onClick={() =>
            props.onAddSBT?.({
              address: '0x00000000000000000000000000000000000000aa',
              name: 'Mock Selected SBT',
              chainId: 84532,
            })
          }
        >
          Add mock selected SBT
        </button>
        <button type="button" onClick={() => props.onRemoveSBT?.('0x00000000000000000000000000000000000000aa')}>
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

export const DocumentLibraryPanel = require('./DocumentLibraryPanel').default as React.ComponentType<any>;
export const TEST_SESSION_CONFIG = {
  docLibrary: {
    provider: 'arweave',
    arweave: {
      graphqlUrl: 'https://arweave.example.test/graphql',
    },
  },
};

export const setupDocumentLibraryPanelTestLifecycle = () => {
  let originalCreateObjectURL: typeof URL.createObjectURL;
  let originalRevokeObjectURL: typeof URL.revokeObjectURL;

  beforeEach(() => {
    jest.clearAllMocks();
    mockResolveDocLibraryProvider.mockReturnValue('arweave');
    mockResolveArweaveGraphqlUrl.mockReturnValue('https://arweave.example.test/graphql');
    mockResolveArweaveGraphqlUrls.mockReturnValue(['https://arweave.example.test/graphql']);
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
    mockGetUnsupportedLitContractAccessControlError.mockReturnValue('');
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
    mockListSessionStorageRefs.mockResolvedValue([]);
    mockReadSessionStorageBlob.mockResolvedValue({
      headers: { get: (name: string) => (name.toLowerCase() === 'content-type' ? 'text/plain' : null) },
      blob: async () => ({ type: 'text/plain', text: async () => 'mock document' }),
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
};

export {
  React,
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
  E2E_TESTIDS,
  mockBuildSbtAccessControlConditions,
  mockGetGlobalLitHooks,
  mockGetUnsupportedLitContractAccessControlError,
  mockListArweaveTransactionsByTags,
  mockResolveDocLibraryProvider,
  mockResolveArweaveGraphqlUrl,
  mockResolveArweaveGraphqlUrls,
  mockResolveDocUploadsGate,
  mockUploadDocLibraryFile,
  mockUploadDocLibraryUrlRecord,
  mockListSessionStorageRefs,
  mockReadSessionStorageBlob,
  mockSBTSelector,
};
