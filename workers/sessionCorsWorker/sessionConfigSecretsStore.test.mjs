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

test('getSessionSecrets reads the session secrets KV key without config normalization', async () => {
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

test('putSessionSecrets preserves the secrets payload and writes the secrets KV key', async () => {
  const calls = [];
  const env = { GROUP_KV: {} };
  const secrets = { openaiKey: 'sk-test', customRpcUrl: 'https://rpc.example' };

  await putSessionSecrets(env, 'session-a', secrets, {
    putKvJson: async (passedEnv, key, value) => {
      calls.push(['putKvJson', passedEnv, key, value]);
    },
  });

  assert.deepEqual(calls, [
    ['putKvJson', env, 'session:session-a:secrets', secrets],
  ]);
});
