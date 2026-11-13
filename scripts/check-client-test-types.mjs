#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const {
  CLIENT_TEST_TYPE_CONTRACT,
  listTrackedClientTestTypeFiles,
} = require('./client-test-type-universe');

const DIAGNOSTIC_RE = /^(.+?)\((\d+),(\d+)\): error (TS\d+): (.+)$/;

function normalizePath(value) {
  return String(value || '').split(path.sep).join('/');
}

function canonicalAbsolutePath(value) {
  const absolutePath = path.resolve(value);
  try {
    return normalizePath(fs.realpathSync(absolutePath));
  } catch (_error) {
    return normalizePath(absolutePath);
  }
}

// The compiler holds every typed test in memory at once: between 2 and 2.5 GB
// of heap today. Node's default heap on a small CI runner is about 2 GB, and
// the compiler was killed there, so it is given its own, whatever NODE_OPTIONS says.
const COMPILER_HEAP_MB = 4096;

function runCompiler({ clientDir, tscPath, args }) {
  const result = spawnSync(process.execPath, [`--max-old-space-size=${COMPILER_HEAP_MB}`, tscPath, ...args], {
    cwd: clientDir,
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  return result;
}

/**
 * How a compiler run ended, in words. A null status means a signal killed it
 * (SIGABRT is Node running out of heap), which the status alone never says.
 */
export function describeCompilerExit({ status, signal, stderr, stdout }) {
  const how = status === null ? `was killed by ${signal || 'a signal'}` : `exited ${status}`;
  const lines = (text) => String(text || '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  // Node reports a fatal error on stderr; tsc prints errors that name no file on stdout.
  const said = lines(stderr).find((line) => /FATAL ERROR|out of memory/i.test(line))
    || lines(stderr).slice(-3).join(' | ')
    || lines(stdout).slice(-3).join(' | ');
  return said ? `${how} (it said: ${said.slice(0, 400)})` : how;
}

export function parseTypeScriptDiagnostics(output) {
  const counts = new Map();
  String(output || '').split(/\r?\n/).forEach((line) => {
    const match = line.match(DIAGNOSTIC_RE);
    if (!match) return;
    const file = normalizePath(match[1]).replace(/^\.\//, '');
    const signature = `${file}|${match[4]}|${match[5]}`;
    counts.set(signature, (counts.get(signature) || 0) + 1);
  });
  return [...counts.entries()]
    .map(([signature, count]) => ({ signature, count }))
    .sort((left, right) => left.signature.localeCompare(right.signature));
}

function diagnosticGains(baseline, current) {
  const allowed = new Map((baseline.diagnostics || []).map((entry) => [entry.signature, Number(entry.count || 0)]));
  return current.flatMap((entry) => {
    const baseCount = allowed.get(entry.signature) || 0;
    return entry.count > baseCount
      ? [{ signature: entry.signature, baseCount, currentCount: entry.count }]
      : [];
  });
}

function inventoryHash(files) {
  return crypto.createHash('sha256').update(files.join('\n')).digest('hex');
}

export function runClientTestTypeGate({
  repoDir = process.cwd(),
  clientDir = path.join(repoDir, 'client'),
  tsconfigPath = 'tsconfig.tests.json',
  baselinePath = path.join(repoDir, 'scripts/client-test-type-diagnostics-baseline.json'),
  tscPath = path.join(clientDir, 'node_modules/typescript/bin/tsc'),
  typedTestFiles,
} = {}) {
  const files = typedTestFiles || listTrackedClientTestTypeFiles(repoDir);
  const listResult = runCompiler({
    clientDir,
    tscPath,
    args: ['--project', tsconfigPath, '--noEmit', '--listFilesOnly', '--pretty', 'false'],
  });
  const listedFiles = new Set(String(listResult.stdout || '')
    .split(/\r?\n/)
    .filter(Boolean)
    .map((absolutePath) => canonicalAbsolutePath(path.resolve(clientDir, absolutePath))));
  // A listing that was killed lists nothing; say that, not that every file is missing.
  const listingKilled = listResult.status === null;
  const missingInventoryFiles = listingKilled ? [] : files.filter((relativePath) => (
    !listedFiles.has(canonicalAbsolutePath(path.resolve(repoDir, relativePath)))
  ));

  const typeResult = runCompiler({
    clientDir,
    tscPath,
    args: ['--project', tsconfigPath, '--noEmit', '--pretty', 'false'],
  });
  const diagnostics = parseTypeScriptDiagnostics(`${typeResult.stdout || ''}\n${typeResult.stderr || ''}`);
  const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
  const gains = diagnosticGains(baseline, diagnostics);
  const findings = [];
  if (listingKilled) findings.push(`typed-test file listing ${describeCompilerExit(listResult)}`);
  if (missingInventoryFiles.length > 0) {
    findings.push(`typed test config omits ${missingInventoryFiles.length} tracked file${missingInventoryFiles.length === 1 ? '' : 's'}: ${missingInventoryFiles.join(', ')}`);
  }
  gains.forEach((gain) => {
    findings.push(`new typed-test diagnostic (${gain.baseCount} -> ${gain.currentCount}): ${gain.signature}`);
  });
  // A killed compiler checked only part of the program, whatever it printed first.
  if (typeResult.status === null || (typeResult.status !== 0 && diagnostics.length === 0)) {
    findings.push(`typed-test compiler ${describeCompilerExit(typeResult)} without parseable diagnostics`);
  }
  return {
    contract: CLIENT_TEST_TYPE_CONTRACT,
    diagnostics,
    diagnosticGains: gains,
    findings,
    inventoryHash: inventoryHash(files),
    missingInventoryFiles,
    typedTestFileCount: files.length,
  };
}

function main(argv) {
  const writeIndex = argv.indexOf('--write-baseline');
  const writeBaseline = writeIndex >= 0;
  const baselinePath = writeBaseline && argv[writeIndex + 1]
    ? path.resolve(argv[writeIndex + 1])
    : path.resolve('scripts/client-test-type-diagnostics-baseline.json');
  if (writeBaseline && fs.existsSync(baselinePath)) {
    throw new Error(`refusing to overwrite existing baseline: ${path.relative(process.cwd(), baselinePath)}`);
  }
  if (writeBaseline) {
    const temporaryBaseline = path.join(path.dirname(baselinePath), `.client-test-type-empty-${process.pid}.json`);
    fs.writeFileSync(temporaryBaseline, '{"diagnostics":[]}\n', { flag: 'wx' });
    try {
      const result = runClientTestTypeGate({ baselinePath: temporaryBaseline });
      fs.writeFileSync(baselinePath, `${JSON.stringify({
        schemaVersion: 1,
        measuredAt: '2026-07-21',
        source: 'npm run typecheck:client-tests',
        policy: 'Every tracked typed test/helper is compiled. Existing diagnostics are a monotonic migration baseline; new signatures or counts fail.',
        typedTestFileCount: result.typedTestFileCount,
        typedTestInventorySha256: result.inventoryHash,
        diagnostics: result.diagnostics,
      }, null, 2)}\n`, { flag: 'wx' });
    } finally {
      fs.rmSync(temporaryBaseline, { force: true });
    }
    console.log(`Wrote typed-test diagnostic baseline to ${path.relative(process.cwd(), baselinePath)}.`);
    return 0;
  }

  const result = runClientTestTypeGate({ baselinePath });
  console.log(`Typed-test compiler classified ${result.typedTestFileCount} tracked files with ${result.diagnostics.reduce((sum, entry) => sum + entry.count, 0)} banked diagnostics.`);
  if (result.findings.length > 0) {
    console.error('Typed-test verification failed:');
    result.findings.forEach((finding) => console.error(`- ${finding}`));
    return 1;
  }
  console.log('Typed-test verification passed with no diagnostic growth.');
  return 0;
}

const isDirect = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirect) {
  try {
    process.exit(main(process.argv.slice(2)));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
