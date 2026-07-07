import { ethers } from 'ethers';

import SBTPage from './SBTPage';
import contractScripts from '../../utilities/web3/contractScripts.js';
import * as cacheScripts from '../../utilities/cache/cacheScripts.js';
import { cryptoUtils } from 'utilities/crypto/cryptography.js';
import { litStorage } from 'utilities/crypto/litProtocol.js';

const mockIsCryptoMode = jest.fn(() => true);

jest.mock('../../utilities/ui/terminology.js', () => {
  const actual = jest.requireActual('../../utilities/ui/terminology.js');
  return {
    __esModule: true,
    ...actual,
    isCryptoMode: (...args) => mockIsCryptoMode(...args),
  };
});

jest.mock('utilities/ui/blockieAvatars.js', () => ({
  generateBlockieDataUrl: jest.fn(() => ''),
}));

const createSubject = (props = {}) => {
  const subject = new SBTPage({
    network: { id: 84532, name: 'Base Sepolia' },
    provider: 'mock',
    ...props,
  });
  subject._isMounted = true;
  subject.setState = jest.fn((next, cb) => {
    const patch = typeof next === 'function' ? next(subject.state, subject.props) : next;
    subject.state = { ...subject.state, ...(patch || {}) };
    if (typeof cb === 'function') cb();
    return patch;
  });
  return subject;
};

const mockObjectUrlApis = (blobUrl = 'blob:mock') => {
  const originalCreateObjectURL = URL.createObjectURL;
  const originalRevokeObjectURL = URL.revokeObjectURL;
  const createObjectURL = jest.fn(() => blobUrl);
  const revokeObjectURL = jest.fn();
  URL.createObjectURL = createObjectURL;
  URL.revokeObjectURL = revokeObjectURL;
  return {
    createObjectURL,
    revokeObjectURL,
    restore: () => {
      URL.createObjectURL = originalCreateObjectURL;
      URL.revokeObjectURL = originalRevokeObjectURL;
    },
  };
};

describe('SBTPage encrypted metadata retry behavior', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    window.sessionStorage.clear();
    jest.spyOn(contractScripts, 'getSbtHistorySummary').mockResolvedValue(null);
  });

  afterEach(() => {
    try {
      delete globalThis.CE_ARWEAVE_GATEWAY_URL;
    } catch (_) {}
    try {
      delete globalThis.CE_ARWEAVE_AR_IO_URL;
    } catch (_) {}
    try {
      delete globalThis.CE_ARWEAVE_DIRECT_TO_AR_IO;
    } catch (_) {}
    try {
      delete window.__litHooks;
    } catch (_) {}
    jest.restoreAllMocks();
  });

  it('retries encrypted name and image decrypt after the wallet connects', async () => {
    const sbtAddress = '0x00000000000000000000000000000000000000aa';
    const sbtLower = sbtAddress.toLowerCase();
    const account = '0x00000000000000000000000000000000000000ba';
    const cacheEntry = {
      84532: {
        sbtList: {
          [sbtLower]: {
            sbtAddress,
            sbtInfo: {
              name: '',
              image: '',
              encryptedFields: {
                name: 'name-envelope',
                image: {
                  storage: 'lit-arweave',
                  txId: 'img-tx',
                },
              },
              encryption: {
                enabled: true,
                status: 'lit-v1',
                targets: { name: true, image: true },
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
    const decryptSpy = jest.spyOn(cryptoUtils, 'decryptEnvelopeValue').mockResolvedValue('Private Badge');
    const downloadSpy = jest.spyOn(litStorage, 'downloadEncryptedArweaveData').mockResolvedValue({
      payload: { encoding: 'base64', data: 'aW1hZ2U=', mime: 'image/png', name: 'badge.png' },
      txId: 'img-tx',
      url: 'lit-ar://img-tx',
    });
    jest.spyOn(litStorage, 'decodeLitPayloadToBlob').mockReturnValue(new Blob(['image'], { type: 'image/png' }));
    const objectUrlMock = mockObjectUrlApis('blob:locked-image-after-connect');
    window.__litHooks = { getKey: jest.fn() };

    const subject = createSubject({
      SBTAddress: sbtAddress,
      sessionSlug: 'edge',
    });
    subject.state = {
      ...subject.state,
      network: { id: 84532, name: 'Base Sepolia' },
    };

    await subject.loadSBTInfo(true);

    expect(decryptSpy).not.toHaveBeenCalled();
    expect(downloadSpy).not.toHaveBeenCalled();

    subject.props = {
      ...subject.props,
      account,
    };

    await subject.loadSBTInfo(true);

    expect(decryptSpy).toHaveBeenCalledTimes(1);
    expect(downloadSpy).toHaveBeenCalledTimes(1);
    expect(objectUrlMock.createObjectURL).toHaveBeenCalledTimes(1);
    expect(subject.state.sbtInfo).toEqual(
      expect.objectContaining({
        name: 'Private Badge',
        nameDecrypted: true,
        image: 'blob:locked-image-after-connect',
        imageDecrypted: true,
      }),
    );
    objectUrlMock.restore();
  });

  it('retries encrypted metadata decrypt after the wallet connects', async () => {
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
    const decryptSpy = jest.spyOn(cryptoUtils, 'decryptEnvelopeValue').mockResolvedValue('Private description');
    window.__litHooks = { getKey: jest.fn() };

    const subject = createSubject({
      SBTAddress: sbtAddress,
      sessionSlug: 'edge',
    });
    subject.state = {
      ...subject.state,
      network: { id: 84532, name: 'Base Sepolia' },
    };

    await subject.loadSBTInfo(true);

    expect(decryptSpy).not.toHaveBeenCalled();

    subject.props = {
      ...subject.props,
      account,
    };

    await subject.loadSBTInfo(true);

    expect(decryptSpy).toHaveBeenCalledTimes(1);
    expect(subject.state.sbtInfo).toEqual(
      expect.objectContaining({
        description: 'Private description',
        descriptionDecrypted: true,
      }),
    );
  });

  it('retries encrypted metadata decrypt when the active account changes', async () => {
    const sbtAddress = '0x00000000000000000000000000000000000000a1';
    const sbtLower = sbtAddress.toLowerCase();
    const accountA = '0x00000000000000000000000000000000000000b1';
    const accountB = '0x00000000000000000000000000000000000000b2';
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
              mintingEndTime: 0,
              burnAuth: 0,
              hasPasswordMint: false,
              maxTokens: '0',
              admin: '0x00000000000000000000000000000000000000a2',
              chainID: 84532,
            },
            mintedAddresses: [accountA],
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
    const decryptSpy = jest
      .spyOn(cryptoUtils, 'decryptEnvelopeValue')
      .mockImplementation(async (_envelope, options = {}) =>
        options.account === accountB ? 'Private description' : null,
      );
    window.__litHooks = { getKey: jest.fn() };

    const subject = createSubject({
      SBTAddress: sbtAddress,
      sessionSlug: 'edge',
      account: accountA,
    });
    subject.state = {
      ...subject.state,
      network: { id: 84532, name: 'Base Sepolia' },
    };

    await subject.loadSBTInfo(true);

    expect(decryptSpy).toHaveBeenCalledTimes(1);
    expect(subject.state.sbtInfo.description || '').toBe('');
    expect(subject.state.sbtInfo.descriptionDecrypted).not.toBe(true);

    subject.props = {
      ...subject.props,
      account: accountB,
    };

    await subject.loadSBTInfo(true);

    expect(decryptSpy).toHaveBeenCalledTimes(2);
    expect(decryptSpy.mock.calls.map((call) => call[1]?.account)).toEqual([accountA, accountB]);
    expect(subject.state.sbtInfo).toEqual(
      expect.objectContaining({
        description: 'Private description',
        descriptionDecrypted: true,
      }),
    );
  });

  it('retries encrypted name and uploaded image decrypt when the active account changes', async () => {
    const sbtAddress = '0x00000000000000000000000000000000000000ab';
    const sbtLower = sbtAddress.toLowerCase();
    const accountA = '0x00000000000000000000000000000000000000bb';
    const accountB = '0x00000000000000000000000000000000000000bc';
    const cacheEntry = {
      84532: {
        sbtList: {
          [sbtLower]: {
            sbtAddress,
            sbtInfo: {
              name: '',
              image: '',
              encryptedFields: {
                name: 'name-envelope',
                image: {
                  storage: 'lit-arweave',
                  txId: 'img-tx',
                },
              },
              encryption: {
                enabled: true,
                status: 'lit-v1',
                targets: { name: true, image: true },
              },
              mintingEndTime: 0,
              burnAuth: 0,
              hasPasswordMint: false,
              maxTokens: '0',
              admin: '0x00000000000000000000000000000000000000a2',
              chainID: 84532,
            },
            mintedAddresses: [accountA],
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
    const decryptSpy = jest
      .spyOn(cryptoUtils, 'decryptEnvelopeValue')
      .mockImplementation(async (_envelope, options = {}) => (options.account === accountB ? 'Private Badge' : null));
    const downloadSpy = jest
      .spyOn(litStorage, 'downloadEncryptedArweaveData')
      .mockImplementation(async (_opts = {}) => {
        if (_opts.account !== accountB) throw new Error('not authorized');
        return {
          payload: { encoding: 'base64', data: 'aW1hZ2U=', mime: 'image/png', name: 'badge.png' },
          txId: 'img-tx',
          url: 'lit-ar://img-tx',
        };
      });
    jest.spyOn(litStorage, 'decodeLitPayloadToBlob').mockReturnValue(new Blob(['image'], { type: 'image/png' }));
    const objectUrlMock = mockObjectUrlApis('blob:locked-image-after-account-switch');
    window.__litHooks = { getKey: jest.fn() };

    const subject = createSubject({
      SBTAddress: sbtAddress,
      sessionSlug: 'edge',
      account: accountA,
    });
    subject.state = {
      ...subject.state,
      network: { id: 84532, name: 'Base Sepolia' },
    };

    await subject.loadSBTInfo(true);

    expect(decryptSpy).toHaveBeenCalledTimes(1);
    expect(subject.state.sbtInfo.name || '').toBe('');
    expect(subject.state.sbtInfo.nameDecrypted).not.toBe(true);

    subject.props = {
      ...subject.props,
      account: accountB,
    };

    await subject.loadSBTInfo(true);

    expect(decryptSpy).toHaveBeenCalledTimes(2);
    expect(downloadSpy).toHaveBeenCalledTimes(2);
    expect(objectUrlMock.createObjectURL).toHaveBeenCalledTimes(1);
    expect(subject.state.sbtInfo).toEqual(
      expect.objectContaining({
        name: 'Private Badge',
        nameDecrypted: true,
        image: 'blob:locked-image-after-account-switch',
        imageDecrypted: true,
      }),
    );
    objectUrlMock.restore();
  });
});
