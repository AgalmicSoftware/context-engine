import {
  CreateSBTGroup,
  contractScripts,
  cacheScripts,
  getScopedCreateSbtFormCacheKey,
  SBT_PASSWORD_RECOVERY_STORAGE_KEY,
  makeFactoryReceiptLog,
  makeInstance,
  setupCreateSBTGroupTestLifecycle,
} from './CreateSBTGroup.testUtils';

describe('CreateSBTGroup deploy and persistence flows', () => {
  setupCreateSBTGroupTestLifecycle();

  it('uses a placeholder on-chain contract name when the SBT name is locked', async () => {
    const instance = makeInstance({
      provider: 'mock-provider',
      account: '0xCreator',
      loginComplete: true,
      network: { id: 84532, name: 'Base Sepolia' },
    });
    instance.state = {
      ...instance.state,
      sbtName: 'Private Name',
      tokenURI: 'ar://metadata',
      metadataLockGateIds: {
        ...instance.state.metadataLockGateIds,
        name: ['test-sbt'],
      },
      sbtDistribution: {
        ...instance.state.sbtDistribution,
        burnAuth: 'AdminOnly',
      },
    };

    instance.getSessionConfigForNetwork = jest.fn(() => ({ slug: 'test', networkChainId: 84532 }));
    const countCreatedSpy = jest.spyOn(contractScripts, 'countSBTCreated').mockResolvedValue(11);
    const createSpy = jest.spyOn(contractScripts, 'createSBT').mockResolvedValue({
      logs: [makeFactoryReceiptLog('SBTCreated', ['0x00000000000000000000000000000000000000a1'])],
    });

    await instance.mintSBT();

    expect(createSpy).toHaveBeenCalledWith(
      'mock-provider',
      'CE-SBT-12',
      'CE-SBT-12',
      expect.anything(),
      expect.anything(),
      expect.anything(),
      expect.anything(),
      expect.anything(),
      expect.anything(),
      'ar://metadata',
      expect.anything(),
      expect.anything(),
      expect.anything(),
      {},
    );
    countCreatedSpy.mockRestore();
    createSpy.mockRestore();
  });

  it('stores a public auto-mint session URL for anyone-can-mint SBTs', async () => {
    const sbtAddress = '0x00000000000000000000000000000000000000b1';
    const instance = makeInstance({
      provider: 'mock-provider',
      account: '0xCreator',
      loginComplete: true,
      network: { id: 84532, name: 'Base Sepolia' },
      sessionSlug: 'edge',
    });
    instance.state = {
      ...instance.state,
      sbtName: 'Open Group',
      tokenURI: 'ar://metadata',
      sbtDistribution: {
        ...instance.state.sbtDistribution,
        burnAuth: 'AdminOnly',
        distributionOption: 'anyoneCanMint',
      },
    };

    instance.getSessionConfigForNetwork = jest.fn(() => ({ slug: 'edge', networkChainId: 84532 }));
    jest.spyOn(contractScripts, 'countSBTCreated').mockResolvedValue(2);
    jest.spyOn(contractScripts, 'createSBT').mockResolvedValue({
      events: [{ event: 'SBTCreated', args: { sbtAddress } }],
    });

    await instance.mintSBT();

    expect(instance.state.autoJoinUrl).toBe(
      `http://localhost/session/edge?sbt=${encodeURIComponent(sbtAddress)}&auto=1`,
    );
    expect(instance.state.shareableUrl).toBe(instance.state.autoJoinUrl);
  });

  it('clears and suppresses draft cache persistence after a successful mint', async () => {
    const sbtAddress = '0x00000000000000000000000000000000000000b2';
    const instance = makeInstance({
      provider: 'mock-provider',
      account: '0xCreator',
      loginComplete: true,
      network: { id: 84532, name: 'Base Sepolia' },
      sessionSlug: 'edge',
    });
    instance.state = {
      ...instance.state,
      sbtName: 'Open Group',
      sbtDescription: 'Cached before mint',
      tokenURI: 'ar://metadata',
      sbtDistribution: {
        ...instance.state.sbtDistribution,
        burnAuth: 'AdminOnly',
        distributionOption: 'anyoneCanMint',
      },
    };
    instance.getSessionConfigForNetwork = jest.fn(() => ({ slug: 'edge', networkChainId: 84532 }));
    instance.schedulePredictedAddressRefresh = jest.fn();

    const scopedKey = getScopedCreateSbtFormCacheKey('edge');
    instance.persistFormCache();
    expect(sessionStorage.getItem(scopedKey)).toContain('"Open Group"');

    const prevProps = instance.props;
    const prevState = { ...instance.state };
    jest.spyOn(contractScripts, 'countSBTCreated').mockResolvedValue(2);
    jest.spyOn(contractScripts, 'createSBT').mockResolvedValue({
      events: [{ event: 'SBTCreated', args: { sbtAddress } }],
    });

    await instance.mintSBT();

    expect(sessionStorage.getItem(scopedKey)).toBeNull();
    expect(instance._suppressFormCachePersistence).toBe(true);

    instance.componentDidUpdate(prevProps, prevState);

    expect(sessionStorage.getItem(scopedKey)).toBeNull();
  });

  it('persists password recovery codes during mint to the scoped recovery store', async () => {
    localStorage.clear();
    const sbtAddress = '0x00000000000000000000000000000000000000b3';
    const instance = makeInstance({
      provider: 'mock-provider',
      account: '0xCreator',
      loginComplete: true,
      network: { id: 84532, name: 'Base Sepolia' },
      sessionSlug: 'edge',
    });
    instance.state = {
      ...instance.state,
      sbtName: 'Password Group',
      tokenURI: 'ar://metadata',
      groupPassword: 'shared-secret',
      sbtDistribution: {
        ...instance.state.sbtDistribution,
        burnAuth: 'AdminOnly',
        distributionOption: 'groupPassword',
        isLimited: true,
        limitedNumber: 1,
      },
    };

    instance.getSessionConfigForNetwork = jest.fn(() => ({ slug: 'edge', networkChainId: 84532 }));
    jest.spyOn(instance, 'generateSBTInviteLinks').mockResolvedValue(undefined);
    jest.spyOn(contractScripts, 'countSBTCreated').mockResolvedValue(2);
    jest.spyOn(contractScripts, 'computeGroupPasswordHash').mockReturnValue(`0x${'33'.repeat(32)}`);
    jest.spyOn(contractScripts, 'createSBT').mockResolvedValue({
      logs: [makeFactoryReceiptLog('SBTCreated', [sbtAddress])],
    });

    await instance.mintSBT();

    expect(instance.generateSBTInviteLinks).toHaveBeenCalledWith(sbtAddress, ['shared-secret']);
    const recoveryStore = JSON.parse(localStorage.getItem(SBT_PASSWORD_RECOVERY_STORAGE_KEY));
    expect(recoveryStore.entries[`84532:${sbtAddress.toLowerCase()}`]).toEqual(
      expect.objectContaining({
        chainId: 84532,
        sbtAddress: sbtAddress.toLowerCase(),
        passwords: ['shared-secret'],
      }),
    );
  });

  it('reads bookmark cache with clone:false before mutating sbt bookmarks', async () => {
    const instance = makeInstance({ sessionSlug: 'edge' });
    instance.state.bookmarkedSbtsSet = new Set();
    const peekSpy = jest.spyOn(cacheScripts, 'peekCacheSync').mockReturnValue({ sbts: ['0xaaa'] });
    const writeSpy = jest.spyOn(cacheScripts, 'writeCache').mockResolvedValue(true);

    instance.bookmarkSBT('0xbbb');
    await Promise.resolve();

    expect(peekSpy).toHaveBeenCalledWith('bookmarksCache', 'edge', { clone: false });
    expect(writeSpy).toHaveBeenCalledWith(
      'bookmarksCache',
      'edge',
      expect.objectContaining({
        sbts: expect.arrayContaining(['0xaaa', '0xbbb']),
      }),
    );
  });

  it('componentWillUnmount clears countdown interval and tracked reset timers', () => {
    jest.useFakeTimers();
    try {
      const instance = makeInstance();
      const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');
      const clearIntervalSpy = jest.spyOn(global, 'clearInterval');

      const timeoutA = setTimeout(() => {}, 2000);
      const timeoutB = setTimeout(() => {}, 1500);
      const intervalId = setInterval(() => {}, 1000);

      instance._isMounted = true;
      instance._trackedTimeouts.set('copyLinkSuccess', timeoutA);
      instance._trackedTimeouts.set('copyJsonSuccess', timeoutB);
      instance.countdownTimer = intervalId;

      instance.componentWillUnmount();

      expect(instance._isMounted).toBe(false);
      expect(instance.countdownTimer).toBeNull();
      expect(instance._trackedTimeouts.size).toBe(0);
      expect(clearIntervalSpy).toHaveBeenCalledWith(intervalId);
      expect(clearTimeoutSpy).toHaveBeenCalledWith(timeoutA);
      expect(clearTimeoutSpy).toHaveBeenCalledWith(timeoutB);
    } finally {
      jest.useRealTimers();
    }
  });
});
