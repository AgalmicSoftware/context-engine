// Focused SBTPage holder-modal render coverage owns modal row display, spinners, and filtered-holder preservation.
import { render, screen } from '@testing-library/react';
import SBTPage from './SBTPage';
import styles from './SBTPage.module.scss';
import { renderSbtPageHolderModal } from './SBTPageModals';
import * as contractScriptsModule from '../../utilities/web3/contractScripts.js';
import { getShortenedAddress } from '../../utilities/ui/displayHelpers.js';

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

const findElementInTree = (node, predicate) => {
  if (!node || typeof node !== 'object') return null;
  if (predicate(node)) return node;
  const rendered = renderResolvableComponent(node);
  if (rendered !== null) {
    const found = findElementInTree(rendered, predicate);
    if (found) return found;
    return null;
  }
  const children = node?.props?.children;
  if (Array.isArray(children)) {
    for (const child of children) {
      const found = findElementInTree(child, predicate);
      if (found) return found;
    }
    return null;
  }
  if (children) return findElementInTree(children, predicate);
  return null;
};

const treeIncludesText = (node, text) => {
  if (node == null) return false;
  if (typeof node === 'string' || typeof node === 'number') {
    return String(node).includes(text);
  }
  if (Array.isArray(node)) {
    return node.some((entry) => treeIncludesText(entry, text));
  }
  if (typeof node === 'object') {
    const rendered = renderResolvableComponent(node);
    if (rendered !== null) return treeIncludesText(rendered, text);
    return treeIncludesText(node?.props?.children, text);
  }
  return false;
};

const getNodeTypeName = (node) => {
  const type = node?.type;
  if (!type) return '';
  if (typeof type === 'string') return type;
  return String(type.displayName || type.name || '');
};

const RESOLVABLE_SBT_PAGE_COMPONENTS = new Set([
  'SbtPageHolderStatusDisplay',
  'SbtPageIdentityPanel',
  'SbtPageStatsSection',
]);

const resolvedComponentCache = new WeakMap();

const renderResolvableComponent = (node) => {
  const typeName = getNodeTypeName(node);
  if (!RESOLVABLE_SBT_PAGE_COMPONENTS.has(typeName)) return null;
  if (typeof node?.type !== 'function') return null;
  if (resolvedComponentCache.has(node)) return resolvedComponentCache.get(node);
  const rendered = node.type(node.props || {});
  resolvedComponentCache.set(node, rendered);
  return rendered;
};

describe('SBTPage holder modal rendering', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    window.sessionStorage.clear();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('passes holders-modal defaultFeaturedSBTs into SBTFilter', () => {
    const subject = createSubject({
      sessionSlug: 'rxc',
      SBTAddress: '0x00000000000000000000000000000000000000cc',
      match: { params: { address: '0x00000000000000000000000000000000000000bb' } },
    });
    subject.state = {
      ...subject.state,
      sbtAddress: '0x00000000000000000000000000000000000000aa',
      resolvedSessionSlug: 'rxc',
      sbtInfo: {
        name: 'Badge',
        tokenURI: 'ar://HLDsCm3ALbbgjVTCPVLhU8aF9taAdKyD1DyB7A8zkaXM',
        mintingEndTime: 0,
        burnAuth: 0,
        maxTokens: '0',
        admin: '0x00000000000000000000000000000000000000a2',
      },
      mintedAddresses: [],
      burnedAddresses: [],
      countsLoaded: true,
      loadingMintersBurners: false,
      showModal: true,
    };

    const tree = subject.render();
    const sbtFilterNode = findElementInTree(
      tree,
      (element) => element?.props?.mode === 'addresses' && Array.isArray(element?.props?.items),
    );

    expect(sbtFilterNode).toBeTruthy();
    expect(sbtFilterNode.props.defaultFeaturedSBTs).toEqual(subject.getSessionSBTAddresses());
  });

  it('passes resolved state network into holders-modal SBTFilter when props.network is missing', () => {
    const subject = createSubject({
      sessionSlug: 'rxc',
      SBTAddress: '0x00000000000000000000000000000000000000cc',
      network: undefined,
    });
    subject.state = {
      ...subject.state,
      network: { id: 84532, name: 'Base Sepolia' },
      resolvedSessionSlug: 'rxc',
      sbtInfo: {
        name: 'Badge',
        tokenURI: 'ar://HLDsCm3ALbbgjVTCPVLhU8aF9taAdKyD1DyB7A8zkaXM',
        mintingEndTime: 0,
        burnAuth: 0,
        maxTokens: '0',
        admin: '0x00000000000000000000000000000000000000a2',
      },
      mintedAddresses: [],
      burnedAddresses: [],
      countsLoaded: true,
      loadingMintersBurners: false,
      showModal: true,
    };

    const tree = subject.render();
    const sbtFilterNode = findElementInTree(
      tree,
      (element) => element?.props?.mode === 'addresses' && Array.isArray(element?.props?.items),
    );

    expect(sbtFilterNode).toBeTruthy();
    expect(sbtFilterNode.props.network).toEqual(expect.objectContaining({ id: 84532 }));
  });

  it('renders the holders filter in the modal title row with a light button surface', () => {
    const holderAddress = '0x00000000000000000000000000000000000000b1';
    const tree = renderSbtPageHolderModal({
      isOpen: true,
      onClose: jest.fn(),
      showHeaderCount: true,
      holdersDisplayCount: '1',
      showCornerSpinner: false,
      holderItemsForFilter: [holderAddress],
      provider: 'mock',
      network: { id: 84532 },
      sessionSlug: 'rxc',
      defaultFeaturedSBTs: [],
      onFilter: jest.fn(),
      isSBTCacheReady: true,
      sbtCacheRevision: 1,
      loadingMintedFilter: false,
      hasFilteredHolders: true,
      hasComputedHolders: true,
      showScanProgressInModal: false,
      scanProgressText: '',
      scanProgressSessionText: '',
      scanProgressPct: 0,
      scanProgressFillStyle: {},
      showEmptyStateInModal: false,
      showApproximateCountHint: false,
      showSpinnerInModalBody: false,
      filteredMintedUsers: [holderAddress],
      copiedAddress: '',
      copyToClipboard: jest.fn(),
      getExplorerUrl: () => 'https://explorer.example/address',
    });
    const modalHeader = findElementInTree(tree, (element) => element?.props?.className === styles.modalHeader);
    const modalBody = findElementInTree(tree, (element) => element?.props?.className === styles.modalBody);
    const headerFilter = findElementInTree(
      modalHeader,
      (element) => element?.props?.mode === 'addresses' && Array.isArray(element?.props?.items),
    );
    const bodyFilter = findElementInTree(
      modalBody,
      (element) => element?.props?.mode === 'addresses' && Array.isArray(element?.props?.items),
    );

    expect(headerFilter).toBeTruthy();
    expect(headerFilter.props.buttonSurface).toBe('light');
    expect(bodyFilter).toBeNull();
  });

  it('preserves PUBLIC_URL for holder modal user links', () => {
    const previousPublicUrl = process.env.PUBLIC_URL;
    process.env.PUBLIC_URL = '/ce/';

    try {
      const holderAddress = '0x00000000000000000000000000000000000000b1';
      render(
        renderSbtPageHolderModal({
          isOpen: true,
          onClose: jest.fn(),
          showHeaderCount: true,
          holdersDisplayCount: '1',
          showCornerSpinner: false,
          holderItemsForFilter: [holderAddress],
          provider: 'mock',
          network: { id: 84532 },
          sessionSlug: 'rxc',
          defaultFeaturedSBTs: [],
          onFilter: jest.fn(),
          isSBTCacheReady: true,
          sbtCacheRevision: 1,
          loadingMintedFilter: false,
          hasFilteredHolders: true,
          hasComputedHolders: true,
          showScanProgressInModal: false,
          scanProgressText: '',
          scanProgressSessionText: '',
          scanProgressPct: 0,
          scanProgressFillStyle: {},
          showEmptyStateInModal: false,
          showApproximateCountHint: false,
          showSpinnerInModalBody: false,
          filteredMintedUsers: [holderAddress],
          copiedAddress: '',
          copyToClipboard: jest.fn(),
          getExplorerUrl: () => 'https://explorer.example/address',
        }),
      );

      expect(screen.getByRole('link', { name: getShortenedAddress(holderAddress, false) })).toHaveAttribute(
        'href',
        `/ce/u/${holderAddress}`,
      );
    } finally {
      if (previousPublicUrl === undefined) delete process.env.PUBLIC_URL;
      else process.env.PUBLIC_URL = previousPublicUrl;
    }
  });

  it('clears modal loading even when filtered-list signature is unchanged', () => {
    const subject = createSubject();
    const baseline = ['0xabc'];

    subject.state = {
      ...subject.state,
      filteredMintedUsers: baseline,
      filteredMintedUsersSignature: subject.buildAddressListSignature(baseline),
      loadingMintedFilter: true,
    };

    subject.handleModalFilteredMintedUsers(['0xABC']);

    expect(subject.setState).toHaveBeenCalledWith({ loadingMintedFilter: false });
    expect(subject.state.loadingMintedFilter).toBe(false);
  });

  it('preserves visible holder rows during refresh callbacks with transient empty results', () => {
    const subject = createSubject();
    const baseline = ['0xabc'];
    subject.state = {
      ...subject.state,
      filteredMintedUsers: baseline,
      filteredMintedUsersSignature: subject.buildAddressListSignature(baseline),
      loadingMintersBurners: true,
      loadingMintedFilter: false,
    };

    subject.handleModalFilteredMintedUsers([]);

    expect(subject.setState).not.toHaveBeenCalled();
    expect(subject.state.filteredMintedUsers).toEqual(['0xabc']);
  });

  it('stops feeding stale filtered holders back into filter items once empty counts settle', () => {
    const subject = createSubject({
      SBTAddress: '0x00000000000000000000000000000000000000a1',
    });
    subject.state = {
      ...subject.state,
      sbtInfo: {
        name: 'Badge',
        tokenURI: 'ar://HLDsCm3ALbbgjVTCPVLhU8aF9taAdKyD1DyB7A8zkaXM',
        mintingEndTime: 0,
        burnAuth: 0,
        maxTokens: '0',
        admin: '0x00000000000000000000000000000000000000a2',
      },
      mintedAddresses: [],
      burnedAddresses: [],
      countsLoaded: true,
      filteredMintedUsers: ['0x00000000000000000000000000000000000000b1'],
      filteredMintedUsersSignature: '1:0x00000000000000000000000000000000000000b1',
      loadingMintersBurners: false,
      loadingMintedFilter: false,
    };

    const tree = subject.render();
    const sbtFilterNode = findElementInTree(
      tree,
      (element) => element?.props?.mode === 'addresses' && Array.isArray(element?.props?.items),
    );

    expect(sbtFilterNode).toBeTruthy();
    expect(sbtFilterNode.props.items).toEqual([]);
  });

  it('settles holders modal when override exists but holder addresses never resolve', () => {
    const subject = createSubject({
      SBTAddress: '0x00000000000000000000000000000000000000a1',
    });
    subject.state = {
      ...subject.state,
      sbtInfo: {
        name: 'Badge',
        tokenURI: 'ar://HLDsCm3ALbbgjVTCPVLhU8aF9taAdKyD1DyB7A8zkaXM',
        mintingEndTime: 0,
        burnAuth: 0,
        maxTokens: '0',
        admin: '0x00000000000000000000000000000000000000a2',
      },
      mintedAddresses: [],
      burnedAddresses: [],
      countsLoaded: true,
      mintedTokensOverride: '25',
      filteredMintedUsers: [],
      filteredMintedUsersSignature: '',
      loadingMintersBurners: false,
      loadingMintedFilter: false,
      showModal: true,
    };

    const tree = subject.render();
    const modalSpinner = findElementInTree(
      tree,
      (element) => element?.props?.spin === true && element?.props?.size === '2x',
    );

    expect(modalSpinner).toBeNull();
    expect(treeIncludesText(tree, 'Holder addresses not available yet. Showing approximate count only.')).toBe(true);
    expect(treeIncludesText(tree, '~25')).toBe(true);
  });

  it('prefers scan loading over approximate-count hint while a holder scan is active', () => {
    const subject = createSubject({
      SBTAddress: '0x00000000000000000000000000000000000000a1',
      sbtScanInProgress: true,
    });
    subject.state = {
      ...subject.state,
      sbtInfo: {
        name: 'Badge',
        tokenURI: 'ar://HLDsCm3ALbbgjVTCPVLhU8aF9taAdKyD1DyB7A8zkaXM',
        mintingEndTime: 0,
        burnAuth: 0,
        maxTokens: '0',
        admin: '0x00000000000000000000000000000000000000a2',
      },
      mintedAddresses: [],
      burnedAddresses: [],
      countsLoaded: true,
      mintedTokensOverride: '25',
      filteredMintedUsers: [],
      filteredMintedUsersSignature: '',
      loadingMintersBurners: false,
      loadingMintedFilter: false,
      logScanProgress: null,
      showModal: true,
    };

    const tree = subject.render();

    expect(treeIncludesText(tree, 'Holder addresses not available yet. Showing approximate count only.')).toBe(false);
    expect(treeIncludesText(tree, '~25')).toBe(true);
    expect(
      findElementInTree(tree, (element) => element?.props?.spin === true && element?.props?.size === '2x'),
    ).toBeTruthy();
  });

  it('shows holders modal scan progress during initial loading', () => {
    jest.spyOn(contractScriptsModule, 'getSessionConfigBySlugOrDefault').mockReturnValue({
      slug: 'edge',
      sessionName: 'Edge Session',
      blockLimits: { start: 1000, end: null },
      defaultFeaturedSBTs: [],
      featured_SBTs_LIST: [],
    });
    const subject = createSubject({
      SBTAddress: '0x00000000000000000000000000000000000000a1',
      sessionSlug: 'edge',
    });
    subject.state = {
      ...subject.state,
      sbtInfo: {
        name: 'Badge',
        tokenURI: 'ar://HLDsCm3ALbbgjVTCPVLhU8aF9taAdKyD1DyB7A8zkaXM',
        mintingEndTime: 0,
        burnAuth: 0,
        maxTokens: '0',
        admin: '0x00000000000000000000000000000000000000a2',
      },
      mintedAddresses: [],
      burnedAddresses: [],
      countsLoaded: false,
      filteredMintedUsers: [],
      filteredMintedUsersSignature: '',
      loadingMintersBurners: true,
      loadingMintedFilter: false,
      logScanProgress: {
        phase: 'activity',
        scannedBlocks: 25,
        totalBlocks: 100,
        fromBlock: 1000,
        toBlock: 1099,
      },
      showModal: true,
      showStats: false,
    };

    const tree = subject.render();
    const progressBar = findElementInTree(tree, (element) => element?.props?.role === 'progressbar');
    const modalSpinner = findElementInTree(
      tree,
      (element) => element?.props?.spin === true && element?.props?.size === '2x',
    );

    expect(progressBar).toBeTruthy();
    expect(treeIncludesText(tree, 'Scanning mint/burn history: 75 blocks remaining')).toBe(true);
    expect(treeIncludesText(tree, '(blocks 1,000-1,099)')).toBe(false);
    expect(treeIncludesText(tree, 'Session: Edge Session')).toBe(true);
    expect(modalSpinner).toBeTruthy();
  });

  it('uses parent session scan progress in the holders modal when local progress is absent', () => {
    jest.spyOn(contractScriptsModule, 'getSessionConfigBySlugOrDefault').mockReturnValue({
      slug: 'edge',
      sessionName: 'Edge Session',
      blockLimits: { start: 1000, end: null },
      defaultFeaturedSBTs: [],
      featured_SBTs_LIST: [],
    });
    const subject = createSubject({
      SBTAddress: '0x00000000000000000000000000000000000000a1',
      sessionSlug: 'edge',
      sbtScanInProgress: true,
      sbtScanProgress: {
        currentBlock: 1600,
        latestBlock: 2000,
      },
    });
    subject.state = {
      ...subject.state,
      sbtInfo: {
        name: 'Badge',
        tokenURI: 'ar://HLDsCm3ALbbgjVTCPVLhU8aF9taAdKyD1DyB7A8zkaXM',
        mintingEndTime: 0,
        burnAuth: 0,
        maxTokens: '0',
        admin: '0x00000000000000000000000000000000000000a2',
      },
      mintedAddresses: [],
      burnedAddresses: [],
      countsLoaded: false,
      filteredMintedUsers: [],
      filteredMintedUsersSignature: '',
      loadingMintersBurners: false,
      loadingMintedFilter: false,
      logScanProgress: null,
      showModal: true,
      showStats: false,
    };

    const tree = subject.render();
    const progressBar = findElementInTree(tree, (element) => element?.props?.role === 'progressbar');

    expect(progressBar).toBeTruthy();
    expect(treeIncludesText(tree, 'Scanning mint/burn history: 400 blocks remaining')).toBe(true);
    expect(treeIncludesText(tree, '(blocks 1,000-2,000)')).toBe(false);
    expect(treeIncludesText(tree, 'Session: Edge Session')).toBe(true);
  });

  it('stops showing modal scan spinners once holder scan progress reaches zero remaining blocks', () => {
    const subject = createSubject({
      SBTAddress: '0x00000000000000000000000000000000000000a1',
      sessionSlug: 'edge',
      sbtScanInProgress: true,
    });
    subject.state = {
      ...subject.state,
      sbtInfo: {
        name: 'Badge',
        tokenURI: 'ar://HLDsCm3ALbbgjVTCPVLhU8aF9taAdKyD1DyB7A8zkaXM',
        mintingEndTime: 0,
        burnAuth: 0,
        maxTokens: '0',
        admin: '0x00000000000000000000000000000000000000a2',
      },
      mintedAddresses: ['0x00000000000000000000000000000000000000b1'],
      burnedAddresses: [],
      countsLoaded: true,
      filteredMintedUsers: ['0x00000000000000000000000000000000000000b1'],
      filteredMintedUsersSignature: '',
      loadingMintersBurners: false,
      loadingMintedFilter: false,
      logScanProgress: {
        totalBlocks: 100,
        scannedBlocks: 100,
        remainingBlocks: 0,
        fromBlock: 1000,
        toBlock: 1099,
        currentBlock: 1099,
        latestBlock: 1099,
      },
      showModal: true,
      showStats: false,
    };

    const tree = subject.render();
    const progressBar = findElementInTree(tree, (element) => element?.props?.role === 'progressbar');
    const headerSpinner = findElementInTree(tree, (element) => element?.props?.className === styles.cornerSpinner);

    expect(treeIncludesText(tree, 'Scanning mint/burn history:')).toBe(false);
    expect(progressBar).toBeNull();
    expect(headerSpinner).toBeNull();
  });

  it('renders the modal header spinner inside the stacked title area while a holder scan is active', () => {
    const subject = createSubject({
      SBTAddress: '0x00000000000000000000000000000000000000a1',
      sessionSlug: 'edge',
    });
    subject.state = {
      ...subject.state,
      sbtInfo: {
        name: 'Badge',
        tokenURI: 'ar://HLDsCm3ALbbgjVTCPVLhU8aF9taAdKyD1DyB7A8zkaXM',
        mintingEndTime: 0,
        burnAuth: 0,
        maxTokens: '0',
        admin: '0x00000000000000000000000000000000000000a2',
      },
      mintedAddresses: ['0x00000000000000000000000000000000000000b1'],
      burnedAddresses: [],
      countsLoaded: true,
      filteredMintedUsers: ['0x00000000000000000000000000000000000000b1'],
      filteredMintedUsersSignature: '',
      loadingMintersBurners: false,
      loadingMintedFilter: false,
      logScanProgress: {
        totalBlocks: 120,
        scannedBlocks: 80,
        remainingBlocks: 40,
        fromBlock: 1000,
        toBlock: 1119,
      },
      showModal: true,
      showStats: false,
    };

    const tree = subject.render();
    const titleStack = findElementInTree(tree, (element) => element?.props?.className === styles.modalTitleStack);
    const spinnerRow = findElementInTree(tree, (element) => element?.props?.className === styles.modalTitleSpinnerRow);
    const headerSpinner = findElementInTree(
      titleStack,
      (element) => element?.props?.className === styles.cornerSpinner,
    );

    expect(titleStack).toBeTruthy();
    expect(spinnerRow).toBeTruthy();
    expect(headerSpinner).toBeTruthy();
  });

  it('shows holders modal scan progress while stale holder rows remain visible during refresh', () => {
    const subject = createSubject({
      SBTAddress: '0x00000000000000000000000000000000000000a1',
    });
    const holderAddress = '0x00000000000000000000000000000000000000b1';
    subject.state = {
      ...subject.state,
      sbtInfo: {
        name: 'Badge',
        tokenURI: 'ar://HLDsCm3ALbbgjVTCPVLhU8aF9taAdKyD1DyB7A8zkaXM',
        mintingEndTime: 0,
        burnAuth: 0,
        maxTokens: '0',
        admin: '0x00000000000000000000000000000000000000a2',
      },
      mintedAddresses: [holderAddress],
      burnedAddresses: [],
      countsLoaded: true,
      filteredMintedUsers: [holderAddress],
      filteredMintedUsersSignature: subject.buildAddressListSignature([holderAddress]),
      loadingMintersBurners: true,
      loadingMintedFilter: false,
      logScanProgress: {
        phase: 'activity',
        scannedBlocks: 40,
        totalBlocks: 80,
        fromBlock: 2000,
        toBlock: 2079,
      },
      showModal: true,
      showStats: false,
    };

    const tree = subject.render();
    const progressBar = findElementInTree(tree, (element) => element?.props?.role === 'progressbar');
    expect(progressBar).toBeTruthy();
    expect(treeIncludesText(tree, 'Scanning mint/burn history: 40 blocks remaining')).toBe(true);
    expect(treeIncludesText(tree, '(blocks 2,000-2,079)')).toBe(false);
    expect(treeIncludesText(tree, getShortenedAddress(holderAddress, false))).toBe(true);
    expect(treeIncludesText(tree, 'No holders found.')).toBe(false);
  });

  it('keeps holders modal scan progress visible while modal loading is still unresolved', () => {
    const subject = createSubject({
      SBTAddress: '0x00000000000000000000000000000000000000a1',
    });
    subject.state = {
      ...subject.state,
      sbtInfo: {
        name: 'Badge',
        tokenURI: 'ar://HLDsCm3ALbbgjVTCPVLhU8aF9taAdKyD1DyB7A8zkaXM',
        mintingEndTime: 0,
        burnAuth: 0,
        maxTokens: '0',
        admin: '0x00000000000000000000000000000000000000a2',
      },
      mintedAddresses: [],
      burnedAddresses: [],
      countsLoaded: false,
      filteredMintedUsers: [],
      filteredMintedUsersSignature: '',
      loadingMintersBurners: false,
      loadingMintedFilter: true,
      logScanProgress: {
        phase: 'activity',
        scannedBlocks: 10,
        totalBlocks: 20,
      },
      showModal: true,
      showStats: false,
    };

    const tree = subject.render();
    const progressBar = findElementInTree(tree, (element) => element?.props?.role === 'progressbar');

    expect(progressBar).toBeTruthy();
    expect(treeIncludesText(tree, 'Scanning mint/burn history: 10 blocks remaining')).toBe(true);
  });

  it('preserves visible holder rows when parent session scan is still active and the filter emits empty', () => {
    const subject = createSubject({
      sessionSlug: 'edge',
      sbtScanInProgress: true,
      sbtScanProgress: {
        currentBlock: 1600,
        latestBlock: 2000,
      },
    });
    const baseline = ['0xabc'];
    subject.state = {
      ...subject.state,
      filteredMintedUsers: baseline,
      filteredMintedUsersSignature: subject.buildAddressListSignature(baseline),
      loadingMintersBurners: false,
      loadingMintedFilter: false,
    };

    subject.handleModalFilteredMintedUsers([]);

    expect(subject.setState).not.toHaveBeenCalled();
    expect(subject.state.filteredMintedUsers).toEqual(['0xabc']);
  });

  it('shows holders modal empty state after an unresolved refresh settles without progress', () => {
    const subject = createSubject({
      SBTAddress: '0x00000000000000000000000000000000000000a1',
    });
    subject.state = {
      ...subject.state,
      sbtInfo: {
        name: 'Badge',
        tokenURI: 'ar://HLDsCm3ALbbgjVTCPVLhU8aF9taAdKyD1DyB7A8zkaXM',
        mintingEndTime: 0,
        burnAuth: 0,
        maxTokens: '0',
        admin: '0x00000000000000000000000000000000000000a2',
      },
      mintedAddresses: [],
      burnedAddresses: [],
      countsLoaded: false,
      mintedTokensOverride: null,
      filteredMintedUsers: [],
      filteredMintedUsersSignature: '',
      loadingMintersBurners: false,
      loadingMintedFilter: false,
      logScanProgress: null,
      showModal: true,
      showStats: false,
    };

    const tree = subject.render();
    const spinner = findElementInTree(tree, (element) => element?.props?.spin === true);

    expect(treeIncludesText(tree, 'No holders found.')).toBe(true);
    expect(treeIncludesText(tree, 'Scanning mint/burn history:')).toBe(false);
    expect(spinner).toBeNull();
  });

  it('stops showing the minted loading spinner once unresolved holder refresh state settles', () => {
    const subject = createSubject({
      SBTAddress: '0x00000000000000000000000000000000000000a1',
    });
    subject.state = {
      ...subject.state,
      sbtInfo: {
        name: 'Badge',
        tokenURI: 'ar://HLDsCm3ALbbgjVTCPVLhU8aF9taAdKyD1DyB7A8zkaXM',
        mintingEndTime: 0,
        burnAuth: 0,
        maxTokens: '0',
        admin: '0x00000000000000000000000000000000000000a2',
      },
      mintedAddresses: [],
      burnedAddresses: [],
      countsLoaded: false,
      mintedTokensOverride: null,
      filteredMintedUsers: [],
      filteredMintedUsersSignature: '',
      loadingMintersBurners: false,
      loadingMintedFilter: false,
      logScanProgress: null,
      showModal: false,
      showStats: true,
    };

    const tree = subject.render();
    const spinner = findElementInTree(tree, (element) => element?.props?.spin === true);

    expect(treeIncludesText(tree, '0 / ∞')).toBe(true);
    expect(spinner).toBeNull();
  });

  it('renders the full detail page after fallback metadata resolves even without holder data', () => {
    const subject = createSubject({
      SBTAddress: '0x00000000000000000000000000000000000000a1',
    });
    subject.state = {
      ...subject.state,
      sbtInfo: {
        name: 'Name Only SBT',
        symbol: 'CE-SBT-38',
        tokenURI: 'ar://kcejtnnZ1GhyhjFfPAiLeX3Jaw0dXwhNnkCZ0zB1EuE',
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
      mintedTokensOverride: null,
      filteredMintedUsers: [],
      filteredMintedUsersSignature: '',
      loadingMintersBurners: false,
      loadingMintedFilter: false,
      logScanProgress: null,
      showModal: false,
      showStats: true,
    };

    const tree = subject.render();

    expect(treeIncludesText(tree, 'Loading SBT Details')).toBe(false);
    expect(treeIncludesText(tree, 'Name Only SBT')).toBe(true);
    expect(treeIncludesText(tree, '0 / ∞')).toBe(true);
  });

  it('re-seeds modal holder rows on every open before triggering refresh', () => {
    const subject = createSubject();
    subject.loadSBTInfo = jest.fn();
    subject.state = {
      ...subject.state,
      mintedAddresses: ['0xabc', '0xdef'],
      burnedAddresses: ['0xdef'],
      filteredMintedUsers: [],
      filteredMintedUsersSignature: '',
      mintingAddressesFilterInitialized: true,
      showModal: false,
    };

    subject.openMintedModal();

    expect(subject.state.showModal).toBe(true);
    expect(subject.state.filteredMintedUsers).toEqual(['0xabc']);
    expect(subject.loadSBTInfo).toHaveBeenCalledWith({
      forceEventFetch: true,
      preferCountsOnly: true,
    });
  });
});
