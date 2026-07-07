import { ethers } from 'ethers';

import SBTPage from './SBTPage';
import SbtPageIdentityPanel from './SbtPageIdentityPanel';
import SbtPageRelevantInfo from './SbtPageRelevantInfo';
import SbtPageStatsSection from './SbtPageStatsSection';
import defaultSbtImage from '../../assets/img/ce_circuit_logo.png';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import { getDisplayImageRenderState } from './sbtPageHelpers';

const mockIsCryptoMode = jest.fn(() => true);
const RESOLVABLE_TREE_COMPONENTS = new Set([SbtPageMoreDetailsSection]);
const resolvedTreeComponentCache = new WeakMap();

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
    return treeIncludesText(node?.props?.children, text);
  }
  return false;
};

const renderIdentityPanelTree = (tree) => {
  const identityPanel = findElementInTree(tree, (element) => element?.type === SbtPageIdentityPanel);
  return identityPanel ? SbtPageIdentityPanel(identityPanel.props) : null;
};

const findActionsSection = (tree) => findElementInTree(tree, (element) => element?.type === SbtPageActionsSection);

const renderStatsSectionTree = (tree) => {
  const statsSection = findElementInTree(tree, (element) => element?.type === SbtPageStatsSection);
  return statsSection ? SbtPageStatsSection(statsSection.props) : null;
};

const renderRelevantInfoTree = (tree) => {
  const relevantInfo = findElementInTree(tree, (element) => element?.type === SbtPageRelevantInfo);
  return relevantInfo ? SbtPageRelevantInfo(relevantInfo.props) : null;
};

describe('SBTPage metadata display', () => {
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
    jest.restoreAllMocks();
  });

  it('shows creator/admin fields without duplicate deployer row in stats', () => {
    const subject = createSubject({
      SBTAddress: '0x00000000000000000000000000000000000000a1',
    });
    subject.state = {
      ...subject.state,
      sbtInfo: {
        name: 'Badge',
        tokenURI: 'ar://HLDsCm3ALbbgjVTCPVLhU8aF9taAdKyD1DyB7A8zkaXM',
        image: 'https://example.example.test/badge.png',
        mintingEndTime: 0,
        burnAuth: 0,
        maxTokens: '0',
        admin: '0x00000000000000000000000000000000000000a2',
        creator: '0x00000000000000000000000000000000000000a3',
      },
      mintedAddresses: [],
      burnedAddresses: [],
      countsLoaded: true,
      loadingMintersBurners: false,
      showStats: true,
    };

    const tree = subject.render();
    expect(treeIncludesText(tree, 'Admin:')).toBe(true);
    expect(treeIncludesText(tree, 'Creator:')).toBe(true);
    expect(treeIncludesText(tree, 'Deployer:')).toBe(false);
  });

  it('hides the docs entry section in UX while keeping the rest of the page visible', () => {
    const subject = createSubject({
      SBTAddress: '0x00000000000000000000000000000000000000a1',
      account: '0x00000000000000000000000000000000000000a4',
    });
    subject.state = {
      ...subject.state,
      sbtInfo: {
        name: 'Badge',
        tokenURI: 'https://arweave.example.test/example',
        image: defaultSbtImage,
        mintingEndTime: 0,
        burnAuth: 0,
        maxTokens: '0',
        admin: '0x00000000000000000000000000000000000000a2',
      },
      mintedAddresses: [],
      burnedAddresses: [],
      countsLoaded: true,
      loadingMintersBurners: false,
      showStats: true,
      showActions: true,
      showMoreDetails: false,
      showAdminSection: false,
      showDocsSection: true,
    };

    const tree = subject.render();
    expect(treeIncludesText(tree, 'DOCS')).toBe(false);
    expect(treeIncludesText(tree, 'MORE')).toBe(true);
  });

  it('keeps idle action feedback from formatting absent transaction hashes', () => {
    const subject = createSubject({
      SBTAddress: '0x00000000000000000000000000000000000000a1',
    });
    subject.state = {
      ...subject.state,
      sbtInfo: {
        name: 'Badge',
        tokenURI: 'https://arweave.example.test/example',
        image: defaultSbtImage,
        mintingEndTime: 0,
        burnAuth: 0,
        maxTokens: '0',
      },
      mintedAddresses: [],
      burnedAddresses: [],
      countsLoaded: true,
      loadingMintersBurners: false,
      showActions: true,
      transactionHash: null,
      lastMintTxHash: null,
      lastBurnTxHash: null,
    };

    expect(() => subject.render()).not.toThrow();
    const actionsSection = findActionsSection(subject.render());
    expect(actionsSection?.props?.actionFeedbackState).toMatchObject({
      showBurnSuccess: false,
      showErrorTransactionHash: false,
      showMintSuccess: false,
      showTransactionError: false,
    });
    expect(actionsSection?.props?.transactionState).toEqual({
      lastBurnTxHash: null,
      lastMintTxHash: null,
      transactionHash: null,
    });
  });

  it('wires extracted full-view handlers back to the parent shell methods', () => {
    const subject = createSubject({
      SBTAddress: '0x00000000000000000000000000000000000000a1',
    });
    subject.copyToClipboard = jest.fn();
    subject.bookmarkSBT = jest.fn();
    subject.toggleStats = jest.fn();
    subject.toggleActions = jest.fn();
    subject.openMintedModal = jest.fn();
    subject.state = {
      ...subject.state,
      sbtInfo: {
        name: 'Badge',
        tokenURI: 'https://arweave.example.test/example',
        image: defaultSbtImage,
        mintingEndTime: 0,
        burnAuth: 0,
        maxTokens: '0',
        admin: '0x00000000000000000000000000000000000000a2',
      },
      mintedAddresses: [],
      burnedAddresses: [],
      countsLoaded: true,
      loadingMintersBurners: false,
      showStats: true,
      showActions: true,
    };

    const tree = subject.render();
    const identityPanel = findElementInTree(tree, (element) => element?.type === SbtPageIdentityPanel);
    const statsSection = findElementInTree(tree, (element) => element?.type === SbtPageStatsSection);
    const actionsSection = findActionsSection(tree);

    identityPanel.props.onContractCopy();
    identityPanel.props.onBookmark();
    statsSection.props.onToggle();
    statsSection.props.onOpenMintedModal();
    actionsSection.props.onToggle();

    expect(subject.copyToClipboard).toHaveBeenCalledWith('0x00000000000000000000000000000000000000a1', 'contract');
    expect(subject.bookmarkSBT).toHaveBeenCalledTimes(1);
    expect(subject.toggleStats).toHaveBeenCalledTimes(1);
    expect(subject.openMintedModal).toHaveBeenCalledTimes(1);
    expect(subject.toggleActions).toHaveBeenCalledTimes(1);
  });

  it('uses Arweave metadata URL for token link when tokenURI is embedded data JSON', () => {
    const txId = 'Sng0VG2vetgNPITw5mtvt6om-fBCNu3KI5GZAYeEttY';
    const dataUriPayload = Buffer.from(JSON.stringify({ metadataUri: `ar://${txId}` }), 'utf8').toString('base64');
    const subject = createSubject({
      SBTAddress: '0x00000000000000000000000000000000000000a1',
    });
    subject.state = {
      ...subject.state,
      sbtInfo: {
        name: 'Badge',
        tokenURI: `data:application/json;base64,${dataUriPayload}`,
        image: 'https://example.example.test/badge.png',
        mintingEndTime: 0,
        burnAuth: 0,
        maxTokens: '0',
        admin: '0x00000000000000000000000000000000000000a2',
      },
      mintedAddresses: [],
      burnedAddresses: [],
      countsLoaded: true,
      loadingMintersBurners: false,
      showStats: true,
    };

    const tree = subject.render();
    const metadataLink = findElementInTree(
      renderIdentityPanelTree(tree),
      (element) => element?.props?.title === 'Open token metadata',
    );

    expect(metadataLink).toBeTruthy();
    expect(metadataLink.props.href).toContain(txId);
    expect(String(metadataLink.props.href || '').startsWith('data:')).toBe(false);
  });

  it('passes resolved token metadata link display state to the identity panel', () => {
    const subject = createSubject({
      SBTAddress: '0x00000000000000000000000000000000000000a1',
    });
    subject.state = {
      ...subject.state,
      sbtInfo: {
        name: 'Badge',
        tokenURI: 'https://example.example.test/metadata/sbt.json',
        image: 'https://example.example.test/badge.png',
        mintingEndTime: 0,
        burnAuth: 0,
        maxTokens: '0',
        admin: '0x00000000000000000000000000000000000000a2',
      },
      mintedAddresses: [],
      burnedAddresses: [],
      countsLoaded: true,
      loadingMintersBurners: false,
      showStats: true,
    };

    const identityPanel = findElementInTree(subject.render(), (element) => element?.type === SbtPageIdentityPanel);
    expect(identityPanel?.props?.tokenUriHref).toBe('https://example.example.test/metadata/sbt.json');

    subject.state = {
      ...subject.state,
      sbtInfo: {
        ...subject.state.sbtInfo,
        tokenURI: 'https://cdn.example.test/preview.png',
      },
    };
    const imageOnlyIdentityPanel = findElementInTree(
      subject.render(),
      (element) => element?.type === SbtPageIdentityPanel,
    );
    expect(imageOnlyIdentityPanel?.props?.tokenUriHref).toBe('');
  });

  it('normalizes subdomain arweave tokenURI links to the preferred gateway URL', () => {
    const txId = 'Sng0VG2vetgNPITw5mtvt6om-fBCNu3KI5GZAYeEttY';
    const subdomainGateway = 'https://nknrqljpprb2ncdidz57t6g5o346sreaimrxm7qp3ybzitf7bvya.arweave.net'; // intentional: real URL - tests allowlist enforcement
    const preferredGateway = 'https://ar-io.dev'; // intentional: real URL - verifies production gateway normalization
    const subdomainUrl = `${subdomainGateway}/${txId}`;
    globalThis.CE_ARWEAVE_DIRECT_TO_AR_IO = true;
    globalThis.CE_ARWEAVE_AR_IO_URL = preferredGateway;
    const subject = createSubject({
      SBTAddress: '0x00000000000000000000000000000000000000a1',
    });
    subject.state = {
      ...subject.state,
      sbtInfo: {
        name: 'Badge',
        tokenURI: subdomainUrl,
        image: 'https://example.example.test/badge.png',
        mintingEndTime: 0,
        burnAuth: 0,
        maxTokens: '0',
        admin: '0x00000000000000000000000000000000000000a2',
      },
      mintedAddresses: [],
      burnedAddresses: [],
      countsLoaded: true,
      loadingMintersBurners: false,
      showStats: true,
    };

    const tree = subject.render();
    const metadataLink = findElementInTree(
      renderIdentityPanelTree(tree),
      (element) => element?.props?.title === 'Open token metadata',
    );

    expect(metadataLink).toBeTruthy();
    expect(metadataLink.props.href).toBe(`${preferredGateway}/${txId}`);
  });

  it('prefers canonical metadata pointer over image-like fields in embedded tokenURI JSON', () => {
    const txId = '4kpvO6qf-tN4l0R9vQh-Sz6ekU2xq9j5qM4R1X3vZkA';
    const dataUriPayload = Buffer.from(
      JSON.stringify({
        metadataUri: `ar://${txId}`,
        external_url: 'https://cdn.example.test/preview.png',
        tokenURI: 'https://cdn.example.test/also-image.jpg',
        uri: 'https://cdn.example.test/banner.webp',
      }),
      'utf8',
    ).toString('base64');
    const subject = createSubject({
      SBTAddress: '0x00000000000000000000000000000000000000a1',
    });
    subject.state = {
      ...subject.state,
      sbtInfo: {
        name: 'Badge',
        tokenURI: `data:application/json;base64,${dataUriPayload}`,
        image: 'https://example.example.test/badge.png',
        mintingEndTime: 0,
        burnAuth: 0,
        maxTokens: '0',
        admin: '0x00000000000000000000000000000000000000a2',
      },
      mintedAddresses: [],
      burnedAddresses: [],
      countsLoaded: true,
      loadingMintersBurners: false,
      showStats: true,
    };

    const tree = subject.render();
    const metadataLink = findElementInTree(
      renderIdentityPanelTree(tree),
      (element) => element?.props?.title === 'Open token metadata',
    );

    expect(metadataLink).toBeTruthy();
    expect(metadataLink.props.href).toContain(txId);
    expect(metadataLink.props.href).not.toContain('preview.png');
    expect(metadataLink.props.href).not.toContain('also-image.jpg');
  });

  it('prefers embedded tokenURI over metadataUri when both are present', () => {
    const sbtTxId = 'GfaX7MhJndTePSYdECj8VJmFQ5m2KDtDMU8fHgUTw24';
    const sessionTxId = 'ue3Ek_Mh1ypNvvCaGlfrntt_8HxJ9CDiwDlG06uoTpY';
    const dataUriPayload = Buffer.from(
      JSON.stringify({
        tokenURI: `ar://${sbtTxId}`,
        metadataUri: `ar://${sessionTxId}`,
        sessionSlug: 'general3',
      }),
      'utf8',
    ).toString('base64');
    const subject = createSubject({
      SBTAddress: '0x00000000000000000000000000000000000000a1',
    });
    subject.state = {
      ...subject.state,
      sbtInfo: {
        name: 'Badge',
        tokenURI: `data:application/json;base64,${dataUriPayload}`,
        image: 'https://example.example.test/badge.png',
        mintingEndTime: 0,
        burnAuth: 0,
        maxTokens: '0',
        admin: '0x00000000000000000000000000000000000000a2',
      },
      mintedAddresses: [],
      burnedAddresses: [],
      countsLoaded: true,
      loadingMintersBurners: false,
      showStats: true,
    };

    const tree = subject.render();
    const metadataLink = findElementInTree(
      renderIdentityPanelTree(tree),
      (element) => element?.props?.title === 'Open token metadata',
    );

    expect(metadataLink).toBeTruthy();
    expect(metadataLink.props.href).toContain(sbtTxId);
    expect(metadataLink.props.href).not.toContain(sessionTxId);
  });

  it('hides metadata icon when embedded tokenURI JSON only contains image-like links', () => {
    const dataUriPayload = Buffer.from(
      JSON.stringify({
        external_url: 'https://cdn.example.test/preview.png',
        tokenURI: 'https://cdn.example.test/also-image.jpg',
        uri: 'https://cdn.example.test/banner.webp',
      }),
      'utf8',
    ).toString('base64');
    const subject = createSubject({
      SBTAddress: '0x00000000000000000000000000000000000000a1',
    });
    subject.state = {
      ...subject.state,
      sbtInfo: {
        name: 'Badge',
        tokenURI: `data:application/json;base64,${dataUriPayload}`,
        image: 'https://example.example.test/badge.png',
        mintingEndTime: 0,
        burnAuth: 0,
        maxTokens: '0',
        admin: '0x00000000000000000000000000000000000000a2',
      },
      mintedAddresses: [],
      burnedAddresses: [],
      countsLoaded: true,
      loadingMintersBurners: false,
      showStats: true,
    };

    const tree = subject.render();
    const metadataLink = findElementInTree(
      renderIdentityPanelTree(tree),
      (element) => element?.props?.title === 'Open token metadata',
    );

    expect(metadataLink).toBeNull();
  });

  it('uses default fallback image when metadata image is missing', () => {
    const subject = createSubject({
      SBTAddress: '0x00000000000000000000000000000000000000a1',
    });
    subject.state = {
      ...subject.state,
      sbtInfo: {
        name: 'Badge',
        tokenURI: 'https://example.example.test/metadata/sbt.json',
        mintingEndTime: 0,
        burnAuth: 0,
        maxTokens: '0',
        admin: '0x00000000000000000000000000000000000000a2',
      },
      mintedAddresses: [],
      burnedAddresses: [],
      countsLoaded: true,
      loadingMintersBurners: false,
      showStats: true,
    };

    const tree = subject.render();
    const sbtImage = findElementInTree(
      renderIdentityPanelTree(tree),
      (element) => element?.type === 'img' && element?.props?.alt === 'Badge',
    );

    expect(sbtImage).toBeTruthy();
    expect(sbtImage.props.src).toBe(defaultSbtImage);
  });

  it('falls back to the default badge when the preferred Arweave image URL fails', () => {
    const txId = 'DqYBh1qm9GvaTOGkF5R7abnLoB3OPiXNNBcTsYPtlRc';
    const preferredGateway = 'https://arweave.net'; // intentional: real URL - verifies production gateway fallback order
    const arIoSubdomainGateway = 'https://b2tadb22u32gxwsm4gsbpfd3ng44xia5zy7cltjuc4j3da7nsulq.ar-io.dev'; // intentional: real URL - verifies AR.IO subdomain parsing
    globalThis.CE_ARWEAVE_DIRECT_TO_AR_IO = true;
    const subject = createSubject({
      SBTAddress: '0x00000000000000000000000000000000000000a1',
    });
    subject.state = {
      ...subject.state,
      sbtInfo: {
        name: 'Badge',
        tokenURI: `ar://${txId}`,
        image: `${arIoSubdomainGateway}/${txId}?`,
        mintingEndTime: 0,
        burnAuth: 0,
        maxTokens: '0',
        admin: '0x00000000000000000000000000000000000000a2',
      },
      mintedAddresses: [],
      burnedAddresses: [],
      countsLoaded: true,
      loadingMintersBurners: false,
      showStats: true,
    };

    const firstAttempt = getDisplayImageRenderState(subject.state.sbtInfo, subject.state, defaultSbtImage);
    expect(firstAttempt.src).toBe(`${preferredGateway}/${txId}`);

    subject.handleDisplayImageError(firstAttempt);
    subject.handleDisplayImageError(firstAttempt);

    expect(subject.state.displayImageFallbackIndex).toBe(1);

    const tree = subject.render();
    const sbtImage = findElementInTree(
      renderIdentityPanelTree(tree),
      (element) => element?.props?.['data-testid'] === E2E_TESTIDS.SBT_PAGE_IMAGE,
    );

    expect(sbtImage).toBeTruthy();
    expect(sbtImage.props.src).toBe(defaultSbtImage);
  });

  it('returns N/A for zero/invalid actor addresses', () => {
    const subject = createSubject();
    expect(subject.renderAddressLink(ethers.constants.AddressZero, 'admin')).toBe('N/A');
    expect(subject.renderAddressLink('not-an-address', 'admin')).toBe('N/A');
  });

  it('preserves PUBLIC_URL for actor and metadata links', () => {
    const previousPublicUrl = process.env.PUBLIC_URL;
    process.env.PUBLIC_URL = '/ce/';

    try {
      const subject = createSubject();
      const actorAddress = '0x00000000000000000000000000000000000000a2';
      const actorTree = subject.renderAddressLink(actorAddress, 'admin');
      const actorLink = findElementInTree(
        actorTree,
        (element) => element?.type === 'a' && element?.props?.href?.includes('/u/'),
      );

      expect(actorLink?.props?.href).toBe(`/ce/u/${actorAddress}`);

      subject.state = {
        ...subject.state,
        sbtInfo: {
          documentIDHashes: ['doc hash'],
          tags: ['AI Policy'],
        },
      };
      const metadataTree = renderRelevantInfoTree(subject.renderRelevantInfo());
      const docLink = findElementInTree(
        metadataTree,
        (element) => element?.type === 'a' && element?.props?.href?.includes('/doc/'),
      );
      const tagLink = findElementInTree(
        metadataTree,
        (element) => element?.type === 'a' && element?.props?.href?.includes('/tag/'),
      );

      expect(docLink?.props?.href).toBe('/ce/doc/doc%20hash');
      expect(tagLink?.props?.href).toBe('/ce/tag/AI%20Policy');
    } finally {
      if (previousPublicUrl === undefined) delete process.env.PUBLIC_URL;
      else process.env.PUBLIC_URL = previousPublicUrl;
    }
  });
});
