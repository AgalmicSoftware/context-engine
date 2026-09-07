import fs from 'node:fs';
import path from 'node:path';

const documentPackages = [
  'canvg', 'dompurify', 'fast-png', 'fflate', 'html2canvas', 'iobuffer',
  'jspdf', 'performance-now', 'raf', 'rgbcolor', 'stackblur-canvas', 'svg-pathdata',
];

export const isDocumentExportModule = id => documentPackages.some(name =>
  String(id).replaceAll('\\', '/').includes(`/node_modules/${name}/`));

export const assertLazyDocumentBuild = (manifest, bundle) => {
  const entries = Object.keys(manifest).filter(key => manifest[key].isEntry);
  if (!entries.length) throw new Error('Missing build manifest entry');
  const chunks = new Map(Object.values(bundle).filter(item => item.type === 'chunk').map(item => [item.fileName, item]));
  // The boot shell and routes use import() themselves. Their static imports must
  // also keep document export code lazy, independently of the HTML entry.
  const applicationChunks = Object.keys(manifest).filter(key =>
    Object.keys(chunks.get(manifest[key].file)?.modules || {}).some(id => {
      const normalized = id.replaceAll('\\', '/');
      return normalized.includes('/src/') && !normalized.includes('/node_modules/');
    }));
  const visited = new Set();
  const visit = key => {
    if (visited.has(key)) return;
    visited.add(key);
    const item = manifest[key];
    if (!item) throw new Error(`Missing manifest import: ${key}`);
    const chunk = chunks.get(item.file);
    if (!chunk) throw new Error(`Missing build chunk: ${item.file}`);
    const eagerExports = Object.keys(chunk.modules).filter(isDocumentExportModule);
    if (eagerExports.length) throw new Error(`Document export modules entered the startup graph:\n${eagerExports.join('\n')}`);
    (item.imports || []).forEach(visit);
  };
  [...entries, ...applicationChunks].forEach(visit);
};

export const lazyDocumentBuildPlugin = () => ({
  name: 'ce-lazy-document-build',
  apply: 'build',
  writeBundle(options, bundle) {
    const manifest = JSON.parse(fs.readFileSync(path.join(options.dir, 'vite-bundle-manifest.json'), 'utf8'));
    assertLazyDocumentBuild(manifest, bundle);
  },
});
