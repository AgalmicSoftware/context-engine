import {
  SBTPage,
  ethers,
  contractScripts,
  cacheScripts,
  render,
  createSubject,
  treeIncludesText,
  flushPromises,
  createDeferred,
  setupSBTPageTestLifecycle,
} from './SBTPage.testUtils';

describe('SBTPage metadata load hydration', () => {
  setupSBTPageTestLifecycle();

  it('coalesces overlapping loadSBTInfo calls and queues a single forced rerun', async () => {
    jest.useFakeTimers();
    try {
      const sbtAddress = '0x00000000000000000000000000000000000000a1';
      const sbtLower = sbtAddress.toLowerCase();
      const cacheEntry = {
        '84532': {
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
              mintedAddresses: ['0x00000000000000000000000000000000000000b1'],
              burnedAddresses: [],
              countsLoaded: true,
              blockNumber: 1234,
            },
          },
          lastBlock: 1234,
        },
      };

      let resolveFirstRead;
      const firstRead = new Promise((resolve) => { resolveFirstRead = resolve; });
      const readSpy = jest.spyOn(cacheScripts, 'readCache')
        .mockImplementationOnce(() => firstRead)
        .mockResolvedValue(cacheEntry);
      const groupPasswordSpy = jest.spyOn(contractScripts, 'getGroupPasswordHash')
        .mockResolvedValue(ethers.constants.HashZero);
      jest.spyOn(contractScripts, 'getMintedTokens').mockResolvedValue('1');

      const subject = createSubject({
        SBTAddress: sbtAddress,
        sessionSlug: 'edge',
        account: '0x00000000000000000000000000000000000000a2',
      });
      subject.state = {
        ...subject.state,
        network: { id: 84532, name: 'Base Sepolia' },
      };

      const firstRun = subject.loadSBTInfo(false);
      await Promise.resolve();
      await subject.loadSBTInfo(true);

      expect(subject._loadSbtInfoPendingForce).toBe(true);
      expect(readSpy).toHaveBeenCalledTimes(1);

      resolveFirstRead(cacheEntry);
      await firstRun;

      jest.runOnlyPendingTimers();
      await Promise.resolve();

      expect(readSpy.mock.calls.length).toBeGreaterThanOrEqual(2);
      expect(groupPasswordSpy).toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });

  it('hydrates direct SBT metadata during loadSBTInfo when central refresh is unavailable', async () => {
    const sbtAddress = '0x00000000000000000000000000000000000000a1';
    const sbtLower = sbtAddress.toLowerCase();
    const adminAddress = '0x00000000000000000000000000000000000000a2';

    jest.spyOn(cacheScripts, 'readCache').mockResolvedValue({
      '84532': {
        sbtList: {
          [sbtLower]: {
            sbtAddress,
            sbtInfo: null,
            mintedAddresses: [],
            burnedAddresses: [],
            countsLoaded: false,
          },
        },
      },
    });
    jest.spyOn(cacheScripts, 'listNamespaceEntriesSync').mockReturnValue([]);
    jest.spyOn(contractScripts, 'getSbtMetadata').mockResolvedValue({
      name: 'Name Only SBT',
      contractName: 'Name Only SBT',
      symbol: 'CE-SBT-38',
      tokenURI: 'ar://kcejtnnZ1GhyhjFfPAiLeX3Jaw0dXwhNnkCZ0zB1EuE',
      mintingEndTime: 0,
      burnAuth: 0,
      hasPasswordMint: false,
      maxTokens: '0',
      admin: adminAddress,
      chainID: 84532,
    });
    jest.spyOn(contractScripts, 'getGroupPasswordHash').mockResolvedValue(ethers.constants.HashZero);
    jest.spyOn(contractScripts, 'getMintedTokens').mockResolvedValue(null);
    jest.spyOn(contractScripts, 'getSbtHistorySummary').mockResolvedValue(null);
    const contractCtorSpy = jest.spyOn(ethers, 'Contract').mockImplementation(() => ({
      maxTokens: jest.fn().mockResolvedValue(ethers.BigNumber.from(0)),
      collectionBurnAuth: jest.fn().mockResolvedValue(0),
      mintingEndTime: jest.fn().mockResolvedValue(ethers.BigNumber.from(0)),
      hasPasswordMint: jest.fn().mockResolvedValue(false),
      admin: jest.fn().mockResolvedValue(adminAddress),
      owner: jest.fn().mockResolvedValue(adminAddress),
    }));

    const subject = createSubject({
      SBTAddress: sbtAddress,
      sessionSlug: 'edge',
      account: adminAddress,
    });
    subject.state = {
      ...subject.state,
      network: { id: 84532, name: 'Base Sepolia' },
    };

    await subject.loadSBTInfo(false);

    expect(contractScripts.getSbtMetadata).toHaveBeenCalledWith(
      'none',
      sbtAddress,
      expect.objectContaining({
        slug: 'edge',
        networkChainId: 84532,
      })
    );
    expect(subject.state.sbtInfo).toEqual(expect.objectContaining({
      name: 'Name Only SBT',
      symbol: 'CE-SBT-38',
      tokenURI: 'ar://kcejtnnZ1GhyhjFfPAiLeX3Jaw0dXwhNnkCZ0zB1EuE',
      admin: adminAddress,
      chainID: 84532,
    }));
    contractCtorSpy.mockRestore();
  });

  it('commits core SBT metadata before holder hydration finishes on cold loads', async () => {
    const sbtAddress = '0x00000000000000000000000000000000000000a1';
    const sbtLower = sbtAddress.toLowerCase();
    const cacheEntry = {
      '84532': {
        sbtList: {
          [sbtLower]: {
            sbtAddress,
            sbtInfo: {
              name: 'Cold Load Badge',
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
      },
    };
    const groupHashDeferred = createDeferred();

    jest.spyOn(cacheScripts, 'readCache').mockResolvedValue(cacheEntry);
    jest.spyOn(contractScripts, 'getGroupPasswordHash').mockImplementation(() => groupHashDeferred.promise);
    jest.spyOn(contractScripts, 'getMintedTokens').mockResolvedValue('0');

    const subject = createSubject({
      SBTAddress: sbtAddress,
      sessionSlug: 'edge',
    });
    subject.state = {
      ...subject.state,
      network: { id: 84532, name: 'Base Sepolia' },
    };

    const loadPromise = subject.loadSBTInfo(false);
    await flushPromises();
    await Promise.resolve();

    expect(subject.state.sbtInfo).toEqual(expect.objectContaining({
      name: 'Cold Load Badge',
      tokenURI: 'ar://HLDsCm3ALbbgjVTCPVLhU8aF9taAdKyD1DyB7A8zkaXM',
    }));
    expect(subject.state.loadingMintersBurners).toBe(true);
    expect(treeIncludesText(subject.render(), 'Loading SBT Details')).toBe(false);

    groupHashDeferred.resolve(ethers.constants.HashZero);
    await loadPromise;
  });

  it('uses direct metadata reads instead of a duplicate parent-owned refresh during cold hydration', async () => {
    const sbtAddress = '0x00000000000000000000000000000000000000a1';
    const sbtLower = sbtAddress.toLowerCase();
    const adminAddress = '0x00000000000000000000000000000000000000a2';
    const refreshSpy = jest.fn().mockResolvedValue(undefined);

    jest.spyOn(cacheScripts, 'readCache').mockResolvedValue({
      '84532': {
        sbtList: {
          [sbtLower]: {
            sbtAddress,
            sbtInfo: null,
            mintedAddresses: [],
            burnedAddresses: [],
            countsLoaded: false,
          },
        },
      },
    });
    jest.spyOn(cacheScripts, 'listNamespaceEntriesSync').mockReturnValue([]);
    jest.spyOn(contractScripts, 'getSbtMetadata').mockResolvedValue({
      name: 'Hydrated Without Duplicate Refresh',
      contractName: 'Hydrated Without Duplicate Refresh',
      symbol: 'CE-SBT-99',
      tokenURI: 'ar://kcejtnnZ1GhyhjFfPAiLeX3Jaw0dXwhNnkCZ0zB1EuE',
      mintingEndTime: 0,
      burnAuth: 0,
      hasPasswordMint: false,
      maxTokens: '0',
      admin: adminAddress,
      chainID: 84532,
    });
    jest.spyOn(contractScripts, 'getGroupPasswordHash').mockResolvedValue(ethers.constants.HashZero);
    jest.spyOn(contractScripts, 'getMintedTokens').mockResolvedValue(null);
    const contractCtorSpy = jest.spyOn(ethers, 'Contract').mockImplementation(() => ({
      maxTokens: jest.fn().mockResolvedValue(ethers.BigNumber.from(0)),
      collectionBurnAuth: jest.fn().mockResolvedValue(0),
      mintingEndTime: jest.fn().mockResolvedValue(ethers.BigNumber.from(0)),
      hasPasswordMint: jest.fn().mockResolvedValue(false),
      admin: jest.fn().mockResolvedValue(adminAddress),
      owner: jest.fn().mockResolvedValue(adminAddress),
    }));

    const subject = createSubject({
      SBTAddress: sbtAddress,
      sessionSlug: 'edge',
      account: adminAddress,
      refreshSbtData: refreshSpy,
      isSBTCacheReady: false,
    });
    subject.state = {
      ...subject.state,
      network: { id: 84532, name: 'Base Sepolia' },
    };

    await subject.loadSBTInfo(false);

    expect(refreshSpy).not.toHaveBeenCalled();
    expect(contractScripts.getSbtMetadata).toHaveBeenCalled();
    expect(subject.state.sbtInfo).toEqual(expect.objectContaining({
      name: 'Hydrated Without Duplicate Refresh',
      symbol: 'CE-SBT-99',
    }));
    contractCtorSpy.mockRestore();
  });

  it('coalesces overlapping non-forced loadSBTInfo calls and queues a rerun', async () => {
    jest.useFakeTimers();
    try {
      const sbtAddress = '0x00000000000000000000000000000000000000a1';
      const sbtLower = sbtAddress.toLowerCase();
      const cacheEntry = {
        '84532': {
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
              mintedAddresses: ['0x00000000000000000000000000000000000000b1'],
              burnedAddresses: [],
              countsLoaded: true,
              blockNumber: 1234,
            },
          },
          lastBlock: 1234,
        },
      };

      let resolveFirstRead;
      const firstRead = new Promise((resolve) => { resolveFirstRead = resolve; });
      const readSpy = jest.spyOn(cacheScripts, 'readCache')
        .mockImplementationOnce(() => firstRead)
        .mockResolvedValue(cacheEntry);
      const groupPasswordSpy = jest.spyOn(contractScripts, 'getGroupPasswordHash')
        .mockResolvedValue(ethers.constants.HashZero);
      jest.spyOn(contractScripts, 'getMintedTokens').mockResolvedValue('1');

      const subject = createSubject({
        SBTAddress: sbtAddress,
        sessionSlug: 'edge',
        account: '0x00000000000000000000000000000000000000a2',
      });
      subject.state = {
        ...subject.state,
        network: { id: 84532, name: 'Base Sepolia' },
      };

      const firstRun = subject.loadSBTInfo(false);
      await Promise.resolve();
      await subject.loadSBTInfo(false);

      expect(subject._loadSbtInfoPending).toBe(true);
      expect(subject._loadSbtInfoPendingForce).toBe(false);
      expect(readSpy).toHaveBeenCalledTimes(1);

      resolveFirstRead(cacheEntry);
      await firstRun;

      jest.runOnlyPendingTimers();
      await Promise.resolve();

      expect(readSpy.mock.calls.length).toBeGreaterThanOrEqual(2);
      expect(groupPasswordSpy).toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });

  it('keeps the explicit session slug pinned while using cached cross-group metadata as a display fallback', async () => {
    const sbtAddress = '0x00000000000000000000000000000000000000b1';
    const sbtLower = sbtAddress.toLowerCase();
    const ownerAddress = '0x00000000000000000000000000000000000000c1';
    const alphaCache = {
      '84532': {
        sbtList: {},
        lastBlock: 1200,
      },
    };
    const betaCache = {
      '84532': {
        sbtList: {
          [sbtLower]: {
            sbtAddress,
            slug: 'beta',
            sbtInfo: {
              tokenURI: 'ar://HLDsCm3ALbbgjVTCPVLhU8aF9taAdKyD1DyB7A8zkaXM',
              image: 'https://example.example.test/beta-badge.png',
              mintingEndTime: 0,
              burnAuth: 0,
              hasPasswordMint: false,
              maxTokens: '0',
              admin: '0x00000000000000000000000000000000000000a2',
              chainID: 84532,
            },
            mintedAddresses: [ownerAddress],
            burnedAddresses: [],
            countsLoaded: true,
            blockNumber: 1234,
          },
        },
        lastBlock: 1234,
      },
    };

    jest.spyOn(cacheScripts, 'readCache').mockImplementation(async (_namespace, slug) => {
      if (slug === 'alpha') return alphaCache;
      if (slug === 'beta') return betaCache;
      return {};
    });
    jest.spyOn(cacheScripts, 'listNamespaceEntriesSync').mockReturnValue([
      { slug: 'alpha', value: alphaCache },
      { slug: 'beta', value: betaCache },
    ]);
    jest.spyOn(contractScripts, 'getGroupPasswordHash').mockResolvedValue(ethers.constants.HashZero);
    jest.spyOn(contractScripts, 'getMintedTokens').mockResolvedValue(null);

    const subject = createSubject({
      SBTAddress: sbtAddress,
      sessionSlug: 'alpha',
      account: ownerAddress,
    });
    subject.state = {
      ...subject.state,
      network: { id: 84532, name: 'Base Sepolia' },
    };

    await subject.loadSBTInfo(false);

    expect(cacheScripts.readCache).toHaveBeenNthCalledWith(1, 'sbtCache', 'alpha');
    expect(cacheScripts.readCache).toHaveBeenCalledTimes(1);
    expect(subject.state.resolvedSessionSlug).toBe('alpha');
    expect(subject.state.sbtInfo).toEqual(expect.objectContaining({
      image: 'https://example.example.test/beta-badge.png',
      chainID: 84532,
    }));
    expect(subject.state.userHasSBT).toBe(false);
  });
});
