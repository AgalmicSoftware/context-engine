import test from 'node:test';
import assert from 'node:assert/strict';

import { createFaucetGateAuthorityWithDeps } from './faucetGateAuthority.js';

test('createFaucetGateAuthorityWithDeps returns the expected helper functions', () => {
  const helpers = createFaucetGateAuthorityWithDeps();

  assert.equal(typeof helpers.findSessionGateForSbt, 'function');
  assert.equal(typeof helpers.readSbtFaucetValidationState, 'function');
  assert.equal(typeof helpers.validateSbtPasswordForFaucet, 'function');
});

test('createFaucetGateAuthorityWithDeps preserves session-gate lookup ordering and fail-closed outputs', async () => {
  const gateCalls = [];
  const { findSessionGateForSbt } = createFaucetGateAuthorityWithDeps({
    deps: {
      toStr: (value) => (typeof value === 'string' ? value : value == null ? '' : String(value)),
      isAddress: (value) => /^0x[0-9a-fA-F]{40}$/.test(String(value).trim()),
      resolveRegistryRpcUrls: () => ['https://rpc.example'],
      normalizeAddressLower: (value) => String(value || '').trim().toLowerCase(),
      toRegistrySessionSlug: (value) => {
        const slug = String(value || '').trim().toLowerCase();
        return slug === 'debate' ? 'rxc' : (slug || 'general');
      },
      readSessionExistsOnChain: async () => ({
        exists: true,
        rpcUrl: 'https://rpc.example',
        errors: [],
      }),
      maskRpcUrl: (value) => `masked:${String(value).trim()}`,
      readResourceGateOnChain: async ({ resourceKey, registrySlug }) => {
        gateCalls.push([resourceKey, registrySlug]);
        if (resourceKey === 'txGas') {
          return { ok: false, error: 'Registry gate lookup failed.', errors: [{ rpcUrl: 'masked:https://rpc.example', error: 'down' }] };
        }
        if (resourceKey === 'default') {
          return {
            ok: true,
            gate: {
              sbtAddresses: ['0x00000000000000000000000000000000000000AA'],
              chainId: 84532,
              mode: 0,
            },
            errors: [],
          };
        }
        return { ok: true, gate: { sbtAddresses: [], chainId: 84532, mode: 0 }, errors: [] };
      },
    },
    constants: {
      anonymousGateUnavailableError: 'Access denied: on-chain gate data unavailable.',
      resourceGateKeys: ['default', 'ai', 'txGas'],
    },
  });

  const match = await findSessionGateForSbt({
    slug: 'debate',
    config: {
      registryAddress: '0x0000000000000000000000000000000000000001',
      rpcUrl: 'https://rpc.example',
    },
    sbtAddress: '0x00000000000000000000000000000000000000aa',
  });

  assert.deepEqual(match, {
    ok: true,
    resourceKey: 'default',
    gate: {
      sbtAddresses: ['0x00000000000000000000000000000000000000AA'],
      chainId: 84532,
      mode: 0,
    },
  });
  assert.deepEqual(gateCalls, [
    ['txGas', 'rxc'],
    ['default', 'rxc'],
  ]);

  const unavailable = await findSessionGateForSbt({
    slug: 'session-b',
    config: {
      registryAddress: '',
    },
    sbtAddress: '0x00000000000000000000000000000000000000aa',
  });
  assert.deepEqual(unavailable, {
    ok: false,
    status: 403,
    error: 'Access denied: on-chain gate data unavailable.',
    reason: 'registry-unavailable',
  });

  const sessionUnavailable = await createFaucetGateAuthorityWithDeps({
    deps: {
      toStr: (value) => (typeof value === 'string' ? value : value == null ? '' : String(value)),
      isAddress: (value) => /^0x[0-9a-fA-F]{40}$/.test(String(value).trim()),
      resolveRegistryRpcUrls: () => ['https://rpc.example'],
      normalizeAddressLower: (value) => String(value || '').trim().toLowerCase(),
      toRegistrySessionSlug: (value) => String(value || '').trim().toLowerCase() || 'general',
      readSessionExistsOnChain: async () => ({
        exists: null,
        rpcUrl: 'https://rpc.example',
        errors: [{ rpcUrl: 'masked:https://rpc.example', error: 'down' }],
      }),
      maskRpcUrl: (value) => `masked:${String(value).trim()}`,
      readResourceGateOnChain: async () => ({ ok: true, gate: { sbtAddresses: [], chainId: 84532 }, errors: [] }),
    },
    constants: {
      anonymousGateUnavailableError: 'Access denied: on-chain gate data unavailable.',
    },
  }).findSessionGateForSbt({
    slug: 'session-c',
    config: {
      registryAddress: '0x0000000000000000000000000000000000000001',
      rpcUrl: 'https://rpc.example',
    },
    sbtAddress: '0x00000000000000000000000000000000000000aa',
  });

  assert.deepEqual(sessionUnavailable, {
    ok: false,
    status: 403,
    error: 'Access denied: on-chain gate data unavailable.',
    reason: 'session-check-unavailable',
    details: {
      registryAddress: '0x0000000000000000000000000000000000000001',
      rpcUrl: 'masked:https://rpc.example',
      errors: [{ rpcUrl: 'masked:https://rpc.example', error: 'down' }],
    },
  });
});

test('createFaucetGateAuthorityWithDeps preserves faucet validation-state reads and masked rpc fallback errors', async () => {
  const calls = [];
  const { readSbtFaucetValidationState } = createFaucetGateAuthorityWithDeps({
    deps: {
      resolveRpcUrlListForGate: () => ['https://rpc-1.example', 'https://rpc-2.example'],
      toChainId: (value) => Number(value) || 0,
      getFaucetSbtGateInterface: () => 'iface',
      callContractFunction: async ({ rpcUrl, method }) => {
        calls.push([rpcUrl, method]);
        if (rpcUrl === 'https://rpc-1.example') {
          const error = new Error('boom');
          error.rpcStatus = 502;
          error.rpcError = { message: 'down' };
          throw error;
        }
        return method === 'hasPasswordMint' ? [true] : ['0xabc'];
      },
      maskRpcUrl: (value) => `masked:${String(value).trim()}`,
      toStr: (value) => (typeof value === 'string' ? value : value == null ? '' : String(value)),
    },
    constants: {
      zeroBytes32: '0x00',
    },
  });

  const result = await readSbtFaucetValidationState({
    config: {},
    gateChainId: 84532,
    sbtAddress: '0x0000000000000000000000000000000000000101',
  });

  assert.deepEqual(result, {
    ok: true,
    rpcUrl: 'https://rpc-2.example',
    hasPasswordMint: true,
    groupPasswordHash: '0xabc',
  });
  assert.deepEqual(calls, [
    ['https://rpc-1.example', 'hasPasswordMint'],
    ['https://rpc-1.example', 'groupPasswordHash'],
    ['https://rpc-2.example', 'hasPasswordMint'],
    ['https://rpc-2.example', 'groupPasswordHash'],
  ]);
});

test('createFaucetGateAuthorityWithDeps preserves password-validation reads and missing-rpc failures', async () => {
  const { validateSbtPasswordForFaucet } = createFaucetGateAuthorityWithDeps({
    deps: {
      resolveRpcUrlListForGate: () => [],
      toChainId: (value) => Number(value) || 0,
      getFaucetSbtGateInterface: () => 'iface',
      callContractFunction: async () => [true],
      maskRpcUrl: (value) => `masked:${String(value).trim()}`,
      toStr: (value) => (typeof value === 'string' ? value : value == null ? '' : String(value)),
    },
  });

  assert.deepEqual(
    await validateSbtPasswordForFaucet({
      config: {},
      gateChainId: 10,
      sbtAddress: '0x0000000000000000000000000000000000000101',
      hashedPassword: '0x1234',
    }),
    {
      ok: false,
      error: 'Missing RPC URL for chainId 10.',
      errors: [],
    },
  );

  const successHelpers = createFaucetGateAuthorityWithDeps({
    deps: {
      resolveRpcUrlListForGate: () => ['https://rpc.example'],
      toChainId: (value) => Number(value) || 0,
      getFaucetSbtGateInterface: () => 'iface',
      callContractFunction: async () => [1],
      maskRpcUrl: (value) => `masked:${String(value).trim()}`,
      toStr: (value) => (typeof value === 'string' ? value : value == null ? '' : String(value)),
    },
  });

  assert.deepEqual(
    await successHelpers.validateSbtPasswordForFaucet({
      config: {},
      gateChainId: 84532,
      sbtAddress: '0x0000000000000000000000000000000000000101',
      hashedPassword: '0x1234',
    }),
    {
      ok: true,
      rpcUrl: 'https://rpc.example',
      isValid: true,
    },
  );
});
