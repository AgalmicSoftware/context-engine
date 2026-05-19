'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  isAgentBridgeWorkerUrl,
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
  assert.deepEqual(resolved.ignored, []);
});

test('resolveSessionWorkerUrlEnv ignores legacy WORKER_URL when it points at the agent bridge', () => {
  const resolved = resolveSessionWorkerUrlEnv({
    WORKER_URL: 'https://ce-agent-bridge-worker.agalmic.workers.dev',
  });

  assert.equal(resolved.url, '');
  assert.equal(resolved.source, '');
  assert.deepEqual(resolved.ignored, [{
    key: 'WORKER_URL',
    url: 'https://ce-agent-bridge-worker.agalmic.workers.dev',
    reason: 'agent-bridge-url',
  }]);
});

test('resolveSessionWorkerUrlEnv accepts legacy WORKER_URL when it does not look like agent bridge', () => {
  const resolved = resolveSessionWorkerUrlEnv({
    WORKER_URL: 'https://session-cors-worker.example.test/',
  });

  assert.equal(resolved.url, 'https://session-cors-worker.example.test');
  assert.equal(resolved.source, 'WORKER_URL');
  assert.deepEqual(resolved.ignored, []);
});

test('resolveSessionWorkerUrlEnv can force legacy agent-bridge-looking WORKER_URL for explicit bridge tests', () => {
  const resolved = resolveSessionWorkerUrlEnv({
    WORKER_URL: 'https://ce-agent-bridge-worker.agalmic.workers.dev',
    E2E_ALLOW_WORKER_URL_AGENT_BRIDGE: '1',
  });

  assert.equal(resolved.url, 'https://ce-agent-bridge-worker.agalmic.workers.dev');
  assert.equal(resolved.source, 'WORKER_URL');
  assert.deepEqual(resolved.ignored, []);
});

test('sanitizeSessionWorkerEnv moves accidental legacy bridge URL out of WORKER_URL', () => {
  const env = {
    WORKER_URL: 'https://ce-agent-bridge-worker.agalmic.workers.dev',
  };
  const resolved = sanitizeSessionWorkerEnv(env);

  assert.equal(resolved.url, '');
  assert.equal(env.WORKER_URL, '');
  assert.equal(env.AGENT_BRIDGE_PUBLIC_URL, 'https://ce-agent-bridge-worker.agalmic.workers.dev');
});

test('sanitizeSessionWorkerEnv backfills legacy WORKER_URL from explicit session-worker alias', () => {
  const env = {
    SESSION_WORKER_URL: 'https://session-worker.example.test/path/',
    WORKER_URL: 'https://ce-agent-bridge-worker.agalmic.workers.dev',
  };
  const resolved = sanitizeSessionWorkerEnv(env);

  assert.equal(resolved.url, 'https://session-worker.example.test/path');
  assert.equal(env.SESSION_WORKER_URL, 'https://session-worker.example.test/path/');
  assert.equal(env.WORKER_URL, 'https://session-worker.example.test/path');
  assert.equal(env.AGENT_BRIDGE_PUBLIC_URL, 'https://ce-agent-bridge-worker.agalmic.workers.dev');
});

test('isAgentBridgeWorkerUrl detects configured bridge public URL even without bridge-like host text', () => {
  assert.equal(isAgentBridgeWorkerUrl('https://bridge.example.test', {
    AGENT_BRIDGE_PUBLIC_URL: 'https://bridge.example.test/',
  }), true);
});
