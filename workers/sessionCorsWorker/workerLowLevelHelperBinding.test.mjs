import test from 'node:test';
import assert from 'node:assert/strict';

import { createWorkerLowLevelHelpersWithWorkerDeps } from './workerLowLevelHelperBinding.js';

test('createWorkerLowLevelHelpersWithWorkerDeps returns the expected low-level helpers', () => {
  const helpers = createWorkerLowLevelHelpersWithWorkerDeps({
    deps: {
      createOutboundUrlSafetyHelpersWithWorkerDeps: () => ({
        isBlockedOutboundUrl: 'isBlockedOutboundUrl',
        safeFetch: 'safeFetch',
      }),
      createEthersPrimitiveValueHelpersWithWorkerDeps: () => ({
        normalizeSessionIdHex: 'normalizeSessionIdHex',
        toBigInt: 'toBigInt',
        isAddress: 'isAddress',
        getAddress: 'getAddress',
        verifyMessage: 'verifyMessage',
        getBytes: 'getBytes',
        solidityKeccak256: 'solidityKeccak256',
        parseEther: 'parseEther',
        formatEther: 'formatEther',
      }),
      createRegistryFaucetRpcHelpersWithWorkerDeps: () => ({
        toRegistrySessionSlug: 'toRegistrySessionSlug',
        resolveRegistryRpcUrls: 'resolveRegistryRpcUrls',
        resolveRegistryRpcUrl: 'resolveRegistryRpcUrl',
        resolveRpcUrlListForGate: 'resolveRpcUrlListForGate',
        resolveFaucetRpcUrls: 'resolveFaucetRpcUrls',
        isBytes32Hex: 'isBytes32Hex',
      }),
      createEthersInterfaceProviderGateHelpersWithWorkerDeps: () => ({
        getRegistryInterface: 'getRegistryInterface',
        getErc721Interface: 'getErc721Interface',
        getSbtAdminInterface: 'getSbtAdminInterface',
        getHatsInterface: 'getHatsInterface',
        getFaucetSbtGateInterface: 'getFaucetSbtGateInterface',
        isPositiveBalance: 'isPositiveBalance',
        checkSbtGate: 'checkSbtGate',
      }),
      createGroupProofAddressHashHelpersWithWorkerDeps: () => ({
        normalizeAddressLower: 'normalizeAddressLower',
        computeGroupMintMessageHash: 'computeGroupMintMessageHash',
        verifyGroupSignatureForFaucet: 'verifyGroupSignatureForFaucet',
      }),
      createRpcContractProbeHelpersWithWorkerDeps: () => ({
        maskRpcUrl: 'maskRpcUrl',
        rpcRequest: 'rpcRequest',
        callContractFunction: 'callContractFunction',
        callRegistryFunction: 'callRegistryFunction',
        probeRpcUrls: 'probeRpcUrls',
      }),
    },
  });

  assert.deepEqual(helpers, {
    isBlockedOutboundUrl: 'isBlockedOutboundUrl',
    safeFetch: 'safeFetch',
    normalizeSessionIdHex: 'normalizeSessionIdHex',
    toBigInt: 'toBigInt',
    isAddress: 'isAddress',
    getAddress: 'getAddress',
    verifyMessage: 'verifyMessage',
    getBytes: 'getBytes',
    solidityKeccak256: 'solidityKeccak256',
    parseEther: 'parseEther',
    formatEther: 'formatEther',
    toRegistrySessionSlug: 'toRegistrySessionSlug',
    resolveRegistryRpcUrls: 'resolveRegistryRpcUrls',
    resolveRegistryRpcUrl: 'resolveRegistryRpcUrl',
    resolveRpcUrlListForGate: 'resolveRpcUrlListForGate',
    resolveFaucetRpcUrls: 'resolveFaucetRpcUrls',
    isBytes32Hex: 'isBytes32Hex',
    getRegistryInterface: 'getRegistryInterface',
    getErc721Interface: 'getErc721Interface',
    getSbtAdminInterface: 'getSbtAdminInterface',
    getHatsInterface: 'getHatsInterface',
    getFaucetSbtGateInterface: 'getFaucetSbtGateInterface',
    isPositiveBalance: 'isPositiveBalance',
    checkSbtGate: 'checkSbtGate',
    normalizeAddressLower: 'normalizeAddressLower',
    computeGroupMintMessageHash: 'computeGroupMintMessageHash',
    verifyGroupSignatureForFaucet: 'verifyGroupSignatureForFaucet',
    maskRpcUrl: 'maskRpcUrl',
    rpcRequest: 'rpcRequest',
    callContractFunction: 'callContractFunction',
    callRegistryFunction: 'callRegistryFunction',
    probeRpcUrls: 'probeRpcUrls',
  });
});

test('createWorkerLowLevelHelpersWithWorkerDeps preserves low-level worker assembly bundles and cross-helper wiring', () => {
  const calls = [];
  let interfaceDeps = null;

  const helpers = createWorkerLowLevelHelpersWithWorkerDeps({
    deps: {
      createOutboundUrlSafetyHelpersWithWorkerDeps: (value) => {
        calls.push('outbound');
        assert.deepEqual(value, {
          deps: {
            toStr: 'toStr',
            URL: 'URL',
            Headers: 'Headers',
            fetch: 'fetch',
          },
        });
        return {
          isBlockedOutboundUrl: 'isBlockedOutboundUrl',
          safeFetch: 'safeFetch',
        };
      },
      createEthersPrimitiveValueHelpersWithWorkerDeps: (value) => {
        calls.push('primitive');
        assert.deepEqual(value, {
          deps: {
            ethers: 'ethers',
            toStr: 'toStr',
          },
        });
        return {
          normalizeSessionIdHex: 'normalizeSessionIdHex',
          toBigInt: 'toBigInt',
          isAddress: 'isAddress',
          getAddress: 'getAddress',
          verifyMessage: 'verifyMessage',
          getBytes: 'getBytes',
          solidityKeccak256: 'solidityKeccak256',
          parseEther: 'parseEther',
          formatEther: 'formatEther',
        };
      },
      createRegistryFaucetRpcHelpersWithWorkerDeps: (value) => {
        calls.push('registryRpc');
        assert.deepEqual(value, {
          deps: {
            normalizeWorkerSessionSlug: 'normalizeWorkerSessionSlug',
            normalizeRpcUrlList: 'normalizeRpcUrlList',
            mergeRpcUrlLists: 'mergeRpcUrlLists',
            toChainId: 'toChainId',
            toStr: 'toStr',
          },
          defaults: {
            defaultFaucetRpcUrl: 'defaultFaucetRpcUrl',
          },
        });
        return {
          toRegistrySessionSlug: 'toRegistrySessionSlug',
          resolveRegistryRpcUrls: 'resolveRegistryRpcUrls',
          resolveRegistryRpcUrl: 'resolveRegistryRpcUrl',
          resolveRpcUrlListForGate: 'resolveRpcUrlListForGate',
          resolveFaucetRpcUrls: 'resolveFaucetRpcUrls',
          isBytes32Hex: 'isBytes32Hex',
        };
      },
      createEthersInterfaceProviderGateHelpersWithWorkerDeps: (value) => {
        calls.push('interface');
        interfaceDeps = value.deps;
        assert.equal(value.deps.ethers, 'ethers');
        assert.equal(value.deps.toChainId, 'toChainId');
        assert.equal(value.deps.toStr, 'toStr');
        assert.equal(value.deps.isAddress, 'isAddress');
        assert.equal(value.deps.resolveRegistryRpcUrl, 'resolveRegistryRpcUrl');
        assert.equal(typeof value.deps.callContractFunction, 'function');
        assert.equal(typeof value.deps.maskRpcUrl, 'function');
        assert.equal(value.deps.log, 'log');
        assert.deepEqual(value.constants, {
          sessionRegistryAbi: ['registry'],
          erc721Abi: ['erc721'],
          sbtAdminAbi: ['sbtAdmin'],
          hatsAbi: ['hats'],
          faucetSbtGateAbi: ['faucet'],
        });
        return {
          getRegistryInterface: () => 'getRegistryInterface',
          getErc721Interface: 'getErc721Interface',
          getSbtAdminInterface: 'getSbtAdminInterface',
          getHatsInterface: 'getHatsInterface',
          getFaucetSbtGateInterface: 'getFaucetSbtGateInterface',
          isPositiveBalance: 'isPositiveBalance',
          checkSbtGate: 'checkSbtGate',
        };
      },
      createGroupProofAddressHashHelpersWithWorkerDeps: (value) => {
        calls.push('groupProof');
        assert.deepEqual(value, {
          deps: {
            toStr: 'toStr',
            isAddress: 'isAddress',
            getAddress: 'getAddress',
            verifyMessage: 'verifyMessage',
            getBytes: 'getBytes',
            solidityKeccak256: 'solidityKeccak256',
          },
          constants: {
            zeroBytes32: 'zeroBytes32',
          },
        });
        return {
          normalizeAddressLower: 'normalizeAddressLower',
          computeGroupMintMessageHash: 'computeGroupMintMessageHash',
          verifyGroupSignatureForFaucet: 'verifyGroupSignatureForFaucet',
        };
      },
      createRpcContractProbeHelpersWithWorkerDeps: (value) => {
        calls.push('rpcProbe');
        assert.equal(value.deps.toStr, 'toStr');
        assert.equal(value.deps.fetch, 'rpcFetch');
        assert.equal(value.deps.URL, 'URL');
        assert.equal(value.deps.isBlockedOutboundUrl, 'isBlockedOutboundUrl');
        assert.equal(value.deps.now, 'now');
        assert.equal(value.deps.log, 'log');
        assert.equal(value.deps.getRegistryInterface(), 'getRegistryInterface');
        return {
          maskRpcUrl: (...args) => ['maskRpcUrl', ...args],
          rpcRequest: 'rpcRequest',
          callContractFunction: (...args) => ['callContractFunction', ...args],
          callRegistryFunction: 'callRegistryFunction',
          probeRpcUrls: 'probeRpcUrls',
        };
      },
      ethers: 'ethers',
      toStr: 'toStr',
      URL: 'URL',
      Headers: 'Headers',
      fetch: 'fetch',
      normalizeWorkerSessionSlug: 'normalizeWorkerSessionSlug',
      normalizeRpcUrlList: 'normalizeRpcUrlList',
      mergeRpcUrlLists: 'mergeRpcUrlLists',
      toChainId: 'toChainId',
      log: 'log',
      rpcFetch: 'rpcFetch',
      now: 'now',
    },
    constants: {
      zeroBytes32: 'zeroBytes32',
      sessionRegistryAbi: ['registry'],
      erc721Abi: ['erc721'],
      sbtAdminAbi: ['sbtAdmin'],
      hatsAbi: ['hats'],
      faucetSbtGateAbi: ['faucet'],
    },
    defaults: {
      defaultFaucetRpcUrl: 'defaultFaucetRpcUrl',
    },
  });

  assert.deepEqual(interfaceDeps.callContractFunction('a'), ['callContractFunction', 'a']);
  assert.deepEqual(interfaceDeps.maskRpcUrl('b'), ['maskRpcUrl', 'b']);
  assert.equal(helpers.isBlockedOutboundUrl, 'isBlockedOutboundUrl');
  assert.equal(helpers.safeFetch, 'safeFetch');
  assert.equal(helpers.normalizeSessionIdHex, 'normalizeSessionIdHex');
  assert.equal(helpers.checkSbtGate, 'checkSbtGate');
  assert.equal(helpers.verifyGroupSignatureForFaucet, 'verifyGroupSignatureForFaucet');
  assert.equal(helpers.resolveFaucetRpcUrls, 'resolveFaucetRpcUrls');
  assert.equal(helpers.callRegistryFunction, 'callRegistryFunction');
  assert.equal(helpers.probeRpcUrls, 'probeRpcUrls');
  assert.deepEqual(calls, [
    'outbound',
    'primitive',
    'registryRpc',
    'interface',
    'groupProof',
    'rpcProbe',
  ]);
});
