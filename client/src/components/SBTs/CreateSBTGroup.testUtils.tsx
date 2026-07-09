import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { ethers } from 'ethers';
import CreateSBTGroup from './CreateSBTGroup';
import gateLockStyles from '../Gates/GateMultiSelectLock.module.scss';
import contractScripts from '../../utilities/web3/chainGateway.js';
import * as cacheScripts from '../../utilities/cache/cacheScripts.js';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import { getScopedCreateSbtFormCacheKey } from '../../utilities/sbt/sbtCreateFormCache.js';
import { SBT_PASSWORD_RECOVERY_STORAGE_KEY } from '../../utilities/sbt/sbtPasswordRecoveryStore.js';
import { t } from '../../utilities/ui/terminology.js';

const mockFetchImageFromURL = jest.fn();

jest.mock('../../utilities/ui/imageFetchClient.js', () => {
  const actual = jest.requireActual('../../utilities/ui/imageFetchClient.js');
  return {
    __esModule: true,
    ...actual,
    fetchImageFromURL: (...args) => mockFetchImageFromURL(...args),
  };
});

export const REGISTRY_CACHE_KEY = 'dg:sessionRegistryCache:v1';
const SBT_FACTORY_RECEIPT_TEST_IFACE = new ethers.utils.Interface([
  'event SBTCreated(address indexed sbtAddress)',
  'event SBTCreatedDeterministic(address indexed sbtAddress, bytes32 indexed salt)',
]);

export const makeFactoryReceiptLog = (eventName, args) => {
  const encoded = SBT_FACTORY_RECEIPT_TEST_IFACE.encodeEventLog(
    SBT_FACTORY_RECEIPT_TEST_IFACE.getEvent(eventName),
    args,
  );
  return {
    address: '0x00000000000000000000000000000000000000fa',
    topics: encoded.topics,
    data: encoded.data,
  };
};

export const makeInstance = (props = {}) => {
  const instance = new CreateSBTGroup(props);
  instance.setState = (update, cb) => {
    const next = typeof update === 'function' ? update(instance.state) : update;
    instance.state = { ...instance.state, ...next };
    if (cb) cb();
  };
  return instance;
};

// This broad suite intentionally keeps CreateSBT cache, deploy, gate, and mint flows whose setup crosses component concerns.

export const setupCreateSBTGroupTestLifecycle = () => {
  beforeEach(() => {
    sessionStorage.clear();
    mockFetchImageFromURL.mockReset();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    delete window.ethereum;
    delete window.__litHooks;
    delete window.litHooks;
  });
};

export {
  act,
  fireEvent,
  render,
  screen,
  within,
  ethers,
  CreateSBTGroup,
  gateLockStyles,
  contractScripts,
  cacheScripts,
  E2E_TESTIDS,
  getScopedCreateSbtFormCacheKey,
  SBT_PASSWORD_RECOVERY_STORAGE_KEY,
  t,
  mockFetchImageFromURL,
};
