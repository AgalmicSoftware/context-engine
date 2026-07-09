'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { transformSync } = require('esbuild');

const ROOT = path.resolve(__dirname, '..');
const RPC_DEFAULTS_JS_PATH = path.join(ROOT, 'client', 'src', 'variables', 'rpcDefaults.js');
const RPC_DEFAULTS_TS_PATH = path.join(ROOT, 'client', 'src', 'variables', 'rpcDefaults.ts');

const requireFresh = (modulePath) => {
  delete require.cache[require.resolve(modulePath)];
  return require(modulePath);
};

const loadTypescriptRpcDefaults = () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ce-rpc-defaults-ts-'));
  try {
    const source = fs.readFileSync(RPC_DEFAULTS_TS_PATH, 'utf8');
    const output = transformSync(source, {
      format: 'cjs',
      loader: 'ts',
      sourcemap: false,
      target: 'node20',
    });
    const compiledPath = path.join(tempDir, 'rpcDefaults.cjs');
    fs.writeFileSync(compiledPath, output.code);
    return requireFresh(compiledPath);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
};

const normalizeMap = (value) =>
  Object.fromEntries(Object.entries(value || {}).map(([key, entry]) => [String(key), Array.isArray(entry) ? [...entry] : entry]));

const collectChainIds = (...modules) => {
  const ids = new Set();
  modules.forEach((mod) => {
    [
      mod.publicRpcUrlsByChainId,
      mod.pathRpcUrlsByChainId,
      mod.faucetFallbackRpcUrlsByChainId,
    ].forEach((map) => {
      Object.keys(map || {}).forEach((key) => ids.add(Number(key)));
    });
  });
  return [...ids].filter((id) => Number.isFinite(id)).sort((a, b) => a - b);
};

test('rpcDefaults JS and TS twins expose identical supported chain defaults', () => {
  const jsDefaults = requireFresh(RPC_DEFAULTS_JS_PATH);
  const tsModule = loadTypescriptRpcDefaults();
  const tsDefaults = tsModule.default || tsModule;

  assert.deepEqual(normalizeMap(jsDefaults.publicRpcUrlsByChainId), normalizeMap(tsDefaults.publicRpcUrlsByChainId));
  assert.deepEqual(normalizeMap(jsDefaults.pathRpcUrlsByChainId), normalizeMap(tsDefaults.pathRpcUrlsByChainId));
  assert.deepEqual(
    normalizeMap(jsDefaults.faucetFallbackRpcUrlsByChainId),
    normalizeMap(tsDefaults.faucetFallbackRpcUrlsByChainId),
  );

  collectChainIds(jsDefaults, tsDefaults).forEach((chainId) => {
    assert.deepEqual(jsDefaults.getPublicRpcUrls(chainId), tsDefaults.getPublicRpcUrls(chainId));
    assert.equal(jsDefaults.getPathRpcUrl(chainId), tsDefaults.getPathRpcUrl(chainId));
    assert.deepEqual(jsDefaults.getFaucetFallbackRpcUrls(chainId), tsDefaults.getFaucetFallbackRpcUrls(chainId));
  });
});
