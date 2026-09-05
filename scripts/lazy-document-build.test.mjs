import assert from 'node:assert/strict';
import test from 'node:test';
import { assertLazyDocumentBuild } from '../client/scripts/lazy-document-build.mjs';

const fixture = () => ({
  manifest: {
    'index.html': { file: 'entry.js', isEntry: true, imports: ['shared'], dynamicImports: ['pdf'] },
    shared: { file: 'shared.js', imports: ['index.html'] },
    pdf: { file: 'opaque.js' },
  },
  bundle: {
    'entry.js': { type: 'chunk', fileName: 'entry.js', modules: { '/app/src/main.ts': {} } },
    'shared.js': { type: 'chunk', fileName: 'shared.js', modules: { '/app/node_modules/react/index.js': {} } },
    'opaque.js': { type: 'chunk', fileName: 'opaque.js', modules: { '/app/node_modules/jspdf/index.js': {} } },
  },
});

test('allows dynamic document exports and traverses cyclic eager imports once', () => {
  const { manifest, bundle } = fixture();
  assert.doesNotThrow(() => assertLazyDocumentBuild(manifest, bundle));
});

test('rejects PDF or canvas modules behind any transitive eager chunk name', () => {
  for (const dependency of ['jspdf', 'html2canvas', 'canvg']) {
    const { manifest, bundle } = fixture();
    manifest.shared.imports.push('pdf');
    bundle['opaque.js'].modules = { [`/app/node_modules/${dependency}/index.js`]: {} };
    assert.throws(() => assertLazyDocumentBuild(manifest, bundle), /Document export modules entered the startup graph/);
  }
});

test('fails closed when a manifest entry, import, or chunk is missing', () => {
  assert.throws(() => assertLazyDocumentBuild({}, {}), /entry/);
  const { manifest, bundle } = fixture();
  delete manifest.shared;
  assert.throws(() => assertLazyDocumentBuild(manifest, bundle), /Missing manifest import/);
  assert.throws(() => assertLazyDocumentBuild(fixture().manifest, {}), /Missing build chunk/);
});

test('checks eager imports of dynamically loaded application routes too', () => {
  const { manifest, bundle } = fixture();
  manifest.route = { file: 'route.js', imports: ['pdf'], isDynamicEntry: true };
  bundle['route.js'] = { type: 'chunk', fileName: 'route.js', modules: { '/app/src/Report.tsx': {} } };
  assert.throws(() => assertLazyDocumentBuild(manifest, bundle), /Document export modules entered/);
});
