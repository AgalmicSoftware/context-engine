import test from 'node:test';
import assert from 'node:assert/strict';
import viteConfig from '../client/vite.config.mjs';

const transformIndexHtml = (html) => {
  const plugin = viteConfig({ mode: 'production' })
    .plugins.flat()
    .find((candidate) => candidate?.name === 'ce-public-url-html-compatibility');
  return plugin.transformIndexHtml(html);
};

test('index.html receives each theme page color for the pre-paint bootstrap', () => {
  assert.equal(
    transformIndexHtml('<html data-ce-theme-colors="__CE_THEME_COLORS__">'),
    '<html data-ce-theme-colors="context-engine:#20204e classic-95:#008080 civic:#ffffff">',
  );
});
