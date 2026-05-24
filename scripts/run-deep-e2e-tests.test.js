'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  isLocalBaseUrl,
  resolveDeepE2eEnv,
} = require('./run-deep-e2e-tests');

test('resolveDeepE2eEnv fills missing session target from the active session artifact', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ce-deep-e2e-'));
  const activeSessionFile = path.join(dir, 'active-ai-test-session.json');
  fs.writeFileSync(activeSessionFile, JSON.stringify({
    slug: 'e2e-active',
    workerUrl: 'https://session-worker.example.test',
  }), 'utf8');

  const result = resolveDeepE2eEnv({}, { activeSessionFile });

  assert.equal(result.env.SESSION_SLUG, 'e2e-active');
  assert.equal(result.env.SESSION_WORKER_URL, 'https://session-worker.example.test');
  assert.deepEqual(result.missing, []);
});

test('resolveDeepE2eEnv preserves explicit env and prefers CE_SESSION_WORKER_BASE_URL for session worker URL', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ce-deep-e2e-'));
  const activeSessionFile = path.join(dir, 'active-ai-test-session.json');
  fs.writeFileSync(activeSessionFile, JSON.stringify({
    slug: 'e2e-active',
    workerUrl: 'https://active-worker.example.test',
  }), 'utf8');

  const result = resolveDeepE2eEnv({
    SESSION_SLUG: 'explicit-session',
    CE_SESSION_WORKER_BASE_URL: 'https://configured-session-worker.example.test',
  }, { activeSessionFile });

  assert.equal(result.env.SESSION_SLUG, 'explicit-session');
  assert.equal(result.env.SESSION_WORKER_URL, 'https://configured-session-worker.example.test');
  assert.deepEqual(result.missing, []);
});

test('isLocalBaseUrl limits automatic app-server startup to local targets', () => {
  assert.equal(isLocalBaseUrl('http://127.0.0.1:3000'), true);
  assert.equal(isLocalBaseUrl('http://localhost:3000'), true);
  assert.equal(isLocalBaseUrl('https://contextengine.xyz'), false);
  assert.equal(isLocalBaseUrl('not a url'), false);
});
