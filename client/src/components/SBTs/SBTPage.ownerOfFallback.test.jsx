import SBTPage from './SBTPage';
import { ethers } from 'ethers';
import contractScripts from '../../utilities/web3/contractScripts.js';
import * as cacheScripts from '../../utilities/cache/cacheScripts.js';

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

const createSparseCacheEntry = (sbtAddress) => {
  const sbtLower = sbtAddress.toLowerCase();
  return {
    84532: {
      sbtList: {
        [sbtLower]: {
          sbtAddress,
          sbtInfo: {
            tokenURI: 'ar://HLDsCm3ALbbgjVTCPVLhU8aF9taAdKyD1DyB7A8zkaXM',
            mintingEndTime: 0,
            burnAuth: 0,
            hasPasswordMint: false,
            maxTokens: '0',
            admin: '0x00000000000000000000000000000000000000a2',
            chainID: 84532,
          },
          mintedAddresses: [],
          burnedAddresses: [],
          countsLoaded: false,
          blockNumber: 1234,
        },
      },
      lastBlock: 1234,
    },
  };
};

describe('SBTPage ownerOf holder fallback', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    jest.spyOn(contractScripts, 'getSbtHistorySummary').mockResolvedValue(null);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns no holder lookups when minted count is zero', async () => {
    const ownerSpy = jest
      .spyOn(contractScripts, 'getOwnerByTokenId')
      .mockResolvedValue('0x00000000000000000000000000000000000000b1');
    const subject = createSubject();

    const holders = await subject.fetchHolderAddressesByTokenOwnership(
      '0x00000000000000000000000000000000000000a1',
      'edge',
      0,
    );

    expect(ownerSpy).not.toHaveBeenCalled();
    expect(holders).toEqual([]);
  });

  it('batches ownerOf fallback lookups instead of probing strictly one-by-one', async () => {
    const pending = new Map();
    const ownerAddress = '0x00000000000000000000000000000000000000b1';
    const ownerSpy = jest
      .spyOn(contractScripts, 'getOwnerByTokenId')
      .mockImplementation(async (_providerName, _sbtAddress, tokenId) => {
        const id = Number(tokenId);
        if (id >= 1 && id <= 10) {
          return new Promise((resolve) => {
            pending.set(id, resolve);
          });
        }
        return ownerAddress;
      });
    const subject = createSubject();

    const runPromise = subject.fetchHolderAddressesByTokenOwnership(
      '0x00000000000000000000000000000000000000a1',
      'edge',
      12,
    );
    await Promise.resolve();

    expect(ownerSpy).toHaveBeenCalledTimes(10);
    expect(ownerSpy.mock.calls.slice(0, 10).map((call) => Number(call[2]))).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);

    pending.forEach((resolve) => resolve(ownerAddress));
    const holders = await runPromise;

    expect(ownerSpy.mock.calls.map((call) => Number(call[2]))).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 0]);
    expect(holders).toEqual([ownerAddress.toLowerCase()]);
  });

  it('returns ownerOf fallback holders in deterministic sorted order', async () => {
    const pending = new Map();
    const ownerA = '0x00000000000000000000000000000000000000b1';
    const ownerB = '0x00000000000000000000000000000000000000b2';
    const ownerC = '0x00000000000000000000000000000000000000b3';
    const ownerSpy = jest
      .spyOn(contractScripts, 'getOwnerByTokenId')
      .mockImplementation(async (_providerName, _sbtAddress, tokenId) => {
        const id = Number(tokenId);
        if (id === 0) return null;
        return new Promise((resolve) => {
          pending.set(id, resolve);
        });
      });
    const subject = createSubject();

    const runPromise = subject.fetchHolderAddressesByTokenOwnership(
      '0x00000000000000000000000000000000000000a1',
      'edge',
      3,
    );
    await Promise.resolve();
    expect(ownerSpy).toHaveBeenCalledTimes(3);

    pending.get(3)(ownerC);
    pending.get(1)(ownerA);
    pending.get(2)(ownerB);
    const holders = await runPromise;

    expect(ownerSpy.mock.calls.map((call) => Number(call[2]))).toEqual([1, 2, 3, 0]);
    expect(holders).toEqual([ownerA.toLowerCase(), ownerB.toLowerCase(), ownerC.toLowerCase()]);
  });

  it('falls back to ownerOf holder discovery when minted count exists but event counts are empty', async () => {
    const sbtAddress = '0x00000000000000000000000000000000000000a1';
    const ownerA = '0x00000000000000000000000000000000000000b1';
    const ownerB = '0x00000000000000000000000000000000000000b2';

    jest.spyOn(cacheScripts, 'readCache').mockResolvedValue(createSparseCacheEntry(sbtAddress));
    jest.spyOn(contractScripts, 'getGroupPasswordHash').mockResolvedValue(ethers.constants.HashZero);
    jest.spyOn(contractScripts, 'getMintedTokens').mockResolvedValue('2');
    const ownerSpy = jest
      .spyOn(contractScripts, 'getOwnerByTokenId')
      .mockImplementation(async (_providerName, _sbtAddress, tokenId) => {
        if (Number(tokenId) === 0) return null;
        if (Number(tokenId) === 1) return ownerA;
        if (Number(tokenId) === 2) return ownerB;
        return null;
      });

    const subject = createSubject({
      SBTAddress: sbtAddress,
      sessionSlug: 'edge',
      account: ownerA,
    });
    subject.state = {
      ...subject.state,
      network: { id: 84532, name: 'Base Sepolia' },
    };

    await subject.loadSBTInfo(true);

    expect(ownerSpy).toHaveBeenCalledTimes(3);
    expect(ownerSpy.mock.calls.map((call) => Number(call[2]))).toEqual([1, 2, 0]);
    expect(subject.state.countsLoaded).toBe(true);
    expect(subject.state.mintedAddresses).toEqual([ownerA.toLowerCase(), ownerB.toLowerCase()]);
    expect(subject.state.burnedAddresses).toEqual([]);
    expect(subject.state.userHasSBT).toBe(true);
  });

  it('uses historySummary.totalMinted instead of currentHolderCount for sparse ownerOf fallback probes', async () => {
    const sbtAddress = '0x00000000000000000000000000000000000000a1';
    const ownerA = '0x00000000000000000000000000000000000000b1';

    jest.spyOn(cacheScripts, 'readCache').mockResolvedValue(createSparseCacheEntry(sbtAddress));
    const summarySpy = jest.spyOn(contractScripts, 'getSbtHistorySummary').mockResolvedValue({
      totalMinted: '5',
      totalBurned: '4',
      activeSupply: '1',
      currentHolderCount: '1',
      historicalHolderCount: '1',
    });
    const mintedSpy = jest.spyOn(contractScripts, 'getMintedTokens').mockResolvedValue('1');
    jest.spyOn(contractScripts, 'getGroupPasswordHash').mockResolvedValue(ethers.constants.HashZero);
    const ownerSpy = jest
      .spyOn(contractScripts, 'getOwnerByTokenId')
      .mockImplementation(async (_providerName, _sbtAddress, tokenId) => {
        if (Number(tokenId) === 5) return ownerA;
        return null;
      });

    const subject = createSubject({
      SBTAddress: sbtAddress,
      sessionSlug: 'edge',
      account: ownerA,
    });
    subject.state = {
      ...subject.state,
      network: { id: 84532, name: 'Base Sepolia' },
    };

    await subject.loadSBTInfo(true);

    expect(summarySpy).toHaveBeenCalledTimes(1);
    expect(mintedSpy).not.toHaveBeenCalled();
    expect(ownerSpy.mock.calls.map((call) => Number(call[2]))).toEqual([1, 2, 3, 4, 5, 0]);
    expect(subject.state.countsLoaded).toBe(true);
    expect(subject.state.mintedAddresses).toEqual([ownerA.toLowerCase()]);
    expect(subject.state.burnedAddresses).toEqual([]);
    expect(subject.state.userHasSBT).toBe(true);
  });

  it('probes tokenId 0 after one-based ids for zero-based multi-token contracts', async () => {
    const ownerA = '0x00000000000000000000000000000000000000b1';
    const ownerB = '0x00000000000000000000000000000000000000b2';
    const ownerSpy = jest
      .spyOn(contractScripts, 'getOwnerByTokenId')
      .mockImplementation(async (_providerName, _sbtAddress, tokenId) => {
        if (Number(tokenId) === 1) return ownerA;
        if (Number(tokenId) === 2) return ownerA;
        if (Number(tokenId) === 0) return ownerB;
        return null;
      });
    const subject = createSubject();

    const holders = await subject.fetchHolderAddressesByTokenOwnership(
      '0x00000000000000000000000000000000000000a1',
      'edge',
      2,
    );

    expect(ownerSpy.mock.calls.map((call) => Number(call[2]))).toEqual([1, 2, 0]);
    expect(holders).toEqual([ownerA.toLowerCase(), ownerB.toLowerCase()]);
  });

  it('falls back to ownerOf tokenId 0 when first mint uses zero-based ids', async () => {
    const sbtAddress = '0x00000000000000000000000000000000000000a1';
    const ownerA = '0x00000000000000000000000000000000000000b1';

    jest.spyOn(cacheScripts, 'readCache').mockResolvedValue(createSparseCacheEntry(sbtAddress));
    jest.spyOn(contractScripts, 'getGroupPasswordHash').mockResolvedValue(ethers.constants.HashZero);
    jest.spyOn(contractScripts, 'getMintedTokens').mockResolvedValue('1');
    const ownerSpy = jest
      .spyOn(contractScripts, 'getOwnerByTokenId')
      .mockImplementation(async (_providerName, _sbtAddress, tokenId) => {
        if (Number(tokenId) === 0) return ownerA;
        return null;
      });

    const subject = createSubject({
      SBTAddress: sbtAddress,
      sessionSlug: 'edge',
      account: ownerA,
    });
    subject.state = {
      ...subject.state,
      network: { id: 84532, name: 'Base Sepolia' },
    };

    await subject.loadSBTInfo(true);

    expect(ownerSpy).toHaveBeenCalledTimes(2);
    expect(ownerSpy.mock.calls.map((call) => Number(call[2]))).toEqual([1, 0]);
    expect(subject.state.countsLoaded).toBe(true);
    expect(subject.state.mintedAddresses).toEqual([ownerA.toLowerCase()]);
    expect(subject.state.burnedAddresses).toEqual([]);
    expect(subject.state.userHasSBT).toBe(true);
  });
});
