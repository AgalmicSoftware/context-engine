#!/usr/bin/env node
/*
  Render the Context Engine motion loops.

  Uses the repository's existing Playwright dev dependency (root package.json),
  a system ffmpeg and gifsicle. No new npm dependencies.

    node media/motion-loops/render/render.mjs all readme        # verify, MP4 master, GIF
    node media/motion-loops/render/render.mjs all               # the same, for every film
    node media/motion-loops/render/render.mjs video cities      # 1080p MP4 master
    node media/motion-loops/render/render.mjs gif cities        # GIF
    node media/motion-loops/render/render.mjs verify            # invariants only
    node media/motion-loops/render/render.mjs stills cities 0 7 # PNG stills for review

  Options (env):
    OUT_DIR=…          MP4, stills and use-case GIF directory (default: media/motion-loops/dist)
    GIF_OUT=…          GIF path, for a single film
    GIF_WIDTH=1600     GIF width; height follows at 16:9
    GIF_FPS=25         GIF frame rate; keep 100/fps a whole number of centiseconds
    CHROMIUM_PATH=…    use a specific Chromium/Chrome executable
*/
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const motionDir = path.resolve(here, '..');
// Served from media/ so the page can reuse the product film's fonts.
const mediaDir = path.resolve(motionDir, '..');
const repoRoot = path.resolve(mediaDir, '..');
const outDir = path.resolve(process.env.OUT_DIR || path.join(motionDir, 'dist'));
const gifFps = Number(process.env.GIF_FPS || 25);

// Where each film's GIF goes. The use-case slugs match USE_CASES in client/src/components/About/.
const USE_CASE_GIF_WIDTH = 1280;
const FILMS = {
  readme: { gif: path.join(repoRoot, 'docs/assets/readme-feature-rotation.gif'), width: 1600 },
  'ai-discourse': { width: USE_CASE_GIF_WIDTH, web: true },
  corporate: { width: USE_CASE_GIF_WIDTH, web: true },
  cities: { width: USE_CASE_GIF_WIDTH, web: true },
  conferences: { width: USE_CASE_GIF_WIDTH, web: true },
  'digital-groups': { width: USE_CASE_GIF_WIDTH, web: true },
};
const gifPath = (film) =>
  path.resolve(process.env.GIF_OUT || FILMS[film].gif || path.join(outDir, 'use-cases', `${film}.gif`));
const gifWidth = (film) => Number(process.env.GIF_WIDTH || FILMS[film].width);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.woff2': 'font/woff2',
};

function serve(root) {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const { pathname } = new URL(req.url, 'http://localhost');
      const file = path.join(root, decodeURIComponent(pathname));
      if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
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

async function openPage(browser, base, film, width, height) {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
  // A script error would otherwise leave motion.ready pending forever.
  const failed = new Promise((_, reject) => page.once('pageerror', reject));
  failed.catch(() => {});
  await page.goto(`${base}/motion-loops/index.html?capture=1&film=${film}`, { waitUntil: 'load' });
  await Promise.race([page.evaluate(() => window.motion.ready), failed]);
  return page;
}

const shot = async (page, t) => {
  await page.evaluate((x) => window.motion.capture(x), t);
  return page.screenshot({ type: 'png' });
};

async function* capturedFrames(page, fps, total) {
  const started = Date.now();
  for (let i = 0; i < total; i += 1) {
    yield await shot(page, i / fps);
    if (i % 60 === 0) process.stdout.write(`frame ${i}/${total} (${((Date.now() - started) / 1000).toFixed(0)}s)\n`);
  }
}

// Pipe PNG frames into an ffmpeg started with `args`.
async function encode(frames, fps, args) {
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-i', '-', ...args], {
    stdio: ['pipe', 'inherit', 'inherit'],
  });
  const done = new Promise((resolve, reject) => {
    ff.on('error', reject);
    ff.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}`))));
  });
  for await (const png of frames) {
    if (!ff.stdin.write(png)) await new Promise((r) => ff.stdin.once('drain', r));
  }
  ff.stdin.end();
  await done;
}

async function renderVideo(browser, base, film) {
  fs.mkdirSync(outDir, { recursive: true });
  const page = await openPage(browser, base, film, 1920, 1080);
  const { duration, fps } = await page.evaluate(() => ({ duration: window.motion.duration, fps: window.motion.fps }));
  const master = path.join(outDir, `${film}-1080p.mp4`);
  // Encode beside the output and move it over only on success, so a failed run keeps the last good file.
  const partial = path.join(outDir, `${film}-partial.mp4`);
  await encode(capturedFrames(page, fps, Math.round(duration * fps)), fps, [
    // Convert with the BT.709 matrix that the tags declare, or players shift the saturated colours.
    '-vf', 'scale=out_color_matrix=bt709:out_range=tv:flags=lanczos+accurate_rnd+full_chroma_int,format=yuv420p,setparams=color_primaries=bt709:color_trc=bt709:colorspace=bt709',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-tune', 'animation', '-profile:v', 'high', '-level', '4.1',
    '-r', String(fps), '-g', String(fps * 2), '-an',
    '-movflags', '+faststart', partial,
  ]);
  fs.renameSync(partial, master);
  await page.close();
  console.log(`wrote ${master}`);
  if (FILMS[film].web) renderWeb(master, film, fps);
}

// The smaller 720p video and poster that a web page embeds, for each use-case film.
function renderWeb(master, film, fps) {
  const dir = path.join(outDir, 'use-cases');
  fs.mkdirSync(dir, { recursive: true });
  const video = path.join(dir, `${film}-720p.mp4`);
  const partial = path.join(dir, `${film}-720p-partial.mp4`);
  const poster = path.join(dir, `${film}-poster.jpg`);
  const ffmpeg = (args) => {
    const done = spawnSync('ffmpeg', ['-y', '-v', 'error', '-i', master, ...args], { stdio: 'inherit' });
    if (done.status !== 0) throw new Error(`ffmpeg failed on the ${film} web files`);
  };
  ffmpeg([
    '-vf', 'scale=1280:720:flags=lanczos+accurate_rnd+full_chroma_int,setparams=color_primaries=bt709:color_trc=bt709:colorspace=bt709',
    '-c:v', 'libx264', '-preset', 'veryslow', '-crf', '21', '-tune', 'animation', '-profile:v', 'high', '-level', '4.0',
    '-pix_fmt', 'yuv420p', '-r', String(fps), '-g', String(fps * 2), '-an',
    '-movflags', '+faststart', partial,
  ]);
  fs.renameSync(partial, video);
  ffmpeg(['-frames:v', '1', '-vf', 'scale=1280:720:flags=lanczos', '-q:v', '2', '-update', '1', poster]);
  console.log(`wrote ${video} (${(fs.statSync(video).size / 1024).toFixed(0)} KB)`);
}

// A generated palette merges rarer flat colours with their fades, which washes
// out a button that is on screen for seconds. Give each design colour its exact
// entry, replacing whichever entry is closest.
function pinPalette(file, colors) {
  const decoded = spawnSync('ffmpeg', ['-v', 'error', '-i', file, '-f', 'rawvideo', '-pix_fmt', 'rgba', '-'], { maxBuffer: 1 << 16 });
  if (decoded.status !== 0) throw new Error('could not read the GIF palette');
  const entries = decoded.stdout;
  const pinned = new Set();
  for (const hex of colors) {
    const want = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
    let best = -1;
    let bestDistance = Infinity;
    for (let i = 0; i < entries.length; i += 4) {
      // Alpha 0 is the entry reserved for transparency between frames.
      if (entries[i + 3] !== 255 || pinned.has(i)) continue;
      const distance = want.reduce((sum, v, c) => sum + (v - entries[i + c]) ** 2, 0);
      if (distance < bestDistance) {
        best = i;
        bestDistance = distance;
      }
    }
    entries.set(want, best);
    pinned.add(best);
  }
  const written = spawnSync('ffmpeg', ['-y', '-v', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', '16x16', '-i', '-', '-frames:v', '1', '-update', '1', file], { input: entries });
  if (written.status !== 0) throw new Error('could not write the GIF palette');
}

async function renderGif(browser, base, film) {
  fs.mkdirSync(outDir, { recursive: true });
  const width = gifWidth(film);
  const out = gifPath(film);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  // Rasterise the vectors at GIF size directly: no resampling halos to spend palette on.
  const page = await openPage(browser, base, film, width, Math.round((width * 9) / 16));
  const { duration, colors } = await page.evaluate(() => ({ duration: window.motion.duration, colors: window.motion.colors }));
  const frames = [];
  for await (const png of capturedFrames(page, gifFps, Math.round(duration * gifFps))) frames.push(png);
  await page.close();

  const palette = path.join(outDir, `${film}-palette.png`);
  const raw = path.join(outDir, `${film}-unoptimized.gif`);
  const optimized = path.join(outDir, `${film}-optimized.gif`);
  await encode(frames, gifFps, ['-vf', 'palettegen=max_colors=256:stats_mode=full', '-update', '1', palette]);
  pinPalette(palette, colors);
  // One global palette and no dithering: flat colours stay put from frame to frame.
  await encode(frames, gifFps, ['-i', palette, '-filter_complex', '[0:v][1:v]paletteuse=dither=none:diff_mode=rectangle', '-loop', '0', raw]);
  const opt = spawnSync('gifsicle', ['-O3', '--no-comments', '--no-names', raw, '-o', optimized], { stdio: 'inherit' });
  if (opt.status !== 0) throw new Error('gifsicle failed');
  // The output may be a tracked asset: only replace it once the whole pipeline has succeeded.
  fs.copyFileSync(optimized, out);
  for (const file of [raw, optimized, palette]) fs.rmSync(file);
  console.log(`wrote ${out} (${(fs.statSync(out).size / 1048576).toFixed(2)} MB)`);
}

async function renderStills(browser, base, film, times) {
  const dir = path.join(outDir, 'stills');
  fs.mkdirSync(dir, { recursive: true });
  const page = await openPage(browser, base, film, 1920, 1080);
  for (const t of times) fs.writeFileSync(path.join(dir, `${film}-t${t.toFixed(2).padStart(5, '0')}.png`), await shot(page, t));
  await page.close();
  console.log(`wrote ${times.length} stills to ${dir}`);
}

// Checks what a viewer would otherwise have to catch by eye.
async function verify(browser, base, film) {
  const page = await openPage(browser, base, film, 1920, 1080);
  const problems = await page.evaluate(() => {
    const { duration, fps, headingRest, renderAtTime, verify: filmChecks } = window.motion;
    const found = [];
    const words = [...document.querySelectorAll('[data-heading]')];
    const anchor = (n) => ['x', 'y', 'font-size'].map((k) => n.getAttribute(k)).join();
    if (new Set(words.map(anchor)).size !== 1) found.push('section headings do not share one anchor');
    const shown = () => words.filter((n) => n.getAttribute('display') !== 'none').map((n) => Number(n.getAttribute('opacity')));
    for (let i = 0; i < Math.round(duration * fps); i += 1) {
      renderAtTime(i / fps);
      const visible = shown();
      if (visible.length > 1 || visible.some((o) => o > 0.5)) found.push(`t=${i / fps}: heading opacities ${visible}`);
    }
    for (const t of headingRest) {
      renderAtTime(t);
      const [o] = shown();
      if (o !== 0.5) found.push(`t=${t}: resting heading opacity ${o}`);
    }
    return [...found, ...filmChecks()];
  });

  const hash = (buf) => createHash('sha1').update(buf).digest('hex');
  const { duration, fps, seek } = await page.evaluate(() => ({ duration: window.motion.duration, fps: window.motion.fps, seek: window.motion.seek }));
  // The last frame must already be frame 0, and a frame must not depend on the frames before it.
  const first = hash(await shot(page, 0));
  if (hash(await shot(page, (Math.round(duration * fps) - 1) / fps)) !== first) problems.push('last frame differs from frame 0');
  const forward = {};
  for (const t of seek) forward[t] = hash(await shot(page, t));
  // Identical frames here would mean the stage is not rendering at all, which would satisfy every comparison.
  if (new Set(Object.values(forward)).size !== seek.length) problems.push('sampled frames are not all different');
  for (const t of [...seek].reverse()) {
    if (hash(await shot(page, t)) !== forward[t]) problems.push(`frame at ${t} s depends on what was rendered before it`);
  }
  await page.close();

  if (problems.length) {
    console.error(problems.slice(0, 40).join('\n'));
    throw new Error(`${film}: verify found ${problems.length} problem(s)`);
  }
  console.log(`${film}: verify ok`);
}

const [cmd = 'all', ...rest] = process.argv.slice(2);
const named = rest.filter((arg) => arg in FILMS);
const times = rest.filter((arg) => !(arg in FILMS)).map(Number);
const badTimes = cmd === 'stills' ? !(named.length === 1 && times.length && times.every(Number.isFinite)) : times.length > 0;
if (!['all', 'video', 'gif', 'verify', 'stills'].includes(cmd) || badTimes) {
  console.error(`usage: render.mjs [all | video | gif | verify] [film...]\n       render.mjs stills <film> <seconds>...\nfilms: ${Object.keys(FILMS).join(', ')}`);
  process.exit(2);
}
const films = named.length ? named : Object.keys(FILMS);
if (process.env.GIF_OUT && films.length > 1 && (cmd === 'gif' || cmd === 'all')) {
  console.error('GIF_OUT names one file, so it needs exactly one film');
  process.exit(2);
}
const server = await serve(mediaDir);
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await launch();
try {
  if (cmd === 'stills') await renderStills(browser, base, named[0], times);
  else {
    for (const film of films) {
      if (cmd === 'verify' || cmd === 'all') await verify(browser, base, film);
      if (cmd === 'video' || cmd === 'all') await renderVideo(browser, base, film);
      if (cmd === 'gif' || cmd === 'all') await renderGif(browser, base, film);
    }
  }
} finally {
  await browser.close();
  server.close();
}
