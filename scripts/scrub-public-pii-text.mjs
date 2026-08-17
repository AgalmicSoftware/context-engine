#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const rootArg = args.shift();
if (!rootArg) {
  console.error('Usage: scrub-public-pii-text.mjs <root> [--paths-file <nul-delimited-file>]');
  process.exit(1);
}

let pathsFile = '';
while (args.length > 0) {
  const option = args.shift();
  if (option === '--paths-file' && args.length > 0) {
    pathsFile = args.shift();
    continue;
  }
  console.error(`Unknown option: ${option}`);
  process.exit(1);
}

const rootDir = path.resolve(rootArg);
const skipDirs = new Set(['.git', 'node_modules', 'build', 'dist', 'coverage']);
const byteStableGeneratedFiles = new Set(['deploy/cloudflare/session-worker/worker.mjs']);
const emailRe = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const allowedPublicEmails = new Set([
  'agalmicsoftware@protonmail.com',
  'contextengine@protonmail.com',
]);
const homePathRe = /(?:^|[\s"'(=:{])((?:\/Users|\/home)\/[A-Za-z0-9._-]+(?:\/[^\s"'`<>\\)]*)?)/g;
const syntheticScannerFixtureAssignment = [
  ['provider', 'api', 'token'].join('_'),
  ['live', 'credential', 'material', 'must', 'not', 'ship'].join('-'),
].join("='") + "'";
const syntheticScannerFixtureSource =
  "${['provider', 'api', 'token'].join('_')}='${['live', 'credential', 'material', 'must', 'not', 'ship'].join('-')}'";
const syntheticScannerFixturePaths = new Set([
  'scripts/sync-public-history.test.js',
  'scripts/verify-public-release-pii.test.js',
]);

function isProbablyBinary(buffer) {
  if (buffer.includes(0)) return true;
  const sampleLength = Math.min(buffer.length, 4096);
  if (sampleLength === 0) return false;

  let controlBytes = 0;
  for (let index = 0; index < sampleLength; index += 1) {
    const byte = buffer[index];
    if (byte < 8 || (byte > 13 && byte < 32)) controlBytes += 1;
  }
  return controlBytes > Math.max(8, sampleLength * 0.02);
}

function scrubFile(absolutePath) {
  const relativePath = path.relative(rootDir, absolutePath).split(path.sep).join('/');
  // Generated worker bytes are verified against their manifest and source.
  // Rewriting email-shaped dependency data would invalidate that verification
  // and can corrupt bundled wordlists, so leave this artifact byte-for-byte intact.
  if (byteStableGeneratedFiles.has(relativePath)) return;

  let stat;
  try {
    stat = fs.lstatSync(absolutePath);
  } catch (error) {
    if (error?.code === 'ENOENT') return;
    throw error;
  }
  if (!stat.isFile()) return;

  const buffer = fs.readFileSync(absolutePath);
  if (isProbablyBinary(buffer)) return;

  const original = buffer.toString('utf8');
  let scrubbed = original
    .replace(emailRe, (match) =>
      allowedPublicEmails.has(match.toLowerCase()) ? match : '[redacted-email]',
    )
    .replace(homePathRe, (match, homePath) => match.replace(homePath, '/redacted-home'));

  // Two historical scanner regressions embedded a deliberately fake secret as
  // one literal token. Preserve the runtime negative test while preventing the
  // fixture itself from becoming a secret-shaped value in public history.
  if (syntheticScannerFixturePaths.has(relativePath)) {
    scrubbed = scrubbed.replaceAll(syntheticScannerFixtureAssignment, syntheticScannerFixtureSource);
  }

  if (scrubbed !== original) fs.writeFileSync(absolutePath, scrubbed);
}

function walk(absoluteDir) {
  for (const entry of fs.readdirSync(absoluteDir, { withFileTypes: true })) {
    const absolutePath = path.join(absoluteDir, entry.name);
    if (entry.isDirectory()) {
      if (skipDirs.has(entry.name)) continue;
      walk(absolutePath);
      continue;
    }
    if (entry.isFile()) scrubFile(absolutePath);
  }
}

if (pathsFile) {
  const relativePaths = fs
    .readFileSync(pathsFile, 'utf8')
    .split('\0')
    .filter(Boolean);
  for (const relativePath of relativePaths) {
    const absolutePath = path.resolve(rootDir, relativePath);
    const relativeToRoot = path.relative(rootDir, absolutePath);
    if (relativeToRoot.startsWith('..') || path.isAbsolute(relativeToRoot)) {
      throw new Error(`Refusing to scrub a path outside the release root: ${relativePath}`);
    }
    scrubFile(absolutePath);
  }
} else {
  walk(rootDir);
}
