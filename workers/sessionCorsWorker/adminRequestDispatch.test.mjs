import test from 'node:test';
import assert from 'node:assert/strict';

import { dispatchAdminRequest } from './adminRequestDispatch.js';

const createJsonStub = () => (body, status, headers) => ({ body, status, headers });

const createSignedBody = (overrides = {}) => ({
  address: '0xabc',
  message: 'signed-message',
  signature: '0xsig',
  ...overrides,
});

const createAdminDeps = (overrides = {}) => ({
  json: createJsonStub(),
  resolveAdminRequestAuthority: async () => ({
    ok: true,
    address: '0xabc',
    existingConfig: { adminAddress: '0xabc' },
    headers: { 'Access-Control-Allow-Origin': 'https://allowed.example.test' },
    targetSlug: 'session-a',
  }),
  mergeWorkerConfigRecords: ({ existingConfig, incomingConfig, slug }) => ({
    existingConfig,
    incomingConfig,
    slug,
    merged: true,
  }),
  mergeWorkerLimitRecords: ({ existingConfig, incomingLimits, slug }) => ({
    existingConfig,
    incomingLimits,
    slug,
    merged: true,
  }),
  putSessionConfig: async () => {},
  getSessionSecrets: async () => ({ openaiKey: 'sk-existing' }),
  normalizeSecretValue: (value) => value,
  putSessionSecrets: async () => {},
  MISSING_SLUG_ERROR: 'Missing sessionSlug.',
  ...overrides,
});

test('dispatchAdminRequest preserves invalid-json failure before signed request handling', async () => {
  let authorityCalled = false;

  const result = await dispatchAdminRequest({
    request: {
      json: async () => {
        throw new Error('bad json');
      },
    },
    env: { GROUP_KV: {} },
    baseHeaders: { 'Access-Control-Allow-Origin': '*' },
    slug: '',
    action: 'set-config',
    deps: createAdminDeps({
      resolveAdminRequestAuthority: async () => {
        authorityCalled = true;
        return { ok: true };
      },
    }),
  });

  assert.equal(authorityCalled, false);
  assert.deepEqual(result, {
    body: { error: 'Invalid JSON.' },
    status: 400,
    headers: { 'Access-Control-Allow-Origin': '*' },
  });
});

test('dispatchAdminRequest merges config and persists the result after authority resolution', async () => {
  const calls = [];
  const request = {
    json: async () => createSignedBody({
      config: { sessionName: 'Updated Session' },
    }),
  };
  const env = { GROUP_KV: {} };
  const baseHeaders = { 'Access-Control-Allow-Origin': '*' };

  const result = await dispatchAdminRequest({
    request,
    env,
    baseHeaders,
    slug: 'env-slug',
    action: 'set-config',
    deps: createAdminDeps({
      resolveAdminRequestAuthority: async (value) => {
        assert.equal(value.request, request);
        assert.equal(value.env, env);
        assert.equal(value.body.config.sessionName, 'Updated Session');
        assert.equal(value.slugHint, 'env-slug');
        assert.equal(value.action, 'set-config');
        assert.equal(value.baseHeaders, baseHeaders);
        return {
          ok: true,
          existingConfig: null,
          headers: { 'Access-Control-Allow-Origin': 'https://allowed.example.test' },
          targetSlug: 'session-a',
        };
      },
      mergeWorkerConfigRecords: ({ existingConfig, incomingConfig, slug }) => {
        calls.push(['mergeWorkerConfigRecords', existingConfig, incomingConfig, slug]);
        return { merged: true, slug };
      },
      putSessionConfig: async (envArg, slugArg, configArg) => {
        calls.push(['putSessionConfig', envArg, slugArg, configArg]);
      },
    }),
  });

  assert.deepEqual(calls, [
    ['mergeWorkerConfigRecords', null, { sessionName: 'Updated Session' }, 'session-a'],
    ['putSessionConfig', env, 'session-a', { merged: true, slug: 'session-a' }],
  ]);
  assert.deepEqual(result, {
    body: { ok: true },
    status: 200,
    headers: { 'Access-Control-Allow-Origin': 'https://allowed.example.test' },
  });
});

test('dispatchAdminRequest seeds bootstrap adminAddress from the top-level body when the first config patch omits it', async () => {
  const calls = [];

  const result = await dispatchAdminRequest({
    request: {
      json: async () => createSignedBody({
        adminAddress: '0xabc',
        config: {
          allowOrigins: ['https://allowed.example.test'],
        },
      }),
    },
    env: { GROUP_KV: {} },
    baseHeaders: { 'Access-Control-Allow-Origin': '*' },
    slug: '',
    action: 'set-config',
    deps: createAdminDeps({
      resolveAdminRequestAuthority: async () => ({
        ok: true,
        existingConfig: null,
        headers: { 'Access-Control-Allow-Origin': 'https://allowed.example.test' },
        targetSlug: 'session-a',
      }),
      isAddress: (value) => value === '0xabc',
      mergeWorkerConfigRecords: ({ existingConfig, incomingConfig, slug }) => {
        calls.push(['mergeWorkerConfigRecords', existingConfig, incomingConfig, slug]);
        return { merged: true, slug, incomingConfig };
      },
      putSessionConfig: async (envArg, slugArg, configArg) => {
        calls.push(['putSessionConfig', envArg, slugArg, configArg]);
      },
    }),
  });

  assert.deepEqual(calls, [
    ['mergeWorkerConfigRecords', null, {
      allowOrigins: ['https://allowed.example.test'],
      adminAddress: '0xabc',
    }, 'session-a'],
    ['putSessionConfig', { GROUP_KV: {} }, 'session-a', {
      merged: true,
      slug: 'session-a',
      incomingConfig: {
        allowOrigins: ['https://allowed.example.test'],
        adminAddress: '0xabc',
      },
    }],
  ]);
  assert.deepEqual(result, {
    body: { ok: true },
    status: 200,
    headers: { 'Access-Control-Allow-Origin': 'https://allowed.example.test' },
  });
});

test('dispatchAdminRequest rejects Cloudflare deployment tokens in session config before persistence', async () => {
  let writes = 0;
  const result = await dispatchAdminRequest({
    request: {
      json: async () => createSignedBody({
        config: {
          sessionModeProfile: { authority: { mode: 'worker_canonical' } },
          nested: { cloudflareApiToken: 'cf-never-store' },
        },
      }),
    },
    env: { GROUP_KV: {} },
    baseHeaders: {},
    slug: 'session-a',
    action: 'set-config',
    deps: createAdminDeps({
      putSessionConfig: async () => { writes += 1; },
    }),
  });

  assert.equal(writes, 0);
  assert.deepEqual(result, {
    body: { error: 'Cloudflare deployment tokens are not allowed in session config.' },
    status: 400,
    headers: { 'Access-Control-Allow-Origin': 'https://allowed.example.test' },
  });
});

test('dispatchAdminRequest rejects secret-like values in open config subtrees before persistence', async () => {
  let writes = 0;
  const result = await dispatchAdminRequest({
    request: {
      json: async () => createSignedBody({
        config: {
          ai: {
            models: { fast: { provider: 'openai', model: 'gpt-5' } },
            headers: { Authorization: 'Bearer secret' },
          },
        },
      }),
    },
    env: { GROUP_KV: {} },
    baseHeaders: {},
    slug: 'session-a',
    action: 'set-config',
    deps: createAdminDeps({
      putSessionConfig: async () => { writes += 1; },
    }),
  });

  assert.equal(writes, 0);
  assert.deepEqual(result, {
    body: { error: 'Secret-like values are not allowed in public session config fields.' },
    status: 400,
    headers: { 'Access-Control-Allow-Origin': 'https://allowed.example.test' },
  });
});

test('dispatchAdminRequest filters and normalizes allowed secrets before persisting', async () => {
  const calls = [];

  const result = await dispatchAdminRequest({
    request: {
      json: async () => createSignedBody({
        secrets: {
          openaiKey: '  sk-new  ',
          arweaveJwk: { kty: 'RSA' },
          litAccountApiKey: '  account-secret  ',
          litUsageApiKey: '  lit-secret  ',
          ignoredSecret: 'skip-me',
        },
      }),
    },
    env: { GROUP_KV: {} },
    baseHeaders: { 'Access-Control-Allow-Origin': '*' },
    slug: '',
    action: 'set-secrets',
    deps: createAdminDeps({
      resolveAdminRequestAuthority: async () => ({
        ok: true,
        existingConfig: { adminAddress: '0xabc' },
        headers: { 'Access-Control-Allow-Origin': 'https://allowed.example.test' },
        targetSlug: 'session-a',
      }),
      getSessionSecrets: async () => ({ openaiKey: 'sk-existing', customRpcUrl: 'https://rpc.example.test' }),
      normalizeSecretValue: (value) => {
        calls.push(['normalizeSecretValue', value]);
        if (typeof value === 'string') return value.trim();
        return JSON.stringify(value);
      },
      putSessionSecrets: async (env, targetSlug, secrets) => {
        calls.push(['putSessionSecrets', env, targetSlug, secrets]);
      },
    }),
  });

  assert.deepEqual(calls, [
    ['normalizeSecretValue', '  sk-new  '],
    ['normalizeSecretValue', { kty: 'RSA' }],
    ['normalizeSecretValue', '  account-secret  '],
    ['normalizeSecretValue', '  lit-secret  '],
    ['putSessionSecrets', { GROUP_KV: {} }, 'session-a', {
      openaiKey: 'sk-new',
      customRpcUrl: 'https://rpc.example.test',
      arweaveJwk: '{"kty":"RSA"}',
      litAccountApiKey: 'account-secret',
      litUsageApiKey: 'lit-secret',
    }],
  ]);
  assert.deepEqual(result, {
    body: { ok: true },
    status: 200,
    headers: { 'Access-Control-Allow-Origin': 'https://allowed.example.test' },
  });
});

test('dispatchAdminRequest returns allowed-key secret presence without exposing values', async () => {
  let putCalled = false;

  const result = await dispatchAdminRequest({
    request: {
      json: async () => createSignedBody({}),
    },
    env: { GROUP_KV: {} },
    baseHeaders: { 'Access-Control-Allow-Origin': '*' },
    slug: '',
    action: 'secret-presence',
    deps: createAdminDeps({
      resolveAdminRequestAuthority: async () => ({
        ok: true,
        existingConfig: { adminAddress: '0xabc' },
        headers: { 'Access-Control-Allow-Origin': 'https://allowed.example.test' },
        targetSlug: 'session-a',
      }),
      getSessionSecrets: async () => ({
        openaiKey: 'sk-existing',
        anthropicKey: '   ',
        customRpcUrl: 'https://rpc.example.test',
        arweaveJwk: { kty: 'RSA' },
        ignoredSecret: 'do-not-report',
      }),
      putSessionSecrets: async () => {
        putCalled = true;
      },
    }),
  });

  assert.equal(putCalled, false);
  assert.deepEqual(result, {
    body: {
      ok: true,
      sessionSlug: 'session-a',
      secrets: {
        openaiKey: true,
        anthropicKey: false,
        openrouterKey: false,
        customRpcUrl: true,
        customRpcKey: false,
        arweaveJwk: true,
        faucetPrivateKey: false,
        litAccountApiKey: false,
        litUsageApiKey: false,
      },
    },
    status: 200,
    headers: { 'Access-Control-Allow-Origin': 'https://allowed.example.test' },
  });
  assert.doesNotMatch(JSON.stringify(result.body), /sk-existing|rpc\.example|do-not-report|RSA/);
});

test('dispatchAdminRequest routes signed worker group CRUD through admin auth', async () => {
  let authorityCalled = false;
  const result = await dispatchAdminRequest({
    request: {
      json: async () => createSignedBody({
        group: {
          groupId: 'reviewers',
          label: 'Reviewers',
          joinMode: 'admin_add',
          memberVisibility: 'members',
        },
      }),
    },
    env: { CE_WORKER_GROUPS_KV: {
      store: new Map(),
      async put(key, value) { this.store.set(key, value); },
      async get(key) { return this.store.get(key) || null; },
      async list({ prefix = '' } = {}) {
        return { keys: [...this.store.keys()].filter((name) => name.startsWith(prefix)).map((name) => ({ name })) };
      },
    } },
    baseHeaders: { 'Access-Control-Allow-Origin': '*' },
    slug: '',
    action: 'groups/create',
    deps: createAdminDeps({
      resolveAdminRequestAuthority: async () => {
        authorityCalled = true;
        return {
          ok: true,
          address: '0x0000000000000000000000000000000000000abc',
          existingConfig: { adminAddress: '0x0000000000000000000000000000000000000abc' },
          headers: { 'Access-Control-Allow-Origin': 'https://allowed.example.test' },
          targetSlug: 'session-a',
        };
      },
      now: () => Date.parse('2026-02-03T04:05:06.000Z'),
    }),
  });

  assert.equal(authorityCalled, true);
  assert.equal(result.status, 200);
  assert.equal(result.body.ok, true);
  assert.equal(result.body.group.groupId, 'reviewers');
  assert.equal(result.body.group.createdBy.kind, 'evm_address');
});

test('dispatchAdminRequest does not touch groups when admin auth fails', async () => {
  const response = { body: { error: 'Admin denied.' }, status: 403, headers: {} };
  let groupDispatchCalled = false;
  const result = await dispatchAdminRequest({
    request: {
      json: async () => createSignedBody({
        group: { groupId: 'blocked', label: 'Blocked', joinMode: 'admin_add' },
      }),
    },
    env: {},
    baseHeaders: { 'Access-Control-Allow-Origin': '*' },
    slug: '',
    action: 'groups/create',
    deps: createAdminDeps({
      resolveAdminRequestAuthority: async () => ({ ok: false, response }),
      dispatchAdminWorkerGroupRequest: async () => {
        groupDispatchCalled = true;
        return null;
      },
    }),
  });

  assert.equal(result, response);
  assert.equal(groupDispatchCalled, false);
});

test('dispatchAdminRequest reads Lit Chipotle status from worker config plus session secrets', async () => {
  const result = await dispatchAdminRequest({
    request: {
      json: async () => createSignedBody({}),
    },
    env: { GROUP_KV: {}, LIT_ACCOUNT_API_KEY: 'env-key' },
    baseHeaders: { 'Access-Control-Allow-Origin': '*' },
    slug: '',
    action: 'lit-chipotle-status',
    deps: createAdminDeps({
      resolveAdminRequestAuthority: async () => ({
        ok: true,
        existingConfig: {
          adminAddress: '0xabc',
          litCredentials: {
            litApiBase: 'https://api.chipotle.litprotocol.com',
            litGroupId: 'group_123',
            litPkpId: 'pkp_123',
            litActionCid: 'bafy123',
          },
        },
        headers: { 'Access-Control-Allow-Origin': 'https://allowed.example.test' },
        targetSlug: 'session-a',
      }),
      getSessionSecrets: async () => ({ litUsageApiKey: 'lit-secret' }),
      resolveLitChipotleRuntime: ({ env, config, secrets }) => {
        assert.equal(env.LIT_ACCOUNT_API_KEY, 'env-key');
        assert.equal(config.litCredentials.litGroupId, 'group_123');
        assert.equal(secrets.litUsageApiKey, 'lit-secret');
        return {
          litApiBase: 'https://api.chipotle.litprotocol.com',
          litUsageApiKey: 'lit-secret',
          apiKeySource: 'session-secret',
          litGroupId: 'group_123',
          litPkpId: 'pkp_123',
          litActionCid: 'bafy123',
        };
      },
      readLitChipotleStatus: async ({ runtime }) => {
        assert.equal(runtime.litActionCid, 'bafy123');
        return { ok: true, ready: true, apiKeySource: 'session-secret' };
      },
    }),
  });

  assert.deepEqual(result, {
    body: { ok: true, ready: true, apiKeySource: 'session-secret' },
    status: 200,
    headers: { 'Access-Control-Allow-Origin': 'https://allowed.example.test' },
  });
});

test('dispatchAdminRequest rejects unsafe Lit Chipotle status API bases before status fetch', async () => {
  let readCalled = false;
  let fetchCalled = false;

  const result = await dispatchAdminRequest({
    request: {
      json: async () => createSignedBody({
        litApiBase: 'https://attacker.example',
      }),
    },
    env: { GROUP_KV: {}, LIT_ACCOUNT_API_KEY: 'env-key' },
    baseHeaders: { 'Access-Control-Allow-Origin': '*' },
    slug: '',
    action: 'lit-chipotle-status',
    deps: createAdminDeps({
      resolveAdminRequestAuthority: async () => ({
        ok: true,
        existingConfig: {
          adminAddress: '0xabc',
          litCredentials: {
            litApiBase: 'https://api.chipotle.litprotocol.com',
            litGroupId: 'group_123',
            litPkpId: 'pkp_123',
            litActionCid: 'bafy123',
          },
        },
        headers: { 'Access-Control-Allow-Origin': 'https://allowed.example.test' },
        targetSlug: 'session-a',
      }),
      getSessionSecrets: async () => ({ litUsageApiKey: 'lit-secret' }),
      readLitChipotleStatus: async () => {
        readCalled = true;
        return { ok: true };
      },
      fetchImpl: async () => {
        fetchCalled = true;
        return { ok: true, text: async () => '{}' };
      },
    }),
  });

  assert.equal(readCalled, false);
  assert.equal(fetchCalled, false);
  assert.deepEqual(result, {
    body: { error: 'Lit Chipotle API base URL host is not approved.' },
    status: 502,
    headers: { 'Access-Control-Allow-Origin': 'https://allowed.example.test' },
  });
});

test('dispatchAdminRequest issues one-time sponsored deploy and faucet grants', async () => {
  const kvCalls = [];
  const env = {
    DEPLOY_HELPER_ENABLED: '1',
    GROUP_KV: {
      put: async (key, value, opts) => {
        kvCalls.push([key, JSON.parse(value), opts]);
      },
    },
  };

  const result = await dispatchAdminRequest({
    request: {
      json: async () => createSignedBody({
        grantRequest: {
          bootstrapWorkerUrl: 'https://source-worker.example.test',
          expiresAt: '2099-03-21T12:00:00.000Z',
          deploy: {
            cloudflareApiToken: 'cf-sponsored-token',
          },
          faucet: {
            faucetPrivateKey: ' 0xfaucet ',
          },
        },
      }),
    },
    env,
    baseHeaders: { 'Access-Control-Allow-Origin': '*' },
    slug: '',
    action: 'issue-sponsored-grants',
    deps: createAdminDeps({
      resolveAdminRequestAuthority: async () => ({
        ok: true,
        existingConfig: {
          corsWorkerUrl: 'https://source-worker.example.test',
          allowOrigins: ['https://allowed.example.test'],
          faucet: { amountEth: '0.0002' },
        },
        headers: { 'Access-Control-Allow-Origin': 'https://allowed.example.test' },
        targetSlug: 'session-a',
      }),
      now: () => Date.parse('2099-03-20T12:00:00.000Z'),
      normalizeSecretValue: (value) => String(value || '').trim(),
    }),
  });

  assert.equal(result.status, 200);
  assert.equal(result.headers['Access-Control-Allow-Origin'], 'https://allowed.example.test');
  assert.equal(result.body.ok, true);
  assert.equal(typeof result.body.deployGrantToken, 'string');
  assert.equal(typeof result.body.faucetGrantToken, 'string');
  assert.equal(result.body.bootstrapWorkerUrl, 'https://source-worker.example.test');
  assert.equal(kvCalls.length, 2);
  assert.deepEqual(kvCalls[0][2], { expirationTtl: 86400 });
  assert.deepEqual(kvCalls[1][2], { expirationTtl: 86400 });
  assert.deepEqual(kvCalls[0][1], {
    type: 'deploy-worker',
    sourceSessionSlug: 'session-a',
    sourceConfig: {
      corsWorkerUrl: 'https://source-worker.example.test',
      allowOrigins: ['https://allowed.example.test'],
      faucet: { amountEth: '0.0002' },
    },
    cloudflareApiToken: 'cf-sponsored-token',
    issuedAt: '2099-03-20T12:00:00.000Z',
    expiresAt: '2099-03-21T12:00:00.000Z',
  });
  assert.deepEqual(kvCalls[1][1], {
    type: 'faucet-tx',
    sourceSessionSlug: 'session-a',
    sourceConfig: {
      corsWorkerUrl: 'https://source-worker.example.test',
      allowOrigins: ['https://allowed.example.test'],
      faucet: { amountEth: '0.0002' },
    },
    faucetPrivateKey: '0xfaucet',
    issuedAt: '2099-03-20T12:00:00.000Z',
    expiresAt: '2099-03-21T12:00:00.000Z',
  });
});

test('dispatchAdminRequest returns a CORS-safe error when sponsored grant persistence throws', async () => {
  const result = await dispatchAdminRequest({
    request: {
      json: async () => createSignedBody({
        grantRequest: {
          bootstrapWorkerUrl: 'https://source-worker.example.test',
          deploy: {
            cloudflareApiToken: 'cf-sponsored-token',
          },
        },
      }),
    },
    env: {
      DEPLOY_HELPER_ENABLED: '1',
      GROUP_KV: {
        put: async () => {
          throw new Error('KV write exploded');
        },
      },
    },
    baseHeaders: { 'Access-Control-Allow-Origin': '*' },
    slug: '',
    action: 'issue-sponsored-grants',
    deps: createAdminDeps({
      resolveAdminRequestAuthority: async () => ({
        ok: true,
        existingConfig: {
          corsWorkerUrl: 'https://source-worker.example.test',
          allowOrigins: ['https://allowed.example.test'],
        },
        headers: { 'Access-Control-Allow-Origin': 'https://allowed.example.test' },
        targetSlug: 'session-a',
      }),
    }),
  });

  assert.deepEqual(result, {
    body: { error: 'KV write exploded' },
    status: 500,
    headers: { 'Access-Control-Allow-Origin': 'https://allowed.example.test' },
  });
});

test('dispatchAdminRequest allows sponsored deploy grants without a standalone helper when embedded deploy-helper is enabled at deploy time', async () => {
  const kvCalls = [];
  const env = {
    DEPLOY_HELPER_ENABLED: '1',
    GROUP_KV: {
      put: async (key, value, opts) => {
        kvCalls.push([key, JSON.parse(value), opts]);
      },
    },
  };

  const result = await dispatchAdminRequest({
    request: {
      json: async () => createSignedBody({
        grantRequest: {
          bootstrapWorkerUrl: 'https://source-worker.example.test',
          deploy: {
            cloudflareApiToken: 'cf-sponsored-token',
          },
        },
      }),
    },
    env,
    baseHeaders: { 'Access-Control-Allow-Origin': '*' },
    slug: '',
    action: 'issue-sponsored-grants',
    deps: createAdminDeps({
      resolveAdminRequestAuthority: async () => ({
        ok: true,
        existingConfig: {
          corsWorkerUrl: 'https://source-worker.example.test',
          allowOrigins: ['https://allowed.example.test'],
        },
        headers: { 'Access-Control-Allow-Origin': 'https://allowed.example.test' },
        targetSlug: 'session-a',
      }),
      now: () => Date.parse('2099-03-20T12:00:00.000Z'),
    }),
  });

  assert.equal(result.status, 200);
  assert.equal(result.body.ok, true);
  assert.equal(typeof result.body.deployGrantToken, 'string');
  assert.equal(kvCalls.length, 1);
  assert.equal(kvCalls[0][1].cloudflareApiToken, 'cf-sponsored-token');
});

test('dispatchAdminRequest rejects sponsored deploy grants when embedded deploy-helper was disabled at deploy time', async () => {
  const result = await dispatchAdminRequest({
    request: {
      json: async () => createSignedBody({
        grantRequest: {
          bootstrapWorkerUrl: 'https://source-worker.example.test',
          deploy: {
            cloudflareApiToken: 'cf-sponsored-token',
          },
        },
      }),
    },
    env: {
      DEPLOY_HELPER_ENABLED: '0',
      GROUP_KV: {},
    },
    baseHeaders: { 'Access-Control-Allow-Origin': '*' },
    slug: '',
    action: 'issue-sponsored-grants',
    deps: createAdminDeps(),
  });

  assert.deepEqual(result, {
    body: { error: 'Deploy grants require embedded deploy-helper to be enabled on the sponsoring worker.' },
    status: 400,
    headers: { 'Access-Control-Allow-Origin': 'https://allowed.example.test' },
  });
});

test('dispatchAdminRequest ignores unexpected helper/account fields and still stores only the new deploy grant shape', async () => {
  const kvCalls = [];

  const result = await dispatchAdminRequest({
    request: {
      json: async () => createSignedBody({
        grantRequest: {
          deployHelperUrl: 'https://ignored-helper.example.test',
          bootstrapWorkerUrl: 'https://source-worker.example.test',
          deploy: {
            cloudflareApiToken: 'cf-sponsored-token',
            cloudflareAccountId: 'ignored-account-id',
          },
        },
      }),
    },
    env: {
      DEPLOY_HELPER_ENABLED: '1',
      GROUP_KV: {
        put: async (key, value, opts) => {
          kvCalls.push([key, JSON.parse(value), opts]);
        },
      },
    },
    baseHeaders: { 'Access-Control-Allow-Origin': '*' },
    slug: '',
    action: 'issue-sponsored-grants',
    deps: createAdminDeps(),
  });

  assert.equal(result.status, 200);
  assert.equal(result.body.ok, true);
  assert.equal(typeof result.body.deployGrantToken, 'string');
  assert.equal(kvCalls.length, 1);
  assert.equal(kvCalls[0][1].cloudflareApiToken, 'cf-sponsored-token');
  assert.equal(Object.prototype.hasOwnProperty.call(kvCalls[0][1], 'deployHelperUrl'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(kvCalls[0][1], 'cloudflareAccountId'), false);
});

test('dispatchAdminRequest merges limits and persists the result for set-limits', async () => {
  const calls = [];

  const result = await dispatchAdminRequest({
    request: {
      json: async () => createSignedBody({
        limits: {
          perWalletPerDay: 5,
          perIpPerHour: 8,
        },
      }),
    },
    env: { GROUP_KV: {} },
    baseHeaders: { 'Access-Control-Allow-Origin': '*' },
    slug: '',
    action: 'set-limits',
    deps: createAdminDeps({
      resolveAdminRequestAuthority: async () => ({
        ok: true,
        existingConfig: { adminAddress: '0xabc', limits: { perWalletPerDay: 3 } },
        headers: { 'Access-Control-Allow-Origin': 'https://allowed.example.test' },
        targetSlug: 'session-a',
      }),
      mergeWorkerLimitRecords: ({ existingConfig, incomingLimits, slug }) => {
        calls.push(['mergeWorkerLimitRecords', existingConfig, incomingLimits, slug]);
        return { merged: true, slug, incomingLimits };
      },
      putSessionConfig: async (env, targetSlug, config) => {
        calls.push(['putSessionConfig', env, targetSlug, config]);
      },
    }),
  });

  assert.deepEqual(calls, [
    ['mergeWorkerLimitRecords', { adminAddress: '0xabc', limits: { perWalletPerDay: 3 } }, {
      perWalletPerDay: 5,
      perIpPerHour: 8,
    }, 'session-a'],
    ['putSessionConfig', { GROUP_KV: {} }, 'session-a', {
      merged: true,
      slug: 'session-a',
      incomingLimits: { perWalletPerDay: 5, perIpPerHour: 8 },
    }],
  ]);
  assert.deepEqual(result, {
    body: { ok: true },
    status: 200,
    headers: { 'Access-Control-Allow-Origin': 'https://allowed.example.test' },
  });
});

test('dispatchAdminRequest exports encrypted storage envelopes through the admin gate', async () => {
  const calls = [];
  const result = await dispatchAdminRequest({
    request: {
      json: async () => createSignedBody({ resource: 'responses' }),
    },
    env: { CE_STORAGE_INDEX_KV: {} },
    baseHeaders: { 'Access-Control-Allow-Origin': '*' },
    slug: 'session-a',
    action: 'export-storage-envelopes',
    deps: createAdminDeps({
      resolveAdminRequestAuthority: async () => ({
        ok: true,
        existingConfig: { storageProfile: { backend: 'cloudflare' } },
        headers: { 'Access-Control-Allow-Origin': 'https://allowed.example.test' },
        targetSlug: 'session-a',
      }),
      exportCloudflareEncryptedPayloadEnvelopes: async (value) => {
        calls.push(value);
        return {
          ok: true,
          manifest: {
            exportScope: 'encrypted_envelopes_only',
            encryptedPayloadCount: 1,
          },
          payloads: [{ storageRef: { id: 'payload-1' } }],
        };
      },
    }),
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].slug, 'session-a');
  assert.equal(calls[0].resource, 'responses');
  assert.equal(calls[0].includeSessionEnvelope, true);
  assert.deepEqual(result, {
    body: {
      ok: true,
      manifest: {
        exportScope: 'encrypted_envelopes_only',
        encryptedPayloadCount: 1,
      },
      payloads: [{ storageRef: { id: 'payload-1' } }],
    },
    status: 200,
    headers: { 'Access-Control-Allow-Origin': 'https://allowed.example.test' },
  });
});

test('dispatchAdminRequest does not export envelopes when admin authority fails', async () => {
  let exportCalled = false;
  const response = { body: { error: 'Admin authorization failed.' }, status: 403, headers: {} };
  const result = await dispatchAdminRequest({
    request: {
      json: async () => createSignedBody({ resource: 'responses' }),
    },
    env: { CE_STORAGE_INDEX_KV: {} },
    baseHeaders: { 'Access-Control-Allow-Origin': '*' },
    slug: 'session-a',
    action: 'export-storage-envelopes',
    deps: createAdminDeps({
      resolveAdminRequestAuthority: async () => ({ ok: false, response }),
      exportCloudflareEncryptedPayloadEnvelopes: async () => {
        exportCalled = true;
        return { ok: true };
      },
    }),
  });

  assert.equal(result, response);
  assert.equal(exportCalled, false);
});

test('dispatchAdminRequest rewraps deployment KEK without returning secret material', async () => {
  const calls = [];
  const result = await dispatchAdminRequest({
    request: {
      json: async () => createSignedBody({
        newDeploymentKek: 'new deployment envelope kek',
      }),
    },
    env: { CE_STORAGE_INDEX_KV: {} },
    baseHeaders: { 'Access-Control-Allow-Origin': '*' },
    slug: 'session-a',
    action: 'rewrap-envelope-deployment-key',
    deps: createAdminDeps({
      resolveAdminRequestAuthority: async () => ({
        ok: true,
        existingConfig: { storageEnvelope: { keyProvider: 'worker_secret' } },
        headers: { 'Access-Control-Allow-Origin': 'https://allowed.example.test' },
        targetSlug: 'session-a',
      }),
      rewrapStorageEnvelopeSessionKeyForDeployment: async (value) => {
        calls.push(value);
        return {
          ok: true,
          rewrappedAt: '2026-01-04T03:04:05.000Z',
          keyProvider: 'worker_secret',
        };
      },
    }),
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].slug, 'session-a');
  assert.equal(calls[0].newDeploymentKek, 'new deployment envelope kek');
  assert.deepEqual(result, {
    body: {
      ok: true,
      rewrappedAt: '2026-01-04T03:04:05.000Z',
      keyProvider: 'worker_secret',
    },
    status: 200,
    headers: { 'Access-Control-Allow-Origin': 'https://allowed.example.test' },
  });
  assert.doesNotMatch(JSON.stringify(result), /new deployment envelope kek/);
});

test('dispatchAdminRequest returns explicit unknown-action failures after admin verification', async () => {
  let putCalled = false;

  const result = await dispatchAdminRequest({
    request: {
      json: async () => createSignedBody(),
    },
    env: { GROUP_KV: {} },
    baseHeaders: { 'Access-Control-Allow-Origin': '*' },
    slug: '',
    action: 'not-a-route',
    deps: createAdminDeps({
      resolveAdminRequestAuthority: async () => ({
        ok: true,
        existingConfig: { adminAddress: '0xabc' },
        headers: { 'Access-Control-Allow-Origin': 'https://allowed.example.test' },
        targetSlug: 'session-a',
      }),
      putSessionConfig: async () => {
        putCalled = true;
      },
      putSessionSecrets: async () => {
        putCalled = true;
      },
    }),
  });

  assert.equal(putCalled, false);
  assert.deepEqual(result, {
    body: { error: 'Unknown admin action.' },
    status: 400,
    headers: { 'Access-Control-Allow-Origin': 'https://allowed.example.test' },
  });
});


test('dispatchAdminRequest provisions Lit Chipotle actions through the worker adapter', async () => {
  let persistedConfig = null;
  const result = await dispatchAdminRequest({
    request: {
      json: async () => createSignedBody({
        actionCode: 'async function main() { return { ok: true }; }',
        actionName: 'ce-sbt-gated-crypto-v3',
      }),
    },
    env: { GROUP_KV: {}, LIT_ACCOUNT_API_KEY: 'account-key' },
    baseHeaders: { 'Access-Control-Allow-Origin': '*' },
    slug: '',
    action: 'lit-chipotle-provision',
    deps: createAdminDeps({
      resolveAdminRequestAuthority: async () => ({
        ok: true,
        existingConfig: {
          adminAddress: '0xabc',
          litCredentials: {
            litApiBase: 'https://api.chipotle.litprotocol.com',
            litGroupId: 'ce-session-content-prod',
            litPkpId: '0xpkp123',
          },
        },
        headers: { 'Access-Control-Allow-Origin': 'https://allowed.example.test' },
        targetSlug: 'session-a',
      }),
      getSessionSecrets: async () => ({
        litAccountApiKey: 'session-account-key',
      }),
      resolveLitChipotleProvisioningRuntime: ({ config, body, env }) => {
        assert.equal(config.litCredentials.litGroupId, 'ce-session-content-prod');
        assert.equal(body.actionName, 'ce-sbt-gated-crypto-v3');
        assert.equal(env.LIT_ACCOUNT_API_KEY, 'account-key');
        return {
          litApiBase: 'https://api.chipotle.litprotocol.com',
          litManagementApiKey: 'session-account-key',
          apiKeySource: 'session-secret',
          litGroupId: 'ce-session-content-prod',
          litPkpId: '0xpkp123',
        };
      },
      provisionLitChipotleAction: async ({ runtime, request }) => {
        assert.equal(runtime.litManagementApiKey, 'session-account-key');
        assert.equal(request.actionCode, 'async function main() { return { ok: true }; }');
        return {
          ok: true,
          apiBase: 'https://api.chipotle.litprotocol.com',
          litActionCid: 'QmAction123',
          litGroupId: '7',
          litPkpId: '0xpkp123',
        };
      },
      putSessionConfig: async (_env, _slug, value) => {
        persistedConfig = value;
      },
    }),
  });

  assert.deepEqual(persistedConfig?.incomingConfig?.litCredentials, {
    litApiBase: 'https://api.chipotle.litprotocol.com',
    litGroupId: '7',
    litPkpId: '0xpkp123',
    litActionCid: 'QmAction123',
  });
  assert.deepEqual(result, {
    body: {
      ok: true,
      apiBase: 'https://api.chipotle.litprotocol.com',
      litActionCid: 'QmAction123',
      litGroupId: '7',
      litPkpId: '0xpkp123',
    },
    status: 200,
    headers: { 'Access-Control-Allow-Origin': 'https://allowed.example.test' },
  });
});

test('dispatchAdminRequest bootstraps a per-session Lit account and writes both config and secrets', async () => {
  const calls = [];

  const result = await dispatchAdminRequest({
    request: {
      json: async () => createSignedBody({
        litApiBase: 'https://api.chipotle.litprotocol.com',
        sessionName: 'Session A',
        actionCode: 'async function main() { return { ok: true }; }',
        actionName: 'ce-sbt-gated-crypto-v3',
      }),
    },
    env: { GROUP_KV: {} },
    baseHeaders: { 'Access-Control-Allow-Origin': '*' },
    slug: '',
    action: 'lit-chipotle-bootstrap-session',
    deps: createAdminDeps({
      resolveAdminRequestAuthority: async () => ({
        ok: true,
        existingConfig: {
          adminAddress: '0xabc',
          litCredentials: {
            litApiBase: 'https://api.chipotle.litprotocol.com',
          },
        },
        headers: { 'Access-Control-Allow-Origin': 'https://allowed.example.test' },
        targetSlug: 'session-a',
      }),
      getSessionSecrets: async () => ({ openaiKey: 'sk-existing' }),
      bootstrapLitChipotleSession: async ({ config, secrets, request, sessionSlug }) => {
        assert.equal(config.litCredentials.litApiBase, 'https://api.chipotle.litprotocol.com');
        assert.equal(secrets.openaiKey, 'sk-existing');
        assert.equal(request.actionName, 'ce-sbt-gated-crypto-v3');
        assert.equal(sessionSlug, 'session-a');
        return {
          ok: true,
          bootstrapMode: 'session-account',
          apiBase: 'https://api.chipotle.litprotocol.com',
          litActionCid: 'QmAction123',
          litGroupId: '7',
          litPkpId: '0xpkp123',
          accountWalletAddress: '0xmasterwallet',
          billingBalance: {
            balance_cents: 0,
            balance_display: '$0.00',
          },
          litCredentials: {
            litApiBase: 'https://api.chipotle.litprotocol.com',
            litActionCid: 'QmAction123',
            litGroupId: '7',
            litPkpId: '0xpkp123',
          },
          secretOutputs: {
            litAccountApiKey: 'account-key',
            litUsageApiKey: 'usage-key',
          },
          steps: {
            createdAccount: true,
            createdGroup: true,
            createdWallet: true,
            derivedCid: true,
            registeredAction: true,
            addedActionToGroup: true,
            addedPkpToGroup: true,
            createdUsageKey: true,
          },
        };
      },
      normalizeSecretValue: (value) => {
        calls.push(['normalizeSecretValue', value]);
        return value;
      },
      putSessionSecrets: async (envArg, targetSlugArg, nextSecrets) => {
        calls.push(['putSessionSecrets', envArg, targetSlugArg, nextSecrets]);
      },
      mergeWorkerConfigRecords: ({ existingConfig, incomingConfig, slug }) => {
        calls.push(['mergeWorkerConfigRecords', existingConfig, incomingConfig, slug]);
        return { merged: true, incomingConfig, slug };
      },
      putSessionConfig: async (envArg, targetSlugArg, nextConfig) => {
        calls.push(['putSessionConfig', envArg, targetSlugArg, nextConfig]);
      },
    }),
  });

  assert.deepEqual(calls, [
    ['normalizeSecretValue', 'account-key'],
    ['normalizeSecretValue', 'usage-key'],
    ['putSessionSecrets', { GROUP_KV: {} }, 'session-a', {
      openaiKey: 'sk-existing',
      litAccountApiKey: 'account-key',
      litUsageApiKey: 'usage-key',
    }],
    ['mergeWorkerConfigRecords', {
      adminAddress: '0xabc',
      litCredentials: {
        litApiBase: 'https://api.chipotle.litprotocol.com',
      },
    }, {
      litCredentials: {
        litApiBase: 'https://api.chipotle.litprotocol.com',
        litActionCid: 'QmAction123',
        litGroupId: '7',
        litPkpId: '0xpkp123',
      },
    }, 'session-a'],
    ['putSessionConfig', { GROUP_KV: {} }, 'session-a', {
      merged: true,
      incomingConfig: {
        litCredentials: {
          litApiBase: 'https://api.chipotle.litprotocol.com',
          litActionCid: 'QmAction123',
          litGroupId: '7',
          litPkpId: '0xpkp123',
        },
      },
      slug: 'session-a',
    }],
  ]);
  assert.deepEqual(result, {
    body: {
      ok: true,
      bootstrapMode: 'session-account',
      apiBase: 'https://api.chipotle.litprotocol.com',
      litActionCid: 'QmAction123',
      litGroupId: '7',
      litPkpId: '0xpkp123',
      accountWalletAddress: '0xmasterwallet',
      billingBalance: {
        balance_cents: 0,
        balance_display: '$0.00',
      },
      steps: {
        createdAccount: true,
        createdGroup: true,
        createdWallet: true,
        derivedCid: true,
        registeredAction: true,
        addedActionToGroup: true,
        addedPkpToGroup: true,
        createdUsageKey: true,
      },
    },
    status: 200,
    headers: { 'Access-Control-Allow-Origin': 'https://allowed.example.test' },
  });
});
