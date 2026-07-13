import test from 'node:test';
import assert from 'node:assert/strict';

import {
  dispatchSessionConfigBootstrapRequest,
  projectPublicWorkerSessionConfig,
} from './sessionConfigBootstrapDispatch.js';
import {
  findForbiddenCloudflareDeploymentTokenPath,
  findForbiddenWorkerConfigSecretPath,
} from '../shared/workerSessionConfig.mjs';

const buildWorkerCanonicalConfig = () => ({
  slug: 'session-a',
  sessionId: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  configRevision: 'revision-a',
  sessionName: 'Session A',
  sessionInfo: 'Worker-canonical session',
  adminAddress: '0x0000000000000000000000000000000000000001',
  corsWorkerUrl: 'https://session-a.example.workers.dev',
  allowOrigins: ['https://app.example.test'],
  sessionModeProfile: {
    authority: { mode: 'worker_canonical' },
    authorization: { mechanisms: ['worker_roles'] },
    encryption: { mode: 'worker_envelope', keyProvider: 'worker_secret' },
  },
  workerAuthority: {
    version: 1,
    participantScopes: ['ai', 'storage'],
    anonymousScopes: ['ai'],
  },
  storageProfile: {
    backend: 'cloudflare',
    cloudflare: { apiToken: 'nested-cloudflare-token' },
  },
  ai: {
    models: {
      fast: {
        provider: 'openai',
        model: 'gpt-5',
        openaiKey: 'sk-nested-provider-key',
        apiKeys: { primary: 'sk-api-keys-alias' },
        providerKeys: ['sk-provider-keys-alias'],
        authorization: 'Bearer sk-authorization-alias',
        apiCredential: 'sk-api-credential-alias',
      },
    },
    apiKey: 'sk-never-public',
    headers: { Authorization: 'Bearer sk-header-secret' },
    provider: { key: 'sk-generic-key' },
    endpoint: 'https://user:password@api.example.test',
  },
  rpcUrl: 'https://user:rpc-secret@rpc.example.test',
  rpcUrlsByChainId: { 1: ['https://rpc.example.test/secret'] },
  faucet: { rpcUrl: 'https://rpc.example.test', privateKey: '0xprivate' },
  litCredentials: { litApiBase: 'https://lit.example.test', litActionCid: 'secret-cid' },
  cloudflareApiToken: 'cf-never-public',
  secrets: { openaiKey: 'sk-never-public' },
});

test('projectPublicWorkerSessionConfig returns canonical fields and recursively redacts secret-adjacent data', () => {
  const projected = projectPublicWorkerSessionConfig(buildWorkerCanonicalConfig());
  const serialized = JSON.stringify(projected);

  assert.deepEqual(projected, {
    slug: 'session-a',
    sessionId: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    configRevision: 'revision-a',
    sessionName: 'Session A',
    sessionInfo: 'Worker-canonical session',
    adminAddress: '0x0000000000000000000000000000000000000001',
    corsWorkerUrl: 'https://session-a.example.workers.dev',
    allowOrigins: ['https://app.example.test'],
    sessionModeProfile: {
      authority: { mode: 'worker_canonical' },
      authorization: { mechanisms: ['worker_roles'] },
      encryption: { mode: 'worker_envelope', keyProvider: 'worker_secret' },
    },
    workerAuthority: {
      version: 1,
      participantScopes: ['ai', 'storage'],
      anonymousScopes: ['ai'],
    },
    storageProfile: {
      backend: 'cloudflare',
      cloudflare: {},
    },
    ai: {
      models: { fast: { provider: 'openai', model: 'gpt-5' } },
    },
  });
  for (const secret of [
    'sk-never-public',
    'sk-header-secret',
    'sk-generic-key',
    'sk-nested-provider-key',
    'sk-api-keys-alias',
    'sk-provider-keys-alias',
    'sk-authorization-alias',
    'sk-api-credential-alias',
    'user:password',
    'cf-never-public',
    'rpc-secret',
    '0xprivate',
    'secret-cid',
  ]) {
    assert.equal(serialized.includes(secret), false);
  }
});

test('Cloudflare deployment-token detection covers aliases and nested Cloudflare token fields', () => {
  assert.equal(findForbiddenCloudflareDeploymentTokenPath({ cfApiToken: 'secret' }), 'config.cfApiToken');
  assert.equal(
    findForbiddenCloudflareDeploymentTokenPath({ cloudflare: { credentials: { token: 'secret' } } }),
    'config.cloudflare.credentials.token',
  );
  assert.equal(findForbiddenCloudflareDeploymentTokenPath({ ai: { models: {} } }), '');
  assert.equal(
    findForbiddenWorkerConfigSecretPath({ ai: { headers: { Authorization: 'Bearer secret' } } }),
    'config.ai.headers',
  );
  assert.equal(
    findForbiddenWorkerConfigSecretPath({ ai: { endpoint: 'https://user:password@api.example.test' } }),
    'config.ai.endpoint',
  );
  assert.equal(
    findForbiddenWorkerConfigSecretPath({ sessionModeProfile: { authorization: { mechanisms: ['worker_roles'] } } }),
    '',
  );
  assert.equal(findForbiddenWorkerConfigSecretPath({ openaiKey: 'secret' }), 'config.openaiKey');
  assert.equal(
    findForbiddenWorkerConfigSecretPath({ ai: { models: { fast: { openaiKey: 'secret' } } } }),
    'config.ai.models.fast.openaiKey',
  );
  for (const alias of ['apiKeys', 'providerKeys', 'authorization', 'apiCredential']) {
    assert.equal(
      findForbiddenWorkerConfigSecretPath({ ai: { models: { fast: { [alias]: 'secret' } } } }),
      `config.ai.models.fast.${alias}`,
    );
  }
  assert.equal(
    findForbiddenWorkerConfigSecretPath({ nested: { provider: { apiKeys: { primary: 'secret' } } } }),
    'config.nested.provider.apiKeys',
  );
  assert.equal(
    findForbiddenWorkerConfigSecretPath({ nested: { customProviderKey: 'secret' } }),
    'config.nested.customProviderKey',
  );
  assert.equal(
    findForbiddenWorkerConfigSecretPath({ nested: { requestKey: 'secret' } }),
    'config.nested.requestKey',
  );
  assert.equal(findForbiddenWorkerConfigSecretPath({ requestKey: 'secret' }), 'config.requestKey');
  assert.equal(findForbiddenWorkerConfigSecretPath({ customProviderKey: 'secret' }), 'config.customProviderKey');
  assert.equal(findForbiddenWorkerConfigSecretPath({ authorization: 'Bearer secret' }), 'config.authorization');
  assert.equal(
    findForbiddenWorkerConfigSecretPath({ sessionModeProfile: { authorization: 'Bearer secret' } }),
    'config.sessionModeProfile.authorization',
  );
  assert.equal(
    findForbiddenWorkerConfigSecretPath({ sessionModeProfile: { authorization: ['Bearer secret'] } }),
    'config.sessionModeProfile.authorization',
  );
  assert.deepEqual(
    projectPublicWorkerSessionConfig({ sessionModeProfile: { authorization: 'Bearer secret' } }),
    { sessionModeProfile: {} },
  );
  assert.equal(findForbiddenWorkerConfigSecretPath({ keyProvider: 'worker_secret' }), '');
  assert.equal(findForbiddenWorkerConfigSecretPath({ publicKey: 'public-id' }), '');
  assert.equal(findForbiddenWorkerConfigSecretPath({ resourceKey: 'default' }), '');
  assert.equal(
    findForbiddenWorkerConfigSecretPath({ authorization: { roles: { moderator: [] } } }),
    '',
  );
  assert.equal(findForbiddenWorkerConfigSecretPath({ workerAuthority: { resourceKey: 'public-id' } }), '');
  assert.equal(findForbiddenWorkerConfigSecretPath({ nested: { publicKey: 'public-id' } }), '');
  assert.equal(findForbiddenWorkerConfigSecretPath({ nested: { resourceKey: 'default' } }), '');
  assert.equal(
    findForbiddenWorkerConfigSecretPath({
      storageEnvelope: {
        keyProvider: 'worker_secret',
        sessionKey: {
          version: 1,
          alg: 'AES-256-GCM',
          wrapAlg: 'AES-GCM-KW-v1',
          iv: 'public-iv',
          wrappedKey: 'encrypted-key-material',
        },
      },
    }),
    '',
  );
  assert.equal(
    findForbiddenWorkerConfigSecretPath({
      storageEnvelope: { sessionKey: { privateKey: 'plaintext-secret' } },
    }),
    'config.storageEnvelope.sessionKey.privateKey',
  );
  assert.equal(
    findForbiddenWorkerConfigSecretPath({
      storageEnvelope: { unrelatedKey: 'plaintext-secret' },
    }),
    'config.storageEnvelope.unrelatedKey',
  );
});

test('dispatchSessionConfigBootstrapRequest returns only CORS-scoped worker-canonical config', async () => {
  const config = buildWorkerCanonicalConfig();
  const response = await dispatchSessionConfigBootstrapRequest({
    request: new Request('https://worker.example/session-config', {
      headers: { Origin: 'https://app.example.test', 'X-Session-Slug': 'session-a' },
    }),
    env: { GROUP_KV: {} },
    slugHint: '',
    baseHeaders: {},
    deps: {
      resolveRequestSlugWithoutToken: () => ({ ok: true, slug: 'session-a', explicitSlugProvided: true }),
      getSessionConfig: async () => config,
      getCorsContext: async () => ({
        ok: true,
        headers: { 'Access-Control-Allow-Origin': 'https://app.example.test' },
      }),
      json: (body, status, headers) => ({ body, status, headers }),
    },
    constants: {
      missingSlugError: 'Session slug is required.',
      sessionConfigNotFoundError: 'Session config not found.',
    },
  });

  assert.equal(response.status, 200);
  assert.equal(response.body.ok, true);
  assert.equal(response.body.sessionSlug, 'session-a');
  assert.equal(response.body.config.configRevision, 'revision-a');
  assert.equal(JSON.stringify(response).includes('sk-never-public'), false);
  assert.deepEqual(Object.fromEntries(response.headers.entries()), {
    'access-control-allow-origin': 'https://app.example.test',
    'cache-control': 'no-store',
    vary: 'Origin, X-Session-Slug',
  });
});

test('dispatchSessionConfigBootstrapRequest rejects missing config, wrong authority, and blocked CORS', async () => {
  const base = {
    request: new Request('https://worker.example/session-config', {
      headers: { Origin: 'https://blocked.example', 'X-Session-Slug': 'session-a' },
    }),
    env: {},
    baseHeaders: {},
    constants: {
      missingSlugError: 'Session slug is required.',
      sessionConfigNotFoundError: 'Session config not found.',
    },
  };
  const json = (body, status, headers) => ({ body, status, headers });
  const slugResolver = () => ({ ok: true, slug: 'session-a', explicitSlugProvided: true });

  const missingResponse = await dispatchSessionConfigBootstrapRequest({
    ...base,
    deps: { resolveRequestSlugWithoutToken: slugResolver, getSessionConfig: async () => null, json },
  });
  assert.equal(missingResponse.status, 404);
  assert.equal(missingResponse.headers.get('Cache-Control'), 'no-store');
  assert.equal(missingResponse.headers.get('Vary'), 'Origin, X-Session-Slug');
  assert.equal((await dispatchSessionConfigBootstrapRequest({
    ...base,
    deps: {
      resolveRequestSlugWithoutToken: slugResolver,
      getSessionConfig: async () => ({
        sessionModeProfile: { authority: { mode: 'evm_registry_canonical' } },
      }),
      json,
    },
  })).status, 404);
  const blockedCorsResponse = await dispatchSessionConfigBootstrapRequest({
    ...base,
    deps: {
      resolveRequestSlugWithoutToken: slugResolver,
      getSessionConfig: async () => buildWorkerCanonicalConfig(),
      getCorsContext: async () => ({
        ok: false,
        response: new Response(JSON.stringify({ error: 'Origin not allowed.' }), {
          status: 403,
          headers: { Vary: 'Origin' },
        }),
      }),
      json,
    },
  });
  assert.equal(blockedCorsResponse.status, 403);
  assert.equal(blockedCorsResponse.headers.get('Cache-Control'), 'no-store');
  assert.equal(blockedCorsResponse.headers.get('Vary'), 'Origin, X-Session-Slug');
});
