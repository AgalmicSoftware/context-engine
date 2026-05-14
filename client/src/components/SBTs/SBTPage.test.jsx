import SBTPage from './SBTPage';
import styles from './SBTPage.module.scss';
import { ethers } from 'ethers';
import contractScripts from '../../utilities/web3/contractScripts.js';
import * as contractScriptsModule from '../../utilities/web3/contractScripts.js';
import * as cacheScripts from '../../utilities/cache/cacheScripts.js';
import proposalScripts from '../../utilities/proposalScripts.js';
import defaultSbtImage from '../../assets/img/ce_circuit_logo.png';
import { cryptoUtils } from 'utilities/crypto/cryptography.js';
import { litStorage } from 'utilities/crypto/litProtocol.js';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import {
  SBT_PASSWORD_RECOVERY_KIND,
  SBT_PASSWORD_RECOVERY_STORAGE_KEY,
} from '../../utilities/sbt/sbtPasswordRecoveryStore.js';
import { getDisplayImageRenderState } from './sbtPageHelpers';
import { render, screen } from '@testing-library/react';

// Remaining broad SBTPage coverage owns holders-modal refresh, metadata hydration,
// ownerOf fallback, cache writes, password recovery, and gated mint flows.
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

const flattenText = (node) => {
  if (node == null) return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map((entry) => flattenText(entry)).join('');
  if (typeof node === 'object') return flattenText(node?.props?.children);
  return '';
};

const mockObjectUrlApis = (blobUrl = 'blob:mock') => {
  const originalCreateObjectURL = URL.createObjectURL;
  const originalRevokeObjectURL = URL.revokeObjectURL;
  const createObjectURL = jest.fn(() => blobUrl);
  const revokeObjectURL = jest.fn();
  URL.createObjectURL = createObjectURL;
  URL.revokeObjectURL = revokeObjectURL;
  return {
    createObjectURL,
    revokeObjectURL,
    restore: () => {
      URL.createObjectURL = originalCreateObjectURL;
      URL.revokeObjectURL = originalRevokeObjectURL;
    },
  };
};

const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0));
const createDeferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

const createCachedSbtInfo = (overrides = {}) => ({
  tokenURI: 'ar://HLDsCm3ALbbgjVTCPVLhU8aF9taAdKyD1DyB7A8zkaXM',
  image: 'https://example.example.test/badge.png',
  mintingEndTime: 0,
  burnAuth: 0,
  hasPasswordMint: false,
  maxTokens: '0',
  admin: '0x00000000000000000000000000000000000000a2',
  chainID: 84532,
  ...overrides,
});

const createReadCachePayload = ({
  sbtAddress,
  mintedAddresses = [],
  burnedAddresses = [],
  countsLoaded = false,
  blockNumber = 1234,
  netId = '84532',
  lastBlock = blockNumber,
  sbtInfoOverrides = {},
}) => {
  const sbtLower = sbtAddress.toLowerCase();
  return {
    [netId]: {
      sbtList: {
        [sbtLower]: {
          sbtAddress,
          sbtInfo: createCachedSbtInfo(sbtInfoOverrides),
          mintedAddresses,
          burnedAddresses,
          countsLoaded,
          blockNumber,
        },
      },
      lastBlock,
    },
  };
};

describe('SBTPage modal holder optimizations', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    window.sessionStorage.clear();
    jest.spyOn(contractScripts, 'getSbtHistorySummary').mockResolvedValue(null);
  });

  afterEach(() => {
    try { delete globalThis.CE_ARWEAVE_GATEWAY_URL; } catch (_) {}
    try { delete globalThis.CE_ARWEAVE_AR_IO_URL; } catch (_) {}
    try { delete globalThis.CE_ARWEAVE_DIRECT_TO_AR_IO; } catch (_) {}
    try { delete window.__litHooks; } catch (_) {}
    jest.restoreAllMocks();
  });

  it('clears previous burn search result when the input is cleared', () => {
    const subject = createSubject();
    subject.state = {
      ...subject.state,
      burnSearchInput: '0xabc',
      burnSearchResult: { address: '0xabc', tokenId: '12' },
      burnSearchType: 'address',
    };

    subject.handleBurnSearchChange({ target: { value: '' } });

    expect(subject.state).toEqual(expect.objectContaining({
      burnSearchInput: '',
      burnSearchResult: null,
      burnSearchType: null,
    }));
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

  it('uses Arweave metadata URL for token link when tokenURI is embedded data JSON', () => {
    const txId = 'Sng0VG2vetgNPITw5mtvt6om-fBCNu3KI5GZAYeEttY';
    const dataUriPayload = Buffer
      .from(JSON.stringify({ metadataUri: `ar://${txId}` }), 'utf8')
      .toString('base64');
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
      tree,
      (element) => element?.props?.title === 'Open token metadata'
    );

    expect(metadataLink).toBeTruthy();
    expect(metadataLink.props.href).toContain(txId);
    expect(String(metadataLink.props.href || '').startsWith('data:')).toBe(false);
  });

  it('normalizes subdomain arweave tokenURI links to the preferred gateway URL', () => {
    const txId = 'Sng0VG2vetgNPITw5mtvt6om-fBCNu3KI5GZAYeEttY';
    const subdomainGateway = 'https://nknrqljpprb2ncdidz57t6g5o346sreaimrxm7qp3ybzitf7bvya.arweave.net'; // intentional: real URL — tests allowlist enforcement
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
      tree,
      (element) => element?.props?.title === 'Open token metadata'
    );

    expect(metadataLink).toBeTruthy();
    expect(metadataLink.props.href).toBe(`${preferredGateway}/${txId}`);
  });

  it('prefers canonical metadata pointer over image-like fields in embedded tokenURI JSON', () => {
    const txId = '4kpvO6qf-tN4l0R9vQh-Sz6ekU2xq9j5qM4R1X3vZkA';
    const dataUriPayload = Buffer.from(JSON.stringify({
      metadataUri: `ar://${txId}`,
      external_url: 'https://cdn.example.test/preview.png',
      tokenURI: 'https://cdn.example.test/also-image.jpg',
      uri: 'https://cdn.example.test/banner.webp',
    }), 'utf8').toString('base64');
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
      tree,
      (element) => element?.props?.title === 'Open token metadata'
    );

    expect(metadataLink).toBeTruthy();
    expect(metadataLink.props.href).toContain(txId);
    expect(metadataLink.props.href).not.toContain('preview.png');
    expect(metadataLink.props.href).not.toContain('also-image.jpg');
  });

  it('prefers embedded tokenURI over metadataUri when both are present', () => {
    const sbtTxId = 'GfaX7MhJndTePSYdECj8VJmFQ5m2KDtDMU8fHgUTw24';
    const sessionTxId = 'ue3Ek_Mh1ypNvvCaGlfrntt_8HxJ9CDiwDlG06uoTpY';
    const dataUriPayload = Buffer.from(JSON.stringify({
      tokenURI: `ar://${sbtTxId}`,
      metadataUri: `ar://${sessionTxId}`,
      sessionSlug: 'general3',
    }), 'utf8').toString('base64');
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
      tree,
      (element) => element?.props?.title === 'Open token metadata'
    );

    expect(metadataLink).toBeTruthy();
    expect(metadataLink.props.href).toContain(sbtTxId);
    expect(metadataLink.props.href).not.toContain(sessionTxId);
  });

  it('hides metadata icon when embedded tokenURI JSON only contains image-like links', () => {
    const dataUriPayload = Buffer.from(JSON.stringify({
      external_url: 'https://cdn.example.test/preview.png',
      tokenURI: 'https://cdn.example.test/also-image.jpg',
      uri: 'https://cdn.example.test/banner.webp',
    }), 'utf8').toString('base64');
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
      tree,
      (element) => element?.props?.title === 'Open token metadata'
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
      tree,
      (element) => element?.type === 'img' && element?.props?.alt === 'Badge'
    );

    expect(sbtImage).toBeTruthy();
    expect(sbtImage.props.src).toBe(defaultSbtImage);
  });

  it('falls back to the next Arweave gateway when the preferred image URL fails', () => {
    const txId = 'DqYBh1qm9GvaTOGkF5R7abnLoB3OPiXNNBcTsYPtlRc';
    const canonicalArweaveGateway = 'https://arweave.net'; // intentional: real URL — tests allowlist enforcement
    const preferredGateway = 'https://ar-io.dev'; // intentional: real URL - verifies production gateway fallback order
    const arIoSubdomainGateway = 'https://b2tadb22u32gxwsm4gsbpfd3ng44xia5zy7cltjuc4j3da7nsulq.ar-io.dev'; // intentional: real URL - verifies AR.IO subdomain parsing
    globalThis.CE_ARWEAVE_DIRECT_TO_AR_IO = true;
    globalThis.CE_ARWEAVE_AR_IO_URL = preferredGateway;
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
      tree,
      (element) => element?.props?.['data-testid'] === E2E_TESTIDS.SBT_PAGE_IMAGE
    );

    expect(sbtImage).toBeTruthy();
    expect(sbtImage.props.src).toBe(`${canonicalArweaveGateway}/${txId}`);
  });

  it('returns N/A for zero/invalid actor addresses', () => {
    const subject = createSubject();
    expect(subject.renderAddressLink(ethers.constants.AddressZero, 'admin')).toBe('N/A');
    expect(subject.renderAddressLink('not-an-address', 'admin')).toBe('N/A');
  });

  it('uses sessionSlug routing only when metadata marks it explicit', () => {
    const subject = createSubject();
    expect(subject.resolveSessionSlugFromInfo({
      sessionSlug: 'beta',
      sessionSlugExplicit: false,
    })).toBe(null);
    expect(subject.resolveSessionSlugFromInfo({
      sessionSlug: 'beta',
      sessionSlugExplicit: true,
    })).toBe('beta');
    expect(subject.resolveSessionSlugFromInfo({
      sessionSlug: 'beta',
    })).toBe('beta');
  });

  it('builds session SBT addresses from current context and session config', () => {
    const sessionConfigFixture = {
      defaultFeaturedSBTs: [
        '0x00000000000000000000000000000000000000d1',
      ],
      featured_SBTs_LIST: [
        '0x00000000000000000000000000000000000000D2',
      ],
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
    expect(addresses).toEqual(expect.arrayContaining([
      '0x00000000000000000000000000000000000000aa',
      '0x00000000000000000000000000000000000000bb',
      '0x00000000000000000000000000000000000000cc',
      '0x00000000000000000000000000000000000000d1',
      '0x00000000000000000000000000000000000000d2',
    ]));
    expect(cachedAddresses).toBe(addresses);
    expect(sessionConfigSpy).toHaveBeenCalledWith('rxc');
    expect(sessionConfigSpy).toHaveBeenCalledTimes(2);
    expect(addresses.every((entry) => entry === entry.toLowerCase())).toBe(true);
    expect(addresses.length).toBe(new Set(addresses).size);
  });

  it('uses explicit demo-session featured lists for display-only SBT context when registry config is missing', () => {
    jest
      .spyOn(contractScriptsModule, 'getSessionConfigBySlugOrDefault')
      .mockReturnValue(null);
    const demoConfigSpy = jest
      .spyOn(contractScriptsModule, 'getDemoSessionConfigBySlug')
      .mockReturnValue({
        defaultFeaturedSBTs: [
          '0x00000000000000000000000000000000000000f1',
        ],
        featured_SBTs_LIST: [
          '0x00000000000000000000000000000000000000F2',
        ],
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

    expect(addresses).toEqual(expect.arrayContaining([
      '0x00000000000000000000000000000000000000cc',
      '0x00000000000000000000000000000000000000f1',
      '0x00000000000000000000000000000000000000f2',
    ]));
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

    jest.spyOn(cacheScripts, 'readCache')
      .mockResolvedValueOnce(initialEntry)
      .mockResolvedValueOnce(refreshedEntry);
    const refreshSpy = jest.fn().mockResolvedValue(undefined);
    jest.spyOn(contractScripts, 'getSbtHistorySummary').mockResolvedValue({
      totalMinted: '2',
      totalBurned: '0',
      activeSupply: '2',
      currentHolderCount: '2',
      historicalHolderCount: '2',
    });
    const groupPasswordSpy = jest.spyOn(contractScripts, 'getGroupPasswordHash').mockResolvedValue(ethers.constants.HashZero);
    const ownerSpy = jest.spyOn(contractScripts, 'getOwnerByTokenId').mockResolvedValue(
      '0x00000000000000000000000000000000000000b1'
    );

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
      expect.objectContaining({ forceCounts: true, countsOnly: true })
    );
    expect(groupPasswordSpy).not.toHaveBeenCalled();
    expect(ownerSpy).not.toHaveBeenCalled();
    expect(subject.state.mintedAddresses).toEqual([]);
    expect(subject.state.mintedTokensOverride).toBe('2');

    const tree = subject.render();
    expect(treeIncludesText(tree, '~2')).toBe(true);
    expect(treeIncludesText(tree, 'No holders found.')).toBe(false);
  });

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
              image: 'https://example.com/badge.png',
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
              image: 'https://example.com/beta-badge.png',
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
      image: 'https://example.com/beta-badge.png',
      chainID: 84532,
    }));
    expect(subject.state.userHasSBT).toBe(false);
  });

  it('decrypts encrypted description, tags, and document URLs from cached SBT metadata', async () => {
    const sbtAddress = '0x00000000000000000000000000000000000000a1';
    const sbtLower = sbtAddress.toLowerCase();
    const account = '0x00000000000000000000000000000000000000b1';
    const cacheEntry = {
      '84532': {
        sbtList: {
          [sbtLower]: {
            sbtAddress,
            sbtInfo: {
              name: 'Badge',
              tokenURI: 'ar://HLDsCm3ALbbgjVTCPVLhU8aF9taAdKyD1DyB7A8zkaXM',
              image: 'https://example.com/badge.png',
              description: '',
              descriptionEncrypted: 'desc-envelope',
              descriptionAccess: { type: 'sbt', gateIds: ['gate-description'], chainId: 84532 },
              tags: [],
              tagsEncrypted: 'tags-envelope',
              tagsAccess: { type: 'sbt', gateIds: ['gate-tags'], chainId: 84532 },
              documentURLs: [],
              documentURLsEncrypted: 'docs-envelope',
              documentURLsAccess: { type: 'sbt', gateIds: ['gate-docs'], chainId: 84532 },
              mintingEndTime: 0,
              burnAuth: 0,
              hasPasswordMint: false,
              maxTokens: '0',
              admin: '0x00000000000000000000000000000000000000a2',
              chainID: 84532,
            },
            mintedAddresses: [account],
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
    const decryptSpy = jest.spyOn(cryptoUtils, 'decryptEnvelopeValue')
      .mockImplementation(async (envelope) => {
        if (envelope === 'desc-envelope') return 'Private description';
        if (envelope === 'tags-envelope') return ['alpha', 'beta'];
        if (envelope === 'docs-envelope') return ['https://doc.test/private'];
        return null;
      });
    window.__litHooks = { getKey: jest.fn() };

    const subject = createSubject({
      SBTAddress: sbtAddress,
      sessionSlug: 'edge',
      account,
    });
    subject.state = {
      ...subject.state,
      network: { id: 84532, name: 'Base Sepolia' },
    };

    await subject.loadSBTInfo(false);

    expect(decryptSpy).toHaveBeenCalledTimes(3);
    expect(subject.state.sbtInfo).toEqual(expect.objectContaining({
      description: 'Private description',
      descriptionDecrypted: true,
      tags: ['alpha', 'beta'],
      tagsDecrypted: true,
      documentURLs: ['https://doc.test/private'],
      documentURLsDecrypted: true,
    }));
  });

  it('decrypts locked name, description, tags, document URLs, and uploaded image from encryptedFields metadata', async () => {
    const sbtAddress = '0x00000000000000000000000000000000000000a9';
    const sbtLower = sbtAddress.toLowerCase();
    const account = '0x00000000000000000000000000000000000000b9';
    const cacheEntry = {
      '84532': {
        sbtList: {
          [sbtLower]: {
            sbtAddress,
            sbtInfo: {
              name: '',
              image: '',
              description: '',
              tags: [],
              documentURLs: [],
              encryptedFields: {
                name: 'name-envelope',
                description: 'desc-envelope',
                tags: 'tags-envelope',
                documentURLs: 'docs-envelope',
                image: {
                  storage: 'lit-arweave',
                  txId: 'img-tx',
                },
              },
              encryption: {
                enabled: true,
                status: 'lit-v1',
                targets: {
                  name: true,
                  description: true,
                  tags: true,
                  documentURLs: true,
                  image: true,
                },
              },
              mintingEndTime: 0,
              burnAuth: 0,
              hasPasswordMint: false,
              maxTokens: '0',
              admin: '0x00000000000000000000000000000000000000a2',
              chainID: 84532,
            },
            mintedAddresses: [account],
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
    const decryptSpy = jest.spyOn(cryptoUtils, 'decryptEnvelopeValue')
      .mockImplementation(async (envelope) => {
        if (envelope === 'name-envelope') return 'Private Badge';
        if (envelope === 'desc-envelope') return 'Private description';
        if (envelope === 'tags-envelope') return ['alpha', 'beta'];
        if (envelope === 'docs-envelope') return ['https://doc.test/private'];
        return null;
      });
    const downloadSpy = jest.spyOn(litStorage, 'downloadEncryptedArweaveData').mockResolvedValue({
      payload: { encoding: 'base64', data: 'aW1hZ2U=', mime: 'image/png', name: 'badge.png' },
      txId: 'img-tx',
      url: 'lit-ar://img-tx',
    });
    const decodeBlobSpy = jest.spyOn(litStorage, 'decodeLitPayloadToBlob').mockReturnValue(new Blob(['image'], { type: 'image/png' }));
    const objectUrlMock = mockObjectUrlApis('blob:locked-image');
    window.__litHooks = { getKey: jest.fn() };

    const subject = createSubject({
      SBTAddress: sbtAddress,
      sessionSlug: 'edge',
      account,
    });
    subject.state = {
      ...subject.state,
      network: { id: 84532, name: 'Base Sepolia' },
    };

    await subject.loadSBTInfo(false);

    expect(decryptSpy).toHaveBeenCalledTimes(4);
    expect(downloadSpy).toHaveBeenCalledTimes(1);
    expect(decodeBlobSpy).toHaveBeenCalledTimes(1);
    expect(objectUrlMock.createObjectURL).toHaveBeenCalledTimes(1);
    expect(subject.state.sbtInfo).toEqual(expect.objectContaining({
      name: 'Private Badge',
      nameDecrypted: true,
      description: 'Private description',
      descriptionDecrypted: true,
      tags: ['alpha', 'beta'],
      tagsDecrypted: true,
      documentURLs: ['https://doc.test/private'],
      documentURLsDecrypted: true,
      image: 'blob:locked-image',
      imageDecrypted: true,
    }));
    objectUrlMock.restore();
  });

  it('does not rehydrate metadata when a locked image is intentionally blank', async () => {
    const sbtAddress = '0x00000000000000000000000000000000000000ac';
    const sbtLower = sbtAddress.toLowerCase();
    const refreshSpy = jest.fn();
    const cacheEntry = {
      '84532': {
        sbtList: {
          [sbtLower]: {
            sbtAddress,
            sbtInfo: {
              name: '',
              contractName: 'CE-SBT-12',
              nameLocked: true,
              tokenURI: 'ar://HLDsCm3ALbbgjVTCPVLhU8aF9taAdKyD1DyB7A8zkaXM',
              image: '',
              imageLocked: true,
              encryptedFields: {
                image: {
                  storage: 'lit-arweave',
                  txId: 'img-tx',
                },
              },
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

    jest.spyOn(cacheScripts, 'readCache').mockResolvedValue(cacheEntry);
    jest.spyOn(contractScripts, 'getGroupPasswordHash').mockResolvedValue(ethers.constants.HashZero);

    const subject = createSubject({
      SBTAddress: sbtAddress,
      sessionSlug: 'edge',
      refreshSbtData: refreshSpy,
    });
    subject.state = {
      ...subject.state,
      network: { id: 84532, name: 'Base Sepolia' },
    };

    await subject.loadSBTInfo(false);

    expect(refreshSpy).not.toHaveBeenCalled();
    expect(subject.state.sbtInfo).toEqual(expect.objectContaining({
      image: '',
      imageLocked: true,
    }));
  });

  it('retries encrypted name and image decrypt after the wallet connects', async () => {
    const sbtAddress = '0x00000000000000000000000000000000000000aa';
    const sbtLower = sbtAddress.toLowerCase();
    const account = '0x00000000000000000000000000000000000000ba';
    const cacheEntry = {
      '84532': {
        sbtList: {
          [sbtLower]: {
            sbtAddress,
            sbtInfo: {
              name: '',
              image: '',
              encryptedFields: {
                name: 'name-envelope',
                image: {
                  storage: 'lit-arweave',
                  txId: 'img-tx',
                },
              },
              encryption: {
                enabled: true,
                status: 'lit-v1',
                targets: { name: true, image: true },
              },
              mintingEndTime: 0,
              burnAuth: 0,
              hasPasswordMint: false,
              maxTokens: '0',
              admin: '0x00000000000000000000000000000000000000a2',
              chainID: 84532,
            },
            mintedAddresses: [account],
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
    const decryptSpy = jest.spyOn(cryptoUtils, 'decryptEnvelopeValue').mockResolvedValue('Private Badge');
    const downloadSpy = jest.spyOn(litStorage, 'downloadEncryptedArweaveData').mockResolvedValue({
      payload: { encoding: 'base64', data: 'aW1hZ2U=', mime: 'image/png', name: 'badge.png' },
      txId: 'img-tx',
      url: 'lit-ar://img-tx',
    });
    jest.spyOn(litStorage, 'decodeLitPayloadToBlob').mockReturnValue(new Blob(['image'], { type: 'image/png' }));
    const objectUrlMock = mockObjectUrlApis('blob:locked-image-after-connect');
    window.__litHooks = { getKey: jest.fn() };

    const subject = createSubject({
      SBTAddress: sbtAddress,
      sessionSlug: 'edge',
    });
    subject.state = {
      ...subject.state,
      network: { id: 84532, name: 'Base Sepolia' },
    };

    await subject.loadSBTInfo(true);

    expect(decryptSpy).not.toHaveBeenCalled();
    expect(downloadSpy).not.toHaveBeenCalled();

    subject.props = {
      ...subject.props,
      account,
    };

    await subject.loadSBTInfo(true);

    expect(decryptSpy).toHaveBeenCalledTimes(1);
    expect(downloadSpy).toHaveBeenCalledTimes(1);
    expect(objectUrlMock.createObjectURL).toHaveBeenCalledTimes(1);
    expect(subject.state.sbtInfo).toEqual(expect.objectContaining({
      name: 'Private Badge',
      nameDecrypted: true,
      image: 'blob:locked-image-after-connect',
      imageDecrypted: true,
    }));
    objectUrlMock.restore();
  });

  it('retries encrypted metadata decrypt after the wallet connects', async () => {
    const sbtAddress = '0x00000000000000000000000000000000000000a1';
    const sbtLower = sbtAddress.toLowerCase();
    const account = '0x00000000000000000000000000000000000000b1';
    const cacheEntry = {
      '84532': {
        sbtList: {
          [sbtLower]: {
            sbtAddress,
            sbtInfo: {
              name: 'Badge',
              tokenURI: 'ar://HLDsCm3ALbbgjVTCPVLhU8aF9taAdKyD1DyB7A8zkaXM',
              image: 'https://example.com/badge.png',
              description: '',
              descriptionEncrypted: 'desc-envelope',
              descriptionAccess: { type: 'sbt', gateIds: ['gate-description'], chainId: 84532 },
              mintingEndTime: 0,
              burnAuth: 0,
              hasPasswordMint: false,
              maxTokens: '0',
              admin: '0x00000000000000000000000000000000000000a2',
              chainID: 84532,
            },
            mintedAddresses: [account],
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
    const decryptSpy = jest.spyOn(cryptoUtils, 'decryptEnvelopeValue').mockResolvedValue('Private description');
    window.__litHooks = { getKey: jest.fn() };

    const subject = createSubject({
      SBTAddress: sbtAddress,
      sessionSlug: 'edge',
    });
    subject.state = {
      ...subject.state,
      network: { id: 84532, name: 'Base Sepolia' },
    };

    await subject.loadSBTInfo(true);

    expect(decryptSpy).not.toHaveBeenCalled();

    subject.props = {
      ...subject.props,
      account,
    };

    await subject.loadSBTInfo(true);

    expect(decryptSpy).toHaveBeenCalledTimes(1);
    expect(subject.state.sbtInfo).toEqual(expect.objectContaining({
      description: 'Private description',
      descriptionDecrypted: true,
    }));
  });

  it('retries encrypted metadata decrypt when the active account changes', async () => {
    const sbtAddress = '0x00000000000000000000000000000000000000a1';
    const sbtLower = sbtAddress.toLowerCase();
    const accountA = '0x00000000000000000000000000000000000000b1';
    const accountB = '0x00000000000000000000000000000000000000b2';
    const cacheEntry = {
      '84532': {
        sbtList: {
          [sbtLower]: {
            sbtAddress,
            sbtInfo: {
              name: 'Badge',
              tokenURI: 'ar://HLDsCm3ALbbgjVTCPVLhU8aF9taAdKyD1DyB7A8zkaXM',
              image: 'https://example.com/badge.png',
              description: '',
              descriptionEncrypted: 'desc-envelope',
              descriptionAccess: { type: 'sbt', gateIds: ['gate-description'], chainId: 84532 },
              mintingEndTime: 0,
              burnAuth: 0,
              hasPasswordMint: false,
              maxTokens: '0',
              admin: '0x00000000000000000000000000000000000000a2',
              chainID: 84532,
            },
            mintedAddresses: [accountA],
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
    const decryptSpy = jest.spyOn(cryptoUtils, 'decryptEnvelopeValue')
      .mockImplementation(async (_envelope, options = {}) => (
        options.account === accountB ? 'Private description' : null
      ));
    window.__litHooks = { getKey: jest.fn() };

    const subject = createSubject({
      SBTAddress: sbtAddress,
      sessionSlug: 'edge',
      account: accountA,
    });
    subject.state = {
      ...subject.state,
      network: { id: 84532, name: 'Base Sepolia' },
    };

    await subject.loadSBTInfo(true);

    expect(decryptSpy).toHaveBeenCalledTimes(1);
    expect(subject.state.sbtInfo.description || '').toBe('');
    expect(subject.state.sbtInfo.descriptionDecrypted).not.toBe(true);

    subject.props = {
      ...subject.props,
      account: accountB,
    };

    await subject.loadSBTInfo(true);

    expect(decryptSpy).toHaveBeenCalledTimes(2);
    expect(decryptSpy.mock.calls.map((call) => call[1]?.account)).toEqual([accountA, accountB]);
    expect(subject.state.sbtInfo).toEqual(expect.objectContaining({
      description: 'Private description',
      descriptionDecrypted: true,
    }));
  });

  it('retries encrypted name and uploaded image decrypt when the active account changes', async () => {
    const sbtAddress = '0x00000000000000000000000000000000000000ab';
    const sbtLower = sbtAddress.toLowerCase();
    const accountA = '0x00000000000000000000000000000000000000bb';
    const accountB = '0x00000000000000000000000000000000000000bc';
    const cacheEntry = {
      '84532': {
        sbtList: {
          [sbtLower]: {
            sbtAddress,
            sbtInfo: {
              name: '',
              image: '',
              encryptedFields: {
                name: 'name-envelope',
                image: {
                  storage: 'lit-arweave',
                  txId: 'img-tx',
                },
              },
              encryption: {
                enabled: true,
                status: 'lit-v1',
                targets: { name: true, image: true },
              },
              mintingEndTime: 0,
              burnAuth: 0,
              hasPasswordMint: false,
              maxTokens: '0',
              admin: '0x00000000000000000000000000000000000000a2',
              chainID: 84532,
            },
            mintedAddresses: [accountA],
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
    const decryptSpy = jest.spyOn(cryptoUtils, 'decryptEnvelopeValue')
      .mockImplementation(async (_envelope, options = {}) => (
        options.account === accountB ? 'Private Badge' : null
      ));
    const downloadSpy = jest.spyOn(litStorage, 'downloadEncryptedArweaveData')
      .mockImplementation(async (_opts = {}) => {
        if (_opts.account !== accountB) throw new Error('not authorized');
        return {
          payload: { encoding: 'base64', data: 'aW1hZ2U=', mime: 'image/png', name: 'badge.png' },
          txId: 'img-tx',
          url: 'lit-ar://img-tx',
        };
      });
    jest.spyOn(litStorage, 'decodeLitPayloadToBlob').mockReturnValue(new Blob(['image'], { type: 'image/png' }));
    const objectUrlMock = mockObjectUrlApis('blob:locked-image-after-account-switch');
    window.__litHooks = { getKey: jest.fn() };

    const subject = createSubject({
      SBTAddress: sbtAddress,
      sessionSlug: 'edge',
      account: accountA,
    });
    subject.state = {
      ...subject.state,
      network: { id: 84532, name: 'Base Sepolia' },
    };

    await subject.loadSBTInfo(true);

    expect(decryptSpy).toHaveBeenCalledTimes(1);
    expect(subject.state.sbtInfo.name || '').toBe('');
    expect(subject.state.sbtInfo.nameDecrypted).not.toBe(true);

    subject.props = {
      ...subject.props,
      account: accountB,
    };

    await subject.loadSBTInfo(true);

    expect(decryptSpy).toHaveBeenCalledTimes(2);
    expect(downloadSpy).toHaveBeenCalledTimes(2);
    expect(objectUrlMock.createObjectURL).toHaveBeenCalledTimes(1);
    expect(subject.state.sbtInfo).toEqual(expect.objectContaining({
      name: 'Private Badge',
      nameDecrypted: true,
      image: 'blob:locked-image-after-account-switch',
      imageDecrypted: true,
    }));
    objectUrlMock.restore();
  });

  it('ignores stale holder state from an in-flight load after account changes', async () => {
    jest.useFakeTimers();
    try {
      const sbtAddress = '0x00000000000000000000000000000000000000a1';
      const sbtLower = sbtAddress.toLowerCase();
      const ownerA = '0x00000000000000000000000000000000000000b1';
      const ownerB = '0x00000000000000000000000000000000000000b2';
      const cacheEntry = {
        '84532': {
          sbtList: {
            [sbtLower]: {
              sbtAddress,
              sbtInfo: {
                tokenURI: 'ar://HLDsCm3ALbbgjVTCPVLhU8aF9taAdKyD1DyB7A8zkaXM',
                image: 'https://example.com/badge.png',
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
      const firstRead = new Promise((resolve) => { resolveFirstRead = resolve; });
      const readSpy = jest.spyOn(cacheScripts, 'readCache')
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

  it('returns no holder lookups when minted count is zero', async () => {
    const ownerSpy = jest.spyOn(contractScripts, 'getOwnerByTokenId').mockResolvedValue(
      '0x00000000000000000000000000000000000000b1'
    );
    const subject = createSubject();

    const holders = await subject.fetchHolderAddressesByTokenOwnership(
      '0x00000000000000000000000000000000000000a1',
      'edge',
      0
    );

    expect(ownerSpy).not.toHaveBeenCalled();
    expect(holders).toEqual([]);
  });

  it('batches ownerOf fallback lookups instead of probing strictly one-by-one', async () => {
    const pending = new Map();
    const ownerAddress = '0x00000000000000000000000000000000000000b1';
    const ownerSpy = jest.spyOn(contractScripts, 'getOwnerByTokenId')
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
      12
    );
    await Promise.resolve();

    expect(ownerSpy).toHaveBeenCalledTimes(10);
    expect(ownerSpy.mock.calls.slice(0, 10).map((call) => Number(call[2]))).toEqual(
      [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
    );

    pending.forEach((resolve) => resolve(ownerAddress));
    const holders = await runPromise;

    expect(ownerSpy.mock.calls.map((call) => Number(call[2]))).toEqual(
      [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 0]
    );
    expect(holders).toEqual([ownerAddress.toLowerCase()]);
  });

  it('returns ownerOf fallback holders in deterministic sorted order', async () => {
    const pending = new Map();
    const ownerA = '0x00000000000000000000000000000000000000b1';
    const ownerB = '0x00000000000000000000000000000000000000b2';
    const ownerC = '0x00000000000000000000000000000000000000b3';
    const ownerSpy = jest.spyOn(contractScripts, 'getOwnerByTokenId')
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
      3
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
    const sbtLower = sbtAddress.toLowerCase();
    const ownerA = '0x00000000000000000000000000000000000000b1';
    const ownerB = '0x00000000000000000000000000000000000000b2';
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
            mintedAddresses: [],
            burnedAddresses: [],
            countsLoaded: false,
            blockNumber: 1234,
          },
        },
        lastBlock: 1234,
      },
    };

    jest.spyOn(cacheScripts, 'readCache').mockResolvedValue(cacheEntry);
    jest.spyOn(contractScripts, 'getGroupPasswordHash').mockResolvedValue(ethers.constants.HashZero);
    jest.spyOn(contractScripts, 'getMintedTokens').mockResolvedValue('2');
    const ownerSpy = jest.spyOn(contractScripts, 'getOwnerByTokenId')
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
    const sbtLower = sbtAddress.toLowerCase();
    const ownerA = '0x00000000000000000000000000000000000000b1';
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
            mintedAddresses: [],
            burnedAddresses: [],
            countsLoaded: false,
            blockNumber: 1234,
          },
        },
        lastBlock: 1234,
      },
    };

    jest.spyOn(cacheScripts, 'readCache').mockResolvedValue(cacheEntry);
    const summarySpy = jest.spyOn(contractScripts, 'getSbtHistorySummary').mockResolvedValue({
      totalMinted: '5',
      totalBurned: '4',
      activeSupply: '1',
      currentHolderCount: '1',
      historicalHolderCount: '1',
    });
    const mintedSpy = jest.spyOn(contractScripts, 'getMintedTokens').mockResolvedValue('1');
    jest.spyOn(contractScripts, 'getGroupPasswordHash').mockResolvedValue(ethers.constants.HashZero);
    const ownerSpy = jest.spyOn(contractScripts, 'getOwnerByTokenId')
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

  it('overrides stale cached burnAuth metadata with collectionBurnAuth from chain', async () => {
    const sbtAddress = '0x00000000000000000000000000000000000000a1';
    const sbtLower = sbtAddress.toLowerCase();
    const holder = '0x00000000000000000000000000000000000000b1';
    const cacheEntry = {
      '84532': {
        sbtList: {
          [sbtLower]: {
            sbtAddress,
            sbtInfo: {
              tokenURI: 'ar://HLDsCm3ALbbgjVTCPVLhU8aF9taAdKyD1DyB7A8zkaXM',
              image: 'https://example.com/badge.png',
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
      '84532': {
        sbtList: {
          [sbtLower]: {
            sbtAddress,
            sbtInfo: {
              tokenURI: 'ar://HLDsCm3ALbbgjVTCPVLhU8aF9taAdKyD1DyB7A8zkaXM',
              image: 'https://example.com/badge.png',
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
    expect(subject.getMemoizedNetHoldersList(subject.state.mintedAddresses, subject.state.burnedAddresses)).toEqual([holderLower]);
  });

  it('probes tokenId 0 after one-based ids for zero-based multi-token contracts', async () => {
    const ownerA = '0x00000000000000000000000000000000000000b1';
    const ownerB = '0x00000000000000000000000000000000000000b2';
    const ownerSpy = jest.spyOn(contractScripts, 'getOwnerByTokenId')
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
      2
    );

    expect(ownerSpy.mock.calls.map((call) => Number(call[2]))).toEqual([1, 2, 0]);
    expect(holders).toEqual([ownerA.toLowerCase(), ownerB.toLowerCase()]);
  });

  it('falls back to ownerOf tokenId 0 when first mint uses zero-based ids', async () => {
    const sbtAddress = '0x00000000000000000000000000000000000000a1';
    const sbtLower = sbtAddress.toLowerCase();
    const ownerA = '0x00000000000000000000000000000000000000b1';
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
            mintedAddresses: [],
            burnedAddresses: [],
            countsLoaded: false,
            blockNumber: 1234,
          },
        },
        lastBlock: 1234,
      },
    };

    jest.spyOn(cacheScripts, 'readCache').mockResolvedValue(cacheEntry);
    jest.spyOn(contractScripts, 'getGroupPasswordHash').mockResolvedValue(ethers.constants.HashZero);
    jest.spyOn(contractScripts, 'getMintedTokens').mockResolvedValue('1');
    const ownerSpy = jest.spyOn(contractScripts, 'getOwnerByTokenId')
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

  it('preserves mintedTokensOverride after refresh when refreshed holder lists are incomplete', async () => {
    const sbtAddress = '0x00000000000000000000000000000000000000a1';
    const sbtLower = sbtAddress.toLowerCase();
    const ownerA = '0x00000000000000000000000000000000000000b1';
    const initialEntry = {
      '84532': {
        sbtList: {
          [sbtLower]: {
            sbtAddress,
            sbtInfo: {
              tokenURI: 'ar://HLDsCm3ALbbgjVTCPVLhU8aF9taAdKyD1DyB7A8zkaXM',
              image: 'https://example.com/badge.png',
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
      '84532': {
        sbtList: {
          [sbtLower]: {
            sbtAddress,
            sbtInfo: {
              tokenURI: 'ar://HLDsCm3ALbbgjVTCPVLhU8aF9taAdKyD1DyB7A8zkaXM',
              image: 'https://example.com/badge.png',
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

    const readSpy = jest.spyOn(cacheScripts, 'readCache')
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
      '84532': {
        sbtList: {
          [sbtLower]: {
            sbtAddress,
            sbtInfo: {
              tokenURI: 'ar://HLDsCm3ALbbgjVTCPVLhU8aF9taAdKyD1DyB7A8zkaXM',
              image: 'https://example.com/badge.png',
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

    const readSpy = jest.spyOn(cacheScripts, 'readCache')
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

    jest.spyOn(cacheScripts, 'readCache')
      .mockResolvedValueOnce(initialEntry)
      .mockResolvedValueOnce(refreshedEntry);
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
    expect(subject.getMemoizedNetHoldersList(subject.state.mintedAddresses, subject.state.burnedAddresses)).toEqual([ownerB.toLowerCase()]);
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

    jest.spyOn(cacheScripts, 'readCache')
      .mockResolvedValueOnce(initialEntry)
      .mockResolvedValueOnce(refreshedEntry);
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

  it('shows net holder count when burns create a holder gap', () => {
    const subject = createSubject({
      SBTAddress: '0x00000000000000000000000000000000000000a1',
    });
    subject.state = {
      ...subject.state,
      sbtInfo: {
        name: 'Badge',
        tokenURI: 'ar://HLDsCm3ALbbgjVTCPVLhU8aF9taAdKyD1DyB7A8zkaXM',
        image: 'https://example.com/badge.png',
        mintingEndTime: 0,
        burnAuth: 0,
        maxTokens: '0',
        admin: '0x00000000000000000000000000000000000000a2',
      },
      mintedAddresses: [
        '0x00000000000000000000000000000000000000b1',
        '0x00000000000000000000000000000000000000b2',
        '0x00000000000000000000000000000000000000b3',
        '0x00000000000000000000000000000000000000b4',
        '0x00000000000000000000000000000000000000b5',
        '0x00000000000000000000000000000000000000b6',
        '0x00000000000000000000000000000000000000b7',
      ],
      burnedAddresses: [
        '0x00000000000000000000000000000000000000b6',
        '0x00000000000000000000000000000000000000b7',
      ],
      countsLoaded: true,
      mintedTokensOverride: '7',
      showModal: true,
      loadingMintersBurners: false,
    };

    const tree = subject.render();
    const modalCount = findElementInTree(
      tree,
      (element) => element?.props?.className === styles.modalTitleCount
    );
    expect(modalCount).toBeTruthy();
    expect(flattenText(modalCount)).toBe('(5)');
  });

  it('shows approximate holder count from mintedTokens override even after local loading flags clear', () => {
    const subject = createSubject({
      SBTAddress: '0x00000000000000000000000000000000000000a1',
    });
    subject.state = {
      ...subject.state,
      sbtInfo: {
        name: 'Badge',
        tokenURI: 'ar://HLDsCm3ALbbgjVTCPVLhU8aF9taAdKyD1DyB7A8zkaXM',
        image: 'https://example.com/badge.png',
        mintingEndTime: 0,
        burnAuth: 0,
        maxTokens: '0',
        admin: '0x00000000000000000000000000000000000000a2',
      },
      mintedAddresses: [],
      burnedAddresses: [],
      countsLoaded: true,
      mintedTokensOverride: '1',
      showModal: true,
      loadingMintersBurners: false,
    };

    const tree = subject.render();
    expect(treeIncludesText(tree, '~1')).toBe(true);
    expect(treeIncludesText(tree, 'No holders found.')).toBe(false);
  });

  it('shows net holder count from mint history when override is absent', () => {
    const subject = createSubject({
      SBTAddress: '0x00000000000000000000000000000000000000a1',
    });
    subject.state = {
      ...subject.state,
      sbtInfo: {
        name: 'Badge',
        tokenURI: 'ar://HLDsCm3ALbbgjVTCPVLhU8aF9taAdKyD1DyB7A8zkaXM',
        image: 'https://example.com/badge.png',
        mintingEndTime: 0,
        burnAuth: 0,
        maxTokens: '0',
        admin: '0x00000000000000000000000000000000000000a2',
      },
      mintedAddresses: [
        '0x00000000000000000000000000000000000000b1',
        '0x00000000000000000000000000000000000000b2',
        '0x00000000000000000000000000000000000000b3',
        '0x00000000000000000000000000000000000000b4',
      ],
      burnedAddresses: [
        '0x00000000000000000000000000000000000000b3',
      ],
      countsLoaded: true,
      mintedTokensOverride: null,
      showModal: true,
      loadingMintersBurners: false,
    };

    const tree = subject.render();
    const modalCount = findElementInTree(
      tree,
      (element) => element?.props?.className === styles.modalTitleCount
    );
    expect(modalCount).toBeTruthy();
    expect(flattenText(modalCount)).toBe('(3)');
  });

  it('shows zero holders when all tokens are burned', () => {
    const subject = createSubject({
      SBTAddress: '0x00000000000000000000000000000000000000a1',
    });
    subject.state = {
      ...subject.state,
      sbtInfo: {
        name: 'Badge',
        tokenURI: 'ar://HLDsCm3ALbbgjVTCPVLhU8aF9taAdKyD1DyB7A8zkaXM',
        image: 'https://example.com/badge.png',
        mintingEndTime: 0,
        burnAuth: 0,
        maxTokens: '0',
        admin: '0x00000000000000000000000000000000000000a2',
      },
      mintedAddresses: [
        '0x00000000000000000000000000000000000000b1',
        '0x00000000000000000000000000000000000000b2',
      ],
      burnedAddresses: [
        '0x00000000000000000000000000000000000000b1',
        '0x00000000000000000000000000000000000000b2',
      ],
      countsLoaded: true,
      mintedTokensOverride: null,
      showModal: true,
      loadingMintersBurners: false,
    };

    const tree = subject.render();
    const modalCount = findElementInTree(
      tree,
      (element) => element?.props?.className === styles.modalTitleCount
    );
    expect(modalCount).toBeTruthy();
    expect(flattenText(modalCount)).toBe('(0)');
  });

  it.each(['NaN', 'bad string'])(
    'sanitizes malformed mintedTokensOverride values before persisting (%s)',
    async (malformedOverride) => {
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
              mintedAddresses: [],
              burnedAddresses: [],
              countsLoaded: false,
              blockNumber: 1234,
            },
          },
          lastBlock: 1234,
        },
      };

      jest.spyOn(cacheScripts, 'readCache').mockResolvedValue(cacheEntry);
      jest.spyOn(contractScripts, 'getGroupPasswordHash').mockResolvedValue(ethers.constants.HashZero);
      jest.spyOn(contractScripts, 'getMintedTokens').mockResolvedValue(malformedOverride);
      const ownerSpy = jest.spyOn(contractScripts, 'getOwnerByTokenId').mockResolvedValue(null);
      const subject = createSubject({
        SBTAddress: sbtAddress,
        sessionSlug: 'edge',
      });
      subject.state = {
        ...subject.state,
        network: { id: 84532, name: 'Base Sepolia' },
      };

      await subject.loadSBTInfo(false);

      expect(subject.state.mintedTokensOverride).toBeNull();
      expect(ownerSpy).not.toHaveBeenCalled();
    }
  );

  it('fails password mint pre-validation before startClaim when the claim code is invalid', async () => {
    const sbtAddress = '0x00000000000000000000000000000000000000d1';
    const account = '0x00000000000000000000000000000000000000d2';
    const subject = createSubject({
      SBTAddress: sbtAddress,
      account,
      loginComplete: true,
      sessionSlug: 'edge',
    });
    subject.state = {
      ...subject.state,
      sbtInfo: { hasPasswordMint: true },
      manualPasswordInput: 'invalid-code',
      mintStep: 0,
    };

    const isPasswordValidSpy = jest.spyOn(contractScripts, 'isPasswordValid').mockResolvedValue(false);
    const startClaimSpy = jest.spyOn(contractScripts, 'startClaim').mockResolvedValue({ transactionHash: '0xstart' });

    await subject.handleMint(false);

    expect(isPasswordValidSpy).toHaveBeenCalledWith(
      'mock',
      sbtAddress,
      ethers.utils.keccak256(ethers.utils.toUtf8Bytes('invalid-code')),
      'edge'
    );
    expect(startClaimSpy).not.toHaveBeenCalled();
    expect(subject.state.error).toBe('Invalid password.');
    expect(subject.state.mintingStatus).toBe('failure');
  });

  it('starts the password claim after pre-validation succeeds', async () => {
    const sbtAddress = '0x00000000000000000000000000000000000000e1';
    const account = '0x00000000000000000000000000000000000000e2';
    const subject = createSubject({
      SBTAddress: sbtAddress,
      account,
      sessionSlug: 'edge',
    });
    subject.state = {
      ...subject.state,
      sbtInfo: { hasPasswordMint: true },
      manualPasswordInput: 'valid-code',
      mintStep: 0,
    };
    subject.startClaimCountdown = jest.fn();
    subject.cacheTransactionHash = jest.fn();

    jest.spyOn(contractScripts, 'isPasswordValid').mockResolvedValue(true);
    const startClaimSpy = jest.spyOn(contractScripts, 'startClaim').mockResolvedValue({ transactionHash: '0xstart' });

    await subject.handleMint(false);

    expect(startClaimSpy).toHaveBeenCalledWith(
      'mock',
      sbtAddress,
      ethers.utils.solidityKeccak256(['string', 'address'], ['valid-code', account])
    );
    expect(subject.state.mintStep).toBe(1);
    expect(subject.state.mintingStatus).toBe('idle');
    expect(subject.startClaimCountdown).toHaveBeenCalledTimes(1);
    expect(subject.cacheTransactionHash).toHaveBeenCalledWith('0xstart');
  });

  it('uses the zero wallet scope for invite generation when the on-chain hash was created predeploy', async () => {
    const sbtAddress = '0x00000000000000000000000000000000000000f1';
    const password = 'shared-secret';
    const subject = createSubject({
      SBTAddress: sbtAddress,
      account: '0x00000000000000000000000000000000000000f2',
      sessionSlug: 'edge',
    });
    subject.state = {
      ...subject.state,
      sbtInfo: { maxTokens: '5' },
      groupPasswordHash: cryptoUtils.computeGroupPasswordHash({ password, sbtAddress: '' }),
    };
    subject.claimWithInvitePayload = jest.fn().mockResolvedValue({ ok: true });

    jest.spyOn(contractScripts, 'getMintedTokens').mockResolvedValue('0');
    const inviteSpy = jest.spyOn(contractScripts, 'generateInvitePayloads').mockResolvedValue([
      { nonce: '1', signature: '0xinvite' },
    ]);

    await subject.claimWithGroupPassword(password);

    expect(inviteSpy).toHaveBeenCalledWith({
      password,
      sbtAddress,
      nonces: ['1'],
      walletScopeSbtAddress: '',
    });
  });

  it('uses the zero wallet scope for manual group-signature mint when the on-chain hash was created predeploy', async () => {
    const sbtAddress = '0x00000000000000000000000000000000000000f3';
    const account = '0x00000000000000000000000000000000000000f4';
    const password = 'shared-secret';
    const subject = createSubject({
      SBTAddress: sbtAddress,
      account,
      sessionSlug: 'edge',
    });
    subject.state = {
      ...subject.state,
      groupPasswordInput: password,
    };
    subject.loadSBTInfo = jest.fn().mockResolvedValue(undefined);
    subject.applyLocalMintSuccess = jest.fn();
    subject.refreshSbtDataWithSlug = jest.fn();
    subject.clearAutoMintUrlIntent = jest.fn();

    jest.spyOn(contractScripts, 'getGroupPasswordHash').mockResolvedValue(
      cryptoUtils.computeGroupPasswordHash({ password, sbtAddress: '' })
    );
    const signSpy = jest
      .spyOn(contractScripts, 'signGroupMintAuthorization')
      .mockResolvedValue('0xsignature');
    jest.spyOn(contractScripts, 'mintWithGroupSignature').mockResolvedValue({ transactionHash: '0xtx' });

    await subject.mintUnlimitedWithGroupPassword();

    expect(signSpy).toHaveBeenCalledWith({
      password,
      sbtAddress,
      userAddress: account,
      walletScopeSbtAddress: '',
    });
  });

  it('loads cached passwords from the scoped recovery store', () => {
    const sbtAddress = '0x0000000000000000000000000000000000000201';
    const sbtLower = sbtAddress.toLowerCase();
    const subject = createSubject({
      SBTAddress: sbtAddress,
      network: { id: 84532, name: 'Base Sepolia' },
    });
    const now = Date.now();
    localStorage.setItem(SBT_PASSWORD_RECOVERY_STORAGE_KEY, JSON.stringify({
      v: 1,
      kind: SBT_PASSWORD_RECOVERY_KIND,
      updatedAt: now,
      entries: {
        [`84532:${sbtLower}`]: {
          chainId: 84532,
          sbtAddress: sbtLower,
          passwords: ['scoped-code'],
          createdAt: now,
          updatedAt: now,
          expiresAt: now + 60_000,
        },
      },
    }));

    subject.loadCachedPasswords();

    expect(subject.state.cachedPasswords).toEqual(['scoped-code']);
  });

  it('prefers the viewed SBT chain over the connected network when loading cached passwords', () => {
    const sbtAddress = '0x0000000000000000000000000000000000000203';
    const sbtLower = sbtAddress.toLowerCase();
    const now = Date.now();
    const subject = createSubject({
      SBTAddress: sbtAddress,
      network: { id: 11155420, name: 'OP Sepolia' },
    });
    subject.state = {
      ...subject.state,
      sbtInfo: {
        chainID: 84532,
      },
    };
    localStorage.setItem(SBT_PASSWORD_RECOVERY_STORAGE_KEY, JSON.stringify({
      v: 1,
      kind: SBT_PASSWORD_RECOVERY_KIND,
      updatedAt: now,
      entries: {
        [`84532:${sbtLower}`]: {
          chainId: 84532,
          sbtAddress: sbtLower,
          passwords: ['base-only-code'],
          createdAt: now,
          updatedAt: now,
          expiresAt: now + 60_000,
        },
      },
    }));

    subject.loadCachedPasswords();

    expect(subject.state.cachedPasswords).toEqual(['base-only-code']);
  });

  it('persists admin-generated invite codes to the scoped recovery store', async () => {
    const sbtAddress = '0x0000000000000000000000000000000000000202';
    const sbtLower = sbtAddress.toLowerCase();
    const subject = createSubject({
      SBTAddress: sbtAddress,
      network: { id: 84532, name: 'Base Sepolia' },
    });
    subject.state = {
      ...subject.state,
      passwordGenerationCount: 2,
    };
    jest.spyOn(subject, 'generateRandomPasswords').mockReturnValue(['admin-one', 'admin-two']);
    jest.spyOn(subject, 'cacheTransactionHash').mockImplementation(() => {});
    jest.spyOn(contractScripts, 'addHashedPasswords').mockResolvedValue({
      transactionHash: '0x0000000000000000000000000000000000000000000000000000000000000202',
    });

    await subject.handleGenerateAdminInvites();

    const recoveryStore = JSON.parse(localStorage.getItem(SBT_PASSWORD_RECOVERY_STORAGE_KEY));
    expect(recoveryStore.entries[`84532:${sbtLower}`]).toEqual(expect.objectContaining({
      chainId: 84532,
      sbtAddress: sbtLower,
      passwords: ['admin-one', 'admin-two'],
    }));
    expect(subject.state.adminGeneratedPasswords).toEqual(['admin-one', 'admin-two']);
    expect(subject.state.cachedPasswords).toEqual(['admin-one', 'admin-two']);
  });

});
