'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const RPC_DEFAULTS_JS_PATH = path.join(ROOT, 'client', 'src', 'variables', 'rpcDefaults.js');
const CANONICAL_RPC_DEFAULTS_PATH = path.join(ROOT, 'shared', 'rpcDefaults.cjs');

const requireFresh = (modulePath) => {
  delete require.cache[require.resolve(modulePath)];
  return require(modulePath);
};

const normalizeMap = (value) =>
  Object.fromEntries(
    Object.entries(value || {}).map(([key, entry]) => [String(key), Array.isArray(entry) ? [...entry] : entry]),
  );

const collectChainIds = (...modules) => {
  const ids = new Set();
  modules.forEach((mod) => {
    [mod.publicRpcUrlsByChainId, mod.pathRpcUrlsByChainId, mod.faucetFallbackRpcUrlsByChainId].forEach((map) => {
      Object.keys(map || {}).forEach((key) => ids.add(Number(key)));
    });
  });
  return [...ids].filter((id) => Number.isFinite(id)).sort((a, b) => a - b);
};

test('rpcDefaults JS adapter exposes the canonical chain defaults', () => {
  const jsDefaults = requireFresh(RPC_DEFAULTS_JS_PATH);
  const canonicalDefaults = requireFresh(CANONICAL_RPC_DEFAULTS_PATH);

  assert.deepEqual(
    normalizeMap(jsDefaults.publicRpcUrlsByChainId),
    normalizeMap(canonicalDefaults.publicRpcUrlsByChainId),
  );
  assert.deepEqual(normalizeMap(jsDefaults.pathRpcUrlsByChainId), normalizeMap(canonicalDefaults.pathRpcUrlsByChainId));
  assert.deepEqual(
    normalizeMap(jsDefaults.faucetFallbackRpcUrlsByChainId),
    normalizeMap(canonicalDefaults.faucetFallbackRpcUrlsByChainId),
  );

  collectChainIds(jsDefaults, canonicalDefaults).forEach((chainId) => {
    assert.deepEqual(jsDefaults.getPublicRpcUrls(chainId), canonicalDefaults.getPublicRpcUrls(chainId));
    assert.equal(jsDefaults.getPathRpcUrl(chainId), canonicalDefaults.getPathRpcUrl(chainId));
    assert.deepEqual(jsDefaults.getFaucetFallbackRpcUrls(chainId), canonicalDefaults.getFaucetFallbackRpcUrls(chainId));
  });
});
