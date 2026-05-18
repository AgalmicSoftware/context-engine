const fs = require('fs');
const path = require('path');
const { execFileSync } = require('node:child_process');

function readJson(rootDir, relativePath) {
  return JSON.parse(fs.readFileSync(path.join(rootDir, relativePath), 'utf8'));
}

function readText(rootDir, relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), 'utf8');
}

function listTrackedDistFiles(rootDir) {
  if (!fs.existsSync(path.join(rootDir, '.git'))) {
    return [];
  }

  return execFileSync('git', ['ls-files', 'dist'], {
    cwd: rootDir,
    encoding: 'utf8',
  }).split('\n').filter(Boolean);
}

function verifyTestWiring(rootDir = path.resolve(__dirname, '..')) {
  const failures = [];
  const pkg = readJson(rootDir, 'package.json');
  const scripts = pkg.scripts || {};
  const workflow = readText(rootDir, '.github/workflows/ci.yml');
  const publishWorkflowPath = '.github/workflows/publish-worker-bundles.yml';
  const publishWorkflow = fs.existsSync(path.join(rootDir, publishWorkflowPath))
    ? readText(rootDir, publishWorkflowPath)
    : '';
  const trackedDistFiles = listTrackedDistFiles(rootDir);

  const expectScriptContains = (scriptName, expected) => {
    const actual = String(scripts[scriptName] || '');
    if (!actual.includes(expected)) {
      failures.push(`scripts.${scriptName} must include "${expected}"`);
    }
  };
  const expectScriptOmits = (scriptName, unexpected) => {
    const actual = String(scripts[scriptName] || '');
    if (actual.includes(unexpected)) {
      failures.push(`scripts.${scriptName} must not include "${unexpected}"`);
    }
  };
  const expectScriptMissing = (scriptName) => {
    if (Object.prototype.hasOwnProperty.call(scripts, scriptName)) {
      failures.push(`scripts.${scriptName} must be removed`);
    }
  };

  const expectFile = (relativePath) => {
    if (!fs.existsSync(path.join(rootDir, relativePath))) {
      failures.push(`missing required file: ${relativePath}`);
    }
  };
  const expectFileMissing = (relativePath) => {
    if (fs.existsSync(path.join(rootDir, relativePath))) {
      failures.push(`file must be removed: ${relativePath}`);
    }
  };

  expectFile('test/deployHelperOrigins.test.mjs');
  expectFile('scripts/worker-bundle.mjs');
  expectFile('scripts/deploy-helper-deploy.mjs');
  expectFile('scripts/run-node-tests.js');
  expectFile('scripts/run-node-tests.test.js');
  expectFile('scripts/vite-navigation-smoke.js');
  expectFile('scripts/vite-navigation-smoke.test.js');
  expectFile('scripts/verify-worker-bundle-sync.mjs');
  expectFile('scripts/verify-worker-bundle-sync.test.js');
  expectFile(publishWorkflowPath);
  expectFile('workers/deploy-helper/wrangler.example.toml');
  expectFile('workers/deploy-helper/.dev.vars.example');
  expectFile('workers/deploy-helper/LICENSE');
  expectFileMissing('client/src/assets/worker/sessionCorsWorker.js.txt');
  expectFileMissing('client/src/assets/worker/sessionCorsWorker.unbundled.js.txt');
  expectFileMissing('client/src/assets/worker/deploy-helper-worker.js.txt');

  expectScriptContains('test:surveys-sbt', 'src/utilities/web3/contractScripts.surveys-sbt.proxy.test.js');
  expectScriptContains('test:node', 'scripts/run-node-tests.js');
  expectScriptContains('test:e2e', 'npm run -s test:e2e:smoke');
  expectScriptContains('test:e2e:quick', 'npm run -s test:e2e:smoke');
  expectScriptContains('test:e2e:smoke', 'npm run -s ai:test-nav:smoke');
  expectScriptContains('ai:test-nav:smoke', 'node scripts/vite-navigation-smoke.js');
  expectScriptContains('test:ci', 'npm run test:wiring');
  expectScriptContains('test:ci', 'npm run verify:release');
  expectScriptContains('test:ci', 'npm run test:node');
  expectScriptContains('tests', 'npm run test:ci');
  expectScriptContains('tests', 'npm run test:surveys-sbt');
  expectScriptContains('test:client', '--coverage');
  expectScriptContains('worker:bundle', 'scripts/worker-bundle.mjs');
  expectScriptContains('deploy-helper:deploy', 'scripts/deploy-helper-deploy.mjs');
  expectScriptContains('verify:worker-bundle', 'scripts/verify-worker-bundle-sync.mjs');
  expectScriptContains('verify:release', 'npm run lint');
  expectScriptContains('verify:release', 'npm run worker:bundle');
  expectScriptContains('verify:release', 'npm run verify:worker-bundle');
  expectScriptContains('verify:release', 'npm --prefix client run build');
  expectScriptOmits('verify:release', 'NODE_OPTIONS=--openssl-legacy-provider');

  if (!workflow.includes('run: npm run test:ci')) {
    failures.push('CI workflow must execute "npm run test:ci"');
  }
  if (!workflow.includes('run: npm run worker:bundle')) {
    failures.push('CI workflow must execute "npm run worker:bundle"');
  }
  if (!workflow.includes('run: npm run verify:worker-bundle')) {
    failures.push('CI workflow must execute "npm run verify:worker-bundle"');
  }
  if (!publishWorkflow.includes('run: npm run worker:bundle')) {
    failures.push('publish-worker-bundles workflow must execute "npm run worker:bundle"');
  }
  if (!publishWorkflow.includes('run: npm run verify:worker-bundle')) {
    failures.push('publish-worker-bundles workflow must execute "npm run verify:worker-bundle"');
  }
  if (!publishWorkflow.includes('softprops/action-gh-release@v2')) {
    failures.push('publish-worker-bundles workflow must publish release assets with softprops/action-gh-release@v2');
  }
  if (!publishWorkflow.includes('make_latest: true')) {
    failures.push('publish-worker-bundles workflow must explicitly mark worker bundle releases as latest');
  }
  if (!publishWorkflow.includes('dist/sessionCorsWorker.bundle.js')) {
    failures.push('publish-worker-bundles workflow must upload dist/sessionCorsWorker.bundle.js');
  }
  if (!publishWorkflow.includes('dist/deployHelper.bundle.js')) {
    failures.push('publish-worker-bundles workflow must upload dist/deployHelper.bundle.js');
  }
  if (trackedDistFiles.includes('dist/sessionCorsWorker.bundle.js')) {
    failures.push('dist/sessionCorsWorker.bundle.js must not be tracked by git');
  }
  if (trackedDistFiles.includes('dist/deployHelper.bundle.js')) {
    failures.push('dist/deployHelper.bundle.js must not be tracked by git');
  }

  return failures;
}

if (require.main === module) {
  const failures = verifyTestWiring();
  if (failures.length) {
    failures.forEach((failure) => console.error(`test wiring check failed: ${failure}`));
    process.exit(1);
  }
  console.log('test wiring check passed');
}

module.exports = {
  verifyTestWiring,
};
