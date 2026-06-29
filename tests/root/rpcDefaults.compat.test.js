'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');

const ROOT = path.resolve(__dirname, '..', '..');
const RPC_DEFAULTS_PATH = path.join(ROOT, 'client', 'src', 'variables', 'rpcDefaults.js');
const RPC_DEFAULTS_URL = pathToFileURL(RPC_DEFAULTS_PATH).href;

const withTempDir = (run) => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ce-rpc-defaults-'));
  try {
    return run(tempDir);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
};

const runNode = (args) => spawnSync(process.execPath, args, {
  cwd: ROOT,
  encoding: 'utf8',
});

test('rpcDefaults compatibility module stays plain JS for Node consumers', () => {
  const source = fs.readFileSync(RPC_DEFAULTS_PATH, 'utf8');
  assert.doesNotMatch(source, /from\s+['"]\.\/rpcDefaults\.ts['"]/);
  assert.match(source, /module\.exports\s*=\s*rpcDefaults/);
});

test('rpcDefaults.js loads cleanly in a spawned node --test ESM context', () => {
  withTempDir((tempDir) => {
    const tempTestPath = path.join(tempDir, 'rpc-defaults-esm.test.mjs');
    fs.writeFileSync(tempTestPath, `
import test from 'node:test';
import assert from 'node:assert/strict';
import rpcDefaults from '${RPC_DEFAULTS_URL}';

test('esm import works', () => {
  assert.equal(typeof rpcDefaults.getPathRpcUrl, 'function');
  assert.equal(typeof rpcDefaults.getPublicRpcUrls, 'function');
  assert.match(String(rpcDefaults.getPathRpcUrl(84532) || ''), /^https?:\\/\\//);
});
`);

    const result = runNode(['--test', tempTestPath]);
    assert.equal(result.status, 0, result.stderr || result.stdout);
  });
});

test('rpcDefaults.js loads cleanly through CommonJS require', () => {
  withTempDir((tempDir) => {
    const tempScriptPath = path.join(tempDir, 'rpc-defaults-require.cjs');
    fs.writeFileSync(tempScriptPath, `
'use strict';
const assert = require('node:assert/strict');
const rpcDefaults = require(${JSON.stringify(RPC_DEFAULTS_PATH)});

assert.equal(typeof rpcDefaults.getPathRpcUrl, 'function');
assert.equal(typeof rpcDefaults.getFaucetFallbackRpcUrls, 'function');
assert.match(String(rpcDefaults.getPathRpcUrl(11155420) || ''), /^https?:\\/\\//);
`);

    const result = runNode([tempScriptPath]);
    assert.equal(result.status, 0, result.stderr || result.stdout);
  });
});
