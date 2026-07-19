import test from 'node:test';
import assert from 'node:assert/strict';

import {
  resolveFaucetRpcUrl,
  resolveFaucetRpcUrls,
  resolveRegistryRpcUrls,
} from './registryFaucetRpcResolution.js';

const BASE_MAINNET_FAUCET_FALLBACK_RPC_URLS = Object.freeze([
  'https://mainnet.base.org', // intentional: production faucet fallback snapshot
  'https://base.publicnode.com', // intentional: production faucet fallback snapshot
  'https://base-rpc.publicnode.com', // intentional: production faucet fallback snapshot
]);
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

const deps = {
  toStr,
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
  resolveRpcUrlListForGate: (config, chainId) => {
    const map = config?.rpcUrlsByChainId || {};
    return deps.normalizeRpcUrlList(map[chainId] || map[String(chainId)]);
  },
};

test('resolveRegistryRpcUrls merges mapped and direct registry RPC URLs with existing dedupe semantics', () => {
  const result = resolveRegistryRpcUrls({
    config: {
      registryChainId: '84532',
      rpcUrl: [' https://shared.example.test ', 'https://direct-only.example.test'],
      rpcUrlsByChainId: {
        84532: ['https://shared.example.test', ' https://mapped-only.example.test '],
      },
    },
    deps,
  });

  assert.deepEqual(result, [
    'https://shared.example.test',
    'https://mapped-only.example.test',
    'https://direct-only.example.test',
  ]);
});

test('resolveRegistryRpcUrls falls back to direct config RPC URLs when no registry chain mapping exists', () => {
  const result = resolveRegistryRpcUrls({
    config: {
      registryChainId: '',
      rpcUrl: [' https://direct-a.example.test ', '', 'https://direct-b.example.test'],
      rpcUrlsByChainId: {
        84532: ['https://mapped.example.test'],
      },
    },
    deps,
  });

  assert.deepEqual(result, [
    'https://direct-a.example.test',
    'https://direct-b.example.test',
  ]);
});

test('resolveRegistryRpcUrls uses legacy networkChainId when registryChainId is absent', () => {
  const result = resolveRegistryRpcUrls({
    config: {
      networkChainId: 11155420,
      rpcUrlsByChainId: {
        11155420: ['https://legacy-network.example.test'],
      },
    },
    deps,
  });

  assert.deepEqual(result, ['https://legacy-network.example.test']);
});

test('resolveFaucetRpcUrl preserves explicit faucet rpcUrl precedence', () => {
  const result = resolveFaucetRpcUrl({
    config: {
      registryChainId: 84532,
      networkChainId: 84532,
      rpcUrl: 'https://fallback.example.test',
      rpcUrlsByChainId: {
        84532: ['https://mapped.example.test'],
      },
    },
    faucetCfg: {
      chainId: 8453,
      rpcUrl: ' https://explicit.example.test ',
    },
    deps,
  });

  assert.equal(result, 'https://explicit.example.test');
});

test('resolveFaucetRpcUrl uses faucet->network->registry chain precedence before falling back to config rpcUrl', () => {
  const result = resolveFaucetRpcUrl({
    config: {
      registryChainId: 8453,
      networkChainId: 84532,
      rpcUrl: 'https://fallback.example.test',
      rpcUrlsByChainId: {
        84532: [' https://network-chain.example.test '],
        8453: ['https://registry-chain.example.test'],
      },
    },
    faucetCfg: {},
    deps,
  });

  assert.equal(result, 'https://network-chain.example.test');
});

test('resolveFaucetRpcUrls does not use another chain mapping after a malformed explicit faucet chain id', () => {
  const result = resolveFaucetRpcUrls({
    config: {
      registryChainId: 8453,
      networkChainId: 84532,
      rpcUrl: 'https://unmapped-fallback.example.test',
      rpcUrlsByChainId: {
        84532: ['https://network-chain.example.test'],
      },
    },
    faucetCfg: { chainId: '3.1337e4' },
    defaultFaucetRpcUrl: 'https://default.example.test',
    deps,
  });

  assert.deepEqual(result, [
    'https://unmapped-fallback.example.test',
    'https://default.example.test',
  ]);
});

test('resolveFaucetRpcUrl falls back to OP Sepolia chain defaults when config omits explicit RPCs', () => {
  const result = resolveFaucetRpcUrl({
    config: {
      registryChainId: 11155420,
      networkChainId: 11155420,
      rpcUrl: '',
      rpcUrlsByChainId: {},
    },
    faucetCfg: {},
    deps,
  });

  assert.equal(result, 'https://sepolia.optimism.io'); // intentional: production default OP Sepolia RPC
});

test('resolveFaucetRpcUrls preserves Base Sepolia ordering and dedupe semantics', () => {
  const result = resolveFaucetRpcUrls({
    config: {
      registryChainId: 84532,
      networkChainId: 84532,
      rpcUrl: ['https://shared.example.test', 'https://fallback-only.example.test'],
      rpcUrlsByChainId: {
        84532: ['https://shared.example.test', 'https://mapped-only.example.test'],
      },
    },
    faucetCfg: {
      rpcUrl: 'https://explicit.example.test',
    },
    defaultFaucetRpcUrl: 'https://default.example.test',
    deps,
  });

  assert.deepEqual(result, [
    'https://explicit.example.test',
    ...BASE_SEPOLIA_FAUCET_FALLBACK_RPC_URLS,
    'https://shared.example.test',
    'https://mapped-only.example.test',
    'https://fallback-only.example.test',
    'https://default.example.test',
  ]);
});

test('resolveFaucetRpcUrls preserves OP Sepolia ordering and dedupe semantics', () => {
  const result = resolveFaucetRpcUrls({
    config: {
      registryChainId: 11155420,
      networkChainId: 11155420,
      rpcUrl: ['https://shared.example.test', 'https://fallback-only.example.test'],
      rpcUrlsByChainId: {
        11155420: ['https://shared.example.test', 'https://mapped-only.example.test'],
      },
    },
    faucetCfg: {
      rpcUrl: 'https://explicit.example.test',
    },
    defaultFaucetRpcUrl: 'https://default.example.test',
    deps,
  });

  assert.deepEqual(result, [
    'https://explicit.example.test',
    ...OP_SEPOLIA_FAUCET_FALLBACK_RPC_URLS,
    'https://shared.example.test',
    'https://mapped-only.example.test',
    'https://fallback-only.example.test',
    'https://default.example.test',
  ]);
});

test('resolveFaucetRpcUrls preserves mapped->fallback->Base mainnet ordering for Base mainnet faucet chains', () => {
  const result = resolveFaucetRpcUrls({
    config: {
      registryChainId: 84532,
      networkChainId: 84532,
      rpcUrl: 'https://fallback.example.test',
      rpcUrlsByChainId: {
        8453: ['https://mapped.example.test'],
      },
    },
    faucetCfg: {
      chainId: '8453',
    },
    defaultFaucetRpcUrl: 'https://default.example.test',
    deps,
  });

  assert.deepEqual(result, [
    'https://mapped.example.test',
    'https://fallback.example.test',
    ...BASE_MAINNET_FAUCET_FALLBACK_RPC_URLS,
    'https://default.example.test',
  ]);
});
