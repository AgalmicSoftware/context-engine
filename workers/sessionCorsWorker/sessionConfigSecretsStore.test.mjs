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
    { litCredentials: { litApiBase: 'https://user:secret@127.0.0.1' } },
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

test('putSessionSecrets encrypts the secrets payload before writing a v1 envelope', async () => {
  const calls = [];
  const env = {
    GROUP_KV: {},
    CE_STORAGE_ENVELOPE_KEK: 'current-session-secrets-kek',
  };
  const secrets = { openaiKey: 'sk-test', customRpcUrl: 'https://rpc.example' };

  await putSessionSecrets(env, 'session-a', secrets, {
    now: () => 1234567890000,
    randomBytes: (length) => new Uint8Array(length).fill(7),
    putKvJson: async (passedEnv, key, value) => {
      calls.push(['putKvJson', passedEnv, key, value]);
    },
  });

  assert.equal(calls.length, 1);
  const [operation, passedEnv, key, envelope] = calls[0];
  assert.equal(operation, 'putKvJson');
  assert.equal(passedEnv, env);
  assert.equal(key, 'session:session-a:secrets');
  assert.equal(envelope.v, 1);
  assert.equal(envelope.kind, 'session-secrets');
  assert.equal(envelope.createdAt, 1234567890000);
  assert.equal(envelope.updatedAt, 1234567890000);
  assert.equal(envelope.cipher, 'AES-256-GCM');
  assert.equal(envelope.keyRef, 'worker_secret:CE_STORAGE_ENVELOPE_KEK');
  assert.equal(envelope.aad, 'ce-session-secrets:v1:session-a:worker_secret:CE_STORAGE_ENVELOPE_KEK');
  assert.equal(typeof envelope.iv, 'string');
  assert.equal(typeof envelope.encryptedSecrets, 'string');
  assert.equal('secrets' in envelope, false);
  assert.equal(JSON.stringify(envelope).includes('sk-test'), false);
  assert.equal(JSON.stringify(envelope).includes('https://rpc.example'), false);
});

test('getSessionSecrets decrypts the current encrypted envelope only for its bound slug', async () => {
  const env = { CE_STORAGE_ENVELOPE_KEK: 'current-session-secrets-kek' };
  const secrets = {
    faucetPrivateKey: '0xprivate',
    nested: { providerKey: 'provider-secret' },
  };
  let storedEnvelope;

  await putSessionSecrets(env, 'session-a', secrets, {
    randomBytes: (length) => new Uint8Array(length).fill(11),
    putKvJson: async (_passedEnv, _key, value) => { storedEnvelope = value; },
  });

  const roundTrip = await getSessionSecrets(env, 'session-a', {
    getKvJson: async () => storedEnvelope,
  });
  assert.deepEqual(roundTrip, secrets);

  await assert.rejects(
    () => getSessionSecrets(env, 'session-b', {
      getKvJson: async () => storedEnvelope,
    }),
    /Encrypted session secrets identity mismatch\./,
  );
});

test('getSessionSecrets uses only the bounded previous KEK fallback window', async () => {
  let storedEnvelope;
  await putSessionSecrets(
    { CE_STORAGE_ENVELOPE_KEK: 'previous-session-secrets-kek' },
    'session-a',
    { openaiKey: 'previous-key-secret' },
    {
      randomBytes: (length) => new Uint8Array(length).fill(13),
      putKvJson: async (_passedEnv, _key, value) => { storedEnvelope = value; },
    },
  );

  const recovered = await getSessionSecrets({
    CE_STORAGE_ENVELOPE_KEK: 'replacement-session-secrets-kek',
    CE_STORAGE_ENVELOPE_PREVIOUS_KEK: 'previous-session-secrets-kek',
  }, 'session-a', {
    getKvJson: async () => storedEnvelope,
  });
  assert.deepEqual(recovered, { openaiKey: 'previous-key-secret' });

  await assert.rejects(
    () => getSessionSecrets({
      CE_STORAGE_ENVELOPE_KEK: 'replacement-session-secrets-kek',
      CE_STORAGE_ENVELOPE_PREVIOUS_KEK: 'unrelated-old-kek',
    }, 'session-a', {
      getKvJson: async () => storedEnvelope,
    }),
    /Session secrets decryption failed\./,
  );
});

test('session secrets encryption fails before persistence without the current KEK', async () => {
  let writes = 0;
  await assert.rejects(
    () => putSessionSecrets({}, 'session-a', { openaiKey: 'must-not-persist' }, {
      putKvJson: async () => { writes += 1; },
    }),
    /CE_STORAGE_ENVELOPE_KEK is missing\./,
  );
  assert.equal(writes, 0);
});

test('getSessionSecrets rejects authenticated-ciphertext tampering', async () => {
  const env = { CE_STORAGE_ENVELOPE_KEK: 'current-session-secrets-kek' };
  let storedEnvelope;
  await putSessionSecrets(env, 'session-a', { openaiKey: 'must-stay-secret' }, {
    randomBytes: (length) => new Uint8Array(length).fill(17),
    putKvJson: async (_passedEnv, _key, value) => { storedEnvelope = value; },
  });
  const last = storedEnvelope.encryptedSecrets.slice(-1);
  const tampered = {
    ...storedEnvelope,
    encryptedSecrets: `${storedEnvelope.encryptedSecrets.slice(0, -1)}${last === 'A' ? 'B' : 'A'}`,
  };

  await assert.rejects(
    () => getSessionSecrets(env, 'session-a', { getKvJson: async () => tampered }),
    /Session secrets decryption failed\./,
  );
});

test('getSessionSecrets fails closed on partial or unknown encrypted envelope formats', async () => {
  for (const malformed of [
    {
      v: 1,
      kind: 'session-secrets',
      cipher: 'AES-256-GCM',
      encryptedSecrets: 'opaque',
    },
    {
      v: 1,
      kind: 'session-secrets',
      cipher: 'future-cipher',
      keyRef: 'future-key',
      aad: 'future-aad',
      iv: 'opaque',
      encryptedSecrets: 'opaque',
    },
    {
      v: 2,
      kind: 'session-secrets',
      cipher: 'future-cipher',
      keyRef: 'future-key',
      aad: 'future-aad',
      iv: 'opaque',
      encryptedSecrets: 'opaque',
    },
  ]) {
    await assert.rejects(
      () => getSessionSecrets({ CE_STORAGE_ENVELOPE_KEK: 'test-kek' }, 'session-a', {
        getKvJson: async () => malformed,
      }),
      /authenticated decryption\./,
    );
  }
});
