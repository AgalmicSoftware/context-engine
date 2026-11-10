#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import path from 'node:path';
import { reportPublicationState } from '../src/provenance.mjs';

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
  const embedded = html.match(/<script type="application\/json" id="ce-ai-discourse-bench-report">([\s\S]*?)<\/script>/);
  if (!embedded) throw new Error(`publication ${entry.id} is missing its source report`);
  const report = JSON.parse(embedded[1]);
  const publication = reportPublicationState(report);
  if (entry.publicationStatus !== publication.manifestStatus
    || !html.includes(`data-ce-benchmark-publication-status="${publication.status}"`)) {
    throw new Error(`publication status mismatch for ${entry.id}`);
  }
  if (!html.includes(`<meta name="robots" content="${publication.robots}" />`)) {
    throw new Error(`publication ${entry.id} has incorrect index-control metadata`);
  }
  const hasPreviewLabel = /data-ce-benchmark-preview>/.test(html) && /Development preview\./.test(html);
  if ((publication.status === 'preview') !== hasPreviewLabel) {
    throw new Error(`publication ${entry.id} has an incorrect visible preview label`);
  }
  if (publication.status === 'released'
    && entry.releaseReportContentHash !== report.releaseValidationReceipt.reportContentHash) {
    throw new Error(`publication ${entry.id} has a mismatched release report hash`);
  }
}
if (!ids.has(String(manifest.defaultReportId || '').toLowerCase())) {
  throw new Error('defaultReportId does not name a published report');
}

console.log(`verified ${manifest.reports.length} benchmark publication artifact(s)`);
