import test from 'node:test';
import assert from 'node:assert/strict';

import {
  resolveWorkerLowLevelHelperInput,
} from './workerLowLevelHelperInputResolution.js';

test('resolveWorkerLowLevelHelperInput returns exact deps bundle shape', () => {
  const result = resolveWorkerLowLevelHelperInput({
    deps: {
      ethers: 'ethers',
      toStr: 'toStr',
      URL: 'URL',
      Headers: 'Headers',
      normalizeWorkerSessionSlug: 'normalizeWorkerSessionSlug',
      normalizeRpcUrlList: 'normalizeRpcUrlList',
      mergeRpcUrlLists: 'mergeRpcUrlLists',
      toChainId: 'toChainId',
      log: 'log',
      fetch: 'fetch',
      rpcFetch: 'rpcFetch',
      now: 'now',
    },
  });

  assert.deepEqual(result.deps, {
    ethers: 'ethers',
    toStr: 'toStr',
    URL: 'URL',
    Headers: 'Headers',
    normalizeWorkerSessionSlug: 'normalizeWorkerSessionSlug',
    normalizeRpcUrlList: 'normalizeRpcUrlList',
    mergeRpcUrlLists: 'mergeRpcUrlLists',
    toChainId: 'toChainId',
    log: 'log',
    fetch: 'fetch',
    rpcFetch: 'rpcFetch',
    now: 'now',
  });
});

test('resolveWorkerLowLevelHelperInput returns exact constants bundle shape', () => {
  const result = resolveWorkerLowLevelHelperInput({
    constants: {
      ZERO_BYTES32: 'zeroBytes32',
      SESSION_REGISTRY_ABI: ['registry'],
      ERC721_ABI: ['erc721'],
      SBT_ADMIN_ABI: ['sbtAdmin'],
      HATS_ABI: ['hats'],
      FAUCET_SBT_GATE_ABI: ['faucet'],
    },
  });

  assert.deepEqual(result.constants, {
    zeroBytes32: 'zeroBytes32',
    sessionRegistryAbi: ['registry'],
    erc721Abi: ['erc721'],
    sbtAdminAbi: ['sbtAdmin'],
    hatsAbi: ['hats'],
    faucetSbtGateAbi: ['faucet'],
  });
});

test('resolveWorkerLowLevelHelperInput returns exact defaults bundle shape', () => {
  const result = resolveWorkerLowLevelHelperInput({
    defaults: {
      DEFAULT_FAUCET_RPC_URL: 'defaultFaucetRpcUrl',
    },
  });

  assert.deepEqual(result.defaults, {
    defaultFaucetRpcUrl: 'defaultFaucetRpcUrl',
  });
});

test('resolveWorkerLowLevelHelperInput gracefully handles missing/undefined inputs', () => {
  const result = resolveWorkerLowLevelHelperInput();

  assert.deepEqual(result, {
    deps: {
      ethers: undefined,
      toStr: undefined,
      URL: undefined,
      Headers: undefined,
      normalizeWorkerSessionSlug: undefined,
      normalizeRpcUrlList: undefined,
      mergeRpcUrlLists: undefined,
      toChainId: undefined,
      log: undefined,
      fetch: undefined,
      rpcFetch: undefined,
      now: undefined,
    },
    constants: {
      zeroBytes32: undefined,
      sessionRegistryAbi: undefined,
      erc721Abi: undefined,
      sbtAdminAbi: undefined,
      hatsAbi: undefined,
      faucetSbtGateAbi: undefined,
    },
    defaults: {
      defaultFaucetRpcUrl: undefined,
    },
  });
});
