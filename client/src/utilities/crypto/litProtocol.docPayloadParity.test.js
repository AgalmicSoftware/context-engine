import { uploadSelfRecipientEncryptedDocData } from '../docLibrary/uploads.js';
import { uploadEncryptedArweaveData } from './litProtocol.js';

var mockEncryptEnvelopeValue = jest.fn();
var mockUploadDataToArweave = jest.fn();

jest.mock('./cryptography.js', () => ({
  cryptoUtils: {
    encryptEnvelopeValue: (...args) => mockEncryptEnvelopeValue(...args),
  },
}));

jest.mock('../arweave/arweaveClient.js', () => ({
  arweaveClient: {
    uploadDataToArweave: (...args) => mockUploadDataToArweave(...args),
    buildArweaveGatewayUrl: (txId) => `https://arweave.example.test/${txId}`,
  },
}));

jest.mock('../storage/storageClient.js', () => ({
  uploadDataToSessionStorage: jest.fn(),
}));

jest.mock('../worker/workerAuth.js', () => ({
  fetchWorkerWithAuth: jest.fn(),
  normalizeWorkerUrl: (value) => String(value || '').replace(/\/+$/, ''),
}));

const account = '0x1111111111111111111111111111111111111111';
const chainId = 84532;
const providerLike = { request: jest.fn() };
const lit = {
  saveKey: jest.fn(),
  accessControlConditions: [],
};

const captureBothPayloads = async ({ data, format, name, mime }) => {
  mockEncryptEnvelopeValue.mockResolvedValue('{}');
  mockUploadDataToArweave.mockResolvedValueOnce('doc-library-tx').mockResolvedValueOnce('lit-upload-tx');

  await uploadSelfRecipientEncryptedDocData({
    data,
    format,
    name,
    mime,
    account,
    chainId,
    providerLike,
  });
  await uploadEncryptedArweaveData({
    data,
    format,
    name,
    mime,
    account,
    chainId,
    providerLike,
    lit,
  });

  expect(mockEncryptEnvelopeValue).toHaveBeenCalledTimes(2);
  return mockEncryptEnvelopeValue.mock.calls.map(([payload]) => payload);
};

describe('encrypted document pre-encryption payload parity', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('keeps representative text payloads byte-for-byte equivalent', async () => {
    const [docLibraryPayload, litPayload] = await captureBothPayloads({
      data: 'Line one\nLine two',
      format: 'txt',
      name: 'notes.txt',
      mime: 'text/plain',
    });

    expect(docLibraryPayload).toEqual({
      v: 1,
      kind: 'text',
      name: 'notes.txt',
      format: 'txt',
      mime: 'text/plain',
      encoding: 'utf-8',
      data: 'Line one\nLine two',
    });
    expect(JSON.stringify(docLibraryPayload)).toBe(JSON.stringify(litPayload));
  });

  it('keeps browser File payloads byte-for-byte equivalent', async () => {
    const file = new File([new Uint8Array([0, 1, 2, 127, 128, 255])], 'evidence.md', {
      type: 'application/octet-stream',
    });
    const [docLibraryPayload, litPayload] = await captureBothPayloads({ data: file });

    expect(docLibraryPayload).toEqual({
      v: 1,
      kind: 'file',
      name: 'evidence.md',
      format: 'md',
      mime: 'text/markdown',
      encoding: 'base64',
      data: 'AAECf4D/',
    });
    expect(JSON.stringify(docLibraryPayload)).toBe(JSON.stringify(litPayload));
  });
});
