#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');

const OPERATOR_LOCAL_ABSENT = 'operator-local, not present in this checkout';
const PASSKEY_FIX_HINT = 'restore the operator-local scripts/lib/passkey-wallet-derivation.js helper';

const PACKAGE_TEST_SCRIPT_RE = /scripts\/test-[^\s'"`]+?\.js\b/g;
const TOP_LEVEL_SCRIPT_RE = /^test-.+\.js$/;
const JS_FILE_RE = /\.(?:cjs|js)$/;
const PATH_SEP_RE = /[\\/]/g;

function dependencyFixHint(specifier) {
  return path.basename(String(specifier || '')) === 'passkey-wallet-derivation.js'
    ? PASSKEY_FIX_HINT
    : `restore or update the missing dependency ${specifier}`;
}

function parseArgs(argv) {
  const options = {
    repoDir: path.resolve(__dirname, '..'),
    json: false,
  };

  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--repo') {
      index += 1;
      if (index >= argv.length) throw new Error('--repo requires a value');
      options.repoDir = path.resolve(argv[index]);
    } else if (arg === '--json') {
      options.json = true;
    } else if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else {
      throw new Error(`unknown option: ${arg}`);
    }
  }

  return options;
}

function usage() {
  return `Usage: node scripts/ai-harness-doctor.js [--repo <path>] [--json]

Checks local E2E harness entrypoints without loading secrets or executing flows.
Operator-local homes may be absent in stripped checkouts:
  - scripts/test-*.js
  - scripts/test-*.ui.js
  - scripts/lib/e2e/
`;
}

function readJson(rootDir, relativePath) {
  return JSON.parse(fs.readFileSync(path.join(rootDir, relativePath), 'utf8'));
}

function collectPackageScriptEntrypoints(rootDir) {
  const packagePath = path.join(rootDir, 'package.json');
  if (!fs.existsSync(packagePath)) return [];

  const pkg = readJson(rootDir, 'package.json');
  const entries = new Set();
  Object.values(pkg.scripts || {}).forEach((script) => {
    String(script).match(PACKAGE_TEST_SCRIPT_RE)?.forEach((entry) => entries.add(entry));
  });
  return [...entries];
}

function collectTopLevelTestScripts(rootDir) {
  const scriptsDir = path.join(rootDir, 'scripts');
  if (!fs.existsSync(scriptsDir) || !fs.statSync(scriptsDir).isDirectory()) return [];

  return fs.readdirSync(scriptsDir)
    .filter((entry) => TOP_LEVEL_SCRIPT_RE.test(entry))
    .map((entry) => path.join('scripts', entry));
}

function collectHarnessEntrypoints(rootDir = path.resolve(__dirname, '..')) {
  return [...new Set([
    'scripts/lib/e2e/wallets.js',
    ...collectPackageScriptEntrypoints(rootDir),
    ...collectTopLevelTestScripts(rootDir),
  ])].sort();
}

function isIdentifierChar(char) {
  return !!char && /[A-Za-z0-9_$]/.test(char);
}

function parseRequireSpecifier(source, start) {
  let cursor = start + 'require'.length;
  if (source.startsWith('.resolve', cursor)) {
    cursor += '.resolve'.length;
  }
  while (/\s/.test(source[cursor] || '')) cursor += 1;
  if (source[cursor] !== '(') return null;
  cursor += 1;
  while (/\s/.test(source[cursor] || '')) cursor += 1;

  const quote = source[cursor];
  if (quote !== '"' && quote !== "'") return null;
  cursor += 1;

  let specifier = '';
  while (cursor < source.length) {
    const char = source[cursor];
    if (char === '\\') {
      specifier += source.slice(cursor, cursor + 2);
      cursor += 2;
      continue;
    }
    if (char === quote) return { specifier, end: cursor + 1 };
    specifier += char;
    cursor += 1;
  }

  return null;
}

function startsFunctionBlock(source, braceIndex) {
  const prefix = source.slice(Math.max(0, braceIndex - 160), braceIndex);
  return /(?:\bfunction\b[^{;]*|\)\s*=>|[A-Za-z0-9_$\]]\s*=>)\s*$/.test(prefix);
}

function extractTopLevelRequireSpecifiers(source) {
  const specifiers = [];
  const functionBlockDepths = [];
  let braceDepth = 0;
  let quote = '';
  let inTemplate = false;
  let inLineComment = false;
  let inBlockComment = false;

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];

    if (inLineComment) {
      if (char === '\n') inLineComment = false;
      continue;
    }
    if (inBlockComment) {
      if (char === '*' && next === '/') {
        inBlockComment = false;
        index += 1;
      }
      continue;
    }
    if (quote) {
      if (char === '\\') {
        index += 1;
      } else if (char === quote) {
        quote = '';
      }
      continue;
    }
    if (inTemplate) {
      if (char === '\\') {
        index += 1;
      } else if (char === '`') {
        inTemplate = false;
      }
      continue;
    }
    if (char === '/' && next === '/') {
      inLineComment = true;
      index += 1;
      continue;
    }
    if (char === '/' && next === '*') {
      inBlockComment = true;
      index += 1;
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (char === '`') {
      inTemplate = true;
      continue;
    }

    if (!functionBlockDepths.length
      && source.startsWith('require', index)
      && !isIdentifierChar(source[index - 1])
      && !isIdentifierChar(source[index + 'require'.length])) {
      const parsed = parseRequireSpecifier(source, index);
      if (parsed) {
        specifiers.push(parsed.specifier);
        index = parsed.end - 1;
        continue;
      }
    }

    if (char === '{') {
      braceDepth += 1;
      if (startsFunctionBlock(source, index)) {
        functionBlockDepths.push(braceDepth);
      }
    } else if (char === '}') {
      if (functionBlockDepths[functionBlockDepths.length - 1] === braceDepth) {
        functionBlockDepths.pop();
      }
      braceDepth = Math.max(0, braceDepth - 1);
    }
  }

  return specifiers;
}

function resolveSpecifier(specifier, importerPath) {
  if (Module.isBuiltin(specifier)) {
    return { ok: true, resolvedPath: specifier };
  }

  try {
    return {
      ok: true,
      resolvedPath: require.resolve(specifier, { paths: [path.dirname(importerPath)] }),
    };
  } catch (error) {
    return {
      ok: false,
      module: specifier,
      importer: importerPath,
      error: error && error.message ? error.message : String(error),
      fixHint: PASSKEY_FIX_HINT,
    };
  }
}

function toRealPath(filePath) {
  try {
    return fs.realpathSync.native(filePath);
  } catch (_) {
    return path.resolve(filePath);
  }
}

function isRepoOwnedJavaScriptFile(resolvedPath, rootDir) {
  const realRoot = toRealPath(rootDir);
  const realResolved = toRealPath(resolvedPath);
  const relativePath = path.relative(realRoot, realResolved);
  if (!relativePath || relativePath.startsWith('..') || path.isAbsolute(relativePath)) return false;
  if (relativePath.split(PATH_SEP_RE).includes('node_modules')) return false;
  return JS_FILE_RE.test(realResolved);
}

function relativeToRoot(rootDir, filePath) {
  const realRoot = toRealPath(rootDir);
  const realFile = toRealPath(filePath);
  const relativePath = path.relative(realRoot, realFile);
  return relativePath && !relativePath.startsWith('..') && !path.isAbsolute(relativePath)
    ? relativePath
    : path.relative(rootDir, filePath);
}

function firstUnresolvableRequire(filePath, rootDir, visited = new Set()) {
  const normalizedFile = path.resolve(filePath);
  if (visited.has(normalizedFile)) return null;
  visited.add(normalizedFile);

  let source;
  try {
    source = fs.readFileSync(normalizedFile, 'utf8');
  } catch (error) {
    return {
      module: path.relative(rootDir, normalizedFile),
      importer: null,
      error: error && error.message ? error.message : String(error),
      fixHint: PASSKEY_FIX_HINT,
    };
  }

  for (const specifier of extractTopLevelRequireSpecifiers(source)) {
    const resolved = resolveSpecifier(specifier, normalizedFile);
    if (!resolved.ok) return resolved;

    const resolvedPath = path.resolve(resolved.resolvedPath);
    if (isRepoOwnedJavaScriptFile(resolvedPath, rootDir)) {
      const nested = firstUnresolvableRequire(resolvedPath, rootDir, visited);
      if (nested) return nested;
    }
  }

  return null;
}

function analyzeEntrypoint(rootDir, relativePath) {
  const absolutePath = path.join(rootDir, relativePath);
  if (!fs.existsSync(absolutePath)) {
    return {
      entrypoint: relativePath,
      status: 'absent',
      message: OPERATOR_LOCAL_ABSENT,
    };
  }

  const firstUnresolved = firstUnresolvableRequire(absolutePath, rootDir);
  if (firstUnresolved) {
    return {
      entrypoint: relativePath,
      status: 'unresolved',
      firstUnresolved: {
        module: firstUnresolved.module,
        importer: firstUnresolved.importer ? relativeToRoot(rootDir, firstUnresolved.importer) : null,
        fixHint: firstUnresolved.fixHint,
      },
    };
  }

  return {
    entrypoint: relativePath,
    status: 'resolved',
  };
}

function runHarnessDoctor(rootDir = path.resolve(__dirname, '..')) {
  const repoDir = path.resolve(rootDir);
  const results = collectHarnessEntrypoints(repoDir)
    .map((entrypoint) => analyzeEntrypoint(repoDir, entrypoint));
  const summary = results.reduce((acc, result) => {
    acc[result.status] = (acc[result.status] || 0) + 1;
    return acc;
  }, { resolved: 0, absent: 0, unresolved: 0 });

  return { rootDir: repoDir, results, summary };
}

function formatResult(result) {
  if (result.status === 'absent') {
    return `[absent] ${result.entrypoint} - ${result.message}`;
  }
  if (result.status === 'unresolved') {
    const unresolved = result.firstUnresolved;
    return [
      `[unresolved] ${result.entrypoint}`,
      `  first unresolvable module: ${unresolved.module}`,
      `  importer: ${unresolved.importer || result.entrypoint}`,
      `  fix: ${unresolved.fixHint}`,
    ].join('\n');
  }
  return `[resolved] ${result.entrypoint}`;
}

function main() {
  const options = parseArgs(process.argv);
  if (options.help) {
    console.log(usage());
    return 0;
  }

  const report = runHarnessDoctor(options.repoDir);
  if (options.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log('Context Engine E2E harness doctor');
    console.log('Operator-local homes: scripts/test-*.js, scripts/test-*.ui.js, scripts/lib/e2e/');
    report.results.forEach((result) => console.log(formatResult(result)));
    console.log(`summary: resolved=${report.summary.resolved} absent=${report.summary.absent} unresolved=${report.summary.unresolved}`);
  }

  return report.summary.unresolved > 0 ? 1 : 0;
}

if (require.main === module) {
  try {
    process.exitCode = main();
  } catch (error) {
    console.error(error && error.stack ? error.stack : String(error));
    process.exitCode = 1;
  }
}

module.exports = {
  OPERATOR_LOCAL_ABSENT,
  PASSKEY_FIX_HINT,
  analyzeEntrypoint,
  collectHarnessEntrypoints,
  extractTopLevelRequireSpecifiers,
  firstUnresolvableRequire,
  runHarnessDoctor,
};
