import test from 'node:test';
import assert from 'node:assert/strict';

import { resolveRpcUrlListForGate } from './gateRpcResolution.js';

const toStr = (value) => (typeof value === 'string' ? value : value == null ? '' : String(value));

const deps = {
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
};

test('resolveRpcUrlListForGate returns normalized direct config RPC URLs when gateChainId is falsy', () => {
  const result = resolveRpcUrlListForGate({
    config: {
      rpcUrl: [' https://rpc-1.example ', '', 'https://rpc-2.example'],
      rpcUrlsByChainId: {
        84532: ['https://mapped.example'],
      },
    },
    gateChainId: '',
    deps,
  });

  assert.deepEqual(result, [
    'https://rpc-1.example',
    'https://rpc-2.example',
  ]);
});

test('resolveRpcUrlListForGate returns mapped-only RPC URLs for a non-registry gate chain', () => {
  const result = resolveRpcUrlListForGate({
    config: {
      rpcUrl: 'https://fallback.example',
      registryChainId: 8453,
      rpcUrlsByChainId: {
        84532: [' https://mapped-a.example ', 'https://mapped-b.example'],
      },
    },
    gateChainId: 84532,
    deps,
  });

  assert.deepEqual(result, [
    'https://mapped-a.example',
    'https://mapped-b.example',
  ]);
});

test('resolveRpcUrlListForGate falls back to supported OP and Base Sepolia public RPCs', () => {
  const opSepolia = resolveRpcUrlListForGate({
    config: {
      networkChainId: 11155420,
      sessionModeProfile: { authority: { mode: 'worker_canonical' } },
    },
    gateChainId: 11155420,
    deps,
  });
  const baseSepolia = resolveRpcUrlListForGate({
    config: {
      networkChainId: 84532,
      sessionModeProfile: { authority: { mode: 'worker_canonical' } },
    },
    gateChainId: 84532,
    deps,
  });

  assert.equal(opSepolia[0], 'https://sepolia.optimism.io');
  assert.equal(baseSepolia[0], 'https://base-sepolia-rpc.publicnode.com');
});

test('resolveRpcUrlListForGate keeps missing-RPC legacy sessions fail-closed', () => {
  const result = resolveRpcUrlListForGate({
    config: {
      networkChainId: 11155420,
      sessionModeProfile: { authority: { mode: 'evm_registry_canonical' } },
    },
    gateChainId: 11155420,
    deps,
  });

  assert.deepEqual(result, []);
});

test('resolveRpcUrlListForGate keeps explicit chain config ahead of supported-chain fallbacks', () => {
  const result = resolveRpcUrlListForGate({
    config: {
      rpcUrlsByChainId: {
        11155420: ['https://configured-rpc.example.test'],
      },
    },
    gateChainId: 11155420,
    deps,
  });

  assert.deepEqual(result, ['https://configured-rpc.example.test']);
});

test('resolveRpcUrlListForGate merges mapped and direct RPC URLs when the gate chain matches the registry chain', () => {
  const result = resolveRpcUrlListForGate({
    config: {
      rpcUrl: [' https://fallback-a.example ', 'https://fallback-b.example'],
      registryChainId: '84532',
      rpcUrlsByChainId: {
        84532: [' https://mapped-a.example ', 'https://mapped-b.example'],
      },
    },
    gateChainId: 84532,
    deps,
  });

  assert.deepEqual(result, [
    'https://mapped-a.example',
    'https://mapped-b.example',
    'https://fallback-a.example',
    'https://fallback-b.example',
  ]);
});

test('resolveRpcUrlListForGate accepts both numeric-style and string chain-id keys', () => {
  const numericKeyResult = resolveRpcUrlListForGate({
    config: {
      rpcUrlsByChainId: {
        84532: ' https://numeric-key.example ',
      },
    },
    gateChainId: '84532',
    deps,
  });

  const stringKeyResult = resolveRpcUrlListForGate({
    config: {
      rpcUrlsByChainId: {
        '84532': ' https://string-key.example ',
      },
    },
    gateChainId: 84532,
    deps,
  });

  assert.deepEqual(numericKeyResult, ['https://numeric-key.example']);
  assert.deepEqual(stringKeyResult, ['https://string-key.example']);
});

test('resolveRpcUrlListForGate preserves existing dedupe semantics when merging mapped and direct RPC URLs', () => {
  const result = resolveRpcUrlListForGate({
    config: {
      rpcUrl: [' https://shared.example ', 'https://direct-only.example', 'https://shared.example'],
      registryChainId: 84532,
      rpcUrlsByChainId: {
        84532: ['https://shared.example', ' https://mapped-only.example '],
      },
    },
    gateChainId: '84532',
    deps,
  });

  assert.deepEqual(result, [
    'https://shared.example',
    'https://mapped-only.example',
    'https://direct-only.example',
  ]);
});
