import test from 'node:test';
import assert from 'node:assert/strict';

import { createFaucetWithWorkerDeps } from './faucetExecutionBinding.js';

test('createFaucetWithWorkerDeps preserves the worker-specific faucet deps bundle', async () => {
  const payload = { action: 'request_test_eth', address: '0xabc' };
  const secrets = { faucetPrivateKey: '0x123' };
  const config = { faucet: { rpcUrl: 'https://rpc.example' } };
  const baseHeaders = { 'Access-Control-Allow-Origin': 'https://allowed.example' };
  const logs = [];
  const response = new Response('ok');

  const faucet = createFaucetWithWorkerDeps({
    deps: {
      faucet: async (value) => {
        assert.equal(value.payload, payload);
        assert.equal(value.secrets, secrets);
        assert.equal(value.config, config);
        assert.equal(value.baseHeaders, baseHeaders);
        assert.equal(value.slug, 'session-a');
        assert.equal(value.requesterAddress, '0xdef');
        assert.equal(value.tokenHasFaucetScope, true);
        assert.equal(value.deps.json, 'json');
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
        assert.equal(value.constants.anonymousGateUnavailableError, 'Access denied.');
        assert.equal(value.constants.zeroBytes32, '0x00');
        assert.equal(value.defaults.defaultRpcUrl, 'https://default-rpc.example');
        assert.equal(value.defaults.defaultAmountEth, '0.0002');
        assert.equal(value.defaults.defaultThresholdEth, '0.001');

        value.deps.log('[faucet] request', { to: '0xabc' });
        return response;
      },
      json: 'json',
      log: (...args) => {
        logs.push(args);
      },
      normalizeFaucetRequest: 'normalizeFaucetRequest',
      validateFaucetEligibilityRequest: 'validateFaucetEligibilityRequest',
      Wallet: 'Wallet',
      rpcRequest: 'rpcRequest',
      toStr: 'toStr',
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
    },
    constants: {
      anonymousGateUnavailableError: 'Access denied.',
      zeroBytes32: '0x00',
    },
    defaults: {
      defaultRpcUrl: 'https://default-rpc.example',
      defaultAmountEth: '0.0002',
      defaultThresholdEth: '0.001',
    },
  });

  const result = await faucet({
    payload,
    secrets,
    config,
    baseHeaders,
    slug: 'session-a',
    requesterAddress: '0xdef',
    tokenHasFaucetScope: true,
  });

  assert.equal(result, response);
  assert.deepEqual(logs, [[
    '[faucet] request',
    { to: '0xabc' },
  ]]);
});
