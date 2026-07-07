import {
  buildDocUploadTagMap,
  buildSessionDocLibraryViewerUrl,
  createDocLibraryLinkRecord,
  isSelfRecipientDocEncryption,
  normalizeDocUploadTagsForTagMap,
  resolveDocUploadResultId,
  resolveDocUploadResultStorage,
  resolveDocUploadsGate,
} from './docUploadContracts.js';

describe('docUploadContracts', () => {
  it('builds doc viewer URLs with legacy query keys and encoded metadata', () => {
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
        sessionToken: 'edge',
        txId: 'tx-1',
      }),
    ).toBe('/session/edge/docs?__ceDocTx=tx-1&__ceDocStorage=lit-arweave&__ceDocKind=file');
    expect(buildSessionDocLibraryViewerUrl({ sessionToken: '', txId: 'tx-1' })).toBe('');
    expect(buildSessionDocLibraryViewerUrl({ sessionToken: 'edge', txId: '' })).toBe('');
  });

  it('normalizes link records without mutating caller input', () => {
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

  it('resolves doc upload gates from registry-like records', () => {
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
    expect(resolveDocUploadsGate(null)).toEqual({
      gate: null,
      lookupStatus: '',
      sbtAddresses: [],
      chainId: null,
      mode: 'any',
      hasRecipients: false,
    });
  });

  it('normalizes doc upload tag records without mutating inputs', () => {
    const tags = [
      { name: ' CE-DocLibrary ', value: ' 1 ' },
      { name: 'EmptyValue', value: '' },
      { name: '', value: 'ignored' },
      null,
      'ignored',
      { name: 'Kind', value: 'file' },
    ];
    const before = JSON.stringify(tags);

    expect(normalizeDocUploadTagsForTagMap(tags)).toEqual([
      { name: 'CE-DocLibrary', value: '1' },
      { name: 'Kind', value: 'file' },
    ]);
    expect(buildDocUploadTagMap(tags)).toEqual({
      'CE-DocLibrary': '1',
      Kind: 'file',
    });
    expect(JSON.stringify(tags)).toBe(before);
  });

  it('resolves upload result IDs and storage backend fallbacks without mutating records', () => {
    const result = {
      arweaveTxId: '',
      txId: ' tx-1 ',
      id: 'fallback-id',
      storageRef: {
        backend: ' cloudflare ',
        uri: 'https://docs.example.test/doc-1',
      },
      storage: 'arweave',
    };
    const before = JSON.stringify(result);

    expect(resolveDocUploadResultId(result)).toBe('tx-1');
    expect(resolveDocUploadResultStorage(result)).toBe('cloudflare');
    expect(resolveDocUploadResultId({ arweaveTxId: ' ar-1 ', txId: 'tx-1' })).toBe('ar-1');
    expect(resolveDocUploadResultId({ id: ' fallback ' })).toBe('fallback');
    expect(resolveDocUploadResultStorage({ storageRef: { backend: '' }, storage: 'lit-arweave' })).toBe('lit-arweave');
    expect(resolveDocUploadResultStorage({ storageRef: { backend: '' }, storage: '' })).toBe('arweave');
    expect(resolveDocUploadResultStorage(null)).toBe('arweave');
    expect(JSON.stringify(result)).toBe(before);
  });

  it('detects self-recipient encryption modes from legacy aliases', () => {
    expect(isSelfRecipientDocEncryption({ selfRecipient: true })).toBe(true);
    expect(isSelfRecipientDocEncryption({ recipientType: 'Only Me' })).toBe(true);
    expect(isSelfRecipientDocEncryption({ mode: 'only_me' })).toBe(true);
    expect(isSelfRecipientDocEncryption({ audience: 'self-eip712-v1' })).toBe(true);
    expect(isSelfRecipientDocEncryption({ audience: 'session' })).toBe(false);
    expect(isSelfRecipientDocEncryption(null)).toBe(false);
  });
});
