'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  generateArweaveJwk,
  inspectArweaveJwk,
  loadArweaveJwk,
  resolveOutputPath,
  writeArweaveJwkFile,
} = require('./lib/arweave-jwk');

const makeTempDir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'ce-arweave-jwk-'));

test('generateArweaveJwk writes a gitignored key file and inspectArweaveJwk derives the same address', async () => {
  const tempDir = makeTempDir();
  const outputPath = path.join(tempDir, 'wallet.jwk.json');

  const generated = await generateArweaveJwk({ outputPath, cwd: tempDir });
  const inspected = await inspectArweaveJwk({ inputPath: outputPath, cwd: tempDir });
  const stat = fs.statSync(outputPath);

  assert.equal(generated.outputPath, outputPath);
  assert.equal(inspected.address, generated.address);
  assert.equal(inspected.ownerToAddressMatches, true);
  assert.match(fs.readFileSync(outputPath, 'utf8'), /"kty": "RSA"/);

  if (process.platform !== 'win32') {
    assert.equal(stat.mode & 0o777, 0o600);
  }
});

test('loadArweaveJwk prefers ARWEAVE_JWK_PATH over inline env JSON', async () => {
  const tempDir = makeTempDir();
  const outputPath = path.join(tempDir, 'wallet.jwk.json');
  const generated = await generateArweaveJwk({ outputPath, cwd: tempDir });

  const loaded = loadArweaveJwk({
    cwd: tempDir,
    env: {
      ARWEAVE_JWK_PATH: outputPath,
      ARWEAVE_JWK_JSON: '{"kty":"RSA","n":"inline"}',
    },
  });

  assert.equal(loaded.source, `path:${outputPath}`);
  assert.equal(loaded.inputPath, outputPath);
  assert.ok(loaded.jwk.n);
  assert.notEqual(loaded.jwk.n, 'inline');
  assert.equal(resolveOutputPath({ outputPath, cwd: tempDir }), generated.outputPath);
});

test('writeArweaveJwkFile refuses to overwrite existing files unless force is enabled', async () => {
  const tempDir = makeTempDir();
  const outputPath = path.join(tempDir, 'wallet.jwk.json');
  const generated = await generateArweaveJwk({ outputPath, cwd: tempDir });

  assert.throws(
    () => writeArweaveJwkFile({
      jwk: { kty: 'RSA', n: generated.owner, e: 'AQAB' },
      outputPath,
      cwd: tempDir,
    }),
    /EEXIST/i,
  );

  const overwrittenPath = writeArweaveJwkFile({
    jwk: { kty: 'RSA', n: generated.owner, e: 'AQAB' },
    outputPath,
    cwd: tempDir,
    force: true,
  });

  assert.equal(overwrittenPath, outputPath);
});

test('inspectArweaveJwk reports address mismatches without hiding the derived address', async () => {
  const tempDir = makeTempDir();
  const outputPath = path.join(tempDir, 'wallet.jwk.json');
  const generated = await generateArweaveJwk({ outputPath, cwd: tempDir });

  const inspected = await inspectArweaveJwk({
    inputPath: outputPath,
    cwd: tempDir,
    expectedAddress: `${generated.address}x`,
  });

  assert.equal(inspected.address, generated.address);
  assert.equal(inspected.matchesExpected, false);
});
