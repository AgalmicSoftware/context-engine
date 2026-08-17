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
  const scripts = pkg.scripts || {};
  const requiredScriptFragments = [
    ['test:contracts', 'SurveysTest'],
    ['test:contracts', 'CustomSBTTest'],
    ['test:contracts', 'SessionRegistryTest'],
    ['test:contracts', 'SurveysFuzzTest'],
    ['test:contracts', 'CustomSBTFuzzTest'],
    ['test:contracts', 'SessionRegistryFuzzTest'],
    ['test:contracts', 'CustomSBTInvariantTest'],
    ['test:node', 'scripts/run-node-tests.js'],
    ['test:node:tracked', 'scripts/run-node-tests.js --tracked-only'],
    ['test:root:jest', '--testMatch'],
    ['test:worker:session-cors', 'npm --prefix workers/sessionCorsWorker test'],
    ['test:worker:agent-bridge', 'scripts/run-agent-bridge-worker-tests.js'],
    ['test:e2e', 'npm run -s test:e2e:smoke'],
    ['test:e2e:quick', 'npm run -s test:e2e:smoke'],
    ['test:e2e:smoke', 'npm run -s ai:test-nav:smoke'],
    ['ai:test-nav:smoke', 'scripts/vite-navigation-smoke.js'],
    ['test:ci', 'scripts/run-ci-gates.mjs --profile ci'],
    ['test:wiring', 'scripts/verify-test-inventory.js'],
    ['tests', 'npm run test:ci'],
    ['test:client', 'test:coverage:full-universe'],
    ['test:release:client', 'npm test -- --watchAll=false --runInBand'],
    ['typecheck:client-tests', 'scripts/check-client-test-types.mjs'],
    ['coverage-floor:check', 'scripts/check-client-coverage-floors.mjs'],
  ];
  requiredScriptFragments.forEach(([scriptName, expectedFragment]) => {
    verifyPackageScript(pkg, scriptName, expectedFragment, failures);
  });
  verifyPackageScript(pkg, 'ci:gate', 'scripts/run-ci-gates.mjs --gate', failures);

  ['verify:release', 'test:release:client', 'test:node:tracked'].forEach((fragment) => {
    if (String(scripts['test:ci'] || '').includes(fragment)) {
      failures.push(`package.json scripts.test:ci must not include "${fragment}"`);
    }
  });

  const surveysSbtProxyPath = 'client/src/utilities/web3/contractScripts.surveys-sbt.proxy.test.js';
  const surveysSbtProxyExists = fs.existsSync(path.join(rootDir, surveysSbtProxyPath));
  if (surveysSbtProxyExists) {
    verifyPackageScript(pkg, 'test:surveys-sbt', 'src/utilities/web3/contractScripts.surveys-sbt.proxy.test.js', failures);
    if (!String(scripts.tests || '').includes('npm run test:surveys-sbt')) {
      failures.push('package.json scripts.tests must include "npm run test:surveys-sbt"');
    }
  } else {
    if (Object.prototype.hasOwnProperty.call(scripts, 'test:surveys-sbt')) {
      failures.push('package.json must not define scripts.test:surveys-sbt without its classified test file');
    }
    if (String(scripts.tests || '').includes('npm run test:surveys-sbt')) {
      failures.push('package.json scripts.tests must not include "npm run test:surveys-sbt" without its classified test file');
    }
  }

  const manifestPath = path.join(rootDir, 'scripts', 'ci-gates.json');
  if (!fs.existsSync(manifestPath)) {
    failures.push('missing scripts/ci-gates.json');
  } else {
    const manifest = readJson(rootDir, path.join('scripts', 'ci-gates.json'));
    const ciProfile = manifest?.profiles?.ci || [];
    const hostedProfile = manifest?.profiles?.hosted || [];
    const gateCommands = (gateName) => (
      (manifest?.gates?.[gateName]?.commands || [])
        .map((entry) => [entry.command, ...(entry.args || [])].join(' '))
    );
    const expectProfileGate = (profileName, profile, gateName) => {
      if (!profile.includes(gateName)) {
        failures.push(`scripts/ci-gates.json profile "${profileName}" must include "${gateName}"`);
      }
    };
    const expectGateCommand = (gateName, command) => {
      if (!gateCommands(gateName).includes(command)) {
        failures.push(`scripts/ci-gates.json gate "${gateName}" must run ${command.slice('npm run '.length)}`);
      }
    };

    ['contracts', 'client', 'root-jest', 'workers', 'cecc-and-node'].forEach((gateName) => {
      expectProfileGate('ci', ciProfile, gateName);
    });
    ['contracts', 'client', 'root-jest', 'workers', 'e2e-smoke', 'cecc-and-node'].forEach((gateName) => {
      expectProfileGate('hosted', hostedProfile, gateName);
    });
    [
      ['wiring-and-release', 'npm run test:wiring'],
      ['wiring-and-release', 'npm run typecheck:client-tests'],
      ['contracts', 'npm run test:contracts'],
      ['client', 'npm run test:client'],
      ['client', 'npm run coverage-floor:check'],
      ['root-jest', 'npm run test:root:jest'],
      ['workers', 'npm run test:worker:session-cors'],
      ['workers', 'npm run test:worker:agent-bridge'],
      ['e2e-smoke', 'npm run test:e2e:smoke'],
      ['cecc-and-node', 'npm run test:node:tracked'],
      ['cecc-and-node', 'npm run test:cache-guard'],
      ['release', 'npm run typecheck:client-tests'],
      ['release', 'npm run test:node:tracked'],
      ['release', 'npm run test:release:client'],
    ].forEach(([gateName, command]) => expectGateCommand(gateName, command));
    if (gateCommands('cecc-and-node').includes('npm run test:node')) {
      failures.push('scripts/ci-gates.json gate "cecc-and-node" must not run test:node');
    }
    if (Object.prototype.hasOwnProperty.call(pkg.scripts || {}, 'test:cc')) {
      expectGateCommand('cecc-and-node', 'npm run test:cc');
    } else if (gateCommands('cecc-and-node').includes('npm run test:cc')) {
      failures.push('scripts/ci-gates.json gate "cecc-and-node" must not run test:cc');
    }
  }

  const workflowPath = path.join(rootDir, '.github', 'workflows', 'ci.yml');
  if (!fs.existsSync(workflowPath)) {
    failures.push('missing .github/workflows/ci.yml');
  } else {
    const workflow = fs.readFileSync(workflowPath, 'utf8');
    [
      ['contracts', 'run: npm run ci:gate -- contracts'],
      ['client', 'run: npm run ci:gate -- client'],
      ['root-jest', 'run: npm run ci:gate -- root-jest'],
      ['workers', 'run: npm run ci:gate -- workers'],
      ['e2e-smoke', 'npm run ci:gate -- e2e-smoke'],
      ['cecc-and-node', 'run: npm run ci:gate -- cecc-and-node'],
    ].forEach(([label, expected]) => {
      if (!workflow.includes(expected)) {
        failures.push(`.github/workflows/ci.yml must reach the ${label} test gate`);
      }
    });
    [
      ['  test:', 'the final aggregate test job'],
      ['needs:', 'the aggregate test dependency list'],
      ['if: ${{ always() }}', 'the always-running aggregate test job'],
      ['CI_GATE_RESULTS_JSON:', 'the manifest-backed aggregate result map'],
      ['run: npm run ci:gates:check-hosted', 'the manifest-backed aggregate checker'],
    ].forEach(([expected, description]) => {
      if (!workflow.includes(expected)) {
        failures.push(`.github/workflows/ci.yml must include ${description}`);
      }
    });
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
