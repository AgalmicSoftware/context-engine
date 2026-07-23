import SBTPage from './SBTPage';
import contractScripts from '../../utilities/web3/contractScripts.js';
import { cryptoUtils } from '../../utilities/crypto/cryptography.js';
import { buildSbtDetailPath } from '../../utilities/sbt/sbtDetailPath.js';
import { buildSbtPageAutoMintStorageKey } from './sbtPageAutoMintHelpers';

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

const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('SBTPage auto-mint routing', () => {
  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
    localStorage.clear();
    window.sessionStorage.clear();
  });

  it('routes public auto-mint URLs to the dedicated public mint helper', async () => {
    const sbtAddress = '0x0000000000000000000000000000000000000101';
    const previousHref = window.location.href;
    window.history.replaceState(
      {},
      '',
      `${buildSbtDetailPath(sbtAddress)}?sbt=${encodeURIComponent(sbtAddress)}&auto=1`,
    );

    try {
      const subject = createSubject({
        SBTAddress: sbtAddress,
        loginComplete: true,
      });
      subject.state = {
        ...subject.state,
        userHasSBT: false,
        mintingStatus: 'idle',
      };
      const publicMintSpy = jest.spyOn(subject, 'autoMintPublicIfAllowed').mockResolvedValue(true);

      await subject.handleUrlAutoMintIntent();
      await flushPromises();

      expect(publicMintSpy).toHaveBeenCalledWith(
        sbtAddress,
        expect.objectContaining({
          sessionSlugOverride: '',
        }),
      );
      expect(
        window.sessionStorage.getItem(
          buildSbtPageAutoMintStorageKey({
            chainId: 84532,
            sessionSlug: 'general',
            sbtAddress,
          }),
        ),
      ).toBe('done');
    } finally {
      window.history.replaceState({}, '', previousHref);
    }
  });

  it('does not consume URL auto-mint attempts until the mint succeeds', async () => {
    const sbtAddress = '0x0000000000000000000000000000000000000106';
    const previousHref = window.location.href;
    const successKey = buildSbtPageAutoMintStorageKey({
      chainId: 84532,
      sessionSlug: 'edge',
      sbtAddress,
    });
    window.history.replaceState(
      {},
      '',
      `${buildSbtDetailPath(sbtAddress, { sessionSlug: 'edge' })}?sbt=${encodeURIComponent(sbtAddress)}&auto=1`,
    );

    try {
      const subject = createSubject({
        SBTAddress: sbtAddress,
        loginComplete: true,
        sessionSlug: 'edge',
      });
      subject.state = {
        ...subject.state,
        userHasSBT: false,
        mintingStatus: 'idle',
      };
      const publicMintSpy = jest
        .spyOn(subject, 'autoMintPublicIfAllowed')
        .mockRejectedValueOnce(new Error('wallet rejected'))
        .mockResolvedValueOnce(true);

      await expect(subject.handleUrlAutoMintIntent()).rejects.toThrow('wallet rejected');
      expect(window.sessionStorage.getItem(successKey)).toBeNull();
      expect(window.location.search).not.toContain('auto=');
      expect(window.location.search).not.toContain('sbt=');

      await subject.handleUrlAutoMintIntent();

      expect(publicMintSpy).toHaveBeenCalledTimes(2);
      expect(window.sessionStorage.getItem(successKey)).toBe('done');
    } finally {
      window.history.replaceState({}, '', previousHref);
    }
  });

  it('does not mark public URL auto-mint complete when the real mint path catches a wallet failure', async () => {
    const sbtAddress = '0x0000000000000000000000000000000000000107';
    const previousHref = window.location.href;
    const successKey = buildSbtPageAutoMintStorageKey({
      chainId: 84532,
      sessionSlug: 'edge',
      sbtAddress,
    });
    window.history.replaceState(
      {},
      '',
      `${buildSbtDetailPath(sbtAddress, { sessionSlug: 'edge' })}?sbt=${encodeURIComponent(sbtAddress)}&auto=1`,
    );

    try {
      const subject = createSubject({
        SBTAddress: sbtAddress,
        account: '0x0000000000000000000000000000000000000abc',
        loginComplete: true,
        sessionSlug: 'edge',
      });
      subject.state = {
        ...subject.state,
        sbtInfo: { hasPasswordMint: false },
        userHasSBT: false,
        mintingStatus: 'idle',
      };
      jest
        .spyOn(contractScripts, 'getGroupPasswordHash')
        .mockResolvedValue('0x0000000000000000000000000000000000000000000000000000000000000000');
      jest.spyOn(contractScripts, 'claim').mockRejectedValue(new Error('wallet rejected'));
      jest.spyOn(subject, 'loadSBTInfo').mockResolvedValue(undefined);

      const result = await subject.handleUrlAutoMintIntent();

      expect(result).toBe(false);
      expect(contractScripts.claim).toHaveBeenCalledWith('mock', sbtAddress);
      expect(consoleErrorSpy).toHaveBeenCalledWith('[sbt]', 'Minting failed in handleMint:', walletError);
      expect(window.sessionStorage.getItem(successKey)).toBeNull();
    } finally {
      window.history.replaceState({}, '', previousHref);
    }
  });

  it('does not send public URL auto-mints after the route target changes before mint', async () => {
    const sbtAddress = '0x0000000000000000000000000000000000000108';
    const nextSbtAddress = '0x0000000000000000000000000000000000000109';
    const previousHref = window.location.href;
    const successKey = buildSbtPageAutoMintStorageKey({
      chainId: 84532,
      sessionSlug: 'edge',
      sbtAddress,
    });
    window.history.replaceState(
      {},
      '',
      `${buildSbtDetailPath(sbtAddress, { sessionSlug: 'edge' })}?sbt=${encodeURIComponent(sbtAddress)}&auto=1`,
    );

    try {
      const subject = createSubject({
        SBTAddress: sbtAddress,
        account: '0x0000000000000000000000000000000000000abc',
        loginComplete: true,
        sessionSlug: 'edge',
      });
      subject.state = {
        ...subject.state,
        sbtInfo: { hasPasswordMint: false },
        userHasSBT: false,
        mintingStatus: 'idle',
      };
      jest.spyOn(contractScripts, 'getGroupPasswordHash').mockImplementation(async () => {
        subject.props = { ...subject.props, SBTAddress: nextSbtAddress, sessionSlug: 'next' };
        return '0x0000000000000000000000000000000000000000000000000000000000000000';
      });
      jest.spyOn(contractScripts, 'claim').mockResolvedValue({ transactionHash: '0xpublicmint' });
      const loadSpy = jest.spyOn(subject, 'loadSBTInfo').mockResolvedValue(undefined);
      const localSuccessSpy = jest.spyOn(subject, 'applyLocalMintSuccess');
      const refreshSpy = jest.spyOn(subject, 'refreshSbtDataWithSlug').mockReturnValue(undefined);

      const result = await subject.handleUrlAutoMintIntent();

      expect(result).toBe(false);
      expect(contractScripts.claim).not.toHaveBeenCalled();
      expect(contractScripts.claim).not.toHaveBeenCalledWith('mock', nextSbtAddress);
      expect(loadSpy).not.toHaveBeenCalled();
      expect(localSuccessSpy).not.toHaveBeenCalled();
      expect(refreshSpy).not.toHaveBeenCalled();
      expect(window.sessionStorage.getItem(successKey)).toBeNull();
    } finally {
      window.history.replaceState({}, '', previousHref);
    }
  });

  it('does not write public auto-mint metadata after the route target changes during hydration', async () => {
    const sbtAddress = '0x0000000000000000000000000000000000000116';
    const nextSbtAddress = '0x0000000000000000000000000000000000000117';
    const account = '0x0000000000000000000000000000000000000abc';
    const subject = createSubject({
      SBTAddress: sbtAddress,
      account,
      loginComplete: true,
      sessionSlug: 'edge',
    });
    subject.state = {
      ...subject.state,
      sbtInfo: null,
      userHasSBT: false,
      mintingStatus: 'idle',
    };
    jest.spyOn(contractScripts, 'getSbtMetadata').mockImplementation(async () => {
      subject.props = { ...subject.props, SBTAddress: nextSbtAddress, sessionSlug: 'next' };
      return { hasPasswordMint: false };
    });
    jest
      .spyOn(contractScripts, 'getGroupPasswordHash')
      .mockResolvedValue('0x0000000000000000000000000000000000000000000000000000000000000000');
    const claimSpy = jest.spyOn(contractScripts, 'claim').mockResolvedValue({ transactionHash: '0xpublicmint' });

    const result = await subject.autoMintPublicIfAllowed(sbtAddress, {
      accountLowerOverride: account,
      sessionSlugOverride: 'edge',
    });

    expect(result).toBe(false);
    expect(subject.state.sbtInfo).toBeNull();
    expect(subject.state.mintingStatus).toBe('idle');
    expect(claimSpy).not.toHaveBeenCalled();
  });

  it('does not write password auto-mint metadata after the route target changes during hydration', async () => {
    const sbtAddress = '0x0000000000000000000000000000000000000118';
    const nextSbtAddress = '0x0000000000000000000000000000000000000119';
    const previousHref = window.location.href;
    window.history.replaceState(
      {},
      '',
      `${buildSbtDetailPath(sbtAddress, { sessionSlug: 'edge' })}?sbt=${encodeURIComponent(sbtAddress)}&gp=claim-code&auto=1`,
    );

    try {
      const subject = createSubject({
        SBTAddress: sbtAddress,
        account: '0x0000000000000000000000000000000000000abc',
        loginComplete: true,
        sessionSlug: 'edge',
      });
      subject.state = {
        ...subject.state,
        sbtInfo: null,
        userHasSBT: false,
        mintingStatus: 'idle',
      };
      jest.spyOn(contractScripts, 'getSbtMetadata').mockImplementation(async () => {
        subject.props = { ...subject.props, SBTAddress: nextSbtAddress, sessionSlug: 'next' };
        return { hasPasswordMint: true };
      });
      const claimSpy = jest.spyOn(subject, 'claimWithGroupPassword').mockResolvedValue(true);

      const result = await subject.handleUrlAutoMintIntent();

      expect(result).toBe(false);
      expect(subject.state.sbtInfo).toBeNull();
      expect(claimSpy).not.toHaveBeenCalled();
      expect(subject.state.mintingStatus).toBe('idle');
    } finally {
      window.history.replaceState({}, '', previousHref);
    }
  });

  it('does not write invite-code errors after URL group hash lookup becomes stale', async () => {
    const sbtAddress = '0x0000000000000000000000000000000000000120';
    const nextSbtAddress = '0x0000000000000000000000000000000000000121';
    const previousHref = window.location.href;
    window.history.replaceState(
      {},
      '',
      `${buildSbtDetailPath(sbtAddress, { sessionSlug: 'edge' })}?sbt=${encodeURIComponent(sbtAddress)}&gp=claim-code&auto=1`,
    );

    try {
      const subject = createSubject({
        SBTAddress: sbtAddress,
        account: '0x0000000000000000000000000000000000000abc',
        loginComplete: true,
        sessionSlug: 'edge',
      });
      subject.state = {
        ...subject.state,
        error: null,
        sbtInfo: { hasPasswordMint: false },
        userHasSBT: false,
        mintingStatus: 'idle',
      };
      jest.spyOn(contractScripts, 'getGroupPasswordHash').mockImplementation(async () => {
        subject.props = { ...subject.props, SBTAddress: nextSbtAddress, sessionSlug: 'next' };
        return '0x0000000000000000000000000000000000000000000000000000000000000000';
      });

      const result = await subject.handleUrlAutoMintIntent();

      expect(result).toBe(false);
      expect(subject.state.error).toBeNull();
      expect(subject.state.mintingStatus).toBe('idle');
    } finally {
      window.history.replaceState({}, '', previousHref);
    }
  });

  it('does not send group-password URL auto-mints after the route target changes before mint', async () => {
    const sbtAddress = '0x0000000000000000000000000000000000000110';
    const nextSbtAddress = '0x0000000000000000000000000000000000000111';
    const previousHref = window.location.href;
    const onchainHash = `0x${'11'.repeat(32)}`;
    const successKey = buildSbtPageAutoMintStorageKey({
      chainId: 84532,
      sessionSlug: 'edge',
      sbtAddress,
    });
    window.history.replaceState(
      {},
      '',
      `${buildSbtDetailPath(sbtAddress, { sessionSlug: 'edge' })}?sbt=${encodeURIComponent(sbtAddress)}&gp=claim-code&auto=1`,
    );

    try {
      const subject = createSubject({
        SBTAddress: sbtAddress,
        account: '0x0000000000000000000000000000000000000abc',
        loginComplete: true,
        sessionSlug: 'edge',
      });
      subject.state = {
        ...subject.state,
        sbtInfo: { hasPasswordMint: false },
        userHasSBT: false,
        mintingStatus: 'idle',
      };
      jest
        .spyOn(contractScripts, 'getGroupPasswordHash')
        .mockImplementationOnce(async () => {
          subject.props = { ...subject.props, SBTAddress: nextSbtAddress, sessionSlug: 'next' };
          return onchainHash;
        })
        .mockResolvedValue(onchainHash);
      jest.spyOn(cryptoUtils, 'resolveGroupPasswordWalletScopeAddress').mockReturnValue(sbtAddress);
      jest.spyOn(contractScripts, 'computeGroupPasswordHash').mockReturnValue(onchainHash);
      jest.spyOn(contractScripts, 'signGroupMintAuthorization').mockResolvedValue('0xsig');
      jest.spyOn(contractScripts, 'mintWithGroupSignature').mockResolvedValue({ transactionHash: '0xgroupmint' });
      const loadSpy = jest.spyOn(subject, 'loadSBTInfo').mockResolvedValue(undefined);
      const localSuccessSpy = jest.spyOn(subject, 'applyLocalMintSuccess');
      const refreshSpy = jest.spyOn(subject, 'refreshSbtDataWithSlug').mockReturnValue(undefined);

      const result = await subject.handleUrlAutoMintIntent();

      expect(result).toBe(false);
      expect(contractScripts.signGroupMintAuthorization).not.toHaveBeenCalled();
      expect(contractScripts.mintWithGroupSignature).not.toHaveBeenCalled();
      expect(loadSpy).not.toHaveBeenCalled();
      expect(localSuccessSpy).not.toHaveBeenCalled();
      expect(refreshSpy).not.toHaveBeenCalled();
      expect(window.sessionStorage.getItem(successKey)).toBeNull();
    } finally {
      window.history.replaceState({}, '', previousHref);
    }
  });

  it('does not send generated group-password invites after the wallet changes before claim', async () => {
    const sbtAddress = '0x0000000000000000000000000000000000000114';
    const startAccount = '0x0000000000000000000000000000000000000abc';
    const nextAccount = '0x0000000000000000000000000000000000000def';
    const onchainHash = `0x${'22'.repeat(32)}`;
    const subject = createSubject({
      SBTAddress: sbtAddress,
      account: startAccount,
      loginComplete: true,
      sessionSlug: 'edge',
    });
    subject.state = {
      ...subject.state,
      sbtInfo: { hasPasswordMint: true },
      userHasSBT: false,
      mintingStatus: 'idle',
    };
    jest.spyOn(contractScripts, 'getGroupPasswordHash').mockResolvedValue(onchainHash);
    jest.spyOn(cryptoUtils, 'resolveGroupPasswordWalletScopeAddress').mockReturnValue(sbtAddress);
    jest.spyOn(contractScripts, 'computeGroupPasswordHash').mockReturnValue(onchainHash);
    jest.spyOn(contractScripts, 'getMintedTokens').mockResolvedValue('0');
    jest.spyOn(contractScripts, 'generateInvitePayloads').mockImplementation(async () => {
      subject.props = { ...subject.props, account: nextAccount };
      return [{ nonce: '1', signature: '0xsig' }];
    });
    const claimSpy = jest.spyOn(contractScripts, 'claimWithInvite').mockResolvedValue({ transactionHash: '0xinvite' });

    const result = await subject.claimWithGroupPassword('claim-code', sbtAddress, {
      sessionSlugOverride: 'edge',
    });

    expect(result).toBe(false);
    expect(contractScripts.generateInvitePayloads).toHaveBeenCalled();
    expect(claimSpy).not.toHaveBeenCalled();
  });

  it('refreshes invite payload mints with the captured session even if route props change', async () => {
    const sbtAddress = '0x0000000000000000000000000000000000000112';
    const nextSbtAddress = '0x0000000000000000000000000000000000000113';
    const subject = createSubject({
      SBTAddress: sbtAddress,
      account: '0x0000000000000000000000000000000000000abc',
      loginComplete: true,
      sessionSlug: 'edge',
    });
    subject.state = {
      ...subject.state,
      userHasSBT: false,
      mintingStatus: 'idle',
    };
    jest.spyOn(contractScripts, 'claimWithInvite').mockImplementation(async () => {
      subject.props = {
        ...subject.props,
        SBTAddress: nextSbtAddress,
        sessionSlug: 'next',
      };
      return { transactionHash: '0xinvite' };
    });
    const loadSpy = jest.spyOn(subject, 'loadSBTInfo').mockResolvedValue(undefined);
    const localSuccessSpy = jest.spyOn(subject, 'applyLocalMintSuccess');
    const refreshSpy = jest.spyOn(subject, 'refreshSbtDataWithSlug').mockReturnValue(undefined);

    const result = await subject.claimWithInvitePayload({ nonce: '1', signature: '0xsig' }, sbtAddress, {
      sessionSlugOverride: 'edge',
    });

    expect(result.ok).toBe(true);
    expect(contractScripts.claimWithInvite).toHaveBeenCalledWith('mock', sbtAddress, '1', '0xsig');
    expect(loadSpy).not.toHaveBeenCalled();
    expect(localSuccessSpy).not.toHaveBeenCalled();
    expect(refreshSpy).toHaveBeenCalledWith(sbtAddress, undefined, 'edge');
    expect(refreshSpy).not.toHaveBeenCalledWith(nextSbtAddress, undefined, 'next');
    expect(subject.state.mintingStatus).toBe('idle');
  });

  it('does not expose nested provider claim data through return or UI error text', async () => {
    const sbtAddress = '0x0000000000000000000000000000000000000112';
    const rawCredential = 'claim-secret-sentinel';
    const subject = createSubject({
      SBTAddress: sbtAddress,
      account: '0x0000000000000000000000000000000000000abc',
      loginComplete: true,
      sessionSlug: 'edge',
    });
    subject.state = {
      ...subject.state,
      userHasSBT: false,
      mintingStatus: 'idle',
    };
    jest
      .spyOn(contractScripts, 'claimWithInvite')
      .mockRejectedValue(new Error(`RPC request failed with calldata containing ${rawCredential}`));

    const result = await subject.claimWithInvitePayload({ nonce: '1', signature: rawCredential }, sbtAddress, {
      sessionSlugOverride: 'edge',
    });

    expect(result.ok).toBe(false);
    expect(result.error.message).toBe('Claim failed. Verify the credential and network, then retry.');
    expect(subject.state.error).toBe('Claim failed. Verify the credential and network, then retry.');
    expect(JSON.stringify(result)).not.toContain(rawCredential);
    expect(JSON.stringify(subject.state)).not.toContain(rawCredential);
  });

  it('defers prop-driven auto-mint on mount until sbtInfo is loaded', async () => {
    const sbtAddress = '0x0000000000000000000000000000000000000105';
    const subject = createSubject({
      SBTAddress: sbtAddress,
      autoMintingMode: true,
      sbtMintPassword: 'claim-code',
    });
    subject.state = {
      ...subject.state,
      sbtInfo: null,
      userHasSBT: false,
      mintingStatus: 'idle',
    };

    jest.spyOn(subject, 'loadSBTInfo').mockResolvedValue(undefined);
    jest.spyOn(subject, 'startMintingEndCountdown').mockImplementation(() => {});
    jest.spyOn(subject, 'checkForMintPassword').mockImplementation(() => {});
    jest.spyOn(subject, 'fetchRelevantInfo').mockImplementation(() => {});
    jest.spyOn(subject, 'loadCachedPasswords').mockImplementation(() => {});
    jest.spyOn(subject, 'handleUrlAutoMintIntent').mockResolvedValue(false);
    const handleMintSpy = jest.spyOn(subject, 'handleMint').mockResolvedValue(undefined);

    subject.componentDidMount();
    await flushPromises();

    expect(handleMintSpy).not.toHaveBeenCalled();
  });

  it('retries prop-driven auto-mint during updates once sbtInfo is available', () => {
    const subject = createSubject({
      autoMintingMode: true,
      sbtMintPassword: 'claim-code',
    });
    subject.state = {
      ...subject.state,
      sbtInfo: null,
      userHasSBT: false,
      mintingStatus: 'idle',
    };
    const handleMintSpy = jest.spyOn(subject, 'handleMint').mockResolvedValue(undefined);

    subject.componentDidUpdate(subject.props, {
      ...subject.state,
      mintingStatus: 'pending',
    });
    expect(handleMintSpy).not.toHaveBeenCalled();

    const prevState = { ...subject.state };
    subject.state = {
      ...subject.state,
      sbtInfo: { hasPasswordMint: true },
    };

    subject.componentDidUpdate(subject.props, prevState);

    expect(handleMintSpy).toHaveBeenCalledTimes(1);
  });

  it('retries password-list auto-mint when the target changes', () => {
    const oldSbtAddress = '0x0000000000000000000000000000000000000113';
    const nextSbtAddress = '0x0000000000000000000000000000000000000114';
    const subject = createSubject({
      SBTAddress: oldSbtAddress,
      account: '0x0000000000000000000000000000000000000abc',
      autoMintingMode: true,
      loginComplete: true,
      sbtMintPassword: ['claim-code'],
      sessionSlug: 'edge',
    });
    subject.state = {
      ...subject.state,
      mintingStatus: 'idle',
    };
    subject.markAttemptedListMintForCurrentTarget();
    subject.props = {
      ...subject.props,
      SBTAddress: nextSbtAddress,
    };
    const listMintSpy = jest.spyOn(subject, 'attemptMintWithPasswordList').mockResolvedValue(undefined);

    subject.componentDidUpdate(subject.props, {
      ...subject.state,
      mintingStatus: 'pending',
    });

    expect(listMintSpy).toHaveBeenCalledWith(['claim-code']);
    expect(subject._attemptedListMintTargetKey).toContain(nextSbtAddress.toLowerCase());
  });

  it('resets pending mint UI when the connected account changes', () => {
    const sbtAddress = '0x0000000000000000000000000000000000000115';
    const previousAccount = '0x0000000000000000000000000000000000000abc';
    const nextAccount = '0x0000000000000000000000000000000000000def';
    const subject = createSubject({
      SBTAddress: sbtAddress,
      account: nextAccount,
      loginComplete: true,
      sessionSlug: 'edge',
    });
    subject.state = {
      ...subject.state,
      groupPasswordInput: 'claim-code',
      manualPasswordInput: 'manual-code',
      mintingStatus: 'pending',
      showMiniPasswordInput: true,
    };
    jest.spyOn(subject, 'loadSBTInfo').mockResolvedValue(undefined);
    jest.spyOn(subject, 'handleUrlAutoMintIntent').mockResolvedValue(false);

    subject.componentDidUpdate({
      ...subject.props,
      account: previousAccount,
    });

    expect(subject.state.mintingStatus).toBe('idle');
    expect(subject.state.groupPasswordInput).toBe('');
    expect(subject.state.manualPasswordInput).toBe('');
    expect(subject.state.showMiniPasswordInput).toBe(false);
    expect(subject.loadSBTInfo).toHaveBeenCalled();
  });

  it('does not write unlimited group-password errors after hash lookup becomes stale', async () => {
    const sbtAddress = '0x0000000000000000000000000000000000000122';
    const nextSbtAddress = '0x0000000000000000000000000000000000000123';
    const account = '0x0000000000000000000000000000000000000abc';
    const subject = createSubject({
      SBTAddress: sbtAddress,
      account,
      loginComplete: true,
      sessionSlug: 'edge',
    });
    subject.state = {
      ...subject.state,
      error: null,
      groupPasswordInput: 'claim-code',
      mintingStatus: 'idle',
    };
    jest.spyOn(contractScripts, 'getGroupPasswordHash').mockImplementation(async () => {
      subject.props = { ...subject.props, SBTAddress: nextSbtAddress, sessionSlug: 'next' };
      return '0x0000000000000000000000000000000000000000000000000000000000000000';
    });
    const signSpy = jest.spyOn(contractScripts, 'signGroupMintAuthorization').mockResolvedValue('0xsig');

    const result = await subject.mintUnlimitedWithGroupPassword({
      accountLowerOverride: account,
      passwordOverride: 'claim-code',
      sbtAddressOverride: sbtAddress,
      sessionSlugOverride: 'edge',
    });

    expect(result).toBe(false);
    expect(subject.state.error).toBeNull();
    expect(signSpy).not.toHaveBeenCalled();
  });

  it('does not write password prevalidation errors after the mint target changes', async () => {
    const sbtAddress = '0x0000000000000000000000000000000000000124';
    const nextSbtAddress = '0x0000000000000000000000000000000000000125';
    const account = '0x0000000000000000000000000000000000000abc';
    const subject = createSubject({
      SBTAddress: sbtAddress,
      account,
      loginComplete: true,
      sessionSlug: 'edge',
    });
    subject.state = {
      ...subject.state,
      error: null,
      manualPasswordInput: 'claim-code',
      mintStep: 0,
      mintingStatus: 'idle',
      sbtInfo: { hasPasswordMint: true },
    };
    jest.spyOn(contractScripts, 'isPasswordValid').mockImplementation(async () => {
      subject.props = { ...subject.props, SBTAddress: nextSbtAddress, sessionSlug: 'next' };
      return false;
    });
    const startClaimSpy = jest.spyOn(contractScripts, 'startClaim').mockResolvedValue({ transactionHash: '0xstart' });

    const result = await subject.handleMint(true, {
      accountLowerOverride: account,
      sbtAddressOverride: sbtAddress,
      sessionSlugOverride: 'edge',
      sbtInfoOverride: { hasPasswordMint: true },
    });

    expect(result).toBe(false);
    expect(subject.state.error).toBeNull();
    expect(subject.state.mintingStatus).toBe('idle');
    expect(startClaimSpy).not.toHaveBeenCalled();
  });

  it('does not expose provider-returned password claim data in logs or UI state', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const sbtAddress = '0x0000000000000000000000000000000000000128';
    const account = '0x0000000000000000000000000000000000000abc';
    const secretSentinel = 'password-claim-secret-sentinel';
    const subject = createSubject({
      SBTAddress: sbtAddress,
      account,
      loginComplete: true,
      sessionSlug: 'edge',
    });
    subject.state = {
      ...subject.state,
      error: null,
      manualPasswordInput: secretSentinel,
      mintStep: 0,
      mintingStatus: 'idle',
      sbtInfo: { hasPasswordMint: true },
    };
    jest.spyOn(contractScripts, 'isPasswordValid').mockResolvedValue(true);
    jest.spyOn(contractScripts, 'startClaim').mockRejectedValue(new Error(`provider echoed ${secretSentinel}`));

    try {
      const result = await subject.handleMint(true, {
        accountLowerOverride: account,
        sbtAddressOverride: sbtAddress,
        sessionSlugOverride: 'edge',
        sbtInfoOverride: { hasPasswordMint: true },
      });

      expect(result).toBe(false);
      expect(subject.state.error).toBe('Claim failed. Verify the credential and network, then retry.');
      expect(JSON.stringify(subject.state)).not.toContain(`provider echoed ${secretSentinel}`);
      expect(JSON.stringify(consoleErrorSpy.mock.calls)).not.toContain(secretSentinel);
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });

  it('does not continue password mints after the network changes during prevalidation', async () => {
    const sbtAddress = '0x0000000000000000000000000000000000000126';
    const account = '0x0000000000000000000000000000000000000abc';
    const subject = createSubject({
      SBTAddress: sbtAddress,
      account,
      loginComplete: true,
      provider: 'base-provider',
      network: { id: 84532, name: 'Base Sepolia' },
      sessionSlug: 'edge',
    });
    subject.state = {
      ...subject.state,
      error: null,
      manualPasswordInput: 'claim-code',
      mintStep: 0,
      mintingStatus: 'idle',
      sbtInfo: { hasPasswordMint: true },
    };
    jest.spyOn(contractScripts, 'isPasswordValid').mockImplementation(async () => {
      subject.props = {
        ...subject.props,
        provider: 'op-provider',
        network: { id: 11155420, name: 'OP Sepolia' },
      };
      return true;
    });
    const startClaimSpy = jest.spyOn(contractScripts, 'startClaim').mockResolvedValue({ transactionHash: '0xstart' });

    const result = await subject.handleMint(true, {
      accountLowerOverride: account,
      sbtAddressOverride: sbtAddress,
      sessionSlugOverride: 'edge',
      sbtInfoOverride: { hasPasswordMint: true },
    });

    expect(result).toBe(false);
    expect(subject.state.error).toBeNull();
    expect(subject.state.mintingStatus).toBe('idle');
    expect(startClaimSpy).not.toHaveBeenCalled();
  });

  it('does not continue password mints when wallet network props are temporarily unavailable', async () => {
    const sbtAddress = '0x0000000000000000000000000000000000000127';
    const account = '0x0000000000000000000000000000000000000abc';
    const subject = createSubject({
      SBTAddress: sbtAddress,
      account,
      loginComplete: true,
      provider: 'base-provider',
      network: { id: 84532, name: 'Base Sepolia' },
      sessionSlug: 'edge',
    });
    subject.state = {
      ...subject.state,
      error: null,
      manualPasswordInput: 'claim-code',
      mintStep: 0,
      mintingStatus: 'idle',
      network: { id: 84532, name: 'Base Sepolia' },
      sbtInfo: { hasPasswordMint: true },
    };
    jest.spyOn(contractScripts, 'isPasswordValid').mockImplementation(async () => {
      subject.props = {
        ...subject.props,
        provider: 'transition-provider',
        network: undefined,
        networkChainId: undefined,
      };
      return true;
    });
    const startClaimSpy = jest.spyOn(contractScripts, 'startClaim').mockResolvedValue({ transactionHash: '0xstart' });

    const result = await subject.handleMint(true, {
      accountLowerOverride: account,
      sbtAddressOverride: sbtAddress,
      sessionSlugOverride: 'edge',
      sbtInfoOverride: { hasPasswordMint: true },
    });

    expect(result).toBe(false);
    expect(subject.state.error).toBeNull();
    expect(subject.state.mintingStatus).toBe('idle');
    expect(startClaimSpy).not.toHaveBeenCalled();
  });

  it('does not run URL auto-mints before the wallet chain is known', async () => {
    const sbtAddress = '0x0000000000000000000000000000000000000130';
    const previousHref = window.location.href;
    window.history.replaceState(
      {},
      '',
      `${buildSbtDetailPath(sbtAddress)}?sbt=${encodeURIComponent(sbtAddress)}&auto=1`,
    );

    try {
      const subject = createSubject({
        SBTAddress: sbtAddress,
        account: '0x0000000000000000000000000000000000000abc',
        loginComplete: true,
        network: undefined,
        networkChainId: undefined,
      });
      subject.state = {
        ...subject.state,
        network: { id: 84532, name: 'Base Sepolia' },
        userHasSBT: false,
        mintingStatus: 'idle',
      };
      const publicMintSpy = jest.spyOn(subject, 'autoMintPublicIfAllowed').mockResolvedValue(true);

      const result = await subject.handleUrlAutoMintIntent();

      expect(result).toBe(false);
      expect(publicMintSpy).not.toHaveBeenCalled();
    } finally {
      window.history.replaceState({}, '', previousHref);
    }
  });

  it('passes captured target overrides to invite list auto-mints', async () => {
    const sbtAddress = '0x0000000000000000000000000000000000000128';
    const account = '0x0000000000000000000000000000000000000abc';
    const subject = createSubject({
      SBTAddress: sbtAddress,
      account,
      loginComplete: true,
      provider: 'base-provider',
      network: { id: 84532, name: 'Base Sepolia' },
      sessionSlug: 'edge',
    });
    subject.state = {
      ...subject.state,
      groupPasswordInput: '',
      mintingStatus: 'idle',
    };
    jest
      .spyOn(subject, 'decodeInviteInput')
      .mockImplementation((token) => (token === 'invite-payload' ? { nonce: '1', signature: '0xsig' } : null));
    const inviteSpy = jest.spyOn(subject, 'claimWithInviteCode').mockResolvedValue(true);

    await subject.attemptMintWithPasswordList(['invite-payload']);

    expect(subject.state.groupPasswordInput).toBe('invite-payload');
    expect(inviteSpy).toHaveBeenCalledWith(
      'invite-payload',
      sbtAddress,
      expect.objectContaining({
        accountLowerOverride: account,
        chainIdOverride: '84532',
        sessionSlugOverride: 'edge',
      }),
    );
  });

  it('does not continue password-list mints after network props disappear during validation', async () => {
    const sbtAddress = '0x0000000000000000000000000000000000000129';
    const account = '0x0000000000000000000000000000000000000abc';
    const subject = createSubject({
      SBTAddress: sbtAddress,
      account,
      loginComplete: true,
      provider: 'base-provider',
      network: { id: 84532, name: 'Base Sepolia' },
      sessionSlug: 'edge',
    });
    subject.state = {
      ...subject.state,
      hasInviteMint: false,
      manualPasswordInput: '',
      mintingStatus: 'idle',
      network: { id: 84532, name: 'Base Sepolia' },
      sbtInfo: { hasPasswordMint: true },
    };
    jest.spyOn(contractScripts, 'isPasswordValid').mockImplementation(async () => {
      subject.props = {
        ...subject.props,
        provider: 'transition-provider',
        network: undefined,
        networkChainId: undefined,
      };
      return true;
    });
    const handleMintSpy = jest.spyOn(subject, 'handleMint').mockResolvedValue(true);

    await subject.attemptMintWithPasswordList(['claim-code']);

    expect(subject.state.manualPasswordInput).toBe('');
    expect(handleMintSpy).not.toHaveBeenCalled();
  });

  it('routes invite auto-mint URLs to invite claiming on the dedicated page', async () => {
    const sbtAddress = '0x0000000000000000000000000000000000000102';
    const previousHref = window.location.href;
    window.history.replaceState(
      {},
      '',
      `${buildSbtDetailPath(sbtAddress)}?sbt=${encodeURIComponent(sbtAddress)}&auto=1&inv=invite-token`,
    );

    try {
      const subject = createSubject({
        SBTAddress: sbtAddress,
        loginComplete: true,
      });
      subject.state = {
        ...subject.state,
        userHasSBT: false,
        mintingStatus: 'idle',
      };
      const inviteSpy = jest.spyOn(subject, 'claimWithInviteCode').mockResolvedValue(undefined);

      await subject.handleUrlAutoMintIntent();
      await flushPromises();

      expect(subject.state.groupPasswordInput).toBe('invite-token');
      expect(window.location.href).not.toContain('invite-token');
      expect(inviteSpy).toHaveBeenCalledWith(
        'invite-token',
        sbtAddress,
        expect.objectContaining({
          sessionSlugOverride: '',
        }),
      );
    } finally {
      window.history.replaceState({}, '', previousHref);
    }
  });

  it('routes claim-code auto-mint URLs to the password claim helper even without an on-chain group password hash', async () => {
    const sbtAddress = '0x0000000000000000000000000000000000000103';
    const previousHref = window.location.href;
    window.history.replaceState(
      {},
      '',
      `${buildSbtDetailPath(sbtAddress)}?sbt=${encodeURIComponent(sbtAddress)}&auto=1&gp=claim-code`,
    );

    try {
      const subject = createSubject({
        SBTAddress: sbtAddress,
        loginComplete: true,
      });
      subject.state = {
        ...subject.state,
        sbtInfo: { hasPasswordMint: true },
        userHasSBT: false,
        mintingStatus: 'idle',
      };
      const claimSpy = jest.spyOn(subject, 'claimWithGroupPassword').mockResolvedValue(undefined);

      await subject.handleUrlAutoMintIntent();
      await flushPromises();

      expect(subject.state.groupPasswordInput).toBe('claim-code');
      expect(window.location.href).not.toContain('claim-code');
      expect(claimSpy).toHaveBeenCalledWith(
        'claim-code',
        sbtAddress,
        expect.objectContaining({
          sessionSlugOverride: '',
        }),
      );
    } finally {
      window.history.replaceState({}, '', previousHref);
    }
  });

  it('routes unlimited group-password auto-mint URLs to the signature-mint helper', async () => {
    const sbtAddress = '0x0000000000000000000000000000000000000104';
    const previousHref = window.location.href;
    window.history.replaceState(
      {},
      '',
      `${buildSbtDetailPath(sbtAddress)}?sbt=${encodeURIComponent(sbtAddress)}&auto=1&gp=shared-secret`,
    );

    try {
      const subject = createSubject({
        SBTAddress: sbtAddress,
        loginComplete: true,
      });
      subject.state = {
        ...subject.state,
        sbtInfo: { hasPasswordMint: false },
        userHasSBT: false,
        mintingStatus: 'idle',
      };
      jest
        .spyOn(contractScripts, 'getGroupPasswordHash')
        .mockResolvedValue('0x1111111111111111111111111111111111111111111111111111111111111111');
      const mintSpy = jest.spyOn(subject, 'mintUnlimitedWithGroupPassword').mockResolvedValue(undefined);

      await subject.handleUrlAutoMintIntent();
      await flushPromises();

      expect(subject.state.groupPasswordInput).toBe('shared-secret');
      expect(mintSpy).toHaveBeenCalledTimes(1);
    } finally {
      window.history.replaceState({}, '', previousHref);
    }
  });
});
