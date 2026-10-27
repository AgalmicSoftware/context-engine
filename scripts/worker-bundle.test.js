'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { pathToFileURL } = require('url');

const loadModule = async () => {
  const moduleUrl = pathToFileURL(path.join(__dirname, 'worker-bundle.mjs')).href;
  return import(moduleUrl);
};

test('buildWorkerBundles validates guarded worker deps without installing them', async () => {
  const { buildWorkerBundles } = await loadModule();
  const rootDir = '/tmp/context-engine';
  const assertCalls = [];
  const buildCalls = [];
  const mkdirCalls = [];
  const writeCalls = [];

  const result = await buildWorkerBundles({
    rootDir,
    targetKeys: ['sessionCorsWorker'],
    ensureWorkerDeps: () => {
      assert.fail('bundle commands must not install Worker dependencies');
    },
    assertWorkerDeps: (options) => {
      assertCalls.push(options);
    },
    buildNoticesImpl: () => 'Synthetic notices',
    esbuildImpl: async (options) => {
      buildCalls.push(options);
      return { metafile: { inputs: { 'node_modules/synthetic/index.js': { bytes: 1 } } } };
    },
    mkdirSyncImpl: (...args) => {
      mkdirCalls.push(args);
    },
    readFileSyncImpl: () => 'const worker = true;\n',
    writeFileSyncImpl: (...args) => {
      writeCalls.push(args);
    },
  });

  assert.deepEqual(assertCalls, [{ rootDir }]);
  assert.equal(buildCalls.length, 1);
  assert.deepEqual(buildCalls[0].entryPoints, [
    path.resolve(rootDir, 'workers/sessionCorsWorker/worker.js'),
  ]);
  assert.equal(buildCalls[0].outfile, path.resolve(rootDir, 'dist/sessionCorsWorker.bundle.js'));
  assert.equal(buildCalls[0].preserveSymlinks, true);
  assert.equal(buildCalls[0].absWorkingDir, rootDir);
  assert.equal(buildCalls[0].metafile, true);
  assert.deepEqual(result[0].metafile.inputs, { 'node_modules/synthetic/index.js': { bytes: 1 } });
  assert.deepEqual(mkdirCalls, [[path.resolve(rootDir, 'dist'), { recursive: true }]]);
  const metafileWrite = writeCalls.find(([file]) => file.endsWith('.metafile.json'));
  assert.equal(metafileWrite[0], path.resolve(rootDir, 'dist/sessionCorsWorker.bundle.metafile.json'));
  assert.deepEqual(JSON.parse(metafileWrite[1]), result[0].metafile);
  assert.deepEqual(result.map((target) => target.key), ['sessionCorsWorker']);
});

test('buildWorkerBundles skips Worker dependency validation for unguarded bundle targets', async () => {
  const { buildWorkerBundles } = await loadModule();
  const assertCalls = [];

  await buildWorkerBundles({
    rootDir: '/tmp/context-engine',
    targetKeys: ['deployHelper'],
    assertWorkerDeps: (options) => {
      assertCalls.push(options);
    },
    esbuildImpl: async () => ({ metafile: { inputs: {} } }),
    mkdirSyncImpl: () => {},
    readFileSyncImpl: () => 'const worker = true;\n',
    writeFileSyncImpl: () => {},
  });

  assert.deepEqual(assertCalls, []);
});

test('buildWorkerBundles removes trailing horizontal whitespace from generated output', async () => {
  const { buildWorkerBundles } = await loadModule();
  const writes = [];

  await buildWorkerBundles({
    rootDir: '/tmp/context-engine',
    targetKeys: ['deployHelper'],
    esbuildImpl: async () => ({ metafile: { inputs: {} } }),
    mkdirSyncImpl: () => {},
    buildNoticesImpl: () => 'Synthetic notices',
    readFileSyncImpl: () => 'const worker = true;  \n// comment\t\n',
    writeFileSyncImpl: (...args) => {
      writes.push(args);
    },
  });

  assert.deepEqual(writes.filter(([file]) => file.endsWith('.js')), [[
    path.resolve('/tmp/context-engine', 'dist/deployHelper.bundle.js'),
    'const worker = true;\n// comment\n/*\nSynthetic notices\n*/\n',
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

test('every released bundle carries complete deterministic notices inside a safe trailing comment', async (t) => {
  const fs = require('node:fs');
  const os = require('node:os');
  const vm = require('node:vm');
  const { WORKER_ARTIFACTS } = await import('./worker-release-artifacts.mjs');
  const { buildWorkerBundles } = await loadModule();
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ce-release-notice-fixture-'));
  t.after(() => fs.rmSync(rootDir, { recursive: true, force: true }));
  const inputs = {};
  for (const [directory, name, version] of [
    ['node_modules/synthetic-root', 'synthetic-root', '1.0.0'],
    ['workers/sessionCorsWorker/node_modules/synthetic-worker', 'synthetic-worker', '2.0.0'],
  ]) {
    const folder = path.join(rootDir, directory);
    fs.mkdirSync(folder, { recursive: true });
    fs.writeFileSync(path.join(folder, 'package.json'), JSON.stringify({ name, version, license: 'MIT' }));
    fs.writeFileSync(path.join(folder, 'LICENSE'), `Full permission grant for ${name}@${version}.\r\nA closing token */ must stay text.\r\n`);
    inputs[`${directory}/index.js`] = { bytes: 1 };
  }
  const buildFixture = async (reversed = false) => buildWorkerBundles({
    rootDir,
    assertWorkerDeps: () => {},
    esbuildImpl: async ({ outfile }) => {
      fs.writeFileSync(outfile, 'const worker = true;  \n');
      return { metafile: { inputs: Object.fromEntries((reversed ? Object.entries(inputs).reverse() : Object.entries(inputs))) } };
    },
  });
  await buildFixture();
  const before = new Map();
  for (const { file } of WORKER_ARTIFACTS) {
    const bundle = fs.readFileSync(path.join(rootDir, 'dist', file), 'utf8');
    assert.doesNotThrow(() => new vm.Script(bundle), `${file} licenses cannot close their comment`);
    assert.ok(bundle.endsWith('*/\n'), `${file} must end with its notices`);
    assert.equal(bundle.includes(rootDir), false);
    for (const identity of ['synthetic-root@1.0.0', 'synthetic-worker@2.0.0']) {
      assert.ok(bundle.includes(`## ${identity}\n\nLicense: MIT\n`), `${file}: ${identity}`);
      assert.ok(bundle.includes(`Full permission grant for ${identity}.`), `${file}: full license text`);
    }
    assert.ok(bundle.includes('A closing token *\\/ must stay text.'));
    assert.equal(bundle.includes('\r'), false);
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(rootDir, 'dist', file.replace(/\.js$/, '.metafile.json')), 'utf8')).inputs, inputs);
    before.set(file, bundle);
  }
  await buildFixture(true);
  for (const [file, bundle] of before) assert.equal(fs.readFileSync(path.join(rootDir, 'dist', file), 'utf8'), bundle);
});

test('ethers subpackage notices require exact local monorepo license evidence', async (t) => {
  const fs = require('node:fs');
  const os = require('node:os');
  const { buildWorkerThirdPartyNotices } = await import('./lib/worker-third-party-notices.mjs');
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ce-ethers-notice-fixture-'));
  t.after(() => fs.rmSync(rootDir, { recursive: true, force: true }));
  const loggerDir = path.join(rootDir, 'node_modules/@ethersproject/logger');
  const ethersDir = path.join(rootDir, 'node_modules/ethers');
  fs.mkdirSync(loggerDir, { recursive: true });
  fs.mkdirSync(ethersDir, { recursive: true });
  const repository = { url: 'git://github.com/ethers-io/ethers.js.git' };
  fs.writeFileSync(path.join(loggerDir, 'package.json'), JSON.stringify({ name: '@ethersproject/logger', version: '5.7.0', license: 'MIT', repository }));
  const umbrella = { name: 'ethers', version: '5.7.2', license: 'MIT', repository, dependencies: { '@ethersproject/logger': '5.7.0' } };
  fs.writeFileSync(path.join(ethersDir, 'package.json'), JSON.stringify(umbrella));
  fs.writeFileSync(path.join(ethersDir, 'LICENSE.md'), 'Synthetic monorepo permission grant.');
  const build = () => buildWorkerThirdPartyNotices({ rootDir, metafile: { inputs: { 'node_modules/@ethersproject/logger/lib/index.js': {} } } });
  assert.match(build(), /## @ethersproject\/logger@5.7.0\n\nLicense: MIT\n\n### ethers monorepo LICENSE.md\n\nSynthetic monorepo permission grant/);
  umbrella.dependencies['@ethersproject/logger'] = '5.7.1';
  fs.writeFileSync(path.join(ethersDir, 'package.json'), JSON.stringify(umbrella));
  assert.throws(build, /Missing license text/);
});

test('README notices require a full grant rather than a license label', async (t) => {
  const fs = require('node:fs');
  const os = require('node:os');
  const { buildWorkerThirdPartyNotices } = await import('./lib/worker-third-party-notices.mjs');
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ce-readme-notice-fixture-'));
  t.after(() => fs.rmSync(rootDir, { recursive: true, force: true }));
  const packageDir = path.join(rootDir, 'node_modules/synthetic-readme');
  fs.mkdirSync(packageDir, { recursive: true });
  fs.writeFileSync(path.join(packageDir, 'package.json'), JSON.stringify({ name: 'synthetic-readme', version: '1.0.0', license: 'MIT' }));
  const build = () => buildWorkerThirdPartyNotices({ rootDir, metafile: { inputs: { 'node_modules/synthetic-readme/index.js': {} } } });
  fs.writeFileSync(path.join(packageDir, 'README.md'), '# Synthetic package\n\n#### LICENSE\n\nMIT.\n');
  assert.throws(build, /Missing license text/);
  const license = fs.readFileSync(path.join(__dirname, '..', 'node_modules/ethers/LICENSE.md'), 'utf8').trim();
  fs.writeFileSync(path.join(packageDir, 'README.md'), `# Synthetic package\n\n#### LICENSE\n\n${license}\n\n## Unrelated\nNot part of the license.\n`);
  assert.ok(build().includes(license));
  assert.equal(build().includes('Not part of the license.'), false);
});
