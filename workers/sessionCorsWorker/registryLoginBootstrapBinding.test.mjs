import test from 'node:test';
import assert from 'node:assert/strict';

import { toChainId } from './chainIdNormalization.js';
import { createRegistryLoginBootstrapAdaptersWithWorkerDeps } from './registryLoginBootstrapBinding.js';

test('createRegistryLoginBootstrapAdaptersWithWorkerDeps returns the expected adapter functions', () => {
  const adapters = createRegistryLoginBootstrapAdaptersWithWorkerDeps();

  assert.equal(typeof adapters.computeScopesForLogin, 'function');
  assert.equal(typeof adapters.readSessionExistsOnChain, 'function');
  assert.equal(typeof adapters.readSessionBySlugOnChain, 'function');
  assert.equal(typeof adapters.validateBootstrapAdmin, 'function');
  assert.equal(typeof adapters.readResourceGateOnChain, 'function');
  assert.equal(typeof adapters.readRegistryCodeOnChain, 'function');
});

test('createRegistryLoginBootstrapAdaptersWithWorkerDeps preserves worker login deps bundles', async () => {
  const config = { registryAddress: '0xregistry', registryChainId: 84532 };
  const log = () => {};
  const warn = () => {};
  const calls = [];
  const sessionCheck = { exists: true, rpcUrl: 'https://rpc.example', errors: [] };
  const gateRead = { ok: true, gate: { sbtAddresses: [], chainId: 84532, mode: 0 }, rpcUrl: 'https://gate.example', errors: [] };
  const codeRead = { size: 64, rpcUrl: 'https://rpc.example', errors: [] };
  const scopes = { ai: true, arweave: true, transcribe: true, faucet: false, fetch: false };
  let chainAttestationCache;

  const adapters = createRegistryLoginBootstrapAdaptersWithWorkerDeps({
    deps: {
      resolveLoginAuthorityContext: async (value) => {
        calls.push('resolveLoginAuthorityContext');
        assert.equal(value.slug, 'session-a');
        assert.equal(value.address, '0xabc');
        assert.equal(value.config, config);
        chainAttestationCache = value.deps.chainAttestationCache;
        assert.ok(chainAttestationCache instanceof Map);
        assert.deepEqual(value.deps, {
          toStr: 'toStr',
          isAddress: 'isAddress',
          resolveRegistryRpcUrls: 'resolveRegistryRpcUrls',
          toRegistrySessionSlug: 'toRegistrySessionSlug',
          readSessionExistsOnChain: value.deps.readSessionExistsOnChain,
          chainAttestationCache,
          maskRpcUrl: 'maskRpcUrl',
          warn,
        });

        assert.equal(
          await value.deps.readSessionExistsOnChain({
            registryAddress: '0xregistry',
            registryRpcUrls: ['https://rpc.example'],
            registrySlug: 'session-a',
            expectedChainId: 84532,
            chainAttestationCache,
          }),
          sessionCheck,
        );

        return {
          registryAddress: '0xregistry',
          registryRpcUrls: ['https://rpc.example'],
          registrySlug: 'session-a',
          sessionCheck,
        };
      },
      computeLoginScopes: async (value) => {
        calls.push('computeLoginScopes');
        assert.equal(value.address, '0xabc');
        assert.equal(value.config, config);
        assert.equal(value.registryAddress, '0xregistry');
        assert.deepEqual(value.registryRpcUrls, ['https://rpc.example']);
        assert.equal(value.registrySlug, 'session-a');
        assert.equal(value.sessionCheck, sessionCheck);
        assert.deepEqual(value.resourceKeys, ['default', 'ai', 'arweave']);
        assert.equal(value.deps.chainAttestationCache, chainAttestationCache);
        assert.deepEqual(value.deps, {
          readResourceGateOnChain: value.deps.readResourceGateOnChain,
          resolveRpcUrlListForGate: 'resolveRpcUrlListForGate',
          checkSbtGate: 'checkSbtGate',
          probeRpcUrls: 'probeRpcUrls',
          readRegistryCodeOnChain: value.deps.readRegistryCodeOnChain,
          chainAttestationCache,
          maskRpcUrl: 'maskRpcUrl',
          toChainId: 'toChainId',
          toStr: 'toStr',
          log,
        });

        assert.equal(
          await value.deps.readResourceGateOnChain({
            registryAddress: '0xregistry',
            registryRpcUrls: ['https://rpc.example'],
            registrySlug: 'session-a',
            resourceKey: 'default',
            expectedChainId: 84532,
            chainAttestationCache,
          }),
          gateRead,
        );
        assert.equal(
          await value.deps.readRegistryCodeOnChain({
            registryAddress: '0xregistry',
            registryRpcUrls: ['https://rpc.example'],
            expectedChainId: 84532,
            chainAttestationCache,
          }),
          codeRead,
        );

        return scopes;
      },
      readSessionExistsOnChain: async (value) => {
        calls.push('readSessionExistsOnChain');
        assert.equal(value.registryAddress, '0xregistry');
        assert.deepEqual(value.registryRpcUrls, ['https://rpc.example']);
        assert.equal(value.registrySlug, 'session-a');
        assert.deepEqual(value.deps, {
          callRegistryFunction: 'callRegistryFunction',
          maskRpcUrl: 'maskRpcUrl',
          rpcRequest: 'rpcRequest',
          toStr: 'toStr',
          toChainId: 'toChainId',
        });
        return sessionCheck;
      },
      readResourceGateOnChain: async (value) => {
        calls.push('readResourceGateOnChain');
        assert.equal(value.registryAddress, '0xregistry');
        assert.deepEqual(value.registryRpcUrls, ['https://rpc.example']);
        assert.equal(value.registrySlug, 'session-a');
        assert.equal(value.resourceKey, 'default');
        assert.deepEqual(value.deps, {
          callRegistryFunction: 'callRegistryFunction',
          maskRpcUrl: 'maskRpcUrl',
          rpcRequest: 'rpcRequest',
          toStr: 'toStr',
          toChainId: 'toChainId',
        });
        return gateRead;
      },
      readRegistryCodeOnChain: async (value) => {
        calls.push('readRegistryCodeOnChain');
        assert.equal(value.registryAddress, '0xregistry');
        assert.deepEqual(value.registryRpcUrls, ['https://rpc.example']);
        assert.deepEqual(value.deps, {
          rpcRequest: 'rpcRequest',
          maskRpcUrl: 'maskRpcUrl',
          toStr: 'toStr',
          toChainId: 'toChainId',
        });
        return codeRead;
      },
      callRegistryFunction: 'callRegistryFunction',
      rpcRequest: 'rpcRequest',
      maskRpcUrl: 'maskRpcUrl',
      toStr: 'toStr',
      isAddress: 'isAddress',
      resolveRegistryRpcUrls: 'resolveRegistryRpcUrls',
      toRegistrySessionSlug: 'toRegistrySessionSlug',
      resolveRpcUrlListForGate: 'resolveRpcUrlListForGate',
      checkSbtGate: 'checkSbtGate',
      probeRpcUrls: 'probeRpcUrls',
      toChainId: 'toChainId',
      log,
      warn,
    },
    constants: {
      resourceGateKeys: ['default', 'ai', 'arweave'],
    },
  });

  assert.equal(
    await adapters.computeScopesForLogin({
      env: { ignored: true },
      slug: 'session-a',
      address: '0xabc',
      config,
    }),
    scopes,
  );

  assert.deepEqual(calls, [
    'resolveLoginAuthorityContext',
    'readSessionExistsOnChain',
    'computeLoginScopes',
    'readResourceGateOnChain',
    'readRegistryCodeOnChain',
  ]);
});

test('createRegistryLoginBootstrapAdaptersWithWorkerDeps preserves bootstrap admin deps bundles', async () => {
  const env = {
    REGISTRY_ADDRESS: '0xregistry',
    RPC_URL: 'https://rpc.example',
  };
  const body = {
    action: 'set-config',
    config: { adminAddress: '0xabc', registryChainId: 84532 },
  };
  const calls = [];

  const adapters = createRegistryLoginBootstrapAdaptersWithWorkerDeps({
    deps: {
      validateBootstrapAdmin: async (value) => {
        calls.push('validateBootstrapAdmin');
        assert.equal(value.env, env);
        assert.equal(value.slug, 'session-a');
        assert.equal(value.address, '0xabc');
        assert.equal(value.body, body);
        assert.deepEqual(value.deps, {
          toStr: 'toStr',
          isAddress: 'isAddress',
          normalizeRpcUrlList: 'normalizeRpcUrlList',
          toRegistrySessionSlug: 'toRegistrySessionSlug',
          readSessionExistsOnChain: value.deps.readSessionExistsOnChain,
          readSessionBySlugOnChain: value.deps.readSessionBySlugOnChain,
          toChainId: 'toChainId',
        });

        assert.deepEqual(
          await value.deps.readSessionExistsOnChain({
            registryAddress: '0xregistry',
            registryRpcUrls: ['https://rpc.example'],
            registrySlug: 'session-a',
          }),
          { exists: true },
        );
        assert.deepEqual(
          await value.deps.readSessionBySlugOnChain({
            registryAddress: '0xregistry',
            registryRpcUrls: ['https://rpc.example'],
            registrySlug: 'session-a',
          }),
          { ok: true, tuple: ['ignored'] },
        );
        return true;
      },
      readSessionExistsOnChain: async (value) => {
        calls.push('readSessionExistsOnChain');
        assert.deepEqual(value.deps, {
          callRegistryFunction: 'callRegistryFunction',
          maskRpcUrl: 'maskRpcUrl',
          rpcRequest: 'rpcRequest',
          toStr: 'toStr',
          toChainId: 'toChainId',
        });
        return { exists: true };
      },
      readSessionBySlugOnChain: async (value) => {
        calls.push('readSessionBySlugOnChain');
        assert.deepEqual(value.deps, {
          callRegistryFunction: 'callRegistryFunction',
          maskRpcUrl: 'maskRpcUrl',
          rpcRequest: 'rpcRequest',
          toStr: 'toStr',
          toChainId: 'toChainId',
        });
        return { ok: true, tuple: ['ignored'] };
      },
      callRegistryFunction: 'callRegistryFunction',
      rpcRequest: 'rpcRequest',
      maskRpcUrl: 'maskRpcUrl',
      toStr: 'toStr',
      isAddress: 'isAddress',
      normalizeRpcUrlList: 'normalizeRpcUrlList',
      toRegistrySessionSlug: 'toRegistrySessionSlug',
      toChainId: 'toChainId',
    },
  });

  assert.equal(
    await adapters.validateBootstrapAdmin({
      env,
      slug: 'session-a',
      address: '0xabc',
      body,
    }),
    true,
  );

  assert.deepEqual(calls, [
    'validateBootstrapAdmin',
    'readSessionExistsOnChain',
    'readSessionBySlugOnChain',
  ]);
});

test('computeScopesForLogin uses legacy networkChainId, attests once per request, and re-attests the next request', async () => {
  const registryMethods = [];
  let chainAttestations = 0;
  const adapters = createRegistryLoginBootstrapAdaptersWithWorkerDeps({
    deps: {
      toStr: (value) => `${value ?? ''}`,
      toChainId,
      isAddress: (value) => /^0x[0-9a-fA-F]{40}$/.test(`${value ?? ''}`),
      resolveRegistryRpcUrls: () => ['https://registry.example'],
      toRegistrySessionSlug: (value) => `${value ?? ''}`.trim() || 'general',
      callRegistryFunction: async ({ method }) => {
        registryMethods.push(method);
        if (method === 'sessionExists') return [true];
        if (method === 'getResourceGate') return [[], 84532, 0];
        throw new Error(`Unexpected registry method: ${method}`);
      },
      rpcRequest: async ({ method }) => {
        assert.equal(method, 'eth_chainId');
        chainAttestations += 1;
        return '0x14a34';
      },
      maskRpcUrl: (value) => value,
      log: () => {},
      warn: () => {},
    },
    constants: { resourceGateKeys: ['default', 'ai'] },
  });
  const request = {
    slug: 'session-a',
    address: '0x00000000000000000000000000000000000000aa',
    config: {
      registryAddress: '0x0000000000000000000000000000000000000001',
      networkChainId: 84532,
      rpcUrl: 'https://registry.example',
    },
  };

  const first = await adapters.computeScopesForLogin(request);
  const second = await adapters.computeScopesForLogin(request);

  assert.deepEqual(first, {
    ai: true,
    arweave: false,
    transcribe: true,
    faucet: false,
    fetch: false,
    lit: false,
    groups: true,
  });
  assert.deepEqual(second, first);
  assert.equal(chainAttestations, 2);
  assert.deepEqual(registryMethods, [
    'sessionExists', 'getResourceGate', 'getResourceGate',
    'sessionExists', 'getResourceGate', 'getResourceGate',
  ]);
});

test('computeScopesForLogin rejects a wrong-chain registry endpoint before contract reads', async () => {
  let registryReads = 0;
  const adapters = createRegistryLoginBootstrapAdaptersWithWorkerDeps({
    deps: {
      toStr: (value) => `${value ?? ''}`,
      toChainId,
      isAddress: (value) => /^0x[0-9a-fA-F]{40}$/.test(`${value ?? ''}`),
      resolveRegistryRpcUrls: () => ['https://wrong-chain.example'],
      toRegistrySessionSlug: (value) => `${value ?? ''}`.trim() || 'general',
      callRegistryFunction: async () => {
        registryReads += 1;
        return [true];
      },
      rpcRequest: async () => '0x14a34',
      maskRpcUrl: (value) => value,
      warn: () => {},
    },
    constants: { resourceGateKeys: ['default'] },
  });

  await assert.rejects(
    adapters.computeScopesForLogin({
      slug: 'session-a',
      address: '0x00000000000000000000000000000000000000aa',
      config: {
        registryAddress: '0x0000000000000000000000000000000000000001',
        registryChainId: 31337,
        rpcUrl: 'https://wrong-chain.example',
      },
    }),
    /Access denied: on-chain gate data unavailable\./,
  );
  assert.equal(registryReads, 0);
});
