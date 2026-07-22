'use strict';

const fs = require('node:fs');
const path = require('node:path');

const {
  ROOT_JEST_TEST_FILES,
  ROOT_LOCAL_CHAIN_TEST_FILES,
  ROOT_NODE_TEST_FILES,
  ROOT_PRIVATE_STRIPPED_TEST_FILE_RE,
  ROOT_TEST_FILES,
} = require('./testInventoryConfig');

const ROOT_TEST_FILE_RE = /\.test\.(?:c?js|mjs)$/;
const WORKER_TEST_FILE_RE = /\.test\.mjs$/;
const ROOT_SCRIPT_PUBLIC_WORKER_DIRS = new Set(['sessionCorsWorker']);

function listDirectTestFiles(rootDir, relativeDir, fileRe) {
  const absoluteDir = path.join(rootDir, relativeDir);
  if (!fs.existsSync(absoluteDir) || !fs.statSync(absoluteDir).isDirectory()) {
    return [];
  }

  return fs.readdirSync(absoluteDir)
    .filter((entry) => fileRe.test(entry))
    .sort()
    .map((entry) => path.join(relativeDir, entry));
}

function listRecursiveTestFiles(rootDir, relativeDir, fileRe) {
  const absoluteDir = path.join(rootDir, relativeDir);
  if (!fs.existsSync(absoluteDir) || !fs.statSync(absoluteDir).isDirectory()) {
    return [];
  }

  return fs.readdirSync(absoluteDir, { withFileTypes: true })
    .flatMap((entry) => {
      const relativePath = path.join(relativeDir, entry.name);
      if (entry.isDirectory()) return listRecursiveTestFiles(rootDir, relativePath, fileRe);
      return entry.isFile() && fileRe.test(entry.name) ? [relativePath] : [];
    })
    .sort();
}

function readJson(rootDir, relativePath) {
  return JSON.parse(fs.readFileSync(path.join(rootDir, relativePath), 'utf8'));
}

function verifyPackageScript(pkg, scriptName, expectedFragment, failures, label = 'package.json') {
  const script = String(pkg?.scripts?.[scriptName] || '');
  if (!script) {
    failures.push(`${label} missing scripts.${scriptName}`);
    return;
  }
  if (expectedFragment && !script.includes(expectedFragment)) {
    failures.push(`${label} scripts.${scriptName} must include "${expectedFragment}"`);
  }
}

function verifyClassifiedRootTests(rootDir, failures) {
  const existingRootTests = listRecursiveTestFiles(rootDir, path.join('tests', 'root'), ROOT_TEST_FILE_RE);
  const classified = new Set(ROOT_TEST_FILES);

  const unclassified = existingRootTests.filter(
    (relativePath) => !classified.has(relativePath) && !ROOT_PRIVATE_STRIPPED_TEST_FILE_RE.test(relativePath),
  );
  if (unclassified.length) {
    failures.push(`unclassified root test files: ${unclassified.join(', ')}`);
  }

  [
    ...ROOT_NODE_TEST_FILES,
    ...ROOT_JEST_TEST_FILES,
    ...ROOT_LOCAL_CHAIN_TEST_FILES,
  ].forEach((relativePath) => {
    if (!fs.existsSync(path.join(rootDir, relativePath))) {
      failures.push(`classified public/local root test is missing: ${relativePath}`);
    }
  });
}

function verifyWorkerTests(rootDir, failures) {
  const sessionWorkerDir = path.join(rootDir, 'workers', 'sessionCorsWorker');
  if (fs.existsSync(sessionWorkerDir)) {
    const sessionWorkerTests = listDirectTestFiles(rootDir, path.join('workers', 'sessionCorsWorker'), WORKER_TEST_FILE_RE);
    if (!sessionWorkerTests.length) {
      failures.push('workers/sessionCorsWorker has no *.test.mjs files');
    }

    const workerPkg = readJson(rootDir, path.join('workers', 'sessionCorsWorker', 'package.json'));
    verifyPackageScript(workerPkg, 'test', 'node --test *.test.mjs', failures, 'workers/sessionCorsWorker/package.json');
  }
}

function verifyRootScripts(rootDir, failures) {
  const pkg = readJson(rootDir, 'package.json');
  verifyPackageScript(pkg, 'test:root:jest', '--testMatch', failures);
  verifyPackageScript(pkg, 'test:worker:session-cors', 'npm --prefix workers/sessionCorsWorker test', failures);
  verifyPackageScript(pkg, 'typecheck:client-tests', 'scripts/check-client-test-types.mjs', failures);
  verifyPackageScript(pkg, 'ci:gate', 'scripts/run-ci-gates.mjs --gate', failures);
  verifyPackageScript(pkg, 'test:ci', 'scripts/run-ci-gates.mjs --profile ci', failures);

  const manifestPath = path.join(rootDir, 'scripts', 'ci-gates.json');
  if (!fs.existsSync(manifestPath)) {
    failures.push('missing scripts/ci-gates.json');
  } else {
    const manifest = readJson(rootDir, path.join('scripts', 'ci-gates.json'));
    const ciProfile = manifest?.profiles?.ci || [];
    const gateCommands = (gateName) => (
      (manifest?.gates?.[gateName]?.commands || [])
        .map((entry) => [entry.command, ...(entry.args || [])].join(' '))
    );
    if (!ciProfile.includes('root-jest')) {
      failures.push('scripts/ci-gates.json profile "ci" must include "root-jest"');
    }
    if (!ciProfile.includes('workers')) {
      failures.push('scripts/ci-gates.json profile "ci" must include "workers"');
    }
    if (!gateCommands('root-jest').includes('npm run test:root:jest')) {
      failures.push('scripts/ci-gates.json gate "root-jest" must run test:root:jest');
    }
    if (!gateCommands('workers').includes('npm run test:worker:session-cors')) {
      failures.push('scripts/ci-gates.json gate "workers" must run test:worker:session-cors');
    }
    if (!gateCommands('wiring-and-release').includes('npm run typecheck:client-tests')) {
      failures.push('scripts/ci-gates.json gate "wiring-and-release" must run typecheck:client-tests');
    }
    if (!gateCommands('release').includes('npm run typecheck:client-tests')) {
      failures.push('scripts/ci-gates.json gate "release" must run typecheck:client-tests');
    }
  }

  const rootJestScript = String(pkg?.scripts?.['test:root:jest'] || '');
  ROOT_JEST_TEST_FILES.forEach((relativePath) => {
    const scriptPath = `<rootDir>/${path.join('..', relativePath)}`;
    if (!rootJestScript.includes(scriptPath)) {
      failures.push(`package.json scripts.test:root:jest must include "${scriptPath}"`);
    }
  });

  const rootScriptsText = JSON.stringify(pkg.scripts || {});
  const workerScriptRefs = [...rootScriptsText.matchAll(/workers[\\/]+([^\\/ "'`]+)/g)]
    .map((match) => match[1])
    .filter((workerDir) => !ROOT_SCRIPT_PUBLIC_WORKER_DIRS.has(workerDir));
  if (workerScriptRefs.length) {
    const disallowed = [...new Set(workerScriptRefs)].sort().map((workerDir) => `workers/${workerDir}`);
    failures.push(`root package scripts must not reference non-public worker package paths: ${disallowed.join(', ')}`);
  }
}

function verifyTestInventory(rootDir = path.resolve(__dirname, '..')) {
  const failures = [];

  verifyClassifiedRootTests(rootDir, failures);
  verifyWorkerTests(rootDir, failures);
  verifyRootScripts(rootDir, failures);

  return failures;
}

if (require.main === module) {
  const failures = verifyTestInventory();
  if (failures.length) {
    failures.forEach((failure) => console.error(`test inventory check failed: ${failure}`));
    process.exit(1);
  }
  console.log('test inventory check passed');
}

module.exports = {
  listDirectTestFiles,
  listRecursiveTestFiles,
  verifyTestInventory,
};
