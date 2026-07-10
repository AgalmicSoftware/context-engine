'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const SCRIPT_SOURCE_PATH = path.join(__dirname, 'prepare-public-release.sh');
const PACKAGE_SCRUBBER_SOURCE_PATH = path.join(__dirname, 'scrub-public-package-json.js');
const HELPER_SOURCE_PATH = path.join(__dirname, 'lib', 'public-release-strip-patterns.sh');
const SURFACE_VERIFIER_SOURCE_PATH = path.join(__dirname, 'verify-public-release-surface.js');
const TEST_TMP_ROOT = path.join(__dirname, '.tmp-prepare-public-release-tests');
const REPO_ROOT = path.join(__dirname, '..');

function writeFile(rootDir, relativePath, contents) {
  const absolutePath = path.join(rootDir, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, contents);
}

function runPrepareScript(rootDir, outputDir) {
  return spawnSync('bash', [path.join(rootDir, 'scripts', 'prepare-public-release.sh'), '--force', outputDir], {
    cwd: rootDir,
    encoding: 'utf8',
    env: {
      ...process.env,
      TMPDIR: TEST_TMP_ROOT,
    },
  });
}

test('prepare-public-release strips private surfaces without publishing an inventory manifest', () => {
  fs.mkdirSync(TEST_TMP_ROOT, { recursive: true });
  const tempRoot = fs.mkdtempSync(path.join(TEST_TMP_ROOT, 'ce-prepare-public-release-'));
  const sourceDir = path.join(tempRoot, 'source');
  const outputDir = path.join(tempRoot, 'release-public');

  try {
    writeFile(sourceDir, path.join('scripts', 'prepare-public-release.sh'), fs.readFileSync(SCRIPT_SOURCE_PATH, 'utf8'));
    writeFile(
      sourceDir,
      path.join('scripts', 'scrub-public-package-json.js'),
      fs.readFileSync(PACKAGE_SCRUBBER_SOURCE_PATH, 'utf8'),
    );
    writeFile(
      sourceDir,
      path.join('scripts', 'lib', 'public-release-strip-patterns.sh'),
      fs.readFileSync(HELPER_SOURCE_PATH, 'utf8'),
    );
    writeFile(
      sourceDir,
      path.join('scripts', 'verify-public-release-surface.js'),
      fs.readFileSync(SURFACE_VERIFIER_SOURCE_PATH, 'utf8'),
    );
    fs.chmodSync(path.join(sourceDir, 'scripts', 'prepare-public-release.sh'), 0o755);

    writeFile(sourceDir, 'public.txt', 'keep\n');
    writeFile(sourceDir, '.DS_Store', 'mac metadata\n');
    writeFile(sourceDir, '.secrets.baseline', '{"results":{".codex/secret.txt":[]}}\n');
    writeFile(sourceDir, '.env.local', 'SECRET=value\n');
    writeFile(sourceDir, '.env.e2e', 'E2E_SECRET=value\n');
    writeFile(sourceDir, '.env.e2e.local', 'E2E_LOCAL_SECRET=value\n');
    writeFile(sourceDir, '.env.e2e.example', 'E2E_AI_MOCK=1\n');
    writeFile(sourceDir, path.join('.keys', 'arweave-upload.json'), '{"k":"secret"}\n');
    writeFile(sourceDir, path.join('.e2e-cache', 'wallet.json'), '{"address":"0xexample"}\n');
    writeFile(sourceDir, path.join('release-public', 'old-release.txt'), 'old artifact\n');
    writeFile(sourceDir, path.join('dist', 'sessionCorsWorker.bundle.js'), 'generated bundle\n');
    writeFile(sourceDir, path.join('workers', 'sessionCorsWorker', 'node_modules', 'left-pad', 'index.js'), 'module.exports = null;\n');
    writeFile(sourceDir, path.join('out', 'contract-artifact.json'), '{}\n');
    writeFile(sourceDir, path.join('cache', 'forge-cache.json'), '{}\n');
    writeFile(sourceDir, path.join('broadcast', 'run.json'), '{}\n');
    writeFile(sourceDir, path.join('output', 'imagegen', 'generated.png'), 'generated image\n');
    writeFile(sourceDir, path.join('.codex-artifacts', 'jest-cache', 'cache-file'), 'local cache\n');
    writeFile(sourceDir, path.join('.codex-solc', 'compiler-cache'), 'compiler cache\n');
    writeFile(sourceDir, path.join('.codex-tmp', 'scratch.txt'), 'scratch\n');
    writeFile(sourceDir, path.join('docs', 'codebase-health-modernization-2026-05-07.md'), 'local audit notes\n');
    writeFile(sourceDir, path.join('docs', 'assets', 'codebase-health-modernization-2026-05-07.png'), 'local audit chart\n');
    writeFile(sourceDir, path.join('docs', 'telegram-response-export-scope-prd.md'), 'private product planning\n');
    writeFile(sourceDir, path.join('.tmp-review', 'review.js'), 'temporary review snapshot\n');
    writeFile(sourceDir, 'private-pack.manifest.json', 'tracked root manifest that should be replaced\n');
    writeFile(
      sourceDir,
      path.join('outreach-and-applications', 'applications', 'draft.md'),
      'private opportunity and application state\n',
    );
    writeFile(
      sourceDir,
      path.join('grant-applications', 'legacy-draft.md'),
      'legacy private application state\n',
    );
    writeFile(sourceDir, path.join('TODO', 'secret.md'), 'private planning\n');
    writeFile(sourceDir, path.join('TODO', `${'PR'}${'D'}s`, '123_private-roadmap.md'), 'private roadmap\n');
    writeFile(sourceDir, path.join('contextEngine-cc', 'secret.txt'), 'private companion surface\n');
    writeFile(sourceDir, path.join('contextEngine-cc', 'TODO', `${'PR'}${'D'}s`, '155_private-cecc.md'), 'private companion plan\n');
    writeFile(sourceDir, path.join('contextEngine-cc', 'server.mjs'), 'private runtime server\n');
    writeFile(sourceDir, path.join('contextEngine-cc', 'package.json'), '{"private":true}\n');
    writeFile(sourceDir, path.join('contextEngine-cc', 'public', 'js', 'sessionSlugs.mjs'), 'export default [];\n');
    writeFile(sourceDir, path.join('tests', 'root', 'private-runtime.private.test.mjs'), 'private companion service worker test\n');
    writeFile(sourceDir, path.join('docs', 'agent-native-contract.md'), 'private agent contract\n');
    writeFile(sourceDir, path.join('docs', 'agent-native-bridge.md'), 'private agent bridge\n');
    writeFile(sourceDir, path.join('client', 'public', 'skill.md'), 'private agent skill\n');
    writeFile(sourceDir, path.join('workers', 'agentBridgeWorker', 'worker.js'), 'private bridge worker\n');
    writeFile(sourceDir, path.join('workers', 'agentBridgeWorker', 'README.md'), 'private bridge docs\n');
    writeFile(sourceDir, path.join('scripts', 'run-agent-bridge-worker-tests.js'), 'private bridge test runner\n');
    writeFile(sourceDir, path.join('scripts', 'vendor-cecc-ethers-bundle.js'), 'private companion vendoring\n');
    writeFile(
      sourceDir,
      path.join('scripts', 'lib', 'passkey-wallet-derivation.js'),
      "module.exports = { privateHarnessOnly: true };\n",
    );
    writeFile(
      sourceDir,
      'package.json',
      `${JSON.stringify(
        {
          scripts: {
            test: 'node scripts/run-node-tests.js',
            'test:worker:agent-bridge': 'node scripts/run-agent-bridge-worker-tests.js',
            'ai:test-cf-envelope:worker': 'npm run -s ai:node -- scripts/e2e/cloudflare-worker-envelope.js',
            'ai:test-cf-envelope:all': 'npm run -s ai:test-cf-envelope:worker',
            'ai:test-session:demo-smoke': 'npm run -s ai:node -- scripts/test-session-demo.ui.js',
            'ai:test-session:closeout-smoke': 'npm run -s ai:test-session:demo-smoke',
          },
        },
        null,
        2,
      )}\n`,
    );

    const result = runPrepareScript(sourceDir, outputDir);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /files stripped, output at /);

    assert.equal(fs.readFileSync(path.join(outputDir, 'public.txt'), 'utf8'), 'keep\n');
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(outputDir, 'package.json'), 'utf8')).scripts, {
      test: 'node scripts/run-node-tests.js',
    });
    assert.equal(fs.existsSync(path.join(outputDir, '.DS_Store')), false);
    assert.equal(fs.existsSync(path.join(outputDir, '.secrets.baseline')), false);
    assert.equal(fs.existsSync(path.join(outputDir, '.env.local')), false);
    assert.equal(fs.existsSync(path.join(outputDir, '.env.e2e')), false);
    assert.equal(fs.existsSync(path.join(outputDir, '.env.e2e.local')), false);
    assert.equal(fs.readFileSync(path.join(outputDir, '.env.e2e.example'), 'utf8'), 'E2E_AI_MOCK=1\n');
    assert.equal(fs.existsSync(path.join(outputDir, '.keys')), false);
    assert.equal(fs.existsSync(path.join(outputDir, '.e2e-cache')), false);
    assert.equal(fs.existsSync(path.join(outputDir, 'release-public')), false);
    assert.equal(fs.existsSync(path.join(outputDir, 'dist')), false);
    assert.equal(fs.existsSync(path.join(outputDir, 'workers', 'sessionCorsWorker', 'node_modules')), false);
    assert.equal(fs.existsSync(path.join(outputDir, 'out')), false);
    assert.equal(fs.existsSync(path.join(outputDir, 'cache')), false);
    assert.equal(fs.existsSync(path.join(outputDir, 'broadcast')), false);
    assert.equal(fs.existsSync(path.join(outputDir, 'output')), false);
    assert.equal(fs.existsSync(path.join(outputDir, '.codex-artifacts')), false);
    assert.equal(fs.existsSync(path.join(outputDir, '.codex-solc')), false);
    assert.equal(fs.existsSync(path.join(outputDir, '.codex-tmp')), false);
    assert.equal(fs.existsSync(path.join(outputDir, 'docs', 'codebase-health-modernization-2026-05-07.md')), false);
    assert.equal(fs.existsSync(path.join(outputDir, 'docs', 'assets', 'codebase-health-modernization-2026-05-07.png')), false);
    assert.equal(fs.existsSync(path.join(outputDir, 'docs', 'telegram-response-export-scope-prd.md')), false);
    assert.equal(fs.existsSync(path.join(outputDir, '.tmp-review')), false);
    assert.equal(fs.existsSync(path.join(outputDir, 'outreach-and-applications')), false);
    assert.equal(fs.existsSync(path.join(outputDir, 'grant-applications')), false);
    assert.equal(fs.existsSync(path.join(outputDir, 'TODO')), false);
    assert.equal(fs.existsSync(path.join(outputDir, 'TODO', `${'PR'}${'D'}s`)), false);
    assert.equal(fs.existsSync(path.join(outputDir, 'contextEngine-cc')), false);
    assert.equal(fs.existsSync(path.join(outputDir, 'contextEngine-cc', 'server.mjs')), false);
    assert.equal(fs.existsSync(path.join(outputDir, 'contextEngine-cc', 'package.json')), false);
    assert.equal(fs.existsSync(path.join(outputDir, 'tests', 'root', 'private-runtime.private.test.mjs')), false);
    assert.equal(fs.existsSync(path.join(outputDir, 'docs', 'agent-native-contract.md')), false);
    assert.equal(fs.existsSync(path.join(outputDir, 'docs', 'agent-native-bridge.md')), false);
    assert.equal(fs.existsSync(path.join(outputDir, 'client', 'public', 'skill.md')), false);
    assert.equal(fs.existsSync(path.join(outputDir, 'workers', 'agentBridgeWorker')), false);
    assert.equal(fs.existsSync(path.join(outputDir, 'workers', 'agentBridgeWorker', 'worker.js')), false);
    assert.equal(fs.existsSync(path.join(outputDir, 'scripts', 'run-agent-bridge-worker-tests.js')), false);
    assert.equal(fs.existsSync(path.join(outputDir, 'scripts', 'vendor-cecc-ethers-bundle.js')), false);
    assert.equal(fs.existsSync(path.join(outputDir, 'scripts', 'lib', 'passkey-wallet-derivation.js')), false);

    const manifestPath = path.join(outputDir, 'private-pack.manifest.json');
    assert.equal(fs.existsSync(manifestPath), true);

    const manifestText = fs.readFileSync(manifestPath, 'utf8');
    assert.doesNotMatch(manifestText, /tracked root manifest that should be replaced/);
    assert.doesNotMatch(manifestText, /TODO/);
    assert.doesNotMatch(manifestText, new RegExp(`${'PR'}${'D'}s`));
    assert.match(manifestText, /\.secrets\.baseline/);
    assert.doesNotMatch(manifestText, /\.env\.local/);
    assert.doesNotMatch(manifestText, /\.env\.e2e/);
    assert.doesNotMatch(manifestText, /\.keys/);
    assert.doesNotMatch(manifestText, /codebase-health-modernization/);
    assert.doesNotMatch(manifestText, /telegram-response-export-scope-prd/);
    assert.doesNotMatch(manifestText, /\.private\.test/);
    assert.match(manifestText, /private-pack\.manifest\.json/);
    assert.match(manifestText, /scripts\/lib\/passkey-wallet-derivation\.js/);
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('prepare-public-release fails if private planning paths survive strip rules', () => {
  fs.mkdirSync(TEST_TMP_ROOT, { recursive: true });
  const tempRoot = fs.mkdtempSync(path.join(TEST_TMP_ROOT, 'ce-prepare-public-release-'));
  const sourceDir = path.join(tempRoot, 'source');
  const outputDir = path.join(tempRoot, 'release-public');

  try {
    writeFile(sourceDir, path.join('scripts', 'prepare-public-release.sh'), fs.readFileSync(SCRIPT_SOURCE_PATH, 'utf8'));
    writeFile(
      sourceDir,
      path.join('scripts', 'lib', 'public-release-strip-patterns.sh'),
      fs.readFileSync(HELPER_SOURCE_PATH, 'utf8'),
    );
    writeFile(
      sourceDir,
      path.join('scripts', 'verify-public-release-surface.js'),
      fs.readFileSync(SURFACE_VERIFIER_SOURCE_PATH, 'utf8'),
    );
    fs.chmodSync(path.join(sourceDir, 'scripts', 'prepare-public-release.sh'), 0o755);

    writeFile(sourceDir, 'public.txt', 'keep\n');
    writeFile(sourceDir, path.join('docs', 'public', 'telegram-prd-leak.md'), 'private planning in a public path\n');

    const result = runPrepareScript(sourceDir, outputDir);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Private planning paths are still visible/);
    assert.match(result.stderr, /telegram-prd-leak/);
    assert.equal(fs.existsSync(outputDir), false);
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});
