/** @file UserPage.cacheRefresh.testUtils.tsx */
import UserPage from './UserPage';
import { checkSponsoredAccess } from '../../utilities/web3/sponsoredAccess.js';
import * as cacheScripts from '../../utilities/cache/cacheScripts.js';
import * as contractScriptsModule from '../../utilities/web3/contractScripts.js';

jest.mock('../../utilities/crypto/litProtocol.js', () => ({
  getGlobalLitHooks: jest.fn(() => null),
}));

jest.mock('../../utilities/crypto/cryptography.js', () => ({
  cryptoUtils: {
    decryptSingleField: jest.fn(),
  },
}));

jest.mock('../../utilities/web3/sponsoredAccess.js', () => ({
  checkSponsoredAccess: jest.fn(),
}));

jest.mock('utilities/ai/aiScripts.js', () => ({
  analyzeUserOpinions: jest.fn(async () => ({
    summary: 'summary',
    details: 'details',
    name: 'name',
    historicalAlignment: {},
  })),
}));

export const makeInstance = (props = {}) => {
  const instance = new UserPage({
    viewAddress: '0x00000000000000000000000000000000000000aa',
    network: { id: 84532 },
    isSurveyCacheReady: true,
    isQuestionCacheReady: true,
    isResponsesCacheReady: true,
    isSBTCacheReady: true,
    sbtCacheRevision: 0,
    questionResponsesNonce: 0,
    ...props,
  });

  instance._isMounted = true;
  instance.setState = jest.fn((update, cb) => {
    const patch = typeof update === 'function' ? update(instance.state, instance.props) : update;
    if (patch && typeof patch === 'object') {
      instance.state = { ...instance.state, ...patch };
    }
    if (typeof cb === 'function') cb();
  });

  return instance;
};

export const createDeferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

export const REGISTRY_CACHE_KEY = 'dg:sessionRegistryCache:v1';

export const collectTreeNodes = (node, predicate, acc = []) => {
  if (node == null) return acc;
  if (Array.isArray(node)) {
    node.forEach((child) => collectTreeNodes(child, predicate, acc));
    return acc;
  }
  if (typeof node !== 'object') return acc;
  if (predicate(node)) acc.push(node);
  const rendered = renderResolvableComponent(node);
  if (rendered !== null) return collectTreeNodes(rendered, predicate, acc);
  return collectTreeNodes(node?.props?.children, predicate, acc);
};

export const getNodeTypeName = (node) => {
  const type = node?.type;
  if (!type) return '';
  if (typeof type === 'string') return type;
  return String(type.displayName || type.name || '');
};

const RESOLVABLE_USER_PAGE_COMPONENTS = new Set([
  'UserPageDeepScanStatusIndicator',
  'UserPageDeepScanProgressPanel',
  'UserPageHeader',
  'UserPageQuestionSection',
  'UserPageSbtSection',
  'UserPageSurveySection',
]);

const resolvedComponentCache = new WeakMap();

const renderResolvableComponent = (node) => {
  const typeName = getNodeTypeName(node);
  if (!RESOLVABLE_USER_PAGE_COMPONENTS.has(typeName)) return null;
  if (typeof node?.type !== 'function') return null;
  if (resolvedComponentCache.has(node)) return resolvedComponentCache.get(node);
  const rendered = node.type(node.props || {});
  resolvedComponentCache.set(node, rendered);
  return rendered;
};

export const treeHasText = (node, text) => {
  if (node == null) return false;
  if (Array.isArray(node)) return node.some((child) => treeHasText(child, text));
  if (typeof node === 'string' || typeof node === 'number') {
    return String(node).includes(text);
  }
  if (typeof node !== 'object') return false;
  const rendered = renderResolvableComponent(node);
  if (rendered !== null) return treeHasText(rendered, text);
  return treeHasText(node?.props?.children, text);
};

export const setupUserPageCacheRefreshTestLifecycle = () => {
  beforeEach(() => {
    checkSponsoredAccess.mockResolvedValue({
      status: 'unknown',
      gate: null,
      resourceKey: 'default',
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
    try {
      delete globalThis.CE_USER_PROFILE_DEEP_SCAN_LOADING;
    } catch (_) {}
    try {
      delete globalThis.CE_USER_PROFILE_SCAN_ALL_SESSIONS_SURVEYS;
    } catch (_) {}
    try {
      delete globalThis.CE_USER_PROFILE_SCAN_ALL_SESSIONS_QUESTIONS;
    } catch (_) {}
    try {
      delete globalThis.CE_SESSION_SCAN_SCOPE;
    } catch (_) {}
    try {
      delete globalThis.CE_SESSION_SCAN_SLUGS;
    } catch (_) {}
    try {
      localStorage.removeItem('ce:aiSettings:v1');
    } catch (_) {}
    try {
      localStorage.removeItem('ce:sessionScanScope');
    } catch (_) {}
    try {
      localStorage.removeItem('ce:sessionScanSlugs');
    } catch (_) {}
  });
};

export { UserPage, checkSponsoredAccess, cacheScripts, contractScriptsModule };
