import test from 'node:test';
import assert from 'node:assert/strict';

import { createWorkerExecutionServicesWithWorkerDeps } from './workerExecutionServiceBinding.js';

test('createWorkerExecutionServicesWithWorkerDeps returns the expected services', () => {
  const services = createWorkerExecutionServicesWithWorkerDeps({
    deps: {
      createAiProviderProxiesWithWorkerDeps: () => ({
        proxyAnthropic: 'proxyAnthropic',
        proxyOpenAI: 'proxyOpenAI',
        proxyOpenRouter: 'proxyOpenRouter',
        proxyCustomRPC: 'proxyCustomRPC',
      }),
      createTranscribeWithWorkerDeps: () => 'transcribe',
      createFaucetWithWorkerDeps: () => 'faucet',
      createFetchHelpersWithWorkerDeps: () => ({
        fetchImage: 'fetchImage',
        fetchUrl: 'fetchUrl',
      }),
      createArweaveUploadWithWorkerDeps: () => 'arweaveUpload',
      createVerifyAdminSignatureWithWorkerDeps: () => 'verifyAdminSignature',
    },
  });

  assert.equal(services.proxyAnthropic, 'proxyAnthropic');
  assert.equal(services.proxyOpenAI, 'proxyOpenAI');
  assert.equal(services.proxyOpenRouter, 'proxyOpenRouter');
  assert.equal(services.proxyCustomRPC, 'proxyCustomRPC');
  assert.equal(services.transcribe, 'transcribe');
  assert.equal(services.faucet, 'faucet');
  assert.equal(services.fetchImage, 'fetchImage');
  assert.equal(services.fetchUrl, 'fetchUrl');
  assert.equal(services.arweaveUpload, 'arweaveUpload');
  assert.equal(services.verifyAdminSignature, 'verifyAdminSignature');
});

test('createWorkerExecutionServicesWithWorkerDeps preserves worker-local service assembly bundles', () => {
  const calls = [];
  const log = () => {};

  const services = createWorkerExecutionServicesWithWorkerDeps({
    deps: {
      createAiProviderProxiesWithWorkerDeps: (value) => {
        calls.push('ai');
        assert.deepEqual(value, {
          deps: {
            json: 'json',
            safeFetch: 'safeFetch',
            isBlockedOutboundUrl: 'isBlockedOutboundUrl',
          },
        });
        return {
          proxyAnthropic: 'proxyAnthropic',
          proxyOpenAI: 'proxyOpenAI',
          proxyOpenRouter: 'proxyOpenRouter',
          proxyCustomRPC: 'proxyCustomRPC',
        };
      },
      createTranscribeWithWorkerDeps: (value) => {
        calls.push('transcribe');
        assert.deepEqual(value, {
          deps: {
            json: 'json',
            toStr: 'toStr',
            readTranscribeRequestPayload: 'readTranscribeRequestPayload',
            isBlockedOutboundUrl: 'isBlockedOutboundUrl',
            safeFetch: 'safeFetch',
          },
          constants: {
            openAiTranscribeUrl: 'https://api.openai.example/v1/audio/transcriptions',
          },
        });
        return 'transcribe';
      },
      createFaucetWithWorkerDeps: (value) => {
        calls.push('faucet');
        assert.equal(value.deps.json, 'json');
        assert.equal(typeof value.deps.log, 'function');
        assert.equal(value.deps.normalizeFaucetRequest, 'normalizeFaucetRequest');
        assert.equal(value.deps.validateFaucetEligibilityRequest, 'validateFaucetEligibilityRequest');
        assert.equal(value.deps.Wallet, 'Wallet');
        assert.equal(value.deps.rpcRequest, 'rpcRequest');
        assert.equal(value.deps.toStr, 'toStr');
        assert.equal(value.deps.toChainId, 'toChainId');
        assert.equal(value.deps.toBigInt, 'toBigInt');
        assert.equal(value.deps.formatEther, 'formatEther');
        assert.equal(value.deps.maskRpcUrl, 'maskRpcUrl');
        assert.equal(value.deps.isAddress, 'isAddress');
        assert.equal(value.deps.parseEther, 'parseEther');
        assert.equal(value.deps.resolveFaucetRpcUrls, 'resolveFaucetRpcUrls');
        assert.equal(value.deps.isBytes32Hex, 'isBytes32Hex');
        assert.equal(value.deps.normalizeAddressLower, 'normalizeAddressLower');
        assert.equal(value.deps.resolveRegistryRpcUrls, 'resolveRegistryRpcUrls');
        assert.equal(value.deps.toRegistrySessionSlug, 'toRegistrySessionSlug');
        assert.equal(value.deps.readSessionExistsOnChain, 'readSessionExistsOnChain');
        assert.equal(value.deps.readResourceGateOnChain, 'readResourceGateOnChain');
        assert.equal(value.deps.resolveRpcUrlListForGate, 'resolveRpcUrlListForGate');
        assert.equal(value.deps.checkSbtGate, 'checkSbtGate');
        assert.equal(value.deps.findSessionGateForSbt, 'findSessionGateForSbt');
        assert.equal(value.deps.readSbtFaucetValidationState, 'readSbtFaucetValidationState');
        assert.equal(value.deps.validateSbtPasswordForFaucet, 'validateSbtPasswordForFaucet');
        assert.equal(value.deps.verifyGroupSignatureForFaucet, 'verifyGroupSignatureForFaucet');
        assert.deepEqual(value.constants, {
          anonymousGateUnavailableError: 'anonymousGateUnavailableError',
          zeroBytes32: 'zeroBytes32',
        });
        assert.deepEqual(value.defaults, {
          defaultRpcUrl: 'defaultRpcUrl',
          defaultAmountEth: 'defaultAmountEth',
          defaultThresholdEth: 'defaultThresholdEth',
        });
        return 'faucet';
      },
      createFetchHelpersWithWorkerDeps: (value) => {
        calls.push('fetch');
        assert.deepEqual(value, {
          deps: {
            json: 'json',
            normalizeFetchTargetUrl: 'normalizeFetchTargetUrl',
            isBlockedOutboundUrl: 'isBlockedOutboundUrl',
            safeFetch: 'safeFetch',
          },
        });
        return {
          fetchImage: 'fetchImage',
          fetchUrl: 'fetchUrl',
        };
      },
      createArweaveUploadWithWorkerDeps: (value) => {
        calls.push('arweave');
        assert.equal(value.deps.json, 'json');
        assert.equal(typeof value.deps.log, 'function');
        assert.equal(value.deps.toStr, 'toStr');
        assert.equal(value.deps.readArweaveUploadRequestPayload, 'readArweaveUploadRequestPayload');
        assert.equal(value.deps.resolveArweaveUploadJwk, 'resolveArweaveUploadJwk');
        assert.equal(value.deps.normalizeArweaveCeTags, 'normalizeArweaveCeTags');
        assert.equal(value.deps.normalizeArweaveAssociationTags, 'normalizeArweaveAssociationTags');
        assert.equal(value.deps.callContractFunction, 'callContractFunction');
        assert.equal(value.deps.readSessionBySlugOnChain, 'readSessionBySlugOnChain');
        assert.equal(value.deps.getErc721Interface, 'getErc721Interface');
        assert.equal(value.deps.getSbtAdminInterface, 'getSbtAdminInterface');
        assert.equal(value.deps.isAddress, 'isAddress');
        assert.equal(value.deps.isPositiveBalance, 'isPositiveBalance');
        assert.equal(value.deps.normalizeSessionIdHex, 'normalizeSessionIdHex');
        assert.equal(value.deps.resolveRegistryRpcUrls, 'resolveRegistryRpcUrls');
        assert.equal(value.deps.resolveRpcUrlListForGate, 'resolveRpcUrlListForGate');
        assert.equal(value.deps.toChainId, 'toChainId');
        assert.equal(value.deps.toRegistrySessionSlug, 'toRegistrySessionSlug');
        return 'arweaveUpload';
      },
      createVerifyAdminSignatureWithWorkerDeps: (value) => {
        calls.push('adminSignature');
        assert.equal(value.deps.normalizeSignedWorkerRequest, 'normalizeSignedWorkerRequest');
        assert.equal(value.deps.resolveWorkerBodySlugContext, 'resolveWorkerBodySlugContext');
        assert.equal(value.deps.toStr, 'toStr');
        assert.equal(value.deps.isAddress, 'isAddress');
        assert.equal(value.deps.json, 'json');
        assert.equal(value.deps.verifyMessage, 'verifyMessage');
        assert.equal(value.deps.validateRecoveredAddressMatchesRequest, 'validateRecoveredAddressMatchesRequest');
        assert.equal(value.deps.parseSiweMessage, 'parseSiweMessage');
        assert.equal(value.deps.validateSiwe, 'validateSiwe');
        assert.equal(value.deps.validateSiweAddressMatchesRequest, 'validateSiweAddressMatchesRequest');
        assert.equal(value.deps.consumeNonce, 'consumeNonce');
        assert.equal(value.deps.validateAdmin, 'validateAdmin');
        assert.equal(typeof value.deps.log, 'function');
        assert.deepEqual(value.constants, {
          usedNonceTtlSeconds: 'usedNonceTtlSeconds',
          missingSlugError: 'missingSlugError',
          slugAliasMismatchError: 'slugAliasMismatchError',
          slugMismatchError: 'slugMismatchError',
        });
        return 'verifyAdminSignature';
      },
      json: 'json',
      safeFetch: 'safeFetch',
      isBlockedOutboundUrl: 'isBlockedOutboundUrl',
      toStr: 'toStr',
      readTranscribeRequestPayload: 'readTranscribeRequestPayload',
      normalizeFaucetRequest: 'normalizeFaucetRequest',
      validateFaucetEligibilityRequest: 'validateFaucetEligibilityRequest',
      Wallet: 'Wallet',
      rpcRequest: 'rpcRequest',
      toChainId: 'toChainId',
      toBigInt: 'toBigInt',
      formatEther: 'formatEther',
      maskRpcUrl: 'maskRpcUrl',
      isAddress: 'isAddress',
      parseEther: 'parseEther',
      resolveFaucetRpcUrls: 'resolveFaucetRpcUrls',
      isBytes32Hex: 'isBytes32Hex',
      normalizeAddressLower: 'normalizeAddressLower',
      resolveRegistryRpcUrls: 'resolveRegistryRpcUrls',
      toRegistrySessionSlug: 'toRegistrySessionSlug',
      readSessionExistsOnChain: 'readSessionExistsOnChain',
      readResourceGateOnChain: 'readResourceGateOnChain',
      resolveRpcUrlListForGate: 'resolveRpcUrlListForGate',
      checkSbtGate: 'checkSbtGate',
      findSessionGateForSbt: 'findSessionGateForSbt',
      readSbtFaucetValidationState: 'readSbtFaucetValidationState',
      validateSbtPasswordForFaucet: 'validateSbtPasswordForFaucet',
      verifyGroupSignatureForFaucet: 'verifyGroupSignatureForFaucet',
      normalizeFetchTargetUrl: 'normalizeFetchTargetUrl',
      readArweaveUploadRequestPayload: 'readArweaveUploadRequestPayload',
      resolveArweaveUploadJwk: 'resolveArweaveUploadJwk',
      normalizeArweaveCeTags: 'normalizeArweaveCeTags',
      normalizeArweaveAssociationTags: 'normalizeArweaveAssociationTags',
      callContractFunction: 'callContractFunction',
      readSessionBySlugOnChain: 'readSessionBySlugOnChain',
      getErc721Interface: 'getErc721Interface',
      getSbtAdminInterface: 'getSbtAdminInterface',
      isPositiveBalance: 'isPositiveBalance',
      normalizeSessionIdHex: 'normalizeSessionIdHex',
      normalizeSignedWorkerRequest: 'normalizeSignedWorkerRequest',
      resolveWorkerBodySlugContext: 'resolveWorkerBodySlugContext',
      verifyMessage: 'verifyMessage',
      validateRecoveredAddressMatchesRequest: 'validateRecoveredAddressMatchesRequest',
      parseSiweMessage: 'parseSiweMessage',
      validateSiwe: 'validateSiwe',
      validateSiweAddressMatchesRequest: 'validateSiweAddressMatchesRequest',
      consumeNonce: 'consumeNonce',
      validateAdmin: 'validateAdmin',
      log,
    },
    constants: {
      openAiTranscribeUrl: 'https://api.openai.example/v1/audio/transcriptions',
      anonymousGateUnavailableError: 'anonymousGateUnavailableError',
      zeroBytes32: 'zeroBytes32',
      usedNonceTtlSeconds: 'usedNonceTtlSeconds',
      missingSlugError: 'missingSlugError',
      slugAliasMismatchError: 'slugAliasMismatchError',
      slugMismatchError: 'slugMismatchError',
    },
    defaults: {
      defaultRpcUrl: 'defaultRpcUrl',
      defaultAmountEth: 'defaultAmountEth',
      defaultThresholdEth: 'defaultThresholdEth',
    },
  });

  assert.equal(services.proxyAnthropic, 'proxyAnthropic');
  assert.equal(services.proxyOpenAI, 'proxyOpenAI');
  assert.equal(services.proxyOpenRouter, 'proxyOpenRouter');
  assert.equal(services.proxyCustomRPC, 'proxyCustomRPC');
  assert.equal(services.transcribe, 'transcribe');
  assert.equal(services.faucet, 'faucet');
  assert.equal(services.fetchImage, 'fetchImage');
  assert.equal(services.fetchUrl, 'fetchUrl');
  assert.equal(services.arweaveUpload, 'arweaveUpload');
  assert.equal(services.verifyAdminSignature, 'verifyAdminSignature');
  assert.deepEqual(calls, [
    'ai',
    'transcribe',
    'faucet',
    'fetch',
    'arweave',
    'adminSignature',
  ]);
});
