import CreateQuestionsAndSurveys, {
  hasSubmittedResourcesInManagedCache,
  readManagedCacheSnapshot,
  sanitizeDocumentUrls,
  selectManagedNetBucketSnapshot,
} from './CreateQuestionsAndSurveys';
import { renderToStaticMarkup } from 'react-dom/server';
import * as cacheScripts from '../../utilities/cache/cacheScripts.js';
import { arweaveScripts } from '../../utilities/arweave/arweaveScripts';
import { normalizeArweaveUrl } from '../../utilities/arweave/arweaveUrls.js';
import * as resourceKeys from '../../utilities/session/resourceKeys.js';
import contractScripts from '../../utilities/web3/contractScripts.js';
import { sessionRegistryStore, sessionRegistryUtils } from '../../utilities/web3/sessionRegistry.js';
import { getChainById, getDefaultHttpRpc } from '../../variables/chains.js';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import { cryptoUtils } from '../../utilities/crypto/cryptography.js';

jest.mock('../../utilities/cache/cacheScripts.js', () => ({
  peekCacheSync: jest.fn(() => null),
  removeCache: jest.fn(),
  subscribeCacheUpdates: jest.fn(() => () => {}),
  writeCache: jest.fn(),
  writeCacheOptimistic: jest.fn(),
}));

const REGISTRY_CACHE_KEY = 'dg:sessionRegistryCache:v1';
type TreeNode = any;
type TreePredicate = (node: TreeNode) => boolean;
type CreateQuestionsAndSurveysProps = Record<string, any>;
const peekCacheSyncMock = cacheScripts.peekCacheSync as jest.Mock;
const subscribeCacheUpdatesMock = cacheScripts.subscribeCacheUpdates as jest.Mock;
const writeCacheOptimisticMock = cacheScripts.writeCacheOptimistic as jest.Mock;

const makeInstance = (props: CreateQuestionsAndSurveysProps = {}): any => {
  const instance = new CreateQuestionsAndSurveys({
    network: { id: 84532 },
    activeSessionSlug: 'edge',
    ...props,
  }) as any;
  instance._isMounted = true;
  instance.setState = jest.fn((update, cb) => {
    const patch = typeof update === 'function'
      ? update(instance.state, instance.props)
      : update;
    if (patch && typeof patch === 'object') {
      instance.state = { ...instance.state, ...patch };
    }
    if (typeof cb === 'function') cb();
  });
  return instance;
};

const collectTreeNodes = (node: TreeNode, predicate: TreePredicate, acc: TreeNode[] = []): TreeNode[] => {
  if (node == null) return acc;
  if (Array.isArray(node)) {
    node.forEach((child) => collectTreeNodes(child, predicate, acc));
    return acc;
  }
  if (typeof node !== 'object') return acc;
  if (predicate(node)) acc.push(node);
  return collectTreeNodes(node?.props?.children, predicate, acc);
};

const treeHasText = (node: TreeNode, text: string): boolean => {
  if (node == null) return false;
  if (Array.isArray(node)) return node.some((child) => treeHasText(child, text));
  if (typeof node === 'string' || typeof node === 'number') {
    return String(node).includes(text);
  }
  if (typeof node !== 'object') return false;
  return treeHasText(node?.props?.children, text);
};

const nodeHasClassName = (node: TreeNode, className: string): boolean => {
  const raw = node?.props?.className;
  if (!raw) return false;
  return String(raw).split(/\s+/).includes(className);
};

export {
  CreateQuestionsAndSurveys,
  hasSubmittedResourcesInManagedCache,
  readManagedCacheSnapshot,
  sanitizeDocumentUrls,
  selectManagedNetBucketSnapshot,
  renderToStaticMarkup,
  cacheScripts,
  arweaveScripts,
  normalizeArweaveUrl,
  resourceKeys,
  contractScripts,
  sessionRegistryStore,
  sessionRegistryUtils,
  getChainById,
  getDefaultHttpRpc,
  E2E_TESTIDS,
  cryptoUtils,
  REGISTRY_CACHE_KEY,
  peekCacheSyncMock,
  subscribeCacheUpdatesMock,
  writeCacheOptimisticMock,
  makeInstance,
  collectTreeNodes,
  treeHasText,
  nodeHasClassName,
};
