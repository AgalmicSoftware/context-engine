import test from 'node:test';
import assert from 'node:assert/strict';

import { createRpcContractProbeHelpersWithWorkerDeps } from './rpcContractProbeBinding.js';

test('createRpcContractProbeHelpersWithWorkerDeps returns the expected helper functions', () => {
  const helpers = createRpcContractProbeHelpersWithWorkerDeps();

  assert.equal(typeof helpers.maskRpcUrl, 'function');
  assert.equal(typeof helpers.rpcRequest, 'function');
  assert.equal(typeof helpers.callContractFunction, 'function');
  assert.equal(typeof helpers.callRegistryFunction, 'function');
  assert.equal(typeof helpers.probeRpcUrl, 'function');
  assert.equal(typeof helpers.probeRpcUrls, 'function');
});

test('createRpcContractProbeHelpersWithWorkerDeps reduces rpc diagnostics to a safe origin', () => {
  const { maskRpcUrl } = createRpcContractProbeHelpersWithWorkerDeps({
    deps: {
      toStr: (value) => (typeof value === 'string' ? value : value == null ? '' : String(value)),
    },
  });

  assert.equal(
    maskRpcUrl(' https://eth-mainnet.g.alchemy.com/v2/SECRET?apiKey=also-secret '),
    'https://eth-mainnet.g.alchemy.com',
  );
  assert.equal(maskRpcUrl('not-a-valid-url/v2/SECRET?secret=yes'), '[invalid-rpc-url]');
  assert.equal(maskRpcUrl(''), '');
});

test('createRpcContractProbeHelpersWithWorkerDeps preserves rpc request payloads and error metadata', async () => {
  const fetchCalls = [];
  const { rpcRequest } = createRpcContractProbeHelpersWithWorkerDeps({
    deps: {
      toStr: (value) => (typeof value === 'string' ? value : value == null ? '' : String(value)),
      fetch: async (url, options) => {
        fetchCalls.push([url, options]);
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify({ result: '0xabc123' }),
        };
      },
    },
  });

  assert.equal(
    await rpcRequest({
      rpcUrl: ' https://rpc.example ',
      method: 'eth_chainId',
      params: [],
    }),
    '0xabc123',
  );
  assert.deepEqual(fetchCalls, [[
    'https://rpc.example',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_chainId', params: [] }),
    },
  ]]);

  const nonJsonHelpers = createRpcContractProbeHelpersWithWorkerDeps({
    deps: {
      toStr: (value) => (typeof value === 'string' ? value : value == null ? '' : String(value)),
      fetch: async () => ({
        ok: false,
        status: 502,
        text: async () => '<html>bad gateway</html>',
      }),
    },
  });
  await assert.rejects(
    nonJsonHelpers.rpcRequest({
      rpcUrl: 'https://rpc.example',
      method: 'eth_call',
      params: [],
    }),
    (err) => {
      assert.equal(err.message, 'RPC returned a non-JSON response.');
      assert.equal(err.rpcStatus, 502);
      assert.equal(Object.hasOwn(err, 'rpcBody'), false);
      return true;
    },
  );

  const rpcErrorHelpers = createRpcContractProbeHelpersWithWorkerDeps({
    deps: {
      toStr: (value) => (typeof value === 'string' ? value : value == null ? '' : String(value)),
      fetch: async () => ({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({
          error: {
            code: -32000,
            message: 'upstream down at https://TENANT_SECRET.rpc.example/v2/ALCHEMY_SECRET',
            data: { endpoint: 'https://TENANT_SECRET.rpc.example/v2/ALCHEMY_SECRET' },
          },
        }),
      }),
    },
  });
  await assert.rejects(
    rpcErrorHelpers.rpcRequest({
      rpcUrl: 'https://rpc.example',
      method: 'eth_call',
      params: [],
    }),
    (err) => {
      assert.equal(err.message, 'RPC request failed.');
      assert.equal(err.rpcStatus, 200);
      assert.equal(err.rpcCode, -32000);
      assert.equal(Object.hasOwn(err, 'rpcError'), false);
      assert.equal(JSON.stringify(err).includes('TENANT_SECRET'), false);
      assert.equal(JSON.stringify(err).includes('ALCHEMY_SECRET'), false);
      return true;
    },
  );
});

test('createRpcContractProbeHelpersWithWorkerDeps rejects blocked rpc request targets before fetch', async () => {
  let fetchCount = 0;
  const { rpcRequest } = createRpcContractProbeHelpersWithWorkerDeps({
    deps: {
      toStr: (value) => (typeof value === 'string' ? value : value == null ? '' : String(value)),
      isBlockedOutboundUrl: (url) => String(url).includes('127.0.0.1'),
      fetch: async () => {
        fetchCount += 1;
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify({ result: '0x1' }),
        };
      },
    },
  });

  await assert.rejects(
    rpcRequest({
      rpcUrl: 'http://127.0.0.1:8545',
      method: 'eth_chainId',
      params: [],
    }),
    (err) => {
      assert.equal(err.message, 'Blocked RPC URL');
      assert.equal(err.rpcStatus, 403);
      assert.equal(err.rpcBlocked, true);
      return true;
    },
  );
  assert.equal(fetchCount, 0);
});

test('createRpcContractProbeHelpersWithWorkerDeps preserves contract and registry eth_call encoding/decoding', async () => {
  const fetchCalls = [];
  const contractIface = {
    encodeFunctionData: (method, args) => {
      assert.equal(method, 'balanceOf');
      assert.deepEqual(args, ['0xabc']);
      return '0xencoded';
    },
    decodeFunctionResult: (method, value) => {
      assert.equal(method, 'balanceOf');
      assert.equal(value, '0xfeed');
      return ['decoded-contract'];
    },
  };
  const registryIface = {
    encodeFunctionData: (method, args) => {
      assert.equal(method, 'sessionExists');
      assert.deepEqual(args, ['session-a']);
      return '0xregistry';
    },
    decodeFunctionResult: (method, value) => {
      assert.equal(method, 'sessionExists');
      assert.equal(value, '0xbeef');
      return [true];
    },
  };

  const helpers = createRpcContractProbeHelpersWithWorkerDeps({
    deps: {
      toStr: (value) => (typeof value === 'string' ? value : value == null ? '' : String(value)),
      fetch: async (_url, options) => {
        fetchCalls.push(JSON.parse(options.body));
        const result = fetchCalls.length === 1 ? '0xfeed' : '0xbeef';
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify({ result }),
        };
      },
      getRegistryInterface: () => registryIface,
    },
  });

  assert.deepEqual(
    await helpers.callContractFunction({
      rpcUrl: 'https://rpc.example',
      contractAddress: '0xcontract',
      iface: contractIface,
      method: 'balanceOf',
      args: ['0xabc'],
    }),
    ['decoded-contract'],
  );

  assert.deepEqual(
    await helpers.callRegistryFunction({
      rpcUrl: 'https://rpc.example',
      registryAddress: '0xregistry-address',
      method: 'sessionExists',
      args: ['session-a'],
    }),
    [true],
  );

  assert.deepEqual(fetchCalls, [
    {
      jsonrpc: '2.0',
      id: 1,
      method: 'eth_call',
      params: [{ to: '0xcontract', data: '0xencoded' }, 'latest'],
    },
    {
      jsonrpc: '2.0',
      id: 1,
      method: 'eth_call',
      params: [{ to: '0xregistry-address', data: '0xregistry' }, 'latest'],
    },
  ]);
});

test('createRpcContractProbeHelpersWithWorkerDeps rejects blocked rpc probe targets before fetch', async () => {
  let fetchCount = 0;
  const logs = [];
  const helpers = createRpcContractProbeHelpersWithWorkerDeps({
    deps: {
      toStr: (value) => (typeof value === 'string' ? value : value == null ? '' : String(value)),
      isBlockedOutboundUrl: (url) => String(url).includes('metadata.google.internal'),
      fetch: async () => {
        fetchCount += 1;
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify({ result: '0x1' }),
        };
      },
      log: (...args) => {
        logs.push(args);
      },
    },
  });

  await helpers.probeRpcUrl({
    rpcUrl: 'http://metadata.google.internal/computeMetadata/v1',
    label: 'metadata',
  });

  assert.equal(fetchCount, 0);
  assert.deepEqual(logs, [[
    '[rpc-probe] failed',
    {
      label: 'metadata',
      rpcUrl: 'http://metadata.google.internal',
      error: 'Blocked RPC URL',
    },
  ]]);
});

test('createRpcContractProbeHelpersWithWorkerDeps never logs credential-bearing rpc paths on response or failure', async () => {
  const fetchCalls = [];
  const logs = [];
  const nowValues = [100, 112, 200, 240];
  const responseRpcUrl = 'https://eth-mainnet.g.alchemy.com/v2/SECRET_RESPONSE';
  const failureRpcUrl = 'https://eth-mainnet.g.alchemy.com/v2/SECRET_FAILURE';
  const helpers = createRpcContractProbeHelpersWithWorkerDeps({
    deps: {
      toStr: (value) => (typeof value === 'string' ? value : value == null ? '' : String(value)),
      fetch: async (url) => {
        fetchCalls.push(url);
        if (url === responseRpcUrl) {
          return {
            ok: false,
            status: 502,
            text: async () => `upstream rejected ${responseRpcUrl}`,
          };
        }
        throw new Error(`request to ${failureRpcUrl} failed`);
      },
      now: () => nowValues.shift() ?? 0,
      log: (...args) => {
        logs.push(args);
      },
    },
  });

  await helpers.probeRpcUrls({
    rpcUrls: [responseRpcUrl, failureRpcUrl],
    label: 'registry',
  });

  assert.deepEqual(fetchCalls, [
    responseRpcUrl,
    failureRpcUrl,
  ]);
  assert.deepEqual(logs, [
    ['[rpc-probe] response', {
      label: 'registry',
      rpcUrl: 'https://eth-mainnet.g.alchemy.com',
      status: 502,
      ok: false,
      durationMs: 12,
      result: '',
      bodyPreview: '[non-JSON response omitted]',
    }],
    ['[rpc-probe] failed', {
      label: 'registry',
      rpcUrl: 'https://eth-mainnet.g.alchemy.com',
      error: 'RPC probe failed',
    }],
  ]);
  const serializedLogs = JSON.stringify(logs);
  assert.equal(serializedLogs.includes('/v2/'), false);
  assert.equal(serializedLogs.includes('SECRET_RESPONSE'), false);
  assert.equal(serializedLogs.includes('SECRET_FAILURE'), false);
});

test('createRpcContractProbeHelpersWithWorkerDeps never logs arbitrary upstream chain-id results', async () => {
  const logs = [];
  const resultValues = ['0x14a34', 'TENANT_SECRET_FROM_UPSTREAM'];
  const helpers = createRpcContractProbeHelpersWithWorkerDeps({
    deps: {
      fetch: async () => ({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ result: resultValues.shift() }),
      }),
      now: () => 0,
      log: (...args) => logs.push(args),
    },
  });

  await helpers.probeRpcUrl({ rpcUrl: 'https://rpc.example', label: 'registry' });
  await helpers.probeRpcUrl({ rpcUrl: 'https://rpc.example', label: 'registry' });

  assert.equal(logs[0][1].result, 84532);
  assert.equal(logs[1][1].result, '[invalid-chain-id]');
  assert.equal(JSON.stringify(logs).includes('TENANT_SECRET_FROM_UPSTREAM'), false);
});
