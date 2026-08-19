import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { refreshPublicBenchmarkSourceHashes } from './refresh-public-benchmark-source-hashes.mjs';

const writeFile = (rootDir, relativePath, contents) => {
  const filePath = path.join(rootDir, relativePath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, contents);
};

test('public benchmark manifests pin corpus bytes after release redaction', () => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ce-public-benchmark-hashes-'));
  const sourceRelativePath = 'ai-discourse-corpus/corpuses/public-corpus.json';
  const manifestRelativePath = 'ai-discourse-bench/banks/topic/v1/manifest.json';
  const sourceBytes = Buffer.from('{"contact":"[redacted-email]"}\n');

  try {
    writeFile(rootDir, sourceRelativePath, sourceBytes);
    writeFile(rootDir, manifestRelativePath, `${JSON.stringify({
      sourceFiles: [{ relativePath: sourceRelativePath, sha256: 'stale-private-source-hash' }],
    }, null, 2)}\n`);

    assert.equal(refreshPublicBenchmarkSourceHashes(rootDir), 1);
    const manifest = JSON.parse(fs.readFileSync(path.join(rootDir, manifestRelativePath), 'utf8'));
    assert.equal(
      manifest.sourceFiles[0].sha256,
      createHash('sha256').update(sourceBytes).digest('hex'),
    );
    assert.equal(refreshPublicBenchmarkSourceHashes(rootDir), 0);
  } finally {
    fs.rmSync(rootDir, { recursive: true, force: true });
  }
});

test('public benchmark manifest refresh rejects source paths outside the release root', () => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ce-public-benchmark-hashes-'));
  const manifestRelativePath = 'ai-discourse-bench/banks/topic/v1/manifest.json';

  try {
    writeFile(rootDir, manifestRelativePath, `${JSON.stringify({
      sourceFiles: [{ relativePath: '../outside.json', sha256: 'stale' }],
    }, null, 2)}\n`);
    assert.throws(
      () => refreshPublicBenchmarkSourceHashes(rootDir),
      /escapes the public release root/,
    );
  } finally {
    fs.rmSync(rootDir, { recursive: true, force: true });
  }
});

test('public benchmark manifest refresh runs when the CLI path is a filesystem alias', () => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ce-public-benchmark-hashes-'));
  const sourceRelativePath = 'ai-discourse-corpus/corpuses/public-corpus.json';
  const manifestRelativePath = 'ai-discourse-bench/banks/topic/v1/manifest.json';

  try {
    writeFile(rootDir, sourceRelativePath, '{"contact":"[redacted-email]"}\n');
    writeFile(rootDir, manifestRelativePath, `${JSON.stringify({
      sourceFiles: [{ relativePath: sourceRelativePath, sha256: 'stale' }],
    }, null, 2)}\n`);
    const scriptPath = fileURLToPath(new URL('./refresh-public-benchmark-source-hashes.mjs', import.meta.url));
    const aliasPath = path.join(rootDir, 'refresh-public-benchmark-source-hashes.mjs');
    fs.symlinkSync(scriptPath, aliasPath);
    execFileSync(process.execPath, [aliasPath, rootDir]);
    const manifest = JSON.parse(fs.readFileSync(path.join(rootDir, manifestRelativePath), 'utf8'));
    assert.notEqual(manifest.sourceFiles[0].sha256, 'stale');
  } finally {
    fs.rmSync(rootDir, { recursive: true, force: true });
  }
});
