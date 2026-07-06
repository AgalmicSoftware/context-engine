'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  OPERATOR_LOCAL_ABSENT,
  PORTO_FIX_HINT,
  analyzeEntrypoint,
  collectHarnessEntrypoints,
  extractTopLevelRequireSpecifiers,
  runHarnessDoctor,
} = require('./ai-harness-doctor');

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
    const { buildPasskeyDerivedWallet } = require('./lib/e2e/wallets.js');
    module.exports = { buildPasskeyDerivedWallet };
  `);

  const report = runHarnessDoctor(rootDir);
  const gateResult = report.results.find((result) => result.entrypoint === 'scripts/test-session-gates-any-all.js');
  const walletResult = report.results.find((result) => result.entrypoint === 'scripts/lib/e2e/wallets.js');

  assert.equal(gateResult.status, 'resolved');
  assert.equal(walletResult.status, 'resolved');
  assert.equal(report.summary.unresolved, 0);
});

test('runHarnessDoctor reports the first stale porto dependency with the passkey fix hint', (t) => {
  const rootDir = makeFixture(t);
  fs.writeFileSync(path.join(rootDir, 'scripts', 'lib', 'e2e', 'wallets.js'), `
    'use strict';
    module.exports = require('porto-wallet-derivation');
  `);
  fs.writeFileSync(path.join(rootDir, 'scripts', 'test-session-gates-any-all.js'), `
    'use strict';
    module.exports = require('./lib/e2e/wallets.js');
  `);

  const report = runHarnessDoctor(rootDir);
  const gateResult = report.results.find((result) => result.entrypoint === 'scripts/test-session-gates-any-all.js');

  assert.equal(gateResult.status, 'unresolved');
  assert.deepEqual(gateResult.firstUnresolved, {
    module: 'porto-wallet-derivation',
    importer: path.join('scripts', 'lib', 'e2e', 'wallets.js'),
    fixHint: PORTO_FIX_HINT,
  });
});

test('extractTopLevelRequireSpecifiers ignores lazy workflow requires', () => {
  const source = `
    'use strict';
    const fs = require('node:fs');
    const loadRuntime = () => {
      const runtime = require('./lib/e2e/operator-local-runtime');
      return runtime;
    };
  `;

  assert.deepEqual(extractTopLevelRequireSpecifiers(source), ['node:fs']);
});
