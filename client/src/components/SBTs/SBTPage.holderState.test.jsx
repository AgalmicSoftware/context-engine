import {
  SBTPage,
  ethers,
  contractScripts,
  cacheScripts,
  createSubject,
  createReadCachePayload,
  setupSBTPageTestLifecycle,
} from './SBTPage.testUtils';

describe('SBTPage holder state preservation', () => {
  setupSBTPageTestLifecycle();

  it('ignores stale holder state from an in-flight load after account changes', async () => {
    jest.useFakeTimers();
    try {
      const sbtAddress = '0x00000000000000000000000000000000000000a1';
      const sbtLower = sbtAddress.toLowerCase();
      const ownerA = '0x00000000000000000000000000000000000000b1';
      const ownerB = '0x00000000000000000000000000000000000000b2';
      const cacheEntry = {
        84532: {
          sbtList: {
            [sbtLower]: {
              sbtAddress,
              sbtInfo: {
                tokenURI: 'ar://HLDsCm3ALbbgjVTCPVLhU8aF9taAdKyD1DyB7A8zkaXM',
                image: 'https://example.example.test/badge.png',
                mintingEndTime: 0,
                burnAuth: 0,
                hasPasswordMint: false,
                maxTokens: '0',
                admin: '0x00000000000000000000000000000000000000a2',
                chainID: 84532,
              },
              mintedAddresses: [ownerA],
              burnedAddresses: [],
              countsLoaded: true,
              blockNumber: 1234,
            },
          },
          lastBlock: 1234,
        },
      };

      let resolveFirstRead;
      const firstRead = new Promise((resolve) => {
        resolveFirstRead = resolve;
      });
      const readSpy = jest
        .spyOn(cacheScripts, 'readCache')
        .mockImplementationOnce(() => firstRead)
        .mockResolvedValue(cacheEntry);
      jest.spyOn(contractScripts, 'getGroupPasswordHash').mockResolvedValue(ethers.constants.HashZero);

      const subject = createSubject({
        SBTAddress: sbtAddress,
        sessionSlug: 'edge',
        account: ownerA,
        sbtCacheRevision: 0,
      });
      subject.state = {
        ...subject.state,
        network: { id: 84532, name: 'Base Sepolia' },
        userHasSBT: false,
      };

      const firstRun = subject.loadSBTInfo(false);
      await Promise.resolve();

      subject.props = {
        ...subject.props,
        account: ownerB,
        sbtCacheRevision: 1,
      };
      await subject.loadSBTInfo(false);

      resolveFirstRead(cacheEntry);
      await firstRun;

      expect(subject.state.userHasSBT).toBe(false);

      jest.runOnlyPendingTimers();
      await Promise.resolve();

      expect(readSpy.mock.calls.length).toBeGreaterThanOrEqual(2);
      expect(subject.state.userHasSBT).toBe(false);
    } finally {
      jest.useRealTimers();
    }
  });

  it('overrides stale cached burnAuth metadata with collectionBurnAuth from chain', async () => {
    const sbtAddress = '0x00000000000000000000000000000000000000a1';
    const sbtLower = sbtAddress.toLowerCase();
    const holder = '0x00000000000000000000000000000000000000b1';
    const cacheEntry = {
      84532: {
        sbtList: {
          [sbtLower]: {
            sbtAddress,
            sbtInfo: {
              tokenURI: 'ar://HLDsCm3ALbbgjVTCPVLhU8aF9taAdKyD1DyB7A8zkaXM',
              image: 'https://example.example.test/badge.png',
              mintingEndTime: 0,
              burnAuth: 0,
              burnAuthNeedsOnChainRefresh: true,
              hasPasswordMint: false,
              maxTokens: '0',
              admin: '0x00000000000000000000000000000000000000a2',
              chainID: 84532,
            },
            mintedAddresses: [holder.toLowerCase()],
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
    jest.spyOn(contractScripts, 'getMintedTokens').mockResolvedValue('0');
    jest.spyOn(contractScripts, 'getReadProviderForGroup').mockReturnValue({});
    const contractSpy = jest.spyOn(ethers, 'Contract').mockImplementation(() => ({
      collectionBurnAuth: jest.fn().mockResolvedValue(2),
    }));

    const subject = createSubject({
      SBTAddress: sbtAddress,
      sessionSlug: 'edge',
    });
    subject.state = {
      ...subject.state,
      network: { id: 84532, name: 'Base Sepolia' },
    };

    await subject.loadSBTInfo(false);

    expect(contractSpy).toHaveBeenCalled();
    expect(subject.state.sbtInfo.burnAuth).toBe(2);
    expect(subject.state.sbtInfo.burnAuthVerifiedOnChain).toBe(true);
    expect(subject.state.sbtInfo.burnAuthNeedsOnChainRefresh).toBeUndefined();
  });

  it('keeps fully hydrated cached burnAuth values on the fast path unless refresh is explicitly requested', async () => {
    const sbtAddress = '0x00000000000000000000000000000000000000a3';
    const sbtLower = sbtAddress.toLowerCase();
    const holder = '0x00000000000000000000000000000000000000b3';
    const cacheEntry = {
      84532: {
        sbtList: {
          [sbtLower]: {
            sbtAddress,
            sbtInfo: {
              tokenURI: 'ar://HLDsCm3ALbbgjVTCPVLhU8aF9taAdKyD1DyB7A8zkaXM',
              image: 'https://example.example.test/badge.png',
              mintingEndTime: 0,
              burnAuth: 0,
              hasPasswordMint: false,
              maxTokens: '0',
              admin: '0x00000000000000000000000000000000000000a2',
              chainID: 84532,
            },
            mintedAddresses: [holder.toLowerCase()],
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
    const contractSpy = jest.spyOn(ethers, 'Contract');

    const subject = createSubject({
      SBTAddress: sbtAddress,
      sessionSlug: 'edge',
    });
    subject.state = {
      ...subject.state,
      network: { id: 84532, name: 'Base Sepolia' },
    };

    await subject.loadSBTInfo(false);

    expect(contractSpy).not.toHaveBeenCalled();
    expect(subject.state.sbtInfo.burnAuth).toBe(0);
    expect(subject.state.sbtInfo.burnAuthVerifiedOnChain).toBeUndefined();
  });

  it('reconstructs current holder state from cached count maps for reburn/remint cases', async () => {
    const sbtAddress = '0x00000000000000000000000000000000000000a1';
    const sbtLower = sbtAddress.toLowerCase();
    const holder = '0x00000000000000000000000000000000000000b1';
    const holderLower = holder.toLowerCase();
    const cacheEntry = {
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
            mintedAddresses: [holderLower],
            burnedAddresses: [holderLower],
            mintedCountByAddress: { [holderLower]: 2 },
            burnedCountByAddress: { [holderLower]: 1 },
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
      account: holder,
    });
    subject.state = {
      ...subject.state,
      network: { id: 84532, name: 'Base Sepolia' },
    };

    await subject.loadSBTInfo(true);

    expect(subject.state.countsLoaded).toBe(true);
    expect(subject.state.mintedAddresses).toEqual([holderLower, holderLower]);
    expect(subject.state.burnedAddresses).toEqual([holderLower]);
    expect(subject.state.userHasSBT).toBe(true);
    expect(subject.getMemoizedNetHoldersList(subject.state.mintedAddresses, subject.state.burnedAddresses)).toEqual([
      holderLower,
    ]);
  });

  it('preserves mintedTokensOverride after refresh when refreshed holder lists are incomplete', async () => {
    const sbtAddress = '0x00000000000000000000000000000000000000a1';
    const sbtLower = sbtAddress.toLowerCase();
    const ownerA = '0x00000000000000000000000000000000000000b1';
    const initialEntry = {
      84532: {
        sbtList: {
          [sbtLower]: {
            sbtAddress,
            sbtInfo: {
              tokenURI: 'ar://HLDsCm3ALbbgjVTCPVLhU8aF9taAdKyD1DyB7A8zkaXM',
              image: 'https://example.example.test/badge.png',
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
    const refreshedEntry = {
      84532: {
        sbtList: {
          [sbtLower]: {
            sbtAddress,
            sbtInfo: {
              tokenURI: 'ar://HLDsCm3ALbbgjVTCPVLhU8aF9taAdKyD1DyB7A8zkaXM',
              image: 'https://example.example.test/badge.png',
              mintingEndTime: 0,
              burnAuth: 0,
              hasPasswordMint: false,
              maxTokens: '0',
              admin: '0x00000000000000000000000000000000000000a2',
              chainID: 84532,
            },
            mintedAddresses: [ownerA],
            burnedAddresses: [],
            countsLoaded: true,
            blockNumber: 1250,
          },
        },
        lastBlock: 1250,
      },
    };

    const readSpy = jest
      .spyOn(cacheScripts, 'readCache')
      .mockResolvedValueOnce(initialEntry)
      .mockResolvedValueOnce(refreshedEntry);
    const refreshSpy = jest.fn().mockResolvedValue(undefined);
    jest.spyOn(contractScripts, 'getGroupPasswordHash').mockResolvedValue(ethers.constants.HashZero);
    jest.spyOn(contractScripts, 'getMintedTokens').mockResolvedValue('7');

    const subject = createSubject({
      SBTAddress: sbtAddress,
      sessionSlug: 'edge',
      account: ownerA,
      refreshSbtData: refreshSpy,
    });
    subject.state = {
      ...subject.state,
      network: { id: 84532, name: 'Base Sepolia' },
    };

    await subject.loadSBTInfo(true);

    expect(readSpy).toHaveBeenCalledTimes(2);
    expect(refreshSpy).toHaveBeenCalledTimes(1);
    expect(subject.state.countsLoaded).toBe(true);
    expect(subject.state.mintedAddresses).toEqual([ownerA.toLowerCase()]);
    expect(subject.state.mintedTokensOverride).toBe('7');
  });

  it('does not preserve stale holders when holders meta key changes', async () => {
    const sbtAddress = '0x00000000000000000000000000000000000000a1';
    const sbtLower = sbtAddress.toLowerCase();
    const ownerA = '0x00000000000000000000000000000000000000b1';
    const emptyCountsLoadedEntry = {
      84532: {
        sbtList: {
          [sbtLower]: {
            sbtAddress,
            sbtInfo: {
              tokenURI: 'ar://HLDsCm3ALbbgjVTCPVLhU8aF9taAdKyD1DyB7A8zkaXM',
              image: 'https://example.example.test/badge.png',
              mintingEndTime: 0,
              burnAuth: 0,
              hasPasswordMint: false,
              maxTokens: '0',
              admin: '0x00000000000000000000000000000000000000a2',
              chainID: 84532,
            },
            mintedAddresses: [],
            burnedAddresses: [],
            countsLoaded: true,
            blockNumber: 1234,
          },
        },
        lastBlock: 1234,
      },
    };

    jest.spyOn(cacheScripts, 'readCache').mockResolvedValue(emptyCountsLoadedEntry);
    jest.spyOn(contractScripts, 'getGroupPasswordHash').mockResolvedValue(ethers.constants.HashZero);
    jest.spyOn(contractScripts, 'getMintedTokens').mockResolvedValue('0');

    const subject = createSubject({
      SBTAddress: sbtAddress,
      sessionSlug: 'edge',
      account: ownerA,
    });
    subject.state = {
      ...subject.state,
      network: { id: 84532, name: 'Base Sepolia' },
      mintedAddresses: [ownerA.toLowerCase()],
      burnedAddresses: [],
      countsLoaded: true,
      holdersMetaKey: '84532:previous',
      userHasSBT: true,
    };

    await subject.loadSBTInfo(true);

    expect(subject.state.mintedAddresses).toEqual([]);
    expect(subject.state.burnedAddresses).toEqual([]);
    expect(subject.state.countsLoaded).toBe(true);
    expect(subject.state.userHasSBT).toBe(false);
  });

  it('preserves previously visible holders after same-key empty refresh snapshot without new burns', async () => {
    const sbtAddress = '0x00000000000000000000000000000000000000a1';
    const sbtLower = sbtAddress.toLowerCase();
    const ownerA = '0x00000000000000000000000000000000000000b1';
    const initialEntry = createReadCachePayload({
      sbtAddress,
      mintedAddresses: [],
      burnedAddresses: [],
      countsLoaded: false,
      blockNumber: 1234,
    });
    const refreshedEntry = createReadCachePayload({
      sbtAddress,
      mintedAddresses: [],
      burnedAddresses: [],
      countsLoaded: true,
      blockNumber: 1250,
      lastBlock: 1250,
    });

    const readSpy = jest
      .spyOn(cacheScripts, 'readCache')
      .mockResolvedValueOnce(initialEntry)
      .mockResolvedValueOnce(refreshedEntry);
    const refreshSpy = jest.fn().mockResolvedValue(undefined);
    jest.spyOn(contractScripts, 'getGroupPasswordHash').mockResolvedValue(ethers.constants.HashZero);
    jest.spyOn(contractScripts, 'getMintedTokens').mockResolvedValue('2');
    const ownerSpy = jest.spyOn(contractScripts, 'getOwnerByTokenId').mockResolvedValue(null);

    const subject = createSubject({
      SBTAddress: sbtAddress,
      sessionSlug: 'edge',
      account: ownerA,
      refreshSbtData: refreshSpy,
    });
    subject.state = {
      ...subject.state,
      network: { id: 84532, name: 'Base Sepolia' },
      mintedAddresses: [ownerA.toLowerCase()],
      burnedAddresses: [],
      countsLoaded: true,
      filteredMintedUsers: [ownerA.toLowerCase()],
      filteredMintedUsersSignature: subject.buildAddressListSignature([ownerA.toLowerCase()]),
      showModal: true,
      mintingAddressesFilterInitialized: true,
      holdersMetaKey: `edge:84532:${sbtLower}`,
      userHasSBT: true,
    };

    await subject.loadSBTInfo(true);

    expect(readSpy).toHaveBeenCalledTimes(2);
    expect(refreshSpy).toHaveBeenCalledTimes(1);
    expect(ownerSpy.mock.calls.map((call) => Number(call[2]))).toEqual([1, 2, 0]);
    expect(subject.state.mintedAddresses).toEqual([ownerA.toLowerCase()]);
    expect(subject.state.burnedAddresses).toEqual([]);
    expect(subject.state.countsLoaded).toBe(true);
    expect(subject.state.userHasSBT).toBe(true);
    expect(subject.state.filteredMintedUsers).toEqual([ownerA.toLowerCase()]);
  });

  it('does not repeat the central event refresh when the holder meta key was already scanned', async () => {
    const sbtAddress = '0x00000000000000000000000000000000000000a1';
    const sbtLower = sbtAddress.toLowerCase();
    const cacheEntry = createReadCachePayload({
      sbtAddress,
      mintedAddresses: [],
      burnedAddresses: [],
      countsLoaded: false,
      blockNumber: 1234,
    });

    const readSpy = jest.spyOn(cacheScripts, 'readCache').mockResolvedValue(cacheEntry);
    const refreshSpy = jest.fn().mockResolvedValue(undefined);
    jest.spyOn(contractScripts, 'getGroupPasswordHash').mockResolvedValue(ethers.constants.HashZero);
    jest.spyOn(contractScripts, 'getMintedTokens').mockResolvedValue(null);

    const subject = createSubject({
      SBTAddress: sbtAddress,
      sessionSlug: 'edge',
      refreshSbtData: refreshSpy,
    });
    subject.state = {
      ...subject.state,
      network: { id: 84532, name: 'Base Sepolia' },
    };
    subject._eventScanTried = {
      [`edge:84532:${sbtLower}`]: true,
    };

    await subject.loadSBTInfo(false);

    expect(readSpy).toHaveBeenCalledTimes(1);
    expect(refreshSpy).not.toHaveBeenCalled();
    expect(subject._eventScanTried[`edge:84532:${sbtLower}`]).toBe(true);
    expect(subject.state.countsLoaded).toBe(false);
  });

  it('clears only the holder whose burn count increases during a same-key empty refresh', async () => {
    const sbtAddress = '0x00000000000000000000000000000000000000a1';
    const ownerA = '0x00000000000000000000000000000000000000b1';
    const ownerB = '0x00000000000000000000000000000000000000b2';
    const initialEntry = createReadCachePayload({
      sbtAddress,
      mintedAddresses: [],
      burnedAddresses: [],
      countsLoaded: false,
      blockNumber: 1234,
    });
    const refreshedEntry = createReadCachePayload({
      sbtAddress,
      mintedAddresses: [],
      burnedAddresses: [ownerA],
      countsLoaded: true,
      blockNumber: 1250,
      lastBlock: 1250,
    });

    jest.spyOn(cacheScripts, 'readCache').mockResolvedValueOnce(initialEntry).mockResolvedValueOnce(refreshedEntry);
    const refreshSpy = jest.fn().mockResolvedValue(undefined);
    jest.spyOn(contractScripts, 'getGroupPasswordHash').mockResolvedValue(ethers.constants.HashZero);
    jest.spyOn(contractScripts, 'getMintedTokens').mockResolvedValue('2');

    const subject = createSubject({
      SBTAddress: sbtAddress,
      sessionSlug: 'edge',
      account: ownerA,
      refreshSbtData: refreshSpy,
    });
    subject.state = {
      ...subject.state,
      network: { id: 84532, name: 'Base Sepolia' },
      mintedAddresses: [ownerA.toLowerCase(), ownerB.toLowerCase()],
      burnedAddresses: [],
      countsLoaded: true,
      filteredMintedUsers: [ownerA.toLowerCase(), ownerB.toLowerCase()],
      filteredMintedUsersSignature: subject.buildAddressListSignature([ownerA.toLowerCase(), ownerB.toLowerCase()]),
      showModal: true,
      mintingAddressesFilterInitialized: true,
      holdersMetaKey: `edge:84532:${sbtAddress.toLowerCase()}`,
      userHasSBT: true,
    };

    await subject.loadSBTInfo(true);

    expect(refreshSpy).toHaveBeenCalledTimes(1);
    expect(subject.state.mintedAddresses).toEqual([ownerA.toLowerCase(), ownerB.toLowerCase()]);
    expect(subject.state.burnedAddresses).toEqual([ownerA.toLowerCase()]);
    expect(subject.getMemoizedNetHoldersList(subject.state.mintedAddresses, subject.state.burnedAddresses)).toEqual([
      ownerB.toLowerCase(),
    ]);
    expect(subject.state.filteredMintedUsers).toEqual([ownerB.toLowerCase()]);
    expect(subject.state.userHasSBT).toBe(false);
  });

  it('clears visible holder rows immediately on local burn success', () => {
    const ownerA = '0x00000000000000000000000000000000000000b1';
    const ownerB = '0x00000000000000000000000000000000000000b2';
    const subject = createSubject({
      account: ownerA,
    });
    subject.state = {
      ...subject.state,
      mintedAddresses: [ownerA.toLowerCase(), ownerB.toLowerCase()],
      burnedAddresses: [],
      filteredMintedUsers: [ownerA.toLowerCase(), ownerB.toLowerCase()],
      filteredMintedUsersSignature: subject.buildAddressListSignature([ownerA.toLowerCase(), ownerB.toLowerCase()]),
      showModal: true,
      mintingAddressesFilterInitialized: true,
      userHasSBT: true,
    };

    subject.applyLocalBurnSuccess(ownerA.toLowerCase());

    expect(subject.state.burnedAddresses).toEqual([ownerA.toLowerCase()]);
    expect(subject.state.filteredMintedUsers).toEqual([ownerB.toLowerCase()]);
    expect(subject.state.userHasSBT).toBe(false);
  });

  it('replaces preserved holder rows when a resolved non-empty refresh snapshot arrives', async () => {
    const sbtAddress = '0x00000000000000000000000000000000000000a1';
    const ownerA = '0x00000000000000000000000000000000000000b1';
    const ownerB = '0x00000000000000000000000000000000000000b2';
    const initialEntry = createReadCachePayload({
      sbtAddress,
      mintedAddresses: [],
      burnedAddresses: [],
      countsLoaded: false,
      blockNumber: 1234,
    });
    const refreshedEntry = createReadCachePayload({
      sbtAddress,
      mintedAddresses: [ownerB],
      burnedAddresses: [],
      countsLoaded: true,
      blockNumber: 1250,
      lastBlock: 1250,
    });

    jest.spyOn(cacheScripts, 'readCache').mockResolvedValueOnce(initialEntry).mockResolvedValueOnce(refreshedEntry);
    const refreshSpy = jest.fn().mockResolvedValue(undefined);
    jest.spyOn(contractScripts, 'getGroupPasswordHash').mockResolvedValue(ethers.constants.HashZero);
    jest.spyOn(contractScripts, 'getMintedTokens').mockResolvedValue('1');

    const subject = createSubject({
      SBTAddress: sbtAddress,
      sessionSlug: 'edge',
      account: ownerA,
      refreshSbtData: refreshSpy,
    });
    subject.state = {
      ...subject.state,
      network: { id: 84532, name: 'Base Sepolia' },
      mintedAddresses: [ownerA.toLowerCase()],
      burnedAddresses: [],
      countsLoaded: true,
      filteredMintedUsers: [ownerA.toLowerCase()],
      filteredMintedUsersSignature: subject.buildAddressListSignature([ownerA.toLowerCase()]),
      showModal: true,
      mintingAddressesFilterInitialized: true,
      holdersMetaKey: `edge:84532:${sbtAddress.toLowerCase()}`,
      userHasSBT: true,
    };

    await subject.loadSBTInfo(true);

    expect(refreshSpy).toHaveBeenCalledTimes(1);
    expect(subject.state.mintedAddresses).toEqual([ownerB.toLowerCase()]);
    expect(subject.state.burnedAddresses).toEqual([]);
    expect(subject.state.filteredMintedUsers).toEqual([ownerB.toLowerCase()]);
    expect(subject.state.userHasSBT).toBe(false);
  });
});
