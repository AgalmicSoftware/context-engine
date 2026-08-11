#!/usr/bin/env node

import { gzipSync } from 'node:zlib';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  sha256,
  validateReleaseValidationReceipt,
} from '../src/provenance.mjs';
import { renderHtmlReport } from '../src/render-html.mjs';

const parseArgs = (argv) => {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    if (key === 'release') {
      args.release = true;
      continue;
    }
    args[key] = argv[index + 1];
    index += 1;
  }
  return args;
};

const safeId = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9._-]*$/.test(normalized) || normalized.includes('..')) {
    throw new Error('report id must use only lowercase letters, numbers, dots, underscores, and hyphens');
  }
  return normalized;
};

export const buildStaticReportPublication = ({
  html,
  report,
  reportId,
  topic = 'AI Futures & Policy',
  title = '',
  requireRelease = false,
}) => {
  const id = safeId(reportId);
  const releaseReady = report?.integrity?.releaseReady === true;
  const releaseErrors = requireRelease ? validateReleaseValidationReceipt(report) : [];
  if (requireRelease && (!releaseReady || releaseErrors.length)) {
    const warnings = [
      ...(releaseReady ? [] : (report?.integrity?.warnings || ['report integrity did not declare release readiness'])),
      ...releaseErrors,
    ];
    throw new Error(`official benchmark publication blocked:\n- ${warnings.join('\n- ')}`);
  }
  const providedHtml = String(html || '');
  const renderedHtml = renderHtmlReport(report);
  if (providedHtml && providedHtml !== renderedHtml) {
    throw new Error('benchmark publication blocked: HTML does not match the supplied report');
  }
  const artifact = `${id}.html.gz`;
  const contentBytes = Buffer.from(renderedHtml, 'utf8');
  const artifactBytes = gzipSync(contentBytes, { level: 9, mtime: 0 });
  return {
    artifact,
    artifactBytes,
    entry: {
      id,
      title: title || report?.title || 'Context Engine AI Opinions Benchmark',
      topic,
      publicationStatus: requireRelease && releaseReady ? 'released' : 'development-preview',
      generatedAt: report?.generatedAt || new Date(0).toISOString(),
      questionCount: Number(report?.counts?.questions || report?.questions?.length || 0),
      participantCount: Number(report?.counts?.models || report?.participants?.length || 0),
      artifact,
      compression: 'gzip',
      bytes: artifactBytes.byteLength,
      sha256: sha256(artifactBytes),
      contentBytes: contentBytes.byteLength,
      contentSha256: sha256(contentBytes),
      releaseReportContentHash: requireRelease
        ? report.releaseValidationReceipt.reportContentHash
        : null,
    },
  };
};

export const publishStaticReport = async ({
  htmlPath,
  reportPath,
  outDir,
  reportId,
  topic,
  title,
  requireRelease = false,
}) => {
  if (!htmlPath || !reportPath || !outDir || !reportId) {
    throw new Error('required arguments: --html <report.html> --report <report.json> --out-dir <directory> --id <report-id>');
  }
  const [html, reportText] = await Promise.all([
    readFile(htmlPath, 'utf8'),
    readFile(reportPath, 'utf8'),
  ]);
  const report = JSON.parse(reportText);
  const publication = buildStaticReportPublication({
    html,
    report,
    reportId,
    topic,
    title,
    requireRelease,
  });
  await mkdir(outDir, { recursive: true });
  const manifestPath = path.join(outDir, 'manifest.json');
  let manifest = { schemaVersion: 1, defaultReportId: publication.entry.id, reports: [] };
  try {
    manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  } catch (caught) {
    if (caught?.code !== 'ENOENT') throw caught;
  }
  const reports = Array.isArray(manifest.reports) ? manifest.reports : [];
  const nextReports = [...reports.filter((entry) => entry.id !== publication.entry.id), publication.entry]
    .sort((left, right) => left.id.localeCompare(right.id));
  const nextManifest = {
    schemaVersion: 1,
    defaultReportId: manifest.defaultReportId || publication.entry.id,
    reports: nextReports,
  };
  await writeFile(path.join(outDir, publication.artifact), publication.artifactBytes);
  await writeFile(manifestPath, `${JSON.stringify(nextManifest, null, 2)}\n`, 'utf8');
  return { manifestPath, ...publication };
};

const isDirectRun = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isDirectRun) {
  const args = parseArgs(process.argv.slice(2));
  publishStaticReport({
    htmlPath: args.html,
    reportPath: args.report,
    outDir: args['out-dir'],
    reportId: args.id,
    topic: args.topic,
    title: args.title,
    requireRelease: Boolean(args.release),
  }).then((result) => {
    console.log(`published ${result.entry.publicationStatus} artifact ${result.artifact}`);
    console.log(`manifest: ${result.manifestPath}`);
  }).catch((caught) => {
    console.error(caught?.stack || caught?.message || String(caught));
    process.exitCode = 1;
  });
}
