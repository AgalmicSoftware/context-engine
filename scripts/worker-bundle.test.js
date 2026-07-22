'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { pathToFileURL } = require('url');

const loadModule = async () => {
  const moduleUrl = pathToFileURL(path.join(__dirname, 'worker-bundle.mjs')).href;
  return import(moduleUrl);
};

test('buildWorkerBundles bootstraps guarded worker deps before bundling', async () => {
  const { buildWorkerBundles } = await loadModule();
  const rootDir = '/tmp/context-engine';
  const ensureCalls = [];
  const assertCalls = [];
  const buildCalls = [];
  const mkdirCalls = [];
  const writeCalls = [];

  const result = await buildWorkerBundles({
    rootDir,
    targetKeys: ['sessionCorsWorker'],
    ensureWorkerDeps: (options) => {
      ensureCalls.push(options);
    },
    assertWorkerDeps: (options) => {
      assertCalls.push(options);
    },
    esbuildImpl: async (options) => {
      buildCalls.push(options);
    },
    mkdirSyncImpl: (...args) => {
      mkdirCalls.push(args);
    },
    readFileSyncImpl: () => 'const worker = true;\n',
    writeFileSyncImpl: (...args) => {
      writeCalls.push(args);
    },
  });

  assert.deepEqual(ensureCalls, [{ rootDir, dependencyName: 'ethers' }]);
  assert.deepEqual(assertCalls, [{ rootDir }]);
  assert.equal(buildCalls.length, 1);
  assert.deepEqual(buildCalls[0].entryPoints, [
    path.resolve(rootDir, 'workers/sessionCorsWorker/worker.js'),
  ]);
  assert.equal(buildCalls[0].outfile, path.resolve(rootDir, 'dist/sessionCorsWorker.bundle.js'));
  assert.equal(buildCalls[0].preserveSymlinks, true);
  assert.deepEqual(mkdirCalls, [[path.resolve(rootDir, 'dist'), { recursive: true }]]);
  assert.deepEqual(writeCalls, []);
  assert.deepEqual(result.map((target) => target.key), ['sessionCorsWorker']);
});

test('buildWorkerBundles skips worker bootstrap for unguarded bundle targets', async () => {
  const { buildWorkerBundles } = await loadModule();
  const ensureCalls = [];
  const assertCalls = [];

  await buildWorkerBundles({
    rootDir: '/tmp/context-engine',
    targetKeys: ['deployHelper'],
    ensureWorkerDeps: (options) => {
      ensureCalls.push(options);
    },
    assertWorkerDeps: (options) => {
      assertCalls.push(options);
    },
    esbuildImpl: async () => {},
    mkdirSyncImpl: () => {},
    readFileSyncImpl: () => 'const worker = true;\n',
    writeFileSyncImpl: () => {},
  });

  assert.deepEqual(ensureCalls, []);
  assert.deepEqual(assertCalls, []);
});

test('buildWorkerBundles removes trailing horizontal whitespace from generated output', async () => {
  const { buildWorkerBundles } = await loadModule();
  const writes = [];

  await buildWorkerBundles({
    rootDir: '/tmp/context-engine',
    targetKeys: ['deployHelper'],
    esbuildImpl: async () => {},
    mkdirSyncImpl: () => {},
    readFileSyncImpl: () => 'const worker = true;  \n// comment\t\n',
    writeFileSyncImpl: (...args) => {
      writes.push(args);
    },
  });

  assert.deepEqual(writes, [[
    path.resolve('/tmp/context-engine', 'dist/deployHelper.bundle.js'),
    'const worker = true;\n// comment\n',
  ]]);
});

test('Agent Bridge is a release bundle target for browser-driven dedicated deployment', async () => {
  const { resolveWorkerBundleTargets } = await loadModule();
  const [target] = resolveWorkerBundleTargets({
    rootDir: '/tmp/context-engine',
    targetKeys: ['agentBridgeWorker'],
  });

  assert.equal(target.entryPoint, path.resolve('/tmp/context-engine', 'workers/agentBridgeWorker/worker.js'));
  assert.equal(target.outputFile, path.resolve('/tmp/context-engine', 'dist/agentBridgeWorker.bundle.js'));
  assert.equal(target.target, 'es2022');
});
