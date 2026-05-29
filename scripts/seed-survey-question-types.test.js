'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  getFaucetFallbackRpcUrls,
  getPathRpcUrl,
  getPublicRpcUrls,
} = require('../client/src/variables/rpcDefaults.js');
const {
  normalizeRpcUrl,
  resolveRpcRewriteConfig,
} = require('./lib/rpc-rewrite-config.js');

const SEED_SURVEY_SCRIPT_PATH = path.join(__dirname, 'seed-survey-question-types.js');

test('resolveRpcRewriteConfig uses OP Sepolia defaults when no chain override is provided', () => {
  const result = resolveRpcRewriteConfig({ env: {} });
  const expectedSources = [
    ...getPublicRpcUrls(11155420),
    getPathRpcUrl(11155420),
    ...getFaucetFallbackRpcUrls(11155420),
  ].map((url) => normalizeRpcUrl(url));

  assert.equal(result.chainId, 11155420);
  expectedSources.forEach((url) => {
    assert.ok(result.rewriteTargets.includes(url), `expected OP Sepolia rewrite source ${url}`);
  });
  assert.ok(
    !result.rewriteTargets.includes(normalizeRpcUrl(getPathRpcUrl(84532))),
    'default rewrite sources should not include the Base Sepolia PATH RPC',
  );
  assert.deepEqual(result.browserUnsafeRpcTargets, []);
});

test('resolveRpcRewriteConfig switches to Base Sepolia and blocks browser-unsafe base.org rewrites', () => {
  const result = resolveRpcRewriteConfig({
    env: {
      CHAIN_ID: '84532',
      RPC_URL: 'https://sepolia.base.org',
    },
  });
  const expectedSources = [
    ...getPublicRpcUrls(84532),
    getPathRpcUrl(84532),
    ...getFaucetFallbackRpcUrls(84532),
  ].map((url) => normalizeRpcUrl(url));

  assert.equal(result.chainId, 84532);
  expectedSources.forEach((url) => {
    assert.ok(result.rewriteTargets.includes(url), `expected Base Sepolia rewrite source ${url}`);
  });
  assert.ok(result.browserUnsafeRpcTargets.includes('https://sepolia.base.org'));
  assert.equal(result.rpcRewriteTarget, '');
});

test('resolveRpcRewriteConfig honors RPC_REWRITE_FROM overrides exactly', () => {
  const result = resolveRpcRewriteConfig({
    env: {
      CHAIN_ID: '84532',
      RPC_REWRITE_FROM: ' https://rpc-one.example/path/ , https://rpc-two.example ',
    },
  });

  assert.equal(result.chainId, 84532);
  assert.deepEqual(result.rewriteTargets, [
    'https://rpc-one.example/path',
    'https://rpc-two.example',
  ]);
});

test('resolveRpcRewriteConfig still blocks browser-unsafe RPC_URL overrides when RPC_REWRITE_FROM is customized', () => {
  const result = resolveRpcRewriteConfig({
    env: {
      CHAIN_ID: '84532',
      RPC_URL: 'https://sepolia.base.org',
      RPC_REWRITE_FROM: 'https://rpc-one.example',
    },
  });

  assert.equal(result.chainId, 84532);
  assert.deepEqual(result.rewriteTargets, ['https://rpc-one.example']);
  assert.ok(result.browserUnsafeRpcTargets.includes('https://sepolia.base.org'));
  assert.equal(result.rpcRewriteTarget, '');
});

test('standalone survey seed suppresses cold-load onboarding before opening session routes', () => {
  const source = fs.readFileSync(SEED_SURVEY_SCRIPT_PATH, 'utf8');

  assert.match(source, /localStorage\.setItem\('firstVisit', 'false'\)/);
  assert.match(source, /sessionStorage\.setItem\('firstVisit', 'false'\)/);
  assert.match(source, /sessionStorage\.setItem\('hasRedirectedToDemo', 'true'\)/);
});
