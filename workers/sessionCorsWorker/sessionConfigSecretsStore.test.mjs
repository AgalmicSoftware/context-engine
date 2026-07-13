import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getSessionConfig,
  getSessionSecrets,
  putSessionConfig,
  putSessionSecrets,
} from './sessionConfigSecretsStore.js';

test('getSessionConfig reads the session config KV key and normalizes with the requested slug', async () => {
  const calls = [];
  const env = { GROUP_KV: {} };
  const rawConfig = { sessionName: 'Session A' };

  const result = await getSessionConfig(env, 'session-a', {
    getKvJson: async (passedEnv, key) => {
      calls.push(['getKvJson', passedEnv, key]);
      return rawConfig;
    },
    normalizeWorkerConfigRecord: (raw, options) => {
      calls.push(['normalizeWorkerConfigRecord', raw, options]);
      return { normalized: true, raw, options };
    },
  });

  assert.deepEqual(calls, [
    ['getKvJson', env, 'session:session-a:config'],
    ['normalizeWorkerConfigRecord', rawConfig, { slug: 'session-a' }],
  ]);
  assert.deepEqual(result, {
    normalized: true,
    raw: rawConfig,
    options: { slug: 'session-a' },
  });
});

test('getSessionSecrets reads legacy session secrets without config normalization', async () => {
  const calls = [];
  const env = { GROUP_KV: {} };
  const rawSecrets = { openaiKey: 'sk-test' };

  const result = await getSessionSecrets(env, 'session-a', {
    getKvJson: async (passedEnv, key) => {
      calls.push(['getKvJson', passedEnv, key]);
      return rawSecrets;
    },
  });

  assert.deepEqual(calls, [
    ['getKvJson', env, 'session:session-a:secrets'],
  ]);
  assert.deepEqual(result, rawSecrets);
});

test('getSessionSecrets unwraps v1 session secrets envelopes', async () => {
  const rawSecrets = { openaiKey: 'sk-test' };

  const result = await getSessionSecrets({ GROUP_KV: {} }, 'session-a', {
    getKvJson: async () => ({
      v: 1,
      kind: 'session-secrets',
      createdAt: 1000,
      updatedAt: 2000,
      secrets: rawSecrets,
    }),
  });

  assert.deepEqual(result, rawSecrets);
});

test('getSessionSecrets unwraps legacy versioned session secret envelopes', async () => {
  const rawSecrets = { faucetPrivateKey: '0xfaucet' };

  const result = await getSessionSecrets({ GROUP_KV: {} }, 'session-a', {
    getKvJson: async () => ({
      version: 1,
      secrets: rawSecrets,
      updatedAt: '2026-05-21T23:00:00.000Z',
    }),
  });

  assert.deepEqual(result, rawSecrets);
});

test('putSessionConfig rejects invalid normalized configs before writing to KV', async () => {
  let putCalled = false;

  await assert.rejects(
    () => putSessionConfig({ GROUP_KV: {} }, 'session-a', { sessionName: 'Broken' }, {
      normalizeWorkerConfigRecord: () => null,
      putKvJson: async () => {
        putCalled = true;
      },
    }),
    /Invalid session config\./
  );

  assert.equal(putCalled, false);
});

test('putSessionConfig normalizes the value and writes the config KV key', async () => {
  const calls = [];
  const env = { GROUP_KV: {} };
  const incoming = { sessionName: 'Session A' };
  const normalized = { sessionName: 'Session A', slug: 'session-a' };

  await putSessionConfig(env, 'session-a', incoming, {
    normalizeWorkerConfigRecord: (raw, options) => {
      calls.push(['normalizeWorkerConfigRecord', raw, options]);
      return normalized;
    },
    putKvJson: async (passedEnv, key, value) => {
      calls.push(['putKvJson', passedEnv, key, value]);
    },
  });

  assert.deepEqual(calls, [
    ['normalizeWorkerConfigRecord', incoming, { slug: 'session-a' }],
    ['putKvJson', env, 'session:session-a:config', normalized],
  ]);
});

test('putSessionConfig persists only the expected wrapped storage-envelope key fields', async () => {
  const writes = [];
  const config = {
    slug: 'session-a',
    storageEnvelope: {
      version: 1,
      keyProvider: 'worker_secret',
      sessionKey: {
        version: 1,
        alg: 'AES-256-GCM',
        wrapAlg: 'AES-GCM-KW-v1',
        iv: 'public-iv',
        wrappedKey: 'encrypted-key-material',
      },
    },
  };

  await putSessionConfig({ GROUP_KV: {} }, 'session-a', config, {
    normalizeWorkerConfigRecord: (value) => value,
    putKvJson: async (...args) => writes.push(args),
  });

  assert.deepEqual(writes, [[{ GROUP_KV: {} }, 'session:session-a:config', config]]);
});

test('putSessionConfig persists only the established non-secret Lit descriptor fields', async () => {
  const writes = [];
  const config = {
    slug: 'session-a',
    litCredentials: {
      litApiBase: 'https://api.chipotle.litprotocol.com',
      litGroupId: 'group_123',
      litPkpId: 'pkp_123',
      litActionCid: 'bafy123',
    },
  };

  await putSessionConfig({ GROUP_KV: {} }, 'session-a', config, {
    normalizeWorkerConfigRecord: (value) => value,
    putKvJson: async (...args) => writes.push(args),
  });

  assert.deepEqual(writes, [[{ GROUP_KV: {} }, 'session:session-a:config', config]]);
});

test('putSessionConfig preserves public session and storage profile descriptors', async () => {
  const writes = [];
  const config = {
    slug: 'session-a',
    sessionModeProfile: {
      authority: { mode: 'worker_canonical' },
      authorization: { mechanisms: ['worker_roles'] },
      encryption: { mode: 'worker_envelope', keyProvider: 'worker_secret' },
    },
    storageProfile: {
      backend: 'cloudflare',
      resources: { questions: 'active', responses: 'active' },
      payloadAccessControl: {
        gate: 'role_gate',
        encryption: 'worker_envelope',
        accessConditions: {
          match: 'any',
          conditions: [
            { kind: 'worker_role', role: 'admin' },
            { kind: 'agent_grant_scope', scope: 'storage' },
          ],
        },
      },
      cloudflare: {
        payloadAccessMode: 'worker_envelope',
        exposesAccountId: false,
        exposesBucketName: false,
        exposesWorkerToken: false,
      },
    },
  };

  await putSessionConfig({ GROUP_KV: {} }, 'session-a', config, {
    normalizeWorkerConfigRecord: (value) => value,
    putKvJson: async (...args) => writes.push(args),
  });

  assert.deepEqual(writes, [[{ GROUP_KV: {} }, 'session:session-a:config', config]]);
});

test('putSessionConfig fails closed before KV persistence for secret-like config aliases', async () => {
  const unsafeConfigs = [
    { requestKey: 'secret' },
    { customProviderKey: 'secret' },
    { ai: { models: { fast: { apiKeys: { primary: 'secret' } } } } },
    { ai: { models: { fast: { providerKeys: ['secret'] } } } },
    { ai: { models: { fast: { authorization: 'Bearer secret' } } } },
    { ai: { models: { fast: { apiCredential: 'secret' } } } },
    { nested: { provider: { apiKeys: { primary: 'secret' } } } },
    { nested: { customProviderKey: 'secret' } },
    { nested: { requestKey: 'secret' } },
    { nested: { faucet: 'secret' } },
    { arbitrary: [{ deeper: { faucet: { amountEth: '0.001' } } }] },
    { nested: { password: 'secret' } },
    { nested: { token: 'secret' } },
    { nested: { arweaveJwk: { kty: 'RSA' } } },
    { arbitrary: [{ deeper: { password: 'secret' } }] },
    { arbitrary: [{ deeper: { token: 'secret' } }] },
    { arbitrary: [{ deeper: { arweaveJwk: 'secret' } }] },
    { authorization: 'Bearer secret' },
    { sessionModeProfile: { authorization: 'Bearer secret' } },
    { sessionModeProfile: { authorization: ['Bearer secret'] } },
    { storageEnvelope: { sessionKey: { privateKey: 'plaintext-secret' } } },
    { storageEnvelope: { unrelatedKey: 'plaintext-secret' } },
    { litCredentials: { litAccountApiKey: 'account-secret' } },
    { litCredentials: { litUsageApiKey: 'usage-secret' } },
    { litCredentials: { apiKey: 'generic-secret' } },
    { litCredentials: { token: 'generic-secret' } },
    { litCredentials: { litNetwork: 'datil' } },
    { litCredentials: { metadata: { clientSecret: 'nested-secret' } } },
    { litCredentials: { litApiBase: 'https://user:secret@lit.example' } },
  ];
  let writes = 0;

  for (const config of unsafeConfigs) {
    await assert.rejects(
      () => putSessionConfig({ GROUP_KV: {} }, 'session-a', config, {
        normalizeWorkerConfigRecord: (value) => value,
        putKvJson: async () => { writes += 1; },
      }),
      /Secret-like values are not allowed in public session config fields\./,
    );
  }

  assert.equal(writes, 0);
});

test('putSessionSecrets wraps the secrets payload in a v1 envelope', async () => {
  const calls = [];
  const env = { GROUP_KV: {} };
  const secrets = { openaiKey: 'sk-test', customRpcUrl: 'https://rpc.example' };

  await putSessionSecrets(env, 'session-a', secrets, {
    now: () => 1234567890000,
    putKvJson: async (passedEnv, key, value) => {
      calls.push(['putKvJson', passedEnv, key, value]);
    },
  });

  assert.deepEqual(calls, [
    ['putKvJson', env, 'session:session-a:secrets', {
      v: 1,
      kind: 'session-secrets',
      createdAt: 1234567890000,
      updatedAt: 1234567890000,
      secrets,
    }],
  ]);
});
