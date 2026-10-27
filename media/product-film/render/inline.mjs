#!/usr/bin/env node
/*
  Build a single self-contained HTML file of the film (CSS, JS, fonts and the
  logo artwork inlined) for sharing or hosting without fonts/ and assets/.

    node media/product-film/render/inline.mjs   # -> media/product-film/dist/context-engine-film.html
*/
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const filmDir = path.resolve(here, '..');
const outDir = path.resolve(process.env.OUT_DIR || path.join(filmDir, 'dist'));

const read = (name) => fs.readFileSync(path.join(filmDir, name), 'utf8');
const css = read('film.css').replace(/url\('fonts\/([^']+\.woff2)'\)/g, (_, file) => {
  const data = fs.readFileSync(path.join(filmDir, 'fonts', file)).toString('base64');
  return `url(data:font/woff2;base64,${data})`;
});
const js = read('film.js')
  .replace(/'(assets\/[^']+\.png)'/g, (_, file) => {
    const data = fs.readFileSync(path.join(filmDir, file)).toString('base64');
    return `'data:image/png;base64,${data}'`;
  })
  .replace(/<\/script/gi, '<\\/script');
const html = read('index.html')
  .replace(/\s*<link rel="preload"[^>]*>/g, '')
  .replace('<link rel="stylesheet" href="film.css" />', () => `<style>\n${css}\n</style>`)
  .replace('<script src="film.js"></script>', () => `<script>\n${js}\n</script>`);

fs.mkdirSync(outDir, { recursive: true });
const file = path.join(outDir, 'context-engine-film.html');
fs.writeFileSync(file, html);
console.log(`wrote ${file} (${(fs.statSync(file).size / 1024).toFixed(0)} KB)`);
