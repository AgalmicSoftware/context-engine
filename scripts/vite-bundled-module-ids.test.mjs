import test from 'node:test';
import assert from 'node:assert/strict';
import { bundledModuleIdsPlugin } from '../client/vite.config.mjs';

test('Vite license inputs include main and worker bundles with nested package paths intact', () => {
  const modules = new Set();
  const options = { rootDir: '/fixture', modules };
  const worker = bundledModuleIdsPlugin({ ...options, emit: false });
  worker.generateBundle({}, { 'worker.js': { type: 'chunk', modules: {
    '/fixture/client/node_modules/crypto-fixture/index.js': {},
  } } });
  const emitted = [];
  const main = bundledModuleIdsPlugin(options);
  main.generateBundle.call({ emitFile: (asset) => emitted.push(asset) }, {}, {
    'app.js': { type: 'chunk', modules: {
      '/fixture/client/src/main.tsx': {},
      '/fixture/client/node_modules/process/browser.js': {},
      '\0/fixture/client/node_modules/parent/node_modules/nested/index.js?commonjs-proxy': {},
      '\0vite/preload-helper': {},
    } },
    'style.css': { type: 'asset', source: 'body{}' },
  });
  assert.equal(emitted.length, 1);
  assert.equal(emitted[0].fileName, 'bundled-module-ids.json');
  assert.deepEqual(JSON.parse(emitted[0].source).moduleIds, [
    'client/node_modules/crypto-fixture/index.js',
    'client/node_modules/parent/node_modules/nested/index.js',
    'client/node_modules/process/browser.js',
    'client/src/main.tsx',
  ]);
});
