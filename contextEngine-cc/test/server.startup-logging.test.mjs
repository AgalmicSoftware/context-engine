import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { afterEach, describe, it } from 'node:test';
import { once } from 'node:events';
import { startContextEngineServer } from '../server.mjs';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const originalDebug = process.env.CE_CC_DEBUG;
const originalRpId = process.env.RP_ID;
const originalConsole = {
  log: console.log,
  info: console.info,
};

function captureConsole() {
  const calls = {
    log: [],
    info: [],
  };
  console.log = (...args) => calls.log.push(args);
  console.info = (...args) => calls.info.push(args);
  return calls;
}

async function closeServer(server) {
  await new Promise((resolve, reject) => {
    server.close((err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

afterEach(() => {
  if (originalDebug === undefined) {
    delete process.env.CE_CC_DEBUG;
  } else {
    process.env.CE_CC_DEBUG = originalDebug;
  }
  if (originalRpId === undefined) {
    delete process.env.RP_ID;
  } else {
    process.env.RP_ID = originalRpId;
  }
  console.log = originalConsole.log;
  console.info = originalConsole.info;
});

describe('server startup logging', () => {
  it('serves the auth page and keeps startup output to one banner by default', async () => {
    delete process.env.CE_CC_DEBUG;
    delete process.env.RP_ID;
    const calls = captureConsole();
    const server = startContextEngineServer({ host: '127.0.0.1', port: 0 });

    try {
      await once(server, 'listening');
      const address = server.address();
      assert.equal(typeof address, 'object');
      const response = await fetch(`http://127.0.0.1:${address.port}/`);
      const html = await response.text();

      assert.equal(response.status, 200);
      assert.match(html, /<!doctype html>/i);
      assert.equal(calls.info.length, 1);
      assert.equal(calls.log.length, 0);
      assert.match(String(calls.info[0][0]), /Ready\. Sign in with passkey: http:\/\/localhost:/);
    } finally {
      await closeServer(server);
    }
  });

  it('restores verbose startup logs when CE_CC_DEBUG is truthy', async () => {
    process.env.CE_CC_DEBUG = '1';
    process.env.RP_ID = 'example.local';
    const calls = captureConsole();
    const server = startContextEngineServer({ host: '127.0.0.1', port: 0 });

    try {
      await once(server, 'listening');
      assert.equal(calls.info.length, 1);
      assert.equal(calls.log.length, 2);
      assert.match(String(calls.info[0][0]), /Ready\. Sign in with passkey: http:\/\/localhost:/);
      assert.match(String(calls.log[0][0]), new RegExp(`\\[contextEngine-cc\\] v${pkg.version} listening on http://127\\.0\\.0\\.1:`));
      assert.equal(String(calls.log[1][0]), '[contextEngine-cc] RP_ID=example.local');
    } finally {
      await closeServer(server);
    }
  });
});
