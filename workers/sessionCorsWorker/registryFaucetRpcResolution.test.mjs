import test from 'node:test';
import assert from 'node:assert/strict';

import {
  resolveFaucetRpcUrl,
  resolveFaucetRpcUrls,
  resolveRegistryRpcUrls,
} from './registryFaucetRpcResolution.js';

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
      rpcUrl: [' https://shared.example ', 'https://direct-only.example'],
      rpcUrlsByChainId: {
        84532: ['https://shared.example', ' https://mapped-only.example '],
      },
    },
    deps,
  });

  assert.deepEqual(result, [
    'https://shared.example',
    'https://mapped-only.example',
    'https://direct-only.example',
  ]);
});

test('resolveRegistryRpcUrls falls back to direct config RPC URLs when no registry chain mapping exists', () => {
  const result = resolveRegistryRpcUrls({
    config: {
      registryChainId: '',
      rpcUrl: [' https://direct-a.example ', '', 'https://direct-b.example'],
      rpcUrlsByChainId: {
        84532: ['https://mapped.example'],
      },
    },
    deps,
  });

  assert.deepEqual(result, [
    'https://direct-a.example',
    'https://direct-b.example',
  ]);
});

test('resolveFaucetRpcUrl preserves explicit faucet rpcUrl precedence', () => {
  const result = resolveFaucetRpcUrl({
    config: {
      registryChainId: 84532,
      networkChainId: 84532,
      rpcUrl: 'https://fallback.example',
      rpcUrlsByChainId: {
        84532: ['https://mapped.example'],
      },
    },
    faucetCfg: {
      chainId: 8453,
      rpcUrl: ' https://explicit.example ',
    },
    deps,
  });

  assert.equal(result, 'https://explicit.example');
});

test('resolveFaucetRpcUrl uses faucet->network->registry chain precedence before falling back to config rpcUrl', () => {
  const result = resolveFaucetRpcUrl({
    config: {
      registryChainId: 8453,
      networkChainId: 84532,
      rpcUrl: 'https://fallback.example',
      rpcUrlsByChainId: {
        84532: [' https://network-chain.example '],
        8453: ['https://registry-chain.example'],
      },
    },
    faucetCfg: {},
    deps,
  });

  assert.equal(result, 'https://network-chain.example');
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

  assert.equal(result, 'https://sepolia.optimism.io');
});

test('resolveFaucetRpcUrls preserves Base Sepolia ordering and dedupe semantics', () => {
  const result = resolveFaucetRpcUrls({
    config: {
      registryChainId: 84532,
      networkChainId: 84532,
      rpcUrl: ['https://shared.example', 'https://fallback-only.example'],
      rpcUrlsByChainId: {
        84532: ['https://shared.example', 'https://mapped-only.example'],
      },
    },
    faucetCfg: {
      rpcUrl: 'https://explicit.example',
    },
    defaultFaucetRpcUrl: 'https://default.example',
    deps,
  });

  assert.deepEqual(result, [
    'https://explicit.example',
    'https://sepolia.base.org',
    'https://base-sepolia-rpc.publicnode.com',
    'https://base-sepolia.drpc.org',
    'https://shared.example',
    'https://mapped-only.example',
    'https://fallback-only.example',
    'https://default.example',
  ]);
});

test('resolveFaucetRpcUrls preserves OP Sepolia ordering and dedupe semantics', () => {
  const result = resolveFaucetRpcUrls({
    config: {
      registryChainId: 11155420,
      networkChainId: 11155420,
      rpcUrl: ['https://shared.example', 'https://fallback-only.example'],
      rpcUrlsByChainId: {
        11155420: ['https://shared.example', 'https://mapped-only.example'],
      },
    },
    faucetCfg: {
      rpcUrl: 'https://explicit.example',
    },
    defaultFaucetRpcUrl: 'https://default.example',
    deps,
  });

  assert.deepEqual(result, [
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
  ]);
});

test('resolveFaucetRpcUrls preserves mapped->fallback->Base mainnet ordering for Base mainnet faucet chains', () => {
  const result = resolveFaucetRpcUrls({
    config: {
      registryChainId: 84532,
      networkChainId: 84532,
      rpcUrl: 'https://fallback.example',
      rpcUrlsByChainId: {
        8453: ['https://mapped.example'],
      },
    },
    faucetCfg: {
      chainId: '8453',
    },
    defaultFaucetRpcUrl: 'https://default.example',
    deps,
  });

  assert.deepEqual(result, [
    'https://mapped.example',
    'https://fallback.example',
    'https://mainnet.base.org',
    'https://base.publicnode.com',
    'https://base-rpc.publicnode.com',
    'https://default.example',
  ]);
});
