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
    window.history.replaceState({}, '', `${buildSbtDetailPath(sbtAddress)}?sbt=${encodeURIComponent(sbtAddress)}&auto=1`);

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

      expect(publicMintSpy).toHaveBeenCalledWith(sbtAddress, expect.objectContaining({
        sessionSlugOverride: '',
      }));
      expect(window.sessionStorage.getItem(buildSbtPageAutoMintStorageKey({
        chainId: 84532,
        sessionSlug: 'general',
        sbtAddress,
      }))).toBe('done');
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
    window.history.replaceState({}, '', `${buildSbtDetailPath(sbtAddress, { sessionSlug: 'edge' })}?sbt=${encodeURIComponent(sbtAddress)}&auto=1`);

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
    window.history.replaceState({}, '', `${buildSbtDetailPath(sbtAddress, { sessionSlug: 'edge' })}?sbt=${encodeURIComponent(sbtAddress)}&auto=1`);

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
      expect(window.sessionStorage.getItem(successKey)).toBeNull();
    } finally {
      window.history.replaceState({}, '', previousHref);
    }
  });

  it('sends public URL auto-mints to the captured SBT even if route props change before mint', async () => {
    const sbtAddress = '0x0000000000000000000000000000000000000108';
    const nextSbtAddress = '0x0000000000000000000000000000000000000109';
    const previousHref = window.location.href;
    const successKey = buildSbtPageAutoMintStorageKey({
      chainId: 84532,
      sessionSlug: 'edge',
      sbtAddress,
    });
    window.history.replaceState({}, '', `${buildSbtDetailPath(sbtAddress, { sessionSlug: 'edge' })}?sbt=${encodeURIComponent(sbtAddress)}&auto=1`);

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
        .mockImplementation(async () => {
          subject.props = { ...subject.props, SBTAddress: nextSbtAddress };
          return '0x0000000000000000000000000000000000000000000000000000000000000000';
        });
      jest.spyOn(contractScripts, 'claim').mockResolvedValue({ transactionHash: '0xpublicmint' });
      jest.spyOn(subject, 'loadSBTInfo').mockResolvedValue(undefined);

      const result = await subject.handleUrlAutoMintIntent();

      expect(result).toBe(true);
      expect(contractScripts.claim).toHaveBeenCalledWith('mock', sbtAddress);
      expect(contractScripts.claim).not.toHaveBeenCalledWith('mock', nextSbtAddress);
      expect(window.sessionStorage.getItem(successKey)).toBe('done');
    } finally {
      window.history.replaceState({}, '', previousHref);
    }
  });

  it('sends group-password URL auto-mints to the captured SBT even if route props change before mint', async () => {
    const sbtAddress = '0x0000000000000000000000000000000000000110';
    const nextSbtAddress = '0x0000000000000000000000000000000000000111';
    const previousHref = window.location.href;
    const onchainHash = `0x${'11'.repeat(32)}`;
    const successKey = buildSbtPageAutoMintStorageKey({
      chainId: 84532,
      sessionSlug: 'edge',
      sbtAddress,
    });
    window.history.replaceState({}, '', `${buildSbtDetailPath(sbtAddress, { sessionSlug: 'edge' })}?sbt=${encodeURIComponent(sbtAddress)}&gp=claim-code&auto=1`);

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
          subject.props = { ...subject.props, SBTAddress: nextSbtAddress };
          return onchainHash;
        })
        .mockResolvedValue(onchainHash);
      jest.spyOn(cryptoUtils, 'resolveGroupPasswordWalletScopeAddress').mockReturnValue(sbtAddress);
      jest.spyOn(contractScripts, 'computeGroupPasswordHash').mockReturnValue(onchainHash);
      jest.spyOn(contractScripts, 'signGroupMintAuthorization').mockResolvedValue('0xsig');
      jest.spyOn(contractScripts, 'mintWithGroupSignature').mockResolvedValue({ transactionHash: '0xgroupmint' });
      jest.spyOn(subject, 'loadSBTInfo').mockResolvedValue(undefined);

      const result = await subject.handleUrlAutoMintIntent();

      expect(result).toBe(true);
      expect(contractScripts.signGroupMintAuthorization).toHaveBeenCalledWith(expect.objectContaining({
        password: 'claim-code',
        sbtAddress,
      }));
      expect(contractScripts.mintWithGroupSignature).toHaveBeenCalledWith('mock', sbtAddress, '0xsig');
      expect(contractScripts.mintWithGroupSignature).not.toHaveBeenCalledWith('mock', nextSbtAddress, '0xsig');
      expect(window.sessionStorage.getItem(successKey)).toBe('done');
    } finally {
      window.history.replaceState({}, '', previousHref);
    }
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
    jest.spyOn(subject, 'loadSBTInfo').mockResolvedValue(undefined);
    const refreshSpy = jest.spyOn(subject, 'refreshSbtDataWithSlug').mockReturnValue(undefined);

    const result = await subject.claimWithInvitePayload(
      { nonce: '1', signature: '0xsig' },
      sbtAddress,
      { sessionSlugOverride: 'edge' },
    );

    expect(result.ok).toBe(true);
    expect(contractScripts.claimWithInvite).toHaveBeenCalledWith('mock', sbtAddress, '1', '0xsig');
    expect(refreshSpy).toHaveBeenCalledWith(sbtAddress, undefined, 'edge');
    expect(refreshSpy).not.toHaveBeenCalledWith(nextSbtAddress, undefined, 'next');
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

  it('routes invite auto-mint URLs to invite claiming on the dedicated page', async () => {
    const sbtAddress = '0x0000000000000000000000000000000000000102';
    const previousHref = window.location.href;
    window.history.replaceState(
      {},
      '',
      `${buildSbtDetailPath(sbtAddress)}?sbt=${encodeURIComponent(sbtAddress)}&auto=1&inv=invite-token`
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
      expect(inviteSpy).toHaveBeenCalledWith('invite-token', sbtAddress, expect.objectContaining({
        sessionSlugOverride: '',
      }));
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
      `${buildSbtDetailPath(sbtAddress)}?sbt=${encodeURIComponent(sbtAddress)}&auto=1&gp=claim-code`
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
      expect(claimSpy).toHaveBeenCalledWith('claim-code', sbtAddress, expect.objectContaining({
        sessionSlugOverride: '',
      }));
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
      `${buildSbtDetailPath(sbtAddress)}?sbt=${encodeURIComponent(sbtAddress)}&auto=1&gp=shared-secret`
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
