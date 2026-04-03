'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { ethers } = require('ethers');

const {
  generatePrivateKeyAddress,
  inspectPrivateKeyAddress,
  normalizePrivateKey,
  readPrivateKey,
  writePrivateKeyFile,
} = require('./evm-key-address.js');

const makeTempDir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'ce-evm-key-address-'));

test('normalizePrivateKey accepts bare hex and 0x-prefixed keys', () => {
  const bare = '11'.repeat(32);
  const prefixed = `0x${'22'.repeat(32)}`;

  assert.equal(normalizePrivateKey(bare), `0x${bare}`);
  assert.equal(normalizePrivateKey(prefixed), prefixed);
});

test('readPrivateKey loads from file path and trims trailing newlines', () => {
  const tempDir = makeTempDir();
  const filePath = path.join(tempDir, 'wallet.key');
  const key = `${'33'.repeat(32)}\n`;
  fs.writeFileSync(filePath, key, 'utf8');

  const loaded = readPrivateKey({ inputPath: filePath, cwd: tempDir });

  assert.equal(loaded.source, `path:${filePath}`);
  assert.equal(loaded.inputPath, filePath);
  assert.equal(loaded.privateKey, `0x${'33'.repeat(32)}`);
});

test('generatePrivateKeyAddress writes a 0600 key file and inspect returns the same address', async () => {
  const tempDir = makeTempDir();
  const outputPath = path.join(tempDir, 'faucet.key');

  const generated = await generatePrivateKeyAddress({ outputPath, cwd: tempDir });
  const inspected = await inspectPrivateKeyAddress({ inputPath: outputPath, cwd: tempDir });
  const stat = fs.statSync(outputPath);

  assert.equal(generated.outputPath, outputPath);
  assert.equal(inspected.address, generated.address);
  assert.match(fs.readFileSync(outputPath, 'utf8'), /^0x[0-9a-fA-F]{64}\n$/);

  if (process.platform !== 'win32') {
    assert.equal(stat.mode & 0o777, 0o600);
  }
});

test('inspectPrivateKeyAddress derives the correct checksummed address from a key file', async () => {
  const tempDir = makeTempDir();
  const privateKey = `0x${'44'.repeat(32)}`;
  const filePath = path.join(tempDir, 'wallet.key');
  fs.writeFileSync(filePath, privateKey, 'utf8');

  const inspected = await inspectPrivateKeyAddress({ inputPath: filePath, cwd: tempDir });
  const expectedAddress = ethers.utils.getAddress(new ethers.Wallet(privateKey).address);

  assert.equal(inspected.address, expectedAddress);
  assert.equal(inspected.inputPath, filePath);
  assert.equal(inspected.balanceWei, null);
});

test('writePrivateKeyFile refuses to overwrite existing files unless force is enabled', () => {
  const tempDir = makeTempDir();
  const outputPath = path.join(tempDir, 'wallet.key');
  writePrivateKeyFile({
    privateKey: `0x${'55'.repeat(32)}`,
    outputPath,
    cwd: tempDir,
  });

  assert.throws(
    () => writePrivateKeyFile({
      privateKey: `0x${'66'.repeat(32)}`,
      outputPath,
      cwd: tempDir,
    }),
    /EEXIST/i,
  );

  const overwrittenPath = writePrivateKeyFile({
    privateKey: `0x${'66'.repeat(32)}`,
    outputPath,
    cwd: tempDir,
    force: true,
  });

  assert.equal(overwrittenPath, outputPath);
});
