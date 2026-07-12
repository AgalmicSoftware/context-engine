'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const SCRIPT_SOURCE_PATH = path.join(__dirname, 'prepare-public-release.sh');
const HELPER_SOURCE_PATH = path.join(__dirname, 'lib', 'public-release-strip-patterns.sh');
const SURFACE_VERIFIER_SOURCE_PATH = path.join(__dirname, 'verify-public-release-surface.js');
const DOCS_VERIFIER_SOURCE_PATH = path.join(__dirname, 'verify-public-docs.js');
const ASSET_VERIFIER_SOURCE_PATH = path.join(__dirname, 'verify-public-assets.js');
const TEXT_VERIFIER_SOURCE_PATH = path.join(__dirname, 'verify-public-text.js');
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
      path.join('scripts', 'lib', 'public-release-strip-patterns.sh'),
      fs.readFileSync(HELPER_SOURCE_PATH, 'utf8'),
    );
    writeFile(
      sourceDir,
      path.join('scripts', 'verify-public-release-surface.js'),
      fs.readFileSync(SURFACE_VERIFIER_SOURCE_PATH, 'utf8'),
    );
    writeFile(
      sourceDir,
      path.join('scripts', 'verify-public-docs.js'),
      fs.readFileSync(DOCS_VERIFIER_SOURCE_PATH, 'utf8'),
    );
    writeFile(
      sourceDir,
      path.join('scripts', 'verify-public-assets.js'),
      fs.readFileSync(ASSET_VERIFIER_SOURCE_PATH, 'utf8'),
    );
    writeFile(
      sourceDir,
      path.join('scripts', 'verify-public-text.js'),
      fs.readFileSync(TEXT_VERIFIER_SOURCE_PATH, 'utf8'),
    );
    fs.chmodSync(path.join(sourceDir, 'scripts', 'prepare-public-release.sh'), 0o755);

    for (const relativePath of [
      '.github/ISSUE_TEMPLATE/config.yml',
      'client/src/variables/publicRepoMetadata.ts',
      'workers/sessionCorsWorker/chipotleClient.test.mjs',
    ]) {
      writeFile(sourceDir, relativePath, fs.readFileSync(path.join(REPO_ROOT, relativePath), 'utf8'));
    }

    writeFile(
      sourceDir,
      'public.txt',
      `keep [redacted-email] and /redacted-home and contextengine${'@'}protonmail.com and ContextEngine${'@'}Protonmail.COM and contextengine+tag${'@'}protonmail.com\n`,
    );
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
    writeFile(sourceDir, path.join('docs', 'e2e-commands.md'), 'private operator commands\n');
    writeFile(sourceDir, path.join('docs', 'release-runbook.md'), 'private release procedure\n');
    writeFile(sourceDir, path.join('docs', 'security', 'audit-prep-2026-07-06.md'), 'private audit snapshot\n');
    writeFile(sourceDir, 'AGENTS.md', 'private agent instructions\n');
    writeFile(sourceDir, path.join('ai-discourse-corpus', 'corpuses', '_local_helper.js'), 'local helper script\n');
    writeFile(sourceDir, path.join('.tmp-review', 'review.js'), 'temporary review snapshot\n');
    writeFile(sourceDir, 'private-pack.manifest.json', 'tracked root manifest that should be replaced\n');
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
    writeFile(sourceDir, path.join('workers', 'agentBridgeWorker', 'worker.js'), 'public agent bridge worker\n');
    writeFile(sourceDir, path.join('workers', 'agentBridgeWorker', 'README.md'), 'agent bridge docs\n');
    writeFile(
      sourceDir,
      path.join('workers', 'agentBridgeWorker', 'PUBLIC_RELEASE_CUTOVER'),
      [
        'context-engine-agent-bridge-public-cutover-v1',
        'audited=2025-01-04',
        'scope=workers/agentBridgeWorker,scripts/run-agent-bridge-worker-tests.js',
        '',
      ].join('\n'),
    );
    writeFile(sourceDir, path.join('scripts', 'run-agent-bridge-worker-tests.js'), 'agent bridge test runner\n');
    writeFile(sourceDir, path.join('scripts', 'run-contextengine-cc-tests.js'), 'private companion test runner\n');
    writeFile(sourceDir, path.join('scripts', 'run-contextengine-cc-tests.test.js'), 'private companion runner test\n');
    writeFile(sourceDir, path.join('scripts', 'e2e-env-example.test.js'), 'private E2E env fixture test\n');
    writeFile(sourceDir, path.join('scripts', 'vendor-cecc-ethers-bundle.js'), 'private companion vendoring\n');
    writeFile(sourceDir, path.join('scripts', 'restore-private-pack.sh'), 'private restore workflow\n');
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
            'test:cc': 'node scripts/run-contextengine-cc-tests.js',
            'test:ci': 'npm run test && npm run test:cc',
            'test:worker:agent-bridge': 'node scripts/run-agent-bridge-worker-tests.js',
            'ai:test-cf-envelope:worker': 'npm run -s ai:node -- scripts/e2e/cloudflare-worker-envelope.js',
            'ai:test-cf-envelope:all': 'npm run -s ai:test-cf-envelope:worker',
            'ai:test-session:demo-smoke': 'npm run -s ai:node -- scripts/test-session-demo.ui.js',
            'ai:test-session:closeout-smoke': 'npm run -s ai:test-session:demo-smoke',
            'test:surveys-sbt': 'jest client/src/utilities/web3/contractScripts.surveys-sbt.proxy.test.js',
            tests: 'npm run test && npm run test:surveys-sbt',
          },
        },
        null,
        2,
      )}\n`,
    );

    const result = runPrepareScript(sourceDir, outputDir);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /files stripped, output at /);

    assert.equal(
      fs.readFileSync(path.join(outputDir, 'public.txt'), 'utf8'),
      `keep [redacted-email] and /redacted-home and contextengine${'@'}protonmail.com and ContextEngine${'@'}Protonmail.COM and [redacted-email]\n`,
    );
    assert.match(
      fs.readFileSync(path.join(outputDir, '.github/ISSUE_TEMPLATE/config.yml'), 'utf8'),
      /mailto:contextengine@protonmail\.com/,
    );
    assert.match(
      fs.readFileSync(path.join(outputDir, 'client/src/variables/publicRepoMetadata.ts'), 'utf8'),
      /PUBLIC_SECURITY_EMAIL = 'contextengine@protonmail\.com'/,
    );
    const publicChipotleTest = fs.readFileSync(
      path.join(outputDir, 'workers/sessionCorsWorker/chipotleClient.test.mjs'),
      'utf8',
    );
    assert.match(publicChipotleTest, /credentialedApiBase/);
    assert.match(publicChipotleTest, /must not include credentials/);
    assert.doesNotMatch(publicChipotleTest, /\[redacted-email\]/);
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(outputDir, 'package.json'), 'utf8')).scripts, {
      test: 'node scripts/run-node-tests.js',
      'test:ci': 'npm run test',
      'test:worker:agent-bridge': 'node scripts/run-agent-bridge-worker-tests.js',
      tests: 'npm run test',
    });
    assert.equal(fs.existsSync(path.join(outputDir, '.DS_Store')), false);
    assert.equal(fs.existsSync(path.join(outputDir, '.secrets.baseline')), false);
    assert.equal(fs.existsSync(path.join(outputDir, '.env.local')), false);
    assert.equal(fs.existsSync(path.join(outputDir, '.env.e2e')), false);
    assert.equal(fs.existsSync(path.join(outputDir, '.env.e2e.local')), false);
    assert.equal(fs.existsSync(path.join(outputDir, '.env.e2e.example')), false);
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
    assert.equal(fs.existsSync(path.join(outputDir, 'docs', 'e2e-commands.md')), false);
    assert.equal(fs.existsSync(path.join(outputDir, 'docs', 'release-runbook.md')), false);
    assert.equal(fs.existsSync(path.join(outputDir, 'docs', 'security', 'audit-prep-2026-07-06.md')), false);
    assert.equal(fs.existsSync(path.join(outputDir, 'AGENTS.md')), false);
    assert.equal(fs.existsSync(path.join(outputDir, 'ai-discourse-corpus', 'corpuses', '_local_helper.js')), false);
    assert.equal(fs.existsSync(path.join(outputDir, '.tmp-review')), false);
    assert.equal(fs.existsSync(path.join(outputDir, 'TODO')), false);
    assert.equal(fs.existsSync(path.join(outputDir, 'TODO', `${'PR'}${'D'}s`)), false);
    assert.equal(fs.existsSync(path.join(outputDir, 'contextEngine-cc')), false);
    assert.equal(fs.existsSync(path.join(outputDir, 'contextEngine-cc', 'server.mjs')), false);
    assert.equal(fs.existsSync(path.join(outputDir, 'contextEngine-cc', 'package.json')), false);
    assert.equal(fs.existsSync(path.join(outputDir, 'tests', 'root', 'private-runtime.private.test.mjs')), false);
    assert.equal(fs.existsSync(path.join(outputDir, 'docs', 'agent-native-contract.md')), false);
    assert.equal(fs.existsSync(path.join(outputDir, 'docs', 'agent-native-bridge.md')), false);
    assert.equal(fs.existsSync(path.join(outputDir, 'client', 'public', 'skill.md')), false);
    assert.equal(fs.existsSync(path.join(outputDir, 'workers', 'agentBridgeWorker')), true);
    assert.equal(fs.existsSync(path.join(outputDir, 'workers', 'agentBridgeWorker', 'worker.js')), true);
    assert.equal(
      fs.existsSync(path.join(outputDir, 'workers', 'agentBridgeWorker', 'PUBLIC_RELEASE_CUTOVER')),
      true,
    );
    assert.equal(fs.existsSync(path.join(outputDir, 'scripts', 'run-agent-bridge-worker-tests.js')), true);
    assert.equal(fs.existsSync(path.join(outputDir, 'scripts', 'run-contextengine-cc-tests.js')), false);
    assert.equal(fs.existsSync(path.join(outputDir, 'scripts', 'run-contextengine-cc-tests.test.js')), false);
    assert.equal(fs.existsSync(path.join(outputDir, 'scripts', 'e2e-env-example.test.js')), false);
    assert.equal(fs.existsSync(path.join(outputDir, 'scripts', 'vendor-cecc-ethers-bundle.js')), false);
    assert.equal(fs.existsSync(path.join(outputDir, 'scripts', 'restore-private-pack.sh')), false);
    assert.equal(fs.existsSync(path.join(outputDir, 'scripts', 'lib', 'passkey-wallet-derivation.js')), false);
    assert.equal(fs.existsSync(path.join(outputDir, 'private-pack.manifest.json')), false);
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
    writeFile(
      sourceDir,
      path.join('scripts', 'verify-public-docs.js'),
      fs.readFileSync(DOCS_VERIFIER_SOURCE_PATH, 'utf8'),
    );
    writeFile(
      sourceDir,
      path.join('scripts', 'verify-public-assets.js'),
      fs.readFileSync(ASSET_VERIFIER_SOURCE_PATH, 'utf8'),
    );
    writeFile(
      sourceDir,
      path.join('scripts', 'verify-public-text.js'),
      fs.readFileSync(TEXT_VERIFIER_SOURCE_PATH, 'utf8'),
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
