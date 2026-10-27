import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { copyFileSync, lstatSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, posix } from 'node:path';
import { gunzipSync } from 'node:zlib';

export const PACKAGE = '@agalmic/contextengine';
export const REPOSITORY = 'AgalmicSoftware/context-engine';
export const TARBALL = 'contextengine.tgz';
export const RECEIPT = 'mcp-release.json';
const FILES = ['package/LICENSE', 'package/README.md', 'package/dist/THIRD_PARTY_LICENSES.txt',
  'package/dist/contextengine.mjs', 'package/package.json'].sort();
const RECIPE = ['mcp/package.json', 'mcp/package-lock.json', 'mcp/README.md', 'mcp/LICENSE',
  'package-lock.json', 'scripts/mcp-bundle.mjs'];
const hash = (bytes, algorithm = 'sha256', encoding = 'hex') => createHash(algorithm).update(bytes).digest(encoding);
const json = (file) => JSON.parse(readFileSync(file, 'utf8'));
const sha = (value) => assert.match(value, /^[a-f0-9]{40}$/);
const integer = (value) => assert.match(String(value), /^[1-9][0-9]*$/);
export const integrity = (bytes) => `sha512-${hash(bytes, 'sha512', 'base64')}`;

export function versionParts(value) {
  assert.match(value, /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$/, 'stable version required');
  return value.split('.').map(BigInt);
}

export function compareVersions(a, b) {
  const left = versionParts(a), right = versionParts(b);
  for (let i = 0; i < 3; i++) if (left[i] !== right[i]) return left[i] > right[i] ? 1 : -1;
  return 0;
}

// Inspect the bounded archive without extracting files or following links.
export function inspectPackage(bytes) {
  assert(bytes.length <= 8 * 1024 * 1024, 'compressed package too large');
  const tar = gunzipSync(bytes, { maxOutputLength: 32 * 1024 * 1024 });
  const files = new Map();
  let offset = 0;
  while (offset + 512 <= tar.length) {
    const header = tar.subarray(offset, offset + 512);
    if (header.every((byte) => byte === 0)) break;
    const field = (start, length) => header.subarray(start, start + length).toString('utf8').replace(/\0.*$/s, '');
    const prefix = field(345, 155);
    const name = `${prefix ? `${prefix}/` : ''}${field(0, 100)}`;
    assert(FILES.includes(name) && !files.has(name), `unexpected/duplicate package entry: ${name}`);
    assert([0, 48].includes(header[156]), 'package entries must be regular files');
    const sizeText = field(124, 12).trim();
    assert.match(sizeText, /^[0-7]+$/);
    const size = parseInt(sizeText, 8);
    assert(offset + 512 + size <= tar.length, 'truncated package entry');
    const expectedChecksum = parseInt(field(148, 8).trim(), 8);
    const checksum = header.reduce((sum, byte, index) => sum + (index >= 148 && index < 156 ? 32 : byte), 0);
    assert.equal(checksum, expectedChecksum, 'invalid tar checksum');
    files.set(name, tar.subarray(offset + 512, offset + 512 + size));
    offset += 512 + Math.ceil(size / 512) * 512;
  }
  assert(tar.subarray(offset).every((byte) => byte === 0), 'unexpected trailing archive data');
  assert.deepEqual([...files.keys()].sort(), FILES);
  const manifest = JSON.parse(files.get('package/package.json').toString('utf8'));
  assert.equal(manifest.name, PACKAGE);
  versionParts(manifest.version);
  assert.equal(manifest.publishConfig?.access, 'public');
  assert.equal(manifest.publishConfig?.registry, 'https://registry.npmjs.org/');
  assert.equal(manifest.repository?.url, `https://github.com/${REPOSITORY}`);
  assert.deepEqual(manifest.bin, { contextengine: 'dist/contextengine.mjs' });
  for (const key of ['dependencies', 'optionalDependencies', 'peerDependencies']) {
    assert.deepEqual(Object.keys(manifest[key] || {}), [], `${key} must be empty`);
  }
  const bundle = files.get('package/dist/contextengine.mjs').toString('utf8');
  assert(bundle.startsWith('#!/usr/bin/env node\n'));
  for (const [name, body] of files) {
    assert(!/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|\bnpm_[A-Za-z0-9]{30,}|\bgh[pousr]_[A-Za-z0-9]{30,}|\/Users\/(?!you\/)[^/\s]+\//.test(body.toString('utf8')), `private material in ${name}`);
  }
  return { manifest, fileHashes: Object.fromEntries([...files].map(([name, body]) => [name, hash(body)])) };
}

export function validateRun(run, currentMain) {
  assert.equal(run.name, 'CI');
  assert.equal(run.path, '.github/workflows/ci.yml');
  assert.equal(run.event, 'push');
  assert.equal(run.status, 'completed');
  assert.equal(run.conclusion, 'success');
  assert.equal(run.head_branch, 'main');
  assert.equal(run.repository?.full_name, REPOSITORY);
  assert.equal(run.head_repository?.full_name, REPOSITORY);
  sha(run.head_sha); sha(currentMain);
  integer(run.id); integer(run.run_attempt);
  assert.equal(run.head_sha, currentMain, 'stale CI run: main has advanced');
  return { sourceCommit: run.head_sha, runId: String(run.id), runAttempt: String(run.run_attempt) };
}

function sourcePath(path) {
  assert(typeof path === 'string' && path.length < 512 && path === posix.normalize(path));
  assert(!path.startsWith('/') && !path.split('/').some((part) => part === '..' || part.startsWith('.')));
  assert(RECIPE.includes(path) || /^(mcp|shared|client)\//.test(path), 'unsupported local build input');
  return path;
}

export function collectInputs(root, metafile) {
  const paths = [...new Set([...RECIPE, ...Object.keys(metafile.inputs)
    .filter((path) => !path.split('/').includes('node_modules'))])].sort();
  return Object.fromEntries(paths.map((path) => [sourcePath(path), hash(readFileSync(join(root, path)))]));
}

export function stagePackage({ root, tarball, output, env = process.env }) {
  const bytes = readFileSync(tarball);
  const { manifest, fileHashes } = inspectPackage(bytes);
  const lock = json(join(root, 'mcp/package-lock.json'));
  assert.equal(lock.version, manifest.version, 'lockfile version mismatch');
  assert.equal(lock.packages[''].version, manifest.version, 'lockfile root version mismatch');
  assert.equal(lock.name, PACKAGE);
  const sourceCommit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  sha(sourceCommit);
  if (env.GITHUB_SHA) assert.equal(env.GITHUB_SHA, sourceCommit);
  const receipt = {
    schemaVersion: 1, name: PACKAGE, version: manifest.version, sourceCommit,
    repository: env.GITHUB_REPOSITORY || REPOSITORY,
    sourceRef: env.GITHUB_REF || 'local',
    runId: env.GITHUB_RUN_ID || 'local', runAttempt: env.GITHUB_RUN_ATTEMPT || 'local',
    integrity: integrity(bytes), fileHashes,
    inputs: collectInputs(root, json(join(root, 'dist/mcp.metafile.json'))),
  };
  mkdirSync(output, { recursive: true });
  assert.equal(readdirSync(output).length, 0, 'artifact output must be empty');
  copyFileSync(tarball, join(output, TARBALL));
  writeFileSync(join(output, RECEIPT), `${JSON.stringify(receipt, null, 2)}\n`);
  return receipt;
}

export function verifyArtifact({ root, directory, run }) {
  assert.deepEqual(readdirSync(directory).sort(), [TARBALL, RECEIPT].sort());
  for (const file of [TARBALL, RECEIPT]) assert(lstatSync(join(directory, file)).isFile());
  assert(lstatSync(join(directory, RECEIPT)).size < 1024 * 1024, 'oversized receipt');
  assert(lstatSync(join(directory, TARBALL)).size <= 8 * 1024 * 1024, 'oversized tarball');
  const receipt = json(join(directory, RECEIPT));
  const bytes = readFileSync(join(directory, TARBALL));
  const { manifest, fileHashes } = inspectPackage(bytes);
  const actualCommit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  const expected = validateRun(run, actualCommit);
  assert.equal(receipt.schemaVersion, 1);
  assert.equal(receipt.name, PACKAGE);
  assert.equal(receipt.version, manifest.version);
  assert.equal(receipt.repository, REPOSITORY);
  assert.equal(receipt.sourceRef, 'refs/heads/main');
  for (const key of ['sourceCommit', 'runId', 'runAttempt']) assert.equal(receipt[key], expected[key], `${key} mismatch`);
  assert.equal(receipt.integrity, integrity(bytes), 'package integrity mismatch');
  assert.deepEqual(receipt.fileHashes, fileHashes);
  assert.deepEqual(manifest, json(join(root, 'mcp/package.json')), 'source manifest mismatch');
  const lock = json(join(root, 'mcp/package-lock.json'));
  assert.equal(lock.version, manifest.version);
  assert.equal(lock.packages[''].version, manifest.version);
  assert(receipt.inputs && Object.keys(receipt.inputs).length <= 2000, 'invalid build inputs');
  for (const path of RECIPE) assert(Object.hasOwn(receipt.inputs, path), `missing recipe input: ${path}`);
  assert(Object.hasOwn(receipt.inputs, 'mcp/bin/context-engine-mcp.mjs'), 'missing bundle entry');
  for (const [path, digest] of Object.entries(receipt.inputs)) {
    assert.match(digest, /^[a-f0-9]{64}$/);
    assert.equal(hash(readFileSync(join(root, sourcePath(path)))), digest, `source input mismatch: ${path}`);
  }
  return receipt;
}

export function publicationDecision(receipt, registry) {
  assert.equal(registry.name, PACKAGE, 'registry package mismatch');
  assert(registry.versions && typeof registry.versions === 'object' && !Array.isArray(registry.versions),
    'registry version map missing');
  const latest = registry['dist-tags']?.latest;
  versionParts(latest);
  const existing = registry.versions?.[receipt.version];
  if (existing) {
    assert.equal(existing.dist?.integrity, receipt.integrity,
      `version ${receipt.version} already exists with different contents; bump the MCP version`);
    return 'already-published';
  }
  assert(compareVersions(receipt.version, latest) > 0, 'refusing to move latest backward');
  return 'publish';
}
