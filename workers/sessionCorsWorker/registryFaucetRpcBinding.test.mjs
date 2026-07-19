import test from 'node:test';
import assert from 'node:assert/strict';

import { createRegistryFaucetRpcHelpersWithWorkerDeps } from './registryFaucetRpcBinding.js';
import { attachSessionSecretRpcForGateRuntime } from './gateRpcResolution.js';

const BASE_SEPOLIA_FAUCET_FALLBACK_RPC_URLS = Object.freeze([
  'https://sepolia.base.org', // intentional: production faucet fallback snapshot
  'https://base-sepolia-rpc.publicnode.com', // intentional: production faucet fallback snapshot
  'https://base-sepolia.drpc.org', // intentional: production faucet fallback snapshot
]);
const OP_SEPOLIA_FAUCET_FALLBACK_RPC_URLS = Object.freeze([
  'https://sepolia.optimism.io', // intentional: production faucet fallback snapshot
  'https://optimism-sepolia.publicnode.com', // intentional: production faucet fallback snapshot
  'https://optimism-sepolia-rpc.publicnode.com', // intentional: production faucet fallback snapshot
  'https://optimism-sepolia.drpc.org', // intentional: production faucet fallback snapshot
  'https://optimism-sepolia.gateway.tenderly.co', // intentional: production faucet fallback snapshot
]);

const toStr = (value) => (typeof value === 'string' ? value : value == null ? '' : String(value));

const createDeps = () => ({
  normalizeWorkerSessionSlug: (value) => {
    const slug = toStr(value).trim().toLowerCase();
    if (slug === 'debate') return 'rxc';
    return slug;
  },
  normalizeRpcUrlList: (value) => {
    if (Array.isArray(value)) {
      return value.map((url) => toStr(url).trim()).filter(Boolean);
    }
    const str = toStr(value).trim();
    return str ? [str] : [];
  },
  mergeRpcUrlLists: (...lists) => {
    const seen = new Set();
    const merged = [];
    lists.forEach((list) => {
      if (!Array.isArray(list)) return;
      list.forEach((url) => {
        const trimmed = toStr(url).trim();
        if (!trimmed || seen.has(trimmed)) return;
        seen.add(trimmed);
        merged.push(trimmed);
      });
    });
    return merged;
  },
  toChainId: (value) => {
    try {
      const numeric = Number(value);
      return Number.isInteger(numeric) && numeric > 0 ? numeric : 0;
    } catch {
      return 0;
    }
  },
  toStr,
});

test('createRegistryFaucetRpcHelpersWithWorkerDeps returns the expected helper functions', () => {
  const helpers = createRegistryFaucetRpcHelpersWithWorkerDeps();

  assert.equal(typeof helpers.toRegistrySessionSlug, 'function');
  assert.equal(typeof helpers.resolveRegistryRpcUrls, 'function');
  assert.equal(typeof helpers.resolveRegistryRpcUrl, 'function');
  assert.equal(typeof helpers.resolveRpcUrlListForGate, 'function');
  assert.equal(typeof helpers.resolveRpcUrlForGate, 'function');
  assert.equal(typeof helpers.resolveFaucetRpcUrl, 'function');
  assert.equal(typeof helpers.resolveFaucetRpcUrls, 'function');
  assert.equal(typeof helpers.isBytes32Hex, 'function');
});

test('createRegistryFaucetRpcHelpersWithWorkerDeps preserves slug normalization and bytes32 validation', () => {
  const helpers = createRegistryFaucetRpcHelpersWithWorkerDeps({
    deps: createDeps(),
  });

  assert.equal(helpers.toRegistrySessionSlug('debate'), 'rxc');
  assert.equal(helpers.toRegistrySessionSlug(''), 'general');
  assert.equal(helpers.isBytes32Hex(`0x${'a'.repeat(64)}`), true);
  assert.equal(helpers.isBytes32Hex(`0x${'a'.repeat(63)}`), false);
});

test('createRegistryFaucetRpcHelpersWithWorkerDeps preserves registry and gate RPC resolution wrappers', () => {
  const helpers = createRegistryFaucetRpcHelpersWithWorkerDeps({
    deps: createDeps(),
  });

  const config = {
    registryChainId: '84532',
    rpcUrl: [' https://shared.example.test ', 'https://direct-only.example.test'],
    rpcUrlsByChainId: {
      84532: ['https://shared.example.test', ' https://mapped-only.example.test '],
      8453: ['https://mainnet-only.example.test'],
    },
  };

  assert.deepEqual(helpers.resolveRegistryRpcUrls(config), [
    'https://shared.example.test',
    'https://mapped-only.example.test',
    'https://direct-only.example.test',
  ]);
  assert.equal(helpers.resolveRegistryRpcUrl(config), 'https://shared.example.test');
  assert.deepEqual(helpers.resolveRpcUrlListForGate(config, 84532), [
    'https://shared.example.test',
    'https://mapped-only.example.test',
    'https://direct-only.example.test',
  ]);
  assert.equal(helpers.resolveRpcUrlForGate(config, 84532), 'https://shared.example.test');
  assert.deepEqual(helpers.resolveRpcUrlListForGate(config, 8453), [
    'https://mainnet-only.example.test',
  ]);
});

test('createRegistryFaucetRpcHelpersWithWorkerDeps preserves faucet rpc explicit precedence and fallback ordering', () => {
  const helpers = createRegistryFaucetRpcHelpersWithWorkerDeps({
    deps: createDeps(),
    defaults: {
      defaultFaucetRpcUrl: 'https://default.example.test',
    },
  });

  const explicitConfig = {
    registryChainId: 84532,
    networkChainId: 84532,
    rpcUrl: 'https://fallback.example.test',
    rpcUrlsByChainId: {
      84532: ['https://mapped.example.test'],
    },
  };

  assert.equal(
    helpers.resolveFaucetRpcUrl(explicitConfig, { chainId: 8453, rpcUrl: ' https://explicit.example.test ' }),
    'https://explicit.example.test',
  );

  const networkPreferredConfig = {
    registryChainId: 8453,
    networkChainId: 84532,
    rpcUrl: 'https://fallback.example.test',
    rpcUrlsByChainId: {
      84532: [' https://network-chain.example.test '],
      8453: ['https://registry-chain.example.test'],
    },
  };

  assert.equal(
    helpers.resolveFaucetRpcUrl(networkPreferredConfig, {}),
    'https://network-chain.example.test',
  );

  assert.deepEqual(
    helpers.resolveFaucetRpcUrls({
      registryChainId: 84532,
      networkChainId: 84532,
      rpcUrl: ['https://shared.example.test', 'https://fallback-only.example.test'],
      rpcUrlsByChainId: {
        84532: ['https://shared.example.test', 'https://mapped-only.example.test'],
      },
    }, {
      rpcUrl: 'https://explicit.example.test',
    }),
    [
      'https://explicit.example.test',
      ...BASE_SEPOLIA_FAUCET_FALLBACK_RPC_URLS,
      'https://shared.example.test',
      'https://mapped-only.example.test',
      'https://fallback-only.example.test',
      'https://default.example.test',
    ],
  );

  assert.deepEqual(
    helpers.resolveFaucetRpcUrls({
      registryChainId: 11155420,
      networkChainId: 11155420,
      rpcUrl: ['https://shared.example.test', 'https://fallback-only.example.test'],
      rpcUrlsByChainId: {
        11155420: ['https://shared.example.test', 'https://mapped-only.example.test'],
      },
    }, {
      rpcUrl: 'https://explicit.example.test',
    }),
    [
      'https://explicit.example.test',
      ...OP_SEPOLIA_FAUCET_FALLBACK_RPC_URLS,
      'https://shared.example.test',
      'https://mapped-only.example.test',
      'https://fallback-only.example.test',
      'https://default.example.test',
    ],
  );
});

test('createRegistryFaucetRpcHelpersWithWorkerDeps prefers a worker-canonical session-secret RPC for the faucet transaction', () => {
  const helpers = createRegistryFaucetRpcHelpersWithWorkerDeps({
    deps: createDeps(),
    defaults: {
      defaultFaucetRpcUrl: 'https://default.example.test',
    },
  });
  const runtimeConfig = attachSessionSecretRpcForGateRuntime({
    config: {
      networkChainId: 11155420,
      sessionModeProfile: { authority: { mode: 'worker_canonical' } },
      faucet: { rpcUrl: 'https://legacy-explicit-op-rpc.example.test' },
    },
    secrets: { customRpcUrl: 'https://private-op-rpc.example.test' },
  });

  assert.deepEqual(helpers.resolveFaucetRpcUrls(runtimeConfig, runtimeConfig.faucet), [
    'https://private-op-rpc.example.test',
    'https://legacy-explicit-op-rpc.example.test',
    ...OP_SEPOLIA_FAUCET_FALLBACK_RPC_URLS,
    'https://default.example.test',
  ]);
});
