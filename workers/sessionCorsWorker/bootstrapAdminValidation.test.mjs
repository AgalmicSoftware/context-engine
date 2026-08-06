import test from 'node:test';
import assert from 'node:assert/strict';

import { validateBootstrapAdmin } from './bootstrapAdminValidation.js';
import { toChainId } from './chainIdNormalization.js';

const createDeps = (overrides = {}) => ({
  toStr: (value) => `${value ?? ''}`,
  isAddress: (value) => /^0x[a-fA-F0-9]+$/.test(`${value ?? ''}`),
  normalizeRpcUrlList: (value) => {
    if (Array.isArray(value)) return value;
    return value ? [value] : [];
  },
  toRegistrySessionSlug: (value) => value,
  toChainId,
  readSessionExistsOnChain: async () => ({ exists: false, rpcUrl: 'https://rpc.example' }),
  readSessionBySlugOnChain: async () => ({ ok: true, tuple: [] }),
  ...overrides,
});

const createBody = (overrides = {}) => ({
  adminAddress: '0xabc123',
  ...overrides,
  config: {
    adminAddress: '0xabc123',
    registryChainId: 84532,
    sessionId: '0x11111111111111111111111111111111',
    ...(overrides.config || {}),
  },
});

test('validateBootstrapAdmin rejects an unbound bootstrap when the worker is not registry-configured', async () => {
  let sessionCheckCalled = false;

  const result = await validateBootstrapAdmin({
    env: {},
    slug: 'session-a',
    address: '0xAbC123',
    body: createBody(),
    deps: createDeps({
      readSessionExistsOnChain: async () => {
        sessionCheckCalled = true;
        return { exists: false };
      },
    }),
  });

  assert.equal(sessionCheckCalled, false);
  assert.equal(result, false);
});

test('validateBootstrapAdmin requires the deployment-bound admin while KV config is unavailable', async () => {
  const deps = createDeps();
  const matching = await validateBootstrapAdmin({
    env: { BOOTSTRAP_ADMIN_ADDRESS: '0xabc123' },
    slug: 'session-a',
    address: '0xAbC123',
    body: createBody(),
    deps,
  });
  const mismatched = await validateBootstrapAdmin({
    env: { BOOTSTRAP_ADMIN_ADDRESS: '0xabc123' },
    slug: 'session-a',
    address: '0xdef456',
    body: createBody({
      adminAddress: '0xdef456',
      config: { adminAddress: '0xdef456' },
    }),
    deps,
  });

  assert.equal(matching, true);
  assert.equal(mismatched, false);
});

test('validateBootstrapAdmin rejects bootstrap before the slug is registered on-chain', async () => {
  let registryReadCalled = false;

  const result = await validateBootstrapAdmin({
    env: {
      REGISTRY_ADDRESS: '0x999999',
      RPC_URL: 'https://rpc.example',
    },
    slug: 'session-a',
    address: '0xAbC123',
    body: createBody(),
    deps: createDeps({
      readSessionExistsOnChain: async (value) => {
        registryReadCalled = true;
        assert.ok(value.chainAttestationCache instanceof Map);
        assert.deepEqual(value, {
          registryAddress: '0x999999',
          registryRpcUrls: ['https://rpc.example'],
          registrySlug: 'session-a',
          expectedChainId: 84532,
          chainAttestationCache: value.chainAttestationCache,
        });
        return { exists: false, rpcUrl: 'https://rpc.example' };
      },
      readSessionBySlugOnChain: async () => {
        throw new Error('should not load on-chain session tuple');
      },
    }),
  });

  assert.equal(registryReadCalled, true);
  assert.equal(result, false);
});

test('validateBootstrapAdmin fails closed when the on-chain session existence check is unavailable', async () => {
  let registryTupleCalled = false;

  const result = await validateBootstrapAdmin({
    env: {
      REGISTRY_ADDRESS: '0x999999',
      RPC_URL: 'https://rpc.example',
    },
    slug: 'session-a',
    address: '0xAbC123',
    body: createBody(),
    deps: createDeps({
      readSessionExistsOnChain: async () => ({ exists: null, rpcUrl: '' }),
      readSessionBySlugOnChain: async () => {
        registryTupleCalled = true;
        return { ok: true, tuple: [] };
      },
    }),
  });

  assert.equal(registryTupleCalled, false);
  assert.equal(result, false);
});

test('validateBootstrapAdmin requires the requested admin and signer to match the on-chain admin', async () => {
  const calls = [];
  let sessionChainAttestationCache;

  const result = await validateBootstrapAdmin({
    env: {
      REGISTRY_ADDRESS: '0x999999',
      RPC_URL: ['https://rpc-a.example', 'https://rpc-b.example'],
    },
    slug: 'session-a',
    address: '0xabc123',
    body: createBody({
      adminAddress: '0xdeadbeef',
      config: { adminAddress: '0xdeadbeef' },
    }),
    deps: createDeps({
      readSessionExistsOnChain: async (value) => {
        sessionChainAttestationCache = value.chainAttestationCache;
        assert.equal(value.expectedChainId, 84532);
        return {
          exists: true,
          rpcUrl: 'https://rpc-b.example',
        };
      },
      readSessionBySlugOnChain: async (value) => {
        calls.push(value);
        return {
          ok: true,
          tuple: ['', 0, '', '', '0xabc123', 0, 0, '0x11111111111111111111111111111111'],
        };
      },
    }),
  });

  assert.deepEqual(calls, [{
    registryAddress: '0x999999',
    registryRpcUrls: ['https://rpc-b.example'],
    registrySlug: 'session-a',
    expectedChainId: 84532,
    chainAttestationCache: sessionChainAttestationCache,
  }]);
  assert.equal(result, false);
});

test('validateBootstrapAdmin rejects a registry tuple for another session identity', async () => {
  const result = await validateBootstrapAdmin({
    env: {
      REGISTRY_ADDRESS: '0x999999',
      RPC_URL: 'https://rpc.example',
    },
    slug: 'session-a',
    address: '0xabc123',
    body: createBody(),
    deps: createDeps({
      readSessionExistsOnChain: async () => ({ exists: true, rpcUrl: 'https://rpc.example' }),
      readSessionBySlugOnChain: async () => ({
        ok: true,
        tuple: ['', 0, '', '', '0xabc123', 0, 0, '0x22222222222222222222222222222222'],
      }),
    }),
  });

  assert.equal(result, false);
});

test('validateBootstrapAdmin preserves legacy registry bootstrap without a supplied session identity', async () => {
  const result = await validateBootstrapAdmin({
    env: {
      REGISTRY_ADDRESS: '0x999999',
      RPC_URL: 'https://rpc.example',
    },
    slug: 'session-a',
    address: '0xabc123',
    body: createBody({ config: { sessionId: undefined } }),
    deps: createDeps({
      readSessionExistsOnChain: async () => ({ exists: true, rpcUrl: 'https://rpc.example' }),
      readSessionBySlugOnChain: async () => ({
        ok: true,
        tuple: ['', 0, '', '', '0xabc123', 0, 0, '0x22222222222222222222222222222222'],
      }),
    }),
  });

  assert.equal(result, true);
});

test('validateBootstrapAdmin fails closed when the on-chain admin lookup errors', async () => {
  const result = await validateBootstrapAdmin({
    env: {
      REGISTRY_ADDRESS: '0x999999',
      RPC_URL: 'https://rpc.example',
    },
    slug: 'session-a',
    address: '0xabc123',
    body: createBody(),
    deps: createDeps({
      readSessionExistsOnChain: async () => ({
        exists: true,
        rpcUrl: 'https://rpc.example',
      }),
      readSessionBySlugOnChain: async () => ({ ok: false, error: new Error('rpc failed') }),
    }),
  });

  assert.equal(result, false);
});

test('validateBootstrapAdmin fails closed before registry reads when the expected chain is unavailable', async () => {
  let registryReads = 0;
  const result = await validateBootstrapAdmin({
    env: {
      REGISTRY_ADDRESS: '0x999999',
      RPC_URL: 'https://rpc.example',
    },
    slug: 'session-a',
    address: '0xabc123',
    body: {
      adminAddress: '0xabc123',
      config: { adminAddress: '0xabc123' },
    },
    deps: createDeps({
      readSessionExistsOnChain: async () => {
        registryReads += 1;
        return { exists: false };
      },
    }),
  });

  assert.equal(result, false);
  assert.equal(registryReads, 0);
});

test('validateBootstrapAdmin rejects malformed explicit registry chain ids instead of falling through', async () => {
  for (const registryChainId of [false, Number.NaN, '3.1337e4', '84532.0']) {
    let registryReads = 0;
    const result = await validateBootstrapAdmin({
      env: {
        REGISTRY_ADDRESS: '0x999999',
        RPC_URL: 'https://rpc.example',
        REGISTRY_CHAIN_ID: 84532,
      },
      slug: 'session-a',
      address: '0xabc123',
      body: createBody({
        config: {
          adminAddress: '0xabc123',
          registryChainId,
          networkChainId: 84532,
        },
      }),
      deps: createDeps({
        readSessionExistsOnChain: async () => {
          registryReads += 1;
          return { exists: false };
        },
      }),
    });

    assert.equal(result, false, String(registryChainId));
    assert.equal(registryReads, 0, String(registryChainId));
  }
});

test('validateBootstrapAdmin resolves absent and zero chain fallbacks before rejecting unregistered slugs', async () => {
  const seenChainIds = [];
  const readSessionExistsOnChain = async (value) => {
    seenChainIds.push(value.expectedChainId);
    return { exists: false, rpcUrl: 'https://rpc.example' };
  };

  for (const config of [
    { adminAddress: '0xabc123', registryChainId: 0, networkChainId: 84532 },
    { adminAddress: '0xabc123', registryChainId: '0x0', networkChainId: 84532 },
    { adminAddress: '0xabc123', registryChainId: 0, networkChainId: 0 },
  ]) {
    const result = await validateBootstrapAdmin({
      env: {
        REGISTRY_ADDRESS: '0x999999',
        RPC_URL: 'https://rpc.example',
        REGISTRY_CHAIN_ID: 11155420,
      },
      slug: 'session-a',
      address: '0xabc123',
      body: { adminAddress: '0xabc123', config },
      deps: createDeps({ readSessionExistsOnChain }),
    });
    assert.equal(result, false);
  }

  assert.deepEqual(seenChainIds, [84532, 84532, 11155420]);
});
