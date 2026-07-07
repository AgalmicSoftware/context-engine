// Shared harness for SBTPage coverage.
import SBTPage from './SBTPage';
import { ethers } from 'ethers';
import contractScripts from '../../utilities/web3/chainGateway.js';
import * as contractScriptsModule from '../../utilities/web3/chainGateway.js';
import * as cacheScripts from '../../utilities/cache/cacheScripts.js';
import { getShortenedAddress } from '../../utilities/ui/displayHelpers.js';
import { cryptoUtils } from 'utilities/crypto/cryptography.js';
import { litStorage } from 'utilities/crypto/litProtocol.js';
import { render, screen } from '@testing-library/react';

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

export const createSubject = (props = {}) => {
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

export const findElementInTree = (node, predicate) => {
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

export const treeIncludesText = (node, text) => {
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

export const flattenText = (node) => {
  if (node == null) return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map((entry) => flattenText(entry)).join('');
  if (typeof node === 'object') return flattenText(node?.props?.children);
  return '';
};

export const mockObjectUrlApis = (blobUrl = 'blob:mock') => {
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

export const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0));
export const createDeferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

export const createCachedSbtInfo = (overrides = {}) => ({
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

export const createReadCachePayload = ({
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

export const setupSBTPageTestLifecycle = () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    window.sessionStorage.clear();
    jest.spyOn(contractScripts, 'getSbtHistorySummary').mockResolvedValue(null);
  });

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
    try {
      delete window.__litHooks;
    } catch (_) {}
    jest.restoreAllMocks();
  });
};

export {
  SBTPage,
  ethers,
  contractScripts,
  contractScriptsModule,
  cacheScripts,
  getShortenedAddress,
  cryptoUtils,
  litStorage,
  render,
  screen,
  mockIsCryptoMode,
};
