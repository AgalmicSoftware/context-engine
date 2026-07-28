import path from 'node:path';
import { brotliCompressSync, gzipSync } from 'node:zlib';

const byteLength = (source) => Buffer.byteLength(
  typeof source === 'string' ? source : Buffer.from(source || ''),
);

const compressedSizes = (source) => {
  const buffer = typeof source === 'string' ? Buffer.from(source) : Buffer.from(source || '');
  return {
    rawBytes: buffer.length,
    gzipBytes: gzipSync(buffer).length,
    brotliBytes: brotliCompressSync(buffer).length,
  };
};

const escapeHtml = (value) => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;');

const artifactSource = (output) => (
  output.type === 'chunk' ? output.code : output.source
);

const normalizeModuleId = (moduleId, rootDir) => {
  const normalizedId = String(moduleId).replaceAll('\\', '/');
  const nodeModulesMarker = '/node_modules/';
  const nodeModulesIndex = normalizedId.lastIndexOf(nodeModulesMarker);
  if (nodeModulesIndex >= 0) {
    return `node_modules/${normalizedId.slice(nodeModulesIndex + nodeModulesMarker.length)}`;
  }
  if (!path.isAbsolute(normalizedId)) return normalizedId;

  const relativeId = path.relative(rootDir, normalizedId).replaceAll('\\', '/');
  if (relativeId && !relativeId.startsWith('../') && relativeId !== '..') {
    return relativeId;
  }
  return `<external>/${path.basename(normalizedId)}`;
};

export const createBundleReport = (bundle, { rootDir = process.cwd() } = {}) => {
  const artifacts = Object.values(bundle)
    .map((output) => {
      const modules = output.type === 'chunk'
        ? Object.entries(output.modules || {})
          .map(([id, details]) => ({
            id: normalizeModuleId(id, rootDir),
            renderedBytes: Number(details?.renderedLength || 0),
          }))
          .sort((left, right) => (
            right.renderedBytes - left.renderedBytes || left.id.localeCompare(right.id)
          ))
        : [];

      return {
        fileName: output.fileName,
        type: output.type,
        ...compressedSizes(artifactSource(output)),
        modules,
      };
    })
    .sort((left, right) => left.fileName.localeCompare(right.fileName));

  const totals = artifacts.reduce(
    (result, artifact) => ({
      rawBytes: result.rawBytes + artifact.rawBytes,
      gzipBytes: result.gzipBytes + artifact.gzipBytes,
      brotliBytes: result.brotliBytes + artifact.brotliBytes,
    }),
    { rawBytes: 0, gzipBytes: 0, brotliBytes: 0 },
  );

  return {
    version: 1,
    totals,
    artifacts,
  };
};

const formatBytes = (value) => new Intl.NumberFormat('en-US').format(value);

export const renderBundleReportHtml = (report) => {
  const artifactRows = report.artifacts.map((artifact) => {
    const moduleRows = artifact.modules.map((module) => (
      `<tr class="module"><td>${escapeHtml(module.id)}</td><td>${formatBytes(module.renderedBytes)}</td><td></td><td></td></tr>`
    )).join('');

    return [
      '<tr class="artifact">',
      `<td>${escapeHtml(artifact.fileName)}</td>`,
      `<td>${formatBytes(artifact.rawBytes)}</td>`,
      `<td>${formatBytes(artifact.gzipBytes)}</td>`,
      `<td>${formatBytes(artifact.brotliBytes)}</td>`,
      '</tr>',
      moduleRows,
    ].join('');
  }).join('');

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Context Engine bundle report</title>
  <style>
    body{background:#10151d;color:#edf3fb;font:14px/1.45 system-ui,sans-serif;margin:2rem}
    table{border-collapse:collapse;width:100%}th,td{border-bottom:1px solid #344054;padding:.55rem;text-align:right}
    th:first-child,td:first-child{text-align:left}.artifact{background:#182230;font-weight:700}.module{color:#b9c7d8;font-size:12px}
    caption{font-size:1.25rem;font-weight:700;margin-bottom:1rem;text-align:left}
  </style>
</head>
<body>
  <table>
    <caption>Bundle totals: ${formatBytes(report.totals.rawBytes)} raw / ${formatBytes(report.totals.gzipBytes)} gzip / ${formatBytes(report.totals.brotliBytes)} Brotli bytes</caption>
    <thead><tr><th>Artifact or module</th><th>Raw/rendered</th><th>Gzip</th><th>Brotli</th></tr></thead>
    <tbody>${artifactRows}</tbody>
  </table>
</body>
</html>
`;
};

export const createBundleReportPlugin = ({ rootDir = process.cwd() } = {}) => ({
  name: 'ce-bundle-report',
  apply: 'build',
  generateBundle(_outputOptions, bundle) {
    const report = createBundleReport(bundle, { rootDir });
    this.emitFile({
      type: 'asset',
      fileName: 'bundle-report.json',
      source: `${JSON.stringify(report, null, 2)}\n`,
    });
    this.emitFile({
      type: 'asset',
      fileName: 'bundle-report.html',
      source: renderBundleReportHtml(report),
    });
  },
});

export const measureBundleSourceBytes = byteLength;
