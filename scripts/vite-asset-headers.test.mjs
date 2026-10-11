import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildImmutableAssetHeaderRules, immutableAssetHeadersPlugin } from '../client/vite.config.mjs';

const IMMUTABLE = 'Cache-Control: public, max-age=31536000, immutable';

test('immutable cache rules name each emitted hashed file and nothing else', () => {
  assert.equal(
    buildImmutableAssetHeaderRules(['index.html', 'assets/b-22222222.css', 'vite-bundle-manifest.json', 'assets/a-11111111.js']),
    `/assets/a-11111111.js\n  ${IMMUTABLE}\n/assets/b-22222222.css\n  ${IMMUTABLE}\n`,
  );
  assert.equal(buildImmutableAssetHeaderRules(['assets/a-11111111.js'], { base: '/ce/' }), `/ce/assets/a-11111111.js\n  ${IMMUTABLE}\n`);
  assert.equal(buildImmutableAssetHeaderRules(['assets/a-11111111.js'], { base: 'https://cdn.example.test/' }), '');
});

test('the build appends per-file rules after public/_headers is copied, with no /assets wildcard', () => {
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ce-asset-headers-'));
  try {
    fs.writeFileSync(path.join(outDir, '_headers'), '/*\n  Referrer-Policy: strict-origin-when-cross-origin\n');
    const plugin = immutableAssetHeadersPlugin();
    plugin.configResolved({ base: '/', build: { assetsDir: 'assets', outDir } });
    assert.equal(plugin.writeBundle.order, 'post');
    assert.equal(plugin.writeBundle.sequential, true);

    plugin.writeBundle.handler({ dir: outDir }, { 'assets/App-12345678.js': {}, 'index.html': {} });

    const headers = fs.readFileSync(path.join(outDir, '_headers'), 'utf8');
    assert.match(headers, /^\/\*\n {2}Referrer-Policy: strict-origin-when-cross-origin\n/);
    assert.match(headers, new RegExp(`\\n/assets/App-12345678\\.js\\n {2}${IMMUTABLE}\\n$`));
    assert.doesNotMatch(headers, /\/assets\/\*/);
    assert.equal(headers.match(/max-age=31536000, immutable/g).length, 1);
  } finally {
    fs.rmSync(outDir, { recursive: true, force: true });
  }
});
