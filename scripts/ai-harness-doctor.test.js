'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  OPERATOR_LOCAL_ABSENT,
  PASSKEY_FIX_HINT,
  analyzeEntrypoint,
  collectHarnessEntrypoints,
  extractTopLevelRequireSpecifiers,
  runHarnessDoctor,
} = require('./ai-harness-doctor');

const STRIPPED_WALLETS_SPECIFIER = './lib/e2e/wallets.js';
const STRIPPED_OPERATOR_RUNTIME_SPECIFIER = './lib/e2e/operator-local-runtime';
const FIXTURE_REQUIRE_NAME = 'require';
// Assemble stripped fixture requires so the public-surface checker scans fixture output, not this test source.
const fixtureRequire = (specifier) => `${FIXTURE_REQUIRE_NAME}('${specifier}')`;

function makeFixture(t) {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ce-harness-doctor-'));
  t.after(() => fs.rmSync(rootDir, { recursive: true, force: true }));
  fs.mkdirSync(path.join(rootDir, 'scripts', 'lib', 'e2e'), { recursive: true });
  fs.writeFileSync(path.join(rootDir, 'package.json'), JSON.stringify({
    scripts: {
      'ai:test-gates:any-all': 'node scripts/test-session-gates-any-all.js',
      'ai:test-demo': 'node scripts/test-demo.ui.js',
    },
  }, null, 2));
  return rootDir;
}

test('collectHarnessEntrypoints includes package scripts and the e2e wallet helper', (t) => {
  const rootDir = makeFixture(t);

  assert.deepEqual(collectHarnessEntrypoints(rootDir), [
    'scripts/lib/e2e/wallets.js',
    'scripts/test-demo.ui.js',
    'scripts/test-session-gates-any-all.js',
  ]);
});

test('analyzeEntrypoint reports absent operator-local entrypoints without failing resolution', (t) => {
  const rootDir = makeFixture(t);

  assert.deepEqual(analyzeEntrypoint(rootDir, 'scripts/test-session-gates-any-all.js'), {
    entrypoint: 'scripts/test-session-gates-any-all.js',
    status: 'absent',
    message: OPERATOR_LOCAL_ABSENT,
  });
});

test('runHarnessDoctor resolves restored passkey harness files', (t) => {
  const rootDir = makeFixture(t);
  fs.writeFileSync(path.join(rootDir, 'scripts', 'lib', 'passkey-derived-wallet.js'), `
    'use strict';
    module.exports = { buildPasskeyDerivedWallet: () => ({ address: '0x0' }) };
  `);
  fs.writeFileSync(path.join(rootDir, 'scripts', 'lib', 'e2e', 'wallets.js'), `
    'use strict';
    const { buildPasskeyDerivedWallet } = require('../passkey-derived-wallet.js');
    module.exports = { buildPasskeyDerivedWallet };
  `);
  fs.writeFileSync(path.join(rootDir, 'scripts', 'test-session-gates-any-all.js'), `
    'use strict';
    const { buildPasskeyDerivedWallet } = ${fixtureRequire(STRIPPED_WALLETS_SPECIFIER)};
    module.exports = { buildPasskeyDerivedWallet };
  `);

  const report = runHarnessDoctor(rootDir);
  const gateResult = report.results.find((result) => result.entrypoint === 'scripts/test-session-gates-any-all.js');
  const walletResult = report.results.find((result) => result.entrypoint === 'scripts/lib/e2e/wallets.js');

  assert.equal(gateResult.status, 'resolved');
  assert.equal(walletResult.status, 'resolved');
  assert.equal(report.summary.unresolved, 0);
});

test('runHarnessDoctor reports a missing private passkey helper with its restore hint', (t) => {
  const rootDir = makeFixture(t);
  fs.writeFileSync(path.join(rootDir, 'scripts', 'lib', 'e2e', 'wallets.js'), `
    'use strict';
    module.exports = require('../passkey-wallet-derivation.js');
  `);
  fs.writeFileSync(path.join(rootDir, 'scripts', 'test-session-gates-any-all.js'), `
    'use strict';
    module.exports = ${fixtureRequire(STRIPPED_WALLETS_SPECIFIER)};
  `);

  const report = runHarnessDoctor(rootDir);
  const gateResult = report.results.find((result) => result.entrypoint === 'scripts/test-session-gates-any-all.js');

  assert.equal(gateResult.status, 'unresolved');
  assert.deepEqual(gateResult.firstUnresolved, {
    module: '../passkey-wallet-derivation.js',
    importer: path.join('scripts', 'lib', 'e2e', 'wallets.js'),
    fixHint: PASSKEY_FIX_HINT,
  });
});

test('extractTopLevelRequireSpecifiers ignores lazy workflow requires', () => {
  const source = `
    'use strict';
    const fs = require('node:fs');
    const loadRuntime = () => {
      const runtime = ${fixtureRequire(STRIPPED_OPERATOR_RUNTIME_SPECIFIER)};
      return runtime;
    };
  `;

  assert.deepEqual(extractTopLevelRequireSpecifiers(source), ['node:fs']);
});
