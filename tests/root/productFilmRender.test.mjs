import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const renderer = path.join(repoRoot, 'media', 'product-film', 'render', 'render.mjs');

const missingRenderTool = async () => {
  if (spawnSync('ffmpeg', ['-version']).status !== 0) return 'ffmpeg is not installed';
  if (process.env.CHROMIUM_PATH) return null;
  try {
    const { chromium } = await import('playwright');
    return fs.existsSync(chromium.executablePath()) ? null : 'Playwright Chromium is not installed';
  } catch {
    return 'playwright is not installed';
  }
};

test('a FRAMES range that skips frame 0 still writes the video still', async (t) => {
  const missing = await missingRenderTool();
  if (missing) {
    t.skip(missing);
    return;
  }
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ce-film-frames-'));
  try {
    const result = spawnSync(process.execPath, [renderer, 'video'], {
      env: { ...process.env, OUT_DIR: outDir, FRAMES: '30:31' },
      encoding: 'utf8',
      timeout: 120_000,
    });

    assert.equal(result.status, 0, result.stderr);
    assert.equal(fs.existsSync(path.join(outDir, 'context-engine-film-still-1280x720.jpg')), true);
  } finally {
    fs.rmSync(outDir, { recursive: true, force: true });
  }
});
