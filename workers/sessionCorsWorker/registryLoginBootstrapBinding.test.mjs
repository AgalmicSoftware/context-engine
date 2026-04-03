import test from 'node:test';
import assert from 'node:assert/strict';

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
  const config = { registryAddress: '0xregistry' };
  const log = () => {};
  const warn = () => {};
  const calls = [];
  const sessionCheck = { exists: true, rpcUrl: 'https://rpc.example', errors: [] };
  const gateRead = { ok: true, gate: { sbtAddresses: [], chainId: 84532, mode: 0 }, rpcUrl: 'https://gate.example', errors: [] };
  const codeRead = { size: 64, rpcUrl: 'https://rpc.example', errors: [] };
  const scopes = { ai: true, arweave: true, transcribe: true, faucet: false, fetch: false };

  const adapters = createRegistryLoginBootstrapAdaptersWithWorkerDeps({
    deps: {
      resolveLoginAuthorityContext: async (value) => {
        calls.push('resolveLoginAuthorityContext');
        assert.equal(value.slug, 'session-a');
        assert.equal(value.address, '0xabc');
        assert.equal(value.config, config);
        assert.deepEqual(value.deps, {
          toStr: 'toStr',
          isAddress: 'isAddress',
          resolveRegistryRpcUrls: 'resolveRegistryRpcUrls',
          toRegistrySessionSlug: 'toRegistrySessionSlug',
          readSessionExistsOnChain: value.deps.readSessionExistsOnChain,
          maskRpcUrl: 'maskRpcUrl',
          warn,
        });

        assert.equal(
          await value.deps.readSessionExistsOnChain({
            registryAddress: '0xregistry',
            registryRpcUrls: ['https://rpc.example'],
            registrySlug: 'session-a',
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
        assert.deepEqual(value.deps, {
          readResourceGateOnChain: value.deps.readResourceGateOnChain,
          resolveRpcUrlListForGate: 'resolveRpcUrlListForGate',
          checkSbtGate: 'checkSbtGate',
          probeRpcUrls: 'probeRpcUrls',
          readRegistryCodeOnChain: value.deps.readRegistryCodeOnChain,
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
          }),
          gateRead,
        );
        assert.equal(
          await value.deps.readRegistryCodeOnChain({
            registryAddress: '0xregistry',
            registryRpcUrls: ['https://rpc.example'],
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
          toStr: 'toStr',
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
    config: { adminAddress: '0xabc' },
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
          toStr: 'toStr',
        });
        return { exists: true };
      },
      readSessionBySlugOnChain: async (value) => {
        calls.push('readSessionBySlugOnChain');
        assert.deepEqual(value.deps, {
          callRegistryFunction: 'callRegistryFunction',
          maskRpcUrl: 'maskRpcUrl',
          toStr: 'toStr',
        });
        return { ok: true, tuple: ['ignored'] };
      },
      callRegistryFunction: 'callRegistryFunction',
      maskRpcUrl: 'maskRpcUrl',
      toStr: 'toStr',
      isAddress: 'isAddress',
      normalizeRpcUrlList: 'normalizeRpcUrlList',
      toRegistrySessionSlug: 'toRegistrySessionSlug',
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
