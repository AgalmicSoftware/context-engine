#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CHECK_ONLY = process.argv.includes('--check');
const SOURCE_EXTENSIONS = Object.freeze(['.js', '.jsx', '.mjs', '.cjs', '.ts', '.tsx']);

const MAPS = Object.freeze([
  {
    title: 'SurveyTool Runtime Map',
    output: 'docs/SurveyTool.MAP.md',
    intro: 'docs/maps/SurveyTool.intro.md',
    sourceRoots: ['client/src/components/SurveyTool'],
  },
  {
    title: 'SessionWizard Runtime Map',
    output: 'docs/SessionWizard.MAP.md',
    intro: 'docs/maps/SessionWizard.intro.md',
    sourceRoots: ['client/src/components/Sessions'],
  },
  {
    title: 'AppShell Runtime Map',
    output: 'docs/MainSite.MAP.md',
    intro: 'docs/maps/MainSite.intro.md',
    sourceRoots: ['client/src/components/MainSite'],
  },
  {
    title: 'AdminPage Runtime Map',
    output: 'docs/AdminPage.MAP.md',
    intro: 'docs/maps/AdminPage.intro.md',
    sourceRoots: ['client/src/components/Admin'],
  },
]);

const mapDocPaths = MAPS.flatMap(({ output, intro }) => [output, intro]);
const presentMapDocPaths = mapDocPaths.filter((relativePath) => fs.existsSync(path.join(ROOT, relativePath)));

// Public release copies intentionally strip both the generated runtime maps and
// their private intro sources. Keep the shared wiring command useful there,
// while still treating a partially stripped or accidentally deleted map set as
// an error in development checkouts.
if (CHECK_ONLY && presentMapDocPaths.length === 0) {
  console.log('Runtime map check skipped: map documentation is not included in this release surface.');
  process.exit(0);
}

if (presentMapDocPaths.length !== mapDocPaths.length) {
  const missing = mapDocPaths.filter((relativePath) => !fs.existsSync(path.join(ROOT, relativePath)));
  console.error(`Runtime map documentation is incomplete; missing: ${missing.join(', ')}`);
  process.exit(1);
}

const toPosixPath = (value) => value.split(path.sep).join('/');

const listSourceFiles = (relativeRoot) => {
  const absoluteRoot = path.join(ROOT, relativeRoot);
  const files = [];

  const visit = (directory) => {
    fs.readdirSync(directory, { withFileTypes: true })
      .sort((left, right) => left.name.localeCompare(right.name))
      .forEach((entry) => {
        const absolutePath = path.join(directory, entry.name);
        if (entry.isDirectory()) {
          visit(absolutePath);
          return;
        }
        if (entry.isFile() && SOURCE_EXTENSIONS.includes(path.extname(entry.name))) {
          files.push(toPosixPath(path.relative(ROOT, absolutePath)));
        }
      });
  };

  visit(absoluteRoot);
  return files;
};

const lineCount = (source) => {
  if (source.length === 0) return 0;
  const lines = source.split(/\r?\n/).length;
  return /\r?\n$/.test(source) ? lines - 1 : lines;
};

const cleanComment = (comment) =>
  comment
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*\/\/?\*?\*?\/?\s?/, '').replace(/\*\/\s*$/, '').trim())
    .filter((line) => line && !line.startsWith('@'))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();

const describeSource = (source) => {
  const tagged = source.match(/@(?:module|description)\s+([^\r\n*]+)/);
  if (tagged?.[1]) return tagged[1].trim();

  const leadingBlock = source.match(/^\s*\/\*\*?([\s\S]*?)\*\//);
  if (leadingBlock?.[1]) {
    const description = cleanComment(leadingBlock[1]);
    if (description) return description;
  }

  const leadingLine = source.match(/^\s*\/\/\s*([^\r\n]+)/);
  return leadingLine?.[1]?.trim() || '—';
};

const exportedNames = (source) => {
  const names = new Set();
  const declarationPattern = /\bexport\s+(?:declare\s+)?(?:async\s+)?(?:const|let|var|function|class|interface|type|enum)\s+([A-Za-z_$][\w$]*)/g;
  const defaultPattern = /\bexport\s+default\b/g;
  const exportListPattern = /\bexport\s+(?:type\s+)?\{([^}]+)\}/g;

  for (const match of source.matchAll(declarationPattern)) names.add(match[1]);
  if (defaultPattern.test(source)) names.add('default');
  for (const match of source.matchAll(exportListPattern)) {
    match[1].split(',').forEach((entry) => {
      const normalized = entry.trim().replace(/^type\s+/, '');
      if (!normalized) return;
      const alias = normalized.match(/\bas\s+([A-Za-z_$][\w$]*)$/);
      const direct = normalized.match(/^([A-Za-z_$][\w$]*)$/);
      if (alias) names.add(alias[1]);
      else if (direct) names.add(direct[1]);
    });
  }

  return [...names].sort((left, right) => left.localeCompare(right));
};

const importSpecifiers = (source) => {
  const specifiers = new Set();
  const staticPattern = /\b(?:import|export)\s+(?:type\s+)?(?:[^'";]*?\s+from\s+)?['"]([^'"]+)['"]/g;
  const dynamicPattern = /\bimport\(\s*['"]([^'"]+)['"]\s*\)/g;
  for (const pattern of [staticPattern, dynamicPattern]) {
    for (const match of source.matchAll(pattern)) specifiers.add(match[1]);
  }
  return [...specifiers];
};

const resolveAreaImport = (fromFile, specifier, areaFiles) => {
  if (!specifier.startsWith('.')) return null;
  const absoluteBase = path.resolve(ROOT, path.dirname(fromFile), specifier);
  const extension = path.extname(absoluteBase);
  const withoutExtension = extension ? absoluteBase.slice(0, -extension.length) : absoluteBase;
  const candidates = [
    absoluteBase,
    ...SOURCE_EXTENSIONS.map((candidateExtension) => `${withoutExtension}${candidateExtension}`),
    ...SOURCE_EXTENSIONS.map((candidateExtension) => path.join(absoluteBase, `index${candidateExtension}`)),
  ];

  for (const candidate of candidates) {
    const relativeCandidate = toPosixPath(path.relative(ROOT, candidate));
    if (areaFiles.has(relativeCandidate)) return relativeCandidate;
  }
  return null;
};

const escapeCell = (value) =>
  String(value)
    .replace(/\|/g, '\\|')
    .replace(/\r?\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const renderMap = ({ title, output, intro, sourceRoots }) => {
  const files = [...new Set(sourceRoots.flatMap(listSourceFiles))].sort((left, right) => left.localeCompare(right));
  const areaFiles = new Set(files);
  const rows = files.map((file) => {
    const source = fs.readFileSync(path.join(ROOT, file), 'utf8');
    const edges = importSpecifiers(source)
      .map((specifier) => resolveAreaImport(file, specifier, areaFiles))
      .filter(Boolean)
      .filter((edge, index, allEdges) => allEdges.indexOf(edge) === index)
      .sort((left, right) => left.localeCompare(right));
    return {
      file,
      lines: lineCount(source),
      description: describeSource(source),
      exports: exportedNames(source),
      edges,
    };
  });

  const sourceSummary = sourceRoots.map((sourceRoot) => `\`${sourceRoot}/\``).join(', ');
  const introSource = fs.readFileSync(path.join(ROOT, intro), 'utf8').trim();
  const tableRows = rows.map(
    ({ file, lines, description, exports, edges }) =>
      `| \`${file}\` | ${lines} | ${escapeCell(description)} | ${exports.length ? exports.map((name) => `\`${name}\``).join(', ') : '—'} | ${edges.length ? edges.map((edge) => `\`${edge}\``).join('<br>') : '—'} |`,
  );

  return [
    '<!-- Generated by scripts/generate-map-docs.mjs. Edit the intro source named below, then run npm run docs:maps. -->',
    `# ${title}`,
    '',
    `> Generated file. Edit \`${intro}\` for architectural guidance; source inventory changes belong in code.`,
    '',
    introSource,
    '',
    '## Generated inventory',
    '',
    `Source roots: ${sourceSummary}. Files are sorted by repository-relative path. Line counts, exports, and intra-area imports are derived from the current tree.`,
    '',
    '| File | Lines | Description | Exports | Intra-area imports |',
    '|---|---:|---|---|---|',
    ...tableRows,
    '',
  ].join('\n');
};

let driftFound = false;
for (const map of MAPS) {
  const rendered = renderMap(map);
  const outputPath = path.join(ROOT, map.output);
  const current = fs.existsSync(outputPath) ? fs.readFileSync(outputPath, 'utf8') : '';
  if (CHECK_ONLY) {
    if (current !== rendered) {
      driftFound = true;
      console.error(`${map.output} is stale; run npm run docs:maps`);
    }
    continue;
  }
  if (current !== rendered) {
    fs.writeFileSync(outputPath, rendered);
    console.log(`updated ${map.output}`);
  }
}

if (driftFound) process.exitCode = 1;
