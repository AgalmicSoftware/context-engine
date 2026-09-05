import test from 'node:test';
import assert from 'node:assert/strict';
import {
  listRegistrySessionsForBridge,
  resolveRegistryRpcUrls,
  resolveSessionRegistryAddress,
} from './registrySessions.mjs';

class MemoryKv {
  constructor(seed = {}) {
    this.store = new Map(Object.entries(seed));
  }

  async put(key, value) {
    this.store.set(key, value);
  }

  async get(key) {
    return this.store.get(key) || null;
  }
}

function word(value) {
  return BigInt(value).toString(16).padStart(64, '0');
}

function encodeStringResult(value = '') {
  const bytes = new TextEncoder().encode(String(value));
  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  const paddedLength = Math.ceil(hex.length / 64) * 64;
  return `0x${word(32)}${word(bytes.length)}${hex.padEnd(paddedLength, '0')}`;
}

function decodeIndexFromCallData(data = '') {
  return Number(BigInt(`0x${String(data).slice(10) || '0'}`));
}

function registryFetchMock({
  slugs = [],
  failDefault = false,
  defaultRpc = 'https://public-rpc.example',
} = {}) {
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    calls.push([url, init]);
    const body = JSON.parse(init.body || '{}');
    if (failDefault && url === defaultRpc) {
      return new Response(JSON.stringify({
        jsonrpc: '2.0',
        id: body.id,
        error: { code: -32000, message: 'rate limited' },
      }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    if (body.params?.[0]?.data === '0x6e6734bf') {
      return new Response(JSON.stringify({
        jsonrpc: '2.0',
        id: body.id,
        result: `0x${word(slugs.length)}`,
      }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    if (String(body.params?.[0]?.data || '').startsWith('0x27916a76')) {
      const index = decodeIndexFromCallData(body.params[0].data);
      return new Response(JSON.stringify({
        jsonrpc: '2.0',
        id: body.id,
        result: encodeStringResult(slugs[index] || ''),
      }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    return new Response(JSON.stringify({
      jsonrpc: '2.0',
      id: body.id,
      error: { code: -32601, message: 'unknown call' },
    }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };
  return { calls, fetchImpl };
}

test('resolveRegistryRpcUrls keeps DEFAULT_RPC_URL first and ADDITIONAL_RPC_URL additive', () => {
  assert.deepEqual(resolveRegistryRpcUrls({
    DEFAULT_RPC_URL: 'https://public-rpc.example',
    ADDITIONAL_RPC_URL: 'https://infura.example/op-sepolia',
  }), [
    'https://public-rpc.example',
    'https://infura.example/op-sepolia',
  ]);
  assert.deepEqual(resolveRegistryRpcUrls({
    DEFAULT_RPC_URL: 'https://public-rpc.example',
    ADDITIONAL_RPC_URL: 'https://public-rpc.example, https://infura.example/op-sepolia',
  }), [
    'https://public-rpc.example',
    'https://infura.example/op-sepolia',
  ]);
});

test('resolveSessionRegistryAddress defaults OP Sepolia registry and accepts explicit override', () => {
  assert.equal(
    resolveSessionRegistryAddress({ DEFAULT_CHAIN_ID: '11155420' }),
    '0xDcB1731984E9F75c6a061c38dD8b67d18De4C0c1',
  );
  assert.equal(
    resolveSessionRegistryAddress({
      SESSION_REGISTRY_ADDRESS: '0x1111111111111111111111111111111111111111',
    }),
    '0x1111111111111111111111111111111111111111',
  );
});

test('listRegistrySessionsForBridge lists real registry slugs through additive RPC fallback', async () => {
  const defaultRpc = 'https://public-rpc.example';
  const { calls, fetchImpl } = registryFetchMock({
    slugs: ['alpha', 'beta-room'],
    failDefault: true,
    defaultRpc,
  });

  const result = await listRegistrySessionsForBridge({
    env: {
      DEFAULT_CHAIN_ID: '11155420',
      DEFAULT_RPC_URL: defaultRpc,
      ADDITIONAL_RPC_URL: 'https://infura.example/op-sepolia',
    },
    fetchImpl,
  });

  assert.equal(result.ok, true);
  assert.equal(result.reason, 'session_registry_loaded');
  assert.deepEqual(result.sessions.map((session) => session.sessionSlug), ['alpha', 'beta-room']);
  assert.equal(result.sessions[0].default, true);
  assert.equal(result.sessions[0].source, 'session_registry');
  assert.equal(calls[0][0], defaultRpc);
  assert.equal(calls[1][0], 'https://infura.example/op-sepolia');
});

test('listRegistrySessionsForBridge reads the newest registry window when capped', async () => {
  const defaultRpc = 'https://latest-window-rpc.example';
  const { calls, fetchImpl } = registryFetchMock({
    slugs: ['alpha', 'beta', 'gamma', 'delta', 'epsilon'],
    defaultRpc,
  });

  const result = await listRegistrySessionsForBridge({
    env: {
      DEFAULT_CHAIN_ID: '11155420',
      DEFAULT_RPC_URL: defaultRpc,
      AGENT_BRIDGE_MAX_REGISTRY_SESSIONS: '3',
    },
    fetchImpl,
  });

  const slugIndices = calls
    .map(([, init]) => JSON.parse(init.body || '{}').params?.[0]?.data || '')
    .filter((data) => String(data).startsWith('0x27916a76'))
    .map(decodeIndexFromCallData);

  assert.equal(result.ok, true);
  assert.deepEqual(result.sessions.map((session) => session.sessionSlug), ['gamma', 'delta', 'epsilon']);
  assert.equal(result.count, 5);
  assert.equal(result.limit, 3);
  assert.equal(result.startIndex, 2);
  assert.deepEqual(slugIndices, [2, 3, 4]);
});

test('listRegistrySessionsForBridge stays disabled without explicit RPC URL', async () => {
  const result = await listRegistrySessionsForBridge({
    env: { DEFAULT_CHAIN_ID: '11155420' },
    fetchImpl: async () => {
      throw new Error('must not call network');
    },
  });

  assert.equal(result.ok, false);
  assert.equal(result.reason, 'registry_rpc_url_missing');
});

test('listRegistrySessionsForBridge writes and reads KV cache without storing RPC URLs', async () => {
  const defaultRpc = 'https://kv-rpc.example';
  const kv = new MemoryKv();
  const { calls, fetchImpl } = registryFetchMock({ slugs: ['kv-alpha'], defaultRpc });

  const loaded = await listRegistrySessionsForBridge({
    env: {
      DEFAULT_CHAIN_ID: '11155420',
      DEFAULT_RPC_URL: defaultRpc,
      AGENT_ACTION_KV: kv,
      AGENT_BRIDGE_MAX_REGISTRY_SESSIONS: '7',
    },
    fetchImpl,
  });

  assert.equal(loaded.ok, true);
  assert.deepEqual(loaded.sessions.map((session) => session.sessionSlug), ['kv-alpha']);
  assert.equal(calls.length > 0, true);
  const cacheEntries = [...kv.store.entries()];
  assert.equal(cacheEntries.length, 1);
  assert.equal(cacheEntries[0][0].includes(defaultRpc), false);

  const cached = await listRegistrySessionsForBridge({
    env: {
      DEFAULT_CHAIN_ID: '11155420',
      DEFAULT_RPC_URL: 'https://kv-rpc-fresh-process.example',
      AGENT_ACTION_KV: new MemoryKv(Object.fromEntries(cacheEntries)),
      AGENT_BRIDGE_MAX_REGISTRY_SESSIONS: '7',
    },
    fetchImpl: async () => {
      throw new Error('must not call network on KV cache hit');
    },
  });

  assert.equal(cached.ok, true);
  assert.equal(cached.cacheLayer, 'kv');
  assert.deepEqual(cached.sessions.map((session) => session.sessionSlug), ['kv-alpha']);
});

test('listRegistrySessionsForBridge forceRefresh bypasses stale memory and KV cache', async () => {
  const defaultRpc = 'https://force-refresh-rpc.example';
  const kv = new MemoryKv();
  const initial = registryFetchMock({ slugs: ['old-alpha'], defaultRpc });

  const loaded = await listRegistrySessionsForBridge({
    env: {
      DEFAULT_CHAIN_ID: '11155420',
      DEFAULT_RPC_URL: defaultRpc,
      AGENT_ACTION_KV: kv,
    },
    fetchImpl: initial.fetchImpl,
  });
  assert.deepEqual(loaded.sessions.map((session) => session.sessionSlug), ['old-alpha']);

  const fresh = registryFetchMock({ slugs: ['fresh-alpha', 'fresh-beta'], defaultRpc });
  const refreshed = await listRegistrySessionsForBridge({
    env: {
      DEFAULT_CHAIN_ID: '11155420',
      DEFAULT_RPC_URL: defaultRpc,
      AGENT_ACTION_KV: kv,
    },
    fetchImpl: fresh.fetchImpl,
    forceRefresh: true,
  });

  assert.equal(refreshed.ok, true);
  assert.deepEqual(refreshed.sessions.map((session) => session.sessionSlug), ['fresh-alpha', 'fresh-beta']);
  assert.equal(fresh.calls.length > 0, true);
});
