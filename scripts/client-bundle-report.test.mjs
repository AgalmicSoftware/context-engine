import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createBundleReport,
  createBundleReportPlugin,
  renderBundleReportHtml,
} from '../client/scripts/bundle-report.mjs';

const fixtureBundle = () => ({
  'assets/z.js': {
    type: 'chunk',
    fileName: 'assets/z.js',
    code: 'export const z = 1;\n',
    modules: {
      '/src/<unsafe>.ts': { renderedLength: 12 },
      '/src/a.ts': { renderedLength: 8 },
    },
  },
  'assets/a.css': {
    type: 'asset',
    fileName: 'assets/a.css',
    source: 'body { color: red; }\n',
  },
});

test('bundle report is deterministic, sorted, and includes compressed sizes', () => {
  const first = createBundleReport(fixtureBundle(), { rootDir: '/' });
  const second = createBundleReport(fixtureBundle(), { rootDir: '/' });

  assert.deepEqual(first, second);
  assert.deepEqual(first.artifacts.map(({ fileName }) => fileName), ['assets/a.css', 'assets/z.js']);
  assert.equal(first.artifacts[1].modules[0].id, 'src/<unsafe>.ts');
  for (const artifact of first.artifacts) {
    assert.ok(artifact.rawBytes > 0);
    assert.ok(artifact.gzipBytes > 0);
    assert.ok(artifact.brotliBytes > 0);
  }
  assert.equal(
    first.totals.rawBytes,
    first.artifacts.reduce((total, artifact) => total + artifact.rawBytes, 0),
  );
});

test('bundle report HTML escapes module names and embeds no source code', () => {
  const report = createBundleReport(fixtureBundle(), { rootDir: '/' });
  const html = renderBundleReportHtml(report);

  assert.match(html, /&lt;unsafe&gt;/);
  assert.doesNotMatch(html, /\/src\/<unsafe>\.ts/);
  assert.doesNotMatch(html, /export const z/);
});

test('bundle report plugin emits JSON and standalone HTML assets', () => {
  const emitted = [];
  const plugin = createBundleReportPlugin({ rootDir: '/' });

  plugin.generateBundle.call(
    {
      emitFile(asset) {
        emitted.push(asset);
      },
    },
    {},
    fixtureBundle(),
  );

  assert.deepEqual(emitted.map(({ fileName }) => fileName), ['bundle-report.json', 'bundle-report.html']);
  assert.doesNotThrow(() => JSON.parse(emitted[0].source));
  assert.match(emitted[1].source, /<!doctype html>/i);
});
