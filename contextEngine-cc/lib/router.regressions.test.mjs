import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
} from 'fs';
import { resolve, dirname } from 'path';
import { tmpdir } from 'os';
import { fileURLToPath, pathToFileURL } from 'url';
import { ethers } from 'ethers';
import { decryptFromFile, isEncryptedFile } from './keyEncryption.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROUTER_MODULE_PATH = resolve(__dirname, 'router.mjs');
const DEFAULT_TEST_WALLET = new ethers.Wallet('0x8b3a350cf5c34c9194ca3a545d6915c19f9b8b35c50a6481d948e57808b43711');
const DEFAULT_TEST_WALLET_ADDRESS = DEFAULT_TEST_WALLET.address.toLowerCase();

function importFresh(modulePath) {
  const ts = `${Date.now()}-${Math.random()}`;
  return import(`${pathToFileURL(modulePath).href}?t=${ts}`);
}

function makeMockRes() {
  return {
    statusCode: 0,
    headers: {},
    body: '',
    writeHead(statusCode, headers) {
      this.statusCode = statusCode;
      this.headers = headers || {};
    },
    end(chunk) {
      this.body += chunk ? String(chunk) : '';
    },
  };
}

function makeLoopbackReq(headers = {}) {
  return {
    headers: {
      host: 'localhost:7391',
      ...headers,
    },
    socket: {
      remoteAddress: '127.0.0.1',
    },
  };
}

function assertSecureMode(filePath) {
  if (process.platform === 'win32') return;
  assert.equal(statSync(filePath).mode & 0o777, 0o600);
}

function buildLocalJwtRequestBody(walletAddress, privateKey = null) {
  if (privateKey) {
    return { walletAddress, privateKey };
  }
  if (String(walletAddress || '').toLowerCase() === DEFAULT_TEST_WALLET_ADDRESS) {
    return { walletAddress, privateKey: DEFAULT_TEST_WALLET.privateKey };
  }
  throw new Error(`privateKey required for wallet ${walletAddress}`);
}

async function issueLocalJwt(handleRoute, walletAddress, privateKey = null) {
  const res = makeMockRes();
  await handleRoute(
    makeLoopbackReq(),
    res,
    {
      url: new URL('http://localhost:7391/api/auth/local-jwt'),
      method: 'POST',
      body: buildLocalJwtRequestBody(walletAddress, privateKey),
    },
  );
  assert.equal(res.statusCode, 200);
  const token = String(JSON.parse(res.body || '{}').token || '');
  assert.equal(token.length > 0, true);
  return token;
}

async function flushBackgroundWork() {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

function buildWorkerToken(payload) {
  return `${Buffer.from(JSON.stringify(payload)).toString('base64url')}.sig`;
}

function enableDebugLogging() {
  const previous = process.env.CE_CC_DEBUG;
  process.env.CE_CC_DEBUG = '1';
  return () => {
    if (previous == null) delete process.env.CE_CC_DEBUG;
    else process.env.CE_CC_DEBUG = previous;
  };
}

test('local JWT issuance requires privateKey proof of wallet ownership', async () => {
  const { handleRoute } = await importFresh(ROUTER_MODULE_PATH);
  const res = makeMockRes();
  await handleRoute(
    makeLoopbackReq(),
    res,
    {
      url: new URL('http://localhost:7391/api/auth/local-jwt'),
      method: 'POST',
      body: { walletAddress: DEFAULT_TEST_WALLET_ADDRESS },
    },
  );

  assert.equal(res.statusCode, 400);
  assert.deepEqual(
    JSON.parse(res.body || '{}'),
    { error: 'privateKey is required to prove wallet ownership.' },
  );
});

test('local JWT issuance respects autoCli=false and skips token auto-install', async () => {
  const root = mkdtempSync(resolve(tmpdir(), 'ce-router-autocli-'));
  const dataDir = resolve(root, 'data');
  const hookStateDir = resolve(root, 'hook-state');
  mkdirSync(dataDir, { recursive: true });
  mkdirSync(hookStateDir, { recursive: true });
  writeFileSync(
    resolve(hookStateDir, 'config.json'),
    JSON.stringify({ serverUrl: 'http://localhost:7391', autoCli: false }, null, 2),
  );

  const prevDataDir = process.env.CE_CC_DATA_DIR;
  const prevHookStateDir = process.env.CE_CC_HOOK_STATE_DIR;
  process.env.CE_CC_DATA_DIR = dataDir;
  process.env.CE_CC_HOOK_STATE_DIR = hookStateDir;

  try {
    const { handleRoute } = await importFresh(ROUTER_MODULE_PATH);
    const res = makeMockRes();
    await handleRoute(
      makeLoopbackReq(),
      res,
      {
        url: new URL('http://localhost:7391/api/auth/local-jwt'),
        method: 'POST',
        body: buildLocalJwtRequestBody(DEFAULT_TEST_WALLET_ADDRESS),
      },
    );

    assert.equal(res.statusCode, 200);
    const payload = JSON.parse(res.body || '{}');
    assert.equal(payload.autoInstallConfigured, false);
    assert.equal(payload.autoInstalled, false);
    assert.equal(
      existsSync(resolve(hookStateDir, 'token.jwt')),
      false,
      'token.jwt should not be written when autoCli is disabled',
    );
  } finally {
    if (prevDataDir == null) delete process.env.CE_CC_DATA_DIR;
    else process.env.CE_CC_DATA_DIR = prevDataDir;
    if (prevHookStateDir == null) delete process.env.CE_CC_HOOK_STATE_DIR;
    else process.env.CE_CC_HOOK_STATE_DIR = prevHookStateDir;
  }
});

test('local JWT issuance reports the installed token path when auto-install succeeds', async () => {
  const root = mkdtempSync(resolve(tmpdir(), 'ce-router-autocli-success-'));
  const dataDir = resolve(root, 'data');
  const hookStateDir = resolve(root, 'hook-state');
  mkdirSync(dataDir, { recursive: true });
  mkdirSync(hookStateDir, { recursive: true });

  const prevDataDir = process.env.CE_CC_DATA_DIR;
  const prevHookStateDir = process.env.CE_CC_HOOK_STATE_DIR;
  process.env.CE_CC_DATA_DIR = dataDir;
  process.env.CE_CC_HOOK_STATE_DIR = hookStateDir;

  try {
    const { handleRoute } = await importFresh(ROUTER_MODULE_PATH);
    const res = makeMockRes();
    await handleRoute(
      makeLoopbackReq(),
      res,
      {
        url: new URL('http://localhost:7391/api/auth/local-jwt'),
        method: 'POST',
        body: buildLocalJwtRequestBody(DEFAULT_TEST_WALLET_ADDRESS),
      },
    );

    assert.equal(res.statusCode, 200);
    const payload = JSON.parse(res.body || '{}');
    assert.equal(payload.autoInstallConfigured, true);
    assert.equal(payload.autoInstalled, true);
    assert.equal(payload.autoInstallError, null);
    assert.equal(payload.autoInstallPath, resolve(hookStateDir, 'token.jwt'));
    assert.equal(
      readFileSync(resolve(hookStateDir, 'token.jwt'), 'utf8').trim().length > 0,
      true,
    );
  } finally {
    if (prevDataDir == null) delete process.env.CE_CC_DATA_DIR;
    else process.env.CE_CC_DATA_DIR = prevDataDir;
    if (prevHookStateDir == null) delete process.env.CE_CC_HOOK_STATE_DIR;
    else process.env.CE_CC_HOOK_STATE_DIR = prevHookStateDir;
  }
});

test('local JWT issuance cleans up old credentials when stored wallet key mismatches authenticated address', async () => {
  const root = mkdtempSync(resolve(tmpdir(), 'ce-router-auth-wallet-warn-'));
  const dataDir = resolve(root, 'data');
  const hookStateDir = resolve(root, 'hook-state');
  const storedWallet = new ethers.Wallet('0x59c6995e998f97a5a0044976f84ce7de5d9d7f17b2f6a6a5f76f8864c8ad88f5');
  const responsesDir = resolve(dataDir, 'responses');
  const workerTokensDir = resolve(dataDir, 'worker-tokens');
  const confirmedSubmissionsDir = resolve(dataDir, 'confirmed-submissions');
  mkdirSync(dataDir, { recursive: true });
  mkdirSync(hookStateDir, { recursive: true });
  mkdirSync(resolve(responsesDir, 'alpha'), { recursive: true });
  mkdirSync(workerTokensDir, { recursive: true });
  mkdirSync(resolve(confirmedSubmissionsDir, 'alpha'), { recursive: true });
  writeFileSync(
    resolve(dataDir, 'wallet.key'),
    storedWallet.privateKey,
  );
  writeFileSync(resolve(responsesDir, 'alpha', 'pending.json'), JSON.stringify({ qid: 'q1' }, null, 2));
  writeFileSync(resolve(workerTokensDir, 'alpha.jwt'), 'worker-token-value');
  writeFileSync(
    resolve(confirmedSubmissionsDir, 'alpha', `${storedWallet.address.toLowerCase()}.json`),
    JSON.stringify({ wallet: storedWallet.address.toLowerCase(), questions: { q1: { questionId: 'q1' } } }, null, 2),
  );

  const prevDataDir = process.env.CE_CC_DATA_DIR;
  const prevHookStateDir = process.env.CE_CC_HOOK_STATE_DIR;
  process.env.CE_CC_DATA_DIR = dataDir;
  process.env.CE_CC_HOOK_STATE_DIR = hookStateDir;
  const restoreDebugLogging = enableDebugLogging();

  const logs = [];
  const warnings = [];
  const originalLog = console.log;
  const originalWarn = console.warn;
  console.log = (...args) => logs.push(args.map((value) => String(value)).join(' '));
  console.warn = (...args) => warnings.push(args.map((value) => String(value)).join(' '));

  try {
    const { handleRoute } = await importFresh(ROUTER_MODULE_PATH);
    const res = makeMockRes();
    const walletAddress = DEFAULT_TEST_WALLET_ADDRESS;
    await handleRoute(
      makeLoopbackReq(),
      res,
      {
        url: new URL('http://localhost:7391/api/auth/local-jwt'),
        method: 'POST',
        body: buildLocalJwtRequestBody(walletAddress),
      },
    );

    assert.equal(res.statusCode, 200);
    assert.equal(
      logs.some((entry) => entry.includes(`[auth] Cleaned up old credentials for wallet switch: ${storedWallet.address.toLowerCase().slice(0, 10)} → ${walletAddress.slice(0, 10)}`)),
      true,
    );
    assert.deepEqual(readdirSync(responsesDir), []);
    assert.deepEqual(readdirSync(workerTokensDir), []);
    assert.equal(existsSync(confirmedSubmissionsDir), false);
    assert.equal(warnings.length, 0);
  } finally {
    console.log = originalLog;
    console.warn = originalWarn;
    restoreDebugLogging();
    if (prevDataDir == null) delete process.env.CE_CC_DATA_DIR;
    else process.env.CE_CC_DATA_DIR = prevDataDir;
    if (prevHookStateDir == null) delete process.env.CE_CC_HOOK_STATE_DIR;
    else process.env.CE_CC_HOOK_STATE_DIR = prevHookStateDir;
  }
});

test('local JWT issuance stores the new private key after cleaning old wallet credentials', async () => {
  const root = mkdtempSync(resolve(tmpdir(), 'ce-router-auth-wallet-switch-store-'));
  const dataDir = resolve(root, 'data');
  const hookStateDir = resolve(root, 'hook-state');
  const oldWallet = new ethers.Wallet('0x59c6995e998f97a5a0044976f84ce7de5d9d7f17b2f6a6a5f76f8864c8ad88f5');
  const newWallet = ethers.Wallet.createRandom();
  const responsesDir = resolve(dataDir, 'responses');
  const workerTokensDir = resolve(dataDir, 'worker-tokens');
  const confirmedSubmissionsDir = resolve(dataDir, 'confirmed-submissions');
  mkdirSync(dataDir, { recursive: true });
  mkdirSync(hookStateDir, { recursive: true });
  mkdirSync(resolve(responsesDir, 'beta'), { recursive: true });
  mkdirSync(workerTokensDir, { recursive: true });
  mkdirSync(resolve(confirmedSubmissionsDir, 'beta'), { recursive: true });
  writeFileSync(resolve(dataDir, 'wallet.key'), oldWallet.privateKey);
  writeFileSync(resolve(responsesDir, 'beta', 'pending.json'), JSON.stringify({ qid: 'q2' }, null, 2));
  writeFileSync(resolve(workerTokensDir, 'beta.jwt'), 'old-worker-token');
  writeFileSync(
    resolve(confirmedSubmissionsDir, 'beta', `${oldWallet.address.toLowerCase()}.json`),
    JSON.stringify({ wallet: oldWallet.address.toLowerCase(), questions: { q2: { questionId: 'q2' } } }, null, 2),
  );

  const prevDataDir = process.env.CE_CC_DATA_DIR;
  const prevHookStateDir = process.env.CE_CC_HOOK_STATE_DIR;
  process.env.CE_CC_DATA_DIR = dataDir;
  process.env.CE_CC_HOOK_STATE_DIR = hookStateDir;
  const restoreDebugLogging = enableDebugLogging();

  const logs = [];
  const originalLog = console.log;
  console.log = (...args) => logs.push(args.map((value) => String(value)).join(' '));

  try {
    const { handleRoute } = await importFresh(ROUTER_MODULE_PATH);
    const res = makeMockRes();
    await handleRoute(
      makeLoopbackReq(),
      res,
      {
        url: new URL('http://localhost:7391/api/auth/local-jwt'),
        method: 'POST',
        body: {
          walletAddress: newWallet.address,
          privateKey: newWallet.privateKey,
        },
      },
    );

    assert.equal(res.statusCode, 200);
    assert.equal(JSON.parse(res.body || '{}').privateKeyStored, true);
    assert.equal(isEncryptedFile(resolve(dataDir, 'wallet.key')), true);
    assert.equal(
      decryptFromFile(resolve(dataDir, 'wallet.key'))?.toString('utf8'),
      newWallet.privateKey,
    );
    assertSecureMode(resolve(dataDir, 'wallet.key'));
    assertSecureMode(resolve(hookStateDir, 'token.jwt'));
    assert.equal(
      logs.some((entry) => entry.includes(`[auth] Cleaned up old credentials for wallet switch: ${oldWallet.address.toLowerCase().slice(0, 10)} → ${newWallet.address.toLowerCase().slice(0, 10)}`)),
      true,
    );
    assert.deepEqual(readdirSync(responsesDir), []);
    assert.deepEqual(readdirSync(workerTokensDir), []);
    assert.equal(existsSync(confirmedSubmissionsDir), false);
  } finally {
    console.log = originalLog;
    restoreDebugLogging();
    if (prevDataDir == null) delete process.env.CE_CC_DATA_DIR;
    else process.env.CE_CC_DATA_DIR = prevDataDir;
    if (prevHookStateDir == null) delete process.env.CE_CC_HOOK_STATE_DIR;
    else process.env.CE_CC_HOOK_STATE_DIR = prevHookStateDir;
  }
});

test('local JWT issuance auto-faucets in background for the first selected session with a worker token', async () => {
  const root = mkdtempSync(resolve(tmpdir(), 'ce-router-auth-auto-faucet-'));
  const dataDir = resolve(root, 'data');
  const hookStateDir = resolve(root, 'hook-state');
  const workerTokensDir = resolve(dataDir, 'worker-tokens');
  const walletAddress = DEFAULT_TEST_WALLET_ADDRESS;
  const betaWorkerToken = buildWorkerToken({
    sub: walletAddress,
    slug: 'beta',
    exp: Math.floor(Date.now() / 1000) + 600,
  });

  mkdirSync(workerTokensDir, { recursive: true });
  mkdirSync(hookStateDir, { recursive: true });
  writeFileSync(
    resolve(hookStateDir, 'config.json'),
    JSON.stringify({
      serverUrl: 'http://localhost:7391',
      selectedSessions: ['alpha', 'beta'],
    }, null, 2),
  );
  writeFileSync(resolve(workerTokensDir, 'beta.jwt'), betaWorkerToken);

  const prevDataDir = process.env.CE_CC_DATA_DIR;
  const prevHookStateDir = process.env.CE_CC_HOOK_STATE_DIR;
  process.env.CE_CC_DATA_DIR = dataDir;
  process.env.CE_CC_HOOK_STATE_DIR = hookStateDir;
  const restoreDebugLogging = enableDebugLogging();

  const logs = [];
  const originalLog = console.log;
  console.log = (...args) => logs.push(args.map((value) => String(value)).join(' '));

  try {
    const { handleRoute } = await importFresh(ROUTER_MODULE_PATH);
    let requestedSlug = null;
    let fetchArgs = null;
    let resolveFetch;
    const fetchGate = new Promise((resolve) => {
      resolveFetch = resolve;
    });
    const res = makeMockRes();

    const routePromise = handleRoute(
      makeLoopbackReq(),
      res,
      {
        url: new URL('http://localhost:7391/api/auth/local-jwt'),
        method: 'POST',
        body: buildLocalJwtRequestBody(walletAddress),
      },
      {
        getFaucetProvider: () => ({
          getBalance: async () => ethers.utils.parseEther('0.0005'),
        }),
        getCorsWorkerUrl: async (slug) => {
          requestedSlug = slug;
          return 'https://worker.example.com/base/';
        },
        fetch: async (input, init) => {
          fetchArgs = { input, init };
          return fetchGate;
        },
      },
    );

    const routeResult = await Promise.race([
      routePromise.then(() => 'route'),
      new Promise((resolve) => setTimeout(() => resolve('timeout'), 50)),
    ]);

    assert.equal(routeResult, 'route');
    assert.equal(res.statusCode, 200);
    await flushBackgroundWork();
    assert.equal(requestedSlug, 'beta');
    assert.equal(fetchArgs.input, 'https://worker.example.com/base/beta');

    resolveFetch(new Response(JSON.stringify({ amountEth: '0.05', txHash: '0xabc123' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));
    await flushBackgroundWork();

    assert.equal(fetchArgs.init.method, 'POST');
    assert.equal(fetchArgs.init.headers.Authorization, `Bearer ${betaWorkerToken}`);
    assert.deepEqual(
      JSON.parse(fetchArgs.init.body),
      { action: 'request_test_eth', to: walletAddress.toLowerCase() },
    );
    assert.equal(
      logs.some((entry) => entry.includes(`[auth] Auto-faucet: sent 0.05 ETH to ${walletAddress.toLowerCase()} (tx: 0xabc123)`)),
      true,
    );
  } finally {
    console.log = originalLog;
    restoreDebugLogging();
    if (prevDataDir == null) delete process.env.CE_CC_DATA_DIR;
    else process.env.CE_CC_DATA_DIR = prevDataDir;
    if (prevHookStateDir == null) delete process.env.CE_CC_HOOK_STATE_DIR;
    else process.env.CE_CC_HOOK_STATE_DIR = prevHookStateDir;
  }
});

test('local JWT issuance skips auto-faucet when wallet balance is above threshold', async () => {
  const root = mkdtempSync(resolve(tmpdir(), 'ce-router-auth-auto-faucet-threshold-'));
  const dataDir = resolve(root, 'data');
  const hookStateDir = resolve(root, 'hook-state');
  const workerTokensDir = resolve(dataDir, 'worker-tokens');
  const walletAddress = DEFAULT_TEST_WALLET_ADDRESS;
  const alphaWorkerToken = buildWorkerToken({
    sub: walletAddress,
    slug: 'alpha',
    exp: Math.floor(Date.now() / 1000) + 600,
  });

  mkdirSync(workerTokensDir, { recursive: true });
  mkdirSync(hookStateDir, { recursive: true });
  writeFileSync(
    resolve(hookStateDir, 'config.json'),
    JSON.stringify({
      serverUrl: 'http://localhost:7391',
      selectedSessions: ['alpha'],
    }, null, 2),
  );
  writeFileSync(resolve(workerTokensDir, 'alpha.jwt'), alphaWorkerToken);

  const prevDataDir = process.env.CE_CC_DATA_DIR;
  const prevHookStateDir = process.env.CE_CC_HOOK_STATE_DIR;
  process.env.CE_CC_DATA_DIR = dataDir;
  process.env.CE_CC_HOOK_STATE_DIR = hookStateDir;
  const restoreDebugLogging = enableDebugLogging();

  const logs = [];
  const originalLog = console.log;
  console.log = (...args) => logs.push(args.map((value) => String(value)).join(' '));

  try {
    const { handleRoute } = await importFresh(ROUTER_MODULE_PATH);
    let fetchCalled = false;
    const res = makeMockRes();
    await handleRoute(
      makeLoopbackReq(),
      res,
      {
        url: new URL('http://localhost:7391/api/auth/local-jwt'),
        method: 'POST',
        body: buildLocalJwtRequestBody(walletAddress),
      },
      {
        getFaucetProvider: () => ({
          getBalance: async () => ethers.utils.parseEther('0.0011'),
        }),
        fetch: async () => {
          fetchCalled = true;
          return new Response('{}', {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        },
      },
    );

    await flushBackgroundWork();

    assert.equal(res.statusCode, 200);
    assert.equal(fetchCalled, false);
    assert.equal(
      logs.some((entry) => entry.includes('[auth] Auto-faucet: wallet above threshold (0.0011 ETH)')),
      true,
    );
  } finally {
    console.log = originalLog;
    restoreDebugLogging();
    if (prevDataDir == null) delete process.env.CE_CC_DATA_DIR;
    else process.env.CE_CC_DATA_DIR = prevDataDir;
    if (prevHookStateDir == null) delete process.env.CE_CC_HOOK_STATE_DIR;
    else process.env.CE_CC_HOOK_STATE_DIR = prevHookStateDir;
  }
});

test('local JWT issuance skips auto-faucet when no selected session has a worker token', async () => {
  const root = mkdtempSync(resolve(tmpdir(), 'ce-router-auth-auto-faucet-no-token-'));
  const dataDir = resolve(root, 'data');
  const hookStateDir = resolve(root, 'hook-state');
  const walletAddress = DEFAULT_TEST_WALLET_ADDRESS;

  mkdirSync(dataDir, { recursive: true });
  mkdirSync(hookStateDir, { recursive: true });
  writeFileSync(
    resolve(hookStateDir, 'config.json'),
    JSON.stringify({
      serverUrl: 'http://localhost:7391',
      selectedSessions: ['alpha', 'beta'],
    }, null, 2),
  );

  const prevDataDir = process.env.CE_CC_DATA_DIR;
  const prevHookStateDir = process.env.CE_CC_HOOK_STATE_DIR;
  process.env.CE_CC_DATA_DIR = dataDir;
  process.env.CE_CC_HOOK_STATE_DIR = hookStateDir;
  const restoreDebugLogging = enableDebugLogging();

  const logs = [];
  const originalLog = console.log;
  console.log = (...args) => logs.push(args.map((value) => String(value)).join(' '));

  try {
    const { handleRoute } = await importFresh(ROUTER_MODULE_PATH);
    let providerCalled = false;
    const res = makeMockRes();
    await handleRoute(
      makeLoopbackReq(),
      res,
      {
        url: new URL('http://localhost:7391/api/auth/local-jwt'),
        method: 'POST',
        body: buildLocalJwtRequestBody(walletAddress),
      },
      {
        getFaucetProvider: () => {
          providerCalled = true;
          return {
            getBalance: async () => ethers.utils.parseEther('0.0005'),
          };
        },
      },
    );

    await flushBackgroundWork();

    assert.equal(res.statusCode, 200);
    assert.equal(providerCalled, false);
  } finally {
    console.log = originalLog;
    restoreDebugLogging();
    if (prevDataDir == null) delete process.env.CE_CC_DATA_DIR;
    else process.env.CE_CC_DATA_DIR = prevDataDir;
    if (prevHookStateDir == null) delete process.env.CE_CC_HOOK_STATE_DIR;
    else process.env.CE_CC_HOOK_STATE_DIR = prevHookStateDir;
  }
});

test('local JWT issuance quietly skips stale configured sessions that no longer resolve to a worker URL', async () => {
  const root = mkdtempSync(resolve(tmpdir(), 'ce-router-auth-auto-faucet-stale-session-'));
  const dataDir = resolve(root, 'data');
  const hookStateDir = resolve(root, 'hook-state');
  const walletAddress = DEFAULT_TEST_WALLET_ADDRESS;

  mkdirSync(dataDir, { recursive: true });
  mkdirSync(hookStateDir, { recursive: true });
  writeFileSync(
    resolve(hookStateDir, 'config.json'),
    JSON.stringify({
      serverUrl: 'http://localhost:7391',
      selectedSessions: ['stale-session'],
    }, null, 2),
  );

  const prevDataDir = process.env.CE_CC_DATA_DIR;
  const prevHookStateDir = process.env.CE_CC_HOOK_STATE_DIR;
  process.env.CE_CC_DATA_DIR = dataDir;
  process.env.CE_CC_HOOK_STATE_DIR = hookStateDir;
  const restoreDebugLogging = enableDebugLogging();

  const logs = [];
  const warnings = [];
  const originalLog = console.log;
  const originalWarn = console.warn;
  console.log = (...args) => logs.push(args.map((value) => String(value)).join(' '));
  console.warn = (...args) => warnings.push(args.map((value) => String(value)).join(' '));

  try {
    const { handleRoute } = await importFresh(ROUTER_MODULE_PATH);
    let providerCalled = false;
    const res = makeMockRes();
    await handleRoute(
      makeLoopbackReq(),
      res,
      {
        url: new URL('http://localhost:7391/api/auth/local-jwt'),
        method: 'POST',
        body: buildLocalJwtRequestBody(walletAddress),
      },
      {
        getCorsWorkerUrl: async (slug) => {
          assert.equal(slug, 'stale-session');
          return null;
        },
        getFaucetProvider: () => {
          providerCalled = true;
          return {
            getBalance: async () => ethers.utils.parseEther('0.0005'),
          };
        },
      },
    );

    await flushBackgroundWork();

    assert.equal(res.statusCode, 200);
    assert.equal(providerCalled, false);
    assert.equal(
      warnings.some((entry) => entry.includes('Auto worker-auth failed for stale-session during faucet')),
      false,
    );
    assert.equal(
      logs.some((entry) => entry.includes('[auth] Auto worker-auth skipped for stale-session during faucet: No worker URL for session "stale-session".')),
      true,
    );
    assert.equal(
      logs.some((entry) => entry.includes('[auth] Auto-faucet: skipped (no worker token and auto-auth failed)')),
      true,
    );
  } finally {
    console.log = originalLog;
    console.warn = originalWarn;
    restoreDebugLogging();
    if (prevDataDir == null) delete process.env.CE_CC_DATA_DIR;
    else process.env.CE_CC_DATA_DIR = prevDataDir;
    if (prevHookStateDir == null) delete process.env.CE_CC_HOOK_STATE_DIR;
    else process.env.CE_CC_HOOK_STATE_DIR = prevHookStateDir;
  }
});

test('respond immediate auto-submit auto-authenticates worker, auto-faucets, and submits with the new token', async () => {
  const root = mkdtempSync(resolve(tmpdir(), 'ce-router-respond-auto-submit-auth-faucet-'));
  const dataDir = resolve(root, 'data');
  const hookStateDir = resolve(root, 'hook-state');
  const session = 'alpha';
  const wallet = ethers.Wallet.createRandom();
  const walletAddress = wallet.address.toLowerCase();
  const questionId = `0x${'ab'.repeat(32)}`;
  const freshWorkerToken = buildWorkerToken({
    sub: walletAddress,
    slug: session,
    exp: Math.floor(Date.now() / 1000) + 600,
  });

  mkdirSync(dataDir, { recursive: true });
  mkdirSync(hookStateDir, { recursive: true });
  writeFileSync(resolve(dataDir, 'wallet.key'), wallet.privateKey);
  writeFileSync(
    resolve(dataDir, 'settings.json'),
    JSON.stringify({ submitMode: 'immediate', batchSize: 5 }, null, 2),
  );

  const prevDataDir = process.env.CE_CC_DATA_DIR;
  const prevHookStateDir = process.env.CE_CC_HOOK_STATE_DIR;
  process.env.CE_CC_DATA_DIR = dataDir;
  process.env.CE_CC_HOOK_STATE_DIR = hookStateDir;
  const restoreDebugLogging = enableDebugLogging();

  const logs = [];
  const warnings = [];
  const originalLog = console.log;
  const originalWarn = console.warn;
  const originalSetTimeout = globalThis.setTimeout;
  console.log = (...args) => logs.push(args.map((value) => String(value)).join(' '));
  console.warn = (...args) => warnings.push(args.map((value) => String(value)).join(' '));
  globalThis.setTimeout = ((fn, _ms, ...args) => {
    if (typeof fn === 'function') fn(...args);
    return 0;
  });

  try {
    const { handleRoute } = await importFresh(ROUTER_MODULE_PATH);
    const token = await issueLocalJwt(handleRoute, walletAddress, wallet.privateKey);

    const fetchCalls = [];
    let submitInvocation = null;
    let resolveSubmit;
    const submitDone = new Promise((resolve) => {
      resolveSubmit = resolve;
    });

    const res = makeMockRes();
    await handleRoute(
      makeLoopbackReq({ authorization: `Bearer ${token}` }),
      res,
      {
        url: new URL('http://localhost:7391/api/respond'),
        method: 'POST',
        body: {
          questionId,
          session,
          answer: 'yes',
          questionType: 'binary',
        },
      },
      {
        canSubmit: () => ({ ready: true, hasKey: true, hasContract: true }),
        getFaucetProvider: () => ({
          getBalance: async (address) => {
            assert.equal(address, walletAddress);
            return ethers.utils.parseEther('0.0005');
          },
        }),
        getCorsWorkerUrl: async (slug) => {
          assert.equal(slug, session);
          return 'https://worker.example.com/base/';
        },
        fetch: async (input, init) => {
          const url = String(input);
          fetchCalls.push({ url, init });
          if (url === 'https://worker.example.com/base/auth/nonce') {
            assert.equal(init?.headers?.Origin, 'http://localhost:7391');
            return new Response(JSON.stringify({ nonce: 'nonce-123' }), {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            });
          }
          if (url === 'https://worker.example.com/base/auth/login') {
            assert.equal(init?.headers?.Origin, 'http://localhost:7391');
            const parsed = JSON.parse(String(init?.body || '{}'));
            // authenticateWithWorker sends EIP-55 checksummed address
            assert.equal(parsed.address.toLowerCase(), walletAddress);
            assert.equal(parsed.sessionSlug, session);
            assert.equal(parsed.signature.startsWith('0x'), true);
            assert.equal(parsed.message.includes(`Nonce: nonce-123`), true);
            assert.equal(parsed.message.includes('localhost:7391 wants you to sign in'), true);
            assert.equal(parsed.message.includes('URI: http://localhost:7391'), true);
            return new Response(JSON.stringify({ token: freshWorkerToken }), {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            });
          }
          if (url === `https://worker.example.com/base/${session}`) {
            assert.equal(init?.headers?.Authorization, `Bearer ${freshWorkerToken}`);
            return new Response(JSON.stringify({ amountEth: '0.05', txHash: '0xfaucet123' }), {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            });
          }
          throw new Error(`Unexpected fetch URL: ${url}`);
        },
        submitOnChain: async (pending, slug, workerToken) => {
          submitInvocation = { pending, slug, workerToken };
          resolveSubmit();
          return {
            ok: true,
            txHash: '0xsubmit123',
            count: pending.length,
            arweaveTxIds: ['tx-respond-auto'],
            surveyArweaveTxId: 'survey-respond-auto',
          };
        },
      },
    );

    assert.equal(res.statusCode, 200);
    const responseBody = JSON.parse(res.body || '{}');
    assert.equal(responseBody.submitted, true);
    assert.equal(responseBody.txHash, '0xsubmit123');
    assert.equal(
      responseBody.txExplorerUrl,
      'https://optimism-sepolia.blockscout.com/tx/0xsubmit123'
    );
    assert.equal(responseBody.requiresWorkerAuth, false);
    assert.equal(responseBody.autoSubmitting, undefined);
    assert.equal(responseBody.acknowledgement, 'Submitted securely. Auto-submit succeeded.');
    assert.deepEqual(responseBody.autoSubmit, {
      status: 'submitted',
      alert: 'success',
      message: 'Auto-submit succeeded.',
      txHash: '0xsubmit123',
      blockNumber: null,
      txExplorerUrl: 'https://optimism-sepolia.blockscout.com/tx/0xsubmit123',
    });

    await submitDone;
    await flushBackgroundWork();

    const storedAutoResponse = JSON.parse(
      readFileSync(resolve(dataDir, 'responses', session, `${questionId}.json`), 'utf8'),
    );
    assert.equal(storedAutoResponse.submitted, true);
    assert.equal(storedAutoResponse.txHash, '0xsubmit123');
    assert.equal(storedAutoResponse.arweaveTxId, 'tx-respond-auto');
    assert.deepEqual(storedAutoResponse.storageRef, {
      backend: 'arweave',
      id: 'tx-respond-auto',
      uri: 'ar://tx-respond-auto',
      resource: 'responses',
    });
    assert.equal(storedAutoResponse.surveyArweaveTxId, 'survey-respond-auto');
    assert.deepEqual(storedAutoResponse.surveyStorageRef, {
      backend: 'arweave',
      id: 'survey-respond-auto',
      uri: 'ar://survey-respond-auto',
      resource: 'responses',
    });

    assert.deepEqual(
      fetchCalls.map((entry) => entry.url),
      [
        'https://worker.example.com/base/auth/nonce',
        'https://worker.example.com/base/auth/login',
        `https://worker.example.com/base/${session}`,
      ],
    );
    assert.equal(submitInvocation?.slug, session);
    assert.equal(submitInvocation?.workerToken, freshWorkerToken);
    assert.equal(submitInvocation?.pending.length, 1);
    assert.equal(submitInvocation?.pending[0].questionId, questionId);

    const storedResponse = JSON.parse(
      readFileSync(resolve(dataDir, 'responses', session, `${questionId}.json`), 'utf8'),
    );
    assert.equal(storedResponse.submitted, true);
    assert.equal(storedResponse.txHash, '0xsubmit123');
    assert.equal(readFileSync(resolve(dataDir, 'worker-tokens', `${session}.jwt`), 'utf8').trim(), freshWorkerToken);
    assertSecureMode(resolve(dataDir, 'worker-tokens', `${session}.jwt`));
    assert.equal(
      logs.some((entry) => entry.includes('[submit] Balance low (0.0005 ETH), requesting faucet funds...')),
      true,
    );
    assert.equal(
      logs.some((entry) => entry.includes('[submit] Faucet funded: 0.05 ETH (tx: 0xfaucet123)')),
      true,
    );
    assert.equal(
      logs.some((entry) => entry.includes(`[router] Auto-submitted response ${questionId} → tx 0xsubmit123`)),
      true,
    );
  } finally {
    console.log = originalLog;
    console.warn = originalWarn;
    globalThis.setTimeout = originalSetTimeout;
    restoreDebugLogging();
    if (prevDataDir == null) delete process.env.CE_CC_DATA_DIR;
    else process.env.CE_CC_DATA_DIR = prevDataDir;
    if (prevHookStateDir == null) delete process.env.CE_CC_HOOK_STATE_DIR;
    else process.env.CE_CC_HOOK_STATE_DIR = prevHookStateDir;
  }
});

test('respond returns pending=true when auto-submit exceeds the await timeout', async () => {
  const root = mkdtempSync(resolve(tmpdir(), 'ce-router-respond-auto-submit-timeout-'));
  const dataDir = resolve(root, 'data');
  const hookStateDir = resolve(root, 'hook-state');
  const session = 'alpha';
  const wallet = ethers.Wallet.createRandom();
  const walletAddress = wallet.address.toLowerCase();
  const questionId = `0x${'cd'.repeat(32)}`;

  mkdirSync(dataDir, { recursive: true });
  mkdirSync(hookStateDir, { recursive: true });
  writeFileSync(resolve(dataDir, 'wallet.key'), wallet.privateKey);
  writeFileSync(
    resolve(dataDir, 'settings.json'),
    JSON.stringify({ submitMode: 'immediate', batchSize: 5 }, null, 2),
  );
  // Pre-stage a worker token so ensureWorkerToken returns synchronously and we
  // exercise only the submitOnChain await timeout path.
  mkdirSync(resolve(dataDir, 'worker-tokens'), { recursive: true });
  writeFileSync(
    resolve(dataDir, 'worker-tokens', `${session}.jwt`),
    buildWorkerToken({
      sub: walletAddress,
      slug: session,
      exp: Math.floor(Date.now() / 1000) + 600,
    }),
  );

  const prevDataDir = process.env.CE_CC_DATA_DIR;
  const prevHookStateDir = process.env.CE_CC_HOOK_STATE_DIR;
  const prevTimeout = process.env.CE_CC_AUTO_SUBMIT_AWAIT_TIMEOUT_MS;
  process.env.CE_CC_DATA_DIR = dataDir;
  process.env.CE_CC_HOOK_STATE_DIR = hookStateDir;
  process.env.CE_CC_AUTO_SUBMIT_AWAIT_TIMEOUT_MS = '200';
  const restoreDebugLogging = enableDebugLogging();

  try {
    const { handleRoute } = await importFresh(ROUTER_MODULE_PATH);
    const token = await issueLocalJwt(handleRoute, walletAddress, wallet.privateKey);

    const startedAt = Date.now();
    const res = makeMockRes();
    await handleRoute(
      makeLoopbackReq({ authorization: `Bearer ${token}` }),
      res,
      {
        url: new URL('http://localhost:7391/api/respond'),
        method: 'POST',
        body: {
          questionId,
          session,
          answer: 'yes',
          questionType: 'binary',
        },
      },
      {
        canSubmit: () => ({ ready: true, hasKey: true, hasContract: true }),
        getFaucetProvider: () => ({
          getBalance: async () => ethers.utils.parseEther('1'),
        }),
        // submitOnChain never resolves in this test so the await must hit the
        // 200ms timeout we configured above.
        submitOnChain: () => new Promise(() => {}),
      },
    );
    const elapsed = Date.now() - startedAt;

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body || '{}');
    assert.equal(body.submitted, false);
    assert.equal(body.pending, true);
    assert.equal(body.requiresWorkerAuth, false);
    assert.equal(body.autoSubmitting, undefined);
    assert.equal(body.acknowledgement, 'Saved locally. Auto-submit is still in progress.');
    assert.equal(body.autoSubmit.status, 'pending');
    assert.equal(body.autoSubmit.alert, 'info');
    assert.ok(elapsed >= 150, `expected response to wait for the configured auto-submit timeout, took ${elapsed}ms`);
  } finally {
    restoreDebugLogging();
    if (prevDataDir == null) delete process.env.CE_CC_DATA_DIR;
    else process.env.CE_CC_DATA_DIR = prevDataDir;
    if (prevHookStateDir == null) delete process.env.CE_CC_HOOK_STATE_DIR;
    else process.env.CE_CC_HOOK_STATE_DIR = prevHookStateDir;
    if (prevTimeout == null) delete process.env.CE_CC_AUTO_SUBMIT_AWAIT_TIMEOUT_MS;
    else process.env.CE_CC_AUTO_SUBMIT_AWAIT_TIMEOUT_MS = prevTimeout;
  }
});

test('settings endpoint defaults autoSubmitResponses on and keeps legacy submitMode compatibility', async () => {
  const root = mkdtempSync(resolve(tmpdir(), 'ce-router-settings-'));
  const dataDir = resolve(root, 'data');
  const hookStateDir = resolve(root, 'hook-state');
  const walletAddress = DEFAULT_TEST_WALLET_ADDRESS;

  mkdirSync(dataDir, { recursive: true });
  mkdirSync(hookStateDir, { recursive: true });

  const prevDataDir = process.env.CE_CC_DATA_DIR;
  const prevHookStateDir = process.env.CE_CC_HOOK_STATE_DIR;
  process.env.CE_CC_DATA_DIR = dataDir;
  process.env.CE_CC_HOOK_STATE_DIR = hookStateDir;

  try {
    const { handleRoute } = await importFresh(ROUTER_MODULE_PATH);
    const token = await issueLocalJwt(handleRoute, walletAddress);

    const getRes = makeMockRes();
    await handleRoute(
      makeLoopbackReq({ authorization: `Bearer ${token}` }),
      getRes,
      {
        url: new URL('http://localhost:7391/api/settings'),
        method: 'GET',
        body: {},
      },
    );

    assert.equal(getRes.statusCode, 200);
    assert.deepEqual(JSON.parse(getRes.body || '{}'), {
      submitMode: 'immediate',
      autoSubmitResponses: true,
      batchSize: 5,
      chainId: 11155420,
      chainName: 'OP Sepolia',
      txExplorerTxBaseUrl: 'https://optimism-sepolia.blockscout.com/tx/',
    });

    const postBooleanRes = makeMockRes();
    await handleRoute(
      makeLoopbackReq({ authorization: `Bearer ${token}` }),
      postBooleanRes,
      {
        url: new URL('http://localhost:7391/api/settings'),
        method: 'POST',
        body: {
          autoSubmitResponses: false,
        },
      },
    );

    assert.equal(postBooleanRes.statusCode, 200);
    assert.deepEqual(JSON.parse(postBooleanRes.body || '{}').settings, {
      submitMode: 'batch',
      autoSubmitResponses: false,
      batchSize: 5,
      chainId: 11155420,
      chainName: 'OP Sepolia',
      txExplorerTxBaseUrl: 'https://optimism-sepolia.blockscout.com/tx/',
    });
    assert.deepEqual(
      JSON.parse(readFileSync(resolve(dataDir, 'settings.json'), 'utf8')),
      {
        submitMode: 'batch',
        autoSubmitResponses: false,
        batchSize: 5,
      },
    );

    const postLegacyRes = makeMockRes();
    await handleRoute(
      makeLoopbackReq({ authorization: `Bearer ${token}` }),
      postLegacyRes,
      {
        url: new URL('http://localhost:7391/api/settings'),
        method: 'POST',
        body: {
          submitMode: 'immediate',
        },
      },
    );

    assert.equal(postLegacyRes.statusCode, 200);
    assert.equal(JSON.parse(postLegacyRes.body || '{}').settings.autoSubmitResponses, true);
    assert.equal(JSON.parse(postLegacyRes.body || '{}').settings.submitMode, 'immediate');
  } finally {
    if (prevDataDir == null) delete process.env.CE_CC_DATA_DIR;
    else process.env.CE_CC_DATA_DIR = prevDataDir;
    if (prevHookStateDir == null) delete process.env.CE_CC_HOOK_STATE_DIR;
    else process.env.CE_CC_HOOK_STATE_DIR = prevHookStateDir;
  }
});

test('respond keeps responses pending when autoSubmitResponses=false even if submission is otherwise ready', async () => {
  const root = mkdtempSync(resolve(tmpdir(), 'ce-router-respond-auto-submit-disabled-'));
  const dataDir = resolve(root, 'data');
  const hookStateDir = resolve(root, 'hook-state');
  const session = 'alpha';
  const wallet = ethers.Wallet.createRandom();
  const walletAddress = wallet.address.toLowerCase();
  const questionId = `0x${'da'.repeat(32)}`;

  mkdirSync(dataDir, { recursive: true });
  mkdirSync(hookStateDir, { recursive: true });
  writeFileSync(
    resolve(dataDir, 'settings.json'),
    JSON.stringify({ autoSubmitResponses: false }, null, 2),
  );

  const prevDataDir = process.env.CE_CC_DATA_DIR;
  const prevHookStateDir = process.env.CE_CC_HOOK_STATE_DIR;
  process.env.CE_CC_DATA_DIR = dataDir;
  process.env.CE_CC_HOOK_STATE_DIR = hookStateDir;

  let submitCalled = false;
  try {
    const { handleRoute } = await importFresh(ROUTER_MODULE_PATH);
    const token = await issueLocalJwt(handleRoute, walletAddress, wallet.privateKey);

    const res = makeMockRes();
    await handleRoute(
      makeLoopbackReq({ authorization: `Bearer ${token}` }),
      res,
      {
        url: new URL('http://localhost:7391/api/respond'),
        method: 'POST',
        body: {
          questionId,
          session,
          answer: 'hold locally',
          questionType: 'freeform',
        },
      },
      {
        canSubmit: () => ({ ready: true, hasKey: true, hasContract: true }),
        submitOnChain: async () => {
          submitCalled = true;
          return { ok: true, txHash: '0xshould-not-run' };
        },
      },
    );

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body || '{}');
    assert.equal(body.ok, true);
    assert.equal(body.stored, true);
    assert.equal(body.submitted, false);
    assert.equal(body.acknowledgement, 'Saved locally. Auto-submit is disabled.');
    assert.equal(body.autoSubmit.status, 'disabled');
    assert.equal(JSON.stringify(body).includes('hold locally'), false);
    assert.equal(submitCalled, false);
    assert.equal(
      JSON.parse(readFileSync(resolve(dataDir, 'responses', session, `${questionId}.json`), 'utf8')).submitted,
      false,
    );
  } finally {
    if (prevDataDir == null) delete process.env.CE_CC_DATA_DIR;
    else process.env.CE_CC_DATA_DIR = prevDataDir;
    if (prevHookStateDir == null) delete process.env.CE_CC_HOOK_STATE_DIR;
    else process.env.CE_CC_HOOK_STATE_DIR = prevHookStateDir;
  }
});

test('submission filtering is wallet-scoped and respects optional question ids', async () => {
  const {
    filterPendingResponsesForSubmission,
    buildHookResponseDefaults,
  } = await importFresh(ROUTER_MODULE_PATH);

  const pending = [
    { questionId: 'q1', respondent: '0xaaaa' },
    { questionId: 'q2', respondent: '0xbbbb' },
    { questionId: 'q3', respondent: '0xAAAA' },
  ];

  const scoped = filterPendingResponsesForSubmission(pending, {
    respondentAddress: '0xAaAa',
    questionIds: ['q3', 'q2'],
  });
  assert.deepEqual(scoped.map((row) => row.questionId), ['q3']);

  assert.deepEqual(
    buildHookResponseDefaults({ defaultConviction: 'HIGH', encryptByDefault: 1 }),
    { encrypt: true },
  );
  assert.deepEqual(
    buildHookResponseDefaults({ defaultConviction: 'unknown', encryptByDefault: 0 }),
    { encrypt: false },
  );
});

test('status endpoint aggregates selected sessions, wallet-scoped pending responses, and hook dashboard state', async () => {
  const root = mkdtempSync(resolve(tmpdir(), 'ce-router-status-'));
  const dataDir = resolve(root, 'data');
  const hookStateDir = resolve(root, 'hook-state');
  const workerTokensDir = resolve(dataDir, 'worker-tokens');
  const walletAddress = DEFAULT_TEST_WALLET_ADDRESS;

  mkdirSync(resolve(dataDir, 'responses', 'alpha'), { recursive: true });
  mkdirSync(resolve(dataDir, 'responses', 'beta'), { recursive: true });
  mkdirSync(workerTokensDir, { recursive: true });
  mkdirSync(hookStateDir, { recursive: true });

  writeFileSync(
    resolve(hookStateDir, 'config.json'),
    JSON.stringify({
      serverUrl: 'http://localhost:7391',
      defaultSession: 'alpha',
      selectedSessions: ['alpha', 'beta'],
      cooldownMs: 60_000,
      aiSuggestFreeform: true,
    }, null, 2),
  );
  writeFileSync(resolve(hookStateDir, 'last-ts'), String(Date.now() - 10_000));
  writeFileSync(
    resolve(hookStateDir, 'dashboard.json'),
    JSON.stringify({
      phase: 'question',
      session: 'alpha',
      wallet: walletAddress,
      stats: { answered: 1, total: 3, remaining: 2 },
      question: {
        id: 'q2',
        prompt: 'What changed this week?',
        type: 'freeform',
        optionsCount: 0,
      },
    }, null, 2),
  );
  writeFileSync(
    resolve(dataDir, 'responses', 'alpha', 'q1.json'),
    JSON.stringify({
      questionId: 'q1',
      respondent: walletAddress,
      answer: 'yes',
      submitted: false,
    }, null, 2),
  );
  writeFileSync(
    resolve(dataDir, 'responses', 'alpha', 'q-other.json'),
    JSON.stringify({
      questionId: 'q-other',
      respondent: '0x2222222222222222222222222222222222222222',
      answer: 'skip',
      submitted: false,
    }, null, 2),
  );
  writeFileSync(
    resolve(dataDir, 'responses', 'beta', 'q4.json'),
    JSON.stringify({
      questionId: 'q4',
      respondent: walletAddress,
      answer: 'done',
      submitted: false,
    }, null, 2),
  );
  writeFileSync(
    resolve(workerTokensDir, 'alpha.jwt'),
    buildWorkerToken({
      sub: walletAddress,
      slug: 'alpha',
      exp: Math.floor(Date.now() / 1000) + 600,
    }),
  );

  const prevDataDir = process.env.CE_CC_DATA_DIR;
  const prevHookStateDir = process.env.CE_CC_HOOK_STATE_DIR;
  process.env.CE_CC_DATA_DIR = dataDir;
  process.env.CE_CC_HOOK_STATE_DIR = hookStateDir;

  try {
    const { handleRoute } = await importFresh(ROUTER_MODULE_PATH);

    const jwtRes = makeMockRes();
    await handleRoute(
      makeLoopbackReq(),
      jwtRes,
      {
        url: new URL('http://localhost:7391/api/auth/local-jwt'),
        method: 'POST',
        body: buildLocalJwtRequestBody(walletAddress),
      },
    );
    assert.equal(jwtRes.statusCode, 200);
    const token = String(JSON.parse(jwtRes.body || '{}').token || '');
    assert.equal(token.length > 0, true);

    const res = makeMockRes();
    await handleRoute(
      makeLoopbackReq({ authorization: `Bearer ${token}` }),
      res,
      {
        url: new URL('http://localhost:7391/api/status'),
        method: 'GET',
        body: {},
      },
      {
        canSubmit: () => ({ ready: true, hasKey: true, hasContract: true }),
        fetchQuestionIds: async (slug) => {
          if (slug === 'alpha') return new Set(['q1', 'q2', 'q3']);
          if (slug === 'beta') return new Set(['q4', 'q5']);
          return new Set();
        },
        getMergedAnsweredQuestionIds: async (slug) => {
          if (slug === 'alpha') return new Set(['q1']);
          if (slug === 'beta') return new Set(['q4', 'q5']);
          return new Set();
        },
      },
    );

    assert.equal(res.statusCode, 200);
    const payload = JSON.parse(res.body || '{}');
    assert.equal(payload.wallet, walletAddress.toLowerCase());
    assert.deepEqual(payload.config.selectedSessions, ['alpha', 'beta']);
    assert.equal(payload.totals.sessions, 2);
    assert.equal(payload.totals.total, 5);
    assert.equal(payload.totals.answered, 3);
    assert.equal(payload.totals.remaining, 2);
    assert.equal(payload.totals.pending, 2);
    assert.equal(payload.submit.ready, true);
    assert.equal(payload.config.chainId, 11155420);
    assert.equal(payload.config.chainName, 'OP Sepolia');
    assert.equal(payload.submit.autoSubmitResponses, true);
    assert.equal(payload.submit.mode, 'immediate');
    assert.equal(payload.submit.chainId, 11155420);
    assert.equal(payload.submit.chainName, 'OP Sepolia');
    assert.equal(payload.submit.workerTokens.ready, false);
    assert.equal(payload.submit.workerTokens.validCount, 1);
    assert.equal(payload.submit.workerTokens.missingCount, 1);
    assert.deepEqual(payload.submit.workerTokens.missingSessions, ['beta']);
    assert.equal(payload.dashboard.question.prompt, 'What changed this week?');
    assert.equal(payload.sessions[0].pending, 1);
    assert.equal(payload.sessions[1].pending, 1);
    assert.equal(payload.cooldown.active, true);
    assert.equal(payload.cooldown.remainingMs > 45_000, true);
    assert.equal(payload.cooldown.remainingMs <= 60_000, true);
  } finally {
    if (prevDataDir == null) delete process.env.CE_CC_DATA_DIR;
    else process.env.CE_CC_DATA_DIR = prevDataDir;
    if (prevHookStateDir == null) delete process.env.CE_CC_HOOK_STATE_DIR;
    else process.env.CE_CC_HOOK_STATE_DIR = prevHookStateDir;
  }
});

test('hook question recentResponses fall back to defaultSession when selectedSessions is empty', async () => {
  const root = mkdtempSync(resolve(tmpdir(), 'ce-router-hook-default-session-'));
  const dataDir = resolve(root, 'data');
  const hookStateDir = resolve(root, 'hook-state');
  const walletAddress = DEFAULT_TEST_WALLET_ADDRESS;
  const otherWalletAddress = '0x2222222222222222222222222222222222222222';
  const sessionSlug = 'alpha';

  mkdirSync(resolve(dataDir, 'responses', sessionSlug), { recursive: true });
  mkdirSync(hookStateDir, { recursive: true });
  writeFileSync(
    resolve(hookStateDir, 'config.json'),
    JSON.stringify({
      serverUrl: 'http://localhost:7391',
      defaultSession: sessionSlug,
      selectedSessions: [],
      aiSuggestFreeform: true,
    }, null, 2),
  );
  writeFileSync(
    resolve(dataDir, 'responses', sessionSlug, 'freeform-1.json'),
    JSON.stringify({
      questionId: 'freeform-1',
      questionType: 'freeform',
      respondent: walletAddress,
      answer: 'recent answer from default session',
      timestamp: '2026-03-06T00:00:00.000Z',
      submitted: false,
    }, null, 2),
  );
  writeFileSync(
    resolve(dataDir, 'responses', sessionSlug, 'freeform-2.json'),
    JSON.stringify({
      questionId: 'freeform-2',
      questionType: 'freeform',
      respondent: otherWalletAddress,
      answer: 'should not count for another wallet',
      timestamp: '2026-03-06T00:01:00.000Z',
      submitted: false,
    }, null, 2),
  );

  const prevDataDir = process.env.CE_CC_DATA_DIR;
  const prevHookStateDir = process.env.CE_CC_HOOK_STATE_DIR;
  process.env.CE_CC_DATA_DIR = dataDir;
  process.env.CE_CC_HOOK_STATE_DIR = hookStateDir;

  try {
    const { handleRoute } = await importFresh(ROUTER_MODULE_PATH);
    const token = await issueLocalJwt(handleRoute, walletAddress);

    const res = makeMockRes();
    await handleRoute(
      makeLoopbackReq({ authorization: `Bearer ${token}` }),
      res,
      {
        url: new URL(`http://localhost:7391/api/hook/question?session=${sessionSlug}`),
        method: 'GET',
        body: {},
      },
      {
        getRandomUnseen: async () => ({
          question: {
            id: 'freeform-q',
            type: 'freeform',
            prompt: 'What changed this week?',
          },
          answeredCount: 1,
          totalCount: 2,
        }),
        formatQuestionForTerminal: (question) => question,
      },
    );

    assert.equal(res.statusCode, 200);
    const payload = JSON.parse(res.body || '{}');
    assert.equal(payload.aiSuggestFreeform, true);
    assert.deepEqual(payload.stats, {
      total: 2,
      answered: 1,
      remaining: 1,
      pending: 1,
    });
    assert.deepEqual(
      payload.recentResponses,
      [{
        type: 'freeform',
        answer: 'recent answer from default session',
        ts: '2026-03-06T00:00:00.000Z',
      }],
    );
  } finally {
    if (prevDataDir == null) delete process.env.CE_CC_DATA_DIR;
    else process.env.CE_CC_DATA_DIR = prevDataDir;
    if (prevHookStateDir == null) delete process.env.CE_CC_HOOK_STATE_DIR;
    else process.env.CE_CC_HOOK_STATE_DIR = prevHookStateDir;
  }
});

test('submit-onchain marks all successful pending responses as submitted in order', async () => {
  const root = mkdtempSync(resolve(tmpdir(), 'ce-router-submit-onchain-marking-'));
  const dataDir = resolve(root, 'data');
  const hookStateDir = resolve(root, 'hook-state');
  const workerTokensDir = resolve(dataDir, 'worker-tokens');
  const session = 'edge';
  const wallet = new ethers.Wallet('0x59c6995e998f97a5a0044976f84ce7de5d9d7f17b2f6a6a5f76f8864c8ad88f5');
  const walletAddress = wallet.address.toLowerCase();
  const qidEncrypted = `0x${'aa'.repeat(32)}`;
  const qidPlain = `0x${'bb'.repeat(32)}`;
  const encryptedFile = resolve(dataDir, 'responses', session, `${qidEncrypted}.json`);
  const plainFile = resolve(dataDir, 'responses', session, `${qidPlain}.json`);

  mkdirSync(resolve(dataDir, 'responses', session), { recursive: true });
  mkdirSync(workerTokensDir, { recursive: true });
  mkdirSync(hookStateDir, { recursive: true });
  writeFileSync(
    resolve(dataDir, 'wallet.key'),
    wallet.privateKey,
  );
  writeFileSync(
    resolve(workerTokensDir, `${session}.jwt`),
    buildWorkerToken({
      sub: wallet.address,
      slug: session,
      exp: Math.floor(Date.now() / 1000) + 600,
    }),
  );
  writeFileSync(
    encryptedFile,
    JSON.stringify({
      questionId: qidEncrypted,
      questionType: 'freeform',
      answer: 'secret',
      respondent: walletAddress,
      encrypt: true,
      submitted: false,
    }, null, 2),
  );
  writeFileSync(
    plainFile,
    JSON.stringify({
      questionId: qidPlain,
      questionType: 'freeform',
      answer: 'plain',
      respondent: walletAddress,
      encrypt: false,
      submitted: false,
    }, null, 2),
  );

  const prevDataDir = process.env.CE_CC_DATA_DIR;
  const prevHookStateDir = process.env.CE_CC_HOOK_STATE_DIR;
  process.env.CE_CC_DATA_DIR = dataDir;
  process.env.CE_CC_HOOK_STATE_DIR = hookStateDir;

  try {
    const { handleRoute } = await importFresh(ROUTER_MODULE_PATH);

    const jwtRes = makeMockRes();
    await handleRoute(
      makeLoopbackReq(),
      jwtRes,
      {
        url: new URL('http://localhost:7391/api/auth/local-jwt'),
        method: 'POST',
        body: buildLocalJwtRequestBody(walletAddress, wallet.privateKey),
      },
    );
    assert.equal(jwtRes.statusCode, 200);
    const token = String(JSON.parse(jwtRes.body || '{}').token || '');
    assert.equal(token.length > 0, true);

    let submittedPending = [];
    const submitRes = makeMockRes();
    await handleRoute(
      makeLoopbackReq({ authorization: `Bearer ${token}` }),
      submitRes,
      {
        url: new URL('http://localhost:7391/api/responses/submit-onchain'),
        method: 'POST',
        body: { session },
      },
      {
        canSubmit: () => ({ ready: true, hasKey: true, hasContract: true }),
        submitOnChain: async (pending) => {
          submittedPending = pending;
          return {
            ok: true,
            txHash: '0xabc123',
            arweaveTxIds: ['tx-encrypted', 'tx-plain'],
            count: pending.length,
          };
        },
      },
    );

    assert.equal(submitRes.statusCode, 200);
    assert.deepEqual(submittedPending.map((r) => r.questionId), [qidEncrypted, qidPlain]);

    const storedEncrypted = JSON.parse(readFileSync(encryptedFile, 'utf8'));
    const storedPlain = JSON.parse(readFileSync(plainFile, 'utf8'));
    assert.equal(storedEncrypted.submitted, true);
    assert.equal(storedEncrypted.txHash, '0xabc123');
    assert.equal(storedEncrypted.arweaveTxId, 'tx-encrypted');
    assert.deepEqual(storedEncrypted.storageRef, {
      backend: 'arweave',
      id: 'tx-encrypted',
      uri: 'ar://tx-encrypted',
      resource: 'responses',
    });
    assert.equal(storedPlain.submitted, true);
    assert.equal(storedPlain.txHash, '0xabc123');
    assert.equal(storedPlain.arweaveTxId, 'tx-plain');
    assert.deepEqual(storedPlain.storageRef, {
      backend: 'arweave',
      id: 'tx-plain',
      uri: 'ar://tx-plain',
      resource: 'responses',
    });
  } finally {
    if (prevDataDir == null) delete process.env.CE_CC_DATA_DIR;
    else process.env.CE_CC_DATA_DIR = prevDataDir;
    if (prevHookStateDir == null) delete process.env.CE_CC_HOOK_STATE_DIR;
    else process.env.CE_CC_HOOK_STATE_DIR = prevHookStateDir;
  }
});

test('respond cooldown auto-increment is capped at 10 minutes', async () => {
  const root = mkdtempSync(resolve(tmpdir(), 'ce-router-cooldown-cap-'));
  const dataDir = resolve(root, 'data');
  const hookStateDir = resolve(root, 'hook-state');
  mkdirSync(dataDir, { recursive: true });
  mkdirSync(hookStateDir, { recursive: true });
  writeFileSync(
    resolve(hookStateDir, 'config.json'),
    JSON.stringify({ serverUrl: 'http://localhost:7391', cooldownMs: 590_000 }, null, 2),
  );

  const prevDataDir = process.env.CE_CC_DATA_DIR;
  const prevHookStateDir = process.env.CE_CC_HOOK_STATE_DIR;
  process.env.CE_CC_DATA_DIR = dataDir;
  process.env.CE_CC_HOOK_STATE_DIR = hookStateDir;

  try {
    const { handleRoute } = await importFresh(ROUTER_MODULE_PATH);

    const jwtRes = makeMockRes();
    await handleRoute(
      makeLoopbackReq(),
      jwtRes,
      {
        url: new URL('http://localhost:7391/api/auth/local-jwt'),
        method: 'POST',
        body: buildLocalJwtRequestBody(DEFAULT_TEST_WALLET_ADDRESS),
      },
    );
    assert.equal(jwtRes.statusCode, 200);
    const jwtPayload = JSON.parse(jwtRes.body || '{}');
    const token = String(jwtPayload.token || '');
    assert.equal(token.length > 0, true);

    const respondRes = makeMockRes();
    await handleRoute(
      makeLoopbackReq({ authorization: `Bearer ${token}` }),
      respondRes,
      {
        url: new URL('http://localhost:7391/api/respond'),
        method: 'POST',
        body: {
          questionId: '0x' + '01'.repeat(32),
          session: 'edge',
          answer: 'yes',
          questionType: 'binary',
        },
      },
    );
    assert.equal(respondRes.statusCode, 200);

    const savedConfig = JSON.parse(readFileSync(resolve(hookStateDir, 'config.json'), 'utf8'));
    assert.equal(savedConfig.cooldownMs, 600_000);
    assertSecureMode(resolve(hookStateDir, 'config.json'));
  } finally {
    if (prevDataDir == null) delete process.env.CE_CC_DATA_DIR;
    else process.env.CE_CC_DATA_DIR = prevDataDir;
    if (prevHookStateDir == null) delete process.env.CE_CC_HOOK_STATE_DIR;
    else process.env.CE_CC_HOOK_STATE_DIR = prevHookStateDir;
  }
});

test('respond stores encryptAdditional separately with backward-compatible defaults', async () => {
  const root = mkdtempSync(resolve(tmpdir(), 'ce-router-encrypt-additional-'));
  const dataDir = resolve(root, 'data');
  const hookStateDir = resolve(root, 'hook-state');
  const session = 'edge';
  const walletAddress = DEFAULT_TEST_WALLET_ADDRESS;
  const qidFallback = `0x${'c1'.repeat(32)}`;
  const qidExplicitFalse = `0x${'c2'.repeat(32)}`;
  const qidNoAdditional = `0x${'c3'.repeat(32)}`;
  mkdirSync(dataDir, { recursive: true });
  mkdirSync(hookStateDir, { recursive: true });

  const prevDataDir = process.env.CE_CC_DATA_DIR;
  const prevHookStateDir = process.env.CE_CC_HOOK_STATE_DIR;
  process.env.CE_CC_DATA_DIR = dataDir;
  process.env.CE_CC_HOOK_STATE_DIR = hookStateDir;

  try {
    const { handleRoute } = await importFresh(ROUTER_MODULE_PATH);

    const jwtRes = makeMockRes();
    await handleRoute(
      makeLoopbackReq(),
      jwtRes,
      {
        url: new URL('http://localhost:7391/api/auth/local-jwt'),
        method: 'POST',
        body: buildLocalJwtRequestBody(walletAddress),
      },
    );
    assert.equal(jwtRes.statusCode, 200);
    const token = String(JSON.parse(jwtRes.body || '{}').token || '');
    assert.equal(token.length > 0, true);

    const respondFallbackRes = makeMockRes();
    await handleRoute(
      makeLoopbackReq({ authorization: `Bearer ${token}` }),
      respondFallbackRes,
      {
        url: new URL('http://localhost:7391/api/respond'),
        method: 'POST',
        body: {
          questionId: qidFallback,
          session,
          answer: 'answer-a',
          questionType: 'freeform',
          additional: 'legacy additional text',
          encrypt: true,
        },
      },
    );
    assert.equal(respondFallbackRes.statusCode, 200);

    const storedFallback = JSON.parse(
      readFileSync(resolve(dataDir, 'responses', session, `${qidFallback}.json`), 'utf8'),
    );
    assert.equal(storedFallback.encrypt, true);
    assert.equal(storedFallback.encryptAdditional, true);

    const respondExplicitFalseRes = makeMockRes();
    await handleRoute(
      makeLoopbackReq({ authorization: `Bearer ${token}` }),
      respondExplicitFalseRes,
      {
        url: new URL('http://localhost:7391/api/respond'),
        method: 'POST',
        body: {
          questionId: qidExplicitFalse,
          session,
          answer: 'answer-b',
          questionType: 'freeform',
          additional: 'keep plaintext',
          encrypt: true,
          encryptAdditional: false,
        },
      },
    );
    assert.equal(respondExplicitFalseRes.statusCode, 200);

    const storedExplicitFalse = JSON.parse(
      readFileSync(resolve(dataDir, 'responses', session, `${qidExplicitFalse}.json`), 'utf8'),
    );
    assert.equal(storedExplicitFalse.encrypt, true);
    assert.equal(storedExplicitFalse.encryptAdditional, false);

    const respondNoAdditionalRes = makeMockRes();
    await handleRoute(
      makeLoopbackReq({ authorization: `Bearer ${token}` }),
      respondNoAdditionalRes,
      {
        url: new URL('http://localhost:7391/api/respond'),
        method: 'POST',
        body: {
          questionId: qidNoAdditional,
          session,
          answer: 'answer-c',
          questionType: 'freeform',
          additional: '',
          encrypt: true,
        },
      },
    );
    assert.equal(respondNoAdditionalRes.statusCode, 200);

    const storedNoAdditional = JSON.parse(
      readFileSync(resolve(dataDir, 'responses', session, `${qidNoAdditional}.json`), 'utf8'),
    );
    assert.equal(storedNoAdditional.encrypt, true);
    assert.equal(storedNoAdditional.encryptAdditional, false);
  } finally {
    if (prevDataDir == null) delete process.env.CE_CC_DATA_DIR;
    else process.env.CE_CC_DATA_DIR = prevDataDir;
    if (prevHookStateDir == null) delete process.env.CE_CC_HOOK_STATE_DIR;
    else process.env.CE_CC_HOOK_STATE_DIR = prevHookStateDir;
  }
});

test('respond normalizes explicit answer/additional audience fields into stored pending responses', async () => {
  const root = mkdtempSync(resolve(tmpdir(), 'ce-router-explicit-audience-'));
  const dataDir = resolve(root, 'data');
  const hookStateDir = resolve(root, 'hook-state');
  const session = 'edge';
  const walletAddress = DEFAULT_TEST_WALLET_ADDRESS;
  const questionId = `0x${'c4'.repeat(32)}`;
  mkdirSync(dataDir, { recursive: true });
  mkdirSync(hookStateDir, { recursive: true });

  const prevDataDir = process.env.CE_CC_DATA_DIR;
  const prevHookStateDir = process.env.CE_CC_HOOK_STATE_DIR;
  process.env.CE_CC_DATA_DIR = dataDir;
  process.env.CE_CC_HOOK_STATE_DIR = hookStateDir;

  try {
    const { handleRoute } = await importFresh(ROUTER_MODULE_PATH);
    const token = await issueLocalJwt(handleRoute, walletAddress);

    const respondRes = makeMockRes();
    await handleRoute(
      makeLoopbackReq({ authorization: `Bearer ${token}` }),
      respondRes,
      {
        url: new URL('http://localhost:7391/api/respond'),
        method: 'POST',
        body: {
          questionId,
          session,
          answer: 'answer-a',
          questionType: 'freeform',
          additional: 'follow me',
          answerEncryptionAudience: 'self',
          additionalEncryptionAudience: 'follow',
        },
      },
    );
    assert.equal(respondRes.statusCode, 200);

    const stored = JSON.parse(
      readFileSync(resolve(dataDir, 'responses', session, `${questionId}.json`), 'utf8'),
    );
    assert.equal(stored.encrypt, true);
    assert.equal(stored.encryptAdditional, true);
    assert.equal(stored.answerEncryptionAudience, 'self');
    assert.equal(stored.answerEncryptionGateId, null);
    assert.equal(stored.additionalEncryptionAudience, 'self');
    assert.equal(stored.additionalEncryptionGateId, null);
    assert.equal(stored.additionalAudienceMode, 'inherit');
  } finally {
    if (prevDataDir == null) delete process.env.CE_CC_DATA_DIR;
    else process.env.CE_CC_DATA_DIR = prevDataDir;
    if (prevHookStateDir == null) delete process.env.CE_CC_HOOK_STATE_DIR;
    else process.env.CE_CC_HOOK_STATE_DIR = prevHookStateDir;
  }
});

test('respond accepts multiselect answers for multichoice questions', async () => {
  const root = mkdtempSync(resolve(tmpdir(), 'ce-router-multiselect-answer-'));
  const dataDir = resolve(root, 'data');
  const hookStateDir = resolve(root, 'hook-state');
  const session = 'edge';
  const walletAddress = DEFAULT_TEST_WALLET_ADDRESS;
  const questionId = `0x${'c5'.repeat(32)}`;
  mkdirSync(dataDir, { recursive: true });
  mkdirSync(hookStateDir, { recursive: true });

  const prevDataDir = process.env.CE_CC_DATA_DIR;
  const prevHookStateDir = process.env.CE_CC_HOOK_STATE_DIR;
  process.env.CE_CC_DATA_DIR = dataDir;
  process.env.CE_CC_HOOK_STATE_DIR = hookStateDir;

  try {
    const { handleRoute } = await importFresh(ROUTER_MODULE_PATH);
    const token = await issueLocalJwt(handleRoute, walletAddress);

    const respondRes = makeMockRes();
    await handleRoute(
      makeLoopbackReq({ authorization: `Bearer ${token}` }),
      respondRes,
      {
        url: new URL('http://localhost:7391/api/respond'),
        method: 'POST',
        body: {
          questionId,
          session,
          answer: ['Option A', 'Option B'],
          questionType: 'multichoice',
        },
      },
    );
    assert.equal(respondRes.statusCode, 200);

    const stored = JSON.parse(
      readFileSync(resolve(dataDir, 'responses', session, `${questionId}.json`), 'utf8'),
    );
    assert.deepEqual(stored.answer, ['Option A', 'Option B']);
  } finally {
    if (prevDataDir == null) delete process.env.CE_CC_DATA_DIR;
    else process.env.CE_CC_DATA_DIR = prevDataDir;
    if (prevHookStateDir == null) delete process.env.CE_CC_HOOK_STATE_DIR;
    else process.env.CE_CC_HOOK_STATE_DIR = prevHookStateDir;
  }
});

test('respond rejects oversized answers instead of silently truncating them', async () => {
  const root = mkdtempSync(resolve(tmpdir(), 'ce-router-answer-length-'));
  const dataDir = resolve(root, 'data');
  const hookStateDir = resolve(root, 'hook-state');
  const session = 'edge';
  const walletAddress = DEFAULT_TEST_WALLET_ADDRESS;
  const questionId = `0x${'c6'.repeat(32)}`;
  mkdirSync(dataDir, { recursive: true });
  mkdirSync(hookStateDir, { recursive: true });

  const prevDataDir = process.env.CE_CC_DATA_DIR;
  const prevHookStateDir = process.env.CE_CC_HOOK_STATE_DIR;
  process.env.CE_CC_DATA_DIR = dataDir;
  process.env.CE_CC_HOOK_STATE_DIR = hookStateDir;

  try {
    const { handleRoute } = await importFresh(ROUTER_MODULE_PATH);
    const token = await issueLocalJwt(handleRoute, walletAddress);

    const respondRes = makeMockRes();
    await handleRoute(
      makeLoopbackReq({ authorization: `Bearer ${token}` }),
      respondRes,
      {
        url: new URL('http://localhost:7391/api/respond'),
        method: 'POST',
        body: {
          questionId,
          session,
          answer: 'x'.repeat(10_001),
          questionType: 'freeform',
        },
      },
    );
    assert.equal(respondRes.statusCode, 400);
    assert.deepEqual(JSON.parse(respondRes.body || '{}'), {
      error: 'Answer must be 10000 characters or fewer.',
    });
  } finally {
    if (prevDataDir == null) delete process.env.CE_CC_DATA_DIR;
    else process.env.CE_CC_DATA_DIR = prevDataDir;
    if (prevHookStateDir == null) delete process.env.CE_CC_HOOK_STATE_DIR;
    else process.env.CE_CC_HOOK_STATE_DIR = prevHookStateDir;
  }
});

test('faucet check reports wallet eligibility from provider balance', async () => {
  const root = mkdtempSync(resolve(tmpdir(), 'ce-router-faucet-check-'));
  const dataDir = resolve(root, 'data');
  const hookStateDir = resolve(root, 'hook-state');
  const walletAddress = DEFAULT_TEST_WALLET_ADDRESS;
  mkdirSync(dataDir, { recursive: true });
  mkdirSync(hookStateDir, { recursive: true });

  const prevDataDir = process.env.CE_CC_DATA_DIR;
  const prevHookStateDir = process.env.CE_CC_HOOK_STATE_DIR;
  process.env.CE_CC_DATA_DIR = dataDir;
  process.env.CE_CC_HOOK_STATE_DIR = hookStateDir;

  try {
    const { handleRoute } = await importFresh(ROUTER_MODULE_PATH);
    const token = await issueLocalJwt(handleRoute, walletAddress);

    let requestedAddress = null;
    const res = makeMockRes();
    await handleRoute(
      makeLoopbackReq({ authorization: `Bearer ${token}` }),
      res,
      {
        url: new URL('http://localhost:7391/api/faucet/check?session=test-10'),
        method: 'GET',
        body: {},
      },
      {
        getFaucetProvider: () => ({
          getBalance: async (address) => {
            requestedAddress = address;
            return ethers.utils.parseEther('0.0005');
          },
        }),
      },
    );

    assert.equal(res.statusCode, 200);
    const payload = JSON.parse(res.body || '{}');
    assert.equal(requestedAddress, walletAddress.toLowerCase());
    assert.equal(payload.address, walletAddress.toLowerCase());
    assert.equal(payload.balanceEth, '0.0005');
    assert.equal(payload.eligible, true);
    assert.equal(payload.thresholdEth, '0.001');
  } finally {
    if (prevDataDir == null) delete process.env.CE_CC_DATA_DIR;
    else process.env.CE_CC_DATA_DIR = prevDataDir;
    if (prevHookStateDir == null) delete process.env.CE_CC_HOOK_STATE_DIR;
    else process.env.CE_CC_HOOK_STATE_DIR = prevHookStateDir;
  }
});

test('faucet proxy validates session before attempting worker proxy', async () => {
  const root = mkdtempSync(resolve(tmpdir(), 'ce-router-faucet-missing-session-'));
  const dataDir = resolve(root, 'data');
  const hookStateDir = resolve(root, 'hook-state');
  const walletAddress = DEFAULT_TEST_WALLET_ADDRESS;
  mkdirSync(dataDir, { recursive: true });
  mkdirSync(hookStateDir, { recursive: true });

  const prevDataDir = process.env.CE_CC_DATA_DIR;
  const prevHookStateDir = process.env.CE_CC_HOOK_STATE_DIR;
  process.env.CE_CC_DATA_DIR = dataDir;
  process.env.CE_CC_HOOK_STATE_DIR = hookStateDir;

  try {
    const { handleRoute } = await importFresh(ROUTER_MODULE_PATH);
    const token = await issueLocalJwt(handleRoute, walletAddress);

    const res = makeMockRes();
    await handleRoute(
      makeLoopbackReq({ authorization: `Bearer ${token}` }),
      res,
      {
        url: new URL('http://localhost:7391/api/faucet'),
        method: 'POST',
        body: {},
      },
    );

    assert.equal(res.statusCode, 400);
    assert.deepEqual(JSON.parse(res.body || '{}'), { error: 'session required.' });
  } finally {
    if (prevDataDir == null) delete process.env.CE_CC_DATA_DIR;
    else process.env.CE_CC_DATA_DIR = prevDataDir;
    if (prevHookStateDir == null) delete process.env.CE_CC_HOOK_STATE_DIR;
    else process.env.CE_CC_HOOK_STATE_DIR = prevHookStateDir;
  }
});

test('faucet proxy requires a stored worker token for the requested session', async () => {
  const root = mkdtempSync(resolve(tmpdir(), 'ce-router-faucet-missing-token-'));
  const dataDir = resolve(root, 'data');
  const hookStateDir = resolve(root, 'hook-state');
  const walletAddress = DEFAULT_TEST_WALLET_ADDRESS;
  mkdirSync(dataDir, { recursive: true });
  mkdirSync(hookStateDir, { recursive: true });

  const prevDataDir = process.env.CE_CC_DATA_DIR;
  const prevHookStateDir = process.env.CE_CC_HOOK_STATE_DIR;
  process.env.CE_CC_DATA_DIR = dataDir;
  process.env.CE_CC_HOOK_STATE_DIR = hookStateDir;

  try {
    const { handleRoute } = await importFresh(ROUTER_MODULE_PATH);
    const token = await issueLocalJwt(handleRoute, walletAddress);

    let fetchUrl = null;
    const res = makeMockRes();
    await handleRoute(
      makeLoopbackReq({ authorization: `Bearer ${token}` }),
      res,
      {
        url: new URL('http://localhost:7391/api/faucet'),
        method: 'POST',
        body: { session: 'test-10' },
      },
      {
        getCorsWorkerUrl: async () => 'https://worker.example.com',
        fetch: async (input) => {
          fetchUrl = String(input);
          return new Response('{}', {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        },
      },
    );

    assert.equal(fetchUrl, 'https://worker.example.com/auth/nonce');
    assert.equal(res.statusCode, 401);
    assert.deepEqual(
      JSON.parse(res.body || '{}'),
      { error: 'Session sign-in is missing. Re-authenticate in the local Context Engine UI.' },
    );
  } finally {
    if (prevDataDir == null) delete process.env.CE_CC_DATA_DIR;
    else process.env.CE_CC_DATA_DIR = prevDataDir;
    if (prevHookStateDir == null) delete process.env.CE_CC_HOOK_STATE_DIR;
    else process.env.CE_CC_HOOK_STATE_DIR = prevHookStateDir;
  }
});

test('faucet proxy fails when the session has no worker URL', async () => {
  const root = mkdtempSync(resolve(tmpdir(), 'ce-router-faucet-missing-worker-url-'));
  const dataDir = resolve(root, 'data');
  const hookStateDir = resolve(root, 'hook-state');
  const workerTokensDir = resolve(dataDir, 'worker-tokens');
  const walletAddress = DEFAULT_TEST_WALLET_ADDRESS;
  mkdirSync(dataDir, { recursive: true });
  mkdirSync(workerTokensDir, { recursive: true });
  mkdirSync(hookStateDir, { recursive: true });
  writeFileSync(
    resolve(workerTokensDir, 'test-10.jwt'),
    buildWorkerToken({
      sub: walletAddress,
      slug: 'test-10',
      exp: Math.floor(Date.now() / 1000) + 600,
    }),
  );

  const prevDataDir = process.env.CE_CC_DATA_DIR;
  const prevHookStateDir = process.env.CE_CC_HOOK_STATE_DIR;
  process.env.CE_CC_DATA_DIR = dataDir;
  process.env.CE_CC_HOOK_STATE_DIR = hookStateDir;

  try {
    const { handleRoute } = await importFresh(ROUTER_MODULE_PATH);
    const token = await issueLocalJwt(handleRoute, walletAddress);

    let fetchCalled = false;
    const res = makeMockRes();
    await handleRoute(
      makeLoopbackReq({ authorization: `Bearer ${token}` }),
      res,
      {
        url: new URL('http://localhost:7391/api/faucet'),
        method: 'POST',
        body: { session: 'test-10' },
      },
      {
        getCorsWorkerUrl: async () => null,
        fetch: async () => {
          fetchCalled = true;
          return new Response('{}', {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        },
      },
    );

    assert.equal(fetchCalled, false);
    assert.equal(res.statusCode, 400);
    assert.deepEqual(JSON.parse(res.body || '{}'), { error: 'No worker URL for session' });
  } finally {
    if (prevDataDir == null) delete process.env.CE_CC_DATA_DIR;
    else process.env.CE_CC_DATA_DIR = prevDataDir;
    if (prevHookStateDir == null) delete process.env.CE_CC_HOOK_STATE_DIR;
    else process.env.CE_CC_HOOK_STATE_DIR = prevHookStateDir;
  }
});

test('faucet proxy forwards worker status and body as-is', async () => {
  const root = mkdtempSync(resolve(tmpdir(), 'ce-router-faucet-proxy-'));
  const dataDir = resolve(root, 'data');
  const hookStateDir = resolve(root, 'hook-state');
  const workerTokensDir = resolve(dataDir, 'worker-tokens');
  const walletAddress = DEFAULT_TEST_WALLET_ADDRESS;
  const workerToken = buildWorkerToken({
    sub: walletAddress,
    slug: 'test-10',
    exp: Math.floor(Date.now() / 1000) + 600,
  });
  mkdirSync(workerTokensDir, { recursive: true });
  mkdirSync(hookStateDir, { recursive: true });
  writeFileSync(resolve(workerTokensDir, 'test-10.jwt'), workerToken);

  const prevDataDir = process.env.CE_CC_DATA_DIR;
  const prevHookStateDir = process.env.CE_CC_HOOK_STATE_DIR;
  process.env.CE_CC_DATA_DIR = dataDir;
  process.env.CE_CC_HOOK_STATE_DIR = hookStateDir;

  try {
    const { handleRoute } = await importFresh(ROUTER_MODULE_PATH);
    const token = await issueLocalJwt(handleRoute, walletAddress);

    let fetchArgs = null;
    const upstreamBody = JSON.stringify({ ok: false, error: 'Rate limited' });
    const res = makeMockRes();
    await handleRoute(
      makeLoopbackReq({ authorization: `Bearer ${token}` }),
      res,
      {
        url: new URL('http://localhost:7391/api/faucet'),
        method: 'POST',
        body: { session: 'test-10' },
      },
      {
        getCorsWorkerUrl: async () => 'https://worker.example.com/base/',
        fetch: async (input, init) => {
          fetchArgs = { input, init };
          return new Response(upstreamBody, {
            status: 429,
            headers: { 'Content-Type': 'application/json; charset=utf-8' },
          });
        },
      },
    );

    assert.equal(fetchArgs.input, 'https://worker.example.com/base/test-10');
    assert.equal(fetchArgs.init.method, 'POST');
    assert.equal(fetchArgs.init.headers.Authorization, `Bearer ${workerToken}`);
    assert.deepEqual(
      JSON.parse(fetchArgs.init.body),
      { action: 'request_test_eth', to: walletAddress.toLowerCase() },
    );
    assert.equal(res.statusCode, 429);
    assert.equal(res.headers['Content-Type'], 'application/json; charset=utf-8');
    assert.equal(res.body, upstreamBody);
  } finally {
    if (prevDataDir == null) delete process.env.CE_CC_DATA_DIR;
    else process.env.CE_CC_DATA_DIR = prevDataDir;
    if (prevHookStateDir == null) delete process.env.CE_CC_HOOK_STATE_DIR;
    else process.env.CE_CC_HOOK_STATE_DIR = prevHookStateDir;
  }
});

test('faucet proxy forwards optional SBT proof payload fields to the worker', async () => {
  const root = mkdtempSync(resolve(tmpdir(), 'ce-router-faucet-proof-forward-'));
  const dataDir = resolve(root, 'data');
  const hookStateDir = resolve(root, 'hook-state');
  const workerTokensDir = resolve(dataDir, 'worker-tokens');
  const walletAddress = DEFAULT_TEST_WALLET_ADDRESS;
  const sbtAddress = '0x2222222222222222222222222222222222222222';
  const hashedPassword = `0x${'ab'.repeat(32)}`;
  const signature = `0x${'cd'.repeat(65)}`;
  const workerToken = buildWorkerToken({
    sub: walletAddress,
    slug: 'test-10',
    exp: Math.floor(Date.now() / 1000) + 600,
  });
  mkdirSync(workerTokensDir, { recursive: true });
  mkdirSync(hookStateDir, { recursive: true });
  writeFileSync(resolve(workerTokensDir, 'test-10.jwt'), workerToken);

  const prevDataDir = process.env.CE_CC_DATA_DIR;
  const prevHookStateDir = process.env.CE_CC_HOOK_STATE_DIR;
  process.env.CE_CC_DATA_DIR = dataDir;
  process.env.CE_CC_HOOK_STATE_DIR = hookStateDir;

  try {
    const { handleRoute } = await importFresh(ROUTER_MODULE_PATH);
    const token = await issueLocalJwt(handleRoute, walletAddress);

    let fetchArgs = null;
    const res = makeMockRes();
    await handleRoute(
      makeLoopbackReq({ authorization: `Bearer ${token}` }),
      res,
      {
        url: new URL('http://localhost:7391/api/faucet'),
        method: 'POST',
        body: {
          session: 'test-10',
          amountEth: '0.0000001',
          sbtAddress,
          hashedPassword,
          signature,
        },
      },
      {
        getCorsWorkerUrl: async () => 'https://worker.example.com/base/',
        fetch: async (input, init) => {
          fetchArgs = { input, init };
          return new Response(JSON.stringify({ ok: true, txHash: '0xproof123' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        },
      },
    );

    assert.equal(fetchArgs.input, 'https://worker.example.com/base/test-10');
    assert.deepEqual(
      JSON.parse(fetchArgs.init.body),
      {
        action: 'request_test_eth',
        to: walletAddress.toLowerCase(),
        amountEth: '0.0000001',
        sbtAddress,
        hashedPassword,
        signature,
      },
    );
    assert.equal(res.statusCode, 200);
    assert.equal(JSON.parse(res.body || '{}').txHash, '0xproof123');
  } finally {
    if (prevDataDir == null) delete process.env.CE_CC_DATA_DIR;
    else process.env.CE_CC_DATA_DIR = prevDataDir;
    if (prevHookStateDir == null) delete process.env.CE_CC_HOOK_STATE_DIR;
    else process.env.CE_CC_HOOK_STATE_DIR = prevHookStateDir;
  }
});

test('worker-token storage rejects tokens that do not match the authenticated wallet', async () => {
  const root = mkdtempSync(resolve(tmpdir(), 'ce-router-worker-token-wallet-mismatch-'));
  const dataDir = resolve(root, 'data');
  const hookStateDir = resolve(root, 'hook-state');
  const walletAddress = DEFAULT_TEST_WALLET_ADDRESS;
  mkdirSync(dataDir, { recursive: true });
  mkdirSync(hookStateDir, { recursive: true });

  const prevDataDir = process.env.CE_CC_DATA_DIR;
  const prevHookStateDir = process.env.CE_CC_HOOK_STATE_DIR;
  process.env.CE_CC_DATA_DIR = dataDir;
  process.env.CE_CC_HOOK_STATE_DIR = hookStateDir;

  try {
    const { handleRoute } = await importFresh(ROUTER_MODULE_PATH);
    const token = await issueLocalJwt(handleRoute, walletAddress);
    const res = makeMockRes();
    await handleRoute(
      makeLoopbackReq({ authorization: `Bearer ${token}` }),
      res,
      {
        url: new URL('http://localhost:7391/api/auth/worker-token'),
        method: 'POST',
        body: {
          session: 'alpha',
          workerToken: buildWorkerToken({
            sub: '0x2222222222222222222222222222222222222222',
            slug: 'alpha',
            exp: Math.floor(Date.now() / 1000) + 600,
          }),
        },
      },
    );

    assert.equal(res.statusCode, 400);
    assert.match(String(JSON.parse(res.body || '{}').error || ''), /authenticated wallet/i);
  } finally {
    if (prevDataDir == null) delete process.env.CE_CC_DATA_DIR;
    else process.env.CE_CC_DATA_DIR = prevDataDir;
    if (prevHookStateDir == null) delete process.env.CE_CC_HOOK_STATE_DIR;
    else process.env.CE_CC_HOOK_STATE_DIR = prevHookStateDir;
  }
});

test('worker-token storage auto-submits matching pending responses on login by default and keeps them locked from duplicate manual submit', async () => {
  const root = mkdtempSync(resolve(tmpdir(), 'ce-router-worker-token-auto-submit-login-'));
  const dataDir = resolve(root, 'data');
  const hookStateDir = resolve(root, 'hook-state');
  const responsesDir = resolve(dataDir, 'responses', 'alpha');
  const walletAddress = DEFAULT_TEST_WALLET_ADDRESS;
  const otherWallet = '0x2222222222222222222222222222222222222222';
  const questionId = '0x' + 'ab'.repeat(32);
  const otherQuestionId = '0x' + 'cd'.repeat(32);
  mkdirSync(responsesDir, { recursive: true });
  mkdirSync(hookStateDir, { recursive: true });
  writeFileSync(
    resolve(responsesDir, `${questionId}.json`),
    JSON.stringify({
      questionId,
      respondent: walletAddress,
      answer: 'submit me',
      submitted: false,
    }, null, 2),
  );
  writeFileSync(
    resolve(responsesDir, `${otherQuestionId}.json`),
    JSON.stringify({
      questionId: otherQuestionId,
      respondent: otherWallet,
      answer: 'leave pending',
      submitted: false,
    }, null, 2),
  );

  const prevDataDir = process.env.CE_CC_DATA_DIR;
  const prevHookStateDir = process.env.CE_CC_HOOK_STATE_DIR;
  process.env.CE_CC_DATA_DIR = dataDir;
  process.env.CE_CC_HOOK_STATE_DIR = hookStateDir;
  const restoreDebugLogging = enableDebugLogging();

  const logs = [];
  const originalLog = console.log;
  console.log = (...args) => logs.push(args.map((value) => String(value)).join(' '));

  let submitInvocation = null;
  let submitCallCount = 0;
  let resolveSubmit;
  const submitDone = new Promise((resolve) => {
    resolveSubmit = () => resolve({
      ok: true,
      txHash: '0xautosubmit',
      blockNumber: 123,
      arweaveTxIds: ['tx-auto-login'],
      surveyArweaveTxId: 'survey-auto-login',
    });
  });

  try {
    const { handleRoute } = await importFresh(ROUTER_MODULE_PATH);
    const token = await issueLocalJwt(handleRoute, walletAddress);
    const res = makeMockRes();

    await handleRoute(
      makeLoopbackReq({ authorization: `Bearer ${token}` }),
      res,
      {
        url: new URL('http://localhost:7391/api/auth/worker-token'),
        method: 'POST',
        body: {
          session: 'alpha',
          workerToken: buildWorkerToken({
            sub: walletAddress,
            slug: 'alpha',
            exp: Math.floor(Date.now() / 1000) + 600,
          }),
        },
      },
      {
        submitOnChain: async (pending, slug, workerToken) => {
          submitCallCount += 1;
          submitInvocation = { pending, slug, workerToken };
          return submitDone;
        },
      },
    );

    assert.equal(res.statusCode, 200);
    assert.deepEqual(JSON.parse(res.body || '{}'), { ok: true, session: 'alpha' });
    assert.ok(submitInvocation);
    assert.equal(submitInvocation.slug, 'alpha');
    assert.equal(submitInvocation.workerToken.includes('.sig'), true);
    assert.equal(submitInvocation.pending.length, 1);
    assert.equal(submitInvocation.pending[0].questionId, questionId);
    assert.equal(submitCallCount, 1);

    const manualSubmitRes = makeMockRes();
    await handleRoute(
      makeLoopbackReq({ authorization: `Bearer ${token}` }),
      manualSubmitRes,
      {
        url: new URL('http://localhost:7391/api/responses/submit-onchain'),
        method: 'POST',
        body: {
          session: 'alpha',
        },
      },
      {
        canSubmit: () => ({ ready: true, hasKey: true, hasContract: true }),
        submitOnChain: async (pending, slug, workerToken) => {
          submitCallCount += 1;
          submitInvocation = { pending, slug, workerToken };
          return submitDone;
        },
      },
    );

    assert.equal(manualSubmitRes.statusCode, 200);
    assert.deepEqual(JSON.parse(manualSubmitRes.body || '{}'), {
      ok: true,
      count: 0,
      message: 'No pending responses to submit.',
    });
    assert.equal(submitCallCount, 1);

    const pendingBeforeBackgroundCompletes = JSON.parse(
      readFileSync(resolve(responsesDir, `${questionId}.json`), 'utf8'),
    );
    assert.equal(pendingBeforeBackgroundCompletes.submitted, false);

    resolveSubmit();
    await flushBackgroundWork();
    await flushBackgroundWork();

    const storedResponse = JSON.parse(readFileSync(resolve(responsesDir, `${questionId}.json`), 'utf8'));
    const untouchedResponse = JSON.parse(readFileSync(resolve(responsesDir, `${otherQuestionId}.json`), 'utf8'));
    assert.equal(storedResponse.submitted, true);
    assert.equal(storedResponse.txHash, '0xautosubmit');
    assert.equal(storedResponse.blockNumber, 123);
    assert.equal(storedResponse.arweaveTxId, 'tx-auto-login');
    assert.deepEqual(storedResponse.storageRef, {
      backend: 'arweave',
      id: 'tx-auto-login',
      uri: 'ar://tx-auto-login',
      resource: 'responses',
    });
    assert.equal(storedResponse.surveyArweaveTxId, 'survey-auto-login');
    assert.deepEqual(storedResponse.surveyStorageRef, {
      backend: 'arweave',
      id: 'survey-auto-login',
      uri: 'ar://survey-auto-login',
      resource: 'responses',
    });
    assert.equal(typeof storedResponse.submittedAt, 'string');
    assert.equal(untouchedResponse.submitted, false);
    assert.equal(untouchedResponse.txHash, undefined);
    assert.equal(readFileSync(resolve(dataDir, 'worker-tokens', 'alpha.jwt'), 'utf8').trim().length > 0, true);
    assertSecureMode(resolve(dataDir, 'worker-tokens', 'alpha.jwt'));
    assert.equal(
      logs.some((entry) => entry.includes('[router] Auto-submitted 1 pending response on login for alpha → tx 0xautosubmit')),
      true,
    );
  } finally {
    console.log = originalLog;
    restoreDebugLogging();
    if (prevDataDir == null) delete process.env.CE_CC_DATA_DIR;
    else process.env.CE_CC_DATA_DIR = prevDataDir;
    if (prevHookStateDir == null) delete process.env.CE_CC_HOOK_STATE_DIR;
    else process.env.CE_CC_HOOK_STATE_DIR = prevHookStateDir;
  }
});

test('config autoSubmitOnLogin=false disables login auto-submit for worker-token storage', async () => {
  const root = mkdtempSync(resolve(tmpdir(), 'ce-router-worker-token-auto-submit-disabled-'));
  const dataDir = resolve(root, 'data');
  const hookStateDir = resolve(root, 'hook-state');
  const responsesDir = resolve(dataDir, 'responses', 'alpha');
  const walletAddress = DEFAULT_TEST_WALLET_ADDRESS;
  const questionId = '0x' + 'ef'.repeat(32);
  mkdirSync(responsesDir, { recursive: true });
  mkdirSync(hookStateDir, { recursive: true });
  writeFileSync(
    resolve(responsesDir, `${questionId}.json`),
    JSON.stringify({
      questionId,
      respondent: walletAddress,
      answer: 'stay pending',
      submitted: false,
    }, null, 2),
  );

  const prevDataDir = process.env.CE_CC_DATA_DIR;
  const prevHookStateDir = process.env.CE_CC_HOOK_STATE_DIR;
  process.env.CE_CC_DATA_DIR = dataDir;
  process.env.CE_CC_HOOK_STATE_DIR = hookStateDir;

  let submitCalled = false;
  try {
    const { handleRoute } = await importFresh(ROUTER_MODULE_PATH);
    const token = await issueLocalJwt(handleRoute, walletAddress);

    const configRes = makeMockRes();
    await handleRoute(
      makeLoopbackReq({ authorization: `Bearer ${token}` }),
      configRes,
      {
        url: new URL('http://localhost:7391/api/config'),
        method: 'POST',
        body: {
          autoSubmitOnLogin: false,
        },
      },
    );

    assert.equal(configRes.statusCode, 200);
    assert.equal(JSON.parse(configRes.body || '{}').config.autoSubmitOnLogin, false);
    assert.equal(
      JSON.parse(readFileSync(resolve(hookStateDir, 'config.json'), 'utf8')).autoSubmitOnLogin,
      false,
    );

    const res = makeMockRes();
    await handleRoute(
      makeLoopbackReq({ authorization: `Bearer ${token}` }),
      res,
      {
        url: new URL('http://localhost:7391/api/auth/worker-token'),
        method: 'POST',
        body: {
          session: 'alpha',
          workerToken: buildWorkerToken({
            sub: walletAddress,
            slug: 'alpha',
            exp: Math.floor(Date.now() / 1000) + 600,
          }),
        },
      },
      {
        submitOnChain: async () => {
          submitCalled = true;
          return { ok: true, txHash: '0xshouldnotrun', blockNumber: 1 };
        },
      },
    );

    await flushBackgroundWork();

    assert.equal(res.statusCode, 200);
    assert.equal(submitCalled, false);
    assert.equal(
      JSON.parse(readFileSync(resolve(responsesDir, `${questionId}.json`), 'utf8')).submitted,
      false,
    );
  } finally {
    if (prevDataDir == null) delete process.env.CE_CC_DATA_DIR;
    else process.env.CE_CC_DATA_DIR = prevDataDir;
    if (prevHookStateDir == null) delete process.env.CE_CC_HOOK_STATE_DIR;
    else process.env.CE_CC_HOOK_STATE_DIR = prevHookStateDir;
  }
});

test('config API strips legacy defaultConviction values from responses and saved config', async () => {
  const root = mkdtempSync(resolve(tmpdir(), 'ce-router-config-drop-conviction-'));
  const dataDir = resolve(root, 'data');
  const hookStateDir = resolve(root, 'hook-state');
  const walletAddress = DEFAULT_TEST_WALLET_ADDRESS;
  mkdirSync(dataDir, { recursive: true });
  mkdirSync(hookStateDir, { recursive: true });
  writeFileSync(
    resolve(hookStateDir, 'config.json'),
    JSON.stringify({
      serverUrl: 'http://localhost:7391',
      defaultSession: 'alpha',
      selectedSessions: ['alpha'],
      defaultConviction: 'high',
    }, null, 2),
  );

  const prevDataDir = process.env.CE_CC_DATA_DIR;
  const prevHookStateDir = process.env.CE_CC_HOOK_STATE_DIR;
  process.env.CE_CC_DATA_DIR = dataDir;
  process.env.CE_CC_HOOK_STATE_DIR = hookStateDir;

  try {
    const { handleRoute } = await importFresh(ROUTER_MODULE_PATH);
    const token = await issueLocalJwt(handleRoute, walletAddress);

    const getRes = makeMockRes();
    await handleRoute(
      makeLoopbackReq({ authorization: `Bearer ${token}` }),
      getRes,
      {
        url: new URL('http://localhost:7391/api/config'),
        method: 'GET',
        body: {},
      },
    );

    assert.equal(getRes.statusCode, 200);
    assert.equal('defaultConviction' in JSON.parse(getRes.body || '{}'), false);

    const postRes = makeMockRes();
    await handleRoute(
      makeLoopbackReq({ authorization: `Bearer ${token}` }),
      postRes,
      {
        url: new URL('http://localhost:7391/api/config'),
        method: 'POST',
        body: {
          showImportance: true,
        },
      },
    );

    assert.equal(postRes.statusCode, 200);
    assert.equal('defaultConviction' in JSON.parse(postRes.body || '{}').config, false);
    assert.equal(
      'defaultConviction' in JSON.parse(readFileSync(resolve(hookStateDir, 'config.json'), 'utf8')),
      false,
    );
  } finally {
    if (prevDataDir == null) delete process.env.CE_CC_DATA_DIR;
    else process.env.CE_CC_DATA_DIR = prevDataDir;
    if (prevHookStateDir == null) delete process.env.CE_CC_HOOK_STATE_DIR;
    else process.env.CE_CC_HOOK_STATE_DIR = prevHookStateDir;
  }
});

test('config API exposes and validates question surfacing settings', async () => {
  const root = mkdtempSync(resolve(tmpdir(), 'ce-router-config-surfacing-'));
  const dataDir = resolve(root, 'data');
  const hookStateDir = resolve(root, 'hook-state');
  const walletAddress = DEFAULT_TEST_WALLET_ADDRESS;
  mkdirSync(dataDir, { recursive: true });
  mkdirSync(hookStateDir, { recursive: true });

  const prevDataDir = process.env.CE_CC_DATA_DIR;
  const prevHookStateDir = process.env.CE_CC_HOOK_STATE_DIR;
  process.env.CE_CC_DATA_DIR = dataDir;
  process.env.CE_CC_HOOK_STATE_DIR = hookStateDir;

  try {
    const { handleRoute } = await importFresh(ROUTER_MODULE_PATH);
    const token = await issueLocalJwt(handleRoute, walletAddress);

    const getRes = makeMockRes();
    await handleRoute(
      makeLoopbackReq({ authorization: `Bearer ${token}` }),
      getRes,
      {
        url: new URL('http://localhost:7391/api/config'),
        method: 'GET',
        body: {},
      },
    );

    assert.equal(getRes.statusCode, 200);
    const defaultConfig = JSON.parse(getRes.body || '{}');
    assert.equal(defaultConfig.questionSurfacingMode, 'manual');
    assert.equal(defaultConfig.ambientInterruptions, false);
    assert.equal(defaultConfig.statuslineQuestionHints, true);

    const postRes = makeMockRes();
    await handleRoute(
      makeLoopbackReq({ authorization: `Bearer ${token}` }),
      postRes,
      {
        url: new URL('http://localhost:7391/api/config'),
        method: 'POST',
        body: {
          questionSurfacingMode: 'ambient',
          ambientInterruptions: true,
          statuslineQuestionHints: false,
        },
      },
    );

    assert.equal(postRes.statusCode, 200);
    const updatedConfig = JSON.parse(postRes.body || '{}').config;
    assert.equal(updatedConfig.questionSurfacingMode, 'ambient');
    assert.equal(updatedConfig.ambientInterruptions, true);
    assert.equal(updatedConfig.statuslineQuestionHints, false);
    assert.deepEqual(
      {
        questionSurfacingMode: JSON.parse(readFileSync(resolve(hookStateDir, 'config.json'), 'utf8')).questionSurfacingMode,
        ambientInterruptions: JSON.parse(readFileSync(resolve(hookStateDir, 'config.json'), 'utf8')).ambientInterruptions,
        statuslineQuestionHints: JSON.parse(readFileSync(resolve(hookStateDir, 'config.json'), 'utf8')).statuslineQuestionHints,
      },
      {
        questionSurfacingMode: 'ambient',
        ambientInterruptions: true,
        statuslineQuestionHints: false,
      },
    );

    const invalidRes = makeMockRes();
    await handleRoute(
      makeLoopbackReq({ authorization: `Bearer ${token}` }),
      invalidRes,
      {
        url: new URL('http://localhost:7391/api/config'),
        method: 'POST',
        body: {
          questionSurfacingMode: 'surprise-me',
        },
      },
    );

    assert.equal(invalidRes.statusCode, 400);
    assert.match(JSON.parse(invalidRes.body || '{}').error, /questionSurfacingMode/);
  } finally {
    if (prevDataDir == null) delete process.env.CE_CC_DATA_DIR;
    else process.env.CE_CC_DATA_DIR = prevDataDir;
    if (prevHookStateDir == null) delete process.env.CE_CC_HOOK_STATE_DIR;
    else process.env.CE_CC_HOOK_STATE_DIR = prevHookStateDir;
  }
});

test('hook question compact presentation omits formatted output and prior response text', async () => {
  const root = mkdtempSync(resolve(tmpdir(), 'ce-router-hook-question-compact-'));
  const dataDir = resolve(root, 'data');
  const hookStateDir = resolve(root, 'hook-state');
  const walletAddress = DEFAULT_TEST_WALLET_ADDRESS;
  const questionId = '0x' + 'bc'.repeat(32);
  mkdirSync(dataDir, { recursive: true });
  mkdirSync(hookStateDir, { recursive: true });
  mkdirSync(resolve(dataDir, 'responses', 'alpha'), { recursive: true });
  writeFileSync(
    resolve(dataDir, 'responses', 'alpha', `${'0x' + 'de'.repeat(32)}.json`),
    JSON.stringify({
      questionId: '0x' + 'de'.repeat(32),
      questionType: 'freeform',
      answer: 'previous answer text',
      respondent: walletAddress,
      timestamp: '2026-04-23T00:00:00.000Z',
    }, null, 2),
  );

  const prevDataDir = process.env.CE_CC_DATA_DIR;
  const prevHookStateDir = process.env.CE_CC_HOOK_STATE_DIR;
  process.env.CE_CC_DATA_DIR = dataDir;
  process.env.CE_CC_HOOK_STATE_DIR = hookStateDir;

  let seenOpts = null;
  try {
    const { handleRoute } = await importFresh(ROUTER_MODULE_PATH);
    const token = await issueLocalJwt(handleRoute, walletAddress);

    const res = makeMockRes();
    await handleRoute(
      makeLoopbackReq({ authorization: `Bearer ${token}` }),
      res,
      {
        url: new URL('http://localhost:7391/api/hook/question?session=alpha&presentation=compact&peek=1'),
        method: 'GET',
        body: {},
      },
      {
        getSessionMetadata: async () => null,
        getRandomUnseen: async (_slug, opts) => {
          seenOpts = opts;
          return {
            answeredCount: 1,
            totalCount: 3,
            question: {
              id: questionId,
              type: 'freeform',
              prompt: 'A compact prompt',
              options: [],
              tags: ['compact'],
            },
          };
        },
      },
    );

    assert.equal(res.statusCode, 200);
    assert.equal(seenOpts.peek, true);
    const body = JSON.parse(res.body || '{}');
    assert.equal(body.presentation, 'compact');
    assert.equal(body.formatted, undefined);
    assert.equal(body.question.id, questionId);
    assert.equal(body.question.prompt, 'A compact prompt');
    assert.equal(body.question.session, 'alpha');
    assert.equal(body.recentResponses, undefined);
    assert.equal(body.recentResponseCount, undefined);
    assert.equal(body.aiSuggestFreeform, undefined);
  } finally {
    if (prevDataDir == null) delete process.env.CE_CC_DATA_DIR;
    else process.env.CE_CC_DATA_DIR = prevDataDir;
    if (prevHookStateDir == null) delete process.env.CE_CC_HOOK_STATE_DIR;
    else process.env.CE_CC_HOOK_STATE_DIR = prevHookStateDir;
  }
});

test('config accepts clearing selectedSessions with an explicit empty defaultSession', async () => {
  const root = mkdtempSync(resolve(tmpdir(), 'ce-router-config-clear-selection-'));
  const dataDir = resolve(root, 'data');
  const hookStateDir = resolve(root, 'hook-state');
  const walletAddress = DEFAULT_TEST_WALLET_ADDRESS;
  mkdirSync(dataDir, { recursive: true });
  mkdirSync(hookStateDir, { recursive: true });
  writeFileSync(
    resolve(hookStateDir, 'config.json'),
    JSON.stringify({
      serverUrl: 'http://localhost:7391',
      defaultSession: 'alpha',
      selectedSessions: ['alpha'],
    }, null, 2),
  );

  const prevDataDir = process.env.CE_CC_DATA_DIR;
  const prevHookStateDir = process.env.CE_CC_HOOK_STATE_DIR;
  process.env.CE_CC_DATA_DIR = dataDir;
  process.env.CE_CC_HOOK_STATE_DIR = hookStateDir;

  try {
    const { handleRoute } = await importFresh(ROUTER_MODULE_PATH);
    const token = await issueLocalJwt(handleRoute, walletAddress);
    const res = makeMockRes();
    await handleRoute(
      makeLoopbackReq({ authorization: `Bearer ${token}` }),
      res,
      {
        url: new URL('http://localhost:7391/api/config'),
        method: 'POST',
        body: {
          selectedSessions: [],
          defaultSession: '',
        },
      },
    );

    assert.equal(res.statusCode, 200);
    assert.deepEqual(JSON.parse(res.body || '{}').config.selectedSessions, []);
    assert.equal(JSON.parse(res.body || '{}').config.defaultSession, '');
    assert.deepEqual(
      JSON.parse(readFileSync(resolve(hookStateDir, 'config.json'), 'utf8')),
      {
        serverUrl: 'http://localhost:7391',
        defaultSession: '',
        selectedSessions: [],
        questionSurfacingMode: 'manual',
        ambientInterruptions: false,
        statuslineQuestionHints: true,
      },
    );
  } finally {
    if (prevDataDir == null) delete process.env.CE_CC_DATA_DIR;
    else process.env.CE_CC_DATA_DIR = prevDataDir;
    if (prevHookStateDir == null) delete process.env.CE_CC_HOOK_STATE_DIR;
    else process.env.CE_CC_HOOK_STATE_DIR = prevHookStateDir;
  }
});

test('config preserves explicit default-session selections in selectedSessions', async () => {
  const root = mkdtempSync(resolve(tmpdir(), 'ce-router-config-default-selection-'));
  const dataDir = resolve(root, 'data');
  const hookStateDir = resolve(root, 'hook-state');
  const walletAddress = DEFAULT_TEST_WALLET_ADDRESS;
  mkdirSync(dataDir, { recursive: true });
  mkdirSync(hookStateDir, { recursive: true });
  writeFileSync(
    resolve(hookStateDir, 'config.json'),
    JSON.stringify({
      serverUrl: 'http://localhost:7391',
      defaultSession: 'alpha',
      selectedSessions: ['alpha'],
    }, null, 2),
  );

  const prevDataDir = process.env.CE_CC_DATA_DIR;
  const prevHookStateDir = process.env.CE_CC_HOOK_STATE_DIR;
  process.env.CE_CC_DATA_DIR = dataDir;
  process.env.CE_CC_HOOK_STATE_DIR = hookStateDir;

  try {
    const { handleRoute } = await importFresh(ROUTER_MODULE_PATH);
    const token = await issueLocalJwt(handleRoute, walletAddress);
    const res = makeMockRes();
    await handleRoute(
      makeLoopbackReq({ authorization: `Bearer ${token}` }),
      res,
      {
        url: new URL('http://localhost:7391/api/config'),
        method: 'POST',
        body: {
          selectedSessions: [''],
          defaultSession: '',
        },
      },
    );

    assert.equal(res.statusCode, 200);
    assert.deepEqual(JSON.parse(res.body || '{}').config.selectedSessions, ['']);
    assert.equal(JSON.parse(res.body || '{}').config.defaultSession, '');
    assert.deepEqual(
      JSON.parse(readFileSync(resolve(hookStateDir, 'config.json'), 'utf8')),
      {
        serverUrl: 'http://localhost:7391',
        defaultSession: '',
        selectedSessions: [''],
        questionSurfacingMode: 'manual',
        ambientInterruptions: false,
        statuslineQuestionHints: true,
      },
    );
  } finally {
    if (prevDataDir == null) delete process.env.CE_CC_DATA_DIR;
    else process.env.CE_CC_DATA_DIR = prevDataDir;
    if (prevHookStateDir == null) delete process.env.CE_CC_HOOK_STATE_DIR;
    else process.env.CE_CC_HOOK_STATE_DIR = prevHookStateDir;
  }
});

test('default-session routes accept explicit empty session slugs', async () => {
  const root = mkdtempSync(resolve(tmpdir(), 'ce-router-default-session-routes-'));
  const dataDir = resolve(root, 'data');
  const hookStateDir = resolve(root, 'hook-state');
  const workerTokensDir = resolve(dataDir, 'worker-tokens');
  const responsesDir = resolve(dataDir, 'responses');
  const walletAddress = DEFAULT_TEST_WALLET_ADDRESS;
  const questionId = '0x' + 'ef'.repeat(32);
  mkdirSync(workerTokensDir, { recursive: true });
  mkdirSync(responsesDir, { recursive: true });
  mkdirSync(hookStateDir, { recursive: true });
  writeFileSync(resolve(dataDir, 'wallet.key'), DEFAULT_TEST_WALLET.privateKey);

  const prevDataDir = process.env.CE_CC_DATA_DIR;
  const prevHookStateDir = process.env.CE_CC_HOOK_STATE_DIR;
  process.env.CE_CC_DATA_DIR = dataDir;
  process.env.CE_CC_HOOK_STATE_DIR = hookStateDir;

  try {
    const { handleRoute } = await importFresh(ROUTER_MODULE_PATH);
    const token = await issueLocalJwt(handleRoute, walletAddress);

    const workerTokenRes = makeMockRes();
    await handleRoute(
      makeLoopbackReq({ authorization: `Bearer ${token}` }),
      workerTokenRes,
      {
        url: new URL('http://localhost:7391/api/auth/worker-token'),
        method: 'POST',
        body: {
          session: '',
          workerToken: buildWorkerToken({
            sub: walletAddress,
            slug: '',
            exp: Math.floor(Date.now() / 1000) + 600,
          }),
        },
      },
      {
        submitOnChain: async () => {
          throw new Error('auto-submit should not run for this default-session regression test');
        },
      },
    );

    assert.equal(workerTokenRes.statusCode, 200);
    assert.equal(existsSync(resolve(workerTokensDir, '.jwt')), true);

    const respondRes = makeMockRes();
    await handleRoute(
      makeLoopbackReq({ authorization: `Bearer ${token}` }),
      respondRes,
      {
        url: new URL('http://localhost:7391/api/respond'),
        method: 'POST',
        body: {
          questionId,
          session: '',
          answer: 'hello default session',
          questionType: 'freeform',
        },
      },
    );

    assert.equal(respondRes.statusCode, 200);
    assert.equal(existsSync(resolve(responsesDir, `${questionId}.json`)), true);

    const pendingRes = makeMockRes();
    await handleRoute(
      makeLoopbackReq({ authorization: `Bearer ${token}` }),
      pendingRes,
      {
        url: new URL('http://localhost:7391/api/responses/pending?session='),
        method: 'GET',
        body: null,
      },
    );

    assert.equal(pendingRes.statusCode, 200);
    assert.equal(JSON.parse(pendingRes.body || '{}').count, 1);

    let submitInvocation = null;
    const submitRes = makeMockRes();
    await handleRoute(
      makeLoopbackReq({ authorization: `Bearer ${token}` }),
      submitRes,
      {
        url: new URL('http://localhost:7391/api/responses/submit-onchain'),
        method: 'POST',
        body: { session: '' },
      },
      {
        canSubmit: () => ({ ready: true, hasKey: true, hasContract: true }),
        submitOnChain: async (pending, slug, workerToken) => {
          submitInvocation = { pending, slug, workerToken };
          return {
            ok: true,
            txHash: '0xdefaultsession',
            arweaveTxIds: ['tx-default'],
            count: pending.length,
          };
        },
      },
    );

    assert.equal(submitRes.statusCode, 200);
    assert.equal(submitInvocation?.slug, '');
    assert.equal(submitInvocation?.workerToken?.length > 0, true);
    assert.equal(submitInvocation?.pending?.length, 1);
    assert.equal(
      JSON.parse(readFileSync(resolve(responsesDir, `${questionId}.json`), 'utf8')).submitted,
      true,
    );
  } finally {
    if (prevDataDir == null) delete process.env.CE_CC_DATA_DIR;
    else process.env.CE_CC_DATA_DIR = prevDataDir;
    if (prevHookStateDir == null) delete process.env.CE_CC_HOOK_STATE_DIR;
    else process.env.CE_CC_HOOK_STATE_DIR = prevHookStateDir;
  }
});

test('pending responses rejects invalid session slugs before touching the filesystem', async () => {
  const root = mkdtempSync(resolve(tmpdir(), 'ce-router-pending-invalid-session-'));
  const dataDir = resolve(root, 'data');
  const hookStateDir = resolve(root, 'hook-state');
  const walletAddress = DEFAULT_TEST_WALLET_ADDRESS;
  mkdirSync(dataDir, { recursive: true });
  mkdirSync(hookStateDir, { recursive: true });

  const prevDataDir = process.env.CE_CC_DATA_DIR;
  const prevHookStateDir = process.env.CE_CC_HOOK_STATE_DIR;
  process.env.CE_CC_DATA_DIR = dataDir;
  process.env.CE_CC_HOOK_STATE_DIR = hookStateDir;

  try {
    const { handleRoute } = await importFresh(ROUTER_MODULE_PATH);
    const token = await issueLocalJwt(handleRoute, walletAddress);
    const res = makeMockRes();
    await handleRoute(
      makeLoopbackReq({ authorization: `Bearer ${token}` }),
      res,
      {
        url: new URL('http://localhost:7391/api/responses/pending?session=..%2F..%2Foutside'),
        method: 'GET',
        body: {},
      },
    );

    assert.equal(res.statusCode, 400);
    assert.deepEqual(JSON.parse(res.body || '{}'), { error: 'Invalid session slug.' });
  } finally {
    if (prevDataDir == null) delete process.env.CE_CC_DATA_DIR;
    else process.env.CE_CC_DATA_DIR = prevDataDir;
    if (prevHookStateDir == null) delete process.env.CE_CC_HOOK_STATE_DIR;
    else process.env.CE_CC_HOOK_STATE_DIR = prevHookStateDir;
  }
});

test('respond rejects non-bytes32 question ids', async () => {
  const root = mkdtempSync(resolve(tmpdir(), 'ce-router-respond-invalid-question-id-'));
  const dataDir = resolve(root, 'data');
  const hookStateDir = resolve(root, 'hook-state');
  const walletAddress = DEFAULT_TEST_WALLET_ADDRESS;
  mkdirSync(dataDir, { recursive: true });
  mkdirSync(hookStateDir, { recursive: true });

  const prevDataDir = process.env.CE_CC_DATA_DIR;
  const prevHookStateDir = process.env.CE_CC_HOOK_STATE_DIR;
  process.env.CE_CC_DATA_DIR = dataDir;
  process.env.CE_CC_HOOK_STATE_DIR = hookStateDir;

  try {
    const { handleRoute } = await importFresh(ROUTER_MODULE_PATH);
    const token = await issueLocalJwt(handleRoute, walletAddress);
    const res = makeMockRes();
    await handleRoute(
      makeLoopbackReq({ authorization: `Bearer ${token}` }),
      res,
      {
        url: new URL('http://localhost:7391/api/respond'),
        method: 'POST',
        body: {
          session: 'alpha',
          questionId: 'not-a-question-id',
          questionType: 'freeform',
          answer: 'hello',
        },
      },
    );

    assert.equal(res.statusCode, 400);
    assert.deepEqual(
      JSON.parse(res.body || '{}'),
      { error: 'questionId must be a 32-byte hex string.' },
    );
  } finally {
    if (prevDataDir == null) delete process.env.CE_CC_DATA_DIR;
    else process.env.CE_CC_DATA_DIR = prevDataDir;
    if (prevHookStateDir == null) delete process.env.CE_CC_HOOK_STATE_DIR;
    else process.env.CE_CC_HOOK_STATE_DIR = prevHookStateDir;
  }
});

test('submit-onchain rejects when no worker token is stored instead of reusing the local JWT', async () => {
  const root = mkdtempSync(resolve(tmpdir(), 'ce-router-submit-onchain-no-worker-token-'));
  const dataDir = resolve(root, 'data');
  const hookStateDir = resolve(root, 'hook-state');
  const responsesDir = resolve(dataDir, 'responses', 'alpha');
  const walletAddress = DEFAULT_TEST_WALLET_ADDRESS;
  const questionId = '0x' + 'ab'.repeat(32);
  mkdirSync(responsesDir, { recursive: true });
  mkdirSync(hookStateDir, { recursive: true });
  writeFileSync(
    resolve(responsesDir, `${questionId}.json`),
    JSON.stringify({
      questionId,
      respondent: walletAddress,
      answer: 'hello',
      submitted: false,
    }, null, 2),
  );

  const prevDataDir = process.env.CE_CC_DATA_DIR;
  const prevHookStateDir = process.env.CE_CC_HOOK_STATE_DIR;
  process.env.CE_CC_DATA_DIR = dataDir;
  process.env.CE_CC_HOOK_STATE_DIR = hookStateDir;

  let submitCalled = false;
  try {
    const { handleRoute } = await importFresh(ROUTER_MODULE_PATH);
    const token = await issueLocalJwt(handleRoute, walletAddress);
    const res = makeMockRes();
    await handleRoute(
      makeLoopbackReq({ authorization: `Bearer ${token}` }),
      res,
      {
        url: new URL('http://localhost:7391/api/responses/submit-onchain'),
        method: 'POST',
        body: { session: 'alpha' },
      },
      {
        canSubmit: () => ({ ready: true, hasKey: true, hasContract: true }),
        submitOnChain: async () => {
          submitCalled = true;
          throw new Error('submitOnChain should not be called without a worker token');
        },
      },
    );

    assert.equal(submitCalled, false);
    assert.equal(res.statusCode, 401);
    assert.deepEqual(
      JSON.parse(res.body || '{}'),
      { error: 'Session sign-in is missing. Re-authenticate in the local Context Engine UI.' },
    );
  } finally {
    if (prevDataDir == null) delete process.env.CE_CC_DATA_DIR;
    else process.env.CE_CC_DATA_DIR = prevDataDir;
    if (prevHookStateDir == null) delete process.env.CE_CC_HOOK_STATE_DIR;
    else process.env.CE_CC_HOOK_STATE_DIR = prevHookStateDir;
  }
});

test('submit-onchain rejects mismatched stored worker tokens before submission', async () => {
  const root = mkdtempSync(resolve(tmpdir(), 'ce-router-submit-onchain-mismatched-worker-token-'));
  const dataDir = resolve(root, 'data');
  const hookStateDir = resolve(root, 'hook-state');
  const responsesDir = resolve(dataDir, 'responses', 'alpha');
  const workerTokensDir = resolve(dataDir, 'worker-tokens');
  const walletAddress = DEFAULT_TEST_WALLET_ADDRESS;
  const otherWallet = ethers.Wallet.createRandom();
  const questionId = '0x' + 'bc'.repeat(32);
  mkdirSync(responsesDir, { recursive: true });
  mkdirSync(workerTokensDir, { recursive: true });
  mkdirSync(hookStateDir, { recursive: true });
  writeFileSync(
    resolve(responsesDir, `${questionId}.json`),
    JSON.stringify({
      questionId,
      respondent: walletAddress,
      answer: 'hello',
      submitted: false,
    }, null, 2),
  );
  writeFileSync(
    resolve(workerTokensDir, 'alpha.jwt'),
    buildWorkerToken({
      sub: otherWallet.address,
      slug: 'alpha',
      exp: Math.floor(Date.now() / 1000) + 600,
    }),
  );

  const prevDataDir = process.env.CE_CC_DATA_DIR;
  const prevHookStateDir = process.env.CE_CC_HOOK_STATE_DIR;
  process.env.CE_CC_DATA_DIR = dataDir;
  process.env.CE_CC_HOOK_STATE_DIR = hookStateDir;

  let submitCalled = false;
  try {
    const { handleRoute } = await importFresh(ROUTER_MODULE_PATH);
    const token = await issueLocalJwt(handleRoute, walletAddress);
    const res = makeMockRes();
    await handleRoute(
      makeLoopbackReq({ authorization: `Bearer ${token}` }),
      res,
      {
        url: new URL('http://localhost:7391/api/responses/submit-onchain'),
        method: 'POST',
        body: { session: 'alpha' },
      },
      {
        canSubmit: () => ({ ready: true, hasKey: true, hasContract: true }),
        submitOnChain: async () => {
          submitCalled = true;
          throw new Error('submitOnChain should not receive a mismatched worker token');
        },
      },
    );

    assert.equal(submitCalled, false);
    assert.equal(res.statusCode, 401);
    assert.deepEqual(
      JSON.parse(res.body || '{}'),
      { error: 'Session sign-in is missing. Re-authenticate in the local Context Engine UI.' },
    );
  } finally {
    if (prevDataDir == null) delete process.env.CE_CC_DATA_DIR;
    else process.env.CE_CC_DATA_DIR = prevDataDir;
    if (prevHookStateDir == null) delete process.env.CE_CC_HOOK_STATE_DIR;
    else process.env.CE_CC_HOOK_STATE_DIR = prevHookStateDir;
  }
});

test('respond immediate mode surfaces worker-auth gaps in the save response before auto-submit can run', async () => {
  const root = mkdtempSync(resolve(tmpdir(), 'ce-router-respond-worker-auth-gap-'));
  const dataDir = resolve(root, 'data');
  const hookStateDir = resolve(root, 'hook-state');
  const walletAddress = DEFAULT_TEST_WALLET_ADDRESS;
  const session = 'alpha';
  const questionId = '0x' + 'ce'.repeat(32);

  mkdirSync(resolve(dataDir, 'responses', session), { recursive: true });
  mkdirSync(hookStateDir, { recursive: true });
  writeFileSync(resolve(dataDir, 'wallet.key'), DEFAULT_TEST_WALLET.privateKey);

  const prevDataDir = process.env.CE_CC_DATA_DIR;
  const prevHookStateDir = process.env.CE_CC_HOOK_STATE_DIR;
  process.env.CE_CC_DATA_DIR = dataDir;
  process.env.CE_CC_HOOK_STATE_DIR = hookStateDir;

  let submitCalled = false;
  try {
    const { handleRoute } = await importFresh(ROUTER_MODULE_PATH);
    const token = await issueLocalJwt(handleRoute, walletAddress);
    const res = makeMockRes();

    await handleRoute(
      makeLoopbackReq({ authorization: `Bearer ${token}` }),
      res,
      {
        url: new URL('http://localhost:7391/api/respond'),
        method: 'POST',
        body: {
          session,
          questionId,
          questionType: 'binary',
          answer: 'yes',
        },
      },
      {
        canSubmit: () => ({ ready: true, hasKey: true, hasContract: true }),
        submitOnChain: async () => {
          submitCalled = true;
          return { ok: true, txHash: '0xshould-not-run' };
        },
      },
    );

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body || '{}');
    assert.equal(body.ok, true);
    assert.equal(body.stored, true);
    assert.equal(body.submitted, false);
    assert.equal(body.requiresWorkerAuth, true);
    assert.equal(body.acknowledgement, 'Saved locally. Session sign-in is required before auto-submit can run.');
    assert.equal(body.autoSubmit.status, 'worker-auth-required');
    assert.equal(body.autoSubmit.alert, 'warning');
    assert.match(body.message, /complete session sign-in at http:\/\/localhost:7391/);

    await flushBackgroundWork();
    assert.equal(submitCalled, false);
    const storedResponse = JSON.parse(
      readFileSync(resolve(dataDir, 'responses', session, `${questionId}.json`), 'utf8'),
    );
    assert.equal(storedResponse.submitted, false);
  } finally {
    if (prevDataDir == null) delete process.env.CE_CC_DATA_DIR;
    else process.env.CE_CC_DATA_DIR = prevDataDir;
    if (prevHookStateDir == null) delete process.env.CE_CC_HOOK_STATE_DIR;
    else process.env.CE_CC_HOOK_STATE_DIR = prevHookStateDir;
  }
});

test('mark-submitted does not let one wallet mutate another wallet response file', async () => {
  const root = mkdtempSync(resolve(tmpdir(), 'ce-router-mark-submitted-wallet-scope-'));
  const dataDir = resolve(root, 'data');
  const hookStateDir = resolve(root, 'hook-state');
  const responsesDir = resolve(dataDir, 'responses', 'alpha');
  const authedWallet = DEFAULT_TEST_WALLET_ADDRESS;
  const otherWallet = '0x2222222222222222222222222222222222222222';
  const questionId = '0x' + 'cd'.repeat(32);
  mkdirSync(responsesDir, { recursive: true });
  mkdirSync(hookStateDir, { recursive: true });
  writeFileSync(
    resolve(responsesDir, `${questionId}.json`),
    JSON.stringify({
      questionId,
      respondent: otherWallet,
      answer: 'keep pending',
      submitted: false,
    }, null, 2),
  );

  const prevDataDir = process.env.CE_CC_DATA_DIR;
  const prevHookStateDir = process.env.CE_CC_HOOK_STATE_DIR;
  process.env.CE_CC_DATA_DIR = dataDir;
  process.env.CE_CC_HOOK_STATE_DIR = hookStateDir;

  try {
    const { handleRoute } = await importFresh(ROUTER_MODULE_PATH);
    const token = await issueLocalJwt(handleRoute, authedWallet);
    const res = makeMockRes();
    await handleRoute(
      makeLoopbackReq({ authorization: `Bearer ${token}` }),
      res,
      {
        url: new URL('http://localhost:7391/api/responses/mark-submitted'),
        method: 'POST',
        body: {
          session: 'alpha',
          questionId,
          txHash: '0x1234',
        },
      },
    );

    assert.equal(res.statusCode, 404);
    assert.deepEqual(JSON.parse(res.body || '{}'), { error: 'Response not found.' });
    const stored = JSON.parse(readFileSync(resolve(responsesDir, `${questionId}.json`), 'utf8'));
    assert.equal(stored.submitted, false);
    assert.equal(stored.txHash, undefined);
  } finally {
    if (prevDataDir == null) delete process.env.CE_CC_DATA_DIR;
    else process.env.CE_CC_DATA_DIR = prevDataDir;
    if (prevHookStateDir == null) delete process.env.CE_CC_HOOK_STATE_DIR;
    else process.env.CE_CC_HOOK_STATE_DIR = prevHookStateDir;
  }
});

test('mark-submitted records confirmed local submission state for the authenticated wallet', async () => {
  const root = mkdtempSync(resolve(tmpdir(), 'ce-router-mark-submitted-confirmed-'));
  const dataDir = resolve(root, 'data');
  const hookStateDir = resolve(root, 'hook-state');
  const responsesDir = resolve(dataDir, 'responses', 'alpha');
  const walletAddress = DEFAULT_TEST_WALLET_ADDRESS;
  const questionId = '0x' + 'ef'.repeat(32);
  mkdirSync(responsesDir, { recursive: true });
  mkdirSync(hookStateDir, { recursive: true });
  writeFileSync(
    resolve(responsesDir, `${questionId}.json`),
    JSON.stringify({
      questionId,
      respondent: walletAddress,
      answer: 'persist me',
      submitted: false,
    }, null, 2),
  );

  const prevDataDir = process.env.CE_CC_DATA_DIR;
  const prevHookStateDir = process.env.CE_CC_HOOK_STATE_DIR;
  process.env.CE_CC_DATA_DIR = dataDir;
  process.env.CE_CC_HOOK_STATE_DIR = hookStateDir;

  try {
    const { handleRoute } = await importFresh(ROUTER_MODULE_PATH);
    const token = await issueLocalJwt(handleRoute, walletAddress);
    const res = makeMockRes();
    await handleRoute(
      makeLoopbackReq({ authorization: `Bearer ${token}` }),
      res,
      {
        url: new URL('http://localhost:7391/api/responses/mark-submitted'),
        method: 'POST',
        body: {
          session: 'alpha',
          questionId,
          txHash: '0x1234',
          arweaveTxId: 'ArweaveId123',
        },
      },
    );

    assert.equal(res.statusCode, 200);
    const confirmedPath = resolve(
      dataDir,
      'confirmed-submissions',
      'alpha',
      `${walletAddress.toLowerCase()}.json`
    );
    assert.equal(existsSync(confirmedPath), true);
    const confirmed = JSON.parse(readFileSync(confirmedPath, 'utf8'));
    assert.equal(confirmed.wallet, walletAddress.toLowerCase());
    assert.equal(confirmed.questions[questionId.toLowerCase()].txHash, '0x1234');
    assert.equal(confirmed.questions[questionId.toLowerCase()].arweaveTxId, 'ArweaveId123');
    assert.deepEqual(confirmed.questions[questionId.toLowerCase()].storageRef, {
      backend: 'arweave',
      id: 'ArweaveId123',
      uri: 'ar://ArweaveId123',
      resource: 'responses',
    });
  } finally {
    if (prevDataDir == null) delete process.env.CE_CC_DATA_DIR;
    else process.env.CE_CC_DATA_DIR = prevDataDir;
    if (prevHookStateDir == null) delete process.env.CE_CC_HOOK_STATE_DIR;
    else process.env.CE_CC_HOOK_STATE_DIR = prevHookStateDir;
  }
});
