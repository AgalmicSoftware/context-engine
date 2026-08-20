#!/usr/bin/env node

import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const sha256 = (value) => createHash('sha256').update(value).digest('hex');

const isInsideRoot = (rootDir, targetPath) => {
  const relativePath = path.relative(rootDir, targetPath);
  return relativePath !== '' && !relativePath.startsWith('..') && !path.isAbsolute(relativePath);
};

const findManifestPaths = (directory) => {
  if (!fs.existsSync(directory)) return [];
  const manifests = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) manifests.push(...findManifestPaths(entryPath));
    if (entry.isFile() && entry.name === 'manifest.json') manifests.push(entryPath);
  }
  return manifests;
};

export const refreshPublicBenchmarkSourceHashes = (rootArg) => {
  const rootDir = path.resolve(rootArg);
  const manifests = findManifestPaths(path.join(rootDir, 'ai-discourse-bench', 'banks'));
  let refreshed = 0;

  for (const manifestPath of manifests) {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    if (!Array.isArray(manifest.sourceFiles) || manifest.sourceFiles.length === 0) continue;

    let changed = false;
    for (const sourceFile of manifest.sourceFiles) {
      if (typeof sourceFile.relativePath !== 'string' || sourceFile.relativePath.length === 0) {
        throw new Error(`Invalid sourceFiles relativePath in ${path.relative(rootDir, manifestPath)}`);
      }
      const sourcePath = path.resolve(rootDir, sourceFile.relativePath);
      if (!isInsideRoot(rootDir, sourcePath)) {
        throw new Error(`Benchmark source path escapes the public release root: ${sourceFile.relativePath}`);
      }
      const digest = sha256(fs.readFileSync(sourcePath));
      if (sourceFile.sha256 !== digest) {
        sourceFile.sha256 = digest;
        changed = true;
      }
    }

    if (changed) {
      fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
      refreshed += 1;
    }
  }

  return refreshed;
};

const isMain = process.argv[1]
  && fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url));

if (isMain) {
  const rootArg = process.argv[2];
  if (!rootArg) {
    console.error('Usage: refresh-public-benchmark-source-hashes.mjs <release-root>');
    process.exit(1);
  }
  const refreshed = refreshPublicBenchmarkSourceHashes(rootArg);
  console.log(`refreshed ${refreshed} public benchmark manifest(s)`);
}
