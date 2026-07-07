import {
  SBTPage,
  ethers,
  contractScripts,
  contractScriptsModule,
  cacheScripts,
  render,
  createSubject,
  treeIncludesText,
  createReadCachePayload,
  setupSBTPageTestLifecycle,
} from './SBTPage.testUtils';
import { SbtPageBurnActionSurface, SbtPageMintActionSurface } from './SbtPageFullActionButtons';
import SbtPageMintInputAction from './SbtPageMintInputAction';
import SbtPageStatusActionButton from './SbtPageStatusActionButton';
import { notify } from '../../utilities/ui/notify.js';

const renderBurnActionSurfaceTree = (tree) => {
  const surface = findElementInTree(tree, (node) => node?.type === SbtPageBurnActionSurface);
  expect(surface).not.toBeNull();
  return SbtPageBurnActionSurface(surface.props);
};

const renderMintActionSurfaceTree = (tree) => {
  const surface = findElementInTree(tree, (node) => node?.type === SbtPageMintActionSurface);
  expect(surface).not.toBeNull();
  return SbtPageMintActionSurface(surface.props);
};

describe('SBTPage session routing and holder loading', () => {
  setupSBTPageTestLifecycle();

  it('does not mark an address copied when clipboard write rejects', async () => {
    const subject = createSubject();
    const originalClipboardDescriptor = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
    const writeText = jest.fn().mockRejectedValue(new Error('clipboard denied'));
    const warnSpy = jest.spyOn(notify, 'warn').mockImplementation(() => undefined);
    const successSpy = jest.spyOn(notify, 'success').mockImplementation(() => undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });

    try {
      await subject.copyToClipboard('0x0000000000000000000000000000000000000001', 'admin');

      expect(writeText).toHaveBeenCalledWith('0x0000000000000000000000000000000000000001');
      expect(warnSpy).toHaveBeenCalledWith('Copy failed');
      expect(successSpy).not.toHaveBeenCalled();
      expect(subject.state.copiedAddress).toBeNull();
    } finally {
      if (originalClipboardDescriptor) {
        Object.defineProperty(navigator, 'clipboard', originalClipboardDescriptor);
      } else {
        delete navigator.clipboard;
      }
    }
  });

  it('does not mark an error copied when error clipboard write rejects', async () => {
    const subject = createSubject();
    subject.state = {
      ...subject.state,
      error: 'Mint failed: denied',
    };
    const originalClipboardDescriptor = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
    const writeText = jest.fn().mockRejectedValue(new Error('clipboard denied'));
    const warnSpy = jest.spyOn(notify, 'warn').mockImplementation(() => undefined);
    const successSpy = jest.spyOn(notify, 'success').mockImplementation(() => undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });

    try {
      await subject.copyErrorToClipboard();

      expect(writeText).toHaveBeenCalledWith('Mint failed: denied');
      expect(warnSpy).toHaveBeenCalledWith('Copy failed');
      expect(successSpy).not.toHaveBeenCalled();
      expect(subject.state.copiedError).not.toBe(true);
    } finally {
      if (originalClipboardDescriptor) {
        Object.defineProperty(navigator, 'clipboard', originalClipboardDescriptor);
      } else {
        delete navigator.clipboard;
      }
    }
  });

  it('restarts the minting countdown after SBT address context changes', () => {
    jest.useFakeTimers();
    const clearIntervalSpy = jest.spyOn(global, 'clearInterval');
    try {
      const subject = createSubject({
        SBTAddress: '0x00000000000000000000000000000000000000aa',
      });
      subject.loadSBTInfo = jest.fn();
      subject.checkForMintPassword = jest.fn();
      subject.getActiveBlockTimeMs = jest.fn(() => 1000);
      const previousIntervalId = setInterval(() => {}, 1000);
      subject.state = {
        ...subject.state,
        intervalId: previousIntervalId,
      };
      const prevProps = subject.props;
      subject.props = {
        ...subject.props,
        SBTAddress: '0x00000000000000000000000000000000000000bb',
      };

      subject.componentDidUpdate(prevProps);

      expect(subject.loadSBTInfo).toHaveBeenCalledTimes(1);
      expect(subject.checkForMintPassword).toHaveBeenCalledTimes(1);
      expect(clearIntervalSpy).toHaveBeenCalledWith(previousIntervalId);
      expect(subject.state.intervalId).toBeTruthy();
      expect(subject.state.intervalId).not.toBe(previousIntervalId);
    } finally {
      jest.useRealTimers();
    }
  });

  it('clears stored minting countdown interval state after expiry', () => {
    jest.useFakeTimers();
    try {
      const subject = createSubject();
      subject.getActiveBlockTimeMs = jest.fn(() => 1000);
      subject.state = {
        ...subject.state,
        sbtInfo: {
          mintingEndTime: Math.floor(Date.now() / 1000) - 1,
        },
      };

      subject.startMintingEndCountdown();
      expect(subject.state.intervalId).toBeTruthy();

      jest.advanceTimersByTime(1000);

      expect(subject.state.intervalId).toBeNull();
      expect(subject.state.mintCountdown).toBeNull();
    } finally {
      jest.useRealTimers();
    }
  });

  it('uses sessionSlug routing only when metadata marks it explicit', () => {
    const subject = createSubject();
    expect(
      subject.resolveSessionSlugFromInfo({
        sessionSlug: 'beta',
        sessionSlugExplicit: false,
      }),
    ).toBe(null);
    expect(
      subject.resolveSessionSlugFromInfo({
        sessionSlug: 'beta',
        sessionSlugExplicit: true,
      }),
    ).toBe('beta');
    expect(
      subject.resolveSessionSlugFromInfo({
        sessionSlug: 'beta',
      }),
    ).toBe('beta');
  });

  it('builds session SBT addresses from current context and session config', () => {
    const sessionConfigFixture = {
      defaultFeaturedSBTs: ['0x00000000000000000000000000000000000000d1'],
      featured_SBTs_LIST: ['0x00000000000000000000000000000000000000D2'],
    };
    const sessionConfigSpy = jest
      .spyOn(contractScriptsModule, 'getSessionConfigBySlugOrDefault')
      .mockReturnValue(sessionConfigFixture);

    const subject = createSubject({
      sessionSlug: 'rxc',
      SBTAddress: '0x00000000000000000000000000000000000000cc',
      match: { params: { address: '0x00000000000000000000000000000000000000bb' } },
    });
    subject.state = {
      ...subject.state,
      sbtAddress: '0x00000000000000000000000000000000000000aa',
      resolvedSessionSlug: 'rxc',
    };

    const addresses = subject.getSessionSBTAddresses();
    const cachedAddresses = subject.getSessionSBTAddresses();
    expect(addresses).toEqual(
      expect.arrayContaining([
        '0x00000000000000000000000000000000000000aa',
        '0x00000000000000000000000000000000000000bb',
        '0x00000000000000000000000000000000000000cc',
        '0x00000000000000000000000000000000000000d1',
        '0x00000000000000000000000000000000000000d2',
      ]),
    );
    expect(cachedAddresses).toBe(addresses);
    expect(sessionConfigSpy).toHaveBeenCalledWith('rxc');
    expect(sessionConfigSpy).toHaveBeenCalledTimes(2);
    expect(addresses.every((entry) => entry === entry.toLowerCase())).toBe(true);
    expect(addresses.length).toBe(new Set(addresses).size);
  });

  it('uses explicit demo-session featured lists for display-only SBT context when registry config is missing', () => {
    jest.spyOn(contractScriptsModule, 'getSessionConfigBySlugOrDefault').mockReturnValue(null);
    const demoConfigSpy = jest.spyOn(contractScriptsModule, 'getDemoSessionConfigBySlug').mockReturnValue({
      defaultFeaturedSBTs: ['0x00000000000000000000000000000000000000f1'],
      featured_SBTs_LIST: ['0x00000000000000000000000000000000000000F2'],
    });

    const subject = createSubject({
      sessionSlug: 'edge',
      SBTAddress: '0x00000000000000000000000000000000000000cc',
    });
    subject.state = {
      ...subject.state,
      resolvedSessionSlug: 'edge',
    };

    const addresses = subject.getSessionSBTAddresses();

    expect(addresses).toEqual(
      expect.arrayContaining([
        '0x00000000000000000000000000000000000000cc',
        '0x00000000000000000000000000000000000000f1',
        '0x00000000000000000000000000000000000000f2',
      ]),
    );
    expect(demoConfigSpy).toHaveBeenCalledWith('edge', { allowDemoFallback: true });
  });

  it('invalidates session SBT address cache when session config changes for the same slug', () => {
    const sessionConfigSpy = jest
      .spyOn(contractScriptsModule, 'getSessionConfigBySlugOrDefault')
      .mockReturnValueOnce({
        defaultFeaturedSBTs: ['0x00000000000000000000000000000000000000d1'],
        featured_SBTs_LIST: [],
      })
      .mockReturnValueOnce({
        defaultFeaturedSBTs: ['0x00000000000000000000000000000000000000e1'],
        featured_SBTs_LIST: [],
      });

    const subject = createSubject({
      sessionSlug: 'rxc',
      SBTAddress: '0x00000000000000000000000000000000000000cc',
      match: { params: { address: '0x00000000000000000000000000000000000000bb' } },
    });
    subject.state = {
      ...subject.state,
      sbtAddress: '0x00000000000000000000000000000000000000aa',
      resolvedSessionSlug: 'rxc',
    };

    const firstAddresses = subject.getSessionSBTAddresses();
    const secondAddresses = subject.getSessionSBTAddresses();

    expect(firstAddresses).toContain('0x00000000000000000000000000000000000000d1');
    expect(firstAddresses).not.toContain('0x00000000000000000000000000000000000000e1');
    expect(secondAddresses).toContain('0x00000000000000000000000000000000000000e1');
    expect(secondAddresses).not.toContain('0x00000000000000000000000000000000000000d1');
    expect(secondAddresses).not.toBe(firstAddresses);
    expect(sessionConfigSpy).toHaveBeenCalledTimes(2);
    expect(sessionConfigSpy).toHaveBeenCalledWith('rxc');
  });

  it('routes owner burn button clicks through the parent burn handler', () => {
    const subject = createSubject({
      account: '0x00000000000000000000000000000000000000a1',
    });
    subject.state = {
      ...subject.state,
      burningStatus: 'idle',
      sbtInfo: {
        burnAuth: 1,
      },
      userHasSBT: true,
    };
    subject.handleBurn = jest.fn();

    const tree = subject.renderFullActionSurfaces().burnButton;
    const burnTree = renderBurnActionSurfaceTree(tree);
    const burnButton = findElementInTree(burnTree, (node) => node?.type === SbtPageStatusActionButton);

    expect(burnButton).not.toBeNull();
    burnButton.props.onClick({ preventDefault: jest.fn() });
    expect(subject.handleBurn).toHaveBeenCalledTimes(1);
  });

  it('allows owner burn when burnAuth is a numeric string', async () => {
    const account = '0x00000000000000000000000000000000000000a1';
    const sbtAddress = '0x00000000000000000000000000000000000000b1';
    const tokenIdSpy = jest.spyOn(contractScripts, 'getSBTTokenIdByOwner').mockResolvedValue('7');
    const burnSpy = jest.spyOn(contractScripts, 'burnToken').mockResolvedValue({ transactionHash: '0xburn' });
    const subject = createSubject({
      account,
      provider: 'wagmi',
      SBTAddress: sbtAddress,
    });
    subject.state = {
      ...subject.state,
      sbtInfo: {
        burnAuth: '1',
      },
      userHasSBT: true,
    };
    subject.loadSBTInfo = jest.fn(async () => undefined);
    subject.cacheTransactionHash = jest.fn();
    subject.applyLocalBurnSuccess = jest.fn();
    subject.refreshSbtDataWithSlug = jest.fn();

    await subject.handleBurn();

    expect(tokenIdSpy).toHaveBeenCalledWith('none', sbtAddress, account, '');
    expect(burnSpy).toHaveBeenCalledWith('wagmi', sbtAddress, '7');
    expect(subject.applyLocalBurnSuccess).toHaveBeenCalledWith(account);
    expect(subject.state.burningStatus).toBe('success');
  });

  it('uses neutral provider reads for mini burn while burning with the wallet provider', async () => {
    const account = '0x00000000000000000000000000000000000000a1';
    const sbtAddress = '0x00000000000000000000000000000000000000b2';
    const tokenIdSpy = jest.spyOn(contractScripts, 'getSBTTokenIdByOwner').mockResolvedValue('8');
    const burnSpy = jest.spyOn(contractScripts, 'burnToken').mockResolvedValue({ transactionHash: '0xminiburn' });
    const subject = createSubject({
      account,
      provider: 'wagmi',
      SBTAddress: sbtAddress,
    });
    subject.loadSBTInfo = jest.fn(async () => undefined);
    subject.cacheTransactionHash = jest.fn();
    subject.applyLocalBurnSuccess = jest.fn();
    subject.refreshSbtDataWithSlug = jest.fn();

    await subject.miniBurnHandler();

    expect(tokenIdSpy).toHaveBeenCalledWith('none', sbtAddress, account, '');
    expect(burnSpy).toHaveBeenCalledWith('wagmi', sbtAddress, '8');
    expect(subject.applyLocalBurnSuccess).toHaveBeenCalledWith(account);
  });

  it('uses neutral provider reads for burn target searches', async () => {
    const ownerAddress = '0x00000000000000000000000000000000000000c1';
    const sbtAddress = '0x00000000000000000000000000000000000000b3';
    const tokenIdSpy = jest.spyOn(contractScripts, 'getSBTTokenIdByOwner').mockResolvedValue('9');
    const ownerSpy = jest.spyOn(contractScripts, 'getOwnerByTokenId').mockResolvedValue(ownerAddress);
    const subject = createSubject({
      provider: 'wagmi',
      SBTAddress: sbtAddress,
    });

    await subject.performBurnSearch(ownerAddress);
    await subject.performBurnSearch('9');

    expect(tokenIdSpy).toHaveBeenCalledWith('none', sbtAddress, ownerAddress, '');
    expect(ownerSpy).toHaveBeenCalledWith('none', sbtAddress, '9', '');
  });

  it('routes open mint button clicks through the parent mint handler with force refresh', () => {
    const subject = createSubject({
      account: '0x00000000000000000000000000000000000000a1',
    });
    subject.state = {
      ...subject.state,
      burningStatus: 'idle',
      hasGroupPasswordMint: false,
      hasInviteMint: false,
      mintStep: 0,
      mintingStatus: 'idle',
      sbtInfo: {
        hasPasswordMint: false,
        mintingEndTime: 0,
      },
      userHasSBT: false,
    };
    subject.handleMint = jest.fn();

    const tree = subject.renderFullActionSurfaces().mintButton;
    const mintTree = renderMintActionSurfaceTree(tree);
    const mintButton = findElementInTree(mintTree, (node) => node?.type === SbtPageStatusActionButton);

    expect(mintButton).not.toBeNull();
    mintButton.props.onClick({ preventDefault: jest.fn() });
    expect(subject.handleMint).toHaveBeenCalledTimes(1);
    expect(subject.handleMint).toHaveBeenCalledWith(true);
  });

  it('opens the prior open-mint transaction instead of dispatching another mint', () => {
    const mintTxHash = '0x1111111111111111111111111111111111111111111111111111111111111111';
    const subject = createSubject({
      account: '0x00000000000000000000000000000000000000a1',
    });
    subject.state = {
      ...subject.state,
      burningStatus: 'idle',
      hasGroupPasswordMint: false,
      hasInviteMint: false,
      lastMintTxHash: mintTxHash,
      mintStep: 0,
      mintingStatus: 'success',
      sbtInfo: {
        hasPasswordMint: false,
        mintingEndTime: 0,
      },
      userHasSBT: false,
    };
    subject.handleMint = jest.fn();
    const openSpy = jest.spyOn(window, 'open').mockImplementation(() => null);

    const tree = subject.renderFullActionSurfaces().mintButton;
    const mintTree = renderMintActionSurfaceTree(tree);
    const mintButton = findElementInTree(mintTree, (node) => node?.type === SbtPageStatusActionButton);

    expect(mintButton).not.toBeNull();
    expect(mintButton.props.title).toBe('View collect transaction');
    mintButton.props.onClick({ preventDefault: jest.fn() });

    expect(openSpy).toHaveBeenCalledWith(
      `https://sepolia.etherscan.io/tx/${mintTxHash}`,
      '_blank',
      'noopener,noreferrer',
    );
    expect(subject.handleMint).not.toHaveBeenCalled();
    openSpy.mockRestore();
  });

  it('routes manual claim start and finish buttons through the parent mint handler with force refresh', () => {
    const subject = createSubject({
      account: '0x00000000000000000000000000000000000000a1',
    });
    subject.state = {
      ...subject.state,
      burningStatus: 'idle',
      hasGroupPasswordMint: false,
      hasInviteMint: false,
      manualPasswordInput: 'claim-code',
      mintStep: 0,
      mintingStatus: 'idle',
      sbtInfo: {
        hasPasswordMint: true,
        mintingEndTime: 0,
      },
      userHasSBT: false,
    };
    subject.handleMint = jest.fn();

    const startTree = subject.renderFullActionSurfaces().mintButton;
    const startSurfaceTree = renderMintActionSurfaceTree(startTree);
    const startAction = findElementInTree(startSurfaceTree, (node) => node?.type === SbtPageMintInputAction);
    expect(startAction).not.toBeNull();
    expect(startAction.props.placeholder).toBe('Claim Code');
    expect(startAction.props.contentState.label).toBe('Start Claim');
    startAction.props.onAction({ preventDefault: jest.fn() });

    subject.state = {
      ...subject.state,
      mintStep: 2,
    };
    const finishTree = subject.renderFullActionSurfaces().mintButton;
    const finishSurfaceTree = renderMintActionSurfaceTree(finishTree);
    const finishAction = findElementInTree(finishSurfaceTree, (node) => node?.type === SbtPageMintInputAction);
    expect(finishAction).not.toBeNull();
    expect(finishAction.props.placeholder).toBe('Claim Code');
    expect(finishAction.props.contentState.label).toBe('Finish Claim');
    finishAction.props.onAction({ preventDefault: jest.fn() });

    expect(subject.handleMint).toHaveBeenCalledTimes(2);
    expect(subject.handleMint).toHaveBeenNthCalledWith(1, true);
    expect(subject.handleMint).toHaveBeenNthCalledWith(2, true);
  });

  it('keeps pending manual claim disabled and inert in the full mint view', () => {
    const subject = createSubject({
      account: '0x00000000000000000000000000000000000000a1',
    });
    subject.state = {
      ...subject.state,
      burningStatus: 'idle',
      hasGroupPasswordMint: false,
      hasInviteMint: false,
      manualPasswordInput: 'claim-code',
      mintStep: 0,
      mintingStatus: 'pending',
      sbtInfo: {
        hasPasswordMint: true,
        mintingEndTime: 0,
      },
      userHasSBT: false,
    };
    subject.handleMint = jest.fn();

    const tree = subject.renderFullActionSurfaces().mintButton;
    const mintTree = renderMintActionSurfaceTree(tree);
    const claimAction = findElementInTree(mintTree, (node) => node?.type === SbtPageMintInputAction);

    expect(claimAction).not.toBeNull();
    expect(claimAction.props.disabled).toBe(true);
    expect(claimAction.props.inputValue).toBe('claim-code');
    expect(claimAction.props.contentState).toMatchObject({
      label: 'Start Claim',
      shouldRenderLabel: false,
      shouldRenderPendingIcon: true,
    });

    claimAction.props.onAction({ preventDefault: jest.fn() });

    expect(subject.handleMint).not.toHaveBeenCalled();
  });

  it('renders manual claim countdown as status-only full-view content', () => {
    const subject = createSubject({
      account: '0x00000000000000000000000000000000000000a1',
    });
    subject.state = {
      ...subject.state,
      burningStatus: 'idle',
      claimCountdown: 12,
      hasGroupPasswordMint: false,
      hasInviteMint: false,
      manualPasswordInput: 'claim-code',
      mintStep: 1,
      mintingStatus: 'idle',
      sbtInfo: {
        hasPasswordMint: true,
        mintingEndTime: 0,
      },
      userHasSBT: false,
    };
    subject.handleMint = jest.fn();

    const tree = subject.renderFullActionSurfaces().mintButton;
    const mintTree = renderMintActionSurfaceTree(tree);

    expect(flattenText(mintTree)).toContain('Waiting period: 12 seconds');
    expect(findElementInTree(mintTree, (node) => node?.type === SbtPageMintInputAction)).toBeNull();
    expect(findElementInTree(mintTree, (node) => node?.type === SbtPageStatusActionButton)).toBeNull();
    expect(subject.handleMint).not.toHaveBeenCalled();
  });

  it('blocks open mint execution at login when no account is connected', async () => {
    const toggleLoginModal = jest.fn();
    const subject = createSubject({
      account: '',
      toggleLoginModal,
    });
    subject.state = {
      ...subject.state,
      burningStatus: 'idle',
      hasGroupPasswordMint: false,
      hasInviteMint: false,
      mintStep: 0,
      mintingStatus: 'idle',
      sbtInfo: {
        hasPasswordMint: false,
        mintingEndTime: 0,
      },
      userHasSBT: false,
    };
    const claimSpy = jest.spyOn(contractScripts, 'claim').mockResolvedValue({ transactionHash: '0xmint' });

    const result = await subject.handleMint(true);

    expect(result).toBe(false);
    expect(toggleLoginModal).toHaveBeenCalledWith(true);
    expect(claimSpy).not.toHaveBeenCalled();
  });

  it('keeps pending full-view group-password joins disabled and inert', () => {
    const subject = createSubject({
      account: '0x00000000000000000000000000000000000000a1',
    });
    subject.state = {
      ...subject.state,
      burningStatus: 'idle',
      groupPasswordInput: 'group-code',
      hasGroupPasswordMint: true,
      hasInviteMint: false,
      mintStep: 0,
      mintingStatus: 'pending',
      sbtInfo: {
        hasPasswordMint: false,
        mintingEndTime: 0,
      },
      userHasSBT: false,
    };
    subject.mintUnlimitedWithGroupPassword = jest.fn();

    const tree = subject.renderFullActionSurfaces().mintButton;
    const mintTree = renderMintActionSurfaceTree(tree);
    const groupPasswordAction = findElementInTree(mintTree, (node) => node?.type === SbtPageMintInputAction);

    expect(groupPasswordAction).not.toBeNull();
    expect(groupPasswordAction.props.disabled).toBe(true);
    expect(groupPasswordAction.props.placeholder).toBe('Group Password');
    expect(groupPasswordAction.props.inputValue).toBe('group-code');
    expect(groupPasswordAction.props.contentState).toMatchObject({
      label: 'Join',
      shouldRenderLabel: false,
      shouldRenderPendingIcon: true,
    });

    groupPasswordAction.props.onAction({ preventDefault: jest.fn() });

    expect(subject.mintUnlimitedWithGroupPassword).not.toHaveBeenCalled();
  });

  it('routes full-view invite joins through the parent invite handler with the current input', () => {
    const subject = createSubject({
      account: '0x00000000000000000000000000000000000000a1',
    });
    subject.state = {
      ...subject.state,
      burningStatus: 'idle',
      groupPasswordInput: 'invite-code',
      hasGroupPasswordMint: false,
      hasInviteMint: true,
      mintStep: 0,
      mintingStatus: 'idle',
      sbtInfo: {
        hasPasswordMint: false,
        mintingEndTime: 0,
      },
      userHasSBT: false,
    };
    subject.claimWithInviteCode = jest.fn();

    const tree = subject.renderFullActionSurfaces().mintButton;
    const mintTree = renderMintActionSurfaceTree(tree);
    const inviteAction = findElementInTree(mintTree, (node) => node?.type === SbtPageMintInputAction);

    expect(inviteAction).not.toBeNull();
    expect(inviteAction.props.disabled).toBe(false);
    expect(inviteAction.props.placeholder).toBe('Group Password');

    inviteAction.props.onAction({ preventDefault: jest.fn() });

    expect(subject.claimWithInviteCode).toHaveBeenCalledTimes(1);
    expect(subject.claimWithInviteCode).toHaveBeenCalledWith('invite-code');
  });

  it('keeps holders modal refresh log-driven and shows approximate counts without ownerOf fan-out', async () => {
    const sbtAddress = '0x00000000000000000000000000000000000000a1';
    const sbtLower = sbtAddress.toLowerCase();
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

    jest.spyOn(cacheScripts, 'readCache').mockResolvedValueOnce(initialEntry).mockResolvedValueOnce(refreshedEntry);
    const refreshSpy = jest.fn().mockResolvedValue(undefined);
    jest.spyOn(contractScripts, 'getSbtHistorySummary').mockResolvedValue({
      totalMinted: '2',
      totalBurned: '0',
      activeSupply: '2',
      currentHolderCount: '2',
      historicalHolderCount: '2',
    });
    const groupPasswordSpy = jest
      .spyOn(contractScripts, 'getGroupPasswordHash')
      .mockResolvedValue(ethers.constants.HashZero);
    const ownerSpy = jest
      .spyOn(contractScripts, 'getOwnerByTokenId')
      .mockResolvedValue('0x00000000000000000000000000000000000000b1');

    const subject = createSubject({
      SBTAddress: sbtAddress,
      sessionSlug: 'edge',
      refreshSbtData: refreshSpy,
    });
    subject.state = {
      ...subject.state,
      network: { id: 84532, name: 'Base Sepolia' },
      showModal: true,
      groupPasswordHash: ethers.constants.HashZero,
      groupPasswordHashLoaded: true,
    };

    await subject.loadSBTInfo({ forceEventFetch: true, preferCountsOnly: true });

    expect(refreshSpy).toHaveBeenCalledWith(
      sbtAddress,
      'edge',
      expect.objectContaining({ forceCounts: true, countsOnly: true }),
    );
    expect(groupPasswordSpy).not.toHaveBeenCalled();
    expect(ownerSpy).not.toHaveBeenCalled();
    expect(subject.state.mintedAddresses).toEqual([]);
    expect(subject.state.mintedTokensOverride).toBe('2');

    const tree = subject.render();
    expect(treeIncludesText(tree, '~2')).toBe(true);
    expect(treeIncludesText(tree, 'No holders found.')).toBe(false);
  });
});
