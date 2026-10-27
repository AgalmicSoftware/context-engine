import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, readdir, symlink, realpath, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';
import { bundledModuleIdsPlugin } from '../client/vite.config.mjs';

test('Vite license inputs include main and worker bundles with nested package paths intact', async (t) => {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), 'ce-module-ids-'));
  t.after(() => rm(rootDir, { recursive: true, force: true }));
  const modules = new Set();
  const options = { rootDir, modules };
  const worker = bundledModuleIdsPlugin({ ...options, emit: false });
  worker.generateBundle({}, { 'worker.js': { type: 'chunk', modules: {
    [`${rootDir}/client/node_modules/crypto-fixture/index.js`]: {},
  } } });
  const emitted = [];
  const main = bundledModuleIdsPlugin(options);
  main.generateBundle.call({ emitFile: (asset) => emitted.push(asset) }, {}, {
    'app.js': { type: 'chunk', modules: {
      [`${rootDir}/client/src/main.tsx`]: {},
      [`${rootDir}/client/node_modules/process/browser.js`]: {},
      [`\0${rootDir}/client/node_modules/parent/node_modules/nested/index.js?commonjs-proxy`]: {},
      '\0vite/preload-helper': {},
    } },
    'style.css': { type: 'asset', source: 'body{}' },
  });
  main.writeBundle();
  assert.equal(emitted.length, 0);
  const saved = JSON.parse(await readFile(path.join(rootDir, 'dist/client.bundled-module-ids.json'), 'utf8'));
  assert.deepEqual(saved.moduleIds, [
    'client/node_modules/crypto-fixture/index.js',
    'client/node_modules/parent/node_modules/nested/index.js',
    'client/node_modules/process/browser.js',
    'client/src/main.tsx',
  ]);
});


test('a real client build keeps its module inventory outside the published directory', async (t) => {
  const temporary = await realpath(await mkdtemp(path.join(os.tmpdir(), 'ce-private-module-ids-')));
  t.after(() => rm(temporary, { recursive: true, force: true }));
  const rootDir = path.join(temporary, 'repo');
  const client = path.join(rootDir, 'client');
  await mkdir(client, { recursive: true });
  await writeFile(path.join(temporary, 'external.js'), 'export const message = "synthetic external module";');
  await symlink(path.join(temporary, 'external.js'), path.join(client, 'linked.js'));
  await writeFile(path.join(client, 'index.html'), '<script type="module" src="/main.js"></script>');
  await writeFile(path.join(client, 'main.js'), `import { message } from './linked.js'; console.log(message); new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });`);
  await writeFile(path.join(client, 'worker.js'), 'self.postMessage("synthetic worker");');
  const modules = new Set();
  const { build } = createRequire(new URL('../client/package.json', import.meta.url))('vite');
  await build({
    configFile: false, root: client, logLevel: 'silent',
    plugins: [bundledModuleIdsPlugin({ rootDir, modules })],
    worker: { plugins: [bundledModuleIdsPlugin({ rootDir, modules, emit: false })] },
    build: { outDir: 'build', emptyOutDir: true },
  });
  assert.equal((await readdir(path.join(client, 'build'))).includes('bundled-module-ids.json'), false);
  const inventory = JSON.parse(await readFile(path.join(rootDir, 'dist/client.bundled-module-ids.json'), 'utf8'));
  assert.ok(inventory.moduleIds.includes('../external.js'));
  assert.ok(inventory.moduleIds.includes('client/worker.js'));
  assert.ok(inventory.moduleIds.includes('client/main.js'));
});
