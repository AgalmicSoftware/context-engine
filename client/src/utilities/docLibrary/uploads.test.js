import { webcrypto } from 'crypto';

import { litStorage } from '../crypto/litProtocol.js';
import {
  buildSessionDocLibraryViewerUrl,
  createDocLibraryLinkRecord,
  isSelfRecipientDocEncryption,
  resolveDocUploadsGate,
  uploadDocLibraryFile,
} from './uploads.js';

const mockUploadDataToArweave = jest.fn();
const mockDownloadDataFromArweave = jest.fn();

jest.mock('../arweave/arweaveClient.js', () => {
  const arweaveClient = {
    uploadDataToArweave: (...args) => mockUploadDataToArweave(...args),
    downloadDataFromArweave: (...args) => mockDownloadDataFromArweave(...args),
    buildArweaveGatewayUrl: (txId, gateway = 'https://arweave.example.test') => `${gateway}/${txId}`,
  };
  return { arweaveClient };
});

const ACCOUNT = '0x00000000000000000000000000000000000000aa';
const CHAIN_ID = 84532;
const SIGNATURE = `0x${'11'.repeat(65)}`;

const makeProvider = () => ({
  request: jest.fn(async ({ method }) => {
    if (method === 'eth_accounts' || method === 'eth_requestAccounts') return [ACCOUNT];
    if (method === 'eth_chainId') return '0x14a34';
    if (method === 'eth_signTypedData_v4') return SIGNATURE;
    throw new Error(`Unexpected wallet method: ${method}`);
  }),
});

describe('docLibrary uploads self-recipient encryption', () => {
  beforeAll(() => {
    if (typeof window !== 'undefined' && (!window.crypto || !window.crypto.subtle)) {
      Object.defineProperty(window, 'crypto', {
        value: webcrypto,
        configurable: true,
      });
    }
  });

  it('builds doc viewer URLs with legacy tx query compatibility and encoded metadata', () => {
    expect(
      buildSessionDocLibraryViewerUrl({
        sessionToken: 'Edge Session',
        storageRef: 'indexeddb://doc 1',
        storage: 'indexeddb',
        kind: 'note',
        name: 'Private note.md',
      }),
    ).toBe(
      '/session/Edge%20Session/docs?__ceDocTx=indexeddb%3A%2F%2Fdoc+1&__ceDocStorage=indexeddb&__ceDocKind=note&__ceDocName=Private+note.md',
    );
    expect(
      buildSessionDocLibraryViewerUrl({
        sessionToken: '',
        txId: 'tx-1',
      }),
    ).toBe('');
    expect(
      buildSessionDocLibraryViewerUrl({
        sessionToken: 'edge',
        txId: '',
      }),
    ).toBe('');
  });

  it('normalizes public link records without mutating caller input', () => {
    const input = {
      url: ' https://example.test/path?q=1 ',
      title: '  Reference  ',
    };
    const before = JSON.stringify(input);
    const record = createDocLibraryLinkRecord(input);

    expect(record).toEqual(
      expect.objectContaining({
        v: 1,
        kind: 'link',
        url: 'https://example.test/path?q=1',
        title: 'Reference',
      }),
    );
    expect(typeof record.createdAt).toBe('string');
    expect(JSON.stringify(input)).toBe(before);
    expect(() => createDocLibraryLinkRecord({ url: 'ftp://example.test/file' })).toThrow('URL must be http(s).');
    expect(() => createDocLibraryLinkRecord({ url: 'not a url' })).toThrow('Invalid URL.');
  });

  it('resolves doc upload gates and self-recipient modes from legacy aliases', () => {
    const sessionConfig = {
      __registry: {
        gatesByResource: {
          docUploads: {
            lookupStatus: ' OK ',
            mode: 'and',
            chainId: '84532',
            sbtAddresses: ['0xabc', '', null, '0xdef'],
          },
        },
      },
    };

    expect(resolveDocUploadsGate(sessionConfig)).toEqual({
      gate: sessionConfig.__registry.gatesByResource.docUploads,
      lookupStatus: 'ok',
      sbtAddresses: ['0xabc', '0xdef'],
      chainId: 84532,
      mode: 'all',
      hasRecipients: true,
    });
    expect(
      resolveDocUploadsGate({
        __registry: {
          gatesByResource: {
            docUploads: {
              lookupStatus: 'missing',
              mode: 'any',
              chainId: 0,
              sbtAddresses: ['0xabc'],
            },
          },
        },
      }),
    ).toEqual(
      expect.objectContaining({
        chainId: null,
        mode: 'any',
        hasRecipients: false,
      }),
    );
    expect(isSelfRecipientDocEncryption({ recipientType: 'Only Me' })).toBe(true);
    expect(isSelfRecipientDocEncryption({ mode: 'only_me' })).toBe(true);
    expect(isSelfRecipientDocEncryption({ audience: 'session' })).toBe(false);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('uploads and reopens a private only-me document without Lit hooks', async () => {
    const provider = makeProvider();
    let storedEnvelope = '';
    mockUploadDataToArweave.mockImplementation(async (data) => {
      storedEnvelope = data;
      return 'A'.repeat(43);
    });
    mockDownloadDataFromArweave.mockImplementation(async () => storedEnvelope);

    const file = new File(['private note'], 'private-note.txt', { type: 'text/plain' });
    const result = await uploadDocLibraryFile({
      file,
      sessionSlug: 'edge',
      sessionConfig: {},
      account: ACCOUNT,
      providerLike: provider,
      chainId: CHAIN_ID,
      tags: [{ name: 'CE-DocLibrary', value: '1' }],
      encryption: {
        enabled: true,
        recipientType: 'self-eip712-v1',
        selfRecipient: true,
        contextLabel: 'doc-self:edge',
      },
    });

    const envelope = JSON.parse(storedEnvelope);
    expect(result).toEqual(
      expect.objectContaining({
        txId: 'A'.repeat(43),
        storage: 'lit-arweave',
        kind: 'file',
        data: { size: null, type: 'application/json' },
      }),
    );
    expect(mockUploadDataToArweave).toHaveBeenCalledWith(
      expect.any(String),
      'json',
      expect.objectContaining({
        tags: [{ name: 'CE-DocLibrary', value: '1' }],
      }),
    );
    expect(envelope.recipients.map((recipient) => recipient.type)).toEqual(['self-eip712-v1']);
    expect(JSON.stringify(envelope)).not.toContain('lit-sbt-v1');

    const { payload, txId } = await litStorage.downloadEncryptedArweaveData({
      txId: result.txId,
      providerLike: provider,
      account: ACCOUNT,
      chainId: CHAIN_ID,
    });

    expect(txId).toBe('A'.repeat(43));
    expect(litStorage.decodeLitPayloadToText(payload)).toBe('private note');
    expect(mockDownloadDataFromArweave).toHaveBeenCalledTimes(1);
  });

  it('keeps session-gated encrypted documents on the Lit recipient path', async () => {
    const provider = makeProvider();
    let storedEnvelope = '';
    const saveKey = jest.fn(async () => ({
      ciphertext: 'chipotle-ciphertext',
      dataToEncryptHash: 'chipotle-hash',
      chipotle: {
        version: 1,
        sbtAddresses: ['0x00000000000000000000000000000000000000bb'],
        gateMode: 'any',
        chainId: CHAIN_ID,
      },
    }));
    const accessControlConditions = [
      {
        contractAddress: '0x00000000000000000000000000000000000000bb',
        standardContractType: 'ERC721',
        chain: 'ethereum',
        method: 'balanceOf',
        parameters: [':userAddress'],
        returnValueTest: { comparator: '>', value: '0' },
      },
    ];
    mockUploadDataToArweave.mockImplementation(async (data) => {
      storedEnvelope = data;
      return 'B'.repeat(43);
    });

    await uploadDocLibraryFile({
      file: new File(['session note'], 'session-note.txt', { type: 'text/plain' }),
      sessionSlug: 'edge',
      sessionConfig: {},
      account: ACCOUNT,
      providerLike: provider,
      chainId: CHAIN_ID,
      tags: [{ name: 'CE-DocStorage', value: 'lit-arweave' }],
      encryption: {
        enabled: true,
        saveKey,
        accessControlConditions,
        litChain: 'ethereum',
        chainId: CHAIN_ID,
        contextLabel: 'doc:edge',
      },
    });

    const envelope = JSON.parse(storedEnvelope);
    expect(saveKey).toHaveBeenCalledWith(
      expect.any(Uint8Array),
      expect.objectContaining({
        accessControlConditions,
        chain: 'ethereum',
      }),
    );
    expect(envelope.recipients.map((recipient) => recipient.type)).toEqual(['self-eip712-v1', 'lit-sbt-v1']);
    expect(envelope.recipients[1].lit).toEqual(
      expect.objectContaining({
        accessControlConditions,
        ciphertext: 'chipotle-ciphertext',
        dataToEncryptHash: 'chipotle-hash',
        chipotle: expect.objectContaining({ gateMode: 'any' }),
      }),
    );
  });
});
