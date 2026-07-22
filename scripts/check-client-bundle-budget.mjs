#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const DEFAULT_BUDGET_PATH = 'scripts/client-bundle-budget.json';
const DEFAULT_BUILD_DIR = 'client/build';
const DEFAULT_MANIFEST_FILE = 'vite-bundle-manifest.json';
const DEFAULT_DOC_PATH = 'docs/bundle-budget.md';
const GENERATED_POLICY_START = '<!-- BEGIN GENERATED CLIENT BUNDLE POLICY -->';
const GENERATED_POLICY_END = '<!-- END GENERATED CLIENT BUNDLE POLICY -->';
const IMAGE_RE = /\.(?:avif|gif|ico|jpe?g|png|svg|webp)$/i;

function normalizePath(value) {
  return String(value || '').split(path.sep).join('/').replace(/^\.\//, '');
}

function readJson(absolutePath) {
  return JSON.parse(fs.readFileSync(absolutePath, 'utf8'));
}

function walkFiles(rootDir) {
  const files = [];
  const walk = (absoluteDir) => {
    if (!fs.existsSync(absoluteDir)) return;
    for (const entry of fs.readdirSync(absoluteDir, { withFileTypes: true })) {
      const absolutePath = path.join(absoluteDir, entry.name);
      if (entry.isDirectory()) walk(absolutePath);
      else if (entry.isFile()) files.push(absolutePath);
    }
  };
  walk(rootDir);
  return files.sort();
}

function validateBuildPath(buildDir, relativePath) {
  const normalized = normalizePath(relativePath);
  const absolutePath = path.resolve(buildDir, normalized);
  const relativeToBuild = path.relative(buildDir, absolutePath);
  if (relativeToBuild.startsWith('..') || path.isAbsolute(relativeToBuild)) {
    throw new Error(`build manifest path escapes output directory: ${relativePath}`);
  }
  return { absolutePath, normalized };
}

function fileSize(buildDir, relativePath, gzip = false) {
  const { absolutePath, normalized } = validateBuildPath(buildDir, relativePath);
  if (!fs.existsSync(absolutePath)) {
    return { file: normalized, missing: true, bytes: 0 };
  }
  const contents = fs.readFileSync(absolutePath);
  return {
    file: normalized,
    missing: false,
    bytes: gzip ? zlib.gzipSync(contents).length : contents.length,
  };
}

function hashFile(absolutePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(absolutePath)).digest('hex');
}

function metricResult({ scope, file, bytes, cap, warningRatio }) {
  if (bytes > cap) {
    return { finding: `${scope} ${file}: ${bytes} bytes exceeds ${cap}-byte cap` };
  }
  if (bytes >= Math.floor(cap * warningRatio)) {
    return { warning: `${scope} ${file}: ${bytes} bytes is at least ${Math.round(warningRatio * 100)}% of ${cap}-byte cap` };
  }
  return {};
}

function addMetric(result, measurement) {
  const outcome = metricResult(measurement);
  if (outcome.finding) result.findings.push(outcome.finding);
  if (outcome.warning) result.warnings.push(outcome.warning);
}

function formatNumber(value) {
  return Number(value).toLocaleString('en-US');
}

export function formatBundleBudgetPolicyMarkdown(budget) {
  const entrySources = budget.entry.sources.map((source) => `\`${source}\``).join(', ');
  const entryClassification = budget.entry.includeDirectDynamicImports
    ? `${entrySources} and its direct dynamic application entry`
    : entrySources;
  const exceptionRows = budget.exceptions.map((exception) => (
    `| Temporary exception: ${exception.id} | ${formatNumber(exception.maxMinifiedBytes)} bytes minified | \`${exception.filePrefix}*.js\` |`
  ));
  return [
    '| Scope | Limit | Classification |',
    '| --- | ---: | --- |',
    `| Application entry | ${formatNumber(budget.entry.maxGzipBytes)} bytes gzip | ${entryClassification} |`,
    `| Non-vendor JavaScript | ${formatNumber(budget.nonVendorChunk.maxMinifiedBytes)} bytes minified | All other non-vendor, non-exception chunks |`,
    ...exceptionRows,
    `| Duplicate emitted/compatibility images | 0 pairs | ${budget.duplicateAssets.allowedPairs.length} explicit allowlist entries |`,
    `| Warning threshold | ${Math.round(budget.warningRatio * 100)}% of each byte cap | Warning only; more than 100% fails |`,
  ].join('\n');
}

function documentationFindings(docsPath, budget) {
  if (!fs.existsSync(docsPath)) return [`bundle budget documentation is missing: ${normalizePath(docsPath)}`];
  const docs = fs.readFileSync(docsPath, 'utf8');
  const startIndex = docs.indexOf(GENERATED_POLICY_START);
  const endIndex = docs.indexOf(GENERATED_POLICY_END);
  if (startIndex < 0 || endIndex <= startIndex) {
    return ['bundle budget documentation is missing the generated policy markers'];
  }
  const actual = docs.slice(startIndex + GENERATED_POLICY_START.length, endIndex).trim();
  const expected = formatBundleBudgetPolicyMarkdown(budget).trim();
  return actual === expected ? [] : ['bundle budget documentation policy snapshot is stale'];
}

function duplicateImageResults(buildDir, allowedPairs) {
  const files = walkFiles(buildDir).filter((absolutePath) => IMAGE_RE.test(absolutePath));
  const emitted = files.filter((absolutePath) => normalizePath(path.relative(buildDir, absolutePath)).startsWith('assets/'));
  const compatibility = files.filter((absolutePath) => !normalizePath(path.relative(buildDir, absolutePath)).startsWith('assets/'));
  const byHash = new Map();
  compatibility.forEach((absolutePath) => {
    const hash = hashFile(absolutePath);
    if (!byHash.has(hash)) byHash.set(hash, []);
    byHash.get(hash).push(absolutePath);
  });
  const allowed = new Set(allowedPairs || []);
  const pairs = [];
  for (const emittedPath of emitted) {
    const matches = byHash.get(hashFile(emittedPath)) || [];
    for (const compatibilityPath of matches) {
      const emittedFile = normalizePath(path.relative(buildDir, emittedPath));
      const compatibilityFile = normalizePath(path.relative(buildDir, compatibilityPath));
      const key = `${emittedFile}|${compatibilityFile}`;
      if (!allowed.has(key)) {
        pairs.push({
          emittedFile,
          compatibilityFile,
          bytes: fs.statSync(emittedPath).size,
        });
      }
    }
  }
  return pairs.sort((left, right) => (
    `${left.emittedFile}|${left.compatibilityFile}`.localeCompare(`${right.emittedFile}|${right.compatibilityFile}`)
  ));
}

export function collectClientBundleBudgetResult({
  repoDir = process.cwd(),
  budgetPath = DEFAULT_BUDGET_PATH,
  buildDir = DEFAULT_BUILD_DIR,
  manifestFile = DEFAULT_MANIFEST_FILE,
  docsPath = DEFAULT_DOC_PATH,
} = {}) {
  const resolvedRepoDir = path.resolve(repoDir);
  const resolvedBuildDir = path.resolve(resolvedRepoDir, buildDir);
  const budget = readJson(path.resolve(resolvedRepoDir, budgetPath));
  const manifestPath = path.resolve(resolvedBuildDir, manifestFile);
  const manifest = readJson(manifestPath);
  const result = {
    findings: [],
    warnings: [],
    entries: [],
    chunks: [],
    exceptions: [],
    duplicatePairs: [],
    duplicateBytes: 0,
  };

  const entryFiles = new Set();
  const addEntry = (source, record) => {
    if (!record?.file) {
      result.findings.push(`entry source is missing from Vite manifest: ${source}`);
      return;
    }
    const measurement = fileSize(resolvedBuildDir, record.file, true);
    if (measurement.missing) {
      result.findings.push(`entry output is missing: ${measurement.file}`);
      return;
    }
    if (entryFiles.has(measurement.file)) return;
    entryFiles.add(measurement.file);
    result.entries.push({ source, ...measurement });
    addMetric(result, {
      scope: 'entry gzip',
      file: measurement.file,
      bytes: measurement.bytes,
      cap: budget.entry.maxGzipBytes,
      warningRatio: budget.warningRatio,
    });
  };
  for (const source of budget.entry.sources) {
    const record = manifest[source];
    addEntry(source, record);
    if (budget.entry.includeDirectDynamicImports && record) {
      (record.dynamicImports || []).forEach((manifestKey) => {
        addEntry(`${source} -> ${manifestKey}`, manifest[manifestKey]);
      });
    }
  }

  const exceptionFiles = new Map();
  for (const exception of budget.exceptions) {
    const matchingRecords = Object.values(manifest).filter((record) => (
      record?.file?.startsWith(exception.filePrefix) && record.file.endsWith('.js')
    ));
    if (matchingRecords.length !== 1) {
      result.findings.push(`budget exception ${exception.id} expected exactly one manifest output with prefix ${exception.filePrefix}; found ${matchingRecords.length}`);
      continue;
    }
    const [record] = matchingRecords;
    const measurement = fileSize(resolvedBuildDir, record.file, false);
    if (measurement.missing) {
      result.findings.push(`budget exception output is missing: ${measurement.file}`);
      continue;
    }
    exceptionFiles.set(measurement.file, exception);
    result.exceptions.push({ ...exception, ...measurement });
    addMetric(result, {
      scope: `exception ${exception.id}`,
      file: measurement.file,
      bytes: measurement.bytes,
      cap: exception.maxMinifiedBytes,
      warningRatio: budget.warningRatio,
    });
  }

  const jsFiles = walkFiles(path.join(resolvedBuildDir, 'assets'))
    .filter((absolutePath) => absolutePath.endsWith('.js'))
    .map((absolutePath) => normalizePath(path.relative(resolvedBuildDir, absolutePath)));
  for (const relativePath of jsFiles) {
    if (entryFiles.has(relativePath) || exceptionFiles.has(relativePath)) continue;
    if (budget.nonVendorChunk.vendorFilePrefixes.some((prefix) => relativePath.startsWith(prefix))) continue;
    const measurement = fileSize(resolvedBuildDir, relativePath, false);
    result.chunks.push(measurement);
    addMetric(result, {
      scope: 'non-vendor chunk',
      file: measurement.file,
      bytes: measurement.bytes,
      cap: budget.nonVendorChunk.maxMinifiedBytes,
      warningRatio: budget.warningRatio,
    });
  }

  result.duplicatePairs = duplicateImageResults(
    resolvedBuildDir,
    budget.duplicateAssets.allowedPairs,
  );
  result.duplicateBytes = result.duplicatePairs.reduce((sum, pair) => sum + pair.bytes, 0);
  result.duplicatePairs.forEach((pair) => {
    result.findings.push(`duplicate build image: ${pair.emittedFile} and ${pair.compatibilityFile} (${pair.bytes} bytes)`);
  });
  result.findings.push(...documentationFindings(path.resolve(resolvedRepoDir, docsPath), budget));

  return result;
}

function main(argv = process.argv.slice(2)) {
  if (argv.includes('--print-policy')) {
    const budget = readJson(path.resolve(process.cwd(), DEFAULT_BUDGET_PATH));
    console.log(formatBundleBudgetPolicyMarkdown(budget));
    return 0;
  }
  const result = collectClientBundleBudgetResult();
  result.entries.forEach((entry) => console.log(`entry ${entry.source}: ${entry.file} ${entry.bytes} bytes gzip`));
  result.exceptions.forEach((entry) => console.log(`exception ${entry.id}: ${entry.file} ${entry.bytes} bytes minified`));
  console.log(`non-vendor chunks checked: ${result.chunks.length}`);
  console.log(`unapproved duplicate image pairs: ${result.duplicatePairs.length} (${result.duplicateBytes} bytes)`);
  result.warnings.forEach((warning) => console.warn(`bundle budget warning: ${warning}`));
  if (result.findings.length > 0) {
    console.error('Client bundle budget check failed:');
    result.findings.forEach((finding) => console.error(`- ${finding}`));
    return 1;
  }
  console.log('Client bundle budget check passed.');
  return 0;
}

const isDirectRun = process.argv[1]
  && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) {
  try {
    process.exit(main());
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

export const __test__clientBundleBudget = {
  DEFAULT_BUDGET_PATH,
  DEFAULT_BUILD_DIR,
  DEFAULT_DOC_PATH,
  DEFAULT_MANIFEST_FILE,
  GENERATED_POLICY_END,
  GENERATED_POLICY_START,
  metricResult,
};
