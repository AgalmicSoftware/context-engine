import test from 'node:test';
import assert from 'node:assert/strict';

import { createRegistryFaucetRpcHelpersWithWorkerDeps } from './registryFaucetRpcBinding.js';

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
    rpcUrl: [' https://shared.example ', 'https://direct-only.example'],
    rpcUrlsByChainId: {
      84532: ['https://shared.example', ' https://mapped-only.example '],
      8453: ['https://mainnet-only.example'],
    },
  };

  assert.deepEqual(helpers.resolveRegistryRpcUrls(config), [
    'https://shared.example',
    'https://mapped-only.example',
    'https://direct-only.example',
  ]);
  assert.equal(helpers.resolveRegistryRpcUrl(config), 'https://shared.example');
  assert.deepEqual(helpers.resolveRpcUrlListForGate(config, 84532), [
    'https://shared.example',
    'https://mapped-only.example',
    'https://direct-only.example',
  ]);
  assert.equal(helpers.resolveRpcUrlForGate(config, 84532), 'https://shared.example');
  assert.deepEqual(helpers.resolveRpcUrlListForGate(config, 8453), [
    'https://mainnet-only.example',
  ]);
});

test('createRegistryFaucetRpcHelpersWithWorkerDeps preserves faucet rpc explicit precedence and fallback ordering', () => {
  const helpers = createRegistryFaucetRpcHelpersWithWorkerDeps({
    deps: createDeps(),
    defaults: {
      defaultFaucetRpcUrl: 'https://default.example',
    },
  });

  const explicitConfig = {
    registryChainId: 84532,
    networkChainId: 84532,
    rpcUrl: 'https://fallback.example',
    rpcUrlsByChainId: {
      84532: ['https://mapped.example'],
    },
  };

  assert.equal(
    helpers.resolveFaucetRpcUrl(explicitConfig, { chainId: 8453, rpcUrl: ' https://explicit.example ' }),
    'https://explicit.example',
  );

  const networkPreferredConfig = {
    registryChainId: 8453,
    networkChainId: 84532,
    rpcUrl: 'https://fallback.example',
    rpcUrlsByChainId: {
      84532: [' https://network-chain.example '],
      8453: ['https://registry-chain.example'],
    },
  };

  assert.equal(
    helpers.resolveFaucetRpcUrl(networkPreferredConfig, {}),
    'https://network-chain.example',
  );

  assert.deepEqual(
    helpers.resolveFaucetRpcUrls({
      registryChainId: 84532,
      networkChainId: 84532,
      rpcUrl: ['https://shared.example', 'https://fallback-only.example'],
      rpcUrlsByChainId: {
        84532: ['https://shared.example', 'https://mapped-only.example'],
      },
    }, {
      rpcUrl: 'https://explicit.example',
    }),
    [
      'https://explicit.example',
      'https://sepolia.base.org',
      'https://base-sepolia-rpc.publicnode.com',
      'https://base-sepolia.drpc.org',
      'https://shared.example',
      'https://mapped-only.example',
      'https://fallback-only.example',
      'https://default.example',
    ],
  );

  assert.deepEqual(
    helpers.resolveFaucetRpcUrls({
      registryChainId: 11155420,
      networkChainId: 11155420,
      rpcUrl: ['https://shared.example', 'https://fallback-only.example'],
      rpcUrlsByChainId: {
        11155420: ['https://shared.example', 'https://mapped-only.example'],
      },
    }, {
      rpcUrl: 'https://explicit.example',
    }),
    [
      'https://explicit.example',
      'https://sepolia.optimism.io',
      'https://optimism-sepolia.publicnode.com',
      'https://optimism-sepolia-rpc.publicnode.com',
      'https://optimism-sepolia.drpc.org',
      'https://optimism-sepolia.gateway.tenderly.co',
      'https://shared.example',
      'https://mapped-only.example',
      'https://fallback-only.example',
      'https://default.example',
    ],
  );
});
