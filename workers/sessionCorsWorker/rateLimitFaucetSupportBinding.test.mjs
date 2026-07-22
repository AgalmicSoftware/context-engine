import test from 'node:test';
import assert from 'node:assert/strict';

import { createRateLimitFaucetSupportWithWorkerDeps } from './rateLimitFaucetSupportBinding.js';

test('createRateLimitFaucetSupportWithWorkerDeps returns the expected helper functions', () => {
  const helpers = createRateLimitFaucetSupportWithWorkerDeps();

  assert.equal(typeof helpers.checkRateLimit, 'function');
  assert.equal(typeof helpers.findSessionGateForSbt, 'function');
  assert.equal(typeof helpers.readSbtFaucetValidationState, 'function');
  assert.equal(typeof helpers.validateSbtPasswordForFaucet, 'function');
});

test('createRateLimitFaucetSupportWithWorkerDeps delegates normalized route limits to durable coordination', async () => {
  const calls = [];
  const env = { GROUP_KV: {} };

  const { checkRateLimit } = createRateLimitFaucetSupportWithWorkerDeps({
    deps: {
      toStr: (value) => (typeof value === 'string' ? value : value == null ? '' : String(value)),
      now: () => 1000,
      checkCoordinatedAuthRateLimit: async (value) => {
        calls.push(value);
        return { ok: true, allowed: true, count: 1 };
      },
    },
  });

  const allowed = await checkRateLimit({
    env,
    slug: 'session-a',
    address: 'Anon:User',
    limit: 2,
    route: 'AI',
  });

  assert.equal(allowed, true);
  assert.deepEqual(calls, [{
    env,
    slug: 'session-a',
    route: 'ai',
    identity: 'anon:user',
    limit: 2,
    windowMs: 86_400_000,
    now: calls[0].now,
  }]);
  assert.equal(calls[0].now(), 1000);
});

test('createRateLimitFaucetSupportWithWorkerDeps records rate-limit denials', async () => {
  const events = [];
  const env = { GROUP_KV: {} };

  const { checkRateLimit } = createRateLimitFaucetSupportWithWorkerDeps({
    deps: {
      toStr: (value) => (typeof value === 'string' ? value : value == null ? '' : String(value)),
      now: () => 1_000,
      recordAbuseEvent: async (event) => {
        events.push(event);
        return { ok: true };
      },
      checkCoordinatedAuthRateLimit: async () => ({ ok: true, allowed: false, count: 3 }),
    },
  });

  const allowed = await checkRateLimit({
    env,
    slug: 'session-a',
    address: '0xabc',
    limit: 2,
    route: 'ai',
  });

  assert.equal(allowed, false);
  assert.equal(events.length, 1);
  assert.equal(events[0].type, 'rate_limit_trips');
});

test('createRateLimitFaucetSupportWithWorkerDeps preserves faucet gate authority helper wiring', () => {
  const helperBundle = {
    findSessionGateForSbt: 'findSessionGateForSbt',
    readSbtFaucetValidationState: 'readSbtFaucetValidationState',
    validateSbtPasswordForFaucet: 'validateSbtPasswordForFaucet',
  };
  const factoryCalls = [];

  const helpers = createRateLimitFaucetSupportWithWorkerDeps({
    deps: {
      createFaucetGateAuthorityWithDeps: (value) => {
        factoryCalls.push(value);
        return helperBundle;
      },
      toStr: 'toStr',
      isAddress: 'isAddress',
      resolveRegistryRpcUrls: 'resolveRegistryRpcUrls',
      normalizeAddressLower: 'normalizeAddressLower',
      toRegistrySessionSlug: 'toRegistrySessionSlug',
      readSessionExistsOnChain: 'readSessionExistsOnChain',
      maskRpcUrl: 'maskRpcUrl',
      readResourceGateOnChain: 'readResourceGateOnChain',
      resolveRpcUrlListForGate: 'resolveRpcUrlListForGate',
      toChainId: 'toChainId',
      rpcRequest: 'rpcRequest',
      getFaucetSbtGateInterface: 'getFaucetSbtGateInterface',
      callContractFunction: 'callContractFunction',
    },
    constants: {
      anonymousGateUnavailableError: 'Access denied: on-chain gate data unavailable.',
      resourceGateKeys: ['default', 'ai', 'txGas'],
      zeroBytes32: '0x00',
    },
  });

  assert.equal(helpers.findSessionGateForSbt, 'findSessionGateForSbt');
  assert.equal(helpers.readSbtFaucetValidationState, 'readSbtFaucetValidationState');
  assert.equal(helpers.validateSbtPasswordForFaucet, 'validateSbtPasswordForFaucet');
  assert.deepEqual(factoryCalls, [{
    deps: {
      toStr: 'toStr',
      isAddress: 'isAddress',
      resolveRegistryRpcUrls: 'resolveRegistryRpcUrls',
      normalizeAddressLower: 'normalizeAddressLower',
      toRegistrySessionSlug: 'toRegistrySessionSlug',
      readSessionExistsOnChain: 'readSessionExistsOnChain',
      maskRpcUrl: 'maskRpcUrl',
      readResourceGateOnChain: 'readResourceGateOnChain',
      resolveRpcUrlListForGate: 'resolveRpcUrlListForGate',
      toChainId: 'toChainId',
      rpcRequest: 'rpcRequest',
      getFaucetSbtGateInterface: 'getFaucetSbtGateInterface',
      callContractFunction: 'callContractFunction',
    },
    constants: {
      anonymousGateUnavailableError: 'Access denied: on-chain gate data unavailable.',
      resourceGateKeys: ['default', 'ai', 'txGas'],
      zeroBytes32: '0x00',
    },
  }]);
});
