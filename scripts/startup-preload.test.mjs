import assert from 'node:assert/strict';
import test from 'node:test';
import { addStartupPreloads } from '../client/scripts/startup-preload.mjs';

// The built page names the app's start-up files itself, so they download together instead of one round trip
// after another, and each carries its size for the loading bar.
const chunk = (fileName, { facadeModuleId = null, imports = [], css = [], code = 'x' } = {}) => ({
  type: 'chunk',
  fileName,
  // As the build gives them: a part loaded on demand has no facade, only the source files it holds.
  facadeModuleId: null,
  modules: facadeModuleId ? { '/repo/client/src/other.ts': {}, [facadeModuleId]: {} } : {},
  imports,
  code,
  viteMetadata: { importedCss: new Set(css) },
});
const bundle = {
  'assets/entry.js': chunk('assets/entry.js', { imports: ['assets/vendor-a.js'], css: ['assets/entry.css'], code: 'ab' }),
  'assets/vendor-a.js': chunk('assets/vendor-a.js', { code: 'abc' }),
  'assets/app.js': chunk('assets/app.js', {
    facadeModuleId: '/repo/client/src/index.tsx',
    imports: ['assets/vendor-a.js', 'assets/vendor-b.js'],
    css: ['assets/entry.css'],
    code: 'abcd',
  }),
  'assets/vendor-b.js': chunk('assets/vendor-b.js', { imports: ['assets/app.js'], code: 'abcde' }),
  'assets/shell.js': chunk('assets/shell.js', {
    facadeModuleId: '/repo/client/src/components/MainSite/AppShell.tsx',
    imports: ['assets/vendor-b.js'],
    css: ['assets/shell.css'],
    code: 'é',
  }),
  'assets/later.js': chunk('assets/later.js', { facadeModuleId: '/repo/client/src/components/AboutPage.tsx' }),
  'assets/shell.css': { type: 'asset', fileName: 'assets/shell.css', source: '' },
};
const html = [
  '<head>',
  '<script type="module" crossorigin src="/assets/entry.js"></script>',
  '<link rel="modulepreload" crossorigin href="/assets/vendor-a.js">',
  '<link rel="stylesheet" href="/assets/entry.css">',
  '</head>',
].join('\n');

test('names the app and its main part, with sizes, and nothing that loads later', () => {
  const out = addStartupPreloads(html, { bundle, entryFileName: 'assets/entry.js' });
  assert.match(out, /<script type="module" data-ce-bytes="2" crossorigin src="\/assets\/entry\.js">/);
  assert.match(out, /<link rel="modulepreload" data-ce-bytes="3" crossorigin href="\/assets\/vendor-a\.js">/);
  for (const [file, bytes] of [['app', 4], ['vendor-b', 5], ['shell', 2]]) {
    assert.match(out, new RegExp(`<link rel="modulepreload" data-ce-bytes="${bytes}" crossorigin href="/assets/${file}\\.js">`));
  }
  assert.match(out, /<link rel="preload" as="style" href="\/assets\/shell\.css">/);
  assert.equal(out.match(/vendor-a\.js/g).length, 1, 'a file already linked is not linked twice');
  assert.equal(out.match(/entry\.css/g).length, 1, "the first script's stylesheet is not preloaded again");
  assert.doesNotMatch(out, /later\.js/);
  assert(out.indexOf('shell.js') < out.indexOf('</head>'));
});

test('leaves a page with nothing to add as it is', () => {
  assert.equal(addStartupPreloads('<head></head>', { bundle: {}, entryFileName: undefined }), '<head></head>');
});
