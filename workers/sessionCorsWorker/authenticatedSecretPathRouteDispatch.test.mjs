import test from 'node:test';
import assert from 'node:assert/strict';

import { dispatchAuthenticatedSecretPathRoute } from './authenticatedSecretPathRouteDispatch.js';

test('dispatchAuthenticatedSecretPathRoute ignores unrelated routes', async () => {
  let called = false;

  const result = await dispatchAuthenticatedSecretPathRoute({
    path: '/',
    method: 'POST',
    deps: {
      evaluateAuthenticatedRoutePreflight: async () => {
        called = true;
        return { ok: true };
      },
    },
  });

  assert.equal(called, false);
  assert.deepEqual(result, { handled: false });
});

test('authenticated agent questions reuse the session question catalog when agent HTTP is enabled', async () => {
  let preflightRoute = '';
  const result = await dispatchAuthenticatedSecretPathRoute({
    path: '/api/agent/questions',
    method: 'GET',
    request: new Request('https://worker.example/api/agent/questions?limit=1'),
    config: { sessionModeProfile: { surfaces: { agentHttp: true } } },
    slug: 'session-a',
    address: '0xabc',
    env: { SESSION_CONFIG_KV: {} },
    limit: 7,
    headers: { 'Access-Control-Allow-Origin': 'https://allowed.example' },
    scopes: { storage: true },
    deps: {
      evaluateAuthenticatedRoutePreflight: async ({ route }) => {
        preflightRoute = route;
        return { ok: true };
      },
      loadPublicInterviewQuestions: async ({ slug }) => {
        assert.equal(slug, 'session-a');
        return [
          { id: 'q-1', prompt: 'First?', type: 'binary', options: ['Agree', 'Unsure', 'Disagree'] },
          { id: 'q-2', prompt: 'Second?', type: 'freeform', options: [] },
        ];
      },
      json: (body, status, headers) => ({ body, status, headers }),
    },
  });

  assert.equal(preflightRoute, 'storage');
  assert.equal(result.handled, true);
  assert.equal(result.response.status, 200);
  assert.equal(result.response.headers.get('cache-control'), 'no-store');
  assert.deepEqual(result.response.body, {
    ok: true,
    sessionSlug: 'session-a',
    questions: [{
      questionId: 'q-1',
      prompt: 'First?',
      questionType: 'binary',
      options: ['Agree', 'Unsure', 'Disagree'],
    }],
  });
});

test('authenticated agent questions fail closed when the session surface is disabled', async () => {
  let catalogCalled = false;
  const result = await dispatchAuthenticatedSecretPathRoute({
    path: '/api/agent/questions',
    method: 'GET',
    request: new Request('https://worker.example/api/agent/questions'),
    config: { sessionModeProfile: { surfaces: { agentHttp: false } } },
    headers: {},
    deps: {
      loadPublicInterviewQuestions: async () => {
        catalogCalled = true;
        return [];
      },
      json: (body, status, headers) => ({ body, status, headers }),
    },
  });

  assert.equal(catalogCalled, false);
  assert.deepEqual(result, {
    handled: true,
    response: {
      body: { error: 'Agent HTTP is disabled for this session.' },
      status: 404,
      headers: {},
    },
  });
});

test('dispatchAuthenticatedSecretPathRoute blocks participant writes after the session ends but keeps reads open', async () => {
  let groupRouteCalls = 0;
  const deps = {
    now: () => Date.parse('2030-01-02T03:04:00Z'),
    json: (body, status, headers) => ({ body, status, headers }),
    workerGroupsRoute: async () => {
      groupRouteCalls += 1;
      return new Response('groups');
    },
    evaluateAuthenticatedRoutePreflight: async () => ({ ok: true }),
  };
  const base = {
    config: { sessionEndsAt: '2030-01-02T03:04:00Z' },
    headers: { 'Access-Control-Allow-Origin': '*' },
    deps,
  };

  for (const path of ['/groups/create', '/groups/join', '/groups/leave']) {
    const blocked = await dispatchAuthenticatedSecretPathRoute({
      ...base,
      path,
      method: 'POST',
    });
    assert.deepEqual(blocked, {
      handled: true,
      response: {
        body: {
          error: 'This session has ended.',
          code: 'session_ended',
          sessionEndsAt: '2030-01-02T03:04:00.000Z',
        },
        status: 410,
        headers: { 'Access-Control-Allow-Origin': '*' },
      },
    }, path);
  }
  assert.equal(groupRouteCalls, 0);

  for (const path of ['/groups/list', '/groups/members']) {
    const readable = await dispatchAuthenticatedSecretPathRoute({
      ...base,
      path,
      method: 'GET',
    });
    assert.equal(readable.handled, true);
    assert.equal(readable.response.status, 200);
  }
  assert.equal(groupRouteCalls, 2);
});

test('dispatchAuthenticatedSecretPathRoute preserves preflight failure passthrough', async () => {
  const response = new Response(JSON.stringify({ error: 'Token missing transcribe scope.' }), {
    status: 403,
  });

  const result = await dispatchAuthenticatedSecretPathRoute({
    path: '/transcribe',
    method: 'POST',
    request: { headers: new Headers() },
    config: { allowOrigins: ['https://allowed.example'] },
    slug: 'session-a',
    address: '0xabc',
    env: { GROUP_KV: {} },
    limit: 7,
    headers: { 'Access-Control-Allow-Origin': '*' },
    scopes: { transcribe: false },
    deps: {
      evaluateAuthenticatedRoutePreflight: async (value) => {
        assert.equal(value.scope, 'transcribe');
        assert.equal(value.route, 'transcribe');
        return { ok: false, response };
      },
      resolveAuthenticatedRouteSecrets: async () => {
        throw new Error('should not resolve secrets');
      },
      checkRateLimit: async () => true,
      getSessionSecrets: async () => ({}),
      json: () => null,
    },
  });

  assert.equal(result.handled, true);
  assert.equal(result.response, response);
});

test('dispatchAuthenticatedSecretPathRoute resolves secrets and hands transcribe requests downstream', async () => {
  const request = { headers: new Headers({ Origin: 'https://allowed.example' }) };
  const secrets = { openaiKey: 'sk-openai' };
  const downstreamResponse = new Response('ok');

  const result = await dispatchAuthenticatedSecretPathRoute({
    path: '/transcribe',
    method: 'POST',
    request,
    config: { allowOrigins: ['https://allowed.example'] },
    slug: 'session-a',
    address: '0xabc',
    env: { GROUP_KV: {} },
    limit: 7,
    headers: { 'Access-Control-Allow-Origin': 'https://allowed.example' },
    scopes: { transcribe: true },
    deps: {
      evaluateAuthenticatedRoutePreflight: async () => ({ ok: true, tokenHasScope: true }),
      resolveAuthenticatedRouteSecrets: async () => ({ ok: true, secrets }),
      transcribe: async (value) => {
        assert.deepEqual(value, {
          request,
          secrets,
          baseHeaders: { 'Access-Control-Allow-Origin': 'https://allowed.example' },
        });
        return downstreamResponse;
      },
      checkRateLimit: async () => true,
      getSessionSecrets: async () => secrets,
      json: () => null,
    },
  });

  assert.equal(result.handled, true);
  assert.equal(result.response, downstreamResponse);
});

test('dispatchAuthenticatedSecretPathRoute preserves secret resolution failure passthrough', async () => {
  const response = new Response(JSON.stringify({ error: 'Session secrets not configured.' }), {
    status: 401,
  });

  const result = await dispatchAuthenticatedSecretPathRoute({
    path: '/arweave/upload',
    method: 'POST',
    request: { headers: new Headers() },
    config: { allowOrigins: ['https://allowed.example'] },
    slug: 'session-a',
    address: '0xabc',
    env: { GROUP_KV: {} },
    limit: 7,
    headers: { 'Access-Control-Allow-Origin': '*' },
    scopes: { arweave: true },
    deps: {
      evaluateAuthenticatedRoutePreflight: async () => ({ ok: true, tokenHasScope: true }),
      resolveAuthenticatedRouteSecrets: async () => ({ ok: false, response }),
      arweaveUpload: async () => {
        throw new Error('should not dispatch upload');
      },
      checkRateLimit: async () => true,
      getSessionSecrets: async () => null,
      json: () => null,
    },
  });

  assert.equal(result.handled, true);
  assert.equal(result.response, response);
});

test('dispatchAuthenticatedSecretPathRoute allows authenticated arweave uploads with a provided JWK when worker secrets are missing', async () => {
  const request = { headers: new Headers({ Origin: 'https://allowed.example' }) };
  const config = { registryAddress: '0x0000000000000000000000000000000000000001' };
  const response = new Response(JSON.stringify({ error: 'Session secrets not configured.' }), {
    status: 401,
  });
  const downstreamResponse = new Response('uploaded-via-provided-jwk');

  const result = await dispatchAuthenticatedSecretPathRoute({
    path: '/arweave/upload',
    method: 'POST',
    request,
    config,
    slug: 'session-a',
    address: '0xabc',
    env: { GROUP_KV: {} },
    limit: 7,
    headers: { 'Access-Control-Allow-Origin': 'https://allowed.example' },
    scopes: { arweave: true },
    deps: {
      evaluateAuthenticatedRoutePreflight: async () => ({ ok: true, tokenHasScope: true }),
      resolveAuthenticatedRouteSecrets: async () => ({ ok: false, reason: 'missing_secrets', response }),
      readArweaveUploadRequestPayload: async (value) => {
        assert.equal(value, request);
        return {
          ok: true,
          payload: {
            providedJwk: '{"kty":"RSA"}',
          },
        };
      },
      arweaveUpload: async (value) => {
        assert.deepEqual(value, {
          request,
          env: { GROUP_KV: {} },
          secrets: {},
          baseHeaders: { 'Access-Control-Allow-Origin': 'https://allowed.example' },
          config,
          slug: 'session-a',
          uploaderAddress: '0xabc',
        });
        return downstreamResponse;
      },
      checkRateLimit: async () => true,
      getSessionSecrets: async () => null,
      json: () => null,
    },
  });

  assert.equal(result.handled, true);
  assert.equal(result.response, downstreamResponse);
});

test('dispatchAuthenticatedSecretPathRoute hands authenticated arweave uploads downstream with config and uploader context', async () => {
  const request = { headers: new Headers({ Origin: 'https://allowed.example' }) };
  const config = { registryAddress: '0x0000000000000000000000000000000000000001' };
  const secrets = { arweaveJwk: '{}' };
  const downstreamResponse = new Response('uploaded');

  const result = await dispatchAuthenticatedSecretPathRoute({
    path: '/arweave/upload',
    method: 'POST',
    request,
    config,
    slug: 'session-a',
    address: '0xabc',
    env: { GROUP_KV: {} },
    limit: 7,
    headers: { 'Access-Control-Allow-Origin': 'https://allowed.example' },
    scopes: { arweave: true },
    deps: {
      evaluateAuthenticatedRoutePreflight: async (value) => {
        assert.equal(value.scope, 'arweave');
        assert.equal(value.route, 'arweave');
        return { ok: true, tokenHasScope: true };
      },
      resolveAuthenticatedRouteSecrets: async () => ({ ok: true, secrets }),
      arweaveUpload: async (value) => {
        assert.deepEqual(value, {
          request,
          env: { GROUP_KV: {} },
          secrets,
          baseHeaders: { 'Access-Control-Allow-Origin': 'https://allowed.example' },
          config,
          slug: 'session-a',
          uploaderAddress: '0xabc',
        });
        return downstreamResponse;
      },
      checkRateLimit: async () => true,
      getSessionSecrets: async () => secrets,
      json: () => null,
    },
  });

  assert.equal(result.handled, true);
  assert.equal(result.response, downstreamResponse);
});

test('dispatchAuthenticatedSecretPathRoute routes authenticated storage requests without requiring session secrets first', async () => {
  const request = { headers: new Headers({ Origin: 'https://allowed.example' }) };
  const config = { storageProfile: { backend: 'cloudflare' } };
  const downstreamResponse = new Response('stored');
  let secretsCalled = false;

  const result = await dispatchAuthenticatedSecretPathRoute({
    path: '/storage/upload',
    method: 'POST',
    request,
    config,
    slug: 'session-a',
    address: '0xabc',
    env: { CE_STORAGE_R2: {} },
    limit: 7,
    headers: { 'Access-Control-Allow-Origin': 'https://allowed.example' },
    scopes: { arweave: true },
    deps: {
      evaluateAuthenticatedRoutePreflight: async (value) => {
        assert.equal(value.scope, 'arweave');
        assert.equal(value.route, 'storage');
        return { ok: true, tokenHasScope: true };
      },
      resolveAuthenticatedRouteSecrets: async () => {
        secretsCalled = true;
        return { ok: false };
      },
      storageRoute: async (value) => {
        assert.equal(value.path, '/storage/upload');
        assert.equal(value.env.CE_STORAGE_R2 != null, true);
        assert.equal(value.config, config);
        assert.equal(value.uploaderAddress, '0xabc');
        return downstreamResponse;
      },
      checkRateLimit: async () => true,
      json: () => null,
    },
  });

  assert.equal(result.handled, true);
  assert.equal(result.response, downstreamResponse);
  assert.equal(secretsCalled, false);
});

test('dispatchAuthenticatedSecretPathRoute accepts explicit storage scope for storage routes', async () => {
  const request = { headers: new Headers({ Origin: 'https://allowed.example' }) };
  const config = { storageProfile: { backend: 'cloudflare' } };
  const downstreamResponse = new Response('stored');

  const result = await dispatchAuthenticatedSecretPathRoute({
    path: '/storage/read',
    method: 'GET',
    request,
    config,
    slug: 'session-a',
    address: '0xabc',
    env: { CE_STORAGE_INDEX_KV: {} },
    limit: 7,
    headers: { 'Access-Control-Allow-Origin': 'https://allowed.example' },
    scopes: { arweave: false, storage: true },
    deps: {
      evaluateAuthenticatedRoutePreflight: async (value) => {
        assert.equal(value.scope, 'storage');
        assert.equal(value.route, 'storage');
        return { ok: true, tokenHasScope: true };
      },
      storageRoute: async (value) => {
        assert.equal(value.path, '/storage/read');
        assert.deepEqual(value.authScopes, { arweave: false, storage: true });
        return downstreamResponse;
      },
      checkRateLimit: async () => true,
      json: () => null,
    },
  });

  assert.equal(result.handled, true);
  assert.equal(result.response, downstreamResponse);
});

test('dispatchAuthenticatedSecretPathRoute routes encrypted envelope exports as storage requests', async () => {
  const request = { headers: new Headers({ Origin: 'https://allowed.example' }) };
  const downstreamResponse = new Response('exported-envelopes');
  let secretsCalled = false;

  const result = await dispatchAuthenticatedSecretPathRoute({
    path: '/storage/export-envelopes',
    method: 'GET',
    request,
    config: { storageProfile: { backend: 'cloudflare' } },
    slug: 'session-a',
    address: '0xabc',
    env: { CE_STORAGE_INDEX_KV: {} },
    limit: 7,
    headers: { 'Access-Control-Allow-Origin': 'https://allowed.example' },
    scopes: { storage: true },
    deps: {
      evaluateAuthenticatedRoutePreflight: async (value) => {
        assert.equal(value.scope, 'storage');
        assert.equal(value.route, 'storage');
        return { ok: true, tokenHasScope: true };
      },
      resolveAuthenticatedRouteSecrets: async () => {
        secretsCalled = true;
        return { ok: false };
      },
      storageRoute: async (value) => {
        assert.equal(value.path, '/storage/export-envelopes');
        assert.deepEqual(value.authScopes, { storage: true });
        return downstreamResponse;
      },
      checkRateLimit: async () => true,
      json: () => null,
    },
  });

  assert.equal(result.handled, true);
  assert.equal(result.response, downstreamResponse);
  assert.equal(secretsCalled, false);
});

test('dispatchAuthenticatedSecretPathRoute rejects arweave-only tokens for worker group routes', async () => {
  const routes = [
    { path: '/groups/list', method: 'GET' },
    { path: '/groups/my-memberships', method: 'GET' },
    { path: '/groups/members', method: 'POST' },
    { path: '/groups/create', method: 'POST' },
    { path: '/groups/join', method: 'POST' },
    { path: '/groups/leave', method: 'POST' },
  ];
  const scopesWithoutGroups = [
    { arweave: true, groups: false },
    { arweave: true },
  ];

  for (const route of routes) {
    for (const scopes of scopesWithoutGroups) {
      let workerGroupsCalls = 0;
      const forbiddenResponse = new Response(JSON.stringify({ error: 'Token missing groups scope.' }), {
        status: 403,
      });

      const result = await dispatchAuthenticatedSecretPathRoute({
        ...route,
        request: { headers: new Headers({ Origin: 'https://allowed.example' }) },
        config: {},
        slug: 'session-a',
        address: '0x0000000000000000000000000000000000000def',
        env: { CE_WORKER_GROUPS_KV: {} },
        limit: 7,
        headers: { 'Access-Control-Allow-Origin': 'https://allowed.example' },
        scopes,
        deps: {
          evaluateAuthenticatedRoutePreflight: async (value) => (
            value.scopes?.[value.scope] === true
              ? { ok: true, tokenHasScope: true }
              : { ok: false, response: forbiddenResponse }
          ),
          workerGroupsRoute: async () => {
            workerGroupsCalls += 1;
            return new Response(JSON.stringify({ ok: true }));
          },
        },
      });

      assert.equal(result.handled, true, route.path);
      assert.equal(result.response, forbiddenResponse, route.path);
      assert.equal(workerGroupsCalls, 0, route.path);
    }
  }
});

test('dispatchAuthenticatedSecretPathRoute routes authenticated worker group requests', async () => {
  const request = { headers: new Headers({ Origin: 'https://allowed.example' }) };
  const downstreamResponse = new Response(JSON.stringify({ ok: true }));

  const result = await dispatchAuthenticatedSecretPathRoute({
    path: '/groups/my-memberships',
    method: 'GET',
    request,
    config: { storageProfile: { backend: 'cloudflare' } },
    slug: 'session-a',
    address: '0x0000000000000000000000000000000000000def',
    env: { CE_WORKER_GROUPS_KV: {} },
    limit: 7,
    headers: { 'Access-Control-Allow-Origin': 'https://allowed.example' },
    scopes: { arweave: false, groups: true },
    deps: {
      evaluateAuthenticatedRoutePreflight: async (value) => {
        assert.equal(value.scope, 'groups');
        assert.equal(value.route, 'groups');
        return { ok: true, tokenHasScope: true };
      },
      workerGroupsRoute: async (value) => {
        assert.equal(value.path, '/groups/my-memberships');
        assert.equal(value.requesterAddress, '0x0000000000000000000000000000000000000def');
        assert.deepEqual(value.authScopes, { arweave: false, groups: true });
        return downstreamResponse;
      },
      resolveAuthenticatedRouteSecrets: async () => {
        throw new Error('should not resolve secrets');
      },
      checkRateLimit: async () => true,
      json: () => null,
    },
  });

  assert.equal(result.handled, true);
  assert.equal(result.response, downstreamResponse);
});
