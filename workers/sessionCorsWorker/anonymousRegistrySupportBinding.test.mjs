import test from 'node:test';
import assert from 'node:assert/strict';

import { createAnonymousRegistrySupportAdaptersWithWorkerDeps } from './anonymousRegistrySupportBinding.js';

test('createAnonymousRegistrySupportAdaptersWithWorkerDeps returns the expected adapter functions', () => {
  const adapters = createAnonymousRegistrySupportAdaptersWithWorkerDeps();

  assert.equal(typeof adapters.resolveRequestSlugWithoutToken, 'function');
  assert.equal(typeof adapters.evaluateAnonymousRouteAccess, 'function');
  assert.equal(typeof adapters.resolveAnonymousRateIdentity, 'function');
});

test('createAnonymousRegistrySupportAdaptersWithWorkerDeps preserves anonymous slug and rate identity deps bundles', async () => {
  const request = new Request('https://worker.example/ai', {
    headers: {
      'X-Session-Slug': 'session-a',
      'X-Anonymous-Client-Id': 'Client_Abc12345',
    },
  });
  const env = { DEFAULT_SESSION_SLUG: '' };
  const calls = [];

  const adapters = createAnonymousRegistrySupportAdaptersWithWorkerDeps({
    deps: {
      resolveRequestSlugWithoutToken: (value) => {
        calls.push('resolveRequestSlugWithoutToken');
        assert.equal(value.request, request);
        assert.equal(value.env, env);
        assert.equal(value.slugHint, 'slug-hint');
        assert.deepEqual(value.deps, {
          resolveWorkerRequestSlugContext: 'resolveWorkerRequestSlugContext',
        });
        return {
          ok: true,
          slug: 'session-a',
          explicitSlugProvided: true,
        };
      },
      resolveAnonymousRateIdentity: (value) => {
        calls.push('resolveAnonymousRateIdentity');
        assert.equal(value.request, request);
        assert.deepEqual(value.deps, {
          toStr: 'toStr',
        });
        assert.deepEqual(value.constants, {
          anonymousRateIdHeader: 'X-Anonymous-Client-Id',
          anonymousUnknownIdentity: 'anon:unknown',
        });
        return 'anon:cid:client_abc12345';
      },
      resolveWorkerRequestSlugContext: 'resolveWorkerRequestSlugContext',
      toStr: 'toStr',
    },
    constants: {
      anonymousRateIdHeader: 'X-Anonymous-Client-Id',
      anonymousUnknownIdentity: 'anon:unknown',
    },
  });

  assert.deepEqual(
    adapters.resolveRequestSlugWithoutToken({
      request,
      env,
      slugHint: 'slug-hint',
    }),
    {
      ok: true,
      slug: 'session-a',
      explicitSlugProvided: true,
    },
  );
  assert.equal(
    adapters.resolveAnonymousRateIdentity(request),
    'anon:cid:client_abc12345',
  );

  assert.deepEqual(calls, [
    'resolveRequestSlugWithoutToken',
    'resolveAnonymousRateIdentity',
  ]);
});

test('createAnonymousRegistrySupportAdaptersWithWorkerDeps preserves anonymous gate deps bundles', async () => {
  const config = {
    registryAddress: '0xregistry',
    rpcUrl: 'https://rpc.example',
  };
  const warn = () => {};
  const calls = [];
  const sessionCheck = { exists: true, rpcUrl: 'https://rpc.example', errors: [] };
  const defaultGate = { ok: true, gate: { sbtAddresses: [], chainId: 84532, mode: 0 }, errors: [] };

  const adapters = createAnonymousRegistrySupportAdaptersWithWorkerDeps({
    deps: {
      evaluateAnonymousRouteAccess: async (value) => {
        calls.push('evaluateAnonymousRouteAccess');
        assert.equal(value.slug, 'debate');
        assert.equal(value.config, config);
        assert.equal(value.route, 'ai');
        assert.equal(value.apiKey, '');
        assert.deepEqual(value.deps, {
          toStr: 'toStr',
          isAddress: 'isAddress',
          resolveRegistryRpcUrls: 'resolveRegistryRpcUrls',
          toRegistrySessionSlug: 'toRegistrySessionSlug',
          maskRpcUrl: 'maskRpcUrl',
          readSessionExistsOnChain: value.deps.readSessionExistsOnChain,
          readResourceGateOnChain: value.deps.readResourceGateOnChain,
          warn,
        });
        assert.deepEqual(value.constants, {
          anonymousGateUnavailableError: 'Access denied: on-chain gate data unavailable.',
          anonymousRouteDeniedError: 'Anonymous access denied.',
          anonymousScopeDisabledError: 'Anonymous scope disabled.',
        });

        assert.equal(
          await value.deps.readSessionExistsOnChain({
            registryAddress: '0xregistry',
            registryRpcUrls: ['https://rpc.example'],
            registrySlug: 'rxc',
          }),
          sessionCheck,
        );
        assert.equal(
          await value.deps.readResourceGateOnChain({
            registryAddress: '0xregistry',
            registryRpcUrls: ['https://rpc.example'],
            registrySlug: 'rxc',
            resourceKey: 'default',
          }),
          defaultGate,
        );

        return { ok: true, reason: 'open-default-ai-gates' };
      },
      readSessionExistsOnChain: async () => {
        calls.push('readSessionExistsOnChain');
        return sessionCheck;
      },
      readResourceGateOnChain: async () => {
        calls.push('readResourceGateOnChain');
        return defaultGate;
      },
      toStr: 'toStr',
      isAddress: 'isAddress',
      resolveRegistryRpcUrls: 'resolveRegistryRpcUrls',
      toRegistrySessionSlug: 'toRegistrySessionSlug',
      maskRpcUrl: 'maskRpcUrl',
      warn,
    },
    constants: {
      anonymousGateUnavailableError: 'Access denied: on-chain gate data unavailable.',
      anonymousRouteDeniedError: 'Anonymous access denied.',
      anonymousScopeDisabledError: 'Anonymous scope disabled.',
    },
  });

  assert.deepEqual(
    await adapters.evaluateAnonymousRouteAccess({
      slug: 'debate',
      config,
      route: 'ai',
      apiKey: '',
    }),
    { ok: true, reason: 'open-default-ai-gates' },
  );

  assert.deepEqual(calls, [
    'evaluateAnonymousRouteAccess',
    'readSessionExistsOnChain',
    'readResourceGateOnChain',
  ]);
});
