#!/usr/bin/env node
/*
  Render the Context Engine product film.

  Uses the repository's existing Playwright dev dependency (root package.json)
  and a system ffmpeg. No new npm dependencies.

    node media/product-film/render/render.mjs video            # 1080p master + 720p preview + still
    node media/product-film/render/render.mjs poster           # 1200x630 og:image
    node media/product-film/render/render.mjs stills 0 12.5 18 # PNG stills for review
    node media/product-film/render/render.mjs all              # video + poster

  Options (env):
    OUT_DIR=…          output directory (default: media/product-film/dist)
    CHROMIUM_PATH=…    use a specific Chromium/Chrome executable
    STILL_WIDTH=600    also write downscaled stills at this width
    FRAMES=start:end   render a frame range only (debugging)
*/
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const filmDir = path.resolve(here, '..');
const outDir = path.resolve(process.env.OUT_DIR || path.join(filmDir, 'dist'));

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.woff2': 'font/woff2',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
};

function serve(root) {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url, 'http://localhost');
      const file = path.join(root, decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname));
      if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
        res.writeHead(404);
        res.end('not found');
        return;
      }
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
      fs.createReadStream(file).pipe(res);
    });
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

async function launch() {
  const { chromium } = await import('playwright');
  const opts = { args: ['--force-color-profile=srgb', '--disable-lcd-text', '--font-render-hinting=none'] };
  if (process.env.CHROMIUM_PATH) opts.executablePath = process.env.CHROMIUM_PATH;
  return chromium.launch(opts);
}

async function openPage(browser, base, query, width, height) {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
  page.on('pageerror', (err) => console.error('[page error]', err.message));
  await page.goto(`${base}/index.html?${query}`, { waitUntil: 'load' });
  await page.evaluate(() => window.film.ready);
  await page.evaluate(() => document.fonts.ready);
  return page;
}

function run(cmd, args, input) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: [input ? 'pipe' : 'ignore', 'inherit', 'inherit'] });
    child.on('error', reject);
    child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} exited ${code}`))));
    if (input) input(child.stdin);
  });
}

async function renderVideo(browser, base) {
  fs.mkdirSync(outDir, { recursive: true });
  const page = await openPage(browser, base, 'capture=1&paused=1', 1920, 1080);
  // Duration and frame rate come from the film itself (window.film).
  const { duration: DURATION, fps: FPS } = await page.evaluate(() => ({ duration: window.film.duration, fps: window.film.fps }));
  const total = Math.round(DURATION * FPS);
  const [from, to] = (process.env.FRAMES || `0:${total}`).split(':').map(Number);
  const master = path.join(outDir, 'context-engine-film-1080p.mp4');
  const ff = spawn(
    'ffmpeg',
    [
      '-y', '-loglevel', 'error',
      '-f', 'image2pipe', '-framerate', String(FPS), '-i', '-',
      '-c:v', 'libx264', '-preset', 'slow', '-crf', '15', '-profile:v', 'high', '-level', '4.1',
      '-pix_fmt', 'yuv420p', '-r', String(FPS), '-g', String(FPS * 2),
      '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709',
      '-movflags', '+faststart', master,
    ],
    { stdio: ['pipe', 'inherit', 'inherit'] },
  );
  const done = new Promise((resolve, reject) => {
    ff.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}`))));
  });
  const started = Date.now();
  for (let i = from; i < to; i += 1) {
    // film.capture renders t and rebuilds the stage rendering, so frames never depend on history.
    await page.evaluate((t) => window.film.capture(t), i / FPS);
    const png = await page.screenshot({ type: 'png', clip: { x: 0, y: 0, width: 1920, height: 1080 } });
    if (!ff.stdin.write(png)) await new Promise((r) => ff.stdin.once('drain', r));
    if (i % 60 === 0) process.stdout.write(`frame ${i}/${to} (${((Date.now() - started) / 1000).toFixed(0)}s)\n`);
    if (i === 0) fs.writeFileSync(path.join(outDir, 'context-engine-film-frame0-1920x1080.png'), png);
  }
  ff.stdin.end();
  await done;
  await page.close();

  // Optimised 1280x720 preview for link unfurls.
  const preview = path.join(outDir, 'context-engine-film-720p.mp4');
  await run('ffmpeg', [
    '-y', '-loglevel', 'error', '-i', master,
    '-vf', 'scale=1280:720:flags=lanczos',
    '-c:v', 'libx264', '-preset', 'veryslow', '-crf', '19', '-tune', 'animation', '-profile:v', 'high', '-level', '4.0',
    '-pix_fmt', 'yuv420p', '-r', String(FPS), '-g', String(FPS * 2),
    '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709',
    '-movflags', '+faststart', preview,
  ]);
  // 16:9 still from frame 0 for <video poster> and players.
  await run('ffmpeg', [
    '-y', '-loglevel', 'error', '-i', path.join(outDir, 'context-engine-film-frame0-1920x1080.png'),
    '-vf', 'scale=1280:720:flags=lanczos', '-q:v', '3', path.join(outDir, 'context-engine-film-still-1280x720.jpg'),
  ]);
  console.log(`wrote ${master}\nwrote ${preview}`);
}

async function renderPoster(browser, base) {
  fs.mkdirSync(outDir, { recursive: true });
  const page = await openPage(browser, base, 'capture=1&poster=1', 1200, 630);
  const file = path.join(outDir, 'context-engine-og-1200x630.png');
  await page.screenshot({ path: file, type: 'png', clip: { x: 0, y: 0, width: 1200, height: 630 } });
  await run('ffmpeg', ['-y', '-loglevel', 'error', '-i', file, '-q:v', '2', path.join(outDir, 'context-engine-og-1200x630.jpg')]);
  await page.close();
  console.log(`wrote ${file}`);
}

async function renderStills(browser, base, times) {
  const dir = path.join(outDir, 'stills');
  fs.mkdirSync(dir, { recursive: true });
  const page = await openPage(browser, base, 'capture=1&paused=1', 1920, 1080);
  const small = Number(process.env.STILL_WIDTH || 0);
  for (const t of times) {
    await page.evaluate((x) => window.film.capture(x), t);
    const name = `t${t.toFixed(2).padStart(5, '0')}`;
    const file = path.join(dir, `${name}.png`);
    await page.screenshot({ path: file, type: 'png' });
    if (small) {
      await run('ffmpeg', ['-y', '-loglevel', 'error', '-i', file, '-vf', `scale=${small}:-2:flags=lanczos`, path.join(dir, `${name}-${small}w.png`)]);
    }
  }
  await page.close();
  console.log(`wrote ${times.length} stills to ${dir}`);
}

const [cmd = 'all', ...rest] = process.argv.slice(2);
const server = await serve(filmDir);
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await launch();
try {
  if (cmd === 'video' || cmd === 'all') await renderVideo(browser, base);
  if (cmd === 'poster' || cmd === 'all') await renderPoster(browser, base);
  if (cmd === 'stills') await renderStills(browser, base, rest.map(Number));
} finally {
  await browser.close();
  server.close();
}
