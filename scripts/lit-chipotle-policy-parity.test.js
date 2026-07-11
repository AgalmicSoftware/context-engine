'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { transformSync } = require('esbuild');

const ROOT = path.resolve(__dirname, '..');
const POLICY_JS_PATH = path.join(ROOT, 'client', 'src', 'utilities', 'crypto', 'litChipotlePolicy.js');
const POLICY_TS_PATH = path.join(ROOT, 'client', 'src', 'utilities', 'crypto', 'litChipotlePolicy.ts');

const requireFresh = (modulePath) => {
  delete require.cache[require.resolve(modulePath)];
  return require(modulePath);
};

// Both twins are ESM and import `ethers`, so compile each to CJS and load the
// compiled module from inside scripts/ (not os.tmpdir) so `ethers` resolves
// against the repo's node_modules.
const loadCompiledModule = (sourcePath, loader) => {
  const tempDir = fs.mkdtempSync(path.join(__dirname, '.lit-chipotle-parity-'));
  try {
    const source = fs.readFileSync(sourcePath, 'utf8');
    const output = transformSync(source, {
      format: 'cjs',
      loader,
      sourcemap: false,
      target: 'node20',
    });
    const compiledPath = path.join(tempDir, `${path.basename(sourcePath, path.extname(sourcePath))}.cjs`);
    fs.writeFileSync(compiledPath, output.code);
    return requireFresh(compiledPath);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
};

const ADDRESS_A = '0x2222222222222222222222222222222222222222';
const ADDRESS_B = '0x1111111111111111111111111111111111111111';
const CEK_HEX = `0x${'ab'.repeat(32)}`;
const POLICY_INPUT = {
  chainId: '11155420',
  gateMode: ' ALL ',
  sbtAddresses: [ADDRESS_A, ADDRESS_B, ADDRESS_B],
  litActionCid: ' bafy-test-cid ',
  litPkpId: ' 0xpkp-test ',
};

const captureError = (fn) => {
  try {
    fn();
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
};

test('litChipotlePolicy JS and TS twins expose identical behavior', () => {
  const jsTwin = loadCompiledModule(POLICY_JS_PATH, 'js');
  const tsTwin = loadCompiledModule(POLICY_TS_PATH, 'ts');

  assert.deepEqual(Object.keys(jsTwin).sort(), Object.keys(tsTwin).sort());
  assert.equal(jsTwin.CHIPOTLE_WRAPPED_KEY_VERSION, tsTwin.CHIPOTLE_WRAPPED_KEY_VERSION);
  assert.equal(jsTwin.CHIPOTLE_POLICY_VERSION, tsTwin.CHIPOTLE_POLICY_VERSION);

  ['all', ' ALL ', 'any', 'bogus', '', undefined, 7].forEach((value) => {
    assert.equal(jsTwin.normalizeChipotleGateMode(value), tsTwin.normalizeChipotleGateMode(value));
  });
  ['10', 10, 0, -5, 3.5, 'x', undefined].forEach((value) => {
    assert.equal(jsTwin.normalizeChipotleChainId(value), tsTwin.normalizeChipotleChainId(value));
  });

  assert.deepEqual(
    jsTwin.normalizeChipotleSbtAddresses([ADDRESS_A, ADDRESS_B, ADDRESS_B, '']),
    tsTwin.normalizeChipotleSbtAddresses([ADDRESS_A, ADDRESS_B, ADDRESS_B, '']),
  );
  assert.equal(
    captureError(() => jsTwin.normalizeChipotleSbtAddresses(['not-an-address'])),
    captureError(() => tsTwin.normalizeChipotleSbtAddresses(['not-an-address'])),
  );

  const nested = { b: [2, 1, { z: true, a: 'x' }], a: 1, c: null };
  assert.equal(jsTwin.stableChipotleStringify(nested), tsTwin.stableChipotleStringify(nested));

  assert.deepEqual(jsTwin.buildLitChipotlePolicy(POLICY_INPUT), tsTwin.buildLitChipotlePolicy(POLICY_INPUT));
  [
    {},
    { chainId: 10 },
    { chainId: 10, sbtAddresses: [ADDRESS_A] },
    { chainId: 10, sbtAddresses: [ADDRESS_A], litActionCid: 'cid' },
  ].forEach((input) => {
    const jsError = captureError(() => jsTwin.buildLitChipotlePolicy(input));
    const tsError = captureError(() => tsTwin.buildLitChipotlePolicy(input));
    assert.notEqual(jsError, null);
    assert.equal(jsError, tsError);
  });

  assert.equal(jsTwin.fingerprintLitChipotlePolicy(POLICY_INPUT), tsTwin.fingerprintLitChipotlePolicy(POLICY_INPUT));

  const upperCek = `0x${'AB'.repeat(32)}`;
  assert.equal(jsTwin.normalizeChipotleCekHex(upperCek), tsTwin.normalizeChipotleCekHex(upperCek));
  assert.equal(
    captureError(() => jsTwin.normalizeChipotleCekHex('0x1234')),
    captureError(() => tsTwin.normalizeChipotleCekHex('0x1234')),
  );

  const jsWrapped = jsTwin.buildLitChipotleWrappedPlaintext({ cekHex: CEK_HEX, policy: POLICY_INPUT });
  const tsWrapped = tsTwin.buildLitChipotleWrappedPlaintext({ cekHex: CEK_HEX, policy: POLICY_INPUT });
  assert.deepEqual(jsWrapped, tsWrapped);

  assert.deepEqual(
    jsTwin.parseLitChipotleWrappedPlaintext(JSON.stringify(tsWrapped)),
    tsTwin.parseLitChipotleWrappedPlaintext(JSON.stringify(jsWrapped)),
  );
  const tamperedFingerprint = JSON.stringify({ ...tsWrapped, policyFingerprint: `0x${'00'.repeat(32)}` });
  assert.equal(
    captureError(() => jsTwin.parseLitChipotleWrappedPlaintext(tamperedFingerprint)),
    captureError(() => tsTwin.parseLitChipotleWrappedPlaintext(tamperedFingerprint)),
  );
  assert.equal(
    captureError(() => jsTwin.parseLitChipotleWrappedPlaintext('{"v":1}')),
    captureError(() => tsTwin.parseLitChipotleWrappedPlaintext('{"v":1}')),
  );
  assert.equal(
    captureError(() => jsTwin.parseLitChipotleWrappedPlaintext('not json')),
    captureError(() => tsTwin.parseLitChipotleWrappedPlaintext('not json')),
  );

  [{ version: 2 }, { v: '3' }, {}, null, { version: 0 }, { v: 2.5 }].forEach((value) => {
    assert.equal(
      jsTwin.normalizeLitChipotleMetadataVersion(value),
      tsTwin.normalizeLitChipotleMetadataVersion(value),
    );
  });
});
