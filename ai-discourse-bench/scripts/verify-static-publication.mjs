#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import path from 'node:path';

const artifactDir = path.resolve(process.argv[2] || '../client/public/benchmark-artifacts');
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const digestPattern = /^[a-f0-9]{64}$/i;
const safeNamePattern = /^[a-z0-9][a-z0-9._-]*$/i;

const manifest = JSON.parse(await readFile(path.join(artifactDir, 'manifest.json'), 'utf8'));
if (manifest.schemaVersion !== 1 || !Array.isArray(manifest.reports) || manifest.reports.length === 0) {
  throw new Error('benchmark publication manifest is invalid');
}
const ids = new Set();
for (const entry of manifest.reports) {
  if (!safeNamePattern.test(entry.id) || !safeNamePattern.test(entry.artifact) || entry.artifact.includes('..')) {
    throw new Error(`unsafe publication identifier or artifact path: ${entry.id}`);
  }
  const foldedId = entry.id.toLowerCase();
  if (ids.has(foldedId)) throw new Error(`duplicate publication id: ${entry.id}`);
  ids.add(foldedId);
  if (!['development-preview', 'released'].includes(entry.publicationStatus)) {
    throw new Error(`invalid publication status for ${entry.id}`);
  }
  if (!Number.isInteger(entry.questionCount) || entry.questionCount < 1
    || !Number.isInteger(entry.participantCount) || entry.participantCount < 1
    || !Number.isInteger(entry.bytes) || entry.bytes < 1
    || !Number.isInteger(entry.contentBytes) || entry.contentBytes < 1
    || !digestPattern.test(entry.sha256)
    || !digestPattern.test(entry.contentSha256)) {
    throw new Error(`invalid publication metadata for ${entry.id}`);
  }
  if (entry.publicationStatus === 'released' && !digestPattern.test(entry.releaseReportContentHash || '')) {
    throw new Error(`released publication ${entry.id} is missing its release report hash`);
  }
  const artifact = await readFile(path.join(artifactDir, entry.artifact));
  if (artifact.byteLength !== entry.bytes || sha256(artifact) !== entry.sha256) {
    throw new Error(`artifact integrity mismatch for ${entry.id}`);
  }
  const content = entry.compression === 'gzip' ? gunzipSync(artifact) : artifact;
  if (content.byteLength !== entry.contentBytes || sha256(content) !== entry.contentSha256) {
    throw new Error(`report content integrity mismatch for ${entry.id}`);
  }
  const html = content.toString('utf8');
  if (!/<meta name="robots" content="noindex,nofollow" \/>/.test(html)) {
    throw new Error(`publication ${entry.id} is missing its index-control metadata`);
  }
  if (entry.publicationStatus === 'development-preview'
    && !/Development preview\./.test(html)) {
    throw new Error(`preview publication ${entry.id} is missing its visible preview label`);
  }
}
if (!ids.has(String(manifest.defaultReportId || '').toLowerCase())) {
  throw new Error('defaultReportId does not name a published report');
}

console.log(`verified ${manifest.reports.length} benchmark publication artifact(s)`);
