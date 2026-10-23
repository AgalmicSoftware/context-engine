import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { buildSync } from 'esbuild';
import { ethers } from 'ethers';
import sessionCorsWorker from '../../workers/sessionCorsWorker/worker.js';
import { installSessionCoordinatorBinding } from '../helpers/sessionCorsWorkerTestUtils.mjs';
import { createWorkerClient } from '../../mcp/lib/workerClient.mjs';

const require = createRequire(import.meta.url);

// The hosted envelope template, compiled by the client's own profile compiler
// so a hand-written twin cannot drift from what the wizard deploys.
const compileHostedEnvelopePreset = () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ce-protected-answers-'));
  try {
    const outfile = path.join(tempDir, 'sessionModeProfile.cjs');
    buildSync({
      entryPoints: [fileURLToPath(new URL('../../client/src/utilities/session/sessionModeProfile.ts', import.meta.url))],
      outfile,
      bundle: true,
      format: 'cjs',
      platform: 'node',
      target: 'node20',
      logLevel: 'silent',
    });
    const { SESSION_MODE_PRESET_IDS, cloneSessionModePreset, compileSessionModeProfile } = require(outfile);
    const sessionModeProfile = cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE);
    return { sessionModeProfile, storageProfile: compileSessionModeProfile(sessionModeProfile).storageProfile };
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
};

const WORKER_ORIGIN = 'https://protected-answers.example.workers.dev';
const APP_ORIGIN = 'https://contextengine.sh';
const SLUG = 'protected-answers';
const SESSION_ID = `0x${'7a'.repeat(16)}`;

const memoryKv = (seed = {}) => {
  const store = new Map(Object.entries(seed));
  return {
    get: async (key) => (store.has(key) ? store.get(key) : null),
    put: async (key, value) => {
      store.set(key, value);
    },
    delete: async (key) => {
      store.delete(key);
    },
    list: async ({ prefix = '', cursor = '', limit = 1000 } = {}) => {
      const names = [...store.keys()].filter((key) => key.startsWith(prefix)).sort();
      const start = cursor ? Number(cursor) : 0;
      const keys = names.slice(start, start + limit).map((name) => ({ name }));
      const done = start + keys.length >= names.length;
      return { keys, list_complete: done, cursor: done ? '' : String(start + keys.length) };
    },
  };
};

const workerFetch = (env, onRequest = () => {}) => async (url, init = {}) => {
  onRequest(init);
  const request = new Request(url, { method: init.method || 'GET', headers: init.headers, body: init.body });
  return sessionCorsWorker.fetch(request, env, { waitUntil: () => {}, passThroughOnException: () => {} });
};

test('protected hosted answers reach only their author and the admin on every read route', async () => {
  const { sessionModeProfile, storageProfile } = compileHostedEnvelopePreset();
  assert.equal(sessionModeProfile.encryption.mode, 'worker_envelope');
  const admin = ethers.Wallet.createRandom();
  const config = {
    slug: SLUG,
    sessionId: SESSION_ID,
    sessionName: 'Protected answers',
    sessionInfo: 'Answers stay with their author and the admin.',
    allowOrigins: [APP_ORIGIN],
    // The deploy helper records the hosted session's admin here.
    adminAddress: admin.address,
    workerAuthority: { version: 1, participantScopes: ['ai', 'transcribe', 'storage', 'groups', 'fetch'] },
    sessionModeProfile,
    storageProfile,
  };
  const env = installSessionCoordinatorBinding({
    GROUP_KV: memoryKv({ [`session:${SLUG}:config`]: JSON.stringify(config) }),
    CE_STORAGE_INDEX_KV: memoryKv(),
    TOKEN_HMAC_SECRET: 'protected-answers-token-secret',
    CE_STORAGE_ENVELOPE_KEK: 'protected-answers-envelope-secret',
    BOOTSTRAP_ADMIN_ADDRESS: admin.address,
  });

  const personas = {};
  const signIn = async (name, wallet) => {
    const persona = { name, authorization: '' };
    const client = createWorkerClient({
      workerOrigin: WORKER_ORIGIN,
      slug: SLUG,
      trustedOrigins: [APP_ORIGIN],
      wallet,
      fetchImpl: workerFetch(env, (init) => {
        persona.authorization ||= init.headers?.Authorization || '';
      }),
    });
    persona.client = client;
    personas[name] = persona;
    return persona;
  };
  const alice = await signIn('alice', ethers.Wallet.createRandom());
  const bob = await signIn('bob', ethers.Wallet.createRandom());
  await signIn('admin', admin);
  personas.anonymous = { name: 'anonymous', authorization: '' };

  const answers = {};
  for (const persona of [alice, bob]) {
    const marker = `protected-answer-${persona.name}-${Math.random().toString(36).slice(2)}`;
    // eslint-disable-next-line no-await-in-loop
    const ref = await persona.client.upload({
      resource: 'responses',
      data: JSON.stringify({ questionID: 'q-protected', sessionSlug: SLUG, sessionId: SESSION_ID, answer: { value: marker } }),
    });
    assert.ok(ref.id, `${persona.name} stored an answer`);
    answers[persona.name] = { id: ref.id, marker };
  }
  await personas.admin.client.request('/storage/list?resource=responses', { auth: true });
  for (const name of ['alice', 'bob', 'admin']) assert.match(personas[name].authorization, /^Bearer /);

  // Every read surface that could carry an answer, including denial bodies.
  const routes = [
    '/storage/list?resource=responses',
    `/storage/read?id=${encodeURIComponent(answers.alice.id)}`,
    `/storage/read?id=${encodeURIComponent(answers.bob.id)}`,
    '/storage/export-envelopes?resource=responses',
    '/results-analysis/artifact',
    '/resource-presence',
    `/session-config?slug=${SLUG}`,
    '/agent/interview-catalog',
    '/api/agent/questions',
  ];
  const mayRead = { anonymous: [], alice: ['alice'], bob: ['bob'], admin: ['alice', 'bob'] };
  const call = async (persona, route) => {
    const response = await workerFetch(env)(`${WORKER_ORIGIN}${route}`, {
      headers: {
        Origin: APP_ORIGIN,
        'X-Session-Slug': SLUG,
        'X-Group-Slug': SLUG,
        ...(persona.authorization ? { Authorization: persona.authorization } : {}),
      },
    });
    return { status: response.status, text: await response.text() };
  };

  for (const persona of Object.values(personas)) {
    for (const route of routes) {
      // eslint-disable-next-line no-await-in-loop
      const { status, text } = await call(persona, route);
      for (const [author, { marker }] of Object.entries(answers)) {
        if (mayRead[persona.name].includes(author) && route.startsWith('/storage/read')) continue;
        assert.equal(text.includes(marker), false, `${persona.name} saw ${author}'s answer through ${route} (${status})`);
      }
    }
    for (const [author, { id, marker }] of Object.entries(answers)) {
      // eslint-disable-next-line no-await-in-loop
      const { status, text } = await call(persona, `/storage/read?id=${encodeURIComponent(id)}`);
      if (mayRead[persona.name].includes(author)) {
        assert.equal(status, 200, `${persona.name} reads ${author}'s answer`);
        assert.equal(text.includes(marker), true, `${persona.name} decrypts ${author}'s answer`);
      } else {
        assert.ok(status === 401 || status === 403, `${persona.name} is refused ${author}'s answer (${status})`);
      }
    }
  }

  // The admin export is ciphertext only.
  const exported = await call(personas.admin, '/storage/export-envelopes?resource=responses');
  assert.equal(exported.status, 200);
  assert.match(exported.text, /ciphertextBase64url/);
});
