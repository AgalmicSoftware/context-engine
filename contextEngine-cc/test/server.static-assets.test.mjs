import assert from 'node:assert/strict';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { request } from 'node:http';
import { resolve } from 'node:path';
import { afterEach, describe, it } from 'node:test';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import { startContextEngineServer } from '../server.mjs';

const PROJECT_DIR = fileURLToPath(new URL('..', import.meta.url));

async function closeServer(server) {
  await new Promise((resolve, reject) => {
    server.close((err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

async function rawGet(port, path) {
  return new Promise((resolve, reject) => {
    const req = request(
      {
        host: '127.0.0.1',
        method: 'GET',
        path,
        port,
      },
      (res) => {
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          resolve({
            body: Buffer.concat(chunks).toString('utf8'),
            headers: res.headers,
            status: res.statusCode,
          });
        });
      }
    );
    req.on('error', reject);
    req.end();
  });
}

afterEach(() => {
  delete process.env.CE_CC_DEBUG;
  delete process.env.RP_ID;
});

describe('server static auth assets', () => {
  it('serves the modular auth page assets from public/', async () => {
    const server = startContextEngineServer({ host: '127.0.0.1', port: 0 });

    try {
      await once(server, 'listening');
      const address = server.address();
      assert.equal(typeof address, 'object');

      const [
        indexResponse,
        cssResponse,
        swResponse,
        mainResponse,
        authResponse,
        derivationResponse,
        sessionsResponse,
        apiResponse,
        formResponse,
        uiResponse,
        settingsResponse,
        submitResponse,
        stateResponse,
      ] = await Promise.all([
        fetch(`http://127.0.0.1:${address.port}/`),
        fetch(`http://127.0.0.1:${address.port}/styles.css`),
        fetch(`http://127.0.0.1:${address.port}/sw.js`),
        fetch(`http://127.0.0.1:${address.port}/js/main.mjs`),
        fetch(`http://127.0.0.1:${address.port}/js/auth.mjs`),
        fetch(`http://127.0.0.1:${address.port}/passkey-wallet-derivation.mjs`),
        fetch(`http://127.0.0.1:${address.port}/js/sessions.mjs`),
        fetch(`http://127.0.0.1:${address.port}/js/api.mjs`),
        fetch(`http://127.0.0.1:${address.port}/js/form.mjs`),
        fetch(`http://127.0.0.1:${address.port}/js/ui.mjs`),
        fetch(`http://127.0.0.1:${address.port}/js/settings.mjs`),
        fetch(`http://127.0.0.1:${address.port}/js/submit.mjs`),
        fetch(`http://127.0.0.1:${address.port}/js/state.mjs`),
      ]);

      const [html, css, swJs, mainJs, authJs, derivationJs, sessionsJs, apiJs, formJs, uiJs, settingsJs, submitJs, stateJs] = await Promise.all([
        indexResponse.text(),
        cssResponse.text(),
        swResponse.text(),
        mainResponse.text(),
        authResponse.text(),
        derivationResponse.text(),
        sessionsResponse.text(),
        apiResponse.text(),
        formResponse.text(),
        uiResponse.text(),
        settingsResponse.text(),
        submitResponse.text(),
        stateResponse.text(),
      ]);

      assert.equal(indexResponse.status, 200);
      assert.match(indexResponse.headers.get('content-type') || '', /text\/html/i);
      assert.match(html, /<link rel="stylesheet" href="\/styles\.css">/i);
      assert.match(html, /<script type="module" src="\/js\/main\.mjs"><\/script>/i);
      assert.match(html, /id="set-surfacing-mode"/);
      assert.match(html, /id="set-statusline-question-hints"/);
      assert.match(html, /id="set-ambient-interruptions"/);
      assert.doesNotMatch(html, /<style>/i);
      assert.doesNotMatch(html, /<script type="module">/i);
      assert.doesNotMatch(html, /\sstyle=/i);
      assert.doesNotMatch(html, /\sonclick=/i);

      assert.equal(cssResponse.status, 200);
      assert.match(cssResponse.headers.get('content-type') || '', /text\/css/i);
      assert.match(css, /:root\s*\{/);
      assert.match(css, /\.question-card\s*\{/);
      assert.match(css, /\.is-hidden\s*\{/);

      assert.equal(swResponse.status, 200);
      assert.match(swResponse.headers.get('content-type') || '', /javascript/i);
      assert.match(swJs, /const CACHE_NAME = 'ce-cc-v8';/);
      assert.match(swJs, /keys\.filter\(\(k\) => k !== CACHE_NAME\)/);
      assert.match(swJs, /url\.pathname\.startsWith\('\/api\/'\)/);

      for (const response of [
        mainResponse,
        authResponse,
        derivationResponse,
        sessionsResponse,
        apiResponse,
        formResponse,
        uiResponse,
        settingsResponse,
        submitResponse,
        stateResponse,
      ]) {
        assert.equal(response.status, 200);
        assert.match(response.headers.get('content-type') || '', /application\/javascript/i);
      }

      assert.match(mainJs, /from '\/js\/auth\.mjs'/);
      assert.match(mainJs, /window\.setSubmitMode/);
      assert.match(mainJs, /serviceWorker\.register\('\/sw\.js'\)/);
      assert.match(mainJs, /setAuthCredentials/);
      assert.match(mainJs, /getToken\(\)/);
      assert.doesNotMatch(mainJs, /state\.token/);
      assert.doesNotMatch(mainJs, /state\.privateKey/);
      assert.match(authJs, /derivePasskeyWalletFromCredential/);
      assert.match(authJs, /passkey-wallet-derivation\.mjs/);
      assert.match(derivationJs, /passkey-prf-hkdf-secp256k1-v1/);
      assert.doesNotMatch(derivationJs, /porto/i);
      assert.match(authJs, /buildLocalJwtRequestBody/);
      assert.match(authJs, /signMessageWithAuthWallet/);
      assert.match(authJs, /clearPrivateKey\(\)/);
      assert.match(authJs, /getToken\(\)/);
      assert.doesNotMatch(authJs, /state\.token/);
      assert.doesNotMatch(authJs, /state\.privateKey/);
      assert.match(sessionsJs, /loadSessionOptions/);
      assert.match(apiJs, /apiLocal/);
      assert.match(apiJs, /getAuthHeaders/);
      assert.doesNotMatch(apiJs, /state\.token/);
      assert.match(formJs, /attachQuestionResponseForm/);
      assert.match(uiJs, /setStatus/);
      assert.match(settingsJs, /loadSettingsScreen/);
      assert.match(settingsJs, /questionSurfacingMode/);
      assert.match(settingsJs, /statuslineQuestionHints/);
      assert.match(submitJs, /submitAllResponses/);
      assert.match(stateJs, /export const state/);
      assert.match(stateJs, /let token = null;/);
      assert.match(stateJs, /let privateKey = null;/);
      assert.match(stateJs, /export function setAuthCredentials/);
      assert.match(stateJs, /export function getToken/);
      assert.match(stateJs, /export function getAuthHeaders/);
      assert.match(stateJs, /export async function signMessageWithAuthWallet/);
      assert.match(stateJs, /privateKey = null;/);
      assert.doesNotMatch(stateJs, /token:\s*null/);
      assert.doesNotMatch(stateJs, /privateKey:\s*null/);
    } finally {
      await closeServer(server);
    }
  });

  it('serves nested SPA fallback routes with root-relative asset URLs', async () => {
    const server = startContextEngineServer({ host: '127.0.0.1', port: 0 });

    try {
      await once(server, 'listening');
      const address = server.address();
      assert.equal(typeof address, 'object');

      const response = await fetch(`http://127.0.0.1:${address.port}/foo/bar`);
      const html = await response.text();

      assert.equal(response.status, 200);
      assert.match(response.headers.get('content-type') || '', /text\/html/i);
      assert.match(html, /<link rel="stylesheet" href="\/styles\.css">/i);
      assert.match(html, /<script type="module" src="\/js\/main\.mjs"><\/script>/i);
    } finally {
      await closeServer(server);
    }
  });

  it('rejects sibling-prefix paths outside public/', async () => {
    const siblingDirName = `public-static-test-${process.pid}-${Date.now()}`;
    const siblingDir = resolve(PROJECT_DIR, siblingDirName);
    mkdirSync(siblingDir, { recursive: true });
    writeFileSync(resolve(siblingDir, 'blocked.html'), 'outside-public');

    const server = startContextEngineServer({ host: '127.0.0.1', port: 0 });

    try {
      await once(server, 'listening');
      const address = server.address();
      assert.equal(typeof address, 'object');

      const response = await rawGet(address.port, `/../${siblingDirName}/blocked.html`);

      assert.equal(response.status, 403);
      assert.equal(response.body, 'Forbidden');
    } finally {
      await closeServer(server);
      rmSync(siblingDir, { force: true, recursive: true });
    }
  });

  it('serves public files whose names begin with ".."', async () => {
    const leadingDotDotFile = resolve(PROJECT_DIR, 'public', '..foo.html');
    writeFileSync(leadingDotDotFile, 'inside-public');

    const server = startContextEngineServer({ host: '127.0.0.1', port: 0 });

    try {
      await once(server, 'listening');
      const address = server.address();
      assert.equal(typeof address, 'object');

      const response = await rawGet(address.port, '/..foo.html');

      assert.equal(response.status, 200);
      assert.match(response.headers['content-type'] || '', /text\/html/i);
      assert.equal(response.body, 'inside-public');
    } finally {
      await closeServer(server);
      rmSync(leadingDotDotFile, { force: true });
    }
  });
});
