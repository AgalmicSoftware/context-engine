import test from 'node:test';
import assert from 'node:assert/strict';

import { evaluateAnonymousRouteAccess } from './anonymousRouteAccessValidation.js';

const REGISTRY_ADDRESS = '0x0000000000000000000000000000000000000001';
const MASKED_RPC = 'masked:https://rpc.example';

const toStr = (value) => (typeof value === 'string' ? value : value == null ? '' : String(value));
const isAddress = (value) => /^0x[0-9a-fA-F]{40}$/.test(toStr(value).trim());

const createDeps = (overrides = {}) => ({
  toStr,
  isAddress,
  resolveRegistryRpcUrls: () => ['https://rpc.example'],
  toRegistrySessionSlug: (slug) => {
    const value = toStr(slug).trim().toLowerCase();
    return value === 'debate' ? 'rxc' : (value || 'general');
  },
  maskRpcUrl: () => MASKED_RPC,
  readSessionExistsOnChain: async ({ registrySlug }) => ({
    exists: true,
    rpcUrl: 'https://rpc.example',
    registrySlug,
    errors: [],
    error: null,
  }),
  readResourceGateOnChain: async ({ resourceKey, registrySlug }) => ({
    ok: true,
    gate: {
      sbtAddresses: [],
      chainId: 84532,
      mode: 0,
    },
    resourceKey,
    registrySlug,
    errors: [],
  }),
  warn: () => {},
  ...overrides,
});

const constants = {
  anonymousGateUnavailableError: 'Access denied: on-chain gate data unavailable.',
  anonymousRouteDeniedError: 'Anonymous access denied: AI/transcribe require open default+ai gates or a request apiKey.',
  anonymousScopeDisabledError: 'Anonymous access denied: route scope disabled in session config.',
};

test('evaluateAnonymousRouteAccess preserves request-apiKey bypass and skips gate authority reads', async () => {
  let sessionReads = 0;

  const result = await evaluateAnonymousRouteAccess({
    slug: '',
    config: {
      registryAddress: REGISTRY_ADDRESS,
      rpcUrl: 'https://rpc.example',
    },
    route: 'ai',
    apiKey: ' sk-local-123 ',
    deps: createDeps({
      readSessionExistsOnChain: async () => {
        sessionReads += 1;
        return { exists: true, errors: [], error: null };
      },
    }),
    constants,
  });

  assert.deepEqual(result, {
    ok: true,
    reason: 'request-api-key',
  });
  assert.equal(sessionReads, 0);
});

test('evaluateAnonymousRouteAccess preserves invalid-route and scope-disabled failures', async () => {
  assert.deepEqual(
    await evaluateAnonymousRouteAccess({
      slug: '',
      config: {},
      route: 'fetch',
      apiKey: '',
      deps: createDeps(),
      constants,
    }),
    {
      ok: false,
      status: 403,
      error: 'Anonymous access denied for route.',
    }
  );

  assert.deepEqual(
    await evaluateAnonymousRouteAccess({
      slug: '',
      config: {
        scopes: { ai: false },
      },
      route: 'ai',
      apiKey: 'sk-local-123',
      deps: createDeps(),
      constants,
    }),
    {
      ok: false,
      status: 403,
      error: 'Anonymous access denied: route scope disabled in session config.',
      reason: 'scope-disabled',
      scope: 'ai',
    }
  );
});

test('evaluateAnonymousRouteAccess canonicalizes registry slugs and allows open default+ai gates', async () => {
  const registryReads = [];

  const result = await evaluateAnonymousRouteAccess({
    slug: 'debate',
    config: {
      registryAddress: REGISTRY_ADDRESS,
      rpcUrl: 'https://rpc.example',
    },
    route: 'transcribe',
    apiKey: '',
    deps: createDeps({
      readSessionExistsOnChain: async ({ registrySlug }) => {
        registryReads.push(['sessionExists', registrySlug]);
        return { exists: true, rpcUrl: 'https://rpc.example', errors: [], error: null };
      },
      readResourceGateOnChain: async ({ resourceKey, registrySlug }) => {
        registryReads.push([resourceKey, registrySlug]);
        return {
          ok: true,
          gate: { sbtAddresses: [], chainId: 84532, mode: 0 },
          errors: [],
        };
      },
    }),
    constants,
  });

  assert.deepEqual(result, {
    ok: true,
    reason: 'open-default-ai-gates',
    defaultOpen: true,
    aiOpen: true,
  });
  assert.deepEqual(registryReads, [
    ['sessionExists', 'rxc'],
    ['default', 'rxc'],
    ['ai', 'rxc'],
  ]);
});

test('evaluateAnonymousRouteAccess fails closed when registry or session authority is unavailable', async () => {
  const warnings = [];

  assert.deepEqual(
    await evaluateAnonymousRouteAccess({
      slug: '',
      config: {
        registryAddress: '',
      },
      route: 'ai',
      apiKey: '',
      deps: createDeps({
        resolveRegistryRpcUrls: () => [],
        warn: (...args) => warnings.push(args),
      }),
      constants,
    }),
    {
      ok: false,
      status: 403,
      error: 'Access denied: on-chain gate data unavailable.',
    }
  );

  assert.deepEqual(warnings[0], [
    '[gating] anonymous access denied: registry authority unavailable',
    {
      slug: 'general',
      route: 'ai',
      registryAddress: '',
      registryRpcUrls: [],
    },
  ]);

  warnings.length = 0;

  assert.deepEqual(
    await evaluateAnonymousRouteAccess({
      slug: '',
      config: {
        registryAddress: REGISTRY_ADDRESS,
        rpcUrl: 'https://rpc.example',
      },
      route: 'transcribe',
      apiKey: '',
      deps: createDeps({
        warn: (...args) => warnings.push(args),
        readSessionExistsOnChain: async () => ({
          exists: false,
          rpcUrl: 'https://rpc.example',
          errors: [{ rpcUrl: MASKED_RPC, error: 'boom' }],
          error: new Error('session missing'),
        }),
      }),
      constants,
    }),
    {
      ok: false,
      status: 403,
      error: 'Access denied: on-chain gate data unavailable.',
    }
  );

  assert.deepEqual(warnings[0], [
    '[gating] anonymous access denied: on-chain authority unavailable',
    {
      slug: 'general',
      route: 'transcribe',
      reason: 'session-not-registered',
      registryAddress: REGISTRY_ADDRESS,
      rpcUrl: MASKED_RPC,
      rpcErrors: [{ rpcUrl: MASKED_RPC, error: 'boom' }],
      rpcError: 'session missing',
    },
  ]);
});

test('evaluateAnonymousRouteAccess preserves default/ai gate lookup failures and restricted-gate denial', async () => {
  const warnings = [];

  assert.deepEqual(
    await evaluateAnonymousRouteAccess({
      slug: '',
      config: {
        registryAddress: REGISTRY_ADDRESS,
        rpcUrl: 'https://rpc.example',
      },
      route: 'ai',
      apiKey: '',
      deps: createDeps({
        warn: (...args) => warnings.push(args),
        readResourceGateOnChain: async ({ resourceKey }) => (
          resourceKey === 'default'
            ? { ok: false, error: 'default failed', errors: [{ rpcUrl: MASKED_RPC, error: 'down' }] }
            : { ok: true, gate: { sbtAddresses: [], chainId: 84532, mode: 0 }, errors: [] }
        ),
      }),
      constants,
    }),
    {
      ok: false,
      status: 403,
      error: 'Access denied: on-chain gate data unavailable.',
    }
  );

  assert.deepEqual(warnings[0], [
    '[gating] anonymous access denied: default gate lookup failed',
    {
      slug: 'general',
      route: 'ai',
      registryAddress: REGISTRY_ADDRESS,
      rpcErrors: [{ rpcUrl: MASKED_RPC, error: 'down' }],
      error: 'default failed',
    },
  ]);

  assert.deepEqual(
    await evaluateAnonymousRouteAccess({
      slug: '',
      config: {
        registryAddress: REGISTRY_ADDRESS,
        rpcUrl: 'https://rpc.example',
      },
      route: 'transcribe',
      apiKey: '',
      deps: createDeps({
        readResourceGateOnChain: async ({ resourceKey }) => ({
          ok: true,
          gate: {
            sbtAddresses: resourceKey === 'ai' ? ['0x1'] : [],
            chainId: 84532,
            mode: 0,
          },
          errors: [],
        }),
      }),
      constants,
    }),
    {
      ok: false,
      status: 403,
      error: 'Anonymous access denied: AI/transcribe require open default+ai gates or a request apiKey.',
      reason: 'gates-restricted',
      defaultOpen: true,
      aiOpen: false,
    }
  );
});

test('evaluateAnonymousRouteAccess uses worker-canonical anonymous policy without registry reads', async () => {
  let registryReads = 0;
  const config = {
    sessionModeProfile: { authority: { mode: 'worker_canonical' } },
    workerAuthority: {
      version: 1,
      participantScopes: ['ai', 'transcribe'],
      anonymousScopes: ['ai'],
    },
  };

  const allowed = await evaluateAnonymousRouteAccess({
    slug: 'session-worker',
    config,
    route: 'ai',
    apiKey: '',
    deps: createDeps({
      readSessionExistsOnChain: async () => {
        registryReads += 1;
        return { exists: false };
      },
    }),
    constants,
  });
  const denied = await evaluateAnonymousRouteAccess({
    slug: 'session-worker',
    config,
    route: 'transcribe',
    apiKey: '',
    deps: createDeps(),
    constants,
  });
  const deniedWithRequestKey = await evaluateAnonymousRouteAccess({
    slug: 'session-worker',
    config,
    route: 'transcribe',
    apiKey: 'caller-supplied-key',
    deps: createDeps(),
    constants,
  });

  assert.equal(registryReads, 0);
  assert.deepEqual(allowed, { ok: true, reason: 'worker-canonical-open', scope: 'ai' });
  assert.deepEqual(denied, {
    ok: false,
    status: 403,
    error: constants.anonymousRouteDeniedError,
    reason: 'worker-canonical-anonymous-scope-denied',
    scope: 'transcribe',
  });
  assert.deepEqual(deniedWithRequestKey, denied);
});
