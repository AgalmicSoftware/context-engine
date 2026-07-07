import {
  SBTPage,
  ethers,
  contractScripts,
  cacheScripts,
  cryptoUtils,
  litStorage,
  render,
  screen,
  createSubject,
  mockObjectUrlApis,
  setupSBTPageTestLifecycle,
} from './SBTPage.testUtils';

describe('SBTPage encrypted metadata rendering', () => {
  setupSBTPageTestLifecycle();

  it('decrypts encrypted description, tags, and document URLs from cached SBT metadata', async () => {
    const sbtAddress = '0x00000000000000000000000000000000000000a1';
    const sbtLower = sbtAddress.toLowerCase();
    const account = '0x00000000000000000000000000000000000000b1';
    const cacheEntry = {
      84532: {
        sbtList: {
          [sbtLower]: {
            sbtAddress,
            sbtInfo: {
              name: 'Badge',
              tokenURI: 'ar://HLDsCm3ALbbgjVTCPVLhU8aF9taAdKyD1DyB7A8zkaXM',
              image: 'https://example.example.test/badge.png',
              description: '',
              descriptionEncrypted: 'desc-envelope',
              descriptionAccess: { type: 'sbt', gateIds: ['gate-description'], chainId: 84532 },
              tags: [],
              tagsEncrypted: 'tags-envelope',
              tagsAccess: { type: 'sbt', gateIds: ['gate-tags'], chainId: 84532 },
              documentURLs: [],
              documentURLsEncrypted: 'docs-envelope',
              documentURLsAccess: { type: 'sbt', gateIds: ['gate-docs'], chainId: 84532 },
              mintingEndTime: 0,
              burnAuth: 0,
              hasPasswordMint: false,
              maxTokens: '0',
              admin: '0x00000000000000000000000000000000000000a2',
              chainID: 84532,
            },
            mintedAddresses: [account],
            burnedAddresses: [],
            countsLoaded: true,
            blockNumber: 1234,
          },
        },
        lastBlock: 1234,
      },
    };

    jest.spyOn(cacheScripts, 'readCache').mockResolvedValue(cacheEntry);
    jest.spyOn(contractScripts, 'getGroupPasswordHash').mockResolvedValue(ethers.constants.HashZero);
    const decryptSpy = jest.spyOn(cryptoUtils, 'decryptEnvelopeValue').mockImplementation(async (envelope) => {
      if (envelope === 'desc-envelope') return 'Private description';
      if (envelope === 'tags-envelope') return ['alpha', 'beta'];
      if (envelope === 'docs-envelope') return ['https://doc.example.test/private'];
      return null;
    });
    window.__litHooks = { getKey: jest.fn() };

    const subject = createSubject({
      SBTAddress: sbtAddress,
      sessionSlug: 'edge',
      account,
    });
    subject.state = {
      ...subject.state,
      network: { id: 84532, name: 'Base Sepolia' },
    };

    await subject.loadSBTInfo(false);

    expect(decryptSpy).toHaveBeenCalledTimes(3);
    expect(subject.state.sbtInfo).toEqual(
      expect.objectContaining({
        description: 'Private description',
        descriptionDecrypted: true,
        tags: ['alpha', 'beta'],
        tagsDecrypted: true,
        documentURLs: ['https://doc.example.test/private'],
        documentURLsDecrypted: true,
      }),
    );
  });

  it('renders legacy docURL aliases in the More section document list', () => {
    const subject = createSubject();
    subject.state = {
      ...subject.state,
      sbtInfo: {
        name: 'Doc Alias Badge',
        docURL: 'https://doc.example.test/alias',
      },
    };

    render(subject.renderRelevantInfo());

    expect(screen.getByText('Document URLs:')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'https://doc.example.test/alias' })).toHaveAttribute(
      'href',
      'https://doc.example.test/alias',
    );
  });

  it('decrypts locked name, description, tags, document URLs, and uploaded image from encryptedFields metadata', async () => {
    const sbtAddress = '0x00000000000000000000000000000000000000a9';
    const sbtLower = sbtAddress.toLowerCase();
    const account = '0x00000000000000000000000000000000000000b9';
    const cacheEntry = {
      84532: {
        sbtList: {
          [sbtLower]: {
            sbtAddress,
            sbtInfo: {
              name: '',
              image: '',
              description: '',
              tags: [],
              documentURLs: [],
              encryptedFields: {
                name: 'name-envelope',
                description: 'desc-envelope',
                tags: 'tags-envelope',
                documentURLs: 'docs-envelope',
                image: {
                  storage: 'lit-arweave',
                  txId: 'img-tx',
                },
              },
              encryption: {
                enabled: true,
                status: 'lit-v1',
                targets: {
                  name: true,
                  description: true,
                  tags: true,
                  documentURLs: true,
                  image: true,
                },
              },
              mintingEndTime: 0,
              burnAuth: 0,
              hasPasswordMint: false,
              maxTokens: '0',
              admin: '0x00000000000000000000000000000000000000a2',
              chainID: 84532,
            },
            mintedAddresses: [account],
            burnedAddresses: [],
            countsLoaded: true,
            blockNumber: 1234,
          },
        },
        lastBlock: 1234,
      },
    };

    jest.spyOn(cacheScripts, 'readCache').mockResolvedValue(cacheEntry);
    jest.spyOn(contractScripts, 'getGroupPasswordHash').mockResolvedValue(ethers.constants.HashZero);
    const decryptSpy = jest.spyOn(cryptoUtils, 'decryptEnvelopeValue').mockImplementation(async (envelope) => {
      if (envelope === 'name-envelope') return 'Private Badge';
      if (envelope === 'desc-envelope') return 'Private description';
      if (envelope === 'tags-envelope') return ['alpha', 'beta'];
      if (envelope === 'docs-envelope') return ['https://doc.example.test/private'];
      return null;
    });
    const downloadSpy = jest.spyOn(litStorage, 'downloadEncryptedArweaveData').mockResolvedValue({
      payload: { encoding: 'base64', data: 'aW1hZ2U=', mime: 'image/png', name: 'badge.png' },
      txId: 'img-tx',
      url: 'lit-ar://img-tx',
    });
    const decodeBlobSpy = jest
      .spyOn(litStorage, 'decodeLitPayloadToBlob')
      .mockReturnValue(new Blob(['image'], { type: 'image/png' }));
    const objectUrlMock = mockObjectUrlApis('blob:locked-image');
    window.__litHooks = { getKey: jest.fn() };

    const subject = createSubject({
      SBTAddress: sbtAddress,
      sessionSlug: 'edge',
      account,
    });
    subject.state = {
      ...subject.state,
      network: { id: 84532, name: 'Base Sepolia' },
    };

    await subject.loadSBTInfo(false);

    expect(decryptSpy).toHaveBeenCalledTimes(4);
    expect(downloadSpy).toHaveBeenCalledTimes(1);
    expect(decodeBlobSpy).toHaveBeenCalledTimes(1);
    expect(objectUrlMock.createObjectURL).toHaveBeenCalledTimes(1);
    expect(subject.state.sbtInfo).toEqual(
      expect.objectContaining({
        name: 'Private Badge',
        nameDecrypted: true,
        description: 'Private description',
        descriptionDecrypted: true,
        tags: ['alpha', 'beta'],
        tagsDecrypted: true,
        documentURLs: ['https://doc.example.test/private'],
        documentURLsDecrypted: true,
        image: 'blob:locked-image',
        imageDecrypted: true,
      }),
    );
    objectUrlMock.restore();
  });

  it('does not rehydrate metadata when a locked image is intentionally blank', async () => {
    const sbtAddress = '0x00000000000000000000000000000000000000ac';
    const sbtLower = sbtAddress.toLowerCase();
    const refreshSpy = jest.fn();
    const cacheEntry = {
      84532: {
        sbtList: {
          [sbtLower]: {
            sbtAddress,
            sbtInfo: {
              name: '',
              contractName: 'CE-SBT-12',
              nameLocked: true,
              tokenURI: 'ar://HLDsCm3ALbbgjVTCPVLhU8aF9taAdKyD1DyB7A8zkaXM',
              image: '',
              imageLocked: true,
              encryptedFields: {
                image: {
                  storage: 'lit-arweave',
                  txId: 'img-tx',
                },
              },
              mintingEndTime: 0,
              burnAuth: 0,
              hasPasswordMint: false,
              maxTokens: '0',
              admin: '0x00000000000000000000000000000000000000a2',
              chainID: 84532,
            },
            mintedAddresses: ['0x00000000000000000000000000000000000000b1'],
            burnedAddresses: [],
            countsLoaded: true,
            blockNumber: 1234,
          },
        },
        lastBlock: 1234,
      },
    };

    jest.spyOn(cacheScripts, 'readCache').mockResolvedValue(cacheEntry);
    jest.spyOn(contractScripts, 'getGroupPasswordHash').mockResolvedValue(ethers.constants.HashZero);

    const subject = createSubject({
      SBTAddress: sbtAddress,
      sessionSlug: 'edge',
      refreshSbtData: refreshSpy,
    });
    subject.state = {
      ...subject.state,
      network: { id: 84532, name: 'Base Sepolia' },
    };

    await subject.loadSBTInfo(false);

    expect(refreshSpy).not.toHaveBeenCalled();
    expect(subject.state.sbtInfo).toEqual(
      expect.objectContaining({
        image: '',
        imageLocked: true,
      }),
    );
  });
});
