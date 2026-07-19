import test from 'node:test';
import assert from 'node:assert/strict';

import { createFaucetGateAuthorityWithDeps } from './faucetGateAuthority.js';
import { attachSessionSecretRpcForGateRuntime } from './gateRpcResolution.js';
import { PRIVATE_SESSION_RPC_LABEL } from './rpcDiagnosticSafety.js';

test('createFaucetGateAuthorityWithDeps returns the expected helper functions', () => {
  const helpers = createFaucetGateAuthorityWithDeps();

  assert.equal(typeof helpers.findSessionGateForSbt, 'function');
  assert.equal(typeof helpers.readSbtFaucetValidationState, 'function');
  assert.equal(typeof helpers.validateSbtPasswordForFaucet, 'function');
});

test('createFaucetGateAuthorityWithDeps preserves session-gate lookup ordering and fail-closed outputs', async () => {
  const gateCalls = [];
  let chainAttestationCache;
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
      readSessionExistsOnChain: async (value) => {
        assert.equal(value.expectedChainId, 84532);
        assert.ok(value.chainAttestationCache instanceof Map);
        chainAttestationCache = value.chainAttestationCache;
        return {
          exists: true,
          rpcUrl: 'https://rpc.example',
          errors: [],
        };
      },
      maskRpcUrl: (value) => `masked:${String(value).trim()}`,
      readResourceGateOnChain: async (value) => {
        const { resourceKey, registrySlug } = value;
        assert.equal(value.expectedChainId, 84532);
        assert.equal(value.chainAttestationCache, chainAttestationCache);
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
      registryChainId: 84532,
      rpcUrl: 'https://rpc.example',
      faucet: { allowResourceGateFallback: true },
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
        errors: [{ rpcUrl: 'https://rpc.example', status: 502, error: 'down' }],
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
        errors: [{
          rpcUrl: 'masked:https://rpc.example',
          status: 502,
          error: 'Session existence RPC request failed.',
        }],
    },
  });
});

test('createFaucetGateAuthorityWithDeps treats txGas as authoritative unless fallback is explicit', async () => {
  const gateCalls = [];
  const { findSessionGateForSbt } = createFaucetGateAuthorityWithDeps({
    deps: {
      toStr: (value) => (typeof value === 'string' ? value : value == null ? '' : String(value)),
      isAddress: (value) => /^0x[0-9a-fA-F]{40}$/.test(String(value).trim()),
      resolveRegistryRpcUrls: () => ['https://rpc.example'],
      normalizeAddressLower: (value) => String(value || '').trim().toLowerCase(),
      toRegistrySessionSlug: (value) => String(value || '').trim().toLowerCase() || 'general',
      readSessionExistsOnChain: async () => ({
        exists: true,
        rpcUrl: 'https://rpc.example',
        errors: [],
      }),
      maskRpcUrl: (value) => `masked:${String(value).trim()}`,
      readResourceGateOnChain: async ({ resourceKey }) => {
        gateCalls.push(resourceKey);
        if (resourceKey === 'default') {
          return {
            ok: true,
            gate: {
              sbtAddresses: ['0x00000000000000000000000000000000000000aa'],
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

  const result = await findSessionGateForSbt({
    slug: 'session-a',
    config: {
      registryAddress: '0x0000000000000000000000000000000000000001',
      rpcUrl: 'https://rpc.example',
    },
    sbtAddress: '0x00000000000000000000000000000000000000aa',
  });

  assert.deepEqual(result, {
    ok: false,
    status: 403,
    error: 'Requested SBT is not part of a session gate.',
    reason: 'sbt-not-gated',
  });
  assert.deepEqual(gateCalls, ['txGas']);
});

test('createFaucetGateAuthorityWithDeps preserves faucet validation-state reads and masked rpc fallback errors', async () => {
  const calls = [];
  const { readSbtFaucetValidationState } = createFaucetGateAuthorityWithDeps({
    deps: {
      resolveRpcUrlListForGate: () => ['https://rpc-1.example', 'https://rpc-2.example'],
      toChainId: (value) => Number(value) || 0,
      rpcRequest: async () => '0x14a34',
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

test('createFaucetGateAuthorityWithDeps returns safe proof diagnostics for private session RPC failures', async () => {
  const secretRpcUrl = 'https://TENANT_SECRET.rpc.example/v2/ALCHEMY_SECRET';
  const runtimeConfig = attachSessionSecretRpcForGateRuntime({
    config: {
      networkChainId: 31337,
      sessionModeProfile: { authority: { mode: 'worker_canonical' } },
    },
    secrets: { customRpcUrl: secretRpcUrl },
  });
  const { readSbtFaucetValidationState } = createFaucetGateAuthorityWithDeps({
    deps: {
      resolveRpcUrlListForGate: () => [secretRpcUrl],
      toChainId: (value) => {
        if (typeof value === 'string' && value.startsWith('0x')) return parseInt(value, 16) || 0;
        return Number(value) || 0;
      },
      rpcRequest: async () => '0x7a69',
      getFaucetSbtGateInterface: () => 'iface',
      callContractFunction: async () => {
        const error = new Error(`proof read failed at ${secretRpcUrl}`);
        error.rpcStatus = 502;
        error.rpcError = { code: -32000, message: `upstream echoed ${secretRpcUrl}` };
        throw error;
      },
      maskRpcUrl: (value) => new URL(value).origin,
      toStr: (value) => (typeof value === 'string' ? value : value == null ? '' : String(value)),
    },
  });

  const result = await readSbtFaucetValidationState({
    config: runtimeConfig,
    gateChainId: 31337,
    sbtAddress: '0x0000000000000000000000000000000000000101',
  });

  assert.deepEqual(result, {
    ok: false,
    error: 'SBT gate validation failed.',
    errors: [{
      rpcUrl: PRIVATE_SESSION_RPC_LABEL,
      status: 502,
      code: -32000,
      error: 'SBT validation RPC request failed.',
    }],
  });
  assert.equal(JSON.stringify(result).includes('TENANT_SECRET'), false);
  assert.equal(JSON.stringify(result).includes('ALCHEMY_SECRET'), false);
  assert.equal(JSON.stringify(result).includes('rpcError'), false);
});

test('createFaucetGateAuthorityWithDeps rejects a wrong-chain private RPC before proof reads', async () => {
  const secretRpcUrl = 'https://TENANT_SECRET.rpc.example/v2/ALCHEMY_SECRET';
  const runtimeConfig = attachSessionSecretRpcForGateRuntime({
    config: {
      networkChainId: 31337,
      sessionModeProfile: { authority: { mode: 'worker_canonical' } },
    },
    secrets: { customRpcUrl: secretRpcUrl },
  });
  const rpcCalls = [];
  let contractCalls = 0;
  const { readSbtFaucetValidationState } = createFaucetGateAuthorityWithDeps({
    deps: {
      resolveRpcUrlListForGate: () => [secretRpcUrl],
      toChainId: (value) => {
        if (typeof value === 'string' && value.startsWith('0x')) return parseInt(value, 16) || 0;
        return Number(value) || 0;
      },
      rpcRequest: async (value) => {
        rpcCalls.push(value);
        return '0x14a34';
      },
      getFaucetSbtGateInterface: () => 'iface',
      callContractFunction: async () => {
        contractCalls += 1;
        return [true];
      },
      maskRpcUrl: (value) => new URL(value).origin,
    },
  });

  const result = await readSbtFaucetValidationState({
    config: runtimeConfig,
    gateChainId: 31337,
    sbtAddress: '0x0000000000000000000000000000000000000101',
  });

  assert.deepEqual(result, {
    ok: false,
    error: 'SBT gate validation failed.',
    errors: [{
      rpcUrl: PRIVATE_SESSION_RPC_LABEL,
      status: null,
      error: 'SBT validation RPC chain attestation failed.',
    }],
  });
  assert.deepEqual(rpcCalls, [{
    rpcUrl: secretRpcUrl,
    method: 'eth_chainId',
    params: [],
  }]);
  assert.equal(contractCalls, 0);
  assert.equal(JSON.stringify(result).includes('TENANT_SECRET'), false);
  assert.equal(JSON.stringify(result).includes('ALCHEMY_SECRET'), false);
});

test('createFaucetGateAuthorityWithDeps preserves password-validation reads and missing-rpc failures', async () => {
  const { validateSbtPasswordForFaucet } = createFaucetGateAuthorityWithDeps({
    deps: {
      resolveRpcUrlListForGate: () => [],
      toChainId: (value) => Number(value) || 0,
      rpcRequest: async () => '0x14a34',
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
      rpcRequest: async () => '0x14a34',
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
