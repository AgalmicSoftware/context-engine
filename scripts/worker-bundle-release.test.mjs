import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { build } from 'esbuild';
import { buildWorkerBundles } from './worker-bundle.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('a built Session Worker reports the release it was built from', async (t) => {
  const dir = mkdtempSync(path.join(tmpdir(), 'ce-worker-release-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const outfile = path.join(dir, 'worker.mjs');
  await buildWorkerBundles({
    rootDir: ROOT,
    targetKeys: ['sessionCorsWorker'],
    esbuildImpl: (options) => build({ ...options, outfile, metafile: false }),
    buildNoticesImpl: () => '',
    readFileSyncImpl: (file, encoding) => readFileSync(file === path.join(ROOT, 'dist/sessionCorsWorker.bundle.js') ? outfile : file, encoding),
    mkdirSyncImpl: () => {},
    writeFileSyncImpl: () => {},
  });

  const { version } = JSON.parse(readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  const worker = (await import(pathToFileURL(outfile).href)).default;
  const response = await worker.fetch(new Request('https://worker.example/capabilities'), {}, { waitUntil() {} });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).release, version);
});
