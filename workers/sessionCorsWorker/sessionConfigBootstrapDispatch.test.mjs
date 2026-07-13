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

test('projectPublicWorkerSessionConfig omits the complete persisted Lit descriptor', () => {
  const projected = projectPublicWorkerSessionConfig({
    ...buildWorkerCanonicalConfig(),
    litCredentials: {
      litApiBase: 'https://api.chipotle.litprotocol.com',
      litGroupId: 'group_123',
      litPkpId: 'pkp_123',
      litActionCid: 'bafy123',
    },
  });

  assert.equal(Object.prototype.hasOwnProperty.call(projected, 'litCredentials'), false);
  assert.equal(JSON.stringify(projected).includes('bafy123'), false);
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
  for (const [config, expectedPath] of [
    [{ nested: { faucet: 'secret' } }, 'config.nested.faucet'],
    [{ arbitrary: [{ deeper: { faucet: { amountEth: '0.001' } } }] }, 'config.arbitrary.0.deeper.faucet'],
    [{ nested: { password: 'secret' } }, 'config.nested.password'],
    [{ nested: { token: 'secret' } }, 'config.nested.token'],
    [{ nested: { arweaveJwk: { kty: 'RSA' } } }, 'config.nested.arweaveJwk'],
    [{ arbitrary: [{ deeper: { password: 'secret' } }] }, 'config.arbitrary.0.deeper.password'],
    [{ arbitrary: [{ deeper: { token: 'secret' } }] }, 'config.arbitrary.0.deeper.token'],
    [{ arbitrary: [{ deeper: { arweaveJwk: 'secret' } }] }, 'config.arbitrary.0.deeper.arweaveJwk'],
  ]) {
    assert.equal(findForbiddenWorkerConfigSecretPath(config), expectedPath);
  }
  assert.equal(findForbiddenWorkerConfigSecretPath({ requestKey: 'secret' }), 'config.requestKey');
  assert.equal(findForbiddenWorkerConfigSecretPath({ customProviderKey: 'secret' }), 'config.customProviderKey');
  assert.equal(findForbiddenWorkerConfigSecretPath({
    litCredentials: {
      litApiBase: 'https://api.chipotle.litprotocol.com',
      litGroupId: 'group_123',
      litPkpId: 'pkp_123',
      litActionCid: 'bafy123',
    },
  }), '');
  for (const unsafeLitCredentials of [
    { litAccountApiKey: 'account-secret' },
    { litUsageApiKey: 'usage-secret' },
    { apiKey: 'generic-secret' },
    { token: 'generic-secret' },
    { litNetwork: 'datil' },
    { metadata: { clientSecret: 'nested-secret' } },
    { litApiBase: 'https://user:secret@lit.example' },
  ]) {
    assert.match(
      findForbiddenWorkerConfigSecretPath({ litCredentials: unsafeLitCredentials }),
      /^config\.litCredentials\./,
    );
  }
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
      scopes: {
        ai: true,
        faucet: false,
        token: false,
        password: false,
        arweaveJwk: false,
      },
    }),
    '',
  );
  assert.equal(
    findForbiddenWorkerConfigSecretPath({ scopes: { faucet: 'secret' } }),
    'config.scopes.faucet',
  );
  assert.equal(
    findForbiddenWorkerConfigSecretPath({ scopes: { nested: { token: false } } }),
    'config.scopes.nested.token',
  );
  assert.equal(
    findForbiddenWorkerConfigSecretPath({
      faucet: {
        rpcUrl: 'https://rpc.example.test',
        amountEth: '0.001',
      },
    }),
    '',
  );
  assert.equal(
    findForbiddenWorkerConfigSecretPath({
      nested: {
        exposesWorkerToken: false,
        passwordProtected: true,
        tokenType: 'Bearer',
      },
    }),
    '',
  );
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
    request: new Request('https://worker.example/session-config?slug=session-a', {
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

test('dispatchSessionConfigBootstrapRequest rejects invalid or mismatched slug query aliases', async () => {
  let configReads = 0;
  const json = (body, status, headers) => ({ body, status, headers });
  const base = {
    env: {},
    slugHint: '',
    baseHeaders: {},
    deps: {
      resolveRequestSlugWithoutToken: () => ({
        ok: true,
        slug: 'session-a',
        explicitSlugProvided: true,
      }),
      getSessionConfig: async () => {
        configReads += 1;
        return buildWorkerCanonicalConfig();
      },
      json,
    },
    constants: {
      missingSlugError: 'Session slug is required.',
      sessionConfigNotFoundError: 'Session config not found.',
    },
  };

  const mismatch = await dispatchSessionConfigBootstrapRequest({
    ...base,
    request: new Request('https://worker.example/session-config?slug=session-b', {
      headers: { 'X-Session-Slug': 'session-a' },
    }),
  });
  assert.equal(mismatch.status, 400);
  assert.equal(mismatch.body.error, 'Session config slug query does not match X-Session-Slug.');

  const invalid = await dispatchSessionConfigBootstrapRequest({
    ...base,
    request: new Request('https://worker.example/session-config?slug=Session%20A', {
      headers: { 'X-Session-Slug': 'session-a' },
    }),
  });
  assert.equal(invalid.status, 400);
  assert.match(invalid.body.error, /Invalid session slug/);
  assert.equal(configReads, 0);
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
