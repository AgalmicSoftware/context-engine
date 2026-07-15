import test from 'node:test';
import assert from 'node:assert/strict';

import { resolveLoginAuthorityContext } from './loginAuthorityPreflight.js';

const REGISTRY_ADDRESS = '0x0000000000000000000000000000000000000001';

const createDeps = (overrides = {}) => ({
  toStr: (value) => `${value ?? ''}`,
  isAddress: (value) => /^0x[0-9a-fA-F]{40}$/.test(`${value ?? ''}`),
  resolveRegistryRpcUrls: () => ['https://rpc.example'],
  toRegistrySessionSlug: (value) => {
    const raw = `${value ?? ''}`.trim().toLowerCase();
    return raw === 'debate' ? 'rxc' : (raw || 'general');
  },
  readSessionExistsOnChain: async () => ({
    exists: true,
    rpcUrl: 'https://rpc.example',
    errors: [],
    error: null,
  }),
  maskRpcUrl: (value) => `masked:${value}`,
  warn: () => {},
  ...overrides,
});

test('resolveLoginAuthorityContext fails before session reads when registry config is unavailable', async () => {
  let sessionReads = 0;

  await assert.rejects(
    resolveLoginAuthorityContext({
      slug: 'session-a',
      address: '0xabc123',
      config: { registryAddress: '' },
      deps: createDeps({
        resolveRegistryRpcUrls: () => [],
        readSessionExistsOnChain: async () => {
          sessionReads += 1;
          return { exists: true, errors: [], error: null };
        },
      }),
    }),
    /Session registry not configured \(registryAddress \+ rpcUrl required\)\./
  );

  assert.equal(sessionReads, 0);
});

test('resolveLoginAuthorityContext returns the canonical registry context when session authority exists', async () => {
  const calls = [];
  const chainAttestationCache = new Map();

  const result = await resolveLoginAuthorityContext({
    slug: 'debate',
    address: '0xabc123',
    config: {
      registryAddress: REGISTRY_ADDRESS,
      registryChainId: 84532,
      rpcUrl: 'https://rpc.example',
    },
    deps: createDeps({
      chainAttestationCache,
      readSessionExistsOnChain: async (value) => {
        calls.push(value);
        return {
          exists: true,
          rpcUrl: 'https://rpc.example',
          errors: [],
          error: null,
        };
      },
    }),
  });

  assert.deepEqual(calls, [{
    registryAddress: REGISTRY_ADDRESS,
    registryRpcUrls: ['https://rpc.example'],
    registrySlug: 'rxc',
    expectedChainId: 84532,
    chainAttestationCache,
  }]);
  assert.deepEqual(result, {
    registryAddress: REGISTRY_ADDRESS,
    registryRpcUrls: ['https://rpc.example'],
    registrySlug: 'rxc',
    sessionCheck: {
      exists: true,
      rpcUrl: 'https://rpc.example',
      errors: [],
      error: null,
    },
  });
});

test('resolveLoginAuthorityContext preserves session-not-registered warning and denial', async () => {
  const warnings = [];

  await assert.rejects(
    resolveLoginAuthorityContext({
      slug: '',
      address: '0xabc123',
      config: {
        registryAddress: REGISTRY_ADDRESS,
        rpcUrl: 'https://rpc.example',
      },
      deps: createDeps({
        warn: (...args) => warnings.push(args),
        readSessionExistsOnChain: async () => ({
          exists: false,
          rpcUrl: 'https://rpc.example',
          errors: [{ rpcUrl: 'masked:https://rpc.example', error: 'down' }],
          error: new Error('session missing'),
        }),
      }),
    }),
    /Access denied: on-chain gate data unavailable\./
  );

  assert.deepEqual(warnings, [[
    '[gating] on-chain gate authority unavailable; denying login',
    {
      slug: 'general',
      address: '0xabc123',
      reason: 'session-not-registered',
      registryAddress: REGISTRY_ADDRESS,
      rpcUrl: 'masked:https://rpc.example',
      rpcErrors: [{ rpcUrl: 'masked:https://rpc.example', error: 'down' }],
      rpcError: 'session missing',
    },
  ]]);
});

test('resolveLoginAuthorityContext preserves session-check-unavailable warning and denial', async () => {
  const warnings = [];

  await assert.rejects(
    resolveLoginAuthorityContext({
      slug: 'session-b',
      address: '0xabc123',
      config: {
        registryAddress: REGISTRY_ADDRESS,
        rpcUrl: 'https://rpc.example',
      },
      deps: createDeps({
        warn: (...args) => warnings.push(args),
        readSessionExistsOnChain: async () => ({
          exists: null,
          rpcUrl: '',
          errors: [{ rpcUrl: 'masked:https://rpc.example', error: 'timeout' }],
          error: new Error('rpc unavailable'),
        }),
      }),
    }),
    /Access denied: on-chain gate data unavailable\./
  );

  assert.deepEqual(warnings, [[
    '[gating] on-chain gate authority unavailable; denying login',
    {
      slug: 'session-b',
      address: '0xabc123',
      reason: 'session-check-unavailable',
      registryAddress: REGISTRY_ADDRESS,
      rpcUrl: '',
      rpcErrors: [{ rpcUrl: 'masked:https://rpc.example', error: 'timeout' }],
      rpcError: 'rpc unavailable',
    },
  ]]);
});

test('resolveLoginAuthorityContext uses persisted worker-canonical config without registry reads', async () => {
  let registryReads = 0;
  const result = await resolveLoginAuthorityContext({
    slug: 'session-worker',
    address: '0xabc123',
    config: {
      sessionModeProfile: { authority: { mode: 'worker_canonical' } },
      workerAuthority: { version: 1, participantScopes: ['storage'] },
    },
    deps: createDeps({
      resolveRegistryRpcUrls: () => [],
      readSessionExistsOnChain: async () => {
        registryReads += 1;
        return { exists: false, errors: [], error: null };
      },
    }),
  });

  assert.equal(registryReads, 0);
  assert.deepEqual(result, {
    authorityMode: 'worker_canonical',
    registryAddress: '',
    registryRpcUrls: [],
    registrySlug: 'session-worker',
    sessionCheck: {
      exists: true,
      source: 'worker-config',
      rpcUrl: '',
      errors: [],
      error: null,
    },
  });
});
