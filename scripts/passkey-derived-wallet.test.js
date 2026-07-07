'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { ethers } = require('ethers');

const {
  DEFAULT_PASSKEY_RAW_ID_B64URL,
  base64UrlToBuffer,
  buildPasskeyDerivedWallet,
  toPasskeyEoaSeedRecord,
} = require('./lib/passkey-derived-wallet');

test('buildPasskeyDerivedWallet derives the fixture wallet through PRF/HKDF instead of rawId hashing', () => {
  const walletInfo = buildPasskeyDerivedWallet(DEFAULT_PASSKEY_RAW_ID_B64URL);
  const legacyRawIdKey = ethers.utils.keccak256(base64UrlToBuffer(DEFAULT_PASSKEY_RAW_ID_B64URL));

  assert.match(walletInfo.privateKey, /^0x[0-9a-f]{64}$/);
  assert.notEqual(walletInfo.privateKey, legacyRawIdKey);
  assert.equal(walletInfo.address, new ethers.Wallet(walletInfo.privateKey).address);
});

test('toPasskeyEoaSeedRecord stores only derived wallet metadata for browser E2E seeding', () => {
  const walletInfo = buildPasskeyDerivedWallet(DEFAULT_PASSKEY_RAW_ID_B64URL);
  const record = toPasskeyEoaSeedRecord({
    credentialId: walletInfo.credentialId,
    address: walletInfo.address,
  });

  assert.equal(record.keyMode, 'passkey-derived');
  assert.equal(record.derivationVersion, 'passkey-prf-hkdf-secp256k1-v1');
  assert.match(record.prfOutput, /^[A-Za-z0-9_-]+$/);
  assert.match(record.prfSalt, /^[A-Za-z0-9_-]+$/);
  assert.equal(Object.hasOwn(record, 'privateKey'), false);
  assert.equal(Object.hasOwn(record, 'encryptedPrivateKey'), false);
});

test('toPasskeyEoaSeedRecord rejects stale rawId-derived addresses', () => {
  const staleAddress = new ethers.Wallet(ethers.utils.keccak256(
    base64UrlToBuffer(DEFAULT_PASSKEY_RAW_ID_B64URL)
  )).address;

  assert.throws(
    () => toPasskeyEoaSeedRecord({
      credentialId: DEFAULT_PASSKEY_RAW_ID_B64URL,
      address: staleAddress,
    }),
    /does not match derived address/
  );
});
