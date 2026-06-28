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
import {
  SbtPageBurnActionSurface,
  SbtPageMintActionSurface,
} from './SbtPageFullActionButtons';
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
