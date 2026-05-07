import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import test from 'node:test';
import {
  formatAlreadyRunningMessage,
  formatPortInUseMessage,
  probeContextEngineServer,
} from '../lib/startup.mjs';
import { runStartCommand } from '../start.mjs';

async function withServer(handler, run) {
  const server = createServer(handler);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const address = server.address();
    assert.equal(typeof address, 'object');
    return await run(address.port);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }
}

test('probeContextEngineServer recognizes the CE-CC auth page', async () => {
  await withServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end('<!doctype html><title>Context Engine CC</title>');
  }, async (port) => {
    const detected = await probeContextEngineServer({ host: '127.0.0.1', port });
    assert.equal(detected, true);
  });
});

test('probeContextEngineServer ignores unrelated listeners on the same port', async () => {
  await withServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end('<!doctype html><title>Totally Different App</title>');
  }, async (port) => {
    const detected = await probeContextEngineServer({ host: '127.0.0.1', port });
    assert.equal(detected, false);
  });
});

test('runStartCommand exits cleanly when CE-CC is already running', async () => {
  const calls = [];
  let startCalls = 0;
  const result = await runStartCommand({
    host: '127.0.0.1',
    port: 7391,
    probe: async () => true,
    startServer: async () => {
      startCalls += 1;
    },
    logInfo: (message) => calls.push(String(message)),
  });

  assert.equal(result.status, 'already-running');
  assert.equal(startCalls, 0);
  assert.deepEqual(calls, [formatAlreadyRunningMessage({ port: 7391 })]);
});

test('runStartCommand treats an EADDRINUSE race as already-running when CE-CC answers the retry probe', async () => {
  const calls = [];
  let probeCalls = 0;
  const result = await runStartCommand({
    host: '127.0.0.1',
    port: 7391,
    probe: async () => {
      probeCalls += 1;
      return probeCalls > 1;
    },
    startServer: async () => {
      const error = new Error('listen EADDRINUSE');
      error.code = 'EADDRINUSE';
      throw error;
    },
    logInfo: (message) => calls.push(String(message)),
  });

  assert.equal(result.status, 'already-running');
  assert.equal(probeCalls, 2);
  assert.deepEqual(calls, [formatAlreadyRunningMessage({ port: 7391 })]);
});

test('formatPortInUseMessage points operators at the passkey sign-in URL', () => {
  assert.equal(
    formatPortInUseMessage({ port: 7391 }),
    '[contextEngine-cc] Port 7391 is already in use by another process. If Context Engine CC is already running, open http://localhost:7391.',
  );
});
