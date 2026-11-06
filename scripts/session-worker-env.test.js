'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  resolveSessionWorkerUrlEnv,
  sanitizeSessionWorkerEnv,
} = require('./lib/session-worker-env');

test('resolveSessionWorkerUrlEnv prefers explicit session-worker aliases over legacy WORKER_URL', () => {
  const resolved = resolveSessionWorkerUrlEnv({
    SESSION_WORKER_URL: 'https://session-worker.example.test/',
    WORKER_URL: 'https://legacy-worker.example.test/',
  });

  assert.equal(resolved.url, 'https://session-worker.example.test');
  assert.equal(resolved.source, 'SESSION_WORKER_URL');
});

test('resolveSessionWorkerUrlEnv falls back to legacy WORKER_URL', () => {
  const resolved = resolveSessionWorkerUrlEnv({
    WORKER_URL: 'https://session-cors-worker.example.test/',
  });

  assert.equal(resolved.url, 'https://session-cors-worker.example.test');
  assert.equal(resolved.source, 'WORKER_URL');
});

test('sanitizeSessionWorkerEnv backfills legacy WORKER_URL from explicit session-worker alias', () => {
  const env = {
    SESSION_WORKER_URL: 'https://session-worker.example.test/path/',
    WORKER_URL: 'https://legacy-worker.example.test',
  };
  const resolved = sanitizeSessionWorkerEnv(env);

  assert.equal(resolved.url, 'https://session-worker.example.test/path');
  assert.equal(env.SESSION_WORKER_URL, 'https://session-worker.example.test/path/');
  assert.equal(env.WORKER_URL, 'https://session-worker.example.test/path');
});

test('sanitizeSessionWorkerEnv backfills SESSION_WORKER_URL from legacy WORKER_URL', () => {
  const env = { WORKER_URL: 'https://session-cors-worker.example.test/' };
  const resolved = sanitizeSessionWorkerEnv(env);

  assert.equal(resolved.source, 'WORKER_URL');
  assert.equal(env.SESSION_WORKER_URL, 'https://session-cors-worker.example.test');
  assert.equal(env.WORKER_URL, 'https://session-cors-worker.example.test/');
});
