'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const { sanitizeReportValue, writeJson } = require('./common');

const env = {
  RPC_URL: 'https://optimism-sepolia.infura.io/v3/0123456789abcdef0123456789abcdef',
  OPENAI_API_KEY: 'sk-test-openai-0123456789',
  SESSION_SLUG: 'live-gates-example',
};
const report = {
  mode: { chain: { rpcUrl: env.RPC_URL, chainId: 11155420 } },
  log: `retrying via ${env.RPC_URL} after ${env.OPENAI_API_KEY} failed`,
  fallbackRpcUrl: 'https://eth-sepolia.g.alchemy.com/v2/abcdefghijklmnopqrstuvwx',
  workerToken: 'aGVhZGVy.c2lnbmF0dXJl',
  session: { slug: env.SESSION_SLUG, sessionId: '0x00112233445566778899aabbccddeeff' },
  responses: [{ txHash: `0x${'ab'.repeat(32)}`, responseHash: `0x${'cd'.repeat(32)}` }],
  arweaveJwk: { kty: 'RSA', d: 'private-exponent' },
  bearer: 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIweGFiYyJ9.c2lnbmF0dXJlLXZhbHVl',
  tokenSecretSet: true,
  startedAt: new Date('2026-10-21T03:34:40.111Z'),
};

test('report sanitizing removes credentials and keeps reproduction metadata', () => {
  const clean = sanitizeReportValue(report, { env });
  const text = JSON.stringify(clean);

  for (const secret of [env.RPC_URL, env.OPENAI_API_KEY, 'abcdefghijklmnopqrstuvwx', 'private-exponent', 'aGVhZGVy', 'eyJhbGci']) {
    assert.equal(text.includes(secret), false, `leaked ${secret.slice(0, 12)}`);
  }
  assert.equal(clean.mode.chain.rpcUrl, 'https://optimism-sepolia.infura.io/[REDACTED]');
  assert.equal(clean.fallbackRpcUrl, 'https://eth-sepolia.g.alchemy.com/v2/[REDACTED]');
  assert.equal(clean.arweaveJwk, '[REDACTED]');
  assert.deepEqual(clean.session, report.session);
  assert.deepEqual(clean.responses, report.responses);
  assert.equal(clean.mode.chain.chainId, 11155420);
  assert.equal(clean.tokenSecretSet, true);
  assert.equal(clean.startedAt, '2026-10-21T03:34:40.111Z');
});

test('writeJson writes sanitized reports', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ce-report-'));
  const previous = process.env.RPC_URL;
  process.env.RPC_URL = env.RPC_URL;
  try {
    const file = path.join(dir, 'report.json');
    writeJson(file, report);
    const written = fs.readFileSync(file, 'utf8');
    assert.equal(written.includes(env.RPC_URL), false);
    assert.equal(JSON.parse(written).responses[0].txHash, report.responses[0].txHash);
  } finally {
    if (previous === undefined) delete process.env.RPC_URL;
    else process.env.RPC_URL = previous;
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('report sanitizing covers camelCase, header and passkey credential names', () => {
  const clean = sanitizeReportValue(
    {
      workerAuthToken: 'opaque-worker-auth-token',
      headers: { Authorization: 'Bearer opaque-bearer', 'x-api-key': 'opaque-api-key' },
      authSig: { sig: '0xsigned' },
      sessionSigs: { node: 'signed-session' },
      prfOutput: 'passkey-prf-output',
      jwk: { kty: 'RSA', d: 'private-exponent' },
      wsRpc: 'wss://optimism-sepolia.infura.io/ws/v3/0123456789abcdef0123456789abcdef',
      hasToken: true,
      tokenId: '42',
    },
    { env: {} },
  );
  const text = JSON.stringify(clean);
  for (const secret of ['opaque-worker-auth-token', 'opaque-bearer', 'opaque-api-key', '0xsigned', 'signed-session', 'passkey-prf-output', 'private-exponent', '0123456789abcdef0123456789abcdef']) {
    assert.equal(text.includes(secret), false, `leaked ${secret}`);
  }
  assert.equal(clean.hasToken, true);
  assert.equal(clean.tokenId, '42');
});

test('report sanitizing leaves values of names that only locate or label a credential', () => {
  const env = { E2E_PASSKEY_RP_ID: 'localhost', ARWEAVE_JWK_PATH: './secrets/arweave-key.json', OPENAI_API_KEY: 'sk-test-openai-0123456789' };
  const clean = sanitizeReportValue(
    { baseUrl: 'http://localhost:3039', jwkSource: env.ARWEAVE_JWK_PATH, note: `key ${env.OPENAI_API_KEY}` },
    { env },
  );
  assert.equal(clean.baseUrl, 'http://localhost:3039');
  assert.equal(clean.jwkSource, './secrets/arweave-key.json');
  assert.equal(clean.note.includes(env.OPENAI_API_KEY), false);
});
